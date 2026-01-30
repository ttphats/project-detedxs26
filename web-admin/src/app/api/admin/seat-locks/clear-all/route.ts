import {NextRequest, NextResponse} from 'next/server'
import {execute, queryOne} from '@/lib/db'

/**
 * POST /api/admin/seat-locks/clear-all
 * Admin clears all seat locks (emergency use)
 */
export async function POST(request: NextRequest) {
  try {
    // Count locks before deleting
    const result = await queryOne<{count: number}>(
      'SELECT COUNT(*) as count FROM seat_locks WHERE expires_at > NOW()'
    )
    const count = result?.count || 0

    // Delete all active locks
    await execute('DELETE FROM seat_locks WHERE expires_at > NOW()')

    console.log(`[ADMIN] Cleared all seat locks (${count} locks)`)

    return NextResponse.json({
      success: true,
      data: {count},
      message: `Cleared ${count} seat locks`,
    })
  } catch (error: unknown) {
    console.error('Admin clear all locks error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear locks',
      },
      {status: 500}
    )
  }
}

