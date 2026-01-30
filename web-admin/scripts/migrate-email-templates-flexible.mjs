/**
 * Migration: Make email templates flexible (remove fixed purpose)
 * 
 * Changes:
 * - Add `category` column (ORDER, EVENT, NOTIFICATION, GENERAL)
 * - Add `description` column
 * - Add `version` column (if not exists)
 * - Add `created_by` column (if not exists)
 * - Migrate existing `purpose` values to `category`
 * - Drop `purpose` column
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

// Parse DATABASE_URL
function parseDatabaseUrl(url) {
  const regex = /mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
  const match = url.match(regex);
  if (!match) throw new Error('Invalid DATABASE_URL format');
  return {
    user: match[1],
    password: decodeURIComponent(match[2]),
    host: match[3],
    port: parseInt(match[4]),
    database: match[5],
  };
}

const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL);

async function migrate() {
  console.log('🚀 Starting email templates flexible migration...');
  console.log(`📦 Database: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

  const connection = await mysql.createConnection(dbConfig);

  try {
    // 1. Check if category column exists
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'email_templates'`,
      [dbConfig.database]
    );
    const columnNames = columns.map(c => c.COLUMN_NAME);
    console.log('📋 Existing columns:', columnNames.join(', '));

    // 2. Add category column if not exists
    if (!columnNames.includes('category')) {
      console.log('➕ Adding category column...');
      await connection.query(
        `ALTER TABLE email_templates ADD COLUMN category VARCHAR(50) DEFAULT 'GENERAL' AFTER name`
      );
    }

    // 3. Add description column if not exists
    if (!columnNames.includes('description')) {
      console.log('➕ Adding description column...');
      await connection.query(
        `ALTER TABLE email_templates ADD COLUMN description VARCHAR(500) NULL AFTER category`
      );
    }

    // 4. Add version column if not exists
    if (!columnNames.includes('version')) {
      console.log('➕ Adding version column...');
      await connection.query(
        `ALTER TABLE email_templates ADD COLUMN version INT DEFAULT 1`
      );
    }

    // 5. Add created_by column if not exists
    if (!columnNames.includes('created_by')) {
      console.log('➕ Adding created_by column...');
      await connection.query(
        `ALTER TABLE email_templates ADD COLUMN created_by VARCHAR(36) NULL`
      );
    }

    // 6. Migrate purpose to category if purpose exists
    if (columnNames.includes('purpose')) {
      console.log('🔄 Migrating purpose values to category...');
      
      // Map purpose to category
      const purposeToCategoryMap = {
        'PAYMENT_PENDING': 'ORDER',
        'PAYMENT_RECEIVED': 'ORDER',
        'PAYMENT_CONFIRMED': 'ORDER',
        'PAYMENT_REJECTED': 'ORDER',
        'TICKET_CONFIRMED': 'ORDER',
        'TICKET_CANCELLED': 'ORDER',
        'EVENT_REMINDER': 'EVENT',
        'CHECKIN_CONFIRMATION': 'EVENT',
        'ADMIN_NOTIFICATION': 'NOTIFICATION',
      };

      for (const [purpose, category] of Object.entries(purposeToCategoryMap)) {
        await connection.query(
          `UPDATE email_templates SET category = ?, description = CONCAT('Migrated from purpose: ', purpose) WHERE purpose = ?`,
          [category, purpose]
        );
      }

      // 7. Drop purpose unique constraint if exists
      console.log('🔧 Checking for purpose unique constraint...');
      const [indexes] = await connection.query(
        `SHOW INDEX FROM email_templates WHERE Column_name = 'purpose'`
      );
      
      for (const idx of indexes) {
        if (idx.Key_name !== 'PRIMARY') {
          console.log(`➖ Dropping index: ${idx.Key_name}`);
          try {
            await connection.query(`ALTER TABLE email_templates DROP INDEX ${idx.Key_name}`);
          } catch (e) {
            console.log(`   (Index may already be dropped)`);
          }
        }
      }

      // 8. Drop purpose column
      console.log('➖ Dropping purpose column...');
      try {
        await connection.query(`ALTER TABLE email_templates DROP COLUMN purpose`);
      } catch (e) {
        console.log('   (Column may already be dropped)');
      }
    }

    // 9. Create index on category + isActive
    console.log('📇 Creating index on category + is_active...');
    try {
      await connection.query(
        `CREATE INDEX idx_category_active ON email_templates (category, is_active)`
      );
    } catch (e) {
      console.log('   (Index may already exist)');
    }

    // 10. Verify changes
    const [newColumns] = await connection.query(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'email_templates'
       ORDER BY ORDINAL_POSITION`,
      [dbConfig.database]
    );
    console.log('\n📋 Updated email_templates schema:');
    newColumns.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME}: ${col.DATA_TYPE} ${col.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL'} ${col.COLUMN_DEFAULT ? `DEFAULT ${col.COLUMN_DEFAULT}` : ''}`);
    });

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

migrate().catch(console.error);

