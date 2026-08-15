import { FastifyRequest, FastifyReply } from 'fastify';
import * as promotionsService from '../services/promotions.service.js';
import { query } from '../db/mysql.js';
import { successResponse } from '../utils/helpers.js';
import { BadRequestError } from '../utils/errors.js';

interface TicketTypeItem {
  ticketTypeId: string;
  quantity: number;
}

interface ResolvedTicket {
  id: string;
  price: number;
  ticketTypeId?: string;
}

/**
 * Builds the ticket list `calculateBestDiscount` needs from the cart:
 * ticketTypeId + quantity, priced from `ticket_types`. The venue has no
 * seat map, so a cart is only ever ticket types and quantities.
 */
async function resolveTickets(
  eventId: string,
  { items }: { items?: TicketTypeItem[] }
): Promise<ResolvedTicket[]> {
  if (items && items.length > 0) {
    const ticketTypeIds = [...new Set(items.map((i) => i.ticketTypeId))];
    const placeholders = ticketTypeIds.map(() => '?').join(',');
    const types = await query<{ id: string; price: number }>(
      `SELECT id, price FROM ticket_types WHERE event_id = ? AND id IN (${placeholders}) AND is_active = 1`,
      [eventId, ...ticketTypeIds]
    );
    const priceById = new Map(types.map((t) => [t.id, Number(t.price)]));

    const tickets: ResolvedTicket[] = [];
    for (const item of items) {
      const price = priceById.get(item.ticketTypeId);
      if (price === undefined) continue;
      for (let i = 0; i < item.quantity; i++) {
        tickets.push({ id: `${item.ticketTypeId}_${i}`, price, ticketTypeId: item.ticketTypeId });
      }
    }
    return tickets;
  }

  return [];
}

export async function checkPromotions(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId, items } = request.body as {
    eventId: string;
    items?: TicketTypeItem[];
  };

  if (!eventId || !items?.length) {
    throw new BadRequestError('Missing eventId or items');
  }

  const tickets = await resolveTickets(eventId, { items });

  const discount = await promotionsService.calculateBestDiscount({ eventId, tickets });
  return reply.send(successResponse({ discount }));
}

/**
 * POST /promotions/eligible
 * Every promotion this cart could use, so the customer can choose one
 * instead of having the biggest silently applied.
 */
export async function listEligiblePromotions(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId, items, promoCode } = request.body as {
    eventId: string;
    items?: TicketTypeItem[];
    promoCode?: string;
  };

  if (!eventId || !items?.length) {
    throw new BadRequestError('Missing eventId or items');
  }

  const tickets = await resolveTickets(eventId, { items });
  const promotions = await promotionsService.listEligiblePromotions({
    eventId,
    tickets,
    promoCode,
  });

  return reply.send(successResponse({ promotions }));
}

export async function validatePromoCode(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId, items, promoCode } = request.body as {
    eventId: string;
    items?: TicketTypeItem[];
    promoCode: string;
  };

  if (!eventId || !items?.length || !promoCode) {
    throw new BadRequestError('Missing required fields');
  }

  // Check if code exists and is active
  const promos = await query<any>(
    'SELECT * FROM promotions WHERE event_id = ? AND code = ? AND is_active = 1',
    [eventId, promoCode]
  );

  if (promos.length === 0) {
    throw new BadRequestError('Promo code does not exist or has expired');
  }

  const promo = promos[0];
  const now = new Date();

  if (now < new Date(promo.start_date) || now > new Date(promo.end_date)) {
    throw new BadRequestError('Promo code is not yet active or has expired');
  }

  if (promo.max_usage && promo.used_count >= promo.max_usage) {
    throw new BadRequestError('Promo code has reached its usage limit');
  }

  const tickets = await resolveTickets(eventId, { items });

  // calculateBestDiscount only evaluates this exact code's promotion when
  // promoCode is passed, so a non-null result is always this promotion.
  const discount = await promotionsService.calculateBestDiscount({ eventId, tickets, promoCode });

  if (!discount) {
    throw new BadRequestError('Promo code does not apply to this ticket type');
  }

  return reply.send(successResponse({ discount }));
}
