import {query, execute, queryOne, transaction} from '../db/mysql.js'
import {BadRequestError, NotFoundError, ForbiddenError} from '../utils/errors.js'
import {
  generateUUID,
  generateOrderNumber,
  generateAccessToken,
  verifyAccessToken,
} from '../utils/helpers.js'
import { Order, Seat } from '../types/index.js'
import { redis } from '../db/redis.js'
import * as promotionsService from './promotions.service.js'
import { sendOrderNotificationToDevs } from './email.service.js'
import { getTicketTypeUsage, remainingUnderCap } from './ticket-quota.service.js'

interface CreatePendingOrderParams {
  eventId: string
  seatIds: string[]
  sessionId: string
  promoCode?: string
}

interface CreatePendingOrderResult {
  orderId: string
  orderNumber: string
  totalAmount: number
  status: string
  expiresAt: string | null
  accessToken: string
}

// ============================================
// TICKET-CLASS BOOKING (no seat selection)
// User picks ticket type + quantity; backend
// auto-assigns available seats from that tier.
// ============================================

interface CreatePendingOrderByTypeParams {
  eventId: string
  sessionId: string
  promoCode?: string
  /** Ticket-class picker: apply this exact promotion after re-validating. */
  promotionId?: string
  /** Multi-type cart items (preferred). Legacy single-type is normalized by controller. */
  items: Array<{ticketTypeId: string; quantity: number}>
}

const TICKET_CLASS_LOCK_MINUTES = 10
const TICKET_CLASS_LOCK_SECONDS = TICKET_CLASS_LOCK_MINUTES * 60

// Create a pending order
export async function createPendingOrder(
  params: CreatePendingOrderParams
): Promise<CreatePendingOrderResult> {
  const {eventId, seatIds, sessionId, promoCode} = params

  // 🔒 DISTRIBUTED LOCK: Prevent duplicate orders from same session
  // Use Redis lock to ensure only ONE order creation happens per session at a time
  const lockKey = `order:create:${sessionId}:${eventId}`
  const lockValue = generateUUID()
  const lockTtl = 30 // 30 seconds - enough time to create order

  console.log(`[CREATE PENDING ORDER] Attempting to acquire lock: ${lockKey}`)

  // Try to acquire lock (NX = only set if not exists)
  // ioredis syntax: SET key value NX EX seconds
  const lockAcquired = await redis.set(lockKey, lockValue, 'NX', 'EX', lockTtl)

  if (!lockAcquired) {
    // Another request from same session is already creating an order
    console.log(`[CREATE PENDING ORDER] ⏳ Lock already held, checking for existing order...`)

    // Wait a bit and check if order was created
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Check if there's a pending order created by this session
    const existingOrder = await findPendingOrderBySessionAndSeats(eventId, sessionId, seatIds)

    if (existingOrder) {
      console.log(
        `[CREATE PENDING ORDER] ✅ Found order created by parallel request: ${existingOrder.order_number}`
      )
      const {token: accessToken} = generateAccessToken()
      return {
        orderId: existingOrder.id,
        orderNumber: existingOrder.order_number,
        totalAmount: Number(existingOrder.total_amount),
        status: existingOrder.status,
        expiresAt: new Date(existingOrder.expires_at).toISOString(),
        accessToken,
      }
    }

    throw new BadRequestError('Đơn hàng đang được xử lý. Vui lòng chờ trong giây lát.')
  }

  try {
    console.log(`[CREATE PENDING ORDER] 🔓 Lock acquired for session ${sessionId.substring(0, 15)}`)

    // Check if there's already a pending order with these exact seats FOR THIS SESSION
    const existingOrder = await findPendingOrderBySessionAndSeats(eventId, sessionId, seatIds)

    if (existingOrder) {
      console.log(
        `[CREATE PENDING ORDER] ✅ Reusing existing order ${
          existingOrder.order_number
        } for session ${sessionId.substring(0, 15)}...`
      )

      // Generate new access token (original token is not stored)
      const {token: accessToken} = generateAccessToken()

      return {
        orderId: existingOrder.id,
        orderNumber: existingOrder.order_number,
        totalAmount: Number(existingOrder.total_amount),
        status: existingOrder.status,
        expiresAt: new Date(existingOrder.expires_at).toISOString(),
        accessToken, // Return new token for this session
      }
    }

    console.log(`[CREATE PENDING ORDER] No matching pending order found, creating new order...`)

    // Check event exists and is published
    const event = await queryOne<{id: string; status: string; name: string}>(
      'SELECT id, status, name FROM events WHERE id = ?',
      [eventId]
    )

    if (!event) {
      throw new NotFoundError('Event not found')
    }

    if (event.status !== 'PUBLISHED') {
      throw new BadRequestError('Event is not available for booking')
    }

    // Verify seats are locked by this session
    const placeholders = seatIds.map(() => '?').join(',')
    const locks = await query<{seat_id: string; session_id: string}>(
      `SELECT seat_id, session_id FROM seat_locks
     WHERE seat_id IN (${placeholders}) AND event_id = ?`,
      [...seatIds, eventId]
    )

    if (locks.length !== seatIds.length) {
      throw new BadRequestError('Some seats are not locked')
    }

    const notOwnedSeats = locks.filter((lock) => lock.session_id !== sessionId)
    if (notOwnedSeats.length > 0) {
      throw new ForbiddenError('Some seats are locked by another session')
    }

    // Get seat details
    const seats = await query<Seat>(
      `SELECT id, seat_number, seat_type, price, row, section FROM seats WHERE id IN (${placeholders})`,
      seatIds
    )

    if (seats.length !== seatIds.length) {
      throw new NotFoundError('Some seats not found')
    }

    // Calculate total amount
    const rawTotalAmount = seats.reduce((sum, seat) => sum + Number(seat.price), 0)

    // Check for promotions
    const tickets = seats.map(s => ({
      id: s.id,
      price: Number(s.price),
      ticketTypeId: (s as any).ticket_type_id || undefined
    }))

    const discount = await promotionsService.calculateBestDiscount({
      eventId,
      tickets,
      promoCode
    })

    let totalAmount = rawTotalAmount
    let discountAmount = null
    let promotionId = null
    let appliedPromoCode = null

    if (discount) {
      discountAmount = discount.discountAmount
      promotionId = discount.promotionId
      totalAmount = Math.max(0, rawTotalAmount - discountAmount)

      if (promoCode) {
        // We only save promoCode if it was actually provided, but checking if the code matched the promotion requires us to know if this promotion is a promo code.
        // For simplicity, we just save the promoCode they entered.
        appliedPromoCode = promoCode
      }
    }

    const orderNumber = generateOrderNumber()
    const orderId = generateUUID()

    // Generate access token for ticketless authentication
    const {token: accessToken, hash: accessTokenHash} = generateAccessToken()

    // Create order with PENDING status (no customer info yet)
    // Save both hash (for verification) and plaintext (for email)
    await execute(
      `INSERT INTO orders (id, order_number, event_id, total_amount, status, customer_name, customer_email, customer_phone, expires_at, access_token_hash, access_token, discount_amount, promotion_id, promo_code, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'PENDING', '', '', '', DATE_ADD(NOW(), INTERVAL 15 MINUTE), ?, ?, ?, ?, ?, NOW(), NOW())`,
      [orderId, orderNumber, eventId, totalAmount, accessTokenHash, accessToken, discountAmount, promotionId, appliedPromoCode]
    )

    // Create order items
    for (const seat of seats) {
      const orderItemId = generateUUID()
      await execute(
        `INSERT INTO order_items (id, order_id, seat_id, price, seat_number, seat_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [orderItemId, orderId, seat.id, seat.price, seat.seat_number, seat.seat_type]
      )
    }

    // Increment promotion used count
    if (promotionId) {
       await execute(
         'UPDATE promotions SET used_count = used_count + 1 WHERE id = ?',
         [promotionId]
       )
    }

    // Get the expires_at from database to return to client
    const orderData = await queryOne<{expires_at: Date}>(
      'SELECT expires_at FROM orders WHERE id = ?',
      [orderId]
    )

    console.log(`[CREATE PENDING ORDER] Created order ${orderNumber} for ${seats.length} seats`)

    // 📧 Send notification email to dev/admin (fire-and-forget)
    sendOrderNotificationToDevs({
      orderNumber,
      eventName: event.name,
      seats: seats.map((s) => ({
        seatNumber: s.seat_number,
        seatType: s.seat_type,
        price: Number(s.price),
      })),
      totalAmount,
      discountAmount: discountAmount,
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
    // 🔓 RELEASE LOCK: Always release the lock, even if there's an error
    await redis.del(lockKey)
    console.log(`[CREATE PENDING ORDER] 🔓 Lock released: ${lockKey}`)
  }
}

/**
 * Helper function: Find pending order by session and seats
 * This checks seat_locks table to find orders created by this session
 */
async function findPendingOrderBySessionAndSeats(
  eventId: string,
  sessionId: string,
  seatIds: string[]
): Promise<{
  id: string
  order_number: string
  total_amount: number
  status: string
  expires_at: Date
} | null> {
  // Find all PENDING orders for this event that are locked by this session
  const placeholders = seatIds.map(() => '?').join(',')

  // Strategy: Find orders where ALL seats are locked by this session
  const orders = await query<{
    id: string
    order_number: string
    total_amount: number
    status: string
    expires_at: Date
  }>(
    `SELECT DISTINCT o.id, o.order_number, o.total_amount, o.status, o.expires_at
     FROM orders o
     INNER JOIN order_items oi ON o.id = oi.order_id
     INNER JOIN seat_locks sl ON oi.seat_id = sl.seat_id AND sl.event_id = o.event_id
     WHERE o.event_id = ?
       AND o.status = 'PENDING'
       AND o.expires_at > NOW()
       AND sl.session_id = ?
       AND oi.seat_id IN (${placeholders})
     ORDER BY o.created_at DESC
     LIMIT 1`,
    [eventId, sessionId, ...seatIds]
  )

  if (orders.length === 0) {
    return null
  }

  // Verify this order has EXACTLY the same seats (not a subset)
  const order = orders[0]
  const orderSeats = await query<{seat_id: string}>(
    'SELECT seat_id FROM order_items WHERE order_id = ?',
    [order.id]
  )

  const orderSeatIds = orderSeats.map((s) => s.seat_id).sort()
  const requestedSeatIds = [...seatIds].sort()

  const seatsMatch =
    orderSeatIds.length === requestedSeatIds.length &&
    orderSeatIds.every((seatId, index) => seatId === requestedSeatIds[index])

  return seatsMatch ? order : null
}

/**
 * PUBLIC: Check if session has pending order for this event
 * Used to show modal on seats page when user returns
 */
export async function checkPendingOrderBySession(eventId: string, sessionId: string) {
  // Find any PENDING order created by this session for this event
  const order = await queryOne<{
    id: string
    order_number: string
    total_amount: number
    status: string
    expires_at: Date
  }>(
    `SELECT DISTINCT o.id, o.order_number, o.total_amount, o.status, o.expires_at
     FROM orders o
     INNER JOIN order_items oi ON o.id = oi.order_id
     INNER JOIN seat_locks sl ON oi.seat_id = sl.seat_id AND sl.event_id = o.event_id
     WHERE o.event_id = ?
       AND o.status = 'PENDING'
       AND o.expires_at > NOW()
       AND sl.session_id = ?
     ORDER BY o.created_at DESC
     LIMIT 1`,
    [eventId, sessionId]
  )

  if (!order) {
    return null
  }

  // Get order seats
  const seats = await query<{
    seat_id: string
    seat_number: string
    seat_type: string
    price: number
  }>('SELECT seat_id, seat_number, seat_type, price FROM order_items WHERE order_id = ?', [
    order.id,
  ])

  // Calculate time remaining
  const expiresAt = new Date(order.expires_at)
  const timeRemaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))

  // Generate new access token for this session and update in database
  const {token: accessToken, hash: accessTokenHash} = generateAccessToken()

  // Update the order with new access token
  await execute('UPDATE orders SET access_token_hash = ? WHERE id = ?', [accessTokenHash, order.id])

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    totalAmount: Number(order.total_amount),
    status: order.status,
    expiresAt: expiresAt.toISOString(),
    timeRemaining,
    seatCount: seats.length,
    seats: seats.map((s) => ({
      seatId: s.seat_id,
      seatNumber: s.seat_number,
      seatType: s.seat_type,
      price: Number(s.price),
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
  /** One attendee per ticket, in the order the tickets were created. */
  attendees?: Array<{orderItemId?: string; name: string; email: string; phone: string}>
}

// Cancel pending order (user clicks "Chọn ghế khác")
export async function cancelPendingOrder(
  orderNumber: string,
  accessToken: string
): Promise<{orderNumber: string; status: string; releasedSeats: number}> {
  // Get order
  const order = await queryOne<{
    id: string
    order_number: string
    status: string
    access_token_hash: string
    event_id: string
    promotion_id: string | null
  }>(
    `SELECT id, order_number, status, access_token_hash, event_id, promotion_id
     FROM orders WHERE order_number = ?`,
    [orderNumber]
  )

  if (!order) {
    throw new NotFoundError('Order not found')
  }

  // Verify access token
  const isValidToken = verifyAccessToken(accessToken, order.access_token_hash)
  if (!isValidToken) {
    throw new ForbiddenError('Invalid access token')
  }

  // Only allow canceling PENDING orders
  if (order.status !== 'PENDING') {
    throw new BadRequestError(`Cannot cancel order with status ${order.status}`)
  }

  // Get seat IDs from order items
  const seatIds = await query<{seat_id: string}>(
    `SELECT seat_id FROM order_items WHERE order_id = ?`,
    [order.id]
  )

  const seatIdList = seatIds.map((s) => s.seat_id).filter((id) => id !== null)

  // Release seats back to AVAILABLE
  if (seatIdList.length > 0) {
    const placeholders = seatIdList.map(() => '?').join(',')
    await execute(
      `UPDATE seats
       SET status = 'AVAILABLE', updated_at = NOW()
       WHERE id IN (${placeholders})`,
      seatIdList
    )
  }

  // Delete seat locks for this session
  if (seatIdList.length > 0) {
    const placeholders = seatIdList.map(() => '?').join(',')
    await execute(
      `DELETE FROM seat_locks
       WHERE event_id = ? AND seat_id IN (${placeholders})`,
      [order.event_id, ...seatIdList]
    )
  }

  // Delete from Redis (correct key format)
  for (const seatId of seatIdList) {
    await redis.del(`seat:${order.event_id}:${seatId}`)
  }

  // Decrement promotion used count if applicable
  if (order.promotion_id) {
    await execute(
      'UPDATE promotions SET used_count = GREATEST(0, used_count - 1) WHERE id = ?',
      [order.promotion_id]
    )
  }

  // Delete order items first (foreign key constraint)
  await execute('DELETE FROM order_items WHERE order_id = ?', [order.id])

  // Delete payment record if exists
  await execute('DELETE FROM payments WHERE order_id = ?', [order.id])

  // Delete the order itself
  await execute('DELETE FROM orders WHERE id = ?', [order.id])

  console.log(`[CANCEL ORDER] Deleted order ${orderNumber}, released ${seatIdList.length} seats`)

  return {
    orderNumber: order.order_number,
    status: 'DELETED',
    releasedSeats: seatIdList.length,
  }
}

// Confirm payment (user clicks "Đã thanh toán")
export async function confirmPayment(
  params: ConfirmPaymentParams
): Promise<{orderNumber: string; status: string}> {
  const {orderNumber, accessToken, customerName, customerEmail, customerPhone, attendees} = params

  // Get order with expiration check
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

  // Verify access token
  const isValidToken = verifyAccessToken(accessToken, order.access_token_hash)
  if (!isValidToken) {
    throw new ForbiddenError('Invalid access token')
  }

  // Check order status
  if (order.status === 'PAID') {
    throw new BadRequestError('Đơn hàng đã được thanh toán và xác nhận')
  }

  if (order.status === 'PENDING_CONFIRMATION') {
    throw new BadRequestError('Đơn hàng đang chờ admin xác nhận. Vui lòng đợi.')
  }

  if (order.is_expired === 1) {
    throw new BadRequestError('Order has expired')
  }

  if (order.status === 'CANCELLED' || order.status === 'EXPIRED') {
    throw new BadRequestError(`Order is ${order.status.toLowerCase()}`)
  }

  if (order.status !== 'PENDING') {
    throw new BadRequestError(`Không thể xác nhận đơn hàng với trạng thái ${order.status}`)
  }

  // Update order to PENDING_CONFIRMATION
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
  // order_item id when supplied, otherwise positionally against the order's
  // items in creation order.
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

  // Mark seats as RESERVED
  await execute(
    `UPDATE seats
     SET status = 'RESERVED', updated_at = NOW()
     WHERE id COLLATE utf8mb4_unicode_ci IN (
       SELECT seat_id FROM order_items WHERE order_id = ?
     )`,
    [order.id]
  )

  // Extend seat locks to 24 hours
  await execute(
    `UPDATE seat_locks
     SET expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR)
     WHERE event_id COLLATE utf8mb4_unicode_ci = ?
     AND seat_id COLLATE utf8mb4_unicode_ci IN (
       SELECT seat_id FROM order_items WHERE order_id = ?
     )`,
    [order.event_id, order.id]
  )

  console.log(`[CONFIRM PAYMENT] Order ${orderNumber} set to PENDING_CONFIRMATION`)

  // Notify on-duty staff that an order is waiting for payment confirmation
  try {
    const { sendOnDutyStaffNotification } = await import('./email.service.js')
    const { notifyNewOrderPendingConfirmation } = await import('./telegram.service.js')
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
      seats: orderDetails.seats.map(s => ({
        seatNumber: s.seatNumber,
        seatType: s.seatType,
        price: s.price
      })),
      totalAmount: orderDetails.totalAmount,
      discountAmount: orderDataForEmail?.discount_amount,
      promoCode: orderDataForEmail?.promo_code
    }).catch((err) => console.error('[ON-DUTY] Failed to send staff notification:', err))

    notifyNewOrderPendingConfirmation({
      orderNumber: orderDetails.orderNumber,
      customerName: orderDetails.customerName,
      customerPhone: orderDetails.customerPhone || '',
      customerEmail: orderDetails.customerEmail || '',
      eventName: orderDetails.eventName,
      totalAmount: orderDetails.totalAmount,
      seats: orderDetails.seats.map(s => ({
        seatNumber: s.seatNumber,
        seatType: s.seatType,
      })),
    }).catch((err) => console.error('[TELEGRAM] Failed to send order pending confirmation notification:', err))
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
      discount_amount: number | null
      promo_code: string | null
      promotion_id: string | null
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

  // Verify access token
  if (!order.access_token_hash || !verifyAccessToken(accessToken, order.access_token_hash)) {
    throw new ForbiddenError('Invalid access token')
  }

  // Get order items joined with seats (seat flow + ticket inventory metadata)
  const items = await query<{
    id: string
    seat_id: string | null
    seat_number: string
    seat_type: string
    price: number
    row: string | null
    section: string | null
    ticket_type_id: string | null
    ticket_type_name: string | null
  }>(
    `SELECT oi.id, oi.seat_id, oi.seat_number, oi.seat_type, oi.price,
            s.row AS row, s.section AS section,
            s.ticket_type_id AS ticket_type_id,
            tt.name AS ticket_type_name
     FROM order_items oi
     LEFT JOIN seats s ON oi.seat_id = s.id
     LEFT JOIN ticket_types tt ON s.ticket_type_id = tt.id
     WHERE oi.order_id = ?`,
    [order.id]
  )

  // Calculate time remaining until expiration
  let timeRemaining = 0
  if (order.expires_at) {
    const expiresAt = new Date(order.expires_at)
    timeRemaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
  }

  const mappedSeats = items.map((item) => ({
    seatId: item.seat_id,
    seatNumber: item.seat_number,
    seatType: item.seat_type,
    row: item.row || '',
    section: item.section || '',
    price: Number(item.price),
    ticketTypeId: item.ticket_type_id || null,
    ticketTypeName: item.ticket_type_name || null,
  }))

  // Inventory view for ticket-class checkout (group by ticket type / price)
  // Does not remove seats[] — seat-map page/email still use seat numbers.
  const lineMap = new Map<
    string,
    {
      ticketTypeId: string | null
      name: string
      unitPrice: number
      quantity: number
      lineTotal: number
    }
  >()
  for (const item of items) {
    const unitPrice = Number(item.price)
    const name =
      (item.ticket_type_name && String(item.ticket_type_name).trim()) ||
      humanizeSeatType(item.seat_type) ||
      'Ticket'
    const key = `${item.ticket_type_id || 'none'}|${name}|${unitPrice}`
    const existing = lineMap.get(key)
    if (existing) {
      existing.quantity += 1
      existing.lineTotal += unitPrice
    } else {
      lineMap.set(key, {
        ticketTypeId: item.ticket_type_id || null,
        name,
        unitPrice,
        quantity: 1,
        lineTotal: unitPrice,
      })
    }
  }
  const ticketLines = Array.from(lineMap.values())
  // Ticket-class if we resolved at least one named ticket type from inventory assign
  const isTicketClassOrder = items.some((i) => !!i.ticket_type_id || !!i.ticket_type_name)

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
    // The discount is applied when the order is created, so total_amount is
    // already net. Return the parts too, otherwise every screen after ticket
    // selection can only show a final number with no sign a promo was
    // applied — which reads as the discount having been lost.
    discountAmount: Number(order.discount_amount || 0),
    subtotal: Number(order.total_amount) + Number(order.discount_amount || 0),
    promoCode: order.promo_code || null,
    promotionId: order.promotion_id || null,
    expiresAt: order.expires_at,
    timeRemaining,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    createdAt: order.created_at,
    // NEW: inventory-style lines for /tickets → checkout
    bookingMode: isTicketClassOrder ? 'TICKET_CLASS' : 'SEAT_MAP',
    ticketLines,
    items: items.map((item) => ({
      id: item.id,
      seatNumber: item.seat_number,
      seatType: item.seat_type,
      price: Number(item.price),
      ticketTypeId: item.ticket_type_id || null,
      ticketTypeName: item.ticket_type_name || null,
    })),
    // KEEP for seat-map flow / legacy clients
    seats: mappedSeats,
  }
}

function humanizeSeatType(seatType: string | null | undefined): string {
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
 * Create a pending order by ticket type(s) + quantity.
 * Supports multi-type cart: items = [{ticketTypeId, quantity}, ...]
 * Auto-assigns AVAILABLE seats from matching tiers.
 * Locks seats in Redis + seat_locks for classic seat-map interop.
 */
export async function createPendingOrderByTicketType(
  params: CreatePendingOrderByTypeParams
): Promise<CreatePendingOrderResult & {seatIds: string[]}> {
  const {eventId, sessionId, promoCode, promotionId: requestedPromotionId, items} = params

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

  // Distributed lock per session+event (covers multi-type)
  const lockKey = `order:create-type:${sessionId}:${eventId}`
  const lockTtl = 30
  const lockAcquired = await redis.set(lockKey, generateUUID(), 'NX', 'EX', lockTtl)
  if (!lockAcquired) {
    throw new BadRequestError('Đơn hàng đang được xử lý. Vui lòng chờ trong giây lát.')
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

    // Resolve + lock seats for each ticket type
    type SeatPick = {
      id: string
      seat_number: string
      seat_type: string
      price: number
      ticketTypeId: string
      ticketTypeName: string
      ticketTypePrice: number
    }
    const allPicked: SeatPick[] = []
    const promoTickets: Array<{id: string; price: number; ticketTypeId: string}> = []
    let rawTotalAmount = 0
    const summaryParts: string[] = []

    // One snapshot for the whole cart, taken inside the per-session lock.
    const usageByType = await getTicketTypeUsage(eventId)

    for (const [ticketTypeId, quantity] of qtyByType) {
      const ticketType = await queryOne<{
        id: string
        name: string
        price: number
        level: number
        max_quantity: number | null
      }>(
        'SELECT id, name, price, level, max_quantity FROM ticket_types WHERE id = ? AND event_id = ? AND is_active = 1',
        [ticketTypeId, eventId]
      )
      if (!ticketType) throw new NotFoundError(`Ticket type not found: ${ticketTypeId}`)

      // Prefer seats already tagged with this ticket_type_id; else seat_type aliases
      // (Early Bird shares LEVEL_2 — max_quantity enforced after pick via inventory).
      const {seatTypeAliasesForTicketType, allocateTicketInventory, isEarlyBirdType} =
        await import('../utils/ticket-seat-match.js')

      // Soft capacity check using exclusive inventory allocation
      try {
        const allTypes = await query<{
          id: string
          name: string
          level: number
          max_quantity: number | null
        }>(
          'SELECT id, name, level, max_quantity FROM ticket_types WHERE event_id = ? AND is_active = 1',
          [eventId]
        )
        const seatStats = await query<{
          ticket_type_id: string | null
          seat_type: string
          status: string
          count: number
        }>(
          `SELECT ticket_type_id, seat_type, status, COUNT(*) as count
           FROM seats WHERE event_id = ?
           GROUP BY ticket_type_id, seat_type, status`,
          [eventId]
        )
        const lockedRows = await query<{
          ticket_type_id: string | null
          seat_type: string
          count: number
        }>(
          `SELECT s.ticket_type_id, s.seat_type, COUNT(*) as count
           FROM seat_locks sl
           JOIN seats s ON sl.seat_id = s.id
           WHERE sl.event_id = ? AND sl.expires_at > NOW() AND s.status = 'AVAILABLE'
           GROUP BY s.ticket_type_id, s.seat_type`,
          [eventId]
        )
        const inv = allocateTicketInventory(allTypes, seatStats, lockedRows)
        const mine = inv.find((x) => x.ticketTypeId === ticketTypeId)
        if (mine && quantity > mine.available) {
          throw new BadRequestError(
            `Không đủ vé loại "${ticketType.name}" còn trống (còn ${mine.available}).`
          )
        }
      } catch (e) {
        if (e instanceof BadRequestError) throw e
        // inventory probe failed — continue with physical seat pick
        console.warn('[CREATE PENDING BY TYPE] inventory probe skipped:', e)
      }

      // The seat probe above only limits by seat stock. A ticket-class order
      // takes a ticket without necessarily taking a seat, so the type's own
      // max_quantity has to be checked too — otherwise a type keeps selling
      // past its cap while seats remain. Checked inside the per-session lock,
      // so the ticket page's view cannot be raced far.
      const capLeft = remainingUnderCap(ticketType.max_quantity, usageByType.get(ticketTypeId))
      if (capLeft != null && quantity > capLeft) {
        throw new BadRequestError(
          capLeft === 0
            ? `Vé loại "${ticketType.name}" đã bán hết.`
            : `Không đủ vé loại "${ticketType.name}" còn trống (còn ${capLeft}).`
        )
      }

      const seatTypeAliases = seatTypeAliasesForTicketType({
        name: ticketType.name,
        level: ticketType.level,
      })

      const aliasPlaceholders = seatTypeAliases.map(() => '?').join(',') || "''"
      // Early Bird may share LEVEL_2 seats already tagged as Standard in DB.
      // Allow alias seat_type match even when ticket_type_id is set to another type
      // (inventory probe already enforced exclusive capacity).
      const candidateSeats = await query<{
        id: string
        seat_number: string
        seat_type: string
        price: number
      }>(
        `SELECT id, seat_number, seat_type, price FROM seats
         WHERE event_id = ? AND status = 'AVAILABLE'
           AND (
             ticket_type_id = ?
             OR UPPER(REPLACE(REPLACE(seat_type, ' ', '_'), '-', '_')) IN (${aliasPlaceholders})
           )
         ORDER BY
           CASE WHEN ticket_type_id = ? THEN 0 ELSE 1 END,
           CASE WHEN ticket_type_id IS NULL OR ticket_type_id = '' THEN 0 ELSE 1 END,
           ${isEarlyBirdType(ticketType) ? 'seat_number DESC,' : ''}
           row ASC,
           seat_number ASC
         LIMIT ?`,
        [
          eventId,
          ticketTypeId,
          ...seatTypeAliases,
          ticketTypeId,
          Math.max(quantity * 8, 40),
        ]
      )

      if (candidateSeats.length < quantity) {
        throw new BadRequestError(
          `Không đủ vé loại "${ticketType.name}" còn trống (còn ${candidateSeats.length}).`
        )
      }

      const available: typeof candidateSeats = []
      for (const seat of candidateSeats) {
        if (available.length >= quantity) break
        // Skip already picked in this same request
        if (allPicked.some((p) => p.id === seat.id)) continue
        const key = `seat:${eventId}:${seat.id}`
        const lockedBy = await redis.get(key)
        if (!lockedBy || lockedBy === sessionId) {
          const dbLock = await queryOne<{session_id: string}>(
            'SELECT session_id FROM seat_locks WHERE seat_id = ? AND expires_at > NOW()',
            [seat.id]
          )
          if (!dbLock || dbLock.session_id === sessionId) {
            available.push(seat)
          }
        }
      }

      if (available.length < quantity) {
        throw new BadRequestError(
          `Không đủ vé loại "${ticketType.name}" còn trống (còn ${available.length}).`
        )
      }

      const picked = available.slice(0, quantity)
      const unitPrice = Number(ticketType.price)
      for (const seat of picked) {
        allPicked.push({
          id: seat.id,
          seat_number: seat.seat_number,
          seat_type: seat.seat_type,
          price: unitPrice,
          ticketTypeId,
          ticketTypeName: ticketType.name,
          ticketTypePrice: unitPrice,
        })
        promoTickets.push({id: seat.id, price: unitPrice, ticketTypeId})
      }
      rawTotalAmount += unitPrice * quantity
      summaryParts.push(`${quantity} x ${ticketType.name}`)
    }

    const seatIds = allPicked.map((s) => s.id)

    // Lock all seats (Redis + seat_locks). Schema may not have ticket_type_id on seat_locks.
    for (const seat of allPicked) {
      await redis.set(
        `seat:${eventId}:${seat.id}`,
        sessionId,
        'EX',
        TICKET_CLASS_LOCK_SECONDS
      )
      try {
        await execute(
          `INSERT INTO seat_locks (id, seat_id, event_id, session_id, ticket_type_id, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), NOW())
           ON DUPLICATE KEY UPDATE session_id = VALUES(session_id), ticket_type_id = VALUES(ticket_type_id), expires_at = VALUES(expires_at)`,
          [
            generateUUID(),
            seat.id,
            eventId,
            sessionId,
            seat.ticketTypeId,
            TICKET_CLASS_LOCK_MINUTES,
          ]
        )
      } catch {
        // Fallback when seat_locks.ticket_type_id column is missing
        await execute(
          `INSERT INTO seat_locks (id, seat_id, event_id, session_id, expires_at, created_at)
           VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), NOW())
           ON DUPLICATE KEY UPDATE session_id = VALUES(session_id), expires_at = VALUES(expires_at)`,
          [generateUUID(), seat.id, eventId, sessionId, TICKET_CLASS_LOCK_MINUTES]
        )
      }
    }

    const discount = await promotionsService.calculateBestDiscount({
      eventId,
      tickets: promoTickets,
      promoCode,
      promotionId: requestedPromotionId,
    })

    let totalAmount = rawTotalAmount
    let discountAmount: number | null = null
    let promotionId: string | null = null
    let appliedPromoCode: string | null = null

    if (discount) {
      discountAmount = discount.discountAmount
      promotionId = discount.promotionId
      totalAmount = Math.max(0, rawTotalAmount - discountAmount)
      if (promoCode) appliedPromoCode = promoCode
    }

    const orderNumber = generateOrderNumber()
    const orderId = generateUUID()
    const {token: accessToken, hash: accessTokenHash} = generateAccessToken()

    await execute(
      `INSERT INTO orders (id, order_number, event_id, total_amount, status, customer_name, customer_email, customer_phone, expires_at, access_token_hash, access_token, discount_amount, promotion_id, promo_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'PENDING', '', '', '', DATE_ADD(NOW(), INTERVAL 15 MINUTE), ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        orderId,
        orderNumber,
        eventId,
        totalAmount,
        accessTokenHash,
        accessToken,
        discountAmount,
        promotionId,
        appliedPromoCode,
      ]
    )

    for (const seat of allPicked) {
      const orderItemId = generateUUID()
      await execute(
        `INSERT INTO order_items (id, order_id, seat_id, price, seat_number, seat_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          orderItemId,
          orderId,
          seat.id,
          seat.ticketTypePrice,
          seat.seat_number,
          seat.seat_type,
        ]
      )
      // Tag seat with ticket type so checkout inventory view + stock counting stay accurate.
      // Does not change seat_number/seat_type — seat-map page still works.
      try {
        await execute(
          `UPDATE seats SET ticket_type_id = ?, updated_at = NOW() WHERE id = ?`,
          [seat.ticketTypeId, seat.id]
        )
      } catch (e) {
        console.warn('[CREATE PENDING BY TYPE] tag ticket_type_id failed:', e)
      }
    }

    if (promotionId) {
      await execute(
        'UPDATE promotions SET used_count = used_count + 1 WHERE id = ?',
        [promotionId]
      )
    }

    const orderData = await queryOne<{expires_at: Date}>(
      'SELECT expires_at FROM orders WHERE id = ?',
      [orderId]
    )

    console.log(
      `[CREATE PENDING ORDER BY TYPE] Created order ${orderNumber} for ${summaryParts.join(', ')}`
    )

    sendOrderNotificationToDevs({
      orderNumber,
      eventName: event.name,
      seats: allPicked.map((s) => ({
        seatNumber: s.seat_number,
        seatType: s.seat_type,
        price: s.ticketTypePrice,
      })),
      totalAmount,
      discountAmount,
      promoCode: appliedPromoCode,
    }).catch((err) => console.error('[NOTIFICATION] Failed:', err))

    return {
      orderId,
      orderNumber,
      totalAmount,
      status: 'PENDING',
      expiresAt: orderData?.expires_at
        ? new Date(orderData.expires_at).toISOString()
        : null,
      accessToken,
      seatIds,
    }
  } finally {
    await redis.del(lockKey)
  }
}
