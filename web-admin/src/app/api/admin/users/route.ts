import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser, hashPassword } from '@/lib/auth';
import { successResponse, errorResponse, UnauthorizedError, ForbiddenError, ConflictError } from '@/lib/utils';
import { hasPermission, PERMISSIONS, requireMinRole } from '@/lib/permissions';
import { createAuditLog, getRequestInfo } from '@/lib/audit-logger';

/**
 * GET /api/admin/users
 * List all users with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = await getAuthUser(authHeader);

    if (!user) {
      throw new UnauthorizedError();
    }

    // Only ADMIN and SUPER_ADMIN can view users
    if (!hasPermission(user.roleName, PERMISSIONS.USER_VIEW)) {
      throw new ForbiddenError('No permission to view users');
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || '';
    const roleId = searchParams.get('roleId');
    const isActive = searchParams.get('isActive');

    // Build where clause
    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { fullName: { contains: search } },
        { phoneNumber: { contains: search } },
      ];
    }
    if (roleId) where.roleId = roleId;
    if (isActive !== null && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const [users, total, roles] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          role: { select: { id: true, name: true, description: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
      prisma.role.findMany({ orderBy: { name: 'asc' } }),
    ]);

    const formattedUsers = users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      fullName: u.fullName,
      phoneNumber: u.phoneNumber,
      roleId: u.roleId,
      roleName: u.role.name,
      roleDescription: u.role.description,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    }));

    return NextResponse.json(
      successResponse({
        users: formattedUsers,
        roles,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      })
    );
  } catch (error: any) {
    console.error('Get users error:', error);
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(errorResponse(error.message), { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(errorResponse(error.message), { status: 403 });
    }
    return NextResponse.json(errorResponse('Failed to fetch users'), { status: 500 });
  }
}

const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email').optional().nullable(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name required'),
  phoneNumber: z.string().optional(),
  roleId: z.string().uuid('Invalid role ID'),
  isActive: z.boolean().optional().default(true),
});

/**
 * POST /api/admin/users
 * Create a new user (Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = await getAuthUser(authHeader);

    if (!user) {
      throw new UnauthorizedError();
    }

    // Only ADMIN and SUPER_ADMIN can create users
    if (!hasPermission(user.roleName, PERMISSIONS.USER_CREATE)) {
      throw new ForbiddenError('No permission to create users');
    }

    const body = await request.json();
    const input = createUserSchema.parse(body);

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({ where: { username: input.username } });
    if (existingUsername) {
      throw new ConflictError('Username already exists');
    }

    // Check if email already exists (if provided)
    if (input.email) {
      const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
      if (existingEmail) {
        throw new ConflictError('Email already registered');
      }
    }

    // Check role exists and permission to assign
    const targetRole = await prisma.role.findUnique({ where: { id: input.roleId } });
    if (!targetRole) {
      throw new ForbiddenError('Invalid role');
    }

    // Only SUPER_ADMIN can create SUPER_ADMIN or ADMIN users
    if (['SUPER_ADMIN', 'ADMIN'].includes(targetRole.name) && user.roleName !== 'SUPER_ADMIN') {
      throw new ForbiddenError('Only SUPER_ADMIN can assign admin roles');
    }

    const passwordHash = await hashPassword(input.password);

    const newUser = await prisma.user.create({
      data: {
        username: input.username,
        email: input.email || null,
        passwordHash,
        fullName: input.fullName,
        phoneNumber: input.phoneNumber,
        roleId: input.roleId,
        isActive: input.isActive ?? true,
      },
      include: { role: true },
    });

    // Audit log
    const reqInfo = getRequestInfo(request);
    await createAuditLog({
      user,
      action: 'CREATE',
      entity: 'USER',
      entityId: newUser.id,
      newValue: { username: newUser.username, email: newUser.email, fullName: newUser.fullName, role: newUser.role.name },
      ...reqInfo,
    });

    return NextResponse.json(
      successResponse({ id: newUser.id, username: newUser.username, fullName: newUser.fullName }, 'User created successfully'),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create user error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(errorResponse(error.errors[0].message), { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(errorResponse(error.message), { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(errorResponse(error.message), { status: 403 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json(errorResponse(error.message), { status: 409 });
    }
    return NextResponse.json(errorResponse('Failed to create user'), { status: 500 });
  }
}

