import { getPool } from '../db/mysql.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const CHECKOUT_LOCK_DURATION_MINUTES = 15;

interface SeatLock extends RowDataPacket {
  seat_id: string;
  session_id: string;
  expires_at: Date;
}

interface LockCount extends RowDataPacket {
  count: number;
}

/**
 * Extend seat lock duration to 15 minutes for checkout
 */
export async function extendSeatLock(
  eventId: string,
  seatIds: string[],
  sessionId: string
) {
  const pool = getPool();

  // Verify all seats are locked by this session
  const placeholders = seatIds.map(() => '?').join(',');
  const [locks] = await pool.query<SeatLock[]>(
    `SELECT seat_id, session_id, expires_at FROM seat_locks
     WHERE seat_id IN (${placeholders}) AND event_id = ?`,
    [...seatIds, eventId]
  );

  // Check if all seats are locked
  if (locks.length !== seatIds.length) {
    throw new Error('Some seats are not locked');
  }

  // Check if all seats are locked by this session
  const notOwnedSeats = locks.filter((lock: SeatLock) => lock.session_id !== sessionId);
  if (notOwnedSeats.length > 0) {
    throw new Error('Some seats are locked by another session');
  }

  // Extend lock duration using MySQL DATE_ADD for timezone safety
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE seat_locks
     SET expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
     WHERE seat_id IN (${placeholders}) AND session_id = ?`,
    [CHECKOUT_LOCK_DURATION_MINUTES, ...seatIds, sessionId]
  );

  // Get new expiry time
  const [expiryResult] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_ADD(NOW(), INTERVAL ? MINUTE) as expires_at,
            TIMESTAMPDIFF(SECOND, NOW(), DATE_ADD(NOW(), INTERVAL ? MINUTE)) as expires_in`,
    [CHECKOUT_LOCK_DURATION_MINUTES, CHECKOUT_LOCK_DURATION_MINUTES]
  );

  return {
    affectedRows: result.affectedRows,
    expiresAt: expiryResult[0].expires_at,
    expiresIn: expiryResult[0].expires_in,
    durationMinutes: CHECKOUT_LOCK_DURATION_MINUTES,
  };
}

/**
 * Get debug info about seat locks
 */
export async function getDebugInfo() {
  const pool = getPool();

  // Check if seat_locks table exists
  const [tables] = await pool.query<RowDataPacket[]>(
    `SHOW TABLES LIKE 'seat_locks'`
  );

  if (tables.length === 0) {
    return {
      tableExists: false,
      error: 'seat_locks table does not exist',
    };
  }

  // Get table structure
  const [structure] = await pool.query('DESCRIBE seat_locks');

  // Get all active locks
  const [activeLocks] = await pool.query(
    `SELECT sl.*, s.seat_number, s.row, s.section
     FROM seat_locks sl
     LEFT JOIN seats s ON sl.seat_id COLLATE utf8mb4_unicode_ci = s.id COLLATE utf8mb4_unicode_ci
     WHERE sl.expires_at > NOW()
     ORDER BY sl.created_at DESC`
  );

  // Get expired locks count
  const [expiredLocks] = await pool.query<LockCount[]>(
    `SELECT COUNT(*) as count FROM seat_locks WHERE expires_at <= NOW()`
  );

  // Get total locks count
  const [totalLocks] = await pool.query<LockCount[]>(
    `SELECT COUNT(*) as count FROM seat_locks`
  );

  return {
    tableExists: true,
    structure,
    activeLocks,
    expiredLocksCount: expiredLocks[0].count,
    totalLocksCount: totalLocks[0].count,
  };
}

/**
 * Create seat_locks table if not exists
 */
export async function createSeatLocksTable() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS seat_locks (
      id VARCHAR(36) PRIMARY KEY,
      seat_id VARCHAR(36) UNIQUE NOT NULL,
      event_id VARCHAR(36) NOT NULL,
      session_id VARCHAR(64) NOT NULL,
      ticket_type_id VARCHAR(36) NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_event_id (event_id),
      INDEX idx_session_id (session_id),
      INDEX idx_expires_at (expires_at)
    )
  `);
  return { success: true };
}

/**
 * Clear expired locks
 */
export async function clearExpiredLocks() {
  const pool = getPool();
  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM seat_locks WHERE expires_at <= NOW()`
  );
  return { affectedRows: result.affectedRows };
}

