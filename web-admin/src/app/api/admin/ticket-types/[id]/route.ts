import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute, TicketType } from '@/lib/db';

// GET /api/admin/ticket-types/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const ticketType = await queryOne<TicketType & { event_name: string }>(
      `SELECT tt.*, e.name as event_name 
       FROM ticket_types tt 
       LEFT JOIN events e ON tt.event_id = e.id 
       WHERE tt.id = ?`,
      [id]
    );

    if (!ticketType) {
      return NextResponse.json(
        { success: false, error: 'Ticket type not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: ticketType });
  } catch (error: any) {
    console.error('Get ticket type error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch ticket type' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/ticket-types/[id] - Update single ticket type
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, price, color, icon, max_quantity, is_active, sort_order } = body;

    const ticketType = await queryOne<TicketType>('SELECT * FROM ticket_types WHERE id = ?', [id]);
    if (!ticketType) {
      return NextResponse.json(
        { success: false, error: 'Ticket type not found' },
        { status: 404 }
      );
    }

    const updates: string[] = [];
    const params_arr: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params_arr.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params_arr.push(description);
    }
    if (price !== undefined) {
      updates.push('price = ?');
      params_arr.push(price);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      params_arr.push(color);
    }
    if (icon !== undefined) {
      updates.push('icon = ?');
      params_arr.push(icon);
    }
    if (max_quantity !== undefined) {
      updates.push('max_quantity = ?');
      params_arr.push(max_quantity);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params_arr.push(is_active);
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      params_arr.push(sort_order);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    updates.push('updated_at = NOW()');
    params_arr.push(id);

    await execute(
      `UPDATE ticket_types SET ${updates.join(', ')} WHERE id = ?`,
      params_arr
    );

    return NextResponse.json({
      success: true,
      message: 'Ticket type updated successfully'
    });
  } catch (error: any) {
    console.error('Update ticket type error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update ticket type' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/ticket-types/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

