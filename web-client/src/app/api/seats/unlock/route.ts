import { NextRequest, NextResponse } from 'next/server';
import { execute } from '@/lib/db';

/**
 * POST /api/seats/unlock
 * Unlock seats via sendBeacon (for page close/unload events)
 * This is a separate endpoint because sendBeacon only supports POST
 */
export async function POST(request: NextRequest) {
  try {
    // sendBeacon sends data as text/plain, need to parse it
    const text = await request.text();
    let body: { seatIds?: string[]; sessionId?: string };
    
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON',
      }, { status: 400 });
    }

    const { seatIds, sessionId, eventId } = body as { seatIds?: string[]; sessionId?: string; eventId?: string };

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: sessionId',
      }, { status: 400 });
    }

    // If seatIds provided, unlock specific seats. Otherwise unlock all seats for this session
    if (seatIds?.length) {
      const placeholders = seatIds.map(() => '?').join(',');
      await execute(
        `DELETE FROM seat_locks WHERE seat_id IN (${placeholders}) AND session_id = ?`,
        [...seatIds, sessionId]
      );
    } else if (eventId) {
      // Unlock all seats for this session and event
      await execute(
        `DELETE FROM seat_locks WHERE session_id = ? AND event_id = ?`,
        [sessionId, eventId]
      );
    } else {
      // Unlock all seats for this session
      await execute(
        `DELETE FROM seat_locks WHERE session_id = ?`,
        [sessionId]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Seats unlocked successfully',
    });

  } catch (error: unknown) {
    console.error('Unlock seats (beacon) error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to unlock seats',
    }, { status: 500 });
  }
}

