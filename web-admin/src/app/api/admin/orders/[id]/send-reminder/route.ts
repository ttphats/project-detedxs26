import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser, requireAdmin } from '@/lib/auth';
import { sendEmailByPurpose } from '@/lib/email/service';
import { BUSINESS_EVENTS } from '@/lib/email/types';
import { successResponse, errorResponse, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError } from '@/lib/utils';
import { getRequestInfo } from '@/lib/audit-logger';

/**
 * POST /api/admin/orders/:id/send-reminder
 * 
 * NO SPAM FLOW: Admin manually sends payment reminder
 * 
 * Requirements:
 * - Only for PENDING orders
 * - Only admin can trigger
 * - Anti-spam: Only 1 reminder per order (unless allowDuplicate)
 * - Log email attempt with businessEvent
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

    try {
      requireAdmin(user);
    } catch {
      throw new ForbiddenError();
    }

    // Get order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { event: true },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Only send reminder for PENDING orders
    if (order.status !== 'PENDING') {
      throw new ConflictError(`Cannot send reminder for ${order.status} order. Order must be PENDING.`);
    }

    // Calculate payment deadline
    const deadline = order.expiresAt 
      ? new Date(order.expiresAt).toLocaleString('vi-VN')
      : 'Không xác định';

    // Format amount
    const totalAmountFormatted = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(Number(order.totalAmount));

    // Bank info from env
    const bankName = process.env.BANK_NAME || 'Vietcombank';
    const accountNumber = process.env.BANK_ACCOUNT || '0123456789';
    const accountName = process.env.BANK_OWNER || 'TEDxFPTUniversityHCMC';

    // NO SPAM FLOW: Send reminder with anti-spam check
    const emailResult = await sendEmailByPurpose({
      purpose: 'PAYMENT_PENDING',
      businessEvent: BUSINESS_EVENTS.PAYMENT_REMINDER_SENT,
      orderId: order.id,
      triggeredBy: user.userId,
      allowDuplicate: false, // Anti-spam: only 1 reminder per order
      to: order.customerEmail,
      data: {
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        totalAmount: totalAmountFormatted,
        paymentDeadline: deadline,
        eventName: order.event.name,
        bankName,
        accountNumber,
        accountName,
        transferContent: order.orderNumber,
      },
      metadata: {
        sentBy: user.userId,
        orderCreatedAt: order.createdAt.toISOString(),
        hoursUntilExpiry: order.expiresAt 
          ? Math.round((new Date(order.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60))
          : null,
      },
    });

    // Create audit log
    const reqInfo = getRequestInfo(request);
    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        userRole: user.roleName,
        action: 'SEND_REMINDER',
        entity: 'ORDER',
        entityId: orderId,
        metadata: JSON.stringify({
          orderNumber: order.orderNumber,
          customerEmail: order.customerEmail,
          success: emailResult.success,
          skipped: emailResult.skipped,
          error: emailResult.error,
        }),
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      },
    });

    if (emailResult.skipped) {
      return NextResponse.json(
        errorResponse(`Đã gửi nhắc nhở cho đơn hàng này trước đó. Không thể gửi lại.`),
        { status: 409 }
      );
    }

    if (!emailResult.success) {
      return NextResponse.json(
        errorResponse(`Không thể gửi email: ${emailResult.error}`),
        { status: 500 }
      );
    }

    console.log(`📧 Payment reminder sent to ${order.customerEmail} for order ${order.orderNumber}`);

    return NextResponse.json(
      successResponse(
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          emailSentTo: order.customerEmail,
          emailId: emailResult.emailId,
        },
        'Đã gửi email nhắc thanh toán thành công.'
      )
    );
  } catch (error: any) {
    console.error('Send reminder error:', error);

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
    return NextResponse.json(errorResponse('Không thể gửi nhắc nhở'), { status: 500 });
  }
}

