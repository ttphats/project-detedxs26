import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute, Seat } from '@/lib/db';

// GET /api/admin/seats/[id] - Get single seat
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const seat = await queryOne<Seat>(
      `SELECT s.*, e.name as event_name 
       FROM seats s 
       LEFT JOIN events e ON s.event_id = e.id 
       WHERE s.id = ?`,
      [id]
    );

    if (!seat) {
      return NextResponse.json(
        { success: false, error: 'Seat not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: seat });
  } catch (error: any) {
    console.error('Get seat error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch seat' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/seats/[id] - Update single seat
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, price, seat_type } = body;

    // Check seat exists
    const seat = await queryOne<Seat>('SELECT * FROM seats WHERE id = ?', [id]);
    if (!seat) {
      return NextResponse.json(
        { success: false, error: 'Seat not found' },
        { status: 404 }
      );
    }

    const updates: string[] = [];
    const params_arr: any[] = [];

    if (status) {
      updates.push('status = ?');
      params_arr.push(status);
    }

    if (price !== undefined) {
      updates.push('price = ?');
      params_arr.push(price);
    }

    if (seat_type) {
      updates.push('seat_type = ?');
      params_arr.push(seat_type);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      );
    }

    updates.push('updated_at = NOW()');
    params_arr.push(id);

    await execute(
      `UPDATE seats SET ${updates.join(', ')} WHERE id = ?`,
      params_arr
    );

    const updatedSeat = await queryOne<Seat>('SELECT * FROM seats WHERE id = ?', [id]);

    return NextResponse.json({
      success: true,
      data: updatedSeat,
      message: 'Seat updated successfully'
    });
  } catch (error: any) {
    console.error('Update seat error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update seat' },
      { status: 500 }
    );
  }
}

