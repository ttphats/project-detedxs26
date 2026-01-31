#!/usr/bin/env node
/**
 * Reset Orders & Audit Logs Script
 * 
 * This script clears all order-related data and audit logs for testing purposes.
 * It also resets all seats back to AVAILABLE status.
 * 
 * Tables affected:
 * - email_logs (xóa tất cả)
 * - audit_logs (xóa tất cả)
 * - order_items (xóa tất cả - cascade từ orders)
 * - payments (xóa tất cả - cascade từ orders)
 * - orders (xóa tất cả)
 * - seats (reset status về AVAILABLE)
 * - seat_locks (xóa tất cả)
 * 
 * Usage: node scripts/reset-orders-audit.mjs
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

const config = {
  host: process.env.DB_HOST || '202.92.4.66',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'jyndyeeuhosting_easyticketdb',
  password: process.env.DB_PASSWORD || 'Easyticket@2026',
  database: process.env.DB_NAME || 'jyndyeeuhosting_easyticketdb',
};

console.log('🔄 Reset Orders & Audit Logs Script');
console.log('====================================\n');

async function resetData() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(config);
    console.log('✅ Connected!\n');

    // Disable foreign key checks temporarily
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    // 1. Delete email_logs
    console.log('📧 Deleting email_logs...');
    const [emailResult] = await connection.execute('DELETE FROM email_logs');
    console.log(`   ✅ Deleted ${emailResult.affectedRows} email logs\n`);

    // 2. Delete audit_logs
    console.log('📋 Deleting audit_logs...');
    const [auditResult] = await connection.execute('DELETE FROM audit_logs');
    console.log(`   ✅ Deleted ${auditResult.affectedRows} audit logs\n`);

    // 3. Delete seat_locks (if exists)
    console.log('🔒 Deleting seat_locks...');
    try {
      const [lockResult] = await connection.execute('DELETE FROM seat_locks');
      console.log(`   ✅ Deleted ${lockResult.affectedRows} seat locks\n`);
    } catch (e) {
      console.log('   ⚠️ seat_locks table not found, skipping...\n');
    }

    // 4. Delete order_items (will cascade from orders, but explicit is safer)
    console.log('📦 Deleting order_items...');
    const [itemsResult] = await connection.execute('DELETE FROM order_items');
    console.log(`   ✅ Deleted ${itemsResult.affectedRows} order items\n`);

    // 5. Delete payments
    console.log('💳 Deleting payments...');
    const [paymentsResult] = await connection.execute('DELETE FROM payments');
    console.log(`   ✅ Deleted ${paymentsResult.affectedRows} payments\n`);

    // 6. Delete orders
    console.log('🛒 Deleting orders...');
    const [ordersResult] = await connection.execute('DELETE FROM orders');
    console.log(`   ✅ Deleted ${ordersResult.affectedRows} orders\n`);

    // 7. Reset all seats to AVAILABLE
    console.log('💺 Resetting seats to AVAILABLE...');
    const [seatsResult] = await connection.execute(
      "UPDATE seats SET status = 'AVAILABLE' WHERE status IN ('LOCKED', 'SOLD', 'RESERVED')"
    );
    console.log(`   ✅ Reset ${seatsResult.affectedRows} seats to AVAILABLE\n`);

    // Re-enable foreign key checks
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    // Summary
    console.log('====================================');
    console.log('✅ RESET COMPLETE!');
    console.log('====================================');
    console.log(`📧 Email logs deleted: ${emailResult.affectedRows}`);
    console.log(`📋 Audit logs deleted: ${auditResult.affectedRows}`);
    console.log(`📦 Order items deleted: ${itemsResult.affectedRows}`);
    console.log(`💳 Payments deleted: ${paymentsResult.affectedRows}`);
    console.log(`🛒 Orders deleted: ${ordersResult.affectedRows}`);
    console.log(`💺 Seats reset: ${seatsResult.affectedRows}`);
    console.log('====================================\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed.');
    }
  }
}

resetData();

