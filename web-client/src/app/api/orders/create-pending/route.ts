import {NextRequest, NextResponse} from 'next/server'
import {execute, query, queryOne, Seat} from '@/lib/db'
import {randomUUID} from 'crypto'
import {generateAccessToken} from '@/lib/ticket-token'

// Generate order number: TKH + 6 random chars
function generateOrderNumber(): string {
  return `TKH${Math.random().toString(36).substring(2, 8).toUpperCase()}`
}

interface CreatePendingOrderBody {
  eventId: string
  seatIds: string[]
  sessionId: string
}

/**
 * POST /api/orders/create-pending
 * Create PENDING order when user clicks "Thanh toán" button
 * Does NOT require customer info yet
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreatePendingOrderBody = await request.json()
    const {eventId, seatIds, sessionId} = body

    // Validate required fields
    if (!eventId || !seatIds?.length || !sessionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
        },
        {status: 400}
      )
    }

    // Check event exists and is published
    const event = await queryOne<{id: string; status: string; name: string}>(
      'SELECT id, status, name FROM events WHERE id = ?',
      [eventId]
    )

    if (!event) {
      return NextResponse.json(
        {
          success: false,
          error: 'Event not found',
        },
        {status: 404}
      )
    }

    if (event.status !== 'PUBLISHED') {
      return NextResponse.json(
        {
          success: false,
          error: 'Event is not available for booking',
        },
        {status: 400}
      )
    }

    // Verify seats are locked by this session
    const placeholders = seatIds.map(() => '?').join(',')
    const locks = await query<{seat_id: string; session_id: string}>(
      `SELECT seat_id, session_id FROM seat_locks 
       WHERE seat_id IN (${placeholders}) AND event_id = ?`,
      [...seatIds, eventId]
    )

    if (locks.length !== seatIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'Some seats are not locked',
        },
        {status: 400}
      )
    }

    const notOwnedSeats = locks.filter((lock) => lock.session_id !== sessionId)
    if (notOwnedSeats.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Some seats are locked by another session',
        },
        {status: 403}
      )
    }

    // Get seat details
    const seats = await query<Seat>(
      `SELECT id, seat_number, seat_type, price, row, section FROM seats WHERE id IN (${placeholders})`,
      seatIds
    )

    if (seats.length !== seatIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'Some seats not found',
        },
        {status: 404}
      )
    }

    // Calculate total amount
    const totalAmount = seats.reduce((sum, seat) => sum + Number(seat.price), 0)
    const orderNumber = generateOrderNumber()
    const orderId = randomUUID()

    // Generate access token for ticketless authentication
    const {token: accessToken, hash: accessTokenHash} = generateAccessToken()

    // Create order with PENDING status (no customer info yet)
    // Use MySQL DATE_ADD(NOW(), INTERVAL 15 MINUTE) to avoid timezone issues
    await execute(
      `INSERT INTO orders (id, order_number, event_id, total_amount, status, customer_name, customer_email, customer_phone, expires_at, access_token_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'PENDING', '', '', '', DATE_ADD(NOW(), INTERVAL 15 MINUTE), ?, NOW(), NOW())`,
      [orderId, orderNumber, eventId, totalAmount, accessTokenHash]
    )

    // Create order items
    for (const seat of seats) {
      const orderItemId = randomUUID()
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

    console.log(
      `[CREATE PENDING ORDER] Created order ${orderNumber} for ${seats.length} seats, expires in 15 minutes`
    )

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        orderNumber,
        totalAmount,
        status: 'PENDING',
        expiresAt: orderData?.expires_at ? new Date(orderData.expires_at).toISOString() : null,
        accessToken, // Return token for checkout page
      },
    })
  } catch (error: unknown) {
    console.error('Create pending order error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      {status: 500}
    )
  }
}
