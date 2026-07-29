import { FastifyRequest, FastifyReply } from 'fastify';
import * as eventService from '../services/event.service.js';
import { successResponse } from '../utils/helpers.js';

// Graceful DB-failure helper: when MySQL/Prisma is unreachable, return an
// empty/null payload (status 200) instead of throwing a 500. This lets the
// frontend keep rendering with fallbacks while the DB recovers.
function dbFail(reply: FastifyReply, label: string, fallback: unknown) {
  return (err: unknown) => {
    console.error(`[EVENTS] ${label} failed (DB unreachable?):`, err);
    return reply.send(successResponse(fallback));
  };
}

// GET /events
export async function getEvents(
  request: FastifyRequest<{ Querystring: { status?: string; featured?: string } }>,
  reply: FastifyReply
) {
  const { status, featured } = request.query;

  try {
    const result = await eventService.getPublishedEvents(
      status || 'PUBLISHED',
      featured === 'true'
    );

    return reply.send(successResponse(result));
  } catch (err) {
    return dbFail(reply, 'getEvents', featured === 'true' ? null : [])(err);
  }
}

// GET /events/:eventId
export async function getEventById(
  request: FastifyRequest<{ Params: { eventId: string }; Querystring: { sessionId?: string } }>,
  reply: FastifyReply
) {
  const { eventId } = request.params;
  const { sessionId } = request.query;

  try {
    const event = await eventService.getEventById(eventId, sessionId);
    return reply.send(successResponse(event));
  } catch (err) {
    return dbFail(reply, `getEventById(${eventId})`, null)(err);
  }
}

// GET /events/slug/:slug
export async function getEventBySlug(
  request: FastifyRequest<{ Params: { slug: string } }>,
  reply: FastifyReply
) {
  const { slug } = request.params;

  try {
    const event = await eventService.getEventBySlug(slug);
    return reply.send(successResponse(event));
  } catch (err) {
    return dbFail(reply, `getEventBySlug(${slug})`, null)(err);
  }
}

// GET /events/:eventId/speakers
export async function getEventSpeakers(
  request: FastifyRequest<{ Params: { eventId: string } }>,
  reply: FastifyReply
) {
  const { eventId } = request.params;

  try {
    const speakers = await eventService.getEventSpeakers(eventId);
    return reply.send(successResponse(speakers));
  } catch (err) {
    return dbFail(reply, `getEventSpeakers(${eventId})`, [])(err);
  }
}

// GET /events/:eventId/timeline
export async function getEventTimeline(
  request: FastifyRequest<{ Params: { eventId: string } }>,
  reply: FastifyReply
) {
  const { eventId } = request.params;

  try {
    const timeline = await eventService.getEventTimeline(eventId);
    return reply.send(successResponse(timeline));
  } catch (err) {
    return dbFail(reply, `getEventTimeline(${eventId})`, [])(err);
  }
}

// GET /events/:eventId/ticket-availability
// Returns available seat counts per ticket type for the ticket-class booking flow
export async function getTicketAvailability(
  request: FastifyRequest<{ Params: { eventId: string } }>,
  reply: FastifyReply
) {
  const { eventId } = request.params;

  try {
    const availability = await eventService.getTicketAvailability(eventId);
    return reply.send(successResponse(availability));
  } catch (err) {
    return dbFail(reply, `getTicketAvailability(${eventId})`, [])(err);
  }
}

