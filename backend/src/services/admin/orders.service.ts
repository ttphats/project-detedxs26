import { prisma } from '../../db/prisma.js';
import { randomBytes, createHash } from 'crypto';
import { generateTicketQRCode, generateTicketUrl } from '../qrcode.service.js';
import { sendEmailByPurpose } from '../email.service.js';
import { createAuditLog } from '../audit.service.js';

export interface ListOrdersInput {
  page?: number;
  limit?: number;
  status?: string;
  eventId?: string;
  search?: string;
}

/**
 * List orders with pagination and filters
 */
export async function listOrders(input: ListOrdersInput) {
  const page = input.page || 1;
  const limit = input.limit || 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (input.status) where.status = input.status;
  if (input.eventId) where.eventId = input.eventId;

  if (input.search) {
    where.OR = [
      { orderNumber: { contains: input.search } },
      { customerName: { contains: input.search } },
      { customerEmail: { contains: input.search } },
      { customerPhone: { contains: input.search } },
    ];
  }

  const [orders, total, pending, paid, cancelled] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        event: { select: { id: true, name: true } },
        orderItems: { include: { seat: true } },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count({ where }),
    prisma.order.count({ where: { ...where, status: 'PENDING' } }),
    prisma.order.count({ where: { ...where, status: 'PAID' } }),
    prisma.order.count({ where: { ...where, status: 'CANCELLED' } }),
  ]);

  return {
    orders,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: { pending, paid, cancelled },
  };
}

/**
 * Get order by ID
 */
export async function getOrderById(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      event: true,
      orderItems: { include: { seat: true } },
      payment: true,
    },
  });
}

/**
 * Generate access token
 */
function generateAccessToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

/**
 * Confirm payment (admin action)
 */
export async function confirmPayment(
  orderId: string,
  adminUser: { userId: string; roleName: string },
  ipAddress?: string,
  userAgent?: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        event: true,
        orderItems: { include: { seat: true } },
        payment: true,
      },
    });

    if (!order) throw new Error('Order not found');
    if (order.status === 'PAID') throw new Error('Order already paid');
    if (order.status === 'CANCELLED') throw new Error('Order is cancelled');
    if (order.status === 'EXPIRED') throw new Error('Order has expired');

    // Generate access token
    const { token: accessToken, hash: accessTokenHash } = generateAccessToken();

    // Update order to PAID
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        accessTokenHash,
      },
    });

    // Update payment
    if (order.payment) {
      await tx.payment.update({
        where: { orderId },
        data: {
          status: 'COMPLETED',
          paidAt: new Date(),
        },
      });
    } else {
      await tx.payment.create({
        data: {
          orderId,
          amount: order.totalAmount,
          paymentMethod: 'BANK_TRANSFER',
          status: 'COMPLETED',
          paidAt: new Date(),
        },
      });
    }

    // Mark seats as SOLD
    const seatIds = order.orderItems.map((item) => item.seatId);
    await tx.seat.updateMany({
      where: { id: { in: seatIds } },
      data: { status: 'SOLD' },
    });

    // Create audit log
    await tx.auditLog.create({
      data: {
        userId: adminUser.userId,
        userRole: adminUser.roleName,
        action: 'CONFIRM',
        entity: 'PAYMENT',
        entityId: orderId,
        oldValue: JSON.stringify({ status: order.status }),
        newValue: JSON.stringify({ status: 'PAID' }),
        metadata: JSON.stringify({
          orderNumber: order.orderNumber,
          amount: Number(order.totalAmount),
        }),
        ipAddress,
        userAgent,
      },
    });

    return { order, updatedOrder, accessToken, seatIds };
  }, { timeout: 30000 });

  return result;
}

/**
 * Reject payment (admin action)
 */
export async function rejectPayment(
  orderId: string,
  reason: string,
  adminUser: { userId: string; roleName: string },
  notes?: string,
  ipAddress?: string,
  userAgent?: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        event: true,
        orderItems: { include: { seat: true } },
        payment: true,
      },
    });

    if (!order) throw new Error('Order not found');
    if (order.status === 'PAID') throw new Error('Cannot reject paid order');
    if (order.status === 'CANCELLED') throw new Error('Order already cancelled');
    if (order.status === 'EXPIRED') throw new Error('Order has expired');

    // Update order to CANCELLED
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });

    // Update payment to FAILED
    if (order.payment) {
      await tx.payment.update({
        where: { orderId },
        data: {
          status: 'FAILED',
          metadata: JSON.stringify({
            rejectedBy: adminUser.userId,
            rejectedAt: new Date().toISOString(),
            reason,
            notes,
          }),
        },
      });
    }

    // Release seats back to AVAILABLE
    const seatIds = order.orderItems.map((item) => item.seatId);
    await tx.seat.updateMany({
      where: { id: { in: seatIds } },
      data: { status: 'AVAILABLE' },
    });

    // Create audit log
    await tx.auditLog.create({
      data: {
        userId: adminUser.userId,
        userRole: adminUser.roleName,
        action: 'REJECT',
        entity: 'PAYMENT',
        entityId: orderId,
        oldValue: JSON.stringify({ status: order.status }),
        newValue: JSON.stringify({ status: 'CANCELLED', reason }),
        metadata: JSON.stringify({
          orderNumber: order.orderNumber,
          releasedSeats: seatIds.length,
          notes,
        }),
        ipAddress,
        userAgent,
      },
    });

    return { order, updatedOrder, releasedSeats: seatIds.length };
  }, { timeout: 30000 });

  return result;
}

/**
 * Resend ticket email for PAID order
 */
export async function resendTicketEmail(
  orderId: string,
  adminUser: { userId: string; roleName: string }
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      event: true,
      orderItems: { include: { seat: true } },
    },
  });

  if (!order) throw new Error('Order not found');
  if (order.status !== 'PAID') throw new Error('Can only resend email for PAID orders');

  // Generate new access token
  const { token: accessToken, hash: accessTokenHash } = generateAccessToken();

  // Update order with new access token
  await prisma.order.update({
    where: { id: orderId },
    data: { accessTokenHash },
  });

  // Generate QR code and ticket URL
  const qrCodeUrl = await generateTicketQRCode(order.orderNumber, order.eventId);
  const ticketUrl = generateTicketUrl(order.orderNumber, accessToken);

  // Format date
  const eventDate = new Date(order.event.eventDate);
  const formattedDate = eventDate.toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = eventDate.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Send email with allowDuplicate to bypass anti-spam
  const emailResult = await sendEmailByPurpose({
    purpose: 'TICKET_CONFIRMED',
    to: order.customerEmail,
    orderId: order.id,
    triggeredBy: adminUser.userId,
    allowDuplicate: true,
    data: {
      customerName: order.customerName,
      eventName: order.event.name,
      eventDate: formattedDate,
      eventTime: formattedTime,
      eventVenue: order.event.venue,
      orderNumber: order.orderNumber,
      seats: order.orderItems.map((item) => ({
        seatNumber: item.seat.seatNumber,
        seatType: item.seat.seatType,
        section: item.seat.section,
        row: item.seat.row,
        price: Number(item.price),
      })),
      totalAmount: Number(order.totalAmount),
      qrCodeUrl,
      ticketUrl,
    },
  });

  // Update email_sent_at
  if (emailResult.success) {
    await prisma.order.update({
      where: { id: orderId },
      data: { emailSentAt: new Date() },
    });
  }

  return { order, emailResult };
}

