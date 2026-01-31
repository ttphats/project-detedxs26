import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser, requireAdmin } from '@/lib/auth';
import { sendEmailByPurpose, sendEmailByTemplate } from '@/lib/email/service';
import { BUSINESS_EVENTS } from '@/lib/email/types';
import { successResponse, errorResponse, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError } from '@/lib/utils';
import { logPaymentAction, getRequestInfo } from '@/lib/audit-logger';

const rejectPaymentSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
  notes: z.string().optional(),
  templateId: z.string().optional(), // Optional: use specific template instead of default
});

/**
 * POST /api/admin/orders/:id/reject
 * 
 * CRITICAL: Admin rejects bank transfer payment
 * 
 * Flow:
 * 1. Verify admin authentication
 * 2. Check order exists and is PENDING
 * 3. Update order status to CANCELLED
 * 4. Update payment status to REJECTED
 * 5. Release seats (LOCKED -> AVAILABLE)
 * 6. Create audit log
 * 7. NO EMAIL SENT for rejected payments
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
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
    const input = rejectPaymentSchema.parse(body);

    // Process payment rejection in transaction
    // Increase timeout to 30 seconds for remote database with high latency
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

      // Check if order can be rejected
      if (order.status === 'PAID') {
        throw new ConflictError('Cannot reject a paid order. Use refund instead.');
      }

      if (order.status === 'CANCELLED') {
        throw new ConflictError('Order is already cancelled');
      }

      if (order.status === 'EXPIRED') {
        throw new ConflictError('Order has already expired');
      }

      // Update order status to CANCELLED
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: input.reason,
        },
      });

      // Update payment status to REJECTED (adding new status)
      if (order.payment) {
        await tx.payment.update({
          where: { orderId },
          data: {
            status: 'FAILED', // Using FAILED as REJECTED equivalent
            metadata: JSON.stringify({
              rejectedBy: user.userId,
              rejectedAt: new Date().toISOString(),
              reason: input.reason,
              notes: input.notes,
            }),
          },
        });
      }

      // Release all seats back to AVAILABLE
      const seatIds = order.orderItems.map((item) => item.seatId);
      await tx.seat.updateMany({
        where: { id: { in: seatIds } },
        data: { status: 'AVAILABLE' },
      });

      // Create audit log with new format (inside transaction)
      await tx.auditLog.create({
        data: {
          userId: user.userId,
          userRole: user.roleName,
          action: 'REJECT',
          entity: 'PAYMENT',
          entityId: orderId,
          oldValue: JSON.stringify({
            orderStatus: order.status,
            paymentStatus: order.payment?.status,
            seatStatus: 'LOCKED',
          }),
          newValue: JSON.stringify({
            orderStatus: 'CANCELLED',
            paymentStatus: 'FAILED',
            seatStatus: 'AVAILABLE',
            reason: input.reason,
          }),
          metadata: JSON.stringify({
            orderNumber: order.orderNumber,
            customerEmail: order.customerEmail,
            totalAmount: Number(order.totalAmount),
            releasedSeats: seatIds.length,
            notes: input.notes,
          }),
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || undefined,
        },
      });

      return { order, updatedOrder, releasedSeats: seatIds.length };
    }, {
      timeout: 30000, // 30 seconds timeout for remote database
    });

    // Prepare email data
    const emailData = {
      customerName: result.order.customerName,
      orderNumber: result.order.orderNumber,
      reason: input.reason,
      eventName: result.order.event.name,
      orderStatus: 'CANCELLED',
    };

    // NO SPAM FLOW: Send email via template or purpose
    // If templateId is provided, use that template; otherwise use default purpose
    const emailPromise = input.templateId
      ? sendEmailByTemplate({
          templateId: input.templateId,
          businessEvent: BUSINESS_EVENTS.PAYMENT_REJECTED,
          orderId: result.order.id,
          triggeredBy: user.userId,
          to: result.order.customerEmail,
          data: emailData,
          metadata: {
            rejectedBy: user.userId,
            notes: input.notes,
            releasedSeats: result.releasedSeats,
            templateId: input.templateId,
          },
        })
      : sendEmailByPurpose({
          purpose: 'PAYMENT_REJECTED',
          businessEvent: BUSINESS_EVENTS.PAYMENT_REJECTED,
          orderId: result.order.id,
          triggeredBy: user.userId,
          to: result.order.customerEmail,
          data: emailData,
          metadata: {
            rejectedBy: user.userId,
            notes: input.notes,
            releasedSeats: result.releasedSeats,
          },
        });

    emailPromise
      .then((emailResult) => {
        if (emailResult.success) {
          console.log(`📧 Rejection email sent to ${result.order.customerEmail}`);
        } else if (emailResult.skipped) {
          console.log(`⏭️ Rejection email skipped (anti-spam): ${emailResult.error}`);
        } else {
          console.log(`⚠️ No rejection email sent: ${emailResult.error}`);
        }
      })
      .catch((err) => {
        console.error('❌ Failed to send rejection email:', err);
      });

    console.log(`❌ Payment rejected for order ${result.order.orderNumber}. ${result.releasedSeats} seats released.`);

    return NextResponse.json(
      successResponse(
        {
          orderId: result.updatedOrder.id,
          orderNumber: result.updatedOrder.orderNumber,
          status: result.updatedOrder.status,
          cancelledAt: result.updatedOrder.cancelledAt,
          releasedSeats: result.releasedSeats,
        },
        'Payment rejected. Rejection email sent to customer.'
      )
    );
  } catch (error: any) {
    console.error('Reject payment error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(errorResponse(error.errors[0].message), { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(errorResponse(error.message), { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(errorResponse(error.message), { status: 403 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json(errorResponse(error.message), { status: 404 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json(errorResponse(error.message), { status: 409 });
    }
    return NextResponse.json(errorResponse('Failed to reject payment'), { status: 500 });
  }
}

