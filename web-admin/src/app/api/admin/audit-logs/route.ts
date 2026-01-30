import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse, UnauthorizedError, ForbiddenError } from '@/lib/utils';
import { hasPermission, PERMISSIONS, canViewAuditLogs } from '@/lib/permissions';

/**
 * GET /api/admin/audit-logs
 * 
 * View audit logs with filtering
 * - SUPER_ADMIN/ADMIN: can view all logs
 * - STAFF: can only view check-in related logs
 * - USER: can only view their own logs
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = await getAuthUser(authHeader);

    if (!user) {
      throw new UnauthorizedError();
    }

    // Check permission
    const canViewAll = hasPermission(user.roleName, PERMISSIONS.AUDIT_VIEW_ALL);
    const canViewOwn = hasPermission(user.roleName, PERMISSIONS.AUDIT_VIEW_OWN);

    if (!canViewAll && !canViewOwn) {
      throw new ForbiddenError('No permission to view audit logs');
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const userId = searchParams.get('userId');
    const userRole = searchParams.get('userRole');
    const action = searchParams.get('action');
    const entity = searchParams.get('entity');
    const entityId = searchParams.get('entityId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    // Build where clause
    const where: any = {};

    // If not admin, restrict to own logs
    if (!canViewAll) {
      where.userId = user.userId;
    } else {
      // Admin filters
      if (userId) where.userId = userId;
      if (userRole) where.userRole = userRole;
    }

    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (entityId) where.entityId = entityId;

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59.999Z');
    }

    // Search in metadata or changes
    if (search) {
      where.OR = [
        { entityId: { contains: search } },
        { metadata: { contains: search } },
        { newValue: { contains: search } },
        { oldValue: { contains: search } },
      ];
    }

    // Fetch logs with pagination
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Format response
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

    // Get summary stats
    const [actionStats, entityStats] = await Promise.all([
      prisma.auditLog.groupBy({
        by: ['action'],
        _count: { action: true },
        where: canViewAll ? {} : { userId: user.userId },
      }),
      prisma.auditLog.groupBy({
        by: ['entity'],
        _count: { entity: true },
        where: canViewAll ? {} : { userId: user.userId },
      }),
    ]);

    return NextResponse.json(
      successResponse({
        logs: formattedLogs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats: {
          byAction: actionStats.map(s => ({ action: s.action, count: s._count.action })),
          byEntity: entityStats.map(s => ({ entity: s.entity, count: s._count.entity })),
        },
      })
    );
  } catch (error: any) {
    console.error('Get audit logs error:', error);

    if (error instanceof UnauthorizedError) {
      return NextResponse.json(errorResponse(error.message), { status: 401 });
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json(errorResponse(error.message), { status: 403 });
    }

    return NextResponse.json(errorResponse('Failed to fetch audit logs'), { status: 500 });
  }
}

