import {query, execute, queryOne, transaction} from '../db/mysql.js'
import {BadRequestError, NotFoundError, ForbiddenError} from '../utils/errors.js'
import {
  generateUUID,
  generateOrderNumber,
  generateAccessToken,
  verifyAccessToken,
} from '../utils/helpers.js'
import {Order, Seat} from '../types/index.js'
import {redis} from '../db/redis.js'

interface CreatePendingOrderParams {
  eventId: string
  seatIds: string[]
  sessionId: string
}

interface CreatePendingOrderResult {
  orderId: string
  orderNumber: string
  totalAmount: number
  status: string
  expiresAt: string | null
  accessToken: string
}

// Create a pending order
export async function createPendingOrder(
  params: CreatePendingOrderParams
): Promise<CreatePendingOrderResult> {
  const {eventId, seatIds, sessionId} = params

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
    const totalAmount = seats.reduce((sum, seat) => sum + Number(seat.price), 0)
    const orderNumber = generateOrderNumber()
    const orderId = generateUUID()

    // Generate access token for ticketless authentication
    const {token: accessToken, hash: accessTokenHash} = generateAccessToken()

    // Create order with PENDING status (no customer info yet)
    await execute(
      `INSERT INTO orders (id, order_number, event_id, total_amount, status, customer_name, customer_email, customer_phone, expires_at, access_token_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'PENDING', '', '', '', DATE_ADD(NOW(), INTERVAL 15 MINUTE), ?, NOW(), NOW())`,
      [orderId, orderNumber, eventId, totalAmount, accessTokenHash]
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

    // Get the expires_at from database to return to client
    const orderData = await queryOne<{expires_at: Date}>(
      'SELECT expires_at FROM orders WHERE id = ?',
      [orderId]
    )

    console.log(`[CREATE PENDING ORDER] Created order ${orderNumber} for ${seats.length} seats`)

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
  }>(
    `SELECT id, order_number, status, access_token_hash, event_id
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
  const {orderNumber, accessToken, customerName, customerEmail, customerPhone} = params

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

  // Verify access token
  if (!order.access_token_hash || !verifyAccessToken(accessToken, order.access_token_hash)) {
    throw new ForbiddenError('Invalid access token')
  }

  // Get order items joined with seats to include row/section for seat map rendering
  const items = await query<{
    id: string
    seat_id: string | null
    seat_number: string
    seat_type: string
    price: number
    row: string | null
    section: string | null
  }>(
    `SELECT oi.id, oi.seat_id, oi.seat_number, oi.seat_type, oi.price,
            s.row AS row, s.section AS section
     FROM order_items oi
     LEFT JOIN seats s ON oi.seat_id = s.id
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
    items: items.map((item) => ({
      id: item.id,
      seatNumber: item.seat_number,
      seatType: item.seat_type,
      price: Number(item.price),
    })),
    seats: mappedSeats,
  }
}
