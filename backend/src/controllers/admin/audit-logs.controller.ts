import { FastifyRequest, FastifyReply } from 'fastify';
import * as auditLogsService from '../../services/admin/audit-logs.service.js';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors.js';

/**
 * GET /api/admin/audit-logs
 */
export async function list(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();

  // Check if user has permission to view logs
  const canViewAll = auditLogsService.canViewAllLogs(user.roleName);
  const canViewOwn = ['USER', 'STAFF'].includes(user.roleName);

  if (!canViewAll && !canViewOwn) {
    throw new ForbiddenError('No permission to view audit logs');
  }

  const query = request.query as auditLogsService.ListAuditLogsInput;
  const result = await auditLogsService.listAuditLogs(query, user);

  return reply.send({ success: true, data: result });
}

