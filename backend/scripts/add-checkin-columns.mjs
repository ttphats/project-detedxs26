import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: join(__dirname, '..', '.env') });

async function addCheckinColumns() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123123',
    database: process.env.DB_NAME || 'tedx_db',
    waitForConnections: true,
    connectionLimit: 10,
  });

  try {
    console.log('🔧 Adding check-in columns to orders table...\n');

    // Check if columns already exist
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'orders' 
        AND COLUMN_NAME IN ('checked_in_at', 'checked_in_by')
    `);

    if (columns.length > 0) {
      console.log('✅ Check-in columns already exist!');
      const existingCols = columns.map(c => c.COLUMN_NAME).join(', ');
      console.log(`   Existing: ${existingCols}\n`);
      await pool.end();
      process.exit(0);
    }

    // Add columns
    await pool.query(`
      ALTER TABLE orders
      ADD COLUMN checked_in_at DATETIME NULL COMMENT 'Check-in timestamp',
      ADD COLUMN checked_in_by VARCHAR(36) NULL COMMENT 'Admin user ID who performed check-in'
    `);

    console.log('✅ Added columns:');
    console.log('   - checked_in_at (DATETIME)');
    console.log('   - checked_in_by (VARCHAR(36))');

    // Add index
    await pool.query(`
      ALTER TABLE orders
      ADD INDEX idx_checked_in_at (checked_in_at)
    `);

    console.log('✅ Added index: idx_checked_in_at\n');

    // Verify
    const [verify] = await pool.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'orders' 
        AND COLUMN_NAME IN ('checked_in_at', 'checked_in_by')
    `);

    console.log('📋 Verification:');
    for (const col of verify) {
      console.log(`   ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}) - ${col.COLUMN_COMMENT || 'No comment'}`);
    }

    console.log('\n✅ Migration completed successfully!\n');

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

addCheckinColumns();
