import {NextRequest, NextResponse} from 'next/server'
import {query} from '@/lib/db'
import {getAuthUser} from '@/lib/auth'
import {randomUUID} from 'crypto'
import {seedDefaultData} from '@/lib/seed'

/**
 * POST /api/admin/settings/reset-data
 * Reset database to default state (for testing)
 * - Deletes all orders, seat_locks, email_logs
 * - Resets all seats to AVAILABLE
 * - Keeps events, ticket_types, email_templates, users
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin auth
    const authHeader = request.headers.get('authorization')
    const user = await getAuthUser(authHeader)

    // Only allow admins
    if (!user || !['SUPER_ADMIN', 'ADMIN'].includes(user.roleName)) {
      return NextResponse.json({success: false, error: 'Unauthorized'}, {status: 403})
    }

    console.log('[RESET] Starting database reset by user:', user.userId)

    // Start transaction-like operations
    // 1. Delete order_items first (foreign key) - old schema uses order_items
    await query('DELETE FROM order_items')
    console.log('[RESET] ✓ Deleted order_items')

    // 2. Delete payments (foreign key to orders) - old schema uses payments
    await query('DELETE FROM payments')
    console.log('[RESET] ✓ Deleted payments')

    // 3. Delete email_logs
    await query('DELETE FROM email_logs')
    console.log('[RESET] ✓ Deleted email_logs')

    // 4. Delete orders
    await query('DELETE FROM orders')
    console.log('[RESET] ✓ Deleted orders')

    // 5. Delete seat_locks
    await query('DELETE FROM seat_locks')
    console.log('[RESET] ✓ Deleted seat_locks')

    // 6. Delete layout versions
    await query('DELETE FROM seat_layout_versions')
    console.log('[RESET] ✓ Deleted layout versions')

    // 7. Delete ALL seats (will be recreated from Layout Editor)
    await query('DELETE FROM seats')
    console.log('[RESET] ✓ Deleted all seats')

    // 8. Update ticket_types sold_quantity to 0
    await query('UPDATE ticket_types SET sold_quantity = 0')
    console.log('[RESET] ✓ Reset ticket types sold_quantity')

    // 9. Update events available_seats to 0 (no seats yet)
    await query('UPDATE events SET available_seats = 0, max_capacity = 0')
    console.log('[RESET] ✓ Reset events capacity to 0 (no seats)')

    // Create audit log
    await query(
      `INSERT INTO audit_logs (id, user_id, user_role, action, entity, entity_id, metadata, ip_address, user_agent)
       VALUES (?, ?, ?, 'RESET_DATABASE', 'System', 'reset-v1', '{"type": "full_reset"}', ?, ?)`,
      [
        randomUUID(),
        user.userId,
        user.roleName,
        request.headers.get('x-forwarded-for') || 'unknown',
        request.headers.get('user-agent') || 'unknown',
      ]
    )

    console.log('[RESET] ✅ Database reset complete')

    // Seed default data
    console.log('[RESET] Starting seed...')
    const seedResult = await seedDefaultData()
    console.log('[RESET] ✅ Seed complete')

    return NextResponse.json({
      success: true,
      message: 'Database reset and seeded successfully',
      data: {
        deletedOrders: true,
        deletedSeatLocks: true,
        deletedEmailLogs: true,
        deletedLayoutVersions: true,
        resetSeats: true,
        updatedEvents: true,
        seedResult,
      },
    })
  } catch (error: any) {
    console.error('[RESET] ❌ Error resetting database:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to reset database',
      },
      {status: 500}
    )
  }
}
