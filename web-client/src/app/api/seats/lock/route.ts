import {NextRequest, NextResponse} from 'next/server'
import {execute, query, SeatLock} from '@/lib/db'
import {randomUUID} from 'crypto'
import {emitSeatLock, emitSeatUnlock} from '@/lib/seat-events'

const LOCK_DURATION_MINUTES = 10 // Lock expires after 10 minutes

interface LockSeatsBody {
  eventId: string
  seatIds: string[]
  sessionId: string
  ticketTypeId?: string
}

/**
 * GET /api/seats/lock?sessionId=xxx&eventId=xxx
 * Get current locks for a session (for syncing between tabs)
 */
export async function GET(request: NextRequest) {
  try {
    const {searchParams} = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const eventId = searchParams.get('eventId')

    if (!sessionId || !eventId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required params: sessionId, eventId',
        },
        {status: 400}
      )
    }

    // Get locks for this session
    const locks = await query<
      SeatLock & {
        seat_number: string
        row: string
        col: number
        section: string
        seat_type: string
        price: number
      }
    >(
      `SELECT sl.*, s.seat_number, s.row, s.col, s.section, s.seat_type, s.price
       FROM seat_locks sl
       JOIN seats s ON sl.seat_id COLLATE utf8mb4_unicode_ci = s.id COLLATE utf8mb4_unicode_ci
       WHERE sl.session_id = ? AND sl.event_id = ? AND sl.expires_at > NOW()`,
      [sessionId, eventId]
    )

    const lockedSeats = locks.map((lock) => ({
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

    return NextResponse.json({
      success: true,
      data: {
        locks: lockedSeats,
        expiresAt: locks.length > 0 ? locks[0].expires_at : null,
      },
    })
  } catch (error: unknown) {
    console.error('Get locks error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get locks',
      },
      {status: 500}
    )
  }
}

/**
 * POST /api/seats/lock
 * Lock seats temporarily for checkout process
 */
export async function POST(request: NextRequest) {
  try {
    const body: LockSeatsBody = await request.json()
    const {eventId, seatIds, sessionId, ticketTypeId} = body

    // Validate required fields
    if (!eventId || !seatIds?.length || !sessionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: eventId, seatIds, sessionId',
        },
        {status: 400}
      )
    }

    if (seatIds.length > 10) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot lock more than 10 seats at once',
        },
        {status: 400}
      )
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
      return NextResponse.json(
        {
          success: false,
          error: 'Some seats not found',
        },
        {status: 404}
      )
    }

    // Check for unavailable seats (SOLD, RESERVED)
    const unavailableSeats = seats.filter((s) => s.status === 'SOLD' || s.status === 'RESERVED')
    if (unavailableSeats.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Seats ${unavailableSeats.map((s) => s.seat_number).join(', ')} are not available`,
          unavailableSeats: unavailableSeats.map((s) => s.id),
        },
        {status: 409}
      )
    }

    // Check existing locks (by other sessions)
    const existingLocks = await query<SeatLock>(
      `SELECT * FROM seat_locks WHERE seat_id IN (${placeholders}) AND session_id != ? AND expires_at > NOW()`,
      [...seatIds, sessionId]
    )

    if (existingLocks.length > 0) {
      const lockedSeatIds = existingLocks.map((l) => l.seat_id)
      const lockedSeats = seats.filter((s) => lockedSeatIds.includes(s.id))
      return NextResponse.json(
        {
          success: false,
          error: `Seats ${lockedSeats
            .map((s) => s.seat_number)
            .join(', ')} are being selected by another customer`,
          lockedSeats: lockedSeatIds,
        },
        {status: 409}
      )
    }

    // Lock seats (upsert)
    const expiresAt = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000)

    for (const seatId of seatIds) {
      const lockId = randomUUID()
      // Use INSERT ... ON DUPLICATE KEY UPDATE for upsert
      await execute(
        `INSERT INTO seat_locks (id, seat_id, event_id, session_id, ticket_type_id, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE session_id = VALUES(session_id), ticket_type_id = VALUES(ticket_type_id), expires_at = VALUES(expires_at)`,
        [lockId, seatId, eventId, sessionId, ticketTypeId || null, expiresAt]
      )
    }

    console.log(
      `[LOCK] Locked ${seatIds.length} seats for session ${sessionId.substring(0, 15)}...`,
      {
        seatNumbers: seats.map((s) => s.seat_number),
        expiresAt: expiresAt.toISOString(),
      }
    )

    // Emit SSE event to notify all connected clients
    emitSeatLock(eventId, seatIds, sessionId)

    return NextResponse.json({
      success: true,
      data: {
        lockedSeats: seatIds,
        expiresAt: expiresAt.toISOString(),
        expiresIn: LOCK_DURATION_MINUTES * 60, // seconds
      },
      message: `Seats locked for ${LOCK_DURATION_MINUTES} minutes`,
    })
  } catch (error: unknown) {
    console.error('Lock seats error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to lock seats',
      },
      {status: 500}
    )
  }
}

/**
 * DELETE /api/seats/lock
 * Unlock seats (when user deselects or leaves page)
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const {seatIds, sessionId, eventId} = body

    if (!seatIds?.length || !sessionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: seatIds, sessionId',
        },
        {status: 400}
      )
    }

    // Only unlock seats that belong to this session
    const placeholders = seatIds.map(() => '?').join(',')
    await execute(`DELETE FROM seat_locks WHERE seat_id IN (${placeholders}) AND session_id = ?`, [
      ...seatIds,
      sessionId,
    ])

    // Emit SSE event to notify all connected clients (if eventId provided)
    if (eventId) {
      emitSeatUnlock(eventId, seatIds, sessionId)
    }

    return NextResponse.json({
      success: true,
      message: 'Seats unlocked successfully',
    })
  } catch (error: unknown) {
    console.error('Unlock seats error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to unlock seats',
      },
      {status: 500}
    )
  }
}
