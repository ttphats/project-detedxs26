import {query, execute, queryOne} from '../db/mysql.js'
import {BadRequestError, NotFoundError, ConflictError} from '../utils/errors.js'
import {generateUUID} from '../utils/helpers.js'
import {Seat, SeatLock} from '../types/index.js'
import {redis} from '../db/redis.js'
import {config} from '../config/env.js'

const LOCK_DURATION_MINUTES = 10
const LOCK_DURATION_SECONDS = LOCK_DURATION_MINUTES * 60

interface LockSeatParams {
  eventId: string
  seatIds: string[]
  sessionId: string
  ticketTypeId?: string
}

interface SeatLockInfo {
  id: string
  seatNumber: string
  row: string
  number: string
  section: string
  seatType: string
  price: number
  ticketTypeId?: string
  expiresAt: Date
}

// Get current locks for a session
export async function getSessionLocks(sessionId: string, eventId: string): Promise<SeatLockInfo[]> {
  const locks = await query<
    SeatLock & {
      seat_number: string
      row: string
      col: string
      section: string
      seat_type: string
      price: number
      ticket_type_id?: string
    }
  >(
    `SELECT sl.*, s.seat_number, s.row, s.col, s.section, s.seat_type, s.price
     FROM seat_locks sl
     JOIN seats s ON sl.seat_id COLLATE utf8mb4_unicode_ci = s.id COLLATE utf8mb4_unicode_ci
     WHERE sl.session_id = ? AND sl.event_id = ? AND sl.expires_at > NOW()`,
    [sessionId, eventId]
  )

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
  }))
}

// Lock seats for checkout
export async function lockSeats(
  params: LockSeatParams
): Promise<{lockedSeats: string[]; expiresAt: Date}> {
  const {eventId, seatIds, sessionId, ticketTypeId} = params

  if (seatIds.length > 10) {
    throw new BadRequestError('Cannot lock more than 10 seats at once')
  }

  // Clean up expired locks first
  await execute('DELETE FROM seat_locks WHERE expires_at < NOW()')

  // Check if seats exist and are available
  const placeholders = seatIds.map(() => '?').join(',')
  const seats = await query<{id: string; status: string; seat_number: string}>(
    `SELECT id, status, seat_number FROM seats WHERE id IN (${placeholders}) AND event_id = ?`,
    [...seatIds, eventId]
  )

  if (seats.length !== seatIds.length) {
    throw new NotFoundError('Some seats not found')
  }

  // Check for unavailable seats
  const unavailableSeats = seats.filter((s) => s.status === 'SOLD' || s.status === 'RESERVED')
  if (unavailableSeats.length > 0) {
    throw new ConflictError(
      `Seats ${unavailableSeats.map((s) => s.seat_number).join(', ')} are not available`
    )
  }

  // ✅ CHECK REDIS LOCKS FIRST (Primary locking mechanism)
  const lockedByOthers: string[] = []
  for (const seatId of seatIds) {
    const key = `seat:${eventId}:${seatId}`
    const lockedBy = await redis.get(key)

    if (lockedBy && lockedBy !== sessionId) {
      const seat = seats.find((s) => s.id === seatId)
      lockedByOthers.push(seat?.seat_number || seatId)
    }
  }

  if (lockedByOthers.length > 0) {
    throw new ConflictError(
      `Seats ${lockedByOthers.join(', ')} are being selected by another customer`
    )
  }

  // ✅ LOCK IN REDIS (Primary - Fast TTL-based locking)
  const expiresAt = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000)

  for (const seatId of seatIds) {
    const key = `seat:${eventId}:${seatId}`
    // SET with EX (expiry in seconds) - ioredis syntax
    await redis.set(key, sessionId, 'EX', LOCK_DURATION_SECONDS)
  }

  // ✅ LOCK IN MYSQL (Backup/Persistence for recovery)
  for (const seatId of seatIds) {
    const lockId = generateUUID()
    await execute(
      `INSERT INTO seat_locks (id, seat_id, event_id, session_id, ticket_type_id, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE session_id = VALUES(session_id), ticket_type_id = VALUES(ticket_type_id), expires_at = VALUES(expires_at)`,
      [lockId, seatId, eventId, sessionId, ticketTypeId || null, expiresAt]
    )
  }

  console.log(
    `[LOCK] ✅ Redis+MySQL: Locked ${seatIds.length} seats for session ${sessionId.substring(
      0,
      15
    )}...`
  )

  return {
    lockedSeats: seatIds,
    expiresAt,
  }
}

// Unlock seats (Redis + MySQL)
export async function unlockSeats(
  seatIds: string[],
  sessionId: string,
  eventId?: string
): Promise<void> {
  // ✅ UNLOCK FROM REDIS (Primary)
  if (eventId) {
    for (const seatId of seatIds) {
      const key = `seat:${eventId}:${seatId}`
      // Verify ownership before unlocking
      const lockedBy = await redis.get(key)
      if (lockedBy === sessionId) {
        await redis.del(key)
      }
    }
  }

  // ✅ UNLOCK FROM MYSQL (Backup)
  const placeholders = seatIds.map(() => '?').join(',')
  await execute(`DELETE FROM seat_locks WHERE seat_id IN (${placeholders}) AND session_id = ?`, [
    ...seatIds,
    sessionId,
  ])

  console.log(
    `[UNLOCK] ✅ Redis+MySQL: Unlocked ${seatIds.length} seats for session ${sessionId.substring(
      0,
      15
    )}...`
  )
}

// Extend seat lock (for pending orders)
export async function extendSeatLock(
  eventId: string,
  orderId: string,
  hours: number = 24
): Promise<void> {
  await execute(
    `UPDATE seat_locks
     SET expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR)
     WHERE event_id COLLATE utf8mb4_unicode_ci = ?
     AND seat_id COLLATE utf8mb4_unicode_ci IN (
       SELECT seat_id FROM order_items WHERE order_id = ?
     )`,
    [hours, eventId, orderId]
  )
}

// Get all seats for an event
export async function getEventSeats(eventId: string, sessionId?: string): Promise<any> {
  const seats = await query<Seat & {locked_by?: string; lock_expires_at?: Date}>(
    `SELECT s.*, sl.session_id as locked_by, sl.expires_at as lock_expires_at
     FROM seats s
     LEFT JOIN seat_locks sl ON s.id = sl.seat_id AND sl.expires_at > NOW()
     WHERE s.event_id = ?
     ORDER BY s.row, s.col`,
    [eventId]
  )

  // Helper: Extract level from seat_type (LEVEL_1 -> 1)
  const getSeatLevel = (seatType: string): number => {
    const upperType = seatType?.toUpperCase() || ''
    if (upperType.startsWith('LEVEL_')) {
      return parseInt(upperType.replace('LEVEL_', ''), 10)
    }
    return 2 // Default to level 2 (standard)
  }

  // Group seats by row for seatMap format
  const seatsByRow: Record<string, any[]> = {}

  seats.forEach((seat) => {
    if (!seatsByRow[seat.row]) {
      seatsByRow[seat.row] = []
    }

    // Determine status based on DB status and locks
    let status: 'available' | 'sold' | 'locked' | 'locked_by_me' = 'available'

    if (seat.status === 'SOLD' || seat.status === 'RESERVED') {
      status = 'sold'
    } else if (seat.locked_by) {
      status = seat.locked_by === sessionId ? 'locked_by_me' : 'locked'
    }

    seatsByRow[seat.row].push({
      id: seat.id,
      seatNumber: seat.seat_number,
      row: seat.row,
      number: seat.col,
      section: seat.section,
      status,
      seatType: seat.seat_type, // Keep original LEVEL_X format
      level: getSeatLevel(seat.seat_type), // Add level for client-side mapping
      price: Number(seat.price),
      lockExpiresAt: seat.lock_expires_at || null,
    })
  })

  // Convert to seatMap array format
  const seatMap = Object.keys(seatsByRow)
    .sort()
    .map((row) => ({
      row,
      seats: seatsByRow[row],
    }))

  return {seatMap}
}
