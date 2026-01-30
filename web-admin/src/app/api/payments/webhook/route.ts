import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { unlockSeats } from '@/lib/redis';
import { sendEmailByPurpose } from '@/lib/email/service';
import { BUSINESS_EVENTS } from '@/lib/email/types';
import { generateTicketQRCode } from '@/lib/qrcode';
import { successResponse, errorResponse } from '@/lib/utils';
import { config } from '@/lib/env';

/**
 * CRITICAL: Payment Webhook Handler
 * 
 * This is the SINGLE SOURCE OF TRUTH for payment confirmation.
 * Must be idempotent to prevent double-processing.
 * 
 * Flow:
 * 1. Verify webhook signature
 * 2. Check idempotency (prevent duplicate processing)
 * 3. Update payment status
 * 4. Update order status
 * 5. Mark seats as SOLD
 * 6. Release Redis locks
 * 7. Send ticket email
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Mock payment provider for development
    if (config.isMock || config.payment.provider === 'mock') {
      return handleMockWebhook(body);
    }

    // Handle Stripe webhook
    if (config.payment.provider === 'stripe') {
      return handleStripeWebhook(request, body);
    }

    // Handle VNPay webhook
    if (config.payment.provider === 'vnpay') {
      return handleVNPayWebhook(body);
    }

    return NextResponse.json(
      errorResponse('Unsupported payment provider'),
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      errorResponse('Webhook processing failed'),
      { status: 500 }
    );
  }
}

async function handleMockWebhook(body: any) {
  const { orderId, status } = body;

  if (!orderId) {
    return NextResponse.json(
      errorResponse('Missing orderId'),
      { status: 400 }
    );
  }

  // Process payment
  await processPaymentConfirmation(orderId, {
    transactionId: `mock-${Date.now()}`,
    status: status || 'COMPLETED',
    metadata: JSON.stringify(body),
  });

  return NextResponse.json(successResponse({ received: true }));
}

async function handleStripeWebhook(request: NextRequest, body: any) {
  // TODO: Verify Stripe signature
  // const signature = request.headers.get('stripe-signature');
  // const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

  const { type, data } = body;

  if (type === 'checkout.session.completed') {
    const session = data.object;
    const orderId = session.metadata.orderId;

    await processPaymentConfirmation(orderId, {
      transactionId: session.id,
      status: 'COMPLETED',
      metadata: JSON.stringify(session),
    });
  }

  return NextResponse.json(successResponse({ received: true }));
}

async function handleVNPayWebhook(body: any) {
  // TODO: Verify VNPay signature
  const { vnp_TxnRef, vnp_ResponseCode } = body;

  if (vnp_ResponseCode === '00') {
    await processPaymentConfirmation(vnp_TxnRef, {
      transactionId: body.vnp_TransactionNo,
      status: 'COMPLETED',
      metadata: JSON.stringify(body),
    });
  }

  return NextResponse.json(successResponse({ received: true }));
}

/**
 * Process payment confirmation (IDEMPOTENT)
 */
async function processPaymentConfirmation(
  orderId: string,
  paymentData: {
    transactionId: string;
    status: string;
    metadata: string;
  }
) {
  // Use transaction to ensure atomicity
  await prisma.$transaction(async (tx) => {
    // Get order with payment
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
        orderItems: {
          include: { seat: true },
        },
        event: true,
      },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Check if already processed (idempotency)
    if (order.payment?.webhookProcessed) {
      console.log(`Webhook already processed for order ${orderId}`);
      return;
    }

    // Update payment
    await tx.payment.update({
      where: { orderId },
      data: {
        status: paymentData.status,
        transactionId: paymentData.transactionId,
        webhookReceived: true,
        webhookProcessed: true,
        webhookData: paymentData.metadata,
        paidAt: new Date(),
      },
    });

    // Update order
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    // Mark seats as SOLD
    const seatIds = order.orderItems.map((item) => item.seatId);
    await tx.seat.updateMany({
      where: { id: { in: seatIds } },
      data: { status: 'SOLD' },
    });

    // Release Redis locks (fire and forget)
    unlockSeats(order.eventId, seatIds).catch((err) => {
      console.error('Failed to release seat locks:', err);
    });

    // Generate QR code
    const qrCodeUrl = await generateTicketQRCode(order.orderNumber, order.eventId);

    // Format event date
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

    // Generate ticket URL (no token for webhook - admin will need to resend with token)
    const ticketUrl = `${process.env.NEXT_PUBLIC_CLIENT_URL || 'http://localhost:3000'}/ticket/${order.orderNumber}`;

    // NO SPAM FLOW: Webhook is a valid business event (payment gateway confirmed)
    // businessEvent: PAYMENT_CONFIRMED - Automated payment gateway confirmation
    // triggeredBy: 'SYSTEM' - No admin user
    sendEmailByPurpose({
      purpose: 'TICKET_CONFIRMED',
      businessEvent: BUSINESS_EVENTS.PAYMENT_CONFIRMED,
      orderId: order.id,
      triggeredBy: 'SYSTEM', // Webhook is automated
      to: order.customerEmail,
      data: {
        customerName: order.customerName,
        eventName: order.event.name,
        eventDate: formattedDate,
        eventTime: formattedTime,
        eventVenue: order.event.venue,
        orderNumber: order.orderNumber,
        seats: order.orderItems.map((item) => ({
          seatNumber: item.seatNumber,
          seatType: item.seatType,
          price: Number(item.price),
        })),
        totalAmount: Number(order.totalAmount),
        qrCodeUrl,
        ticketUrl,
      },
      metadata: {
        source: 'payment_webhook',
        provider: config.payment.provider,
      },
    }).catch((err) => {
      console.error('Failed to send ticket email:', err);
    });

    console.log(`✅ Payment confirmed for order ${orderId}`);
  });
}

