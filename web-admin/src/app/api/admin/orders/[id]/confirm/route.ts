import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser, requireAdmin } from '@/lib/auth';
import { sendTicketEmail } from '@/lib/mail';
import { generateTicketQRCode } from '@/lib/qrcode';
import { successResponse, errorResponse, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError } from '@/lib/utils';

const confirmPaymentSchema = z.object({
  transactionId: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/admin/orders/:id/confirm
 * 
 * CRITICAL: Admin manually confirms bank transfer payment
 * 
 * Flow:
 * 1. Verify admin authentication
 * 2. Check order exists and is PENDING
 * 3. Update order to PAID
 * 4. Update payment record
 * 5. Mark seats as SOLD
 * 6. Generate QR code
 * 7. Send ticket email
 * 8. Create audit log
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Parse input
    const body = await request.json();
    const input = confirmPaymentSchema.parse(body);

    const orderId = params.id;

    // Process payment confirmation in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Get order with all relations
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          event: true,
          orderItems: {
            include: { seat: true },
          },
          payment: true,
        },
      });

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      // Check if order is already paid
      if (order.status === 'PAID') {
        throw new ConflictError('Order is already paid');
      }

      // Check if order is cancelled or expired
      if (order.status === 'CANCELLED' || order.status === 'EXPIRED') {
        throw new ConflictError(`Cannot confirm payment for ${order.status.toLowerCase()} order`);
      }

      // Update order status
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      });

      // Update payment record
      await tx.payment.update({
        where: { orderId },
        data: {
          status: 'COMPLETED',
          transactionId: input.transactionId || `MANUAL-${Date.now()}`,
          paidAt: new Date(),
          metadata: JSON.stringify({
            confirmedBy: user.userId,
            confirmedAt: new Date().toISOString(),
            notes: input.notes,
          }),
        },
      });

      // Mark all seats as SOLD
      const seatIds = order.orderItems.map((item) => item.seatId);
      await tx.seat.updateMany({
        where: { id: { in: seatIds } },
        data: { status: 'SOLD' },
      });

      // Update event available seats
      await tx.event.update({
        where: { id: order.eventId },
        data: {
          availableSeats: {
            decrement: seatIds.length,
          },
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: user.userId,
          action: 'CONFIRM_PAYMENT',
          entity: 'Order',
          entityId: orderId,
          changes: JSON.stringify({
            orderNumber: order.orderNumber,
            status: 'PENDING -> PAID',
            transactionId: input.transactionId,
            notes: input.notes,
          }),
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || undefined,
        },
      });

      return { order, updatedOrder };
    });

    // Generate QR code (outside transaction)
    const qrCodeUrl = await generateTicketQRCode(
      result.order.orderNumber,
      result.order.eventId
    );

    // Send ticket email (fire and forget)
    sendTicketEmail({
      to: result.order.customerEmail,
      customerName: result.order.customerName,
      eventName: result.order.event.name,
      eventDate: result.order.event.eventDate.toISOString(),
      eventVenue: result.order.event.venue,
      orderNumber: result.order.orderNumber,
      seats: result.order.orderItems.map((item) => ({
        seatNumber: item.seat.seatNumber,
        seatType: item.seat.seatType,
        price: Number(item.price),
      })),
      totalAmount: Number(result.order.totalAmount),
      qrCodeUrl,
    })
      .then(() => {
        console.log(`✅ Ticket email sent to ${result.order.customerEmail}`);
      })
      .catch((err) => {
        console.error('❌ Failed to send ticket email:', err);
      });

    return NextResponse.json(
      successResponse(
        {
          orderId: result.updatedOrder.id,
          orderNumber: result.updatedOrder.orderNumber,
          status: result.updatedOrder.status,
          paidAt: result.updatedOrder.paidAt,
        },
        'Payment confirmed successfully. Ticket email sent to customer.'
      )
    );
  } catch (error: any) {
    console.error('Confirm payment error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        errorResponse(error.errors[0].message),
        { status: 400 }
      );
    }

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

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        errorResponse(error.message),
        { status: 404 }
      );
    }

    if (error instanceof ConflictError) {
      return NextResponse.json(
        errorResponse(error.message),
        { status: 409 }
      );
    }

    return NextResponse.json(
      errorResponse('Failed to confirm payment'),
      { status: 500 }
    );
  }
}

