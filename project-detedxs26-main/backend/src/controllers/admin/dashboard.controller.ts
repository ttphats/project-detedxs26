import { FastifyRequest, FastifyReply } from 'fastify';
import * as dashboardService from '../../services/admin/dashboard.service.js';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors.js';
import { requireAdmin } from '../../utils/auth.js';

/**
 * GET /api/admin/dashboard/stats
 */
export async function getStats(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();

  try {
    requireAdmin(user);
  } catch {
    throw new ForbiddenError();
  }

  const stats = await dashboardService.getDashboardStats();

  return reply.send({
    success: true,
    data: stats,
  });
}

