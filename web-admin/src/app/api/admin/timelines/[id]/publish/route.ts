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

// POST /api/admin/timelines/[id]/publish - Toggle publish status
export async function POST(
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
    const { publish } = body; // true = publish, false = unpublish

    // Check if exists
    const existing = await query<EventTimeline>('SELECT * FROM event_timelines WHERE id = ?', [id]);
    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: 'Timeline not found' }, { status: 404 });
    }

    const oldStatus = existing[0].status;
    const newStatus = publish ? 'PUBLISHED' : 'DRAFT';

    if (oldStatus === newStatus) {
      return NextResponse.json({ 
        success: true, 
        message: `Timeline already ${newStatus.toLowerCase()}`,
        data: existing[0]
      });
    }

    await execute('UPDATE event_timelines SET status = ? WHERE id = ?', [newStatus, id]);

    // Fetch updated
    const [updated] = await query<EventTimeline>('SELECT * FROM event_timelines WHERE id = ?', [id]);

    // Audit log
    await createAuditLog({
      user,
      action: publish ? 'PUBLISH' : 'UNPUBLISH',
      entity: 'TIMELINE',
      entityId: id,
      oldValue: { status: oldStatus },
      newValue: { status: newStatus },
      metadata: { eventId: existing[0].event_id, title: existing[0].title },
      ...getRequestInfo(request),
    });

    return NextResponse.json({ 
      success: true, 
      message: `Timeline ${publish ? 'published' : 'unpublished'} successfully`,
      data: updated 
    });
  } catch (error: any) {
    console.error('Toggle publish error:', error);
    return NextResponse.json({ success: false, error: 'Failed to toggle publish status' }, { status: 500 });
  }
}

