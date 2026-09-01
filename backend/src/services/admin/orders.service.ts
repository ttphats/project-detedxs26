import {prisma} from '../../db/prisma.js'
import {randomBytes, createHash} from 'crypto'
import {generateTicketQRCode, generateTicketUrl} from '../qrcode.service.js'
import {
  loadTicketUnitsForOrder,
  sendTicketConfirmationEmails,
  type ConfirmationTicketUnit,
} from '../ticket-confirmation-email.service.js'
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

  const [orders, total, pending, paid, cancelled, revenueResult] = await Promise.all([
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
    // Full PAID total, not the current page — the admin "Doanh thu" card
    // used to sum only the 20 rows this endpoint returns.
    prisma.order.aggregate({
      _sum: {totalAmount: true},
      where: {...where, status: 'PAID'},
    }),
  ])

  // Resolve ticket type names via seats.ticket_type_id (no Prisma relation on Seat)
  const metaByOrderItemId = await loadTicketMetaForOrders(
    orders.map((o: any) => o.id),
  )

  const mappedOrders = orders.map((order: any) =>
    mapOrderForAdmin(order, metaByOrderItemId),
  )

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
      totalRevenue: Number(revenueResult._sum.totalAmount || 0),
    },
  }
}

export interface TicketMeta {
  typeName: string | null
  attendeeName: string | null
  attendeeEmail: string | null
  attendeePhone: string | null
}

/**
 * Per-ticket metadata that Prisma cannot supply: the attendee columns are not
 * in the Prisma model, and the ticket type is reached through the seat. Both
 * come from one raw query keyed by order_item id.
 */
async function loadTicketMetaForOrders(
  orderIds: string[],
): Promise<Map<string, TicketMeta>> {
  const map = new Map<string, TicketMeta>()
  if (!orderIds.length) return map
  try {
    const placeholders = orderIds.map(() => '?').join(',')
    const rows = await rawQuery<{
      order_item_id: string
      type_name: string | null
      attendee_name: string | null
      attendee_email: string | null
      attendee_phone: string | null
    }>(
      `SELECT oi.id AS order_item_id,
              COALESCE(tt.name, tt2.name) AS type_name,
              oi.attendee_name, oi.attendee_email, oi.attendee_phone
       FROM order_items oi
       LEFT JOIN seats s ON s.id = oi.seat_id
       LEFT JOIN ticket_types tt ON tt.id = s.ticket_type_id
       LEFT JOIN ticket_types tt2 ON tt2.id = oi.ticket_type_id
       WHERE oi.order_id IN (${placeholders})`,
      orderIds,
    )
    for (const r of rows) {
      map.set(r.order_item_id, {
        typeName: r.type_name,
        attendeeName: r.attendee_name,
        attendeeEmail: r.attendee_email,
        attendeePhone: r.attendee_phone,
      })
    }
  } catch (e) {
    console.warn('[ADMIN ORDERS] loadTicketMeta failed:', e)
  }
  return map
}

/**
 * Admin list/detail mapper — ticket inventory view (hide seat UI).
 */
function mapOrderForAdmin(
  order: any,
  metaByOrderItemId: Map<string, TicketMeta> = new Map(),
) {
  const items = order.orderItems || []
  const tickets = items.map((item: any, index: number) => {
    const meta = metaByOrderItemId.get(item.id)
    const typeName =
      meta?.typeName ||
      humanizeTypeName(item.seatType || item.seat?.seatType)
    return {
      id: item.id,
      index: index + 1,
      ticketCode: item.ticketCode || null,
      qrCodeUrl: item.qrCodeUrl || null,
      typeName,
      seatType: item.seatType || item.seat?.seatType || null,
      price: Number(item.price),
      checkedInAt: item.checkedInAt || null,
      checkedIn: !!item.checkedInAt,
      attendeeName: meta?.attendeeName || null,
      attendeeEmail: meta?.attendeeEmail || null,
      attendeePhone: meta?.attendeePhone || null,
    }
  })

  const lineMap = new Map<
    string,
    {name: string; unitPrice: number; quantity: number; lineTotal: number}
  >()
  for (const t of tickets) {
    const key = `${t.typeName}|${t.price}`
    const cur = lineMap.get(key)
    if (cur) {
      cur.quantity += 1
      cur.lineTotal += t.price
    } else {
      lineMap.set(key, {
        name: t.typeName,
        unitPrice: t.price,
        quantity: 1,
        lineTotal: t.price,
      })
    }
  }
  const ticketLines = Array.from(lineMap.values())
  const ticketSummary = ticketLines
    .map((l) => `${l.name} × ${l.quantity}`)
    .join(', ')

  return {
    ...order,
    tickets,
    ticketLines,
    ticketSummary,
    ticketCount: tickets.length,
    // Seat admin UI hidden — empty for legacy consumers
    seats: [],
    orderItems: undefined,
  }
}

function humanizeTypeName(seatType: string | null | undefined): string {
  const s = String(seatType || '').toUpperCase()
  if (!s) return 'Ticket'
  if (s.includes('VIP')) return 'VIP'
  if (s.includes('DONOR')) return 'Donor'
  if (s.includes('ECONOMY') || s.includes('EARLY')) return 'Early Bird'
  if (s.includes('STANDARD') || s.includes('LEVEL_2')) return 'Standard'
  if (s.startsWith('LEVEL_')) return s.replace('LEVEL_', 'Level ')
  return s
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
  const typeNames = await loadTicketMetaForOrders([id])
  return mapOrderForAdmin(order, typeNames)
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

      // Order-level QR (legacy display / wallet entry)
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

      // Per-ticket units (model B): unique TKT-xxx + QR each order_item
      try {
        const {ensureTicketUnitsForOrder} = await import('../../utils/ticket-unit.js')
        await ensureTicketUnitsForOrder(orderId)
        console.log('[CONFIRM PAYMENT] Per-ticket QR units ready')
      } catch (e) {
        console.error('[CONFIRM PAYMENT] ensureTicketUnitsForOrder failed:', e)
      }

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

      // Decrement promotion used count if applicable
      const orderPromo = await rawQuery<{promotion_id: string | null}>(
        'SELECT promotion_id FROM orders WHERE id = ?',
        [orderId]
      );
      const promotionId = orderPromo[0]?.promotion_id;
      if (promotionId) {
        await execute(
          'UPDATE promotions SET used_count = GREATEST(0, used_count - 1) WHERE id = ?',
          [promotionId]
        );
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
  adminUser: {userId: string; roleName: string},
  options?: {templateId?: string},
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

  // Ensure per-ticket units exist before email
  let ticketUnits: ConfirmationTicketUnit[] = []
  const {buildTicketLines, formatTicketLinesSummary} = await import(
    '../../utils/ticket-lines.js'
  )
  try {
    ticketUnits = await loadTicketUnitsForOrder(orderId)
  } catch (e) {
    console.error('[RESEND EMAIL] ticket units:', e)
  }

  const ticketLines = buildTicketLines(
    order.orderItems.map((item: any) => ({
      seatNumber: item.seat?.seatNumber || item.seatNumber,
      seatType: item.seat?.seatType || item.seatType,
      price: item.price,
      ticketTypeId: item.seat?.ticketTypeId || null,
      ticketTypeName: item.seat?.ticketType?.name || null,
    })),
  )
  const seatsList =
    ticketLines.length > 0
      ? formatTicketLinesSummary(ticketLines)
      : order.orderItems
          .map(
            (item: any) =>
              `${item.seat?.seatNumber || item.seatNumber} (${item.seat?.seatType || item.seatType})`,
          )
          .join(', ')

  // Resend goes to every ticket holder, not just the buyer — a resend is
  // usually triggered precisely because one holder did not get their ticket.
  // MUST use the admin-selected template.
  const sendResult = await sendTicketConfirmationEmails({
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      totalAmount: Number(order.totalAmount) || 0,
    },
    event: order.event,
    accessToken,
    ticketUnits,
    seatsSummary: seatsList,
    ticketLines,
    orderItemCount: order.orderItems.length,
    qrCodeUrl,
    templateId: options?.templateId,
    triggeredBy: adminUser.userId,
  })

  // Update email_sent_at
  if (sendResult.sent > 0) {
    await prisma.order.update({
      where: {id: orderId},
      data: {emailSentAt: new Date()},
    })
  }

  // Keep the single-result shape the controller expects: the resend counts as
  // successful when at least one holder was reached.
  const emailResult = {
    success: sendResult.sent > 0,
    error: sendResult.error || undefined,
  }

  return {order, emailResult, sendResult, ticketUrl}
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
