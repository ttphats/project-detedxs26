import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser, hashPassword } from '@/lib/auth';
import { successResponse, errorResponse, UnauthorizedError, ForbiddenError, NotFoundError } from '@/lib/utils';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { createAuditLog, getRequestInfo } from '@/lib/audit-logger';

/**
 * GET /api/admin/users/:id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const user = await getAuthUser(authHeader);

    if (!user) throw new UnauthorizedError();
    if (!hasPermission(user.roleName, PERMISSIONS.USER_VIEW)) {
      throw new ForbiddenError('No permission to view users');
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });

    if (!targetUser) throw new NotFoundError('User not found');

    return NextResponse.json(successResponse({
      id: targetUser.id,
      email: targetUser.email,
      fullName: targetUser.fullName,
      phoneNumber: targetUser.phoneNumber,
      roleId: targetUser.roleId,
      roleName: targetUser.role.name,
      isActive: targetUser.isActive,
      lastLoginAt: targetUser.lastLoginAt,
      createdAt: targetUser.createdAt,
    }));
  } catch (error: any) {
    if (error instanceof UnauthorizedError) return NextResponse.json(errorResponse(error.message), { status: 401 });
    if (error instanceof ForbiddenError) return NextResponse.json(errorResponse(error.message), { status: 403 });
    if (error instanceof NotFoundError) return NextResponse.json(errorResponse(error.message), { status: 404 });
    return NextResponse.json(errorResponse('Failed to fetch user'), { status: 500 });
  }
}

const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  phoneNumber: z.string().optional().nullable(),
  roleId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

/**
 * PUT /api/admin/users/:id
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const user = await getAuthUser(authHeader);

    if (!user) throw new UnauthorizedError();
    if (!hasPermission(user.roleName, PERMISSIONS.USER_UPDATE)) {
      throw new ForbiddenError('No permission to update users');
    }

    const body = await request.json();
    const input = updateUserSchema.parse(body);

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });

    if (!targetUser) throw new NotFoundError('User not found');

    // Check role change permission
    if (input.roleId && input.roleId !== targetUser.roleId) {
      if (!hasPermission(user.roleName, PERMISSIONS.USER_MANAGE_ROLES)) {
        throw new ForbiddenError('No permission to change user roles');
      }
      const newRole = await prisma.role.findUnique({ where: { id: input.roleId } });
      if (!newRole) throw new ForbiddenError('Invalid role');
      
      // Only SUPER_ADMIN can assign SUPER_ADMIN/ADMIN roles
      if (['SUPER_ADMIN', 'ADMIN'].includes(newRole.name) && user.roleName !== 'SUPER_ADMIN') {
        throw new ForbiddenError('Only SUPER_ADMIN can assign admin roles');
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (input.fullName) updateData.fullName = input.fullName;
    if (input.phoneNumber !== undefined) updateData.phoneNumber = input.phoneNumber;
    if (input.roleId) updateData.roleId = input.roleId;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.password) updateData.passwordHash = await hashPassword(input.password);

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { role: true },
    });

    // Audit log
    const reqInfo = getRequestInfo(request);
    await createAuditLog({
      user,
      action: 'UPDATE',
      entity: 'USER',
      entityId: id,
      oldValue: { fullName: targetUser.fullName, role: targetUser.role.name, isActive: targetUser.isActive },
      newValue: { fullName: updatedUser.fullName, role: updatedUser.role.name, isActive: updatedUser.isActive },
      ...reqInfo,
    });

    return NextResponse.json(successResponse({ id: updatedUser.id }, 'User updated successfully'));
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json(errorResponse(error.errors[0].message), { status: 400 });
    if (error instanceof UnauthorizedError) return NextResponse.json(errorResponse(error.message), { status: 401 });
    if (error instanceof ForbiddenError) return NextResponse.json(errorResponse(error.message), { status: 403 });
    if (error instanceof NotFoundError) return NextResponse.json(errorResponse(error.message), { status: 404 });
    return NextResponse.json(errorResponse('Failed to update user'), { status: 500 });
  }
}

/**
 * DELETE /api/admin/users/:id
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const user = await getAuthUser(authHeader);

    if (!user) throw new UnauthorizedError();
    if (!hasPermission(user.roleName, PERMISSIONS.USER_DELETE)) {
      throw new ForbiddenError('No permission to delete users');
    }

    // Cannot delete yourself
    if (id === user.userId) {
      throw new ForbiddenError('Cannot delete your own account');
    }

    const targetUser = await prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!targetUser) throw new NotFoundError('User not found');

    // Only SUPER_ADMIN can delete ADMIN users
    if (['SUPER_ADMIN', 'ADMIN'].includes(targetUser.role.name) && user.roleName !== 'SUPER_ADMIN') {
      throw new ForbiddenError('Only SUPER_ADMIN can delete admin users');
    }

    await prisma.user.delete({ where: { id } });

    // Audit log
    const reqInfo = getRequestInfo(request);
    await createAuditLog({
      user,
      action: 'DELETE',
      entity: 'USER',
      entityId: id,
      oldValue: { email: targetUser.email, fullName: targetUser.fullName, role: targetUser.role.name },
      ...reqInfo,
    });

    return NextResponse.json(successResponse(null, 'User deleted successfully'));
  } catch (error: any) {
    if (error instanceof UnauthorizedError) return NextResponse.json(errorResponse(error.message), { status: 401 });
    if (error instanceof ForbiddenError) return NextResponse.json(errorResponse(error.message), { status: 403 });
    if (error instanceof NotFoundError) return NextResponse.json(errorResponse(error.message), { status: 404 });
    return NextResponse.json(errorResponse('Failed to delete user'), { status: 500 });
  }
}

