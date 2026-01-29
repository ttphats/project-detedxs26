import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute, Layout, LayoutSection } from '@/lib/db';

// GET /api/admin/layouts/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const layout = await queryOne<Layout & { event_name: string }>(
      `SELECT l.*, e.name as event_name 
       FROM layouts l 
       LEFT JOIN events e ON l.event_id = e.id 
       WHERE l.id = ?`,
      [id]
    );

    if (!layout) {
      return NextResponse.json(
        { success: false, error: 'Layout not found' },
        { status: 404 }
      );
    }

    const sections = await query<LayoutSection>(
      'SELECT * FROM layout_sections WHERE layout_id = ? ORDER BY sort_order',
      [id]
    );

    return NextResponse.json({
      success: true,
      data: { ...layout, sections }
    });
  } catch (error: any) {
    console.error('Get layout error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch layout' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/layouts/[id] - Update layout
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, status } = body;

    const layout = await queryOne<Layout>('SELECT * FROM layouts WHERE id = ?', [id]);
    if (!layout) {
      return NextResponse.json(
        { success: false, error: 'Layout not found' },
        { status: 404 }
      );
    }

    const updates: string[] = [];
    const updateParams: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      updateParams.push(name);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      updateParams.push(status);
    }

    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      updateParams.push(id);
      await execute(`UPDATE layouts SET ${updates.join(', ')} WHERE id = ?`, updateParams);
    }

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

// DELETE /api/admin/layouts/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

