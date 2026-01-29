import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse, UnauthorizedError } from '@/lib/utils';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = await getAuthUser(authHeader);

    if (!user) {
      throw new UnauthorizedError();
    }

    // Get fresh user data
    const userData = await prisma.user.findUnique({
      where: { id: user.userId },
      include: { role: true },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    if (!userData) {
      throw new UnauthorizedError('User not found');
    }

    return NextResponse.json(successResponse(userData));
  } catch (error: any) {
    console.error('Get user error:', error);

    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        errorResponse(error.message),
        { status: 401 }
      );
    }

    return NextResponse.json(
      errorResponse('Internal server error'),
      { status: 500 }
    );
  }
}

