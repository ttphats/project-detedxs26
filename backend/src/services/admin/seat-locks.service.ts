import { getPool } from '../../db/mysql.js';
import { RowDataPacket } from 'mysql2';

interface SeatLock extends RowDataPacket {
  id: string;
  seat_id: string;
  seat_number: string;
  row: string;
  section: string;
  event_id: string;
  event_name: string;
  session_id: string;
  expires_at: string;
  created_at: string;
}

interface LockCount extends RowDataPacket {
  count: number;
}

interface Event extends RowDataPacket {
  id: string;
  name: string;
}

/**
 * Get all active seat locks (for admin management)
 */
export async function listSeatLocks(eventId?: string) {
  const pool = getPool();

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
  `;

  const params: any[] = [];

  if (eventId) {
    sql += ' AND sl.event_id = ?';
    params.push(eventId);
  }

  sql += ' ORDER BY sl.expires_at ASC';

  // Debug: Check total locks in database (including expired)
  const [allLocks] = await pool.query<LockCount[]>('SELECT COUNT(*) as count FROM seat_locks');
  console.log('[ADMIN SEAT LOCKS] Total locks in DB (including expired):', allLocks[0]?.count);

  const [locks] = await pool.query<SeatLock[]>(sql, params);

  console.log('[ADMIN SEAT LOCKS] Query result:', {
    count: locks.length,
    sql: sql.replace(/\s+/g, ' '),
    params,
  });

  // Calculate time remaining for each lock (use MySQL to avoid timezone issues)
  const [nowResult] = await pool.query<RowDataPacket[]>('SELECT NOW() as now');
  const serverNow = new Date(nowResult[0].now);

  const locksWithTimeRemaining = locks.map((lock: SeatLock) => ({
    ...lock,
    time_remaining: Math.max(
      0,
      Math.floor((new Date(lock.expires_at).getTime() - serverNow.getTime()) / 1000)
    ),
  }));

  // Get all events for filter dropdown
  const [events] = await pool.query<Event[]>('SELECT id, name FROM events ORDER BY created_at DESC');

  return {
    locks: locksWithTimeRemaining,
    events,
  };
}

