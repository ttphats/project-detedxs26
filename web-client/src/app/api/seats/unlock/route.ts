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

    const { seatIds, sessionId } = body;

    if (!seatIds?.length || !sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: seatIds, sessionId',
      }, { status: 400 });
    }

    // Only unlock seats that belong to this session
    const placeholders = seatIds.map(() => '?').join(',');
    await execute(
      `DELETE FROM seat_locks WHERE seat_id IN (${placeholders}) AND session_id = ?`,
      [...seatIds, sessionId]
    );

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

