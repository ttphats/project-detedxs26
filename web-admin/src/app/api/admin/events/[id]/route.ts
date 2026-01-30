import { NextRequest, NextResponse } from 'next/server';
import { query, execute, Event } from '@/lib/db';

// GET /api/admin/events/[id] - Get single event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const events = await query<Event>(
      'SELECT * FROM events WHERE id = ?',
      [id]
    );

    if (events.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: events[0]
    });
  } catch (error: any) {
    console.error('Get event error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/events/[id] - Update event
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if event exists
    const existing = await query<Event>('SELECT * FROM events WHERE id = ?', [id]);
    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    const fields = [
      'name', 'description', 'venue', 'event_date', 'doors_open_time',
      'start_time', 'end_time', 'status', 'max_capacity', 'available_seats',
      'banner_image_url', 'thumbnail_url', 'is_published'
    ];

    for (const field of fields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        if (['event_date', 'doors_open_time', 'start_time', 'end_time'].includes(field)) {
          values.push(body[field] ? new Date(body[field]) : null);
        } else if (field === 'is_published') {
          values.push(body[field] ? 1 : 0);
          // Also update published_at
          if (body[field] && !existing[0].is_published) {
            updates.push('published_at = ?');
            values.push(new Date());
          }
        } else {
          values.push(body[field]);
        }
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    updates.push('updated_at = ?');
    values.push(new Date());
    values.push(id);

    await execute(
      `UPDATE events SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const [updated] = await query<Event>('SELECT * FROM events WHERE id = ?', [id]);

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Event updated successfully'
    });
  } catch (error: any) {
    console.error('Update event error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update event' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/events/[id] - Delete event
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if event exists
    const existing = await query<Event>('SELECT * FROM events WHERE id = ?', [id]);
    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Check if event has booked seats
    const [bookedCount] = await query<{ count: number }>(
      'SELECT COUNT(*) as count FROM seats WHERE event_id = ? AND status = "BOOKED"',
      [id]
    );

    if (bookedCount.count > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot delete event with ${bookedCount.count} booked seats` },
        { status: 400 }
      );
    }

    // Delete related data first (seats, speakers, ticket_types, layouts)
    await execute('DELETE FROM seats WHERE event_id = ?', [id]);
    await execute('DELETE FROM speakers WHERE event_id = ?', [id]);
    await execute('DELETE FROM ticket_types WHERE event_id = ?', [id]);
    
    // Delete event
    await execute('DELETE FROM events WHERE id = ?', [id]);

    return NextResponse.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete event error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete event' },
      { status: 500 }
    );
  }
}

