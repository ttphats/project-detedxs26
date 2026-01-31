import { FastifyRequest, FastifyReply } from 'fastify';
import * as seatsService from '../../services/admin/seats.service.js';
import { UnauthorizedError, ForbiddenError, NotFoundError, BadRequestError } from '../../utils/errors.js';
import { requireAdmin } from '../../utils/auth.js';

/**
 * GET /api/admin/seats
 */
export async function list(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const query = request.query as seatsService.ListSeatsInput;
  const result = await seatsService.listSeats(query);

  return reply.send({ success: true, data: result });
}

/**
 * GET /api/admin/seats/:id
 */
export async function getById(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const { id } = request.params as { id: string };
  const seat = await seatsService.getSeatById(id);

  if (!seat) throw new NotFoundError('Seat not found');

  return reply.send({ success: true, data: seat });
}

/**
 * POST /api/admin/seats
 */
export async function create(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const { event_id, seats } = request.body as {
    event_id: string;
    seats: seatsService.CreateSeatInput[];
  };

  if (!event_id) throw new BadRequestError('Event ID is required');
  if (!seats || !Array.isArray(seats) || seats.length === 0) {
    throw new BadRequestError('Seats array is required');
  }

  const created = await seatsService.createSeats(event_id, seats);

  return reply.status(201).send({
    success: true,
    message: `Created ${created.length} seats`,
  });
}

/**
 * PUT /api/admin/seats/:id
 */
export async function update(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const { id } = request.params as { id: string };
  const body = request.body as seatsService.UpdateSeatInput;

  const existing = await seatsService.getSeatById(id);
  if (!existing) throw new NotFoundError('Seat not found');

  const seat = await seatsService.updateSeat(id, body);

  return reply.send({
    success: true,
    data: seat,
    message: 'Seat updated successfully',
  });
}

/**
 * PUT /api/admin/seats (bulk update)
 */
export async function bulkUpdate(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const { seatIds, status, price } = request.body as {
    seatIds: string[];
    status?: string;
    price?: number;
  };

  if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
    throw new BadRequestError('Seat IDs are required');
  }

  const result = await seatsService.bulkUpdateSeats(seatIds, { status, price });

  return reply.send({
    success: true,
    message: `Updated ${result.updated} seats`,
  });
}

/**
 * DELETE /api/admin/seats
 */
export async function remove(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const { seatIds } = request.body as { seatIds: string[] };

  if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
    throw new BadRequestError('Seat IDs are required');
  }

  try {
    const result = await seatsService.deleteSeats(seatIds);
    return reply.send({
      success: true,
      message: `Deleted ${result.deleted} seats`,
    });
  } catch (error: any) {
    throw new BadRequestError(error.message);
  }
}

