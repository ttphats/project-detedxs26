import { FastifyRequest, FastifyReply } from 'fastify';
import * as seatLocksService from '../../services/admin/seat-locks.service.js';
import { requireAdmin } from '../../utils/auth.js';

/**
 * GET /api/admin/seat-locks
 * Get all active seat locks (for admin management)
 */
export async function list(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAdmin(request.user!);
    const { eventId } = request.query as { eventId?: string };

    const data = await seatLocksService.listSeatLocks(eventId);

    return reply.send({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Get seat locks error:', error);
    return reply.status(500).send({
      success: false,
      error: 'Failed to get seat locks',
    });
  }
}

/**
 * DELETE /api/admin/seat-locks/:id
 * Remove a specific seat lock
 */
export async function remove(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAdmin(request.user!);
    const { id } = request.params as { id: string };

    if (!id) {
      return reply.status(400).send({
        success: false,
        error: 'Lock ID is required',
      });
    }

    await seatLocksService.deleteSeatLock(id);

    return reply.send({
      success: true,
      message: 'Seat lock removed successfully',
    });
  } catch (error: any) {
    console.error('Remove seat lock error:', error);
    return reply.status(500).send({
      success: false,
      error: error.message || 'Failed to remove seat lock',
    });
  }
}

/**
 * POST /api/admin/seat-locks/clear-all
 * Clear all seat locks for an event
 */
export async function clearAll(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAdmin(request.user!);
    const body = (request.body || {}) as { eventId?: string };
    const eventId = body.eventId;

    const result = await seatLocksService.clearAllLocks(eventId);

    return reply.send({
      success: true,
      data: { count: result.count },
      message: `Cleared ${result.count} seat locks`,
    });
  } catch (error: any) {
    console.error('Clear all locks error:', error);
    return reply.status(500).send({
      success: false,
      error: error.message || 'Failed to clear seat locks',
    });
  }
}

