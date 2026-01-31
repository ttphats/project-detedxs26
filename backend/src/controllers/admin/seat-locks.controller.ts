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

