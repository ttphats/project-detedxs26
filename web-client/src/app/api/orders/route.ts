import { NextRequest, NextResponse } from 'next/server';
import { execute, query, queryOne, Seat, SeatLock } from '@/lib/db';
import { randomUUID } from 'crypto';
import { generateAccessToken, generateTicketUrl } from '@/lib/ticket-token';

// Generate order number: TKH + 6 random chars
function generateOrderNumber(): string {
  return `TKH${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

// Add minutes to date
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

interface CreateOrderBody {
  eventId: string;
  seatIds: string[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  sessionId?: string; // For lock verification
}

/**
 * POST /api/orders
 * Create order from client checkout
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateOrderBody = await request.json();
    const { eventId, seatIds, customerName, customerEmail, customerPhone, sessionId } = body;

    // Validate required fields
    if (!eventId || !seatIds?.length || !customerName || !customerEmail || !customerPhone) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields',
      }, { status: 400 });
    }

    // Check event exists and is published
    const event = await queryOne<{ id: string; status: string; name: string; venue: string; event_date: Date }>(
      'SELECT id, status, name, venue, event_date FROM events WHERE id = ?',
      [eventId]
    );

    if (!event) {
      return NextResponse.json({
        success: false,
        error: 'Event not found',
      }, { status: 404 });
    }

    if (event.status !== 'PUBLISHED') {
      return NextResponse.json({
        success: false,
        error: 'Event is not available for booking',
      }, { status: 409 });
    }

    // Get seats and verify they are available
    const placeholders = seatIds.map(() => '?').join(',');
    const seats = await query<Seat>(
      `SELECT * FROM seats WHERE id IN (${placeholders}) AND event_id = ?`,
      [...seatIds, eventId]
    );

    if (seats.length !== seatIds.length) {
      return NextResponse.json({
        success: false,
        error: 'Some seats not found',
      }, { status: 404 });
    }

    // Check if any seat is not available
    const unavailableSeats = seats.filter((s) => s.status !== 'AVAILABLE');
    if (unavailableSeats.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Seats ${unavailableSeats.map((s) => s.seat_number).join(', ')} are not available`,
      }, { status: 409 });
    }

    // Verify seat locks if sessionId provided
    if (sessionId) {
      // Check if all seats are locked by this session
      const locks = await query<SeatLock>(
        `SELECT seat_id, session_id FROM seat_locks WHERE seat_id IN (${placeholders}) AND expires_at > NOW()`,
        seatIds
      );

      // Check for seats locked by other sessions
      const lockedByOthers = locks.filter((l) => l.session_id !== sessionId);
      if (lockedByOthers.length > 0) {
        const lockedSeatNumbers = seats
          .filter((s) => lockedByOthers.some((l) => l.seat_id === s.id))
          .map((s) => s.seat_number);
        return NextResponse.json({
          success: false,
          error: `Seats ${lockedSeatNumbers.join(', ')} are being selected by another customer`,
        }, { status: 409 });
      }
    }

    // Calculate total amount
    const totalAmount = seats.reduce((sum, seat) => sum + Number(seat.price), 0);
    const orderNumber = generateOrderNumber();
    const orderId = randomUUID();
    const expiresAt = addMinutes(new Date(), 30);

    // Generate access token for ticketless authentication
    const { token: accessToken, hash: accessTokenHash } = generateAccessToken();

    // Create order with access token hash
    await execute(
      `INSERT INTO orders (id, order_number, event_id, total_amount, status, customer_name, customer_email, customer_phone, expires_at, access_token_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, NOW(), NOW())`,
      [orderId, orderNumber, eventId, totalAmount, customerName, customerEmail, customerPhone, expiresAt, accessTokenHash]
    );

    // Create order items
    for (const seat of seats) {
      const orderItemId = randomUUID();
      await execute(
        `INSERT INTO order_items (id, order_id, seat_id, price, seat_number, seat_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [orderItemId, orderId, seat.id, seat.price, seat.seat_number, seat.seat_type]
      );
    }

    // Create payment record
    const paymentId = randomUUID();
    await execute(
      `INSERT INTO payments (id, order_id, payment_method, amount, status, created_at, updated_at)
       VALUES (?, ?, 'BANK_TRANSFER', ?, 'PENDING', NOW(), NOW())`,
      [paymentId, orderId, totalAmount]
    );

    // Mark seats as RESERVED
    await execute(
      `UPDATE seats SET status = 'RESERVED', updated_at = NOW() WHERE id IN (${placeholders})`,
      seatIds
    );

    // Release seat locks (seats are now RESERVED in DB)
    await execute(
      `DELETE FROM seat_locks WHERE seat_id IN (${placeholders})`,
      seatIds
    );

    // Generate ticket URL with access token
    const ticketUrl = generateTicketUrl(orderNumber, accessToken);

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        orderNumber,
        totalAmount,
        status: 'PENDING',
        expiresAt: expiresAt.toISOString(),
        // IMPORTANT: This is the only time the plain token is exposed
        // User must save this URL to access their ticket
        ticketUrl,
        event: {
          id: event.id,
          name: event.name,
          venue: event.venue,
          eventDate: event.event_date,
        },
        seats: seats.map((seat) => ({
          seatNumber: seat.seat_number,
          seatType: seat.seat_type,
          row: seat.row,
          section: seat.section,
          price: Number(seat.price),
        })),
        bankTransferInfo: {
          bankName: 'Ngân hàng Á Châu - ACB',
          accountNumber: '85085588',
          accountName: 'CONG TY TNHH TICKETHUB VN',
          amount: totalAmount,
          transferContent: orderNumber,
          note: `Vui lòng chuyển khoản đúng số tiền và ghi rõ nội dung: ${orderNumber}`,
        },
      },
      message: 'Order created successfully. Please complete bank transfer within 30 minutes.',
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Create order error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create order',
    }, { status: 500 });
  }
}

