import { query, queryOne } from '../db/mysql.js';
import { BadRequestError } from '../utils/errors.js';
import { Promotion } from './admin/promotions.service.js';

interface TicketItem {
  id: string; // seatId
  price: number;
  ticketTypeId?: string;
}

interface CalculateDiscountInput {
  eventId: string;
  tickets: TicketItem[];
  promoCode?: string;
}

interface DiscountResult {
  promotionId: string;
  name: string;
  discountAmount: number;
}

export async function calculateBestDiscount(input: CalculateDiscountInput): Promise<DiscountResult | null> {
  const { eventId, tickets, promoCode } = input;
  
  if (!tickets || tickets.length === 0) return null;
  const totalAmount = tickets.reduce((sum, t) => sum + Number(t.price), 0);
  const ticketCount = tickets.length;
  
  const now = new Date();

  // Find all active promotions for this event
  const promotions = await query<Promotion>(
    `SELECT * FROM promotions 
     WHERE event_id = ? 
     AND is_active = 1 
     AND start_date <= ? 
     AND end_date >= ?
     AND (max_usage IS NULL OR used_count < max_usage)`,
    [eventId, now, now]
  );

  let bestPromo: Promotion | null = null;
  let bestDiscountAmount = 0;

  for (const promo of promotions) {
    // 1. Check Promo Code Match
    if (promo.type === 'PROMO_CODE') {
      if (!promoCode || promo.code !== promoCode) continue;
    } else {
      // If user provided a promo code, they are specifically asking for that.
      // But we still evaluate auto-promos and pick the highest overall.
    }

    // 2. Check Ticket Type Restrictions first
    let applicableTickets = tickets;
    if (promo.ticket_type_ids) {
      try {
        const allowedTypes: string[] = JSON.parse(promo.ticket_type_ids);
        if (allowedTypes.length > 0) {
          applicableTickets = tickets.filter(t => t.ticketTypeId && allowedTypes.includes(t.ticketTypeId));
          if (applicableTickets.length === 0) continue; // no applicable tickets
        }
      } catch (e) {
        console.error('Failed to parse ticket_type_ids', promo.ticket_type_ids);
      }
    }

    // 3. Check Combo Restrictions against applicableTickets and calculate multiplier
    let multiplier = 1;
    if (promo.type === 'COMBO') {
      const minT = promo.min_tickets || 1;
      if (applicableTickets.length < minT) continue;
      if (promo.max_tickets && applicableTickets.length > promo.max_tickets) continue;
      
      multiplier = Math.floor(applicableTickets.length / minT);
      if (multiplier === 0) continue;
    }

    // Calculate discount amount based on applicable tickets
    const applicableAmount = applicableTickets.reduce((sum, t) => sum + Number(t.price), 0);
    
    let discountAmt = 0;
    if (promo.discount_type === 'PERCENTAGE') {
      if (promo.type === 'COMBO' && promo.min_tickets && promo.min_tickets > 0) {
        // Sort tickets descending by price so we discount the most expensive ones first
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
    
    // Ensure we don't discount more than the order total
    if (discountAmt > totalAmount) discountAmt = totalAmount;

    if (discountAmt > bestDiscountAmount) {
      bestDiscountAmount = discountAmt;
      bestPromo = promo;
    }
  }

  // If user provided a code and it didn't win (or was invalid), we might want to tell them.
  // But for simple checking, just returning best discount is fine.
  if (promoCode) {
    const specificPromo = promotions.find(p => p.code === promoCode);
    if (!specificPromo) {
      // If code was provided but invalid/expired, throw error so UI can show it
      // ONLY throw if we are in validate-code flow. 
      // We will handle this in controller.
    }
  }

  if (!bestPromo || bestDiscountAmount <= 0) return null;

  return {
    promotionId: bestPromo.id,
    name: bestPromo.name,
    discountAmount: Math.round(bestDiscountAmount)
  };
}
