import { NextRequest, NextResponse } from 'next/server';
import { query, execute, TicketType, Event } from '@/lib/db';
import { randomUUID } from 'crypto';

// GET /api/admin/ticket-types - List all ticket types
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    let sql = `
      SELECT tt.*, e.name as event_name 
      FROM ticket_types tt 
      LEFT JOIN events e ON tt.event_id = e.id 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (eventId) {
      sql += ' AND tt.event_id = ?';
      params.push(eventId);
    }

    sql += ' ORDER BY tt.sort_order, tt.name';

    const ticketTypes = await query<TicketType & { event_name: string }>(sql, params);
    const events = await query<Event>('SELECT id, name FROM events ORDER BY created_at DESC');

    return NextResponse.json({
      success: true,
      data: { ticketTypes, events }
    });
  } catch (error: any) {
    console.error('Get ticket types error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch ticket types' },
      { status: 500 }
    );
  }
}

// POST /api/admin/ticket-types - Create ticket type
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_id, name, description, subtitle, benefits, price, color, icon, max_quantity, sort_order } = body;

    if (!event_id || !name) {
      return NextResponse.json(
        { success: false, error: 'Event ID and name are required' },
        { status: 400 }
      );
    }

    const id = randomUUID();
    await execute(
      `INSERT INTO ticket_types (id, event_id, name, description, subtitle, benefits, price, color, icon, max_quantity, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        event_id,
        name,
        description || null,
        subtitle || null,
        benefits ? JSON.stringify(benefits) : null,
        price || 0,
        color || '#10b981',
        icon || '🎫',
        max_quantity || null,
        sort_order || 0
      ]
    );

    return NextResponse.json({
      success: true,
      data: { id },
      message: 'Ticket type created successfully'
    });
  } catch (error: any) {
    console.error('Create ticket type error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create ticket type' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/ticket-types - Bulk update (assign to seats)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { seatIds, ticket_type_id } = body;

    if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Seat IDs are required' },
        { status: 400 }
      );
    }

    const placeholders = seatIds.map(() => '?').join(',');
    await execute(
      `UPDATE seats SET ticket_type_id = ?, updated_at = NOW() WHERE id IN (${placeholders})`,
      [ticket_type_id, ...seatIds]
    );

    return NextResponse.json({
      success: true,
      message: `Assigned ticket type to ${seatIds.length} seats`
    });
  } catch (error: any) {
    console.error('Assign ticket type error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to assign ticket type' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/ticket-types - Delete ticket type (by id in query)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Ticket type ID is required' },
        { status: 400 }
      );
    }

    // Check if any seats use this ticket type
    const seats = await query('SELECT COUNT(*) as count FROM seats WHERE ticket_type_id = ?', [id]);
    if (seats[0].count > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot delete: ${seats[0].count} seats use this ticket type` },
        { status: 400 }
      );
    }

    await execute('DELETE FROM ticket_types WHERE id = ?', [id]);

    return NextResponse.json({
      success: true,
      message: 'Ticket type deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete ticket type error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete ticket type' },
      { status: 500 }
    );
  }
}

