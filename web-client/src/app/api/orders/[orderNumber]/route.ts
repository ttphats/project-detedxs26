import {NextRequest, NextResponse} from 'next/server'
import {query, queryOne} from '@/lib/db'
import {verifyAccessToken} from '@/lib/ticket-token'

/**
 * GET /api/orders/[orderNumber]?token=xxx
 * Get order details with access token verification
 */
export async function GET(
  request: NextRequest,
  {params}: {params: Promise<{orderNumber: string}> | {orderNumber: string}}
) {
  try {
    // Await params in case it's a Promise (Next.js 15+)
    const resolvedParams = await Promise.resolve(params)
    const {orderNumber} = resolvedParams
    const searchParams = request.nextUrl.searchParams
    const accessToken = searchParams.get('token')

    console.log('[GET ORDER API] Request:', {orderNumber, hasToken: !!accessToken})

    if (!orderNumber) {
      return NextResponse.json(
        {
          success: false,
          error: 'Order number required',
        },
        {status: 400}
      )
    }

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access token required',
        },
        {status: 401}
      )
    }

    // Get order
    console.log('[GET ORDER API] Querying order:', orderNumber)
    const order = await queryOne<{
      id: string
      order_number: string
      event_id: string
      total_amount: number
      status: string
      customer_name: string
      customer_email: string
      customer_phone: string
      expires_at: Date
      paid_at: Date | null
      access_token_hash: string
      created_at: Date
      time_remaining_seconds: number // Calculated by MySQL to avoid timezone issues
    }>(
      `SELECT id, order_number, event_id, total_amount, status, customer_name, customer_email, customer_phone, expires_at, paid_at, access_token_hash, created_at,
              GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), expires_at)) as time_remaining_seconds
       FROM orders
       WHERE order_number = ?`,
      [orderNumber]
    )

    console.log('[GET ORDER API] Order found:', !!order)

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

    // Get event info
    console.log('[GET ORDER API] Querying event:', order.event_id)
    if (!order.event_id) {
      console.error('[GET ORDER API] ERROR: order.event_id is undefined!')
    }
    const event = await queryOne<{
      id: string
      name: string
      venue: string
      event_date: Date
    }>('SELECT id, name, venue, event_date FROM events WHERE id = ?', [order.event_id])

    console.log('[GET ORDER API] Event found:', !!event)

    // Get order items (seats)
    console.log('[GET ORDER API] Querying seats for order.id:', order.id)
    if (!order.id) {
      console.error('[GET ORDER API] ERROR: order.id is undefined!')
    }
    const seats = await query<{
      seat_id: string
      seat_number: string
      seat_type: string
      price: number
      row: string | null
      section: string | null
    }>(
      `SELECT oi.seat_id, oi.seat_number, oi.seat_type, oi.price,
              COALESCE(s.row, '') as row,
              COALESCE(s.section, '') as section
       FROM order_items oi
       LEFT JOIN seats s ON oi.seat_id = s.id
       WHERE oi.order_id = ?`,
      [order.id]
    )

    console.log('[GET ORDER API] Seats found:', seats.length)

    // Use time_remaining_seconds from MySQL to avoid timezone issues
    const timeRemaining = order.time_remaining_seconds

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        totalAmount: Number(order.total_amount),
        status: order.status,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        expiresAt: order.expires_at.toISOString(),
        paidAt: order.paid_at?.toISOString() || null,
        timeRemaining, // seconds - calculated by MySQL
        createdAt: order.created_at.toISOString(),
        event: event
          ? {
              id: event.id,
              name: event.name,
              venue: event.venue,
              eventDate: event.event_date.toISOString(),
            }
          : null,
        seats: seats.map((seat) => ({
          seatId: seat.seat_id,
          seatNumber: seat.seat_number,
          seatType: seat.seat_type,
          row: seat.row || '',
          section: seat.section || '',
          price: Number(seat.price),
        })),
      },
    })
  } catch (error: unknown) {
    console.error('Get order error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      {status: 500}
    )
  }
}
