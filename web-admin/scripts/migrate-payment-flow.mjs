/**
 * Migration Script: Payment Flow + Email Confirmation
 * 
 * This script adds new columns to the orders table:
 * - email_sent_at: Track when confirmation email was sent
 * - qr_code_url: Store QR code URL for the order
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
const url = new URL(dbUrl);

const config = {
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
};

console.log('🔌 Connecting to database...');
const connection = await mysql.createConnection(config);
console.log('✅ Connected!\n');

console.log('📦 Running Payment Flow Migration...\n');

// Add email_sent_at column to orders table
console.log('1️⃣ Adding email_sent_at column to orders table...');
try {
  await connection.execute(`
    ALTER TABLE orders 
    ADD COLUMN IF NOT EXISTS email_sent_at DATETIME NULL AFTER cancellation_reason
  `);
  console.log('   ✅ email_sent_at column added');
} catch (e) {
  if (e.code === 'ER_DUP_FIELDNAME') {
    console.log('   ℹ️ email_sent_at column already exists');
  } else {
    console.log('   ⚠️ Error:', e.message);
  }
}

// Add qr_code_url column to orders table
console.log('2️⃣ Adding qr_code_url column to orders table...');
try {
  await connection.execute(`
    ALTER TABLE orders 
    ADD COLUMN IF NOT EXISTS qr_code_url VARCHAR(500) NULL AFTER email_sent_at
  `);
  console.log('   ✅ qr_code_url column added');
} catch (e) {
  if (e.code === 'ER_DUP_FIELDNAME') {
    console.log('   ℹ️ qr_code_url column already exists');
  } else {
    console.log('   ⚠️ Error:', e.message);
  }
}

// Verify columns exist
console.log('\n📋 Verifying orders table structure...');
const [columns] = await connection.execute(`
  SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders'
  ORDER BY ORDINAL_POSITION
`, [url.pathname.slice(1)]);

console.log('\nOrders table columns:');
for (const col of columns) {
  console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? 'nullable' : 'required'})`);
}

await connection.end();
console.log('\n✅ Migration completed!\n');

