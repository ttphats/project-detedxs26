import {prisma} from '../../db/prisma.js'
import {NotFoundError, BadRequestError} from '../../utils/errors.js'
import {execute, query, queryOne} from '../../db/mysql.js'
import {
  ensureOrderItemTicketColumns,
  ensureTicketUnitsForOrder,
} from '../../utils/ticket-unit.js'
import {buildTicketLines, humanizeSeatType} from '../../utils/ticket-lines.js'

function normalizeScanInput(raw: string): {kind: 'TICKET'; ticketCode: string} | {kind: 'ORDER'; orderNumber: string} {
  const s = String(raw || '').trim()
  const fromUrl = s.match(/TKT-[A-F0-9]+/i)
  if (s.toUpperCase().startsWith('TKT-') || fromUrl) {
    const code = (fromUrl ? fromUrl[0] : s).toUpperCase()
    return {kind: 'TICKET', ticketCode: code}
  }
  return {kind: 'ORDER', orderNumber: s.toUpperCase()}
}

export async function checkIn(scanValue: string, adminUserId: string) {
  await ensureOrderItemTicketColumns()
  const target = normalizeScanInput(scanValue)
  if (target.kind === 'TICKET') return checkInTicketUnit(target.ticketCode, adminUserId)
  return checkInOrderLegacy(target.orderNumber, adminUserId)
}

// keep export name used by controller
export async function checkInOrder(orderNumber: string, adminUserId: string) {
  return checkIn(orderNumber, adminUserId)
}

async function checkInTicketUnit(ticketCode: string, adminUserId: string) {
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

async function checkInOrderLegacy(orderNumber: string, adminUserId: string) {
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

export async function getCheckedInList(eventId: string) {
  await ensureOrderItemTicketColumns()
  const rows = await query<{
    ticket_code: string
    checked_in_at: Date
    seat_number: string
    seat_type: string
    order_number: string
    customer_name: string
    ticket_type_name: string | null
  }>(
    `SELECT oi.ticket_code, oi.checked_in_at, oi.seat_number, oi.seat_type,
            o.order_number, o.customer_name, tt.name AS ticket_type_name
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN seats s ON s.id = oi.seat_id
     LEFT JOIN ticket_types tt ON tt.id = s.ticket_type_id
     WHERE o.event_id = ? AND o.status = 'PAID' AND oi.checked_in_at IS NOT NULL
     ORDER BY oi.checked_in_at DESC
     LIMIT 200`,
    [eventId],
  )
  return rows.map((r) => ({
    ticketCode: r.ticket_code,
    checkedInAt: r.checked_in_at,
    typeName: (r.ticket_type_name && String(r.ticket_type_name).trim()) || humanizeSeatType(r.seat_type),
    seatNumber: r.seat_number,
    orderNumber: r.order_number,
    customerName: r.customer_name,
  }))
}
