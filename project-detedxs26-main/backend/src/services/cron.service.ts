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

  // Process each expired order. There are no seats to release — the
  // ticket stock a PENDING order was holding is freed simply by it no
  // longer counting as live once its status flips to EXPIRED.
  for (const order of expiredOrders) {
    try {
      await execute(
        `UPDATE orders SET status = 'EXPIRED', updated_at = NOW() WHERE id = ?`,
        [order.id]
      );

      await execute(
        `UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE order_id = ?`,
        [order.id]
      );

      console.log(`[EXPIRE ORDERS] Expired order ${order.order_number}`);
      successCount++;
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

// Seat locks no longer exist; kept as a no-op so the /cron/cleanup-locks
// schedule (and anything still calling it) doesn't break.
export async function cleanupExpiredLocks(): Promise<number> {
  return 0;
}

