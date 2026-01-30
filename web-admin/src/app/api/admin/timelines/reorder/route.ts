import { NextRequest, NextResponse } from 'next/server';
import { execute, getPool } from '@/lib/db';
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

// POST /api/admin/timelines/reorder - Reorder timelines
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
    const { items, eventId } = body;

    // items: [{ id: string, order_index: number }]
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Items array is required' }, { status: 400 });
    }

    if (!eventId) {
      return NextResponse.json({ success: false, error: 'eventId is required' }, { status: 400 });
    }

    // Update all items in a transaction
    const pool = getPool();
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      for (const item of items) {
        await connection.execute(
          'UPDATE event_timelines SET order_index = ? WHERE id = ? AND event_id = ?',
          [item.order_index, item.id, eventId]
        );
      }

      await connection.commit();

      // Audit log
      await createAuditLog({
        user,
        action: 'REORDER',
        entity: 'TIMELINE',
        entityId: eventId,
        newValue: { items: items.map(i => ({ id: i.id, order: i.order_index })) },
        metadata: { eventId, count: items.length },
        ...getRequestInfo(request),
      });

      return NextResponse.json({ 
        success: true, 
        message: `Reordered ${items.length} timeline items` 
      });
    } catch (txError) {
      await connection.rollback();
      throw txError;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error('Reorder timelines error:', error);
    return NextResponse.json({ success: false, error: 'Failed to reorder timelines' }, { status: 500 });
  }
}

