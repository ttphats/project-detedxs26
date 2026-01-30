import {NextRequest, NextResponse} from 'next/server'
import {execute, query, SeatLock} from '@/lib/db'
import {emitSeatRefresh} from '@/lib/seat-events'

const CHECKOUT_LOCK_DURATION_MINUTES = 15 // Extended lock for checkout

/**
 * POST /api/seats/extend-lock
 * Extend seat lock duration from 10 minutes to 15 minutes when proceeding to checkout
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {eventId, seatIds, sessionId} = body

    if (!eventId || !seatIds?.length || !sessionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: eventId, seatIds, sessionId',
        },
        {status: 400}
      )
    }

    // Verify all seats are locked by this session
    const placeholders = seatIds.map(() => '?').join(',')
    const locks = await query<SeatLock>(
      `SELECT seat_id, session_id, expires_at FROM seat_locks 
       WHERE seat_id IN (${placeholders}) AND event_id = ?`,
      [...seatIds, eventId]
    )

    // Check if all seats are locked by this session
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

    // Extend lock duration to 15 minutes
    const newExpiresAt = new Date(Date.now() + CHECKOUT_LOCK_DURATION_MINUTES * 60 * 1000)

    const result = await execute(
      `UPDATE seat_locks
       SET expires_at = ?
       WHERE seat_id IN (${placeholders}) AND session_id = ?`,
      [newExpiresAt, ...seatIds, sessionId]
    )

    console.log(
      `[EXTEND LOCK] Extended ${
        seatIds.length
      } seats to ${CHECKOUT_LOCK_DURATION_MINUTES} minutes for session ${sessionId.substring(
        0,
        15
      )}...`,
      {
        affectedRows: result.affectedRows,
        newExpiresAt: newExpiresAt.toISOString(),
        seatIds,
      }
    )

    // Emit SSE event to notify all connected clients
    emitSeatRefresh(eventId)

    return NextResponse.json({
      success: true,
      data: {
        expiresAt: newExpiresAt.toISOString(),
        expiresIn: CHECKOUT_LOCK_DURATION_MINUTES * 60, // seconds
      },
      message: `Locks extended to ${CHECKOUT_LOCK_DURATION_MINUTES} minutes`,
    })
  } catch (error: unknown) {
    console.error('Extend lock error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to extend lock',
      },
      {status: 500}
    )
  }
}
