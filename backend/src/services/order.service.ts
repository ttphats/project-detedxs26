import { query, execute, queryOne, transaction } from '../db/mysql.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import { generateUUID, generateOrderNumber, generateAccessToken, verifyAccessToken } from '../utils/helpers.js';
import { Order, Seat } from '../types/index.js';

interface CreatePendingOrderParams {
  eventId: string;
  seatIds: string[];
  sessionId: string;
}

interface CreatePendingOrderResult {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  status: string;
  expiresAt: string | null;
  accessToken: string;
}

// Create a pending order
export async function createPendingOrder(params: CreatePendingOrderParams): Promise<CreatePendingOrderResult> {
  const { eventId, seatIds, sessionId } = params;

  // Check event exists and is published
  const event = await queryOne<{ id: string; status: string; name: string }>(
    'SELECT id, status, name FROM events WHERE id = ?',
    [eventId]
  );

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  if (event.status !== 'PUBLISHED') {
    throw new BadRequestError('Event is not available for booking');
  }

  // Verify seats are locked by this session
  const placeholders = seatIds.map(() => '?').join(',');
  const locks = await query<{ seat_id: string; session_id: string }>(
    `SELECT seat_id, session_id FROM seat_locks 
     WHERE seat_id IN (${placeholders}) AND event_id = ?`,
    [...seatIds, eventId]
  );

  if (locks.length !== seatIds.length) {
    throw new BadRequestError('Some seats are not locked');
  }

  const notOwnedSeats = locks.filter((lock) => lock.session_id !== sessionId);
  if (notOwnedSeats.length > 0) {
    throw new ForbiddenError('Some seats are locked by another session');
  }

  // Get seat details
  const seats = await query<Seat>(
    `SELECT id, seat_number, seat_type, price, row, section FROM seats WHERE id IN (${placeholders})`,
    seatIds
  );

  if (seats.length !== seatIds.length) {
    throw new NotFoundError('Some seats not found');
  }

  // Calculate total amount
  const totalAmount = seats.reduce((sum, seat) => sum + Number(seat.price), 0);
  const orderNumber = generateOrderNumber();
  const orderId = generateUUID();

  // Generate access token for ticketless authentication
  const { token: accessToken, hash: accessTokenHash } = generateAccessToken();

  // Create order with PENDING status (no customer info yet)
  await execute(
    `INSERT INTO orders (id, order_number, event_id, total_amount, status, customer_name, customer_email, customer_phone, expires_at, access_token_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'PENDING', '', '', '', DATE_ADD(NOW(), INTERVAL 15 MINUTE), ?, NOW(), NOW())`,
    [orderId, orderNumber, eventId, totalAmount, accessTokenHash]
  );

  // Create order items
  for (const seat of seats) {
    const orderItemId = generateUUID();
    await execute(
      `INSERT INTO order_items (id, order_id, seat_id, price, seat_number, seat_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [orderItemId, orderId, seat.id, seat.price, seat.seat_number, seat.seat_type]
    );
  }

  // Get the expires_at from database to return to client
  const orderData = await queryOne<{ expires_at: Date }>(
    'SELECT expires_at FROM orders WHERE id = ?',
    [orderId]
  );

  console.log(`[CREATE PENDING ORDER] Created order ${orderNumber} for ${seats.length} seats`);

  return {
    orderId,
    orderNumber,
    totalAmount,
    status: 'PENDING',
    expiresAt: orderData?.expires_at ? new Date(orderData.expires_at).toISOString() : null,
    accessToken,
  };
}

interface ConfirmPaymentParams {
  orderNumber: string;
  accessToken: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

// Confirm payment (user clicks "Đã thanh toán")
export async function confirmPayment(params: ConfirmPaymentParams): Promise<{ orderNumber: string; status: string }> {
  const { orderNumber, accessToken, customerName, customerEmail, customerPhone } = params;

  // Get order with expiration check
  const order = await queryOne<{
    id: string;
    order_number: string;
    status: string;
    expires_at: Date;
    access_token_hash: string;
    event_id: string;
    is_expired: number;
  }>(
    `SELECT id, order_number, status, expires_at, access_token_hash, event_id,
            (expires_at < NOW()) as is_expired
     FROM orders WHERE order_number = ?`,
    [orderNumber]
  );

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  // Verify access token
  const isValidToken = verifyAccessToken(accessToken, order.access_token_hash);
  if (!isValidToken) {
    throw new ForbiddenError('Invalid access token');
  }

  // Check order status
  if (order.status === 'PAID') {
    throw new BadRequestError('Đơn hàng đã được thanh toán và xác nhận');
  }

  if (order.status === 'PENDING_CONFIRMATION') {
    throw new BadRequestError('Đơn hàng đang chờ admin xác nhận. Vui lòng đợi.');
  }

  if (order.is_expired === 1) {
    throw new BadRequestError('Order has expired');
  }

  if (order.status === 'CANCELLED' || order.status === 'EXPIRED') {
    throw new BadRequestError(`Order is ${order.status.toLowerCase()}`);
  }

  if (order.status !== 'PENDING') {
    throw new BadRequestError(`Không thể xác nhận đơn hàng với trạng thái ${order.status}`);
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
  );

  // Mark seats as RESERVED
  await execute(
    `UPDATE seats
     SET status = 'RESERVED', updated_at = NOW()
     WHERE id COLLATE utf8mb4_unicode_ci IN (
       SELECT seat_id FROM order_items WHERE order_id = ?
     )`,
    [order.id]
  );

  // Extend seat locks to 24 hours
  await execute(
    `UPDATE seat_locks
     SET expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR)
     WHERE event_id COLLATE utf8mb4_unicode_ci = ?
     AND seat_id COLLATE utf8mb4_unicode_ci IN (
       SELECT seat_id FROM order_items WHERE order_id = ?
     )`,
    [order.event_id, order.id]
  );

  console.log(`[CONFIRM PAYMENT] Order ${orderNumber} set to PENDING_CONFIRMATION`);

  return {
    orderNumber,
    status: 'PENDING_CONFIRMATION',
  };
}

