import {NextRequest, NextResponse} from 'next/server'
import {query} from '@/lib/db'

interface SeatLock {
  id: string
  seat_id: string
  seat_number: string
  row: string
  section: string
  event_id: string
  event_name: string
  session_id: string
  expires_at: string
  created_at: string
}

interface Event {
  id: string
  name: string
}

/**
 * GET /api/admin/seat-locks
 * Get all active seat locks (for admin management)
 */
export async function GET(request: NextRequest) {
  try {
    const {searchParams} = new URL(request.url)
    const eventId = searchParams.get('eventId')

    // Build query
    let sql = `
      SELECT
        sl.id,
        sl.seat_id,
        sl.event_id,
        sl.session_id,
        sl.expires_at,
        sl.created_at,
        s.seat_number,
        s.row,
        s.section,
        e.name as event_name
      FROM seat_locks sl
      JOIN seats s ON sl.seat_id COLLATE utf8mb4_unicode_ci = s.id COLLATE utf8mb4_unicode_ci
      JOIN events e ON sl.event_id COLLATE utf8mb4_unicode_ci = e.id COLLATE utf8mb4_unicode_ci
      WHERE sl.expires_at > NOW()
    `

    const params: any[] = []

    if (eventId) {
      sql += ' AND sl.event_id = ?'
      params.push(eventId)
    }

    sql += ' ORDER BY sl.expires_at ASC'

    // Debug: Check total locks in database (including expired)
    const allLocks = await query<{count: number}>('SELECT COUNT(*) as count FROM seat_locks')
    console.log('[ADMIN SEAT LOCKS] Total locks in DB (including expired):', allLocks[0]?.count)

    const locks = await query<SeatLock>(sql, params)

    console.log('[ADMIN SEAT LOCKS] Query result:', {
      count: locks.length,
      sql: sql.replace(/\s+/g, ' '),
      params,
    })

    // Calculate time remaining for each lock
    const locksWithTimeRemaining = locks.map((lock) => ({
      ...lock,
      time_remaining: Math.max(
        0,
        Math.floor((new Date(lock.expires_at).getTime() - Date.now()) / 1000)
      ),
    }))

    // Get all events for filter dropdown
    const events = await query<Event>('SELECT id, name FROM events ORDER BY created_at DESC')

    return NextResponse.json({
      success: true,
      data: {
        locks: locksWithTimeRemaining,
        events,
      },
    })
  } catch (error: unknown) {
    console.error('Get seat locks error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get seat locks',
      },
      {status: 500}
    )
  }
}
