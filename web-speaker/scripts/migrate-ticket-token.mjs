/**
 * Migration Script: Add ticketless authentication columns to orders table
 *
 * This script adds:
 * - access_token_hash: SHA-256 hash of access token for ticketless auth
 * - checked_in_at: Timestamp when ticket was checked in
 * - checked_in_by: Staff user ID who performed check-in
 *
 * Run: node scripts/migrate-ticket-token.mjs
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment');
  process.exit(1);
}

async function main() {
  const url = new URL(DATABASE_URL);
  
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  });

  console.log('🔌 Connected to database');

  try {
    // Check if columns already exist
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders'
    `, [url.pathname.slice(1)]);

    const columnNames = columns.map(c => c.COLUMN_NAME);

    // Add access_token_hash column
    if (!columnNames.includes('access_token_hash')) {
      console.log('📝 Adding access_token_hash column...');
      await connection.execute(`
        ALTER TABLE orders 
        ADD COLUMN access_token_hash VARCHAR(128) NULL 
        COMMENT 'SHA-256 hash of access token for ticketless authentication'
      `);
      console.log('   ✅ Added access_token_hash column');
    } else {
      console.log('   ⏭️  access_token_hash column already exists');
    }

    // Add checked_in_at column
    if (!columnNames.includes('checked_in_at')) {
      console.log('📝 Adding checked_in_at column...');
      await connection.execute(`
        ALTER TABLE orders 
        ADD COLUMN checked_in_at DATETIME NULL 
        COMMENT 'Timestamp when ticket was checked in at event'
      `);
      console.log('   ✅ Added checked_in_at column');
    } else {
      console.log('   ⏭️  checked_in_at column already exists');
    }

    // Add checked_in_by column
    if (!columnNames.includes('checked_in_by')) {
      console.log('📝 Adding checked_in_by column...');
      await connection.execute(`
        ALTER TABLE orders 
        ADD COLUMN checked_in_by VARCHAR(36) NULL 
        COMMENT 'Staff user ID who performed check-in'
      `);
      console.log('   ✅ Added checked_in_by column');
    } else {
      console.log('   ⏭️  checked_in_by column already exists');
    }

    // Add index on access_token_hash for fast lookups
    const [indexes] = await connection.execute(`
      SHOW INDEX FROM orders WHERE Key_name = 'idx_access_token_hash'
    `);
    
    if (indexes.length === 0) {
      console.log('📝 Adding index on access_token_hash...');
      await connection.execute(`
        CREATE INDEX idx_access_token_hash ON orders(access_token_hash)
      `);
      console.log('   ✅ Added index idx_access_token_hash');
    } else {
      console.log('   ⏭️  Index idx_access_token_hash already exists');
    }

    // Generate tokens for existing orders that don't have one
    const [ordersWithoutToken] = await connection.execute(`
      SELECT id, order_number, status FROM orders 
      WHERE access_token_hash IS NULL
    `);

    if (ordersWithoutToken.length > 0) {
      console.log(`\n📝 Generating tokens for ${ordersWithoutToken.length} existing orders...`);
      
      for (const order of ordersWithoutToken) {
        const token = crypto.randomBytes(32).toString('hex');
        const hash = crypto.createHash('sha256').update(token).digest('hex');
        
        await connection.execute(
          `UPDATE orders SET access_token_hash = ? WHERE id = ?`,
          [hash, order.id]
        );
        
        // For PAID orders, we should send email with new ticket link
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const ticketUrl = `${baseUrl}/ticket/${order.order_number}?token=${token}`;
        
        console.log(`   ✅ ${order.order_number} (${order.status})`);
        if (order.status === 'PAID') {
          console.log(`      🔗 Ticket URL: ${ticketUrl}`);
          console.log(`      📧 Consider sending email with new ticket link`);
        }
      }
    } else {
      console.log('\n✅ All orders already have access tokens');
    }

    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await connection.end();
    console.log('🔌 Database connection closed');
  }
}

main().catch(console.error);

