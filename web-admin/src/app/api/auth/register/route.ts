import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword, signToken } from '@/lib/auth';
import { successResponse, errorResponse, ConflictError, BadRequestError } from '@/lib/utils';

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phoneNumber: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate input
    const body = await request.json();
    const input = registerSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Get USER role
    const userRole = await prisma.role.findUnique({
      where: { name: 'USER' },
    });

    if (!userRole) {
      throw new BadRequestError('User role not found. Please run database migration.');
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Generate username from email (before @)
    const baseUsername = input.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    let username = baseUsername;
    let suffix = 1;

    // Ensure unique username
    while (await prisma.user.findUnique({ where: { username } })) {
      username = `${baseUsername}${suffix}`;
      suffix++;
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        phoneNumber: input.phoneNumber,
        roleId: userRole.id,
      },
      include: { role: true },
    });

    // Create audit log
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'REGISTER',
        entity: 'User',
        entityId: user.id,
        ipAddress: ip,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    // Generate JWT token
    const token = signToken({
      userId: user.id,
      email: user.email || '',
      roleId: user.roleId,
      roleName: user.role.name,
    });

    return NextResponse.json(
      successResponse(
        {
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role.name,
          },
          token,
        },
        'Registration successful'
      ),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Registration error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        errorResponse(error.errors[0].message),
        { status: 400 }
      );
    }

    if (error instanceof ConflictError) {
      return NextResponse.json(
        errorResponse(error.message),
        { status: 409 }
      );
    }

    if (error instanceof BadRequestError) {
      return NextResponse.json(
        errorResponse(error.message),
        { status: 400 }
      );
    }

    return NextResponse.json(
      errorResponse('Internal server error'),
      { status: 500 }
    );
  }
}

