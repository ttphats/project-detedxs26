import { NextRequest, NextResponse } from 'next/server';
import { query, execute, EventTimeline } from '@/lib/db';
import { createAuditLog, getRequestInfo } from '@/lib/audit-logger';
import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { verifyToken, getAuthUser } from '@/lib/auth';

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

// GET /api/admin/timelines - Get all timelines (filter by eventId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const status = searchParams.get('status');

    let sql = 'SELECT * FROM event_timelines WHERE 1=1';
    const params: any[] = [];

    if (eventId) {
      sql += ' AND event_id = ?';
      params.push(eventId);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY order_index ASC, start_time ASC';

    const timelines = await query<EventTimeline>(sql, params);

    return NextResponse.json({
      success: true,
      data: timelines
    });
  } catch (error: any) {
    console.error('Get timelines error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch timelines' },
      { status: 500 }
    );
  }
}

// POST /api/admin/timelines - Create new timeline
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      event_id,
      start_time,
      end_time,
      title,
      description,
      speaker_name,
      speaker_avatar_url,
      type = 'OTHER',
      order_index = 0,
      status = 'DRAFT'
    } = body;

    // Validation
    if (!event_id || !start_time || !end_time || !title) {
      return NextResponse.json(
        { success: false, error: 'event_id, start_time, end_time, and title are required' },
        { status: 400 }
      );
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
      return NextResponse.json(
        { success: false, error: 'Invalid time format. Use HH:mm' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['TALK', 'BREAK', 'CHECKIN', 'OTHER'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be TALK, BREAK, CHECKIN, or OTHER' },
        { status: 400 }
      );
    }

    const id = randomUUID();

    await execute(
      `INSERT INTO event_timelines 
       (id, event_id, start_time, end_time, title, description, speaker_name, speaker_avatar_url, type, order_index, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, event_id, start_time, end_time, title, description || null, speaker_name || null, 
       speaker_avatar_url || null, type, order_index, status]
    );

    // Audit log
    await createAuditLog({
      user,
      action: 'CREATE',
      entity: 'TIMELINE',
      entityId: id,
      newValue: { event_id, title, start_time, end_time, type, status },
      metadata: { eventId: event_id },
      ...getRequestInfo(request),
    });

    // Fetch created timeline
    const [created] = await query<EventTimeline>('SELECT * FROM event_timelines WHERE id = ?', [id]);

    return NextResponse.json({
      success: true,
      data: created
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create timeline error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create timeline' },
      { status: 500 }
    );
  }
}

