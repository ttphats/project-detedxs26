import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getAuthUser, requireAdmin } from '@/lib/auth';
import { sendEmailByPurpose } from '@/lib/email/service';
import { BUSINESS_EVENTS } from '@/lib/email/types';
import { generateTicketQRCode } from '@/lib/qrcode';
import { successResponse, errorResponse, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError } from '@/lib/utils';
import { logEmailAction, getRequestInfo } from '@/lib/audit-logger';

/**
 * Generate access token for ticketless authentication
 */
function generateAccessToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

/**
 * Generate ticket URL with access token
 */
function generateTicketUrl(orderNumber: string, token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_CLIENT_URL || 'http://localhost:3000';
  return `${baseUrl}/ticket/${orderNumber}?token=${token}`;
}

/**
 * POST /api/admin/orders/:id/resend-email
 * 
 * Admin resends ticket confirmation email
 * 
 * Requirements:
 * - Only resend for PAID orders
 * - Only admin can trigger
 * - Log email attempt
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

    // Get order with all relations
    const order = await prisma.order.findUnique({
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

    // Only resend email for PAID orders
    if (order.status !== 'PAID') {
      throw new ConflictError(`Cannot resend email for ${order.status} order. Order must be PAID.`);
    }

    // Generate QR code
    const qrCodeUrl = await generateTicketQRCode(order.orderNumber, order.eventId);

    // Generate new access token for resend (invalidates previous token)
    const { token: accessToken, hash: accessTokenHash } = generateAccessToken();

    // Update order with new access token hash
    await prisma.order.update({
      where: { id: order.id },
      data: { accessTokenHash },
    });

    // Generate ticket URL with new token
    const ticketUrl = generateTicketUrl(order.orderNumber, accessToken);

    // Format event date for Vietnamese locale
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

    // NO SPAM FLOW: Resend with allowDuplicate=true to bypass anti-spam
    // businessEvent: EMAIL_RESENT - Admin manually resending email
    // triggeredBy: Admin user ID who clicked "Resend Email"
    const emailResult = await sendEmailByPurpose({
      purpose: 'TICKET_CONFIRMED',
      businessEvent: BUSINESS_EVENTS.EMAIL_RESENT,
      orderId: order.id,
      triggeredBy: user.userId,
      allowDuplicate: true, // IMPORTANT: bypass anti-spam for resend
      to: order.customerEmail,
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
      metadata: {
        isResend: true,
        resentBy: user.userId,
        previousEmailSentAt: order.emailSentAt?.toISOString(),
      },
    });

    // Create audit log with new format
    await logEmailAction(
      user,
      'RESEND_EMAIL',
      orderId,
      {
        orderNumber: order.orderNumber,
        customerEmail: order.customerEmail,
        success: emailResult.success,
        error: emailResult.error,
      },
      request
    );

    if (!emailResult.success) {
      return NextResponse.json(
        errorResponse(`Failed to send email: ${emailResult.error}`),
        { status: 500 }
      );
    }

    // Update email_sent_at
    await prisma.order.update({
      where: { id: order.id },
      data: { emailSentAt: new Date() },
    });

    return NextResponse.json(
      successResponse(
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          emailSentTo: order.customerEmail,
          emailId: emailResult.emailId,
        },
        'Ticket confirmation email resent successfully.'
      )
    );
  } catch (error: any) {
    console.error('Resend email error:', error);

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
    return NextResponse.json(errorResponse('Failed to resend email'), { status: 500 });
  }
}

