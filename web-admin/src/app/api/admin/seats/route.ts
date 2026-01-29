import { NextRequest, NextResponse } from 'next/server';
import { query, execute, Seat, Event } from '@/lib/db';
import { randomUUID } from 'crypto';

// GET /api/admin/seats - List all seats with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const status = searchParams.get('status');
    const seatType = searchParams.get('seatType');
    const row = searchParams.get('row');

    let sql = `
      SELECT s.*, e.name as event_name 
      FROM seats s 
      LEFT JOIN events e ON s.event_id = e.id 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (eventId) {
      sql += ' AND s.event_id = ?';
      params.push(eventId);
    }

    if (status) {
      sql += ' AND s.status = ?';
      params.push(status);
    }

    if (seatType) {
      sql += ' AND s.seat_type = ?';
      params.push(seatType);
    }

    if (row) {
      sql += ' AND s.row = ?';
      params.push(row);
    }

    sql += ' ORDER BY s.row, s.col';

    const seats = await query<Seat & { event_name: string }>(sql, params);

    // Get events for filter dropdown
    const events = await query<Event>('SELECT id, name FROM events ORDER BY created_at DESC');

    return NextResponse.json({
      success: true,
      data: {
        seats,
        events,
        stats: {
          total: seats.length,
          available: seats.filter(s => s.status === 'AVAILABLE').length,
          reserved: seats.filter(s => s.status === 'RESERVED').length,
          sold: seats.filter(s => s.status === 'SOLD').length,
          locked: seats.filter(s => s.status === 'LOCKED').length,
        }
      }
    });
  } catch (error: any) {
    console.error('Get seats error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch seats' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/seats - Bulk update seats
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { seatIds, status, price } = body;

    if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Seat IDs are required' },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }

    if (price !== undefined) {
      updates.push('price = ?');
      params.push(price);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      );
    }

    updates.push('updated_at = NOW()');

    const placeholders = seatIds.map(() => '?').join(',');
    const sql = `UPDATE seats SET ${updates.join(', ')} WHERE id IN (${placeholders})`;
    
    await execute(sql, [...params, ...seatIds]);

    return NextResponse.json({
      success: true,
      message: `Updated ${seatIds.length} seats`
    });
  } catch (error: any) {
    console.error('Update seats error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update seats' },
      { status: 500 }
    );
  }
}

// POST /api/admin/seats - Create new seat(s)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_id, seats } = body;

    if (!event_id) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    if (!seats || !Array.isArray(seats) || seats.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Seats array is required' },
        { status: 400 }
      );
    }

    // Insert seats
    for (const seat of seats) {
      const id = randomUUID();
      await execute(
        `INSERT INTO seats (id, event_id, seat_number, row, col, section, seat_type, price, status, position_x, position_y, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, ?, NOW(), NOW())`,
        [
          id,
          event_id,
          seat.seat_number || `${seat.row}${seat.col}`,
          seat.row,
          seat.col,
          seat.section || 'MAIN',
          seat.seat_type || 'STANDARD',
          seat.price || 0,
          seat.position_x ?? null,
          seat.position_y ?? null
        ]
      );
    }

    return NextResponse.json({
      success: true,
      message: `Created ${seats.length} seats`
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create seats error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create seats' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/seats - Delete seats
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { seatIds } = body;

    if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Seat IDs are required' },
        { status: 400 }
      );
    }

    // Check if any seat is SOLD
    const placeholders = seatIds.map(() => '?').join(',');
    const soldSeats = await query<Seat>(
      `SELECT id FROM seats WHERE id IN (${placeholders}) AND status = 'SOLD'`,
      seatIds
    );

    if (soldSeats.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete sold seats' },
        { status: 400 }
      );
    }

    await execute(`DELETE FROM seats WHERE id IN (${placeholders})`, seatIds);

    return NextResponse.json({
      success: true,
      message: `Deleted ${seatIds.length} seats`
    });
  } catch (error: any) {
    console.error('Delete seats error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete seats' },
      { status: 500 }
    );
  }
}

