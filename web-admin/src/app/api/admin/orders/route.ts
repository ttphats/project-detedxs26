import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser, requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse, UnauthorizedError, ForbiddenError } from '@/lib/utils';

/**
 * GET /api/admin/orders
 * 
 * Admin views all orders with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = await getAuthUser(authHeader);

    if (!user) {
      throw new UnauthorizedError();
    }

    // Check if user is admin
    try {
      requireAdmin(user);
    } catch {
      throw new ForbiddenError();
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const eventId = searchParams.get('eventId');
    const search = searchParams.get('search'); // Search by order number or email
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (eventId) {
      where.eventId = eventId;
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { customerEmail: { contains: search } },
        { customerName: { contains: search } },
      ];
    }

    // Fetch orders with pagination
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          event: {
            select: {
              id: true,
              name: true,
              eventDate: true,
              venue: true,
            },
          },
          orderItems: {
            include: {
              seat: {
                select: {
                  seatNumber: true,
                  seatType: true,
                  row: true,
                  section: true,
                },
              },
            },
          },
          payment: {
            select: {
              id: true,
              paymentMethod: true,
              status: true,
              transactionId: true,
              paidAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    // Format response
    const formattedOrders = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      event: order.event,
      seats: order.orderItems.map((item) => ({
        seatNumber: item.seat.seatNumber,
        seatType: item.seat.seatType,
        row: item.seat.row,
        section: item.seat.section,
        price: Number(item.price),
      })),
      payment: order.payment,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      expiresAt: order.expiresAt,
    }));

    return NextResponse.json(
      successResponse({
        orders: formattedOrders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        summary: {
          totalOrders: total,
          pendingOrders: await prisma.order.count({ where: { status: 'PENDING' } }),
          paidOrders: await prisma.order.count({ where: { status: 'PAID' } }),
          cancelledOrders: await prisma.order.count({ where: { status: 'CANCELLED' } }),
        },
      })
    );
  } catch (error: any) {
    console.error('Get orders error:', error);

    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        errorResponse(error.message),
        { status: 401 }
      );
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        errorResponse(error.message),
        { status: 403 }
      );
    }

    return NextResponse.json(
      errorResponse('Failed to fetch orders'),
      { status: 500 }
    );
  }
}

