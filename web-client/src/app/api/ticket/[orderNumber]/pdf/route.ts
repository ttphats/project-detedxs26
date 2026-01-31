/**
 * API: GET /api/ticket/[orderNumber]/pdf?token=xxx
 * 
 * Generate and download ticket PDF.
 * Uses same token-based access as the ticket view API.
 */

import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { queryOne, query } from '@/lib/db';
import { verifyToken, checkRateLimit, getClientIp } from '@/lib/ticket-token';
import { TicketDocument } from '@/components/pdf/TicketDocument';

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
      return NextResponse.json(
        { success: false, error: 'Invalid access token' },
        { status: 403 }
      );
    }

    // Only allow PDF download for PAID orders
    if (order.status !== 'PAID') {
      return NextResponse.json(
        { success: false, error: 'Ticket not available for download. Payment pending.' },
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

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      TicketDocument({
        orderNumber: order.order_number,
        status: order.status,
        customerName: order.customer_name,
        totalAmount: Number(order.total_amount),
        qrCodeUrl: order.qr_code_url,
        event: event ? {
          name: event.name,
          venue: event.venue,
          eventDate: event.event_date.toString(),
          startTime: event.start_time.toString(),
        } : null,
        seats: seats.map(seat => ({
          seatNumber: seat.seat_number,
          seatType: seat.seat_type,
          price: Number(seat.price),
        })),
      })
    );

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(pdfBuffer);

    // Return PDF with proper headers
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ticket-${orderNumber}.pdf"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}

