import { FastifyRequest, FastifyReply } from 'fastify';
import * as seatLockService from '../services/seat-lock.service.js';

interface ExtendLockBody {
  eventId: string;
  seatIds: string[];
  sessionId: string;
}

/**
 * POST /api/seats/extend-lock
 * Extend seat lock duration from 10 to 15 minutes for checkout
 */
export async function extendLock(
  request: FastifyRequest<{ Body: ExtendLockBody }>,
  reply: FastifyReply
) {
  try {
    const { eventId, seatIds, sessionId } = request.body;

    if (!eventId || !seatIds?.length || !sessionId) {
      return reply.status(400).send({
        success: false,
        error: 'Missing required fields: eventId, seatIds, sessionId',
      });
    }

    const result = await seatLockService.extendSeatLock(eventId, seatIds, sessionId);

    console.log(
      `[EXTEND LOCK] Extended ${seatIds.length} seats to ${result.durationMinutes} minutes for session ${sessionId.substring(0, 15)}...`,
      {
        affectedRows: result.affectedRows,
        expiresAt: result.expiresAt,
        seatIds,
      }
    );

    return reply.send({
      success: true,
      data: {
        expiresAt: result.expiresAt,
        expiresIn: result.expiresIn,
      },
      message: `Locks extended to ${result.durationMinutes} minutes`,
    });
  } catch (error: any) {
    console.error('Extend lock error:', error);

    if (error.message.includes('not locked') || error.message.includes('another session')) {
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }

    return reply.status(500).send({
      success: false,
      error: 'Failed to extend lock',
    });
  }
}

/**
 * GET /api/debug/seat-locks
 * Debug endpoint to check seat locks
 */
export async function getDebugInfo(request: FastifyRequest, reply: FastifyReply) {
  try {
    const result = await seatLockService.getDebugInfo();

    if (!result.tableExists) {
      return reply.status(500).send({
        success: false,
        error: result.error,
        solution: 'Run POST /api/debug/seat-locks to create table',
      });
    }

    return reply.send({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Debug seat locks error:', error);
    return reply.status(500).send({
      success: false,
      error: error.message,
    });
  }
}

/**
 * POST /api/debug/seat-locks
 * Create seat_locks table if not exists
 */
export async function createTable(request: FastifyRequest, reply: FastifyReply) {
  try {
    await seatLockService.createSeatLocksTable();

    return reply.send({
      success: true,
      message: 'seat_locks table created successfully',
    });
  } catch (error: any) {
    console.error('Create seat_locks table error:', error);
    return reply.status(500).send({
      success: false,
      error: error.message,
    });
  }
}

/**
 * DELETE /api/debug/seat-locks
 * Clear expired locks
 */
export async function clearExpired(request: FastifyRequest, reply: FastifyReply) {
  try {
    const result = await seatLockService.clearExpiredLocks();

    return reply.send({
      success: true,
      message: `Deleted ${result.affectedRows} expired locks`,
      affectedRows: result.affectedRows,
    });
  } catch (error: any) {
    console.error('Delete expired locks error:', error);
    return reply.status(500).send({
      success: false,
      error: error.message,
    });
  }
}

