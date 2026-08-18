import { query } from '../db/mysql.js';
import { Promotion } from './admin/promotions.service.js';

interface TicketItem {
  id: string;
  price: number;
  ticketTypeId?: string;
}

interface CalculateDiscountInput {
  eventId: string;
  tickets: TicketItem[];
  promoCode?: string;
  /** Ticket-class picker: apply this exact promotion after re-validating. */
  promotionId?: string;
}

interface DiscountResult {
  promotionId: string;
  name: string;
  discountAmount: number;
}

export interface EligiblePromotion extends DiscountResult {
  type: string;
  code: string | null;
  discountType: string;
  discountValue: number;
  isBest: boolean;
}

async function getLivePromotions(eventId: string): Promise<Promotion[]> {
  const now = new Date();
  return query<Promotion>(
    `SELECT * FROM promotions
     WHERE event_id = ?
     AND is_active = 1
     AND start_date <= ?
     AND end_date >= ?
     AND (max_usage IS NULL OR used_count < max_usage)`,
    [eventId, now, now]
  );
}

/**
 * How much one promotion is worth for this cart, or null if it does not qualify.
 * Combo multiplier is preserved: floor(count / min_tickets) stacks, and
 * percentage combos discount the most expensive tickets first.
 */
function computeDiscount(promo: Promotion, tickets: TicketItem[]): number | null {
  const totalAmount = tickets.reduce((sum, t) => sum + Number(t.price), 0);

  let applicableTickets = tickets;
  if (promo.ticket_type_ids) {
    try {
      const allowedTypes: string[] = JSON.parse(promo.ticket_type_ids);
      if (allowedTypes.length > 0) {
        applicableTickets = tickets.filter(
          (t) => t.ticketTypeId && allowedTypes.includes(t.ticketTypeId)
        );
        if (applicableTickets.length === 0) return null;
      }
    } catch {
      console.error('Failed to parse ticket_type_ids', promo.ticket_type_ids);
    }
  }

  let multiplier = 1;
  if (promo.type === 'COMBO') {
    const minT = promo.min_tickets || 1;
    if (applicableTickets.length < minT) return null;
    if (promo.max_tickets && applicableTickets.length > promo.max_tickets) return null;
    multiplier = Math.floor(applicableTickets.length / minT);
    if (multiplier === 0) return null;
  }

  const applicableAmount = applicableTickets.reduce((sum, t) => sum + Number(t.price), 0);

  let discountAmt = 0;
  if (promo.discount_type === 'PERCENTAGE') {
    if (promo.type === 'COMBO' && promo.min_tickets && promo.min_tickets > 0) {
      const sortedTickets = [...applicableTickets].sort((a, b) => Number(b.price) - Number(a.price));
      const discountedTickets = sortedTickets.slice(0, multiplier * promo.min_tickets);
      const targetAmount = discountedTickets.reduce((sum, t) => sum + Number(t.price), 0);
      discountAmt = (targetAmount * Number(promo.discount_value)) / 100;
    } else {
      discountAmt = (applicableAmount * Number(promo.discount_value)) / 100;
    }
  } else if (promo.discount_type === 'FIXED_AMOUNT') {
    discountAmt = multiplier * Number(promo.discount_value);
  }

  if (discountAmt > totalAmount) discountAmt = totalAmount;
  if (discountAmt <= 0) return null;
  return Math.round(discountAmt);
}

/**
 * Promotions this cart can use. Auto (COMBO / EARLY_BIRD) always listed.
 * A PROMO_CODE only appears after its code is entered.
 */
export async function listEligiblePromotions(
  input: CalculateDiscountInput
): Promise<EligiblePromotion[]> {
  const { eventId, tickets, promoCode } = input;
  if (!tickets || tickets.length === 0) return [];

  const live = await getLivePromotions(eventId);
  const candidates = live.filter((p) =>
    p.type === 'PROMO_CODE' ? Boolean(promoCode) && p.code === promoCode : true
  );

  const eligible: EligiblePromotion[] = [];
  for (const promo of candidates) {
    const amount = computeDiscount(promo, tickets);
    if (amount === null) continue;
    eligible.push({
      promotionId: promo.id,
      name: promo.name,
      type: promo.type,
      code: promo.code,
      discountType: promo.discount_type,
      discountValue: Number(promo.discount_value),
      discountAmount: amount,
      isBest: false,
    });
  }

  eligible.sort((a, b) => b.discountAmount - a.discountAmount);
  if (eligible.length > 0) eligible[0].isBest = true;
  return eligible;
}

/**
 * Discount to apply.
 * - promotionId → that exact promotion, re-validated
 * - otherwise → best among auto promos + matching promo code (seats flow)
 */
export async function calculateBestDiscount(
  input: CalculateDiscountInput
): Promise<DiscountResult | null> {
  const { eventId, tickets, promoCode, promotionId } = input;
  if (!tickets || tickets.length === 0) return null;

  const promotions = await getLivePromotions(eventId);

  if (promotionId) {
    const chosen = promotions.find((p) => p.id === promotionId);
    if (!chosen) return null;
    if (chosen.type === 'PROMO_CODE' && chosen.code !== promoCode) return null;
    const amount = computeDiscount(chosen, tickets);
    if (amount === null) return null;
    return { promotionId: chosen.id, name: chosen.name, discountAmount: amount };
  }

  let bestPromo: Promotion | null = null;
  let bestDiscountAmount = 0;

  for (const promo of promotions) {
    if (promo.type === 'PROMO_CODE') {
      if (!promoCode || promo.code !== promoCode) continue;
    }

    const discountAmt = computeDiscount(promo, tickets);
    if (discountAmt === null) continue;

    if (discountAmt > bestDiscountAmount) {
      bestDiscountAmount = discountAmt;
      bestPromo = promo;
    }
  }

  if (!bestPromo || bestDiscountAmount <= 0) return null;

  return {
    promotionId: bestPromo.id,
    name: bestPromo.name,
    discountAmount: bestDiscountAmount,
  };
}
