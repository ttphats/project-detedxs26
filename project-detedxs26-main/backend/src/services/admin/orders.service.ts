import {prisma} from '../../db/prisma.js'
import {randomBytes, createHash} from 'crypto'
import {generateTicketQRCode, generateTicketUrl} from '../qrcode.service.js'
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
        orderItems: {include: {seat: true}},
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
    seats: (order.orderItems || []).map((item: any) => ({
      seatNumber: item.seat?.seatNumber || item.seatNumber,
      seatType: item.seat?.seatType || item.seatType,
      section: item.seat?.section ?? '',
      row: item.seat?.row ?? '',
      price: Number(item.price),
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
      orderItems: {include: {seat: true}},
      payment: true,
    },
  })

  if (!order) return null

  return {
    ...order,
    seats: (order.orderItems || []).map((item: any) => ({
      seatNumber: item.seat?.seatNumber || item.seatNumber,
      seatType: item.seat?.seatType || item.seatType,
      section: item.seat?.section ?? '',
      row: item.seat?.row ?? '',
      price: Number(item.price),
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
          orderItems: {include: {seat: true}},
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

      // Mark seats as SOLD
      const seatIds = order.orderItems
        .map((item: any) => item.seatId)
        .filter((id: any): id is string => id !== null)
      if (seatIds.length > 0) {
        await tx.seat.updateMany({
          where: {id: {in: seatIds}},
          data: {status: 'SOLD'},
        })

        // Delete seat locks for these seats (they are now permanently SOLD)
        await tx.seatLock.deleteMany({
          where: {seatId: {in: seatIds}},
        })
        console.log(`[CONFIRM PAYMENT] Deleted ${seatIds.length} seat locks`)
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

      return {order, updatedOrder, accessToken, seatIds}
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
          orderItems: {include: {seat: true}},
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

      // Release seats back to AVAILABLE
      const seatIds = order.orderItems
        .map((item: any) => item.seatId)
        .filter((id: any): id is string => id !== null)
      if (seatIds.length > 0) {
        await tx.seat.updateMany({
          where: {id: {in: seatIds}},
          data: {status: 'AVAILABLE'},
        })
      }

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
            releasedSeats: seatIds.length,
            notes,
          }),
          ipAddress,
          userAgent,
        },
      })

      return {order, updatedOrder, releasedSeats: seatIds.length}
    },
    {timeout: 30000}
  )

  return result
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
      orderItems: {include: {seat: true}},
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

  // Format seats for email template (string format)
  const seatsList = order.orderItems
    .map(
      (item: any) =>
        `${item.seat?.seatNumber || item.seatNumber} (${item.seat?.seatType || item.seatType})`
    )
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
      seats: seatsList, // ✅ String: "A1 (VIP), A2 (Standard)"
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
): Promise<{orderNumber: string; releasedSeats: number}> {
  const order = await prisma.order.findUnique({
    where: {id: orderId},
    include: {
      orderItems: {include: {seat: true}},
      event: true,
    },
  })

  if (!order) {
    throw new Error('Order not found')
  }

  const seatIds = order.orderItems
    .map((item: any) => item.seatId)
    .filter((id: any) => id !== null) as string[]

  // Release seats back to AVAILABLE
  if (seatIds.length > 0) {
    await execute(
      `UPDATE seats
       SET status = 'AVAILABLE', updated_at = NOW()
       WHERE id IN (${seatIds.map(() => '?').join(',')})`,
      seatIds
    )
  }

  // Delete seat locks for this order
  if (seatIds.length > 0) {
    await execute(
      `DELETE FROM seat_locks
       WHERE event_id = ? AND seat_id IN (${seatIds.map(() => '?').join(',')})`,
      [order.eventId, ...seatIds]
    )
  }

  // Delete from Redis (correct key format)
  for (const seatId of seatIds) {
    await redis.del(`seat:${order.eventId}:${seatId}`)
  }

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
      releasedSeats: seatIds.length,
      eventId: order.eventId,
    },
    ipAddress,
    userAgent,
  })

  console.log(
    `[ADMIN DELETE ORDER] Deleted order ${order.orderNumber}, released ${seatIds.length} seats`
  )

  return {
    orderNumber: order.orderNumber,
    releasedSeats: seatIds.length,
  }
}
