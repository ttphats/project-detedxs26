import { getPool } from '../db/mysql.js';
import { RowDataPacket } from 'mysql2';
import { createHash, timingSafeEqual } from 'crypto';
import {
  isHolderToken,
  normalizeHolderEmail,
  resolveHolderEmail,
} from '../utils/holder-token.js';

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
// The order-waiting screen polls this endpoint while a buyer waits for an
// admin to confirm payment, so a legitimate single visitor makes roughly
// 12 requests a minute. The old limit of 10 was below that and guaranteed
// a 429 after about fifty seconds of waiting.
const MAX_REQUESTS = 60;
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

  // Two kinds of token open this page. The order token belongs to the buyer
  // and shows every ticket on the order. A holder token belongs to one
  // attendee and shows only the tickets addressed to them, so a buyer who
  // bought for strangers does not hand each of them everybody else's tickets.
  let holderEmail: string | null = null;
  if (!verifyToken(token, order.access_token_hash)) {
    if (isHolderToken(token)) {
      try {
        const [attendeeRows] = await pool.query<
          (RowDataPacket & { attendee_email: string | null })[]
        >(
          `SELECT DISTINCT attendee_email FROM order_items
           WHERE order_id = ? AND attendee_email IS NOT NULL AND attendee_email <> ''`,
          [order.id]
        );
        holderEmail = resolveHolderEmail(
          orderNumber,
          token,
          (attendeeRows || []).map((r) => r.attendee_email)
        );
      } catch (e) {
        // Older database without the attendee columns — fail closed.
        console.warn('[TICKET] holder token lookup:', e);
      }
    }
    if (!holderEmail) {
      return { error: 'Invalid access token', status: 403 };
    }
  }

  // Get event details
  const [events] = await pool.query<Event[]>(
    `SELECT id, name, venue, event_date, start_time, doors_open_time, banner_image_url, thumbnail_url
     FROM events WHERE id = ?`,
    [order.event_id]
  );

  const event = events[0];

  // Ensure per-ticket columns exist BEFORE selecting them (prod may lag schema)
  try {
    const {ensureOrderItemTicketColumns, ensureTicketUnitsForOrder} = await import(
      '../utils/ticket-unit.js'
    );
    await ensureOrderItemTicketColumns();
    if (order.status === 'PAID') {
      await ensureTicketUnitsForOrder(order.id);
    }
  } catch (e) {
    console.warn('[TICKET] ensure ticket columns/units:', e);
  }

  // Load order items — try full unit columns, fall back if migration missing
  type SeatRow = OrderItem & {
    ticket_type_id: string | null;
    ticket_type_name: string | null;
    ticket_code?: string | null;
    item_qr_code_url?: string | null;
    item_checked_in_at?: Date | null;
    attendee_name?: string | null;
    attendee_email?: string | null;
    attendee_phone?: string | null;
  };

  let seats: SeatRow[] = [];
  try {
    const [rows] = await pool.query<SeatRow[]>(
      `SELECT oi.id, oi.seat_number, oi.seat_type, oi.price,
              oi.ticket_code AS ticket_code,
              oi.qr_code_url AS item_qr_code_url,
              oi.checked_in_at AS item_checked_in_at,
              oi.attendee_name, oi.attendee_email, oi.attendee_phone,
              COALESCE(s.ticket_type_id, oi.ticket_type_id) AS ticket_type_id,
              COALESCE(tt.name, tt2.name) AS ticket_type_name
       FROM order_items oi
       LEFT JOIN seats s ON oi.seat_id = s.id
       LEFT JOIN ticket_types tt ON s.ticket_type_id = tt.id
       LEFT JOIN ticket_types tt2 ON tt2.id = oi.ticket_type_id
       WHERE oi.order_id = ?
       ORDER BY oi.created_at ASC`,
      [order.id],
    );
    seats = rows || [];
  } catch (e) {
    console.warn('[TICKET] full item SELECT failed, fallback basic:', e);
    const [rows] = await pool.query<SeatRow[]>(
      `SELECT oi.id, oi.seat_number, oi.seat_type, oi.price,
              s.ticket_type_id AS ticket_type_id,
              tt.name AS ticket_type_name
       FROM order_items oi
       LEFT JOIN seats s ON oi.seat_id = s.id
       LEFT JOIN ticket_types tt ON s.ticket_type_id = tt.id
       WHERE oi.order_id = ?
       ORDER BY oi.created_at ASC`,
      [order.id],
    );
    seats = (rows || []).map((r) => ({
      ...r,
      ticket_code: null,
      item_qr_code_url: null,
      item_checked_in_at: null,
    }));
  }

  // A holder token only unlocks that holder's own tickets. Everything below —
  // ticket lines, units, check-in progress — is derived from `seats`, so
  // narrowing here scopes the whole response.
  if (holderEmail) {
    seats = seats.filter(
      (s) => normalizeHolderEmail(s.attendee_email || '') === holderEmail,
    );
    if (seats.length === 0) {
      // The token resolved against an attendee email a moment ago, so an empty
      // result means the holder's tickets were reassigned in between.
      return { error: 'Ticket not found', status: 404 };
    }
  }

  // Group into ticket lines for ticket-class UI / email
  const lineMap = new Map<
    string,
    {
      ticketTypeId: string | null;
      name: string;
      unitPrice: number;
      quantity: number;
      lineTotal: number;
    }
  >();
  for (const seat of seats) {
    const unitPrice = Number(seat.price);
    const name =
      (seat.ticket_type_name && String(seat.ticket_type_name).trim()) ||
      humanizeSeatType(seat.seat_type);
    const key = `${seat.ticket_type_id || 'none'}|${name}|${unitPrice}`;
    const cur = lineMap.get(key);
    if (cur) {
      cur.quantity += 1;
      cur.lineTotal += unitPrice;
    } else {
      lineMap.set(key, {
        ticketTypeId: seat.ticket_type_id || null,
        name,
        unitPrice,
        quantity: 1,
        lineTotal: unitPrice,
      });
    }
  }
  const ticketLines = Array.from(lineMap.values());
  const isTicketClass = seats.some(
    (s) => !!s.ticket_type_id || !!s.ticket_type_name,
  );

  const ticketUnits = seats.map((seat: any, index: number) => {
    const typeName =
      (seat.ticket_type_name && String(seat.ticket_type_name).trim()) ||
      humanizeSeatType(seat.seat_type);
    return {
      id: seat.id,
      index: index + 1,
      ticketCode: seat.ticket_code || null,
      qrCodeUrl:
        order.status === 'PAID'
          ? seat.item_qr_code_url || order.qr_code_url
          : null,
      typeName,
      ticketTypeId: seat.ticket_type_id || null,
      seatNumber: seat.seat_number,
      seatType: seat.seat_type,
      price: Number(seat.price),
      checkedIn: !!seat.item_checked_in_at,
      checkedInAt: seat.item_checked_in_at || null,
      attendeeName: seat.attendee_name || null,
      attendeeEmail: seat.attendee_email || null,
      attendeePhone: seat.attendee_phone || null,
    };
  });

  const unitsCheckedIn = ticketUnits.filter((u) => u.checkedIn).length;

  // A scoped holder sees their own name and their own subtotal, not the
  // buyer's name and the order total for tickets they cannot see.
  const scopedName = holderEmail
    ? ticketUnits.find((u) => u.attendeeName)?.attendeeName || order.customer_name
    : order.customer_name;
  const scopedTotal = holderEmail
    ? seats.reduce((sum: number, s: any) => sum + Number(s.price), 0)
    : Number(order.total_amount);

  return {
    data: {
      orderNumber: order.order_number,
      status: order.status,
      customerName: scopedName,
      totalAmount: scopedTotal,
      /** True when a holder token narrowed this to one attendee's tickets. */
      scopedToHolder: !!holderEmail,
      createdAt: order.created_at,
      // Order-level: fully checked in when all units are in
      checkedIn:
        ticketUnits.length > 0
          ? unitsCheckedIn === ticketUnits.length
          : !!order.checked_in_at,
      checkedInAt: order.checked_in_at,
      checkInProgress: {
        total: ticketUnits.length,
        checkedIn: unitsCheckedIn,
        pending: ticketUnits.length - unitsCheckedIn,
      },
      // The order-level QR covers the whole order, so it is meaningless on a
      // holder-scoped view — their per-unit QRs are the ones that check in.
      qrCodeUrl: order.status === 'PAID' && !holderEmail ? order.qr_code_url : null,
      canDownload: order.status === 'PAID',
      // Permanent link auth: token is hash-only (does NOT expire by time)
      tokenNeverExpires: true,
      bookingMode: isTicketClass ? 'TICKET_CLASS' : 'SEAT_MAP',
      ticketLines,
      // Model B: one QR / unique code per physical ticket
      ticketUnits,
      event: event
        ? {
            id: event.id,
            name: event.name,
            venue: event.venue,
            eventDate: event.event_date,
            startTime: event.start_time,
            doorsOpenTime: event.doors_open_time,
            bannerImageUrl: event.banner_image_url,
            thumbnailUrl: event.thumbnail_url,
          }
        : null,
      // Keep seats for seat-map flow
      seats: seats.map((seat: any) => ({
        seatNumber: seat.seat_number,
        seatType: seat.seat_type,
        price: Number(seat.price),
        ticketTypeId: seat.ticket_type_id || null,
        ticketTypeName: seat.ticket_type_name || null,
        ticketCode: seat.ticket_code || null,
        qrCodeUrl: seat.item_qr_code_url || null,
        checkedIn: !!seat.item_checked_in_at,
      })),
    },
  };
}

function humanizeSeatType(seatType: string | null | undefined): string {
  const s = String(seatType || '').toUpperCase();
  if (!s) return 'Ticket';
  if (s.includes('VIP')) return 'VIP';
  if (s.includes('DONOR')) return 'Donor';
  if (s.includes('ECONOMY') || s.includes('EARLY')) return 'Early Bird';
  if (s.includes('STANDARD') || s.includes('LEVEL_2')) return 'Standard';
  if (s.startsWith('LEVEL_')) return s.replace('LEVEL_', 'Level ');
  return s;
}

