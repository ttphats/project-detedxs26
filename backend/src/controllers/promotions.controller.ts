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
 * Ticket-class cart → tickets priced from ticket_types.
 * Seats flow still sends seatIds and is resolved from the seats table.
 */
async function resolveTickets(
  eventId: string,
  { items, seatIds }: { items?: TicketTypeItem[]; seatIds?: string[] }
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
      const qty = Math.max(0, Math.floor(Number(item.quantity) || 0));
      for (let i = 0; i < qty; i++) {
        tickets.push({
          id: `${item.ticketTypeId}_${i}`,
          price,
          ticketTypeId: item.ticketTypeId,
        });
      }
    }
    return tickets;
  }

  if (seatIds && seatIds.length > 0) {
    const placeholders = seatIds.map(() => '?').join(',');
    const seats = await query<any>(
      `SELECT id, price, ticket_type_id FROM seats WHERE id IN (${placeholders})`,
      seatIds
    );
    return seats.map((s) => ({
      id: s.id,
      price: Number(s.price),
      ticketTypeId: s.ticket_type_id || undefined,
    }));
  }

  return [];
}

export async function checkPromotions(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId, items, seatIds } = request.body as {
    eventId: string;
    items?: TicketTypeItem[];
    seatIds?: string[];
  };

  if (!eventId || (!items?.length && !seatIds?.length)) {
    throw new BadRequestError('Missing eventId or cart items');
  }

  const tickets = await resolveTickets(eventId, { items, seatIds });
  const discount = await promotionsService.calculateBestDiscount({ eventId, tickets });
  return reply.send(successResponse({ discount }));
}

/** POST /promotions/eligible — every promo this ticket-class cart can use. */
export async function listEligiblePromotions(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId, items, seatIds, promoCode } = request.body as {
    eventId: string;
    items?: TicketTypeItem[];
    seatIds?: string[];
    promoCode?: string;
  };

  if (!eventId || (!items?.length && !seatIds?.length)) {
    throw new BadRequestError('Missing eventId or cart items');
  }

  const tickets = await resolveTickets(eventId, { items, seatIds });
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
  const { eventId, items, seatIds, promoCode } = request.body as {
    eventId: string;
    items?: TicketTypeItem[];
    seatIds?: string[];
    promoCode: string;
  };

  if (!eventId || !promoCode || (!items?.length && !seatIds?.length)) {
    throw new BadRequestError('Missing required fields');
  }

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

  const tickets = await resolveTickets(eventId, { items, seatIds });
  const discount = await promotionsService.calculateBestDiscount({
    eventId,
    tickets,
    promoCode,
    promotionId: promo.id,
  });

  if (!discount) {
    throw new BadRequestError('Promo code does not apply to this ticket type');
  }

  return reply.send(successResponse({ discount }));
}
