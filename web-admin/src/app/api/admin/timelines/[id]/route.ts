import { NextRequest, NextResponse } from 'next/server';
import { query, execute, EventTimeline } from '@/lib/db';
import { createAuditLog, getRequestInfo } from '@/lib/audit-logger';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

// Helper to get token from both cookie and Authorization header
async function getTokenFromRequest(request: NextRequest): Promise<string | null> {
  // First try Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  // Fallback to cookie
  const cookieStore = await cookies();
  return cookieStore.get('auth_token')?.value || null;
}

// GET /api/admin/timelines/[id] - Get single timeline
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const timelines = await query<EventTimeline>('SELECT * FROM event_timelines WHERE id = ?', [id]);

    if (timelines.length === 0) {
      return NextResponse.json({ success: false, error: 'Timeline not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: timelines[0] });
  } catch (error: any) {
    console.error('Get timeline error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch timeline' }, { status: 500 });
  }
}

// PUT /api/admin/timelines/[id] - Update timeline
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify auth - support both cookie and Authorization header
    const token = await getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const user = await verifyToken(token);
    if (!user || !['SUPER_ADMIN', 'ADMIN'].includes(user.roleName)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check if exists
    const existing = await query<EventTimeline>('SELECT * FROM event_timelines WHERE id = ?', [id]);
    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: 'Timeline not found' }, { status: 404 });
    }

    const oldValue = existing[0];

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    const fields = ['start_time', 'end_time', 'title', 'description', 'speaker_name', 
                    'speaker_avatar_url', 'type', 'order_index', 'status'];

    for (const field of fields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    // Validate time format if provided
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (body.start_time && !timeRegex.test(body.start_time)) {
      return NextResponse.json({ success: false, error: 'Invalid start_time format' }, { status: 400 });
    }
    if (body.end_time && !timeRegex.test(body.end_time)) {
      return NextResponse.json({ success: false, error: 'Invalid end_time format' }, { status: 400 });
    }

    // Validate type if provided
    if (body.type && !['TALK', 'BREAK', 'CHECKIN', 'OTHER'].includes(body.type)) {
      return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });
    }

    values.push(id);
    await execute(`UPDATE event_timelines SET ${updates.join(', ')} WHERE id = ?`, values);

    // Fetch updated
    const [updated] = await query<EventTimeline>('SELECT * FROM event_timelines WHERE id = ?', [id]);

    // Audit log
    await createAuditLog({
      user,
      action: 'UPDATE',
      entity: 'TIMELINE',
      entityId: id,
      oldValue: { title: oldValue.title, start_time: oldValue.start_time, status: oldValue.status },
      newValue: body,
      metadata: { eventId: oldValue.event_id },
      ...getRequestInfo(request),
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Update timeline error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update timeline' }, { status: 500 });
  }
}

// DELETE /api/admin/timelines/[id] - Delete timeline
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify auth - support both cookie and Authorization header
    const token = await getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const user = await verifyToken(token);
    if (!user || !['SUPER_ADMIN', 'ADMIN'].includes(user.roleName)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Check if exists
    const existing = await query<EventTimeline>('SELECT * FROM event_timelines WHERE id = ?', [id]);
    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: 'Timeline not found' }, { status: 404 });
    }

    await execute('DELETE FROM event_timelines WHERE id = ?', [id]);

    // Audit log
    await createAuditLog({
      user,
      action: 'DELETE',
      entity: 'TIMELINE',
      entityId: id,
      oldValue: { title: existing[0].title, event_id: existing[0].event_id },
      metadata: { eventId: existing[0].event_id },
      ...getRequestInfo(request),
    });

    return NextResponse.json({ success: true, message: 'Timeline deleted' });
  } catch (error: any) {
    console.error('Delete timeline error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete timeline' }, { status: 500 });
  }
}

