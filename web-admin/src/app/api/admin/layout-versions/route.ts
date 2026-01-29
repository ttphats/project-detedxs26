import { NextRequest, NextResponse } from 'next/server';
import { query, execute, queryOne } from '@/lib/db';
import { randomUUID } from 'crypto';

// Layout version interface
interface LayoutVersion {
  id: string;
  event_id: string;
  version_name: string;
  description: string | null;
  layout_config: string; // JSON string
  seats_data: string; // JSON string
  status: 'DRAFT' | 'PUBLISHED';
  is_active: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
}

// GET /api/admin/layout-versions - List versions for an event
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    const versions = await query<LayoutVersion>(
      `SELECT * FROM seat_layout_versions 
       WHERE event_id = ? 
       ORDER BY created_at DESC`,
      [eventId]
    );

    // Parse JSON fields
    const parsedVersions = versions.map(v => ({
      ...v,
      layout_config: typeof v.layout_config === 'string' ? JSON.parse(v.layout_config) : v.layout_config,
      seats_data: typeof v.seats_data === 'string' ? JSON.parse(v.seats_data) : v.seats_data,
    }));

    // Get events for dropdown
    const events = await query<{ id: string; name: string }>(
      'SELECT id, name FROM events ORDER BY created_at DESC'
    );

    // Get ticket types for the event
    const ticketTypes = await query<{ id: string; name: string; price: number; color: string }>(
      'SELECT id, name, price, color FROM ticket_types WHERE event_id = ? ORDER BY sort_order',
      [eventId]
    );

    return NextResponse.json({
      success: true,
      data: {
        versions: parsedVersions,
        events,
        ticketTypes,
      }
    });
  } catch (error: any) {
    console.error('Get layout versions error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch layout versions' },
      { status: 500 }
    );
  }
}

// POST /api/admin/layout-versions - Create new draft version
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_id, version_name, description, layout_config, seats_data } = body;

    if (!event_id || !version_name || !layout_config || !seats_data) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const id = randomUUID();
    
    await execute(
      `INSERT INTO seat_layout_versions 
       (id, event_id, version_name, description, layout_config, seats_data, status, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', FALSE, NOW(), NOW())`,
      [
        id,
        event_id,
        version_name,
        description || null,
        JSON.stringify(layout_config),
        JSON.stringify(seats_data),
      ]
    );

    return NextResponse.json({
      success: true,
      data: { id },
      message: 'Draft saved successfully'
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create layout version error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create layout version' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/layout-versions - Delete a draft version
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Version ID is required' },
        { status: 400 }
      );
    }

    // Check if it's a draft
    const version = await queryOne<LayoutVersion>(
      'SELECT * FROM seat_layout_versions WHERE id = ?',
      [id]
    );

    if (!version) {
      return NextResponse.json(
        { success: false, error: 'Version not found' },
        { status: 404 }
      );
    }

    if (version.is_active) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete active version' },
        { status: 400 }
      );
    }

    await execute('DELETE FROM seat_layout_versions WHERE id = ?', [id]);

    return NextResponse.json({
      success: true,
      message: 'Version deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete layout version error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete layout version' },
      { status: 500 }
    );
  }
}

