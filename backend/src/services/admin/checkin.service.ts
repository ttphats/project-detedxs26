import {prisma} from '../../db/prisma.js'
import {NotFoundError, BadRequestError} from '../../utils/errors.js'
import {execute, query, queryOne} from '../../db/mysql.js'
import {
  ensureOrderItemTicketColumns,
  ensureTicketUnitsForOrder,
} from '../../utils/ticket-unit.js'
import {buildTicketLines, humanizeSeatType} from '../../utils/ticket-lines.js'
import {createAuditLog} from '../audit.service.js'

/** Who performed a scan, for the audit trail. */
export interface CheckInActor {
  userId: string
  roleName?: string
  ipAddress?: string
  userAgent?: string
}

/**
 * Record a scan in the audit log.
 *
 * Check-in previously left no trace beyond `order_items.checked_in_at`, so
 * there was no way to see who admitted whom, when, or from which device —
 * and nothing at all for a scan of an already-used or invalid ticket.
 * Failures are logged too, since a burst of them at the door is exactly what
 * an organiser needs to see.
 */
async function logScan(
  actor: CheckInActor,
  outcome: 'CHECK_IN' | 'CHECK_IN_FAILED',
  metadata: Record<string, unknown>,
  entityId?: string,
) {
  await createAuditLog({
    userId: actor.userId,
    userRole: actor.roleName || 'STAFF',
    action: outcome,
    entity: 'TICKET',
    entityId,
    metadata,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  })
}

function normalizeScanInput(raw: string): {kind: 'TICKET'; ticketCode: string} | {kind: 'ORDER'; orderNumber: string} {
  const s = String(raw || '').trim()
  const fromUrl = s.match(/TKT-[A-F0-9]+/i)
  if (s.toUpperCase().startsWith('TKT-') || fromUrl) {
    const code = (fromUrl ? fromUrl[0] : s).toUpperCase()
    return {kind: 'TICKET', ticketCode: code}
  }
  return {kind: 'ORDER', orderNumber: s.toUpperCase()}
}

export async function checkIn(scanValue: string, actor: CheckInActor) {
  await ensureOrderItemTicketColumns()
  const target = normalizeScanInput(scanValue)
  try {
    if (target.kind === 'TICKET') return await checkInTicketUnit(target.ticketCode, actor)
    return await checkInOrderLegacy(target.orderNumber, actor)
  } catch (err: any) {
    // A rejected scan is the interesting one at the door — a duplicate, an
    // unpaid order, an unknown code — so it goes into the log as well.
    await logScan(actor, 'CHECK_IN_FAILED', {
      scanValue,
      mode: target.kind,
      reason: err?.message || 'Unknown error',
    })
    throw err
  }
}

// keep export name used by controller
export async function checkInOrder(orderNumber: string, actor: CheckInActor) {
  return checkIn(orderNumber, actor)
}

async function checkInTicketUnit(ticketCode: string, actor: CheckInActor) {
  const adminUserId = actor.userId
  const row = await queryOne<{
    id: string
    order_id: string
    ticket_code: string
    checked_in_at: Date | null
    seat_number: string
    seat_type: string
    price: number
    order_number: string
    order_status: string
    customer_name: string
    customer_email: string
    customer_phone: string | null
    event_name: string
    event_venue: string
    event_date: Date
    ticket_type_name: string | null
  }>(
    `SELECT oi.id, oi.order_id, oi.ticket_code, oi.checked_in_at, oi.seat_number, oi.seat_type, oi.price,
            o.order_number, o.status AS order_status, o.customer_name, o.customer_email, o.customer_phone,
            e.name AS event_name, e.venue AS event_venue, e.event_date AS event_date,
            tt.name AS ticket_type_name
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN events e ON e.id = o.event_id
     LEFT JOIN seats s ON s.id = oi.seat_id
     LEFT JOIN ticket_types tt ON tt.id = s.ticket_type_id
     WHERE oi.ticket_code = ?
     LIMIT 1`,
    [ticketCode],
  )

  if (!row) throw new NotFoundError(`Ticket ${ticketCode} not found`)
  if (row.order_status !== 'PAID') {
    throw new BadRequestError(`Cannot check in: order ${row.order_number} status is ${row.order_status}`)
  }
  if (row.checked_in_at) {
    throw new BadRequestError(`Ticket already checked in at ${new Date(row.checked_in_at).toLocaleString('vi-VN')}`)
  }

  await execute(
    `UPDATE order_items SET checked_in_at = NOW(), checked_in_by = ? WHERE id = ? AND checked_in_at IS NULL`,
    [adminUserId, row.id],
  )
  await syncOrderCheckedIn(row.order_id, adminUserId)

  const typeName = (row.ticket_type_name && String(row.ticket_type_name).trim()) || humanizeSeatType(row.seat_type)
  const progress = await getOrderTicketProgress(row.order_id)

  await logScan(
    actor,
    'CHECK_IN',
    {
      mode: 'TICKET',
      ticketCode: row.ticket_code,
      orderNumber: row.order_number,
      customerName: row.customer_name,
      typeName,
      seatNumber: row.seat_number,
      eventName: row.event_name,
    },
    row.id,
  )

  return {
    success: true,
    mode: 'TICKET' as const,
    message: 'Check-in successful',
    order: {
      orderNumber: row.order_number,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      totalAmount: Number(row.price),
      seatNumbers: [row.seat_number],
      ticketCode: row.ticket_code,
      typeName,
      checkedInAt: new Date(),
      event: {name: row.event_name, venue: row.event_venue, eventDate: row.event_date},
      progress,
    },
  }
}

async function checkInOrderLegacy(orderNumber: string, actor: CheckInActor) {
  const adminUserId = actor.userId
  const order = await prisma.order.findUnique({
    where: {orderNumber},
    include: {event: true, orderItems: true},
  })
  if (!order) throw new NotFoundError('Order not found')
  if (order.status !== 'PAID') {
    throw new BadRequestError(`Cannot check in order with status: ${order.status}. Only PAID orders can be checked in.`)
  }

  await ensureTicketUnitsForOrder(order.id)
  const pending = await query<{id: string; ticket_code: string}>(
    `SELECT id, ticket_code FROM order_items WHERE order_id = ? AND checked_in_at IS NULL`,
    [order.id],
  )
  if (pending.length === 0) throw new BadRequestError('All tickets in this order are already checked in')

  await execute(
    `UPDATE order_items SET checked_in_at = NOW(), checked_in_by = ? WHERE order_id = ? AND checked_in_at IS NULL`,
    [adminUserId, order.id],
  )
  await syncOrderCheckedIn(order.id, adminUserId)
  const progress = await getOrderTicketProgress(order.id)

  await logScan(
    actor,
    'CHECK_IN',
    {
      mode: 'ORDER',
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      ticketsCheckedIn: pending.map((p) => p.ticket_code),
      count: pending.length,
      eventName: order.event.name,
    },
    order.id,
  )

  return {
    success: true,
    mode: 'ORDER' as const,
    message: `Checked in ${pending.length} ticket(s)`,
    order: {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      totalAmount: parseFloat(order.totalAmount.toString()),
      seatNumbers: order.orderItems.map((i: any) => i.seatNumber),
      ticketsCheckedIn: pending.map((p) => p.ticket_code),
      checkedInAt: new Date(),
      event: {name: order.event.name, venue: order.event.venue, eventDate: order.event.eventDate},
      progress,
    },
  }
}

async function syncOrderCheckedIn(orderId: string, adminUserId: string) {
  const prog = await getOrderTicketProgress(orderId)
  if (prog.total > 0 && prog.pending === 0) {
    await prisma.order.update({
      where: {id: orderId},
      data: {checkedInAt: new Date(), checkedInBy: adminUserId},
    })
  }
}

export async function getOrderTicketProgress(orderId: string) {
  const items = await query<{
    seat_number: string
    seat_type: string
    price: number
    checked_in_at: Date | null
    ticket_type_name: string | null
    ticket_type_id: string | null
  }>(
    `SELECT oi.seat_number, oi.seat_type, oi.price, oi.checked_in_at,
            s.ticket_type_id AS ticket_type_id, tt.name AS ticket_type_name
     FROM order_items oi
     LEFT JOIN seats s ON s.id = oi.seat_id
     LEFT JOIN ticket_types tt ON tt.id = s.ticket_type_id
     WHERE oi.order_id = ?`,
    [orderId],
  )
  const total = items.length
  const checkedIn = items.filter((i) => i.checked_in_at).length
  const ticketLines = buildTicketLines(
    items.map((i) => ({
      seatNumber: i.seat_number,
      seatType: i.seat_type,
      price: i.price,
      ticketTypeId: i.ticket_type_id,
      ticketTypeName: i.ticket_type_name,
    })),
  )
  return {total, checkedIn, pending: total - checkedIn, ticketLines}
}

export async function getCheckInStatus(orderNumber: string) {
  await ensureOrderItemTicketColumns()
  const order = await prisma.order.findUnique({
    where: {orderNumber},
    include: {
      event: true,
      orderItems: true,
      checkedInByUser: {select: {fullName: true, username: true}},
    },
  })
  if (!order) throw new NotFoundError('Order not found')
  if (order.status === 'PAID') await ensureTicketUnitsForOrder(order.id)

  const units = await query<{
    ticket_code: string | null
    qr_code_url: string | null
    checked_in_at: Date | null
    seat_number: string
    seat_type: string
    price: number
    ticket_type_name: string | null
  }>(
    `SELECT oi.ticket_code, oi.qr_code_url, oi.checked_in_at, oi.seat_number, oi.seat_type, oi.price,
            tt.name AS ticket_type_name
     FROM order_items oi
     LEFT JOIN seats s ON s.id = oi.seat_id
     LEFT JOIN ticket_types tt ON tt.id = s.ticket_type_id
     WHERE oi.order_id = ?
     ORDER BY oi.created_at ASC`,
    [order.id],
  )
  const progress = await getOrderTicketProgress(order.id)
  return {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    status: order.status,
    checkedIn: progress.pending === 0 && progress.total > 0,
    checkedInAt: order.checkedInAt,
    checkedInBy: order.checkedInByUser
      ? {fullName: order.checkedInByUser.fullName, username: order.checkedInByUser.username}
      : null,
    progress,
    tickets: units.map((u) => ({
      ticketCode: u.ticket_code,
      qrCodeUrl: u.qr_code_url,
      typeName: (u.ticket_type_name && String(u.ticket_type_name).trim()) || humanizeSeatType(u.seat_type),
      seatNumber: u.seat_number,
      price: Number(u.price),
      checkedIn: !!u.checked_in_at,
      checkedInAt: u.checked_in_at,
    })),
    seatNumbers: units.map((u) => u.seat_number),
    event: {name: order.event.name, venue: order.event.venue, eventDate: order.event.eventDate},
  }
}

export async function getCheckInStats(eventId: string) {
  await ensureOrderItemTicketColumns()
  const [ordersTotal, ordersCheckedIn, pax] = await Promise.all([
    prisma.order.count({where: {eventId, status: 'PAID'}}),
    prisma.order.count({where: {eventId, status: 'PAID', checkedInAt: {not: null}}}),
    queryOne<{total: number; checked_in: number}>(
      `SELECT COUNT(oi.id) AS total,
              SUM(CASE WHEN oi.checked_in_at IS NOT NULL THEN 1 ELSE 0 END) AS checked_in
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.event_id = ? AND o.status = 'PAID'`,
      [eventId],
    ),
  ])
  const paxTotal = Number(pax?.total || 0)
  const paxIn = Number(pax?.checked_in || 0)
  return {
    total: ordersTotal,
    checkedIn: ordersCheckedIn,
    pending: ordersTotal - ordersCheckedIn,
    percentage: ordersTotal > 0 ? Math.round((ordersCheckedIn / ordersTotal) * 100) : 0,
    pax: {
      total: paxTotal,
      checkedIn: paxIn,
      pending: paxTotal - paxIn,
      percentage: paxTotal > 0 ? Math.round((paxIn / paxTotal) * 100) : 0,
    },
  }
}

/**
 * Every ticket admitted for an event, most recent first.
 *
 * Keyed on the ticket rather than the order: `orders.checked_in_at` is only
 * stamped once every ticket on an order is in, so an order-level query hides
 * a group that has half arrived. Ticket type is resolved through the seat and
 * through `order_items.ticket_type_id`, so both booking flows are named, and
 * the attendee is shown where one was captured at checkout.
 */
export async function getCheckedInList(eventId: string, limit = 500) {
  await ensureOrderItemTicketColumns()
  const rows = await query<{
    id: string
    ticket_code: string | null
    checked_in_at: Date
    seat_number: string | null
    seat_type: string | null
    price: number
    order_number: string
    customer_name: string
    attendee_name: string | null
    attendee_email: string | null
    ticket_type_name: string | null
    staff_name: string | null
    staff_username: string | null
  }>(
    `SELECT oi.id, oi.ticket_code, oi.checked_in_at, oi.seat_number, oi.seat_type, oi.price,
            o.order_number, o.customer_name,
            oi.attendee_name, oi.attendee_email,
            COALESCE(tt.name, tt2.name) AS ticket_type_name,
            u.full_name AS staff_name, u.username AS staff_username
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN seats s ON s.id = oi.seat_id
     LEFT JOIN ticket_types tt ON tt.id = s.ticket_type_id
     LEFT JOIN ticket_types tt2 ON tt2.id = oi.ticket_type_id
     LEFT JOIN users u ON u.id = oi.checked_in_by
     WHERE o.event_id = ? AND o.status = 'PAID' AND oi.checked_in_at IS NOT NULL
     ORDER BY oi.checked_in_at DESC
     LIMIT ?`,
    [eventId, limit],
  )
  return rows.map((r) => ({
    id: r.id,
    ticketCode: r.ticket_code,
    checkedInAt: r.checked_in_at,
    typeName:
      (r.ticket_type_name && String(r.ticket_type_name).trim()) || humanizeSeatType(r.seat_type),
    seatNumber: r.seat_number,
    price: Number(r.price),
    orderNumber: r.order_number,
    customerName: r.customer_name,
    attendeeName: r.attendee_name,
    attendeeEmail: r.attendee_email,
    checkedInBy: r.staff_name || r.staff_username || null,
  }))
}
