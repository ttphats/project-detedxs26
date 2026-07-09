import { getPool } from '../db/mysql.js';
import { RowDataPacket } from 'mysql2';
import { createHash, timingSafeEqual } from 'crypto';

interface Order extends RowDataPacket {
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

interface Event extends RowDataPacket {
  id: string;
  name: string;
  venue: string;
  event_date: Date;
  start_time: Date;
  doors_open_time: Date;
  banner_image_url: string | null;
  thumbnail_url: string | null;
}

interface OrderItem extends RowDataPacket {
  id: string;
  seat_number: string;
  seat_type: string;
  price: number;
}

// Rate limiting map (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS = 10;
const WINDOW_MS = 60000; // 1 minute

/**
 * Verify access token against stored hash
 */
export function verifyToken(token: string, storedHash: string): boolean {
  try {
    const inputHash = createHash('sha256').update(token).digest('hex');
    const inputBuffer = Buffer.from(inputHash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');
    
    if (inputBuffer.length !== storedBuffer.length) {
      return false;
    }
    
    return timingSafeEqual(inputBuffer, storedBuffer);
  } catch {
    return false;
  }
}

/**
 * Check rate limit for client IP
 */
export function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(clientIp);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(clientIp, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Get client IP from headers
 */
export function getClientIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(',')[0].trim();
  }
  const realIp = headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }
  return 'unknown';
}

/**
 * Get ticket by order number with token verification
 */
export async function getTicketByOrderNumber(orderNumber: string, token: string) {
  const pool = getPool();

  // Find order
  const [orders] = await pool.query<Order[]>(
    `SELECT o.*, e.id as event_id
     FROM orders o
     JOIN events e ON o.event_id = e.id
     WHERE o.order_number = ?`,
    [orderNumber]
  );

  const order = orders[0];
  if (!order) {
    return { error: 'Ticket not found', status: 404 };
  }

  // Check if order has access token
  if (!order.access_token_hash) {
    return { error: 'Ticket access not configured', status: 403 };
  }

  // Verify token
  if (!verifyToken(token, order.access_token_hash)) {
    return { error: 'Invalid access token', status: 403 };
  }

  // Get event details
  const [events] = await pool.query<Event[]>(
    `SELECT id, name, venue, event_date, start_time, doors_open_time, banner_image_url, thumbnail_url
     FROM events WHERE id = ?`,
    [order.event_id]
  );

  // Get order items (seats)
  const [seats] = await pool.query<OrderItem[]>(
    `SELECT id, seat_number, seat_type, price FROM order_items WHERE order_id = ?`,
    [order.id]
  );

  const event = events[0];

  return {
    data: {
      orderNumber: order.order_number,
      status: order.status,
      customerName: order.customer_name,
      totalAmount: Number(order.total_amount),
      createdAt: order.created_at,
      checkedIn: !!order.checked_in_at,
      checkedInAt: order.checked_in_at,
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
      seats: seats.map((seat: OrderItem) => ({
        seatNumber: seat.seat_number,
        seatType: seat.seat_type,
        price: Number(seat.price),
      })),
    },
  };
}

