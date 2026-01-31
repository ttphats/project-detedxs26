import {NextRequest, NextResponse} from 'next/server'
import {z} from 'zod'
import {randomBytes, createHash} from 'crypto'
import {prisma} from '@/lib/prisma'
import {getAuthUser, requireAdmin} from '@/lib/auth'
import {sendEmailByPurpose, sendEmailByTemplate} from '@/lib/email/service'
import {BUSINESS_EVENTS} from '@/lib/email/types'
import {generateTicketQRCode} from '@/lib/qrcode'
import {
  successResponse,
  errorResponse,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '@/lib/utils'
import {getRequestInfo} from '@/lib/audit-logger'

/**
 * Generate access token for ticketless authentication
 * @returns Object with plain token and hashed token
 */
function generateAccessToken(): {token: string; hash: string} {
  const token = randomBytes(32).toString('hex') // 256-bit entropy
  const hash = createHash('sha256').update(token).digest('hex')
  return {token, hash}
}

/**
 * Generate ticket URL with access token
 */
function generateTicketUrl(orderNumber: string, token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_CLIENT_URL || 'http://localhost:3000'
  return `${baseUrl}/ticket/${orderNumber}?token=${token}`
}

const confirmPaymentSchema = z.object({
  transactionId: z.string().optional(),
  notes: z.string().optional(),
  templateId: z.string().optional(), // Optional: use specific template instead of default
})

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
export async function POST(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  try {
    const {id: orderId} = await params
    const authHeader = request.headers.get('authorization')
    const user = await getAuthUser(authHeader)

    if (!user) {
      throw new UnauthorizedError()
    }

    // Check if user is admin
    try {
      requireAdmin(user)
    } catch {
      throw new ForbiddenError()
    }

    // Parse input
    const body = await request.json()
    const input = confirmPaymentSchema.parse(body)

    // Process payment confirmation in transaction
    // Increase timeout to 30 seconds for remote database with high latency
    const result = await prisma.$transaction(async (tx) => {
      // Get order with all relations
      const order = await tx.order.findUnique({
        where: {id: orderId},
        include: {
          event: true,
          orderItems: {
            select: {
              id: true,
              seatId: true,
              seatNumber: true,
              seatType: true,
              price: true,
            },
          },
          payment: true,
        },
      })

      if (!order) {
        throw new NotFoundError('Order not found')
      }

      // Check if order is already paid
      if (order.status === 'PAID') {
        throw new ConflictError('Order is already paid')
      }

      // Check if order is cancelled or expired
      if (order.status === 'CANCELLED' || order.status === 'EXPIRED') {
        throw new ConflictError(`Cannot confirm payment for ${order.status.toLowerCase()} order`)
      }

      // Only allow confirmation for PENDING or PENDING_CONFIRMATION orders
      if (order.status !== 'PENDING' && order.status !== 'PENDING_CONFIRMATION') {
        throw new ConflictError(`Cannot confirm order with status ${order.status}`)
      }

      // Update order status
      const updatedOrder = await tx.order.update({
        where: {id: orderId},
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      })

      // Update or create payment record (upsert)
      await tx.payment.upsert({
        where: {orderId},
        update: {
          status: 'COMPLETED',
          transactionId: input.transactionId || `MANUAL-${Date.now()}`,
          paidAt: new Date(),
          metadata: JSON.stringify({
            confirmedBy: user.userId,
            confirmedAt: new Date().toISOString(),
            notes: input.notes,
          }),
        },
        create: {
          orderId,
          paymentMethod: 'BANK_TRANSFER',
          status: 'COMPLETED',
          amount: order.totalAmount,
          transactionId: input.transactionId || `MANUAL-${Date.now()}`,
          paidAt: new Date(),
          metadata: JSON.stringify({
            confirmedBy: user.userId,
            confirmedAt: new Date().toISOString(),
            notes: input.notes,
            createdByAdmin: true,
          }),
        },
      })

      // Mark all seats as SOLD
      const seatIds = order.orderItems.map((item) => item.seatId)
      await tx.seat.updateMany({
        where: {id: {in: seatIds}},
        data: {status: 'SOLD'},
      })

      // Update event available seats
      await tx.event.update({
        where: {id: order.eventId},
        data: {
          availableSeats: {
            decrement: seatIds.length,
          },
        },
      })

      // Get request info with device parsing
      const reqInfo = getRequestInfo(request)

      // Create audit log with new format (inside transaction)
      await tx.auditLog.create({
        data: {
          userId: user.userId,
          userRole: user.roleName,
          action: 'CONFIRM',
          entity: 'PAYMENT',
          entityId: orderId,
          oldValue: JSON.stringify({
            orderStatus: order.status,
            paymentStatus: order.payment?.status,
            seatStatus: 'RESERVED',
          }),
          newValue: JSON.stringify({
            orderStatus: 'PAID',
            paymentStatus: 'COMPLETED',
            seatStatus: 'SOLD',
            transactionId: input.transactionId,
          }),
          metadata: JSON.stringify({
            orderNumber: order.orderNumber,
            customerEmail: order.customerEmail,
            totalAmount: Number(order.totalAmount),
            seatCount: seatIds.length,
            notes: input.notes,
            device: reqInfo.device,
          }),
          ipAddress: reqInfo.ipAddress,
          userAgent: reqInfo.userAgent,
        },
      })

      return {order, updatedOrder}
    }, {
      timeout: 30000, // 30 seconds timeout for remote database
    })

    // Generate QR code (outside transaction)
    const qrCodeUrl = await generateTicketQRCode(result.order.orderNumber, result.order.eventId)

    // Generate access token for ticket URL (if not exists)
    // This allows user to access ticket via email link
    let ticketUrl: string
    const {token: accessToken, hash: accessTokenHash} = generateAccessToken()

    // Store QR code URL and access token hash in order
    await prisma.order.update({
      where: {id: result.order.id},
      data: {
        qrCodeUrl,
        accessTokenHash, // Store new token hash (overwrites old if exists)
      },
    })

    // Generate ticket URL with the new token
    ticketUrl = generateTicketUrl(result.order.orderNumber, accessToken)

    // Format event date for Vietnamese locale
    const eventDate = new Date(result.order.event.eventDate)
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

    // Prepare email data
    const emailData = {
      customerName: result.order.customerName,
      eventName: result.order.event.name,
      eventDate: formattedDate,
      eventTime: formattedTime,
      eventVenue: result.order.event.venue,
      orderNumber: result.order.orderNumber,
      seats: result.order.orderItems.map((item) => ({
        seatNumber: item.seatNumber,
        seatType: item.seatType,
        price: Number(item.price),
      })),
      totalAmount: Number(result.order.totalAmount),
      seatInfo: result.order.orderItems
        .map((item) => `${item.seatNumber} (${item.seatType})`)
        .join(', '),
      qrCodeUrl,
      ticketUrl,
      orderStatus: 'PAID',
    }

    // NO SPAM FLOW: Send email via template or purpose
    // If templateId is provided, use that template; otherwise use default purpose
    const emailPromise = input.templateId
      ? sendEmailByTemplate({
          templateId: input.templateId,
          businessEvent: BUSINESS_EVENTS.PAYMENT_CONFIRMED,
          orderId: result.order.id,
          triggeredBy: user.userId,
          to: result.order.customerEmail,
          data: emailData,
          metadata: {
            seatsCount: result.order.orderItems.length,
            confirmedBy: user.userId,
            templateId: input.templateId,
          },
        })
      : sendEmailByPurpose({
          purpose: 'TICKET_CONFIRMED',
          businessEvent: BUSINESS_EVENTS.PAYMENT_CONFIRMED,
          orderId: result.order.id,
          triggeredBy: user.userId,
          to: result.order.customerEmail,
          data: emailData,
          metadata: {
            seatsCount: result.order.orderItems.length,
            confirmedBy: user.userId,
          },
        })

    emailPromise
      .then(async (emailResult) => {
        if (emailResult.success) {
          // Update email_sent_at after successful email send
          await prisma.order.update({
            where: {id: result.order.id},
            data: {emailSentAt: new Date()},
          })
          console.log(
            `✅ Ticket email sent to ${result.order.customerEmail} at ${new Date().toISOString()}`
          )
          console.log(`📧 Ticket URL: ${ticketUrl}`)
        } else if (emailResult.skipped) {
          console.log(`⏭️ Email skipped (anti-spam): ${emailResult.error}`)
        } else {
          console.error(`❌ Failed to send email: ${emailResult.error}`)
        }
      })
      .catch((err) => {
        console.error('❌ Failed to send ticket email:', err)
      })

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
    )
  } catch (error: any) {
    console.error('Confirm payment error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(errorResponse(error.errors[0].message), {status: 400})
    }

    if (error instanceof UnauthorizedError) {
      return NextResponse.json(errorResponse(error.message), {status: 401})
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json(errorResponse(error.message), {status: 403})
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json(errorResponse(error.message), {status: 404})
    }

    if (error instanceof ConflictError) {
      return NextResponse.json(errorResponse(error.message), {status: 409})
    }

    return NextResponse.json(errorResponse('Failed to confirm payment'), {status: 500})
  }
}
