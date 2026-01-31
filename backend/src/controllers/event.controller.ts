import { FastifyRequest, FastifyReply } from 'fastify';
import * as eventService from '../services/event.service.js';
import { successResponse } from '../utils/helpers.js';

// GET /events
export async function getEvents(
  request: FastifyRequest<{ Querystring: { status?: string; featured?: string } }>,
  reply: FastifyReply
) {
  const { status, featured } = request.query;

  const result = await eventService.getPublishedEvents(
    status || 'PUBLISHED',
    featured === 'true'
  );

  return reply.send(successResponse(result));
}

// GET /events/:eventId
export async function getEventById(
  request: FastifyRequest<{ Params: { eventId: string } }>,
  reply: FastifyReply
) {
  const { eventId } = request.params;

  const event = await eventService.getEventById(eventId);

  return reply.send(successResponse(event));
}

// GET /events/slug/:slug
export async function getEventBySlug(
  request: FastifyRequest<{ Params: { slug: string } }>,
  reply: FastifyReply
) {
  const { slug } = request.params;

  const event = await eventService.getEventBySlug(slug);

  return reply.send(successResponse(event));
}

