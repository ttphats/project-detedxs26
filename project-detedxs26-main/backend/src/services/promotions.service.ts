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
  /**
   * When set, only this promotion is considered. Used when the customer has
   * explicitly picked one from the eligible list rather than letting the
   * system apply whichever is worth most.
   */
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
  /** True for the promotion that saves the customer the most. */
  isBest: boolean;
}

/**
 * Every active, in-date promotion for an event that still has usage left.
 */
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
 * How much a single promotion is worth for this cart, or null when the cart
 * doesn't qualify for it. Kept in one place so the "what can I use?" list and
 * the "apply it" path can never disagree about eligibility or amount.
 */
function computeDiscount(promo: Promotion, tickets: TicketItem[]): number | null {
  // Narrow to the tickets this promotion actually covers FIRST. Every rule
  // below is about those tickets, not the cart as a whole: a "2-4 VIP" combo
  // is satisfied by 3 VIP whether or not the customer also bought Standard.
  // Checking min/max against the full cart made any mixed cart fall out of
  // range and silently disqualified every combo at once.
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

  // Combo restrictions, measured against the covered tickets
  if (promo.type === 'COMBO') {
    const count = applicableTickets.length;
    if (promo.min_tickets && count < promo.min_tickets) return null;
    if (promo.max_tickets && count > promo.max_tickets) return null;
  }

  const applicableAmount = applicableTickets.reduce((sum, t) => sum + Number(t.price), 0);

  let discountAmt = 0;
  if (promo.discount_type === 'PERCENTAGE') {
    discountAmt = (applicableAmount * Number(promo.discount_value)) / 100;
  } else if (promo.discount_type === 'FIXED_AMOUNT') {
    discountAmt = Number(promo.discount_value);
    // Never discount more than the tickets it covers are worth. For an
    // unrestricted promotion this is the whole cart, so nothing changes there.
    if (discountAmt > applicableAmount) discountAmt = applicableAmount;
  }

  if (discountAmt <= 0) return null;
  return Math.round(discountAmt);
}

/**
 * Which promotions a cart could use, so the customer can pick rather than
 * having the largest one silently forced on them.
 *
 * Auto promotions (COMBO / EARLY_BIRD) always qualify on cart contents alone.
 * A PROMO_CODE promotion only joins the list once its code has been entered —
 * otherwise typing a code would be pointless.
 */
export async function listEligiblePromotions(
  input: CalculateDiscountInput
): Promise<EligiblePromotion[]> {
  const { eventId, tickets, promoCode } = input;
  if (!tickets || tickets.length === 0) return [];

  const live = await getLivePromotions(eventId);

  const candidates = live.filter((p) =>
    p.type === 'PROMO_CODE'
      ? Boolean(promoCode) && p.code === promoCode
      : true
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
 * The discount to actually apply.
 *
 * - `promotionId` given → that exact promotion (the customer chose it), still
 *   re-validated server-side so a stale or tampered id can't grant a discount
 *   the cart no longer qualifies for.
 * - `promoCode` given → only that code's promotion.
 * - neither → the best available auto promotion.
 */
export async function calculateBestDiscount(
  input: CalculateDiscountInput
): Promise<DiscountResult | null> {
  const { eventId, tickets, promoCode, promotionId } = input;
  if (!tickets || tickets.length === 0) return null;

  const live = await getLivePromotions(eventId);

  if (promotionId) {
    const chosen = live.find((p) => p.id === promotionId);
    if (!chosen) return null;
    // A code-based promotion still requires its code to have been supplied.
    if (chosen.type === 'PROMO_CODE' && chosen.code !== promoCode) return null;
    const amount = computeDiscount(chosen, tickets);
    if (amount === null) return null;
    return { promotionId: chosen.id, name: chosen.name, discountAmount: amount };
  }

  const candidates = promoCode
    ? live.filter((p) => p.type === 'PROMO_CODE' && p.code === promoCode)
    : live.filter((p) => p.type !== 'PROMO_CODE');

  let best: DiscountResult | null = null;
  for (const promo of candidates) {
    const amount = computeDiscount(promo, tickets);
    if (amount === null) continue;
    if (!best || amount > best.discountAmount) {
      best = { promotionId: promo.id, name: promo.name, discountAmount: amount };
    }
  }

  return best;
}
