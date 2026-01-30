import { NextRequest, NextResponse } from 'next/server';
import { query, Seat, SeatLock } from '@/lib/db';

/**
 * GET /api/events/[id]/seats
 * Get seat status with lock information (for polling)
 * Returns seatMap format matching the main event API
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    // Get seats for this event
    const seats = await query<Seat>(
      `SELECT id, seat_number, row, col, section, seat_type, price, status
       FROM seats
       WHERE event_id = ? AND status IN ('AVAILABLE', 'SOLD', 'RESERVED', 'LOCKED')
       ORDER BY row, FIELD(section, 'LEFT', 'RIGHT'), col`,
      [eventId]
    );

    // Get active locks (not expired)
    const locks = await query<SeatLock>(
      `SELECT seat_id, session_id, expires_at FROM seat_locks WHERE event_id = ? AND expires_at > NOW()`,
      [eventId]
    );

    // Create lock map for quick lookup
    const lockMap = new Map(locks.map((l) => [l.seat_id, l]));

    // Group seats by row for seatMap format
    const seatsByRow = seats.reduce((acc: Record<string, Seat[]>, seat) => {
      if (!acc[seat.row]) {
        acc[seat.row] = [];
      }
      acc[seat.row].push(seat);
      return acc;
    }, {});

    // Convert to seatMap format matching web-client
    const seatMap = Object.keys(seatsByRow)
      .sort()
      .map(row => ({
        row,
        seats: seatsByRow[row].map(seat => {
          const lock = lockMap.get(seat.id);
          let status: 'available' | 'sold' | 'locked' | 'locked_by_me' = 'available';

          if (seat.status === 'SOLD' || seat.status === 'RESERVED') {
            status = 'sold';
          } else if (lock) {
            // Seat is locked
            status = lock.session_id === sessionId ? 'locked_by_me' : 'locked';
          }

          return {
            id: seat.id,
            seatNumber: seat.seat_number,
            row: seat.row,
            number: seat.col,
            section: seat.section,
            status,
            seatType: seat.seat_type,
            price: Number(seat.price),
            lockExpiresAt: lock?.expires_at || null,
          };
        }),
      }));

    return NextResponse.json({
      success: true,
      data: { seatMap },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Get seats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch seats' },
      { status: 500 }
    );
  }
}

