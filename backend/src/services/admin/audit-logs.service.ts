import { prisma } from '../../db/prisma.js';
import { JWTPayload } from '../../types/index.js';

export interface ListAuditLogsInput {
  page?: number;
  limit?: number;
  userId?: string;
  userRole?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

/**
 * Check if user can view all audit logs
 */
export function canViewAllLogs(roleName: string): boolean {
  return ['SUPER_ADMIN', 'ADMIN'].includes(roleName);
}

/**
 * List audit logs with filters
 */
export async function listAuditLogs(
  input: ListAuditLogsInput,
  user: JWTPayload
) {
  const page = input.page || 1;
  const limit = input.limit || 50;
  const skip = (page - 1) * limit;

  const canViewAll = canViewAllLogs(user.roleName);
  const where: any = {};

  // If not admin, restrict to own logs
  if (!canViewAll) {
    where.userId = user.userId;
  } else {
    if (input.userId) where.userId = input.userId;
    if (input.userRole) where.userRole = input.userRole;
  }

  if (input.action) where.action = input.action;
  if (input.entity) where.entity = input.entity;
  if (input.entityId) where.entityId = input.entityId;

  // Date range filter
  if (input.startDate || input.endDate) {
    where.createdAt = {};
    if (input.startDate) where.createdAt.gte = new Date(input.startDate);
    if (input.endDate) where.createdAt.lte = new Date(input.endDate + 'T23:59:59.999Z');
  }

  // Search
  if (input.search) {
    where.OR = [
      { entityId: { contains: input.search } },
      { metadata: { contains: input.search } },
      { newValue: { contains: input.search } },
      { oldValue: { contains: input.search } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, fullName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Format logs
  const formattedLogs = logs.map((log) => ({
    id: log.id,
    userId: log.userId,
    userRole: log.userRole,
    userName: log.user?.fullName || 'System',
    userEmail: log.user?.email || null,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
    newValue: log.newValue ? JSON.parse(log.newValue) : null,
    changes: log.changes ? JSON.parse(log.changes) : null,
    metadata: log.metadata ? JSON.parse(log.metadata) : null,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt,
  }));

  // Get stats
  const statsWhere = canViewAll ? {} : { userId: user.userId };
  const [actionStats, entityStats] = await Promise.all([
    prisma.auditLog.groupBy({
      by: ['action'],
      _count: { action: true },
      where: statsWhere,
    }),
    prisma.auditLog.groupBy({
      by: ['entity'],
      _count: { entity: true },
      where: statsWhere,
    }),
  ]);

  return {
    logs: formattedLogs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    stats: {
      byAction: actionStats.map((s) => ({ action: s.action, count: s._count.action })),
      byEntity: entityStats.map((s) => ({ entity: s.entity, count: s._count.entity })),
    },
  };
}

