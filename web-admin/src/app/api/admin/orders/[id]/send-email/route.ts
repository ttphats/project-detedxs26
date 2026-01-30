import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getAuthUser, requireAdmin } from '@/lib/auth';
import { sendEmailByTemplate } from '@/lib/email/service';
import { BUSINESS_EVENTS } from '@/lib/email/types';
import { generateTicketQRCode } from '@/lib/qrcode';
import { successResponse, errorResponse, UnauthorizedError, ForbiddenError, NotFoundError } from '@/lib/utils';
import { logEmailAction } from '@/lib/audit-logger';

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
 * POST /api/admin/orders/:id/send-email
 * 
 * Admin sends email with selected template
 * 
 * Body:
 * - templateId: string (required)
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

    // Parse body
    const body = await request.json();
    const { templateId } = body;

    if (!templateId) {
      return NextResponse.json(
        errorResponse('Template ID is required'),
        { status: 400 }
      );
    }

    // Get order with relations
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        event: true,
        orderItems: {
          select: {
            id: true,
            seatNumber: true,
            seatType: true,
            price: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

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

    // Format total amount
    const totalAmountFormatted = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(Number(order.totalAmount));

    // Prepare seat info
    const seatInfo = order.orderItems
      .map(item => `${item.seatNumber} (${item.seatType})`)
      .join(', ');

    // Generate QR code (for PAID orders)
    let qrCodeUrl = order.qrCodeUrl || '';
    if (order.status === 'PAID' && !qrCodeUrl) {
      qrCodeUrl = await generateTicketQRCode(order.orderNumber, order.eventId);
    }

    // Generate new access token for ticket URL
    const { token: accessToken, hash: accessTokenHash } = generateAccessToken();

    // Update order with new access token hash
    await prisma.order.update({
      where: { id: order.id },
      data: {
        accessTokenHash,
        ...(qrCodeUrl && !order.qrCodeUrl ? { qrCodeUrl } : {}),
      },
    });

    // Generate ticket URL with new token
    const ticketUrl = generateTicketUrl(order.orderNumber, accessToken);

    // Send email with template
    const emailResult = await sendEmailByTemplate({
      templateId,
      businessEvent: BUSINESS_EVENTS.EMAIL_RESENT,
      orderId: order.id,
      triggeredBy: user.userId,
      allowDuplicate: true, // Allow sending multiple emails with different templates
      to: order.customerEmail,
      data: {
        customerName: order.customerName,
        eventName: order.event.name,
        eventDate: formattedDate,
        eventTime: formattedTime,
        eventVenue: order.event.venue,
        orderNumber: order.orderNumber,
        totalAmount: totalAmountFormatted,
        seatInfo,
        orderStatus: order.status,
        ticketUrl,
        qrCodeUrl,
        seats: order.orderItems.map((item) => ({
          seatNumber: item.seatNumber,
          seatType: item.seatType,
          price: Number(item.price),
        })),
      },
      metadata: {
        templateId,
        sentBy: user.userId,
      },
    });

    // Create audit log
    await logEmailAction(
      user,
      'SEND_EMAIL',
      orderId,
      {
        orderNumber: order.orderNumber,
        customerEmail: order.customerEmail,
        templateId,
        success: emailResult.success,
        error: emailResult.error,
        skipped: emailResult.skipped,
      },
      request
    );

    if (emailResult.skipped) {
      return NextResponse.json({
        success: false,
        skipped: true,
        error: emailResult.error || 'Email đã được gửi trước đó với template này',
      });
    }

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
      successResponse({
        orderId: order.id,
        orderNumber: order.orderNumber,
        emailSentTo: order.customerEmail,
        emailId: emailResult.emailId,
      }, 'Email sent successfully.')
    );
  } catch (error: unknown) {
    console.error('Send email error:', error);

    if (error instanceof UnauthorizedError) {
      return NextResponse.json(errorResponse(error.message), { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(errorResponse(error.message), { status: 403 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json(errorResponse(error.message), { status: 404 });
    }
    return NextResponse.json(errorResponse('Failed to send email'), { status: 500 });
  }
}

