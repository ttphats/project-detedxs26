/**
 * Migration: Add NO SPAM fields to email_logs table
 * 
 * This migration adds:
 * - purpose: Email purpose (TICKET_CONFIRMED, PAYMENT_REJECTED, etc.)
 * - business_event: Business event that triggered email
 * - order_id: For anti-spam check (prevent duplicate emails)
 * - triggered_by: Admin user ID who triggered the email
 * - template_id: Template used for the email
 * - metadata: JSON metadata
 * 
 * Also adds to orders table:
 * - access_token_hash: For ticketless authentication
 * - email_sent_at: Track when email was sent
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

async function migrate() {
  // Parse connection string
  const url = new URL(DATABASE_URL.replace('mysql://', 'http://'));
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  });

  console.log('🔄 Starting NO SPAM email flow migration...\n');

  try {
    // 0. Add columns to email_templates table
    console.log('📋 Updating email_templates table...');

    const emailTemplateColumns = [
      { name: 'purpose', sql: "ALTER TABLE email_templates ADD COLUMN purpose VARCHAR(50) NULL AFTER name" },
    ];

    for (const col of emailTemplateColumns) {
      try {
        await connection.execute(col.sql);
        console.log(`  ✅ Added column: ${col.name}`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`  ⏭️  Column ${col.name} already exists`);
        } else {
          throw err;
        }
      }
    }

    // Add unique index for purpose
    try {
      await connection.execute("CREATE UNIQUE INDEX idx_email_templates_purpose ON email_templates(purpose)");
      console.log(`  ✅ Added unique index: idx_email_templates_purpose`);
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log(`  ⏭️  Index idx_email_templates_purpose already exists`);
      } else {
        console.log(`  ⚠️  Could not add index: ${err.message}`);
      }
    }

    // 1. Add columns to email_logs table
    console.log('\n📧 Updating email_logs table...');
    
    const emailLogColumns = [
      { name: 'purpose', sql: "ALTER TABLE email_logs ADD COLUMN purpose VARCHAR(50) DEFAULT 'LEGACY' AFTER id" },
      { name: 'business_event', sql: "ALTER TABLE email_logs ADD COLUMN business_event VARCHAR(50) NULL AFTER purpose" },
      { name: 'order_id', sql: "ALTER TABLE email_logs ADD COLUMN order_id VARCHAR(36) NULL AFTER business_event" },
      { name: 'triggered_by', sql: "ALTER TABLE email_logs ADD COLUMN triggered_by VARCHAR(36) NULL AFTER order_id" },
      { name: 'template_id', sql: "ALTER TABLE email_logs ADD COLUMN template_id VARCHAR(36) NULL AFTER triggered_by" },
      { name: 'metadata', sql: "ALTER TABLE email_logs ADD COLUMN metadata TEXT NULL AFTER error" },
    ];

    for (const col of emailLogColumns) {
      try {
        await connection.execute(col.sql);
        console.log(`  ✅ Added column: ${col.name}`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`  ⏭️  Column ${col.name} already exists`);
        } else {
          throw err;
        }
      }
    }

    // Add indexes for anti-spam check
    console.log('\n📊 Adding indexes...');
    
    const indexes = [
      { name: 'idx_email_logs_order_purpose', sql: "CREATE INDEX idx_email_logs_order_purpose ON email_logs(order_id, purpose)" },
      { name: 'idx_email_logs_business_event', sql: "CREATE INDEX idx_email_logs_business_event ON email_logs(business_event)" },
    ];

    for (const idx of indexes) {
      try {
        await connection.execute(idx.sql);
        console.log(`  ✅ Added index: ${idx.name}`);
      } catch (err) {
        if (err.code === 'ER_DUP_KEYNAME') {
          console.log(`  ⏭️  Index ${idx.name} already exists`);
        } else {
          throw err;
        }
      }
    }

    // 2. Add columns to orders table
    console.log('\n📦 Updating orders table...');
    
    const orderColumns = [
      { name: 'access_token_hash', sql: "ALTER TABLE orders ADD COLUMN access_token_hash VARCHAR(64) NULL" },
      { name: 'qr_code_url', sql: "ALTER TABLE orders ADD COLUMN qr_code_url VARCHAR(500) NULL" },
      { name: 'email_sent_at', sql: "ALTER TABLE orders ADD COLUMN email_sent_at DATETIME NULL" },
    ];

    for (const col of orderColumns) {
      try {
        await connection.execute(col.sql);
        console.log(`  ✅ Added column: ${col.name}`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`  ⏭️  Column ${col.name} already exists`);
        } else {
          throw err;
        }
      }
    }

    // 3. Add foreign key for order_id in email_logs
    console.log('\n🔗 Adding foreign key...');
    try {
      await connection.execute(`
        ALTER TABLE email_logs 
        ADD CONSTRAINT fk_email_logs_order 
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
      `);
      console.log('  ✅ Added foreign key: fk_email_logs_order');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME' || err.message.includes('Duplicate')) {
        console.log('  ⏭️  Foreign key already exists');
      } else {
        console.log(`  ⚠️  Could not add foreign key: ${err.message}`);
      }
    }

    // 4. Add columns to users table
    console.log('\n👤 Updating users table...');

    const userColumns = [
      { name: 'username', sql: "ALTER TABLE users ADD COLUMN username VARCHAR(50) NULL AFTER id" },
    ];

    for (const col of userColumns) {
      try {
        await connection.execute(col.sql);
        console.log(`  ✅ Added column: ${col.name}`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`  ⏭️  Column ${col.name} already exists`);
        } else {
          throw err;
        }
      }
    }

    // 5. Add columns to audit_logs table
    console.log('\n📝 Updating audit_logs table...');

    const auditLogColumns = [
      { name: 'user_role', sql: "ALTER TABLE audit_logs ADD COLUMN user_role VARCHAR(20) NULL AFTER user_id" },
      { name: 'old_value', sql: "ALTER TABLE audit_logs ADD COLUMN old_value TEXT NULL AFTER entity_id" },
      { name: 'new_value', sql: "ALTER TABLE audit_logs ADD COLUMN new_value TEXT NULL AFTER old_value" },
      { name: 'metadata', sql: "ALTER TABLE audit_logs ADD COLUMN metadata TEXT NULL AFTER changes" },
    ];

    for (const col of auditLogColumns) {
      try {
        await connection.execute(col.sql);
        console.log(`  ✅ Added column: ${col.name}`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`  ⏭️  Column ${col.name} already exists`);
        } else {
          throw err;
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log('  - email_logs: Added purpose, business_event, order_id, triggered_by, template_id, metadata');
    console.log('  - orders: Added access_token_hash, qr_code_url, email_sent_at');
    console.log('  - users: Added username');
    console.log('  - audit_logs: Added user_role, old_value, new_value, metadata');
    console.log('  - Added indexes for anti-spam check');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

migrate().catch(console.error);

