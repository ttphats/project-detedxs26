import { query, execute } from '../db/mysql.js';

interface ExpireOrdersResult {
  totalFound: number;
  successCount: number;
  errorCount: number;
}

// Expire pending orders
export async function expireOrders(): Promise<ExpireOrdersResult> {
  // Find all PENDING orders that have expired
  const expiredOrders = await query<{
    id: string;
    order_number: string;
    event_id: string;
    expires_at: Date;
  }>(
    `SELECT id, order_number, event_id, expires_at 
     FROM orders 
     WHERE status = 'PENDING' AND expires_at < NOW()`
  );

  if (expiredOrders.length === 0) {
    console.log('[EXPIRE ORDERS] No expired orders found');
    return {
      totalFound: 0,
      successCount: 0,
      errorCount: 0,
    };
  }

  console.log(`[EXPIRE ORDERS] Found ${expiredOrders.length} expired orders`);

  let successCount = 0;
  let errorCount = 0;

  // Process each expired order
  for (const order of expiredOrders) {
    try {
      // Get seat IDs for this order
      const seatIds = await query<{ seat_id: string }>(
        'SELECT seat_id FROM order_items WHERE order_id = ?',
        [order.id]
      );

      const seatIdList = seatIds.map((s) => s.seat_id);

      if (seatIdList.length > 0) {
        const placeholders = seatIdList.map(() => '?').join(',');

        // 1. Update order status to EXPIRED
        await execute(
          `UPDATE orders 
           SET status = 'EXPIRED', 
               updated_at = NOW() 
           WHERE id = ?`,
          [order.id]
        );

        // 2. Update payment status to FAILED
        await execute(
          `UPDATE payments 
           SET status = 'FAILED', 
               updated_at = NOW() 
           WHERE order_id = ?`,
          [order.id]
        );

        // 3. Release seats back to AVAILABLE
        await execute(
          `UPDATE seats
           SET status = 'AVAILABLE',
               updated_at = NOW()
           WHERE id COLLATE utf8mb4_unicode_ci IN (${placeholders})`,
          seatIdList
        );

        // 4. Delete seat locks
        await execute(
          `DELETE FROM seat_locks
           WHERE event_id COLLATE utf8mb4_unicode_ci = ?
           AND seat_id COLLATE utf8mb4_unicode_ci IN (${placeholders})`,
          [order.event_id, ...seatIdList]
        );

        console.log(`[EXPIRE ORDERS] Expired order ${order.order_number}, released ${seatIdList.length} seats`);
        successCount++;
      }
    } catch (error) {
      console.error(`[EXPIRE ORDERS] Error processing order ${order.order_number}:`, error);
      errorCount++;
    }
  }

  return {
    totalFound: expiredOrders.length,
    successCount,
    errorCount,
  };
}

// Clean up expired seat locks
export async function cleanupExpiredLocks(): Promise<number> {
  const result = await execute('DELETE FROM seat_locks WHERE expires_at < NOW()');
  console.log(`[CLEANUP] Deleted ${result.affectedRows} expired seat locks`);
  return result.affectedRows;
}

