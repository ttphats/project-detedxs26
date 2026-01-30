import {NextRequest, NextResponse} from 'next/server'
import {execute} from '@/lib/db'

/**
 * DELETE /api/admin/seat-locks/:id
 * Admin unlocks a specific seat lock
 */
export async function DELETE(
  request: NextRequest,
  {params}: {params: Promise<{id: string}>}
) {
  try {
    const {id} = await params

    // Delete the lock
    await execute('DELETE FROM seat_locks WHERE id = ?', [id])

    console.log(`[ADMIN] Unlocked seat lock ${id}`)

    return NextResponse.json({
      success: true,
      message: 'Seat unlocked successfully',
    })
  } catch (error: unknown) {
    console.error('Admin unlock seat error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to unlock seat',
      },
      {status: 500}
    )
  }
}

