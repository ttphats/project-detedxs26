import {FastifyRequest, FastifyReply} from 'fastify'
import {prisma} from '../db/prisma.js'
import * as qrcodeService from '../services/qrcode.service.js'
import {sendEmailByPurpose} from '../services/email.service.js'
import {config} from '../config/env.js'
import {generateAccessToken} from '../utils/helpers.js'

/**
 * POST /api/payments/webhook
 * Payment webhook handler
 */
export async function handleWebhook(request: FastifyRequest, reply: FastifyReply) {
  try {
    const body = request.body as any

    // Mock payment provider for development
    if (config.payment?.provider === 'mock' || !config.payment?.provider) {
      return handleMockWebhook(body, reply)
    }

    // Handle Stripe webhook
    if (config.payment.provider === 'stripe') {
      return handleStripeWebhook(request, body, reply)
    }

    // Handle VNPay webhook
    if (config.payment.provider === 'vnpay') {
      return handleVNPayWebhook(body, reply)
    }

    return reply.status(400).send({
      success: false,
      error: 'Unsupported payment provider',
    })
  } catch (error: any) {
    console.error('Webhook error:', error)
    return reply.status(500).send({
      success: false,
      error: 'Webhook processing failed',
    })
  }
}

async function handleMockWebhook(body: any, reply: FastifyReply) {
  const {orderId, status} = body

  if (!orderId) {
    return reply.status(400).send({
      success: false,
      error: 'Missing orderId',
    })
  }

  await processPaymentConfirmation(orderId, {
    transactionId: `mock-${Date.now()}`,
    status: status || 'COMPLETED',
    metadata: JSON.stringify(body),
  })

  return reply.send({success: true, data: {received: true}})
}

async function handleStripeWebhook(request: FastifyRequest, body: any, reply: FastifyReply) {
  const {type, data} = body

  if (type === 'checkout.session.completed') {
    const session = data.object
    const orderId = session.metadata.orderId

    await processPaymentConfirmation(orderId, {
      transactionId: session.id,
      status: 'COMPLETED',
      metadata: JSON.stringify(session),
    })
  }

  return reply.send({success: true, data: {received: true}})
}

async function handleVNPayWebhook(body: any, reply: FastifyReply) {
  const {vnp_TxnRef, vnp_ResponseCode} = body

  if (vnp_ResponseCode === '00') {
    await processPaymentConfirmation(vnp_TxnRef, {
      transactionId: body.vnp_TransactionNo,
      status: 'COMPLETED',
      metadata: JSON.stringify(body),
    })
  }

  return reply.send({success: true, data: {received: true}})
}

/**
 * Process payment confirmation (IDEMPOTENT)
 */
async function processPaymentConfirmation(
  orderId: string,
  paymentData: {transactionId: string; status: string; metadata: string}
) {
  await prisma.$transaction(
    async (tx: any) => {
      const order = await tx.order.findUnique({
        where: {id: orderId},
        include: {
          payment: true,
          orderItems: {include: {seat: true}},
          event: true,
        },
      })

      if (!order) throw new Error(`Order ${orderId} not found`)

      // Idempotency check
      if (order.payment?.webhookProcessed) {
        console.log(`Webhook already processed for order ${orderId}`)
        return
      }

      // Update payment
      await tx.payment.update({
        where: {orderId},
        data: {
          status: paymentData.status,
          transactionId: paymentData.transactionId,
          webhookReceived: true,
          webhookProcessed: true,
          webhookData: paymentData.metadata,
          paidAt: new Date(),
        },
      })

      // Update order
      await tx.order.update({
        where: {id: orderId},
        data: {status: 'PAID', paidAt: new Date()},
      })

      // Mark seats as SOLD
      const seatIds = order.orderItems
        .map((item: any) => item.seatId)
        .filter((id: any): id is string => id !== null)
      if (seatIds.length > 0) {
        await tx.seat.updateMany({
          where: {id: {in: seatIds}},
          data: {status: 'SOLD'},
        })
      }

      // Generate QR code
      const qrCodeUrl = await qrcodeService.generateTicketQRCode(order.orderNumber, order.eventId)

      // Generate new access token for ticket URL
      const {token: accessToken, hash: accessTokenHash} = generateAccessToken()
      console.log('[DEBUG] Generated accessToken:', accessToken)
      console.log('[DEBUG] Token length:', accessToken?.length || 0)
      console.log('[DEBUG] Token type:', typeof accessToken)
      const ticketUrl = qrcodeService.generateTicketUrl(order.orderNumber, accessToken)
      console.log('[DEBUG] Final ticketUrl:', ticketUrl)

      // Update order with access token hash for ticket verification
      await tx.order.update({
        where: {id: orderId},
        data: {accessTokenHash},
      })

      // Send email (fire and forget)
      const eventDate = new Date(order.event.eventDate)

      // Format seats for email template
      const seatsList = order.orderItems
        .map((item: any) => `${item.seatNumber} (${item.seatType})`)
        .join(', ')

      // Format date and time
      const formattedDate = eventDate.toLocaleDateString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      const formattedTime = eventDate.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })

      // Debug: Log ticketUrl to verify token is present
      console.log('[EMAIL] Sending ticket email with URL:', ticketUrl)
      console.log('[EMAIL] Access token length:', accessToken.length)
      console.log('[EMAIL] CODE VERSION: 2026-05-09-v2 - TOKEN GENERATION ACTIVE')

      sendEmailByPurpose({
        purpose: 'TICKET_CONFIRMED',
        businessEvent: 'PAYMENT_CONFIRMED',
        orderId: order.id,
        triggeredBy: 'SYSTEM',
        to: order.customerEmail,
        data: {
          customerName: order.customerName,
          eventName: order.event.name,
          eventDate: formattedDate,
          eventTime: formattedTime,
          eventVenue: order.event.venue,
          eventAddress: order.event.venue,
          orderNumber: order.orderNumber,
          seats: seatsList,  // String: "A1 (VIP), A2 (VIP)"
          totalAmount: Number(order.totalAmount),
          qrCodeUrl,
          ticketUrl,
        },
      }).catch((err) => console.error('Failed to send ticket email:', err))

      console.log(`✅ Payment confirmed for order ${orderId}`)
    },
    {timeout: 30000}
  )
}
