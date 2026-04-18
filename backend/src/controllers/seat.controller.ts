import { FastifyRequest, FastifyReply } from 'fastify';
import * as seatService from '../services/seat.service.js';
import { successResponse } from '../utils/helpers.js';
import { BadRequestError } from '../utils/errors.js';

const LOCK_DURATION_MINUTES = 10;

// GET /seats/lock
export async function getSessionLocks(
  request: FastifyRequest<{ Querystring: { sessionId: string; eventId: string } }>,
  reply: FastifyReply
) {
  const { sessionId, eventId } = request.query;

  if (!sessionId || !eventId) {
    throw new BadRequestError('Missing required params: sessionId, eventId');
  }

  const locks = await seatService.getSessionLocks(sessionId, eventId);

  return reply.send(
    successResponse({
      locks,
      expiresAt: locks.length > 0 ? locks[0].expiresAt : null,
    })
  );
}

// POST /seats/lock
export async function lockSeats(
  request: FastifyRequest<{
    Body: { eventId: string; seatIds: string[]; sessionId: string; ticketTypeId?: string };
  }>,
  reply: FastifyReply
) {
  const { eventId, seatIds, sessionId, ticketTypeId } = request.body;

  if (!eventId || !seatIds?.length || !sessionId) {
    throw new BadRequestError('Missing required fields: eventId, seatIds, sessionId');
  }

  const result = await seatService.lockSeats({ eventId, seatIds, sessionId, ticketTypeId });

  return reply.send(
    successResponse(
      {
        lockedSeats: result.lockedSeats,
        expiresAt: result.expiresAt.toISOString(),
        expiresIn: LOCK_DURATION_MINUTES * 60,
      },
      `Seats locked for ${LOCK_DURATION_MINUTES} minutes`
    )
  );
}

// DELETE /seats/lock
export async function unlockSeats(
  request: FastifyRequest<{
    Body: { seatIds: string[]; sessionId: string; eventId?: string };
  }>,
  reply: FastifyReply
) {
  const { seatIds, sessionId } = request.body;

  if (!seatIds?.length || !sessionId) {
    throw new BadRequestError('Missing required fields: seatIds, sessionId');
  }

  await seatService.unlockSeats(seatIds, sessionId);

  return reply.send(successResponse(null, 'Seats unlocked successfully'));
}

// GET /events/:eventId/seats
export async function getEventSeats(
  request: FastifyRequest<{ Params: { eventId: string }; Querystring: { sessionId?: string } }>,
  reply: FastifyReply
) {
  const { eventId } = request.params;
  const { sessionId } = request.query;

  const seats = await seatService.getEventSeats(eventId, sessionId);

  return reply.send(successResponse(seats));
}

// GET /events/:eventId/seats/stream - SSE for real-time seat updates
export async function seatsStream(
  request: FastifyRequest<{ Params: { eventId: string }; Querystring: { sessionId?: string } }>,
  reply: FastifyReply
) {
  const { eventId } = request.params;
  const { sessionId } = request.query;

  // Set SSE headers
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send initial seats data
  const seats = await seatService.getEventSeats(eventId, sessionId);
  reply.raw.write(`data: ${JSON.stringify({ type: 'init', seats })}\n\n`);

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    reply.raw.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
  }, 30000);

  // Poll for seat changes every 3 seconds
  const pollInterval = setInterval(async () => {
    try {
      const updatedSeats = await seatService.getEventSeats(eventId, sessionId);
      reply.raw.write(`data: ${JSON.stringify({ type: 'update', seats: updatedSeats })}\n\n`);
    } catch (error) {
      console.error('SSE polling error:', error);
    }
  }, 3000);

  // Clean up on close
  request.raw.on('close', () => {
    clearInterval(heartbeat);
    clearInterval(pollInterval);
  });
}
