import { prisma } from '../../db/prisma.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';

export interface CheckInResult {
  success: boolean;
  order: {
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string | null;
    totalAmount: number;
    seatNumbers: string[];
    checkedInAt: Date;
    event: {
      name: string;
      venue: string;
      eventDate: Date;
    };
  };
  message: string;
}

/**
 * Check in an order by order number
 */
export async function checkInOrder(
  orderNumber: string,
  adminUserId: string
): Promise<CheckInResult> {
  // Find order with event and items
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      event: true,
      orderItems: true,
    },
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  // Validate order status
  if (order.status !== 'PAID') {
    throw new BadRequestError(`Cannot check in order with status: ${order.status}. Only PAID orders can be checked in.`);
  }

  // Check if already checked in
  if (order.checkedInAt) {
    throw new BadRequestError(`Order already checked in at ${order.checkedInAt.toLocaleString('vi-VN')}`);
  }

  // Perform check-in
  const updatedOrder = await prisma.order.update({
    where: { id: order.id },
    data: {
      checkedInAt: new Date(),
      checkedInBy: adminUserId,
    },
    include: {
      event: true,
      orderItems: true,
    },
  });

  return {
    success: true,
    order: {
      orderNumber: updatedOrder.orderNumber,
      customerName: updatedOrder.customerName,
      customerEmail: updatedOrder.customerEmail,
      customerPhone: updatedOrder.customerPhone,
      totalAmount: parseFloat(updatedOrder.totalAmount.toString()),
      seatNumbers: updatedOrder.orderItems.map((item) => item.seatNumber),
      checkedInAt: updatedOrder.checkedInAt!,
      event: {
        name: updatedOrder.event.name,
        venue: updatedOrder.event.venue,
        eventDate: updatedOrder.event.eventDate,
      },
    },
    message: 'Check-in successful',
  };
}

/**
 * Get check-in status for an order
 */
export async function getCheckInStatus(orderNumber: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      event: true,
      orderItems: true,
      checkedInByUser: {
        select: {
          fullName: true,
          username: true,
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  return {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    status: order.status,
    checkedIn: !!order.checkedInAt,
    checkedInAt: order.checkedInAt,
    checkedInBy: order.checkedInByUser
      ? {
          fullName: order.checkedInByUser.fullName,
          username: order.checkedInByUser.username,
        }
      : null,
    seatNumbers: order.orderItems.map((item) => item.seatNumber),
    event: {
      name: order.event.name,
      venue: order.event.venue,
      eventDate: order.event.eventDate,
    },
  };
}

/**
 * Get check-in statistics for an event
 */
export async function getCheckInStats(eventId: string) {
  const [total, checkedIn] = await Promise.all([
    prisma.order.count({
      where: {
        eventId,
        status: 'PAID',
      },
    }),
    prisma.order.count({
      where: {
        eventId,
        status: 'PAID',
        checkedInAt: { not: null },
      },
    }),
  ]);

  return {
    total,
    checkedIn,
    pending: total - checkedIn,
    percentage: total > 0 ? Math.round((checkedIn / total) * 100) : 0,
  };
}
