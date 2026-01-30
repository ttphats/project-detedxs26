import {NextResponse} from 'next/server'
import {query} from '@/lib/db'

/**
 * Debug API to check raw seat_locks data
 */
export async function GET() {
  try {
    // Get all locks without JOIN
    const allLocks = await query('SELECT * FROM seat_locks WHERE expires_at > NOW()')
    
    // Get count
    const count = await query<{count: number}>('SELECT COUNT(*) as count FROM seat_locks')
    
    // Get count of non-expired
    const activeCount = await query<{count: number}>(
      'SELECT COUNT(*) as count FROM seat_locks WHERE expires_at > NOW()'
    )

    return NextResponse.json({
      success: true,
      data: {
        total_in_db: count[0]?.count || 0,
        active_locks: activeCount[0]?.count || 0,
        locks: allLocks,
        current_time: new Date().toISOString(),
      },
    })
  } catch (error: unknown) {
    console.error('Debug seat locks error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      {status: 500}
    )
  }
}

