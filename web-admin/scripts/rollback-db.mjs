/**
 * Database Rollback Script
 * 
 * Restores database to backup state after testing payment flow
 * Run: node scripts/rollback-db.mjs
 * 
 * Options:
 *   --file=<filename>  Use specific backup file (default: backup-latest.json)
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

const dbUrl = process.env.DATABASE_URL;
const url = new URL(dbUrl);

const config = {
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
};

// Get backup file from args or use latest
const args = process.argv.slice(2);
const fileArg = args.find(a => a.startsWith('--file='));
const backupFileName = fileArg ? fileArg.split('=')[1] : 'backup-latest.json';
const backupFile = path.join(process.cwd(), 'backups', backupFileName);

if (!fs.existsSync(backupFile)) {
  console.error(`❌ Backup file not found: ${backupFile}`);
  console.error('💡 Run "node scripts/backup-db.mjs" first to create a backup.\n');
  process.exit(1);
}

console.log(`📂 Loading backup from: ${backupFile}\n`);
const backup = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));

console.log(`📅 Backup timestamp: ${backup.timestamp}`);
console.log(`🗄️ Database: ${backup.database}\n`);

console.log('🔌 Connecting to database...');
const connection = await mysql.createConnection(config);
console.log('✅ Connected!\n');

console.log('⚠️  WARNING: This will DELETE all current data and restore from backup!');
console.log('    Tables: orders, order_items, payments, seats, email_logs, audit_logs\n');

// Disable foreign key checks for truncation
await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

try {
  // Rollback order matters due to foreign keys
  const rollbackOrder = ['audit_logs', 'email_logs', 'order_items', 'payments', 'orders', 'seats'];

  for (const table of rollbackOrder) {
    const rows = backup.tables[table] || [];
    
    console.log(`🔄 Restoring ${table}...`);
    
    // Truncate table
    await connection.execute(`TRUNCATE TABLE ${table}`);
    
    if (rows.length === 0) {
      console.log(`   ✅ ${table}: cleared (0 rows in backup)`);
      continue;
    }

    // Insert rows
    for (const row of rows) {
      const columns = Object.keys(row);
      const values = Object.values(row);
      const placeholders = columns.map(() => '?').join(', ');
      const columnNames = columns.map(c => `\`${c}\``).join(', ');
      
      try {
        await connection.execute(
          `INSERT INTO ${table} (${columnNames}) VALUES (${placeholders})`,
          values
        );
      } catch (e) {
        console.log(`   ⚠️ Error inserting row: ${e.message}`);
      }
    }
    
    console.log(`   ✅ ${table}: restored ${rows.length} rows`);
  }

  // Reset seats to AVAILABLE for orders that were restored
  console.log('\n🪑 Resetting seat statuses based on order status...');
  
  // Get all PENDING orders seats - set to LOCKED
  const [pendingOrders] = await connection.execute(
    `SELECT oi.seat_id FROM order_items oi 
     JOIN orders o ON oi.order_id = o.id 
     WHERE o.status = 'PENDING'`
  );
  
  if (pendingOrders.length > 0) {
    const pendingSeatIds = pendingOrders.map(r => r.seat_id);
    await connection.execute(
      `UPDATE seats SET status = 'LOCKED' WHERE id IN (${pendingSeatIds.map(() => '?').join(',')})`,
      pendingSeatIds
    );
    console.log(`   ✅ Set ${pendingSeatIds.length} seats to LOCKED (pending orders)`);
  }

  // Get all PAID orders seats - set to SOLD
  const [paidOrders] = await connection.execute(
    `SELECT oi.seat_id FROM order_items oi 
     JOIN orders o ON oi.order_id = o.id 
     WHERE o.status = 'PAID'`
  );
  
  if (paidOrders.length > 0) {
    const paidSeatIds = paidOrders.map(r => r.seat_id);
    await connection.execute(
      `UPDATE seats SET status = 'SOLD' WHERE id IN (${paidSeatIds.map(() => '?').join(',')})`,
      paidSeatIds
    );
    console.log(`   ✅ Set ${paidSeatIds.length} seats to SOLD (paid orders)`);
  }

  console.log('\n✅ Rollback completed successfully!\n');

} finally {
  // Re-enable foreign key checks
  await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
  await connection.end();
}

