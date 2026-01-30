import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import { Speaker } from '../route';

// GET /api/admin/speakers/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const speaker = await queryOne<Speaker & { event_name: string }>(
      `SELECT s.*, e.name as event_name 
       FROM speakers s 
       LEFT JOIN events e ON s.event_id = e.id 
       WHERE s.id = ?`,
      [id]
    );

    if (!speaker) {
      return NextResponse.json(
        { success: false, error: 'Speaker not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: speaker });
  } catch (error: any) {
    console.error('Get speaker error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch speaker' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/speakers/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, title, company, bio, image_url, topic, social_links, sort_order, is_active } = body;

    const speaker = await queryOne<Speaker>('SELECT * FROM speakers WHERE id = ?', [id]);
    if (!speaker) {
      return NextResponse.json(
        { success: false, error: 'Speaker not found' },
        { status: 404 }
      );
    }

    const updates: string[] = [];
    const params_arr: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); params_arr.push(name); }
    if (title !== undefined) { updates.push('title = ?'); params_arr.push(title); }
    if (company !== undefined) { updates.push('company = ?'); params_arr.push(company); }
    if (bio !== undefined) { updates.push('bio = ?'); params_arr.push(bio); }
    if (image_url !== undefined) { updates.push('image_url = ?'); params_arr.push(image_url); }
    if (topic !== undefined) { updates.push('topic = ?'); params_arr.push(topic); }
    if (social_links !== undefined) { 
      updates.push('social_links = ?'); 
      params_arr.push(JSON.stringify(social_links)); 
    }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params_arr.push(sort_order); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params_arr.push(is_active); }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    updates.push('updated_at = NOW()');
    params_arr.push(id);

    await execute(
      `UPDATE speakers SET ${updates.join(', ')} WHERE id = ?`,
      params_arr
    );

    return NextResponse.json({
      success: true,
      message: 'Speaker updated successfully'
    });
  } catch (error: any) {
    console.error('Update speaker error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update speaker' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/speakers/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const speaker = await queryOne<Speaker>('SELECT * FROM speakers WHERE id = ?', [id]);
    if (!speaker) {
      return NextResponse.json(
        { success: false, error: 'Speaker not found' },
        { status: 404 }
      );
    }

    await execute('DELETE FROM speakers WHERE id = ?', [id]);

    return NextResponse.json({
      success: true,
      message: 'Speaker deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete speaker error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete speaker' },
      { status: 500 }
    );
  }
}

