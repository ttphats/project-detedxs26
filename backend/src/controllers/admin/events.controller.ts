import { FastifyRequest, FastifyReply } from 'fastify';
import * as eventsService from '../../services/admin/events.service.js';
import { UnauthorizedError, ForbiddenError, NotFoundError, BadRequestError } from '../../utils/errors.js';
import { requireAdmin } from '../../utils/auth.js';

/**
 * GET /api/admin/events
 */
export async function list(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const { status } = request.query as { status?: string };
  const events = await eventsService.listEvents(status);

  return reply.send({ success: true, data: events });
}

/**
 * GET /api/admin/events/:id
 */
export async function getById(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const { id } = request.params as { id: string };
  const event = await eventsService.getEventById(id);

  if (!event) throw new NotFoundError('Event not found');

  return reply.send({ success: true, data: event });
}

/**
 * POST /api/admin/events
 */
export async function create(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const body = request.body as eventsService.CreateEventInput;

  if (!body.name || !body.venue || !body.event_date) {
    throw new BadRequestError('Name, venue, and event date are required');
  }

  const event = await eventsService.createEvent(body);

  return reply.status(201).send({
    success: true,
    data: event,
    message: 'Event created successfully',
  });
}

/**
 * PUT /api/admin/events/:id
 */
export async function update(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const { id } = request.params as { id: string };
  const body = request.body as eventsService.UpdateEventInput;

  const existing = await eventsService.getEventById(id);
  if (!existing) throw new NotFoundError('Event not found');

  const event = await eventsService.updateEvent(id, body);

  return reply.send({
    success: true,
    data: event,
    message: 'Event updated successfully',
  });
}

/**
 * DELETE /api/admin/events/:id
 */
export async function remove(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const { id } = request.params as { id: string };

  const existing = await eventsService.getEventById(id);
  if (!existing) throw new NotFoundError('Event not found');

  try {
    await eventsService.deleteEvent(id);
    return reply.send({ success: true, message: 'Event deleted successfully' });
  } catch (error: any) {
    throw new BadRequestError(error.message);
  }
}

