import {prisma} from '../../db/prisma.js'
import {randomBytes, createHash} from 'crypto'
import {
  generateTicketQRCode,
  generateTicketUrl,
  generateAttendeeTicketQRCode,
} from '../qrcode.service.js'
import {sendEmailByPurpose} from '../email.service.js'
import {createAuditLog} from '../audit.service.js'
import {execute, query as rawQuery} from '../../db/mysql.js'
import {redis} from '../../db/redis.js'

export interface ListOrdersInput {
  page?: number
  limit?: number
  status?: string
  eventId?: string
  search?: string
}

/**
 * List orders with pagination and filters
 */
export async function listOrders(input: ListOrdersInput) {
  const page = Number(input.page) || 1
  const limit = Number(input.limit) || 20
  const skip = (page - 1) * limit

  const where: any = {}

  if (input.status) where.status = input.status
  if (input.eventId) where.eventId = input.eventId

  if (input.search) {
    where.OR = [
      {orderNumber: {contains: input.search}},
      {customerName: {contains: input.search}},
      {customerEmail: {contains: input.search}},
      {customerPhone: {contains: input.search}},
    ]
  }

  const [orders, total, pending, paid, cancelled] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        event: {select: {id: true, name: true, eventDate: true, venue: true}},
        orderItems: true,
        payment: true,
      },
      orderBy: {createdAt: 'desc'},
      skip,
      take: limit,
    }),
    prisma.order.count({where}),
    prisma.order.count({where: {...where, status: 'PENDING'}}),
    prisma.order.count({where: {...where, status: 'PAID'}}),
    prisma.order.count({where: {...where, status: 'CANCELLED'}}),
  ])

  const mappedOrders = orders.map((order: any) => ({
    ...order,
    tickets: (order.orderItems || []).map((item: any) => ({
      id: item.id,
      ticketTypeId: item.ticketTypeId ?? null,
      ticketTypeName: item.ticketTypeName ?? null,
      price: Number(item.price),
      attendeeName: item.attendeeName ?? null,
      attendeeEmail: item.attendeeEmail ?? null,
      attendeePhone: item.attendeePhone ?? null,
      ticketCode: item.ticketCode ?? null,
      checkedInAt: item.checkedInAt ?? null,
    })),
  }))

  return {
    orders: mappedOrders,
    pagination: {page, limit, total, totalPages: Math.ceil(total / limit)},
    summary: {
      totalOrders: total,
      pendingOrders: pending,
      paidOrders: paid,
      cancelledOrders: cancelled,
      pending,
      paid,
      cancelled,
    },
  }
}

/**
 * Get order by ID
 */
export async function getOrderById(id: string) {
  const order = await prisma.order.findUnique({
    where: {id},
    include: {
      event: true,
      orderItems: true,
      payment: true,
    },
  })

  if (!order) return null

  return {
    ...order,
    tickets: (order.orderItems || []).map((item: any) => ({
      id: item.id,
      ticketTypeId: item.ticketTypeId ?? null,
      ticketTypeName: item.ticketTypeName ?? null,
      price: Number(item.price),
      attendeeName: item.attendeeName ?? null,
      attendeeEmail: item.attendeeEmail ?? null,
      attendeePhone: item.attendeePhone ?? null,
      ticketCode: item.ticketCode ?? null,
      checkedInAt: item.checkedInAt ?? null,
    })),
  }
}

/**
 * Generate access token
 */
function generateAccessToken(): {token: string; hash: string} {
  const token = randomBytes(32).toString('hex')
  const hash = createHash('sha256').update(token).digest('hex')
  return {token, hash}
}

/**
 * Confirm payment (admin action)
 */
export async function confirmPayment(
  orderId: string,
  adminUser: {userId: string; roleName: string},
  ipAddress?: string,
  userAgent?: string
) {
  const result = await prisma.$transaction(
    async (tx: any) => {
      const order = await tx.order.findUnique({
        where: {id: orderId},
        include: {
          event: true,
          orderItems: true,
          payment: true,
        },
      })

      if (!order) throw new Error('Order not found')
      if (order.status === 'PAID') throw new Error('Order already paid')
      if (order.status === 'CANCELLED') throw new Error('Order is cancelled')
      if (order.status === 'EXPIRED') throw new Error('Order has expired')

      // ⚠️ Use existing plaintext token if available, otherwise generate new one
      let accessToken: string
      let accessTokenHash: string

      if (order.accessToken) {
        // Reuse existing plaintext token
        accessToken = order.accessToken
        accessTokenHash = order.accessTokenHash!
        console.log('[CONFIRM PAYMENT] Reusing existing plaintext token')
      } else {
        // Generate new token (old orders or webhook payments)
        const generated = generateAccessToken()
        accessToken = generated.token
        accessTokenHash = generated.hash
        console.log('[CONFIRM PAYMENT] Generated new access token')
      }

      // Generate QR code
      const qrCodeUrl = await generateTicketQRCode(order.orderNumber, order.eventId)

      // Update order to PAID
      const updatedOrder = await tx.order.update({
        where: {id: orderId},
        data: {
          status: 'PAID',
          paidAt: new Date(),
          accessTokenHash,
          accessToken, // Save plaintext for future email sends
          qrCodeUrl,
        },
      })

      // Update payment
      if (order.payment) {
        await tx.payment.update({
          where: {orderId},
          data: {
            status: 'COMPLETED',
            paidAt: new Date(),
          },
        })
      } else {
        await tx.payment.create({
          data: {
            orderId,
            amount: order.totalAmount,
            paymentMethod: 'BANK_TRANSFER',
            status: 'COMPLETED',
            paidAt: new Date(),
          },
        })
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: adminUser.userId,
          userRole: adminUser.roleName,
          action: 'CONFIRM',
          entity: 'PAYMENT',
          entityId: orderId,
          oldValue: JSON.stringify({status: order.status}),
          newValue: JSON.stringify({status: 'PAID'}),
          metadata: JSON.stringify({
            orderNumber: order.orderNumber,
            amount: Number(order.totalAmount),
          }),
          ipAddress,
          userAgent,
        },
      })

      return {order, updatedOrder, accessToken}
    },
    {timeout: 30000}
  )

  return result
}

/**
 * Reject payment (admin action)
 */
export async function rejectPayment(
  orderId: string,
  reason: string,
  adminUser: {userId: string; roleName: string},
  notes?: string,
  ipAddress?: string,
  userAgent?: string
) {
  const result = await prisma.$transaction(
    async (tx: any) => {
      const order = await tx.order.findUnique({
        where: {id: orderId},
        include: {
          event: true,
          orderItems: true,
          payment: true,
        },
      })

      if (!order) throw new Error('Order not found')
      if (order.status === 'PAID') throw new Error('Cannot reject paid order')
      if (order.status === 'CANCELLED') throw new Error('Order already cancelled')
      if (order.status === 'EXPIRED') throw new Error('Order has expired')

      // Update order to CANCELLED
      const updatedOrder = await tx.order.update({
        where: {id: orderId},
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      })

      // Update payment to FAILED
      if (order.payment) {
        await tx.payment.update({
          where: {orderId},
          data: {
            status: 'FAILED',
            metadata: JSON.stringify({
              rejectedBy: adminUser.userId,
              rejectedAt: new Date().toISOString(),
              reason,
              notes,
            }),
          },
        })
      }

      // Nothing to release: a CANCELLED order stops counting against the
      // ticket type's max_quantity, which frees the stock automatically.

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: adminUser.userId,
          userRole: adminUser.roleName,
          action: 'REJECT',
          entity: 'PAYMENT',
          entityId: orderId,
          oldValue: JSON.stringify({status: order.status}),
          newValue: JSON.stringify({status: 'CANCELLED', reason}),
          metadata: JSON.stringify({
            orderNumber: order.orderNumber,
            notes,
          }),
          ipAddress,
          userAgent,
        },
      })

      return {order, updatedOrder}
    },
    {timeout: 30000}
  )

  return result
}

export interface AttendeeEmailOutcome {
  orderItemId: string
  ticketCode: string | null
  /** Who the ticket was actually sent to. */
  email: string
  attendeeName: string | null
  /** True when the attendee had no email of their own and the buyer got it. */
  fellBackToBuyer: boolean
  status: 'SENT' | 'FAILED'
  error?: string
}

/**
 * Send one ticket email per attendee, each carrying only that person's
 * ticket and its own QR code.
 *
 * Every ticket in an order belongs to a specific attendee, so a single
 * email to the buyer isn't enough — each attendee needs their own. Where
 * an attendee has no email recorded (older orders, or a buyer who didn't
 * fill the details in), their ticket falls back to the buyer's address so
 * no ticket is silently dropped.
 */
export async function sendAttendeeTicketEmails(params: {
  orderId: string
  triggeredBy: string
}): Promise<AttendeeEmailOutcome[]> {
  const {orderId, triggeredBy} = params

  const order = await prisma.order.findUnique({
    where: {id: orderId},
    include: {event: true, orderItems: true},
  })
  if (!order) throw new Error('Order not found')

  const eventDate = new Date(order.event.eventDate)
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

  const accessToken = order.accessToken || ''
  const ticketUrl = accessToken ? generateTicketUrl(order.orderNumber, accessToken) : ''

  const outcomes: AttendeeEmailOutcome[] = []

  for (const item of order.orderItems as any[]) {
    // Each ticket needs a stable code: it identifies the ticket at check-in
    // and makes each QR unique.
    let ticketCode: string = item.ticketCode
    if (!ticketCode) {
      ticketCode = randomBytes(8).toString('hex').toUpperCase()
      await prisma.orderItem.update({
        where: {id: item.id},
        data: {ticketCode},
      })
    }

    const recipient = item.attendeeEmail?.trim() || order.customerEmail
    const fellBackToBuyer = !item.attendeeEmail?.trim()

    if (!recipient) {
      outcomes.push({
        orderItemId: item.id,
        ticketCode,
        email: '',
        attendeeName: item.attendeeName ?? null,
        fellBackToBuyer,
        status: 'FAILED',
        error: 'No email address available for this ticket',
      })
      continue
    }

    try {
      const attendeeQrCodeUrl = await generateAttendeeTicketQRCode(order.orderNumber, ticketCode)

      await prisma.orderItem.update({
        where: {id: item.id},
        data: {qrCodeUrl: attendeeQrCodeUrl},
      })

      const emailResult = await sendEmailByPurpose({
        purpose: 'TICKET_CONFIRMED',
        to: recipient,
        orderId: order.id,
        triggeredBy,
        // One order legitimately produces several sends here, so the
        // per-order anti-spam guard has to be bypassed.
        allowDuplicate: true,
        data: {
          customerName: item.attendeeName || order.customerName,
          eventName: order.event.name,
          eventDate: formattedDate,
          eventTime: formattedTime,
          eventVenue: order.event.venue,
          eventAddress: order.event.venue,
          orderNumber: order.orderNumber,
          tickets: item.ticketTypeName || '',
          totalAmount: Number(item.price),
          qrCodeUrl: attendeeQrCodeUrl,
          ticketUrl,
        },
      })

      outcomes.push({
        orderItemId: item.id,
        ticketCode,
        email: recipient,
        attendeeName: item.attendeeName ?? null,
        fellBackToBuyer,
        status: emailResult.success ? 'SENT' : 'FAILED',
        error: emailResult.success ? undefined : emailResult.error || 'Unknown error',
      })
    } catch (err: any) {
      outcomes.push({
        orderItemId: item.id,
        ticketCode,
        email: recipient,
        attendeeName: item.attendeeName ?? null,
        fellBackToBuyer,
        status: 'FAILED',
        error: err?.message || 'Unknown error',
      })
    }
  }

  return outcomes
}

/**
 * Resend ticket email for PAID order
 */
export async function resendTicketEmail(
  orderId: string,
  adminUser: {userId: string; roleName: string}
) {
  const order = await prisma.order.findUnique({
    where: {id: orderId},
    include: {
      event: true,
      orderItems: true,
    },
  })

  if (!order) throw new Error('Order not found')
  if (order.status !== 'PAID') throw new Error('Can only resend email for PAID orders')

  // ⚠️ Use existing plaintext token if available, otherwise generate new one
  let accessToken: string
  let accessTokenHash: string

  if (order.accessToken) {
    // Reuse existing plaintext token - this keeps ticket URL valid!
    accessToken = order.accessToken
    accessTokenHash = order.accessTokenHash!
    console.log(`[RESEND EMAIL] Reusing existing plaintext token for order ${order.orderNumber}`)
  } else {
    // Generate new token (for old orders that don't have plaintext saved)
    const generated = generateAccessToken()
    accessToken = generated.token
    accessTokenHash = generated.hash
    console.log(`[RESEND EMAIL] Generated new access token for order ${order.orderNumber}`)

    // Update order with new access token
    await prisma.order.update({
      where: {id: orderId},
      data: {accessTokenHash, accessToken},
    })
  }

  // Generate QR code and ticket URL
  const qrCodeUrl = await generateTicketQRCode(order.orderNumber, order.eventId)
  const ticketUrl = generateTicketUrl(order.orderNumber, accessToken)

  // Format date
  const eventDate = new Date(order.event.eventDate)
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

  // Format tickets for the email template (string format). Seating is
  // arranged by the organisers after purchase, so a ticket is identified
  // by its type rather than a seat number.
  const ticketsList = order.orderItems
    .map((item: any) => item.ticketTypeName || '')
    .filter(Boolean)
    .join(', ')

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
      eventAddress: order.event.venue,
      orderNumber: order.orderNumber,
      tickets: ticketsList, // e.g. "VIP, Standard, Standard"
      totalAmount: Number(order.totalAmount),
      qrCodeUrl,
      ticketUrl,
    },
  })

  // Update email_sent_at
  if (emailResult.success) {
    await prisma.order.update({
      where: {id: orderId},
      data: {emailSentAt: new Date()},
    })
  }

  return {order, emailResult}
}

/**
 * Delete order completely (admin action)
 */
export async function deleteOrder(
  orderId: string,
  adminUser: {userId: string; roleName: string},
  ipAddress?: string,
  userAgent?: string
): Promise<{orderNumber: string; ticketCount: number}> {
  const order = await prisma.order.findUnique({
    where: {id: orderId},
    include: {
      orderItems: true,
      event: true,
    },
  })

  if (!order) {
    throw new Error('Order not found')
  }

  const ticketCount = order.orderItems.length

  // Deleting the order is enough to free its stock: only live orders count
  // against a ticket type's max_quantity.

  // Delete order items first (foreign key constraint)
  await prisma.orderItem.deleteMany({where: {orderId}})

  // Delete payment record if exists
  await prisma.payment.deleteMany({where: {orderId}})

  // Delete the order itself
  await prisma.order.delete({where: {id: orderId}})

  // Create audit log
  await createAuditLog({
    userId: adminUser.userId,
    userRole: adminUser.roleName,
    action: 'DELETE',
    entity: 'ORDER',
    entityId: orderId,
    metadata: {
      orderNumber: order.orderNumber,
      status: order.status,
      customerEmail: order.customerEmail,
      ticketCount,
      eventId: order.eventId,
    },
    ipAddress,
    userAgent,
  })

  console.log(
    `[ADMIN DELETE ORDER] Deleted order ${order.orderNumber} (${ticketCount} ticket(s))`
  )

  return {
    orderNumber: order.orderNumber,
    ticketCount,
  }
}
