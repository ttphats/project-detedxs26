import { NextRequest, NextResponse } from 'next/server';
import { query, execute, Layout, LayoutSection, Event } from '@/lib/db';
import { randomUUID } from 'crypto';

// GET /api/admin/layouts - List layouts with sections
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    let sql = `
      SELECT l.*, e.name as event_name 
      FROM layouts l 
      LEFT JOIN events e ON l.event_id = e.id 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (eventId) {
      sql += ' AND l.event_id = ?';
      params.push(eventId);
    }

    sql += ' ORDER BY l.created_at DESC';

    const layouts = await query<Layout & { event_name: string }>(sql, params);
    const events = await query<Event>('SELECT id, name FROM events ORDER BY created_at DESC');

    // Fetch sections for each layout
    const layoutsWithSections = await Promise.all(
      layouts.map(async (layout) => {
        const sections = await query<LayoutSection>(
          'SELECT * FROM layout_sections WHERE layout_id = ? ORDER BY sort_order',
          [layout.id]
        );
        return { ...layout, sections };
      })
    );

    return NextResponse.json({
      success: true,
      data: { layouts: layoutsWithSections, events }
    });
  } catch (error: any) {
    console.error('Get layouts error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch layouts' },
      { status: 500 }
    );
  }
}

// POST /api/admin/layouts - Create new layout
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_id, name } = body;

    if (!event_id) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    const id = randomUUID();
    await execute(
      `INSERT INTO layouts (id, event_id, name, status, canvas_width, canvas_height) 
       VALUES (?, ?, ?, 'DRAFT', 1000, 600)`,
      [id, event_id, name || 'New Layout']
    );

    return NextResponse.json({
      success: true,
      data: { id },
      message: 'Layout created successfully'
    });
  } catch (error: any) {
    console.error('Create layout error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create layout' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/layouts - Update layout (name, status)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, status } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Layout ID is required' },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    await execute(`UPDATE layouts SET ${updates.join(', ')} WHERE id = ?`, params);

    return NextResponse.json({
      success: true,
      message: 'Layout updated successfully'
    });
  } catch (error: any) {
    console.error('Update layout error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update layout' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/layouts
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Layout ID is required' },
        { status: 400 }
      );
    }

    await execute('DELETE FROM layouts WHERE id = ?', [id]);

    return NextResponse.json({
      success: true,
      message: 'Layout deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete layout error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete layout' },
      { status: 500 }
    );
  }
}

