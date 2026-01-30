/**
 * API: GET /api/ticket/[orderNumber]?token=xxx
 * 
 * Public API for viewing ticket without authentication.
 * Uses token-based access with rate limiting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db';
import { verifyToken, checkRateLimit, getClientIp } from '@/lib/ticket-token';

interface Order {
  id: string;
  order_number: string;
  status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_amount: number;
  qr_code_url: string | null;
  access_token_hash: string | null;
  checked_in_at: Date | null;
  checked_in_by: string | null;
  created_at: Date;
  event_id: string;
}

interface Event {
  id: string;
  name: string;
  venue: string;
  event_date: Date;
  start_time: Date;
  doors_open_time: Date;
  banner_image_url: string | null;
  thumbnail_url: string | null;
}

interface OrderItem {
  id: string;
  seat_number: string;
  seat_type: string;
  price: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    const token = request.nextUrl.searchParams.get('token');

    // Require token
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Access token required' },
        { status: 401 }
      );
    }

    // Rate limiting
    const clientIp = getClientIp(request.headers);
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Find order
    const order = await queryOne<Order>(
      `SELECT o.*, e.id as event_id 
       FROM orders o 
       JOIN events e ON o.event_id = e.id 
       WHERE o.order_number = ?`,
      [orderNumber]
    );

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Check if order has access token
    if (!order.access_token_hash) {
      return NextResponse.json(
        { success: false, error: 'Ticket access not configured' },
        { status: 403 }
      );
    }

    // Verify token
    if (!verifyToken(token, order.access_token_hash)) {
      // TODO: Log failed attempt for security monitoring
      return NextResponse.json(
        { success: false, error: 'Invalid access token' },
        { status: 403 }
      );
    }

    // Get event details
    const event = await queryOne<Event>(
      `SELECT id, name, venue, event_date, start_time, doors_open_time, banner_image_url, thumbnail_url 
       FROM events WHERE id = ?`,
      [order.event_id]
    );

    // Get order items (seats)
    const seats = await query<OrderItem>(
      `SELECT id, seat_number, seat_type, price FROM order_items WHERE order_id = ?`,
      [order.id]
    );

    // Return ticket data
    return NextResponse.json({
      success: true,
      data: {
        orderNumber: order.order_number,
        status: order.status,
        customerName: order.customer_name,
        totalAmount: Number(order.total_amount),
        createdAt: order.created_at,
        checkedIn: !!order.checked_in_at,
        checkedInAt: order.checked_in_at,
        // Only show QR code if ticket is PAID
        qrCodeUrl: order.status === 'PAID' ? order.qr_code_url : null,
        canDownload: order.status === 'PAID',
        event: event ? {
          id: event.id,
          name: event.name,
          venue: event.venue,
          eventDate: event.event_date,
          startTime: event.start_time,
          doorsOpenTime: event.doors_open_time,
          bannerImageUrl: event.banner_image_url,
          thumbnailUrl: event.thumbnail_url,
        } : null,
        seats: seats.map(seat => ({
          seatNumber: seat.seat_number,
          seatType: seat.seat_type,
          price: Number(seat.price),
        })),
      },
    });
  } catch (error) {
    console.error('Ticket view error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load ticket' },
      { status: 500 }
    );
  }
}

