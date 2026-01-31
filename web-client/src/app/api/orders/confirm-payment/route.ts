import {NextRequest, NextResponse} from 'next/server'
import {execute, queryOne} from '@/lib/db'
import {verifyAccessToken} from '@/lib/ticket-token'

interface ConfirmPaymentBody {
  orderNumber: string
  accessToken: string
  customerName: string
  customerEmail: string
  customerPhone: string
}

/**
 * POST /api/orders/confirm-payment
 * Update order status from PENDING to PENDING_CONFIRMATION when user clicks "Đã thanh toán"
 * Updates customer info and waits for admin confirmation
 */
export async function POST(request: NextRequest) {
  try {
    const body: ConfirmPaymentBody = await request.json()
    const {orderNumber, accessToken, customerName, customerEmail, customerPhone} = body

    // Validate required fields
    if (!orderNumber || !accessToken || !customerName || !customerEmail || !customerPhone) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
        },
        {status: 400}
      )
    }

    // Get order - also check if expired using database NOW() to avoid timezone issues
    const order = await queryOne<{
      id: string
      order_number: string
      status: string
      expires_at: Date
      access_token_hash: string
      event_id: string
      is_expired: number // 1 if expired, 0 if not
    }>(
      `SELECT id, order_number, status, expires_at, access_token_hash, event_id,
              (expires_at < NOW()) as is_expired
       FROM orders WHERE order_number = ?`,
      [orderNumber]
    )

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: 'Order not found',
        },
        {status: 404}
      )
    }

    // Verify access token
    const isValidToken = verifyAccessToken(accessToken, order.access_token_hash)
    if (!isValidToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid access token',
        },
        {status: 403}
      )
    }

    // Check if order is already paid
    if (order.status === 'PAID') {
      return NextResponse.json(
        {
          success: false,
          error: 'Đơn hàng đã được thanh toán và xác nhận',
        },
        {status: 400}
      )
    }

    // Check if order is already pending confirmation
    if (order.status === 'PENDING_CONFIRMATION') {
      return NextResponse.json(
        {
          success: false,
          error: 'Đơn hàng đang chờ admin xác nhận. Vui lòng đợi.',
        },
        {status: 400}
      )
    }

    // Check if order has expired - use database is_expired to avoid timezone issues
    const expiresAt = new Date(order.expires_at)
    console.log(`[CONFIRM PAYMENT] Order ${orderNumber} expires_at: ${expiresAt.toISOString()}, is_expired (from DB): ${order.is_expired}`)

    if (order.is_expired === 1) {
      console.log(`[CONFIRM PAYMENT] Order ${orderNumber} has expired (checked by database NOW())`)
      return NextResponse.json(
        {
          success: false,
          error: 'Order has expired',
        },
        {status: 400}
      )
    }

    // Check if order is cancelled
    if (order.status === 'CANCELLED' || order.status === 'EXPIRED') {
      return NextResponse.json(
        {
          success: false,
          error: `Order is ${order.status.toLowerCase()}`,
        },
        {status: 400}
      )
    }

    // Only allow confirmation for PENDING orders
    if (order.status !== 'PENDING') {
      return NextResponse.json(
        {
          success: false,
          error: `Không thể xác nhận đơn hàng với trạng thái ${order.status}`,
        },
        {status: 400}
      )
    }

    // Update order: set status to PENDING_CONFIRMATION, update customer info
    // Do NOT set paid_at yet - wait for admin confirmation
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

    // Mark seats as RESERVED (not SOLD yet - wait for admin confirmation)
    await execute(
      `UPDATE seats
       SET status = 'RESERVED',
           updated_at = NOW()
       WHERE id COLLATE utf8mb4_unicode_ci IN (
         SELECT seat_id FROM order_items WHERE order_id = ?
       )`,
      [order.id]
    )

    // Keep seat locks until admin confirms (extend to 24 hours for admin review)
    await execute(
      `UPDATE seat_locks
       SET expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR)
       WHERE event_id COLLATE utf8mb4_unicode_ci = ?
       AND seat_id COLLATE utf8mb4_unicode_ci IN (
         SELECT seat_id FROM order_items WHERE order_id = ?
       )`,
      [order.event_id, order.id]
    )

    console.log(
      `[CONFIRM PAYMENT] Order ${orderNumber} set to PENDING_CONFIRMATION by ${customerName}`
    )

    return NextResponse.json({
      success: true,
      data: {
        orderNumber,
        status: 'PENDING_CONFIRMATION',
        message: 'Đang chờ admin xác nhận thanh toán',
      },
    })
  } catch (error: unknown) {
    console.error('Confirm payment error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      {status: 500}
    )
  }
}
