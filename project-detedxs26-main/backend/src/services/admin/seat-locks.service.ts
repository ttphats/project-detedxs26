import {getPool} from '../../db/mysql.js'
import {RowDataPacket} from 'mysql2'
import {redis} from '../../db/redis.js'

interface SeatLock extends RowDataPacket {
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

interface RedisLockInfo {
  seatId: string
  eventId: string
  sessionId: string
  ttl: number // seconds remaining
}

interface LockCount extends RowDataPacket {
  count: number
}

interface Event extends RowDataPacket {
  id: string
  name: string
}

/**
 * Get all active seat locks (for admin management)
 */
export async function listSeatLocks(eventId?: string) {
  const pool = getPool()

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
  const [allLocks] = await pool.query<LockCount[]>('SELECT COUNT(*) as count FROM seat_locks')
  console.log('[ADMIN SEAT LOCKS] Total locks in DB (including expired):', allLocks[0]?.count)

  const [locks] = await pool.query<SeatLock[]>(sql, params)

  console.log('[ADMIN SEAT LOCKS] Query result:', {
    count: locks.length,
    sql: sql.replace(/\s+/g, ' '),
    params,
  })

  // Calculate time remaining for each lock (use MySQL to avoid timezone issues)
  const [nowResult] = await pool.query<RowDataPacket[]>('SELECT NOW() as now')
  const serverNow = new Date(nowResult[0].now)

  const mysqlLocks = locks.map((lock: SeatLock) => ({
    ...lock,
    source: 'mysql',
    time_remaining: Math.max(
      0,
      Math.floor((new Date(lock.expires_at).getTime() - serverNow.getTime()) / 1000)
    ),
  }))

  // 2️⃣ GET REDIS LOCKS
  let redisLocks: any[] = []
  try {
    // Get all Redis keys matching seat:*
    const pattern = eventId ? `seat:${eventId}:*` : 'seat:*'
    const keys = await redis.keys(pattern)

    console.log(`[ADMIN REDIS] Found ${keys.length} Redis lock keys`)

    // Get details for each key
    for (const key of keys) {
      const sessionId = await redis.get(key)
      const ttl = await redis.ttl(key)

      if (sessionId && ttl > 0) {
        // Parse key: seat:eventId:seatId
        const parts = key.split(':')
        const redisEventId = parts[1]
        const redisSeatId = parts[2]

        // Get seat info from database
        const [seatInfo] = await pool.query<any[]>(
          `SELECT s.seat_number, s.row, s.section, e.name as event_name
           FROM seats s
           JOIN events e ON s.event_id = e.id
           WHERE s.id = ? AND s.event_id = ?`,
          [redisSeatId, redisEventId]
        )

        if (seatInfo.length > 0) {
          redisLocks.push({
            id: `redis-${redisSeatId}`,
            seat_id: redisSeatId,
            event_id: redisEventId,
            session_id: sessionId,
            seat_number: seatInfo[0].seat_number,
            row: seatInfo[0].row,
            section: seatInfo[0].section,
            event_name: seatInfo[0].event_name,
            expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
            created_at: null,
            source: 'redis',
            time_remaining: ttl,
          })
        }
      }
    }
  } catch (error) {
    console.error('[ADMIN REDIS] Error fetching Redis locks:', error)
  }

  // 3️⃣ MERGE & DEDUPLICATE
  const mergedLocks = [...mysqlLocks]

  for (const redisLock of redisLocks) {
    const mysqlIndex = mysqlLocks.findIndex((ml) => ml.seat_id === redisLock.seat_id)

    if (mysqlIndex === -1) {
      // Redis-only lock
      mergedLocks.push(redisLock)
    } else {
      // Both exist, use Redis TTL if longer
      if (redisLock.time_remaining > mergedLocks[mysqlIndex].time_remaining) {
        mergedLocks[mysqlIndex] = {
          ...mergedLocks[mysqlIndex],
          source: 'redis+mysql',
          time_remaining: redisLock.time_remaining,
          expires_at: redisLock.expires_at,
        }
      }
    }
  }

  // Sort by time remaining descending
  mergedLocks.sort((a, b) => b.time_remaining - a.time_remaining)

  // Get all events for filter dropdown
  const [events] = await pool.query<Event[]>('SELECT id, name FROM events ORDER BY created_at DESC')

  console.log('[ADMIN SEAT LOCKS] Summary:', {
    mysql: mysqlLocks.length,
    redis: redisLocks.length,
    merged: mergedLocks.length,
  })

  return {
    locks: mergedLocks,
    events,
  }
}

/**
 * Delete a specific seat lock (from BOTH Redis and MySQL)
 */
export async function deleteSeatLock(lockId: string) {
  const pool = getPool()

  // Get seat info before deleting
  const [locks] = await pool.query<SeatLock[]>(
    'SELECT seat_id, event_id FROM seat_locks WHERE id = ?',
    [lockId]
  )

  if (locks.length > 0) {
    const {seat_id, event_id} = locks[0]

    // Delete from Redis
    try {
      const redisKey = `seat:${event_id}:${seat_id}`
      await redis.del(redisKey)
      console.log(`[ADMIN] Deleted Redis lock: ${redisKey}`)
    } catch (error) {
      console.error('[ADMIN] Error deleting Redis lock:', error)
    }
  }

  // Delete from MySQL
  await pool.query('DELETE FROM seat_locks WHERE id = ?', [lockId])

  return {success: true}
}

/**
 * Clear all seat locks (optionally filtered by event) from BOTH Redis and MySQL
 */
export async function clearAllLocks(eventId?: string) {
  const pool = getPool()

  // 1️⃣ Clear Redis locks
  let redisCount = 0
  try {
    const pattern = eventId ? `seat:${eventId}:*` : 'seat:*'
    const keys = await redis.keys(pattern)

    if (keys.length > 0) {
      await redis.del(...keys)
      redisCount = keys.length
      console.log(`[ADMIN] Deleted ${keys.length} Redis locks`)
    }
  } catch (error) {
    console.error('[ADMIN] Error clearing Redis locks:', error)
  }

  // 2️⃣ Clear MySQL locks
  let sql = 'DELETE FROM seat_locks WHERE 1=1'
  const params: any[] = []

  if (eventId) {
    sql += ' AND event_id = ?'
    params.push(eventId)
  }

  const [result] = await pool.query<any>(sql, params)
  const mysqlCount = result.affectedRows || 0

  console.log(`[ADMIN] Cleared ${mysqlCount} MySQL locks, ${redisCount} Redis locks`)

  return {count: mysqlCount + redisCount}
}
