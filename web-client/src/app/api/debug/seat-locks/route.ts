import {NextRequest, NextResponse} from 'next/server'
import {query, execute} from '@/lib/db'

/**
 * GET /api/debug/seat-locks
 * Debug endpoint to check seat locks table and current locks
 */
export async function GET(request: NextRequest) {
  try {
    // Check if seat_locks table exists
    const tables = await query<{Tables_in_jyndyeeuhosting_easyticketdb: string}>(
      `SHOW TABLES LIKE 'seat_locks'`
    )

    if (tables.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'seat_locks table does not exist',
          solution: 'Run: node scripts/create-seat-locks-table.js',
        },
        {status: 500}
      )
    }

    // Get table structure
    const structure = await query(`DESCRIBE seat_locks`)

    // Get all active locks
    const activeLocks = await query(
      `SELECT sl.*, s.seat_number, s.row, s.section
       FROM seat_locks sl
       LEFT JOIN seats s ON sl.seat_id COLLATE utf8mb4_unicode_ci = s.id COLLATE utf8mb4_unicode_ci
       WHERE sl.expires_at > NOW()
       ORDER BY sl.created_at DESC`
    )

    // Get expired locks (for debugging)
    const expiredLocks = await query(
      `SELECT COUNT(*) as count FROM seat_locks WHERE expires_at <= NOW()`
    )

    // Get total locks
    const totalLocks = await query(`SELECT COUNT(*) as count FROM seat_locks`)

    return NextResponse.json({
      success: true,
      data: {
        tableExists: true,
        structure,
        activeLocks,
        expiredLocksCount: expiredLocks[0],
        totalLocksCount: totalLocks[0],
      },
    })
  } catch (error: any) {
    console.error('Debug seat locks error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      {status: 500}
    )
  }
}

/**
 * POST /api/debug/seat-locks
 * Create seat_locks table if it doesn't exist
 */
export async function POST(request: NextRequest) {
  try {
    await execute(`
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
    `)

    return NextResponse.json({
      success: true,
      message: 'seat_locks table created successfully',
    })
  } catch (error: any) {
    console.error('Create seat_locks table error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      {status: 500}
    )
  }
}

/**
 * DELETE /api/debug/seat-locks
 * Clear all expired locks
 */
export async function DELETE(request: NextRequest) {
  try {
    const result = await execute(`DELETE FROM seat_locks WHERE expires_at <= NOW()`)

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.affectedRows} expired locks`,
      affectedRows: result.affectedRows,
    })
  } catch (error: any) {
    console.error('Delete expired locks error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      {status: 500}
    )
  }
}
