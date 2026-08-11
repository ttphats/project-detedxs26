import { FastifyRequest, FastifyReply } from 'fastify';
import * as promotionsService from '../services/promotions.service.js';
import { query } from '../db/mysql.js';
import { successResponse } from '../utils/helpers.js';
import { BadRequestError } from '../utils/errors.js';

export async function checkPromotions(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId, seatIds } = request.body as { eventId: string; seatIds: string[] };
  
  if (!eventId || !seatIds || seatIds.length === 0) {
    throw new BadRequestError('Missing eventId or seatIds');
  }

  const placeholders = seatIds.map(() => '?').join(',');
  const seats = await query<any>(`SELECT id, price, ticket_type_id FROM seats WHERE id IN (${placeholders})`, seatIds);
  
  const tickets = seats.map(s => ({
    id: s.id,
    price: Number(s.price),
    ticketTypeId: s.ticket_type_id || undefined
  }));

  const discount = await promotionsService.calculateBestDiscount({ eventId, tickets });
  return reply.send(successResponse({ discount }));
}

export async function validatePromoCode(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId, seatIds, promoCode } = request.body as { eventId: string; seatIds: string[]; promoCode: string };
  
  if (!eventId || !seatIds || seatIds.length === 0 || !promoCode) {
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

  const placeholders = seatIds.map(() => '?').join(',');
  const seats = await query<any>(`SELECT id, price, ticket_type_id FROM seats WHERE id IN (${placeholders})`, seatIds);
  
  const tickets = seats.map(s => ({
    id: s.id,
    price: Number(s.price),
    ticketTypeId: s.ticket_type_id || undefined
  }));

  const discount = await promotionsService.calculateBestDiscount({ eventId, tickets, promoCode });
  
  if (!discount || discount.promotionId !== promo.id) {
    // If it returns a different promotion, it means the promo code was less optimal than an auto promo!
    // Or if it returns null, the promo code requirements weren't met (e.g. ticket types)
    if (!discount) {
       throw new BadRequestError('Promo code does not apply to this ticket type');
    }
  }

  return reply.send(successResponse({ discount }));
}
