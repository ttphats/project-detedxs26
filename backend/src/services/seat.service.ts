import { query, execute, queryOne } from '../db/mysql.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';
import { generateUUID } from '../utils/helpers.js';
import { Seat, SeatLock } from '../types/index.js';

const LOCK_DURATION_MINUTES = 10;

interface LockSeatParams {
  eventId: string;
  seatIds: string[];
  sessionId: string;
  ticketTypeId?: string;
}

interface SeatLockInfo {
  id: string;
  seatNumber: string;
  row: string;
  number: string;
  section: string;
  seatType: string;
  price: number;
  ticketTypeId?: string;
  expiresAt: Date;
}

// Get current locks for a session
export async function getSessionLocks(sessionId: string, eventId: string): Promise<SeatLockInfo[]> {
  const locks = await query<SeatLock & {
    seat_number: string;
    row: string;
    col: string;
    section: string;
    seat_type: string;
    price: number;
    ticket_type_id?: string;
  }>(
    `SELECT sl.*, s.seat_number, s.row, s.col, s.section, s.seat_type, s.price
     FROM seat_locks sl
     JOIN seats s ON sl.seat_id COLLATE utf8mb4_unicode_ci = s.id COLLATE utf8mb4_unicode_ci
     WHERE sl.session_id = ? AND sl.event_id = ? AND sl.expires_at > NOW()`,
    [sessionId, eventId]
  );

  return locks.map((lock) => ({
    id: lock.seat_id,
    seatNumber: lock.seat_number,
    row: lock.row,
    number: lock.col,
    section: lock.section,
    seatType: lock.seat_type,
    price: Number(lock.price),
    ticketTypeId: lock.ticket_type_id,
    expiresAt: lock.expires_at,
  }));
}

// Lock seats for checkout
export async function lockSeats(params: LockSeatParams): Promise<{ lockedSeats: string[]; expiresAt: Date }> {
  const { eventId, seatIds, sessionId, ticketTypeId } = params;

  if (seatIds.length > 10) {
    throw new BadRequestError('Cannot lock more than 10 seats at once');
  }

  // Clean up expired locks first
  await execute('DELETE FROM seat_locks WHERE expires_at < NOW()');

  // Check if seats exist and are available
  const placeholders = seatIds.map(() => '?').join(',');
  const seats = await query<{ id: string; status: string; seat_number: string }>(
    `SELECT id, status, seat_number FROM seats WHERE id IN (${placeholders}) AND event_id = ?`,
    [...seatIds, eventId]
  );

  if (seats.length !== seatIds.length) {
    throw new NotFoundError('Some seats not found');
  }

  // Check for unavailable seats
  const unavailableSeats = seats.filter((s) => s.status === 'SOLD' || s.status === 'RESERVED');
  if (unavailableSeats.length > 0) {
    throw new ConflictError(
      `Seats ${unavailableSeats.map((s) => s.seat_number).join(', ')} are not available`
    );
  }

  // Check existing locks by other sessions
  const existingLocks = await query<SeatLock>(
    `SELECT * FROM seat_locks WHERE seat_id IN (${placeholders}) AND session_id != ? AND expires_at > NOW()`,
    [...seatIds, sessionId]
  );

  if (existingLocks.length > 0) {
    const lockedSeatIds = existingLocks.map((l) => l.seat_id);
    const lockedSeats = seats.filter((s) => lockedSeatIds.includes(s.id));
    throw new ConflictError(
      `Seats ${lockedSeats.map((s) => s.seat_number).join(', ')} are being selected by another customer`
    );
  }

  // Lock seats (upsert)
  const expiresAt = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);

  for (const seatId of seatIds) {
    const lockId = generateUUID();
    await execute(
      `INSERT INTO seat_locks (id, seat_id, event_id, session_id, ticket_type_id, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE session_id = VALUES(session_id), ticket_type_id = VALUES(ticket_type_id), expires_at = VALUES(expires_at)`,
      [lockId, seatId, eventId, sessionId, ticketTypeId || null, expiresAt]
    );
  }

  console.log(`[LOCK] Locked ${seatIds.length} seats for session ${sessionId.substring(0, 15)}...`);

  return {
    lockedSeats: seatIds,
    expiresAt,
  };
}

// Unlock seats
export async function unlockSeats(seatIds: string[], sessionId: string): Promise<void> {
  const placeholders = seatIds.map(() => '?').join(',');
  await execute(
    `DELETE FROM seat_locks WHERE seat_id IN (${placeholders}) AND session_id = ?`,
    [...seatIds, sessionId]
  );
}

// Extend seat lock (for pending orders)
export async function extendSeatLock(eventId: string, orderId: string, hours: number = 24): Promise<void> {
  await execute(
    `UPDATE seat_locks
     SET expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR)
     WHERE event_id COLLATE utf8mb4_unicode_ci = ?
     AND seat_id COLLATE utf8mb4_unicode_ci IN (
       SELECT seat_id FROM order_items WHERE order_id = ?
     )`,
    [hours, eventId, orderId]
  );
}

// Get all seats for an event
export async function getEventSeats(eventId: string, sessionId?: string): Promise<any[]> {
  const seats = await query<Seat & { locked_by?: string; lock_expires_at?: Date }>(
    `SELECT s.*, sl.session_id as locked_by, sl.expires_at as lock_expires_at
     FROM seats s
     LEFT JOIN seat_locks sl ON s.id = sl.seat_id AND sl.expires_at > NOW()
     WHERE s.event_id = ?
     ORDER BY s.row, s.col`,
    [eventId]
  );

  return seats.map((seat) => ({
    ...seat,
    isLockedByMe: sessionId ? seat.locked_by === sessionId : false,
    isLockedByOther: seat.locked_by && seat.locked_by !== sessionId,
  }));
}

