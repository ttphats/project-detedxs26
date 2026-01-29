import { NextRequest, NextResponse } from 'next/server';
import { query, execute, queryOne } from '@/lib/db';

interface LayoutVersion {
  id: string;
  event_id: string;
  version_name: string;
  layout_config: string;
  seats_data: string;
  status: 'DRAFT' | 'PUBLISHED';
  is_active: boolean;
}

// GET /api/admin/layout-versions/[id] - Get single version
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
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

    return NextResponse.json({
      success: true,
      data: {
        ...version,
        layout_config: typeof version.layout_config === 'string' 
          ? JSON.parse(version.layout_config) 
          : version.layout_config,
        seats_data: typeof version.seats_data === 'string' 
          ? JSON.parse(version.seats_data) 
          : version.seats_data,
      }
    });
  } catch (error: any) {
    console.error('Get layout version error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch layout version' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/layout-versions/[id] - Update draft version
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { version_name, description, layout_config, seats_data } = body;

    // Check version exists and is draft
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
        { success: false, error: 'Cannot edit active version. Create a new draft instead.' },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (version_name) {
      updates.push('version_name = ?');
      values.push(version_name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (layout_config) {
      updates.push('layout_config = ?');
      values.push(JSON.stringify(layout_config));
    }
    if (seats_data) {
      updates.push('seats_data = ?');
      values.push(JSON.stringify(seats_data));
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      );
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    await execute(
      `UPDATE seat_layout_versions SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return NextResponse.json({
      success: true,
      message: 'Version updated successfully'
    });
  } catch (error: any) {
    console.error('Update layout version error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update layout version' },
      { status: 500 }
    );
  }
}

