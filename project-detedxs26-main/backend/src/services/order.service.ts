import {query, execute, queryOne} from '../db/mysql.js'
import {BadRequestError, NotFoundError, ForbiddenError} from '../utils/errors.js'
import {
  generateUUID,
  generateOrderNumber,
  generateAccessToken,
  verifyAccessToken,
} from '../utils/helpers.js'
import { Order } from '../types/index.js'
import { redis } from '../db/redis.js'
import * as promotionsService from './promotions.service.js'
import { sendOrderNotificationToDevs } from './email.service.js'

// ============================================
// TICKET-CLASS BOOKING
// The venue has no seat map: attendees buy a
// quantity of a ticket type, and the organisers
// arrange seating themselves afterwards. Stock
// is capped by ticket_types.max_quantity.
// ============================================

interface CreatePendingOrderByTypeParams {
  eventId: string
  sessionId: string
  promoCode?: string
  /** Explicit customer choice from the eligible-promotions list. */
  promotionId?: string
  /** Multi-type cart items (preferred). Legacy single-type is normalized by controller. */
  items: Array<{ticketTypeId: string; quantity: number}>
}

interface CreatePendingOrderResult {
  orderId: string
  orderNumber: string
  totalAmount: number
  status: string
  expiresAt: string | null
  accessToken: string
}

/** How long a PENDING order holds its stock before expiring. */
const PENDING_ORDER_MINUTES = 15

/**
 * Order statuses that consume stock. PENDING is included because those
 * tickets are actively held by an in-progress checkout; they free up
 * automatically once the order expires.
 */
const STOCK_HOLDING_STATUSES = ['PAID', 'PENDING_CONFIRMATION', 'PENDING']

/**
 * How many tickets of a type are currently taken (sold or held).
 * PENDING orders only count while unexpired, so abandoned checkouts
 * release their stock without needing a cleanup job.
 */
async function getTakenQuantity(ticketTypeId: string): Promise<number> {
  const row = await queryOne<{taken: number}>(
    `SELECT COUNT(*) AS taken
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.ticket_type_id = ?
       AND o.status IN (?, ?, ?)
       AND (o.status <> 'PENDING' OR o.expires_at > NOW())`,
    [ticketTypeId, ...STOCK_HOLDING_STATUSES]
  )
  return Number(row?.taken ?? 0)
}

/**
 * Create a pending order from a ticket-type cart.
 *
 * There are no seats to reserve, so overselling is prevented purely by
 * ticket_types.max_quantity: a type with max_quantity set can never have
 * more live tickets than that. A NULL max_quantity means unlimited.
 */
export async function createPendingOrderByTicketType(
  params: CreatePendingOrderByTypeParams
): Promise<CreatePendingOrderResult> {
  const {eventId, sessionId, promoCode, promotionId, items} = params

  if (!items || items.length === 0) {
    throw new BadRequestError('Cart is empty')
  }

  // Merge duplicate ticket types
  const qtyByType = new Map<string, number>()
  for (const item of items) {
    const q = Math.floor(Number(item.quantity))
    if (!item.ticketTypeId || q < 1) continue
    qtyByType.set(item.ticketTypeId, (qtyByType.get(item.ticketTypeId) || 0) + q)
  }
  if (qtyByType.size === 0) {
    throw new BadRequestError('Cart is empty')
  }

  const totalQty = [...qtyByType.values()].reduce((a, b) => a + b, 0)
  if (totalQty < 1 || totalQty > 20) {
    throw new BadRequestError('Total quantity must be between 1 and 20')
  }
  for (const q of qtyByType.values()) {
    if (q > 10) {
      throw new BadRequestError('Quantity per ticket type must be at most 10')
    }
  }

  // Distributed lock per session+event so a double-submit can't create two orders
  const lockKey = `order:create-type:${sessionId}:${eventId}`
  const lockAcquired = await redis.set(lockKey, generateUUID(), 'NX', 'EX', 30)
  if (!lockAcquired) {
    throw new BadRequestError('Your order is being processed. Please wait a moment.')
  }

  try {
    const event = await queryOne<{id: string; status: string; name: string}>(
      'SELECT id, status, name FROM events WHERE id = ?',
      [eventId]
    )
    if (!event) throw new NotFoundError('Event not found')
    if (event.status !== 'PUBLISHED') {
      throw new BadRequestError('Event is not available for booking')
    }

    type Line = {
      ticketTypeId: string
      ticketTypeName: string
      unitPrice: number
      quantity: number
    }
    const lines: Line[] = []
    const promoTickets: Array<{id: string; price: number; ticketTypeId: string}> = []
    let rawTotalAmount = 0
    const summaryParts: string[] = []

    for (const [ticketTypeId, quantity] of qtyByType) {
      const ticketType = await queryOne<{
        id: string
        name: string
        price: number
        max_quantity: number | null
      }>(
        'SELECT id, name, price, max_quantity FROM ticket_types WHERE id = ? AND event_id = ? AND is_active = 1',
        [ticketTypeId, eventId]
      )
      if (!ticketType) throw new NotFoundError(`Ticket type not found: ${ticketTypeId}`)

      // Stock check — the only thing standing between us and overselling
      // now that seats are gone.
      if (ticketType.max_quantity !== null) {
        const taken = await getTakenQuantity(ticketTypeId)
        const remaining = Math.max(0, ticketType.max_quantity - taken)
        if (remaining < quantity) {
          throw new BadRequestError(
            remaining === 0
              ? `"${ticketType.name}" is sold out.`
              : `Only ${remaining} "${ticketType.name}" ticket(s) left.`
          )
        }
      }

      const unitPrice = Number(ticketType.price)
      lines.push({
        ticketTypeId,
        ticketTypeName: ticketType.name,
        unitPrice,
        quantity,
      })
      for (let i = 0; i < quantity; i++) {
        promoTickets.push({id: `${ticketTypeId}_${i}`, price: unitPrice, ticketTypeId})
      }
      rawTotalAmount += unitPrice * quantity
      summaryParts.push(`${quantity} x ${ticketType.name}`)
    }

    // Honour the customer's pick when they made one; the service still
    // re-validates it against this cart, so a stale choice can't apply.
    const discount = await promotionsService.calculateBestDiscount({
      eventId,
      tickets: promoTickets,
      promoCode,
      promotionId,
    })

    let totalAmount = rawTotalAmount
    let discountAmount: number | null = null
    let appliedPromotionId: string | null = null
    let appliedPromoCode: string | null = null

    if (discount) {
      discountAmount = discount.discountAmount
      appliedPromotionId = discount.promotionId
      totalAmount = Math.max(0, rawTotalAmount - discountAmount)
      if (promoCode) appliedPromoCode = promoCode
    }

    const orderNumber = generateOrderNumber()
    const orderId = generateUUID()
    const {token: accessToken, hash: accessTokenHash} = generateAccessToken()

    await execute(
      `INSERT INTO orders (id, order_number, event_id, session_id, total_amount, status, customer_name, customer_email, customer_phone, expires_at, access_token_hash, access_token, discount_amount, promotion_id, promo_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'PENDING', '', '', '', DATE_ADD(NOW(), INTERVAL ? MINUTE), ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        orderId,
        orderNumber,
        eventId,
        sessionId,
        totalAmount,
        PENDING_ORDER_MINUTES,
        accessTokenHash,
        accessToken,
        discountAmount,
        appliedPromotionId,
        appliedPromoCode,
      ]
    )

    // One row per ticket: the attendee details and check-in QR hang off these.
    for (const line of lines) {
      for (let i = 0; i < line.quantity; i++) {
        await execute(
          `INSERT INTO order_items (id, order_id, ticket_type_id, ticket_type_name, price, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [generateUUID(), orderId, line.ticketTypeId, line.ticketTypeName, line.unitPrice]
        )
      }
    }

    if (appliedPromotionId) {
      await execute('UPDATE promotions SET used_count = used_count + 1 WHERE id = ?', [
        appliedPromotionId,
      ])
    }

    const orderData = await queryOne<{expires_at: Date}>(
      'SELECT expires_at FROM orders WHERE id = ?',
      [orderId]
    )

    console.log(
      `[CREATE PENDING ORDER] Created order ${orderNumber} for ${summaryParts.join(', ')}`
    )

    sendOrderNotificationToDevs({
      orderNumber,
      eventName: event.name,
      tickets: lines.flatMap((l) =>
        Array.from({length: l.quantity}, () => ({
          ticketTypeName: l.ticketTypeName,
          price: l.unitPrice,
        }))
      ),
      totalAmount,
      discountAmount,
      promoCode: appliedPromoCode,
    }).catch((err) => console.error('[NOTIFICATION] Failed:', err))

    return {
      orderId,
      orderNumber,
      totalAmount,
      status: 'PENDING',
      expiresAt: orderData?.expires_at ? new Date(orderData.expires_at).toISOString() : null,
      accessToken,
    }
  } finally {
    await redis.del(lockKey)
  }
}

/**
 * PUBLIC: Check whether this browser session already has a live pending
 * order for the event, so the client can offer to resume it instead of
 * silently creating a duplicate.
 */
export async function checkPendingOrderBySession(eventId: string, sessionId: string) {
  const order = await queryOne<{
    id: string
    order_number: string
    total_amount: number
    status: string
    expires_at: Date
  }>(
    `SELECT id, order_number, total_amount, status, expires_at
     FROM orders
     WHERE event_id = ?
       AND session_id = ?
       AND status = 'PENDING'
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [eventId, sessionId]
  )

  if (!order) {
    return null
  }

  const tickets = await query<{
    ticket_type_name: string | null
    price: number
  }>('SELECT ticket_type_name, price FROM order_items WHERE order_id = ?', [order.id])

  const expiresAt = new Date(order.expires_at)
  const timeRemaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))

  // Issue a fresh access token so the returning tab can act on the order.
  const {token: accessToken, hash: accessTokenHash} = generateAccessToken()
  await execute('UPDATE orders SET access_token_hash = ? WHERE id = ?', [accessTokenHash, order.id])

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    totalAmount: Number(order.total_amount),
    status: order.status,
    expiresAt: expiresAt.toISOString(),
    timeRemaining,
    ticketCount: tickets.length,
    tickets: tickets.map((t) => ({
      ticketTypeName: t.ticket_type_name || '',
      price: Number(t.price),
    })),
    accessToken,
  }
}

interface ConfirmPaymentParams {
  orderNumber: string
  accessToken: string
  customerName: string
  customerEmail: string
  customerPhone: string
  /** One entry per ticket, in the same order as the order's items. */
  attendees?: Array<{orderItemId?: string; name: string; email: string; phone: string}>
}

/** Cancel a pending order (user backs out of checkout). */
export async function cancelPendingOrder(
  orderNumber: string,
  accessToken: string
): Promise<{orderNumber: string; status: string}> {
  const order = await queryOne<{
    id: string
    order_number: string
    status: string
    access_token_hash: string
    event_id: string
  }>(
    `SELECT id, order_number, status, access_token_hash, event_id
     FROM orders WHERE order_number = ?`,
    [orderNumber]
  )

  if (!order) {
    throw new NotFoundError('Order not found')
  }

  if (!verifyAccessToken(accessToken, order.access_token_hash)) {
    throw new ForbiddenError('Invalid access token')
  }

  if (order.status !== 'PENDING') {
    throw new BadRequestError(`Cannot cancel order with status ${order.status}`)
  }

  await execute('DELETE FROM order_items WHERE order_id = ?', [order.id])
  await execute('DELETE FROM payments WHERE order_id = ?', [order.id])
  await execute('DELETE FROM orders WHERE id = ?', [order.id])

  console.log(`[CANCEL ORDER] Deleted order ${orderNumber}`)

  return {
    orderNumber: order.order_number,
    status: 'DELETED',
  }
}

// Confirm payment (user clicks "I Have Paid")
export async function confirmPayment(
  params: ConfirmPaymentParams
): Promise<{orderNumber: string; status: string}> {
  const {orderNumber, accessToken, customerName, customerEmail, customerPhone, attendees} = params

  const order = await queryOne<{
    id: string
    order_number: string
    status: string
    expires_at: Date
    access_token_hash: string
    event_id: string
    is_expired: number
  }>(
    `SELECT id, order_number, status, expires_at, access_token_hash, event_id,
            (expires_at < NOW()) as is_expired
     FROM orders WHERE order_number = ?`,
    [orderNumber]
  )

  if (!order) {
    throw new NotFoundError('Order not found')
  }

  if (!verifyAccessToken(accessToken, order.access_token_hash)) {
    throw new ForbiddenError('Invalid access token')
  }

  if (order.status === 'PAID') {
    throw new BadRequestError('This order has already been paid and confirmed')
  }

  if (order.status === 'PENDING_CONFIRMATION') {
    throw new BadRequestError('This order is awaiting admin confirmation. Please wait.')
  }

  if (order.is_expired === 1) {
    throw new BadRequestError('Order has expired')
  }

  if (order.status === 'CANCELLED' || order.status === 'EXPIRED') {
    throw new BadRequestError(`Order is ${order.status.toLowerCase()}`)
  }

  if (order.status !== 'PENDING') {
    throw new BadRequestError(`Cannot confirm an order with status ${order.status}`)
  }

  await execute(
    `UPDATE orders
     SET status = 'PENDING_CONFIRMATION',
         customer_name = ?,
         customer_email = ?,
         customer_phone = ?,
         updated_at = NOW()
     WHERE order_number = ?`,
    [customerName, customerEmail, customerPhone, orderNumber]
  )

  // Attach each attendee to a specific ticket. Attendees are matched by
  // order_item id when supplied, otherwise positionally against the
  // order's items in creation order.
  if (attendees && attendees.length > 0) {
    const orderItems = await query<{id: string}>(
      'SELECT id FROM order_items WHERE order_id = ? ORDER BY created_at ASC, id ASC',
      [order.id]
    )

    for (const [index, attendee] of attendees.entries()) {
      const targetId = attendee.orderItemId ?? orderItems[index]?.id
      if (!targetId) continue
      await execute(
        `UPDATE order_items
         SET attendee_name = ?, attendee_email = ?, attendee_phone = ?
         WHERE id = ? AND order_id = ?`,
        [attendee.name, attendee.email, attendee.phone, targetId, order.id]
      )
    }
  }

  console.log(`[CONFIRM PAYMENT] Order ${orderNumber} set to PENDING_CONFIRMATION`)

  // Notify on-duty staff that an order is waiting for payment confirmation
  try {
    const { sendOnDutyStaffNotification } = await import('./email.service.js')
    const orderDetails = await getOrderByNumber(orderNumber, accessToken)
    const orderDataForEmail = await queryOne<{discount_amount: number | null, promo_code: string | null}>(
       'SELECT discount_amount, promo_code FROM orders WHERE id = ?', [order.id]
    )

    sendOnDutyStaffNotification({
      orderNumber: orderDetails.orderNumber,
      customerName: orderDetails.customerName,
      customerEmail: orderDetails.customerEmail || '',
      customerPhone: orderDetails.customerPhone || '',
      eventName: orderDetails.eventName,
      tickets: orderDetails.tickets.map((t) => ({
        ticketTypeName: t.ticketTypeName,
        price: t.price,
      })),
      totalAmount: orderDetails.totalAmount,
      discountAmount: orderDataForEmail?.discount_amount,
      promoCode: orderDataForEmail?.promo_code
    }).catch((err) => console.error('[ON-DUTY] Failed to send staff notification:', err))
  } catch (err) {
    console.error('[ON-DUTY] Failed to prepare staff notification:', err)
  }

  return {
    orderNumber,
    status: 'PENDING_CONFIRMATION',
  }
}

// Get order by number with access token validation
export async function getOrderByNumber(orderNumber: string, accessToken: string) {
  const order = await queryOne<
    Order & {
      event_name: string
      event_venue: string
      event_date: Date
      expires_at: string | null
    }
  >(
    `SELECT o.*, e.name as event_name, e.venue as event_venue, e.event_date
     FROM orders o
     JOIN events e ON o.event_id = e.id
     WHERE o.order_number = ?`,
    [orderNumber]
  )

  if (!order) {
    throw new NotFoundError('Order not found')
  }

  if (!order.access_token_hash || !verifyAccessToken(accessToken, order.access_token_hash)) {
    throw new ForbiddenError('Invalid access token')
  }

  const items = await query<{
    id: string
    ticket_type_id: string | null
    ticket_type_name: string | null
    price: number
    attendee_name: string | null
    attendee_email: string | null
    attendee_phone: string | null
    ticket_code: string | null
  }>(
    `SELECT id, ticket_type_id, ticket_type_name, price,
            attendee_name, attendee_email, attendee_phone, ticket_code
     FROM order_items
     WHERE order_id = ?
     ORDER BY created_at ASC, id ASC`,
    [order.id]
  )

  let timeRemaining = 0
  if (order.expires_at) {
    const expiresAt = new Date(order.expires_at)
    timeRemaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
  }

  const tickets = items.map((item) => ({
    id: item.id,
    ticketTypeId: item.ticket_type_id || '',
    ticketTypeName: item.ticket_type_name || '',
    price: Number(item.price),
    attendeeName: item.attendee_name,
    attendeeEmail: item.attendee_email,
    attendeePhone: item.attendee_phone,
    ticketCode: item.ticket_code,
  }))

  return {
    id: order.id,
    orderNumber: order.order_number,
    eventId: order.event_id,
    eventName: order.event_name,
    event: {
      id: order.event_id,
      name: order.event_name,
      venue: order.event_venue,
      eventDate: order.event_date,
    },
    status: order.status,
    totalAmount: Number(order.total_amount),
    expiresAt: order.expires_at,
    timeRemaining,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    createdAt: order.created_at,
    items: tickets,
    tickets,
  }
}
