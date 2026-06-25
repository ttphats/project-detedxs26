/**
 * Migration: Add username column to users table
 * Allows login by username instead of email for admin users
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

async function migrate() {
  console.log('🔌 Connecting to database...');
  const connection = await mysql.createConnection(config);
  console.log('✅ Connected!');

  console.log('🔄 Adding username column to users table...');

  try {
    // Check if column exists
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'username'`,
      [config.database]
    );

    if (columns.length === 0) {
      // Add username column
      await connection.execute(`
        ALTER TABLE users 
        ADD COLUMN username VARCHAR(50) NULL AFTER email
      `);
      console.log('✅ Added username column');

      // Add unique index
      await connection.execute(`
        ALTER TABLE users 
        ADD UNIQUE INDEX idx_username (username)
      `);
      console.log('✅ Added unique index on username');

      // Make email optional (NULL allowed)
      await connection.execute(`
        ALTER TABLE users 
        MODIFY COLUMN email VARCHAR(100) NULL
      `);
      console.log('✅ Made email column optional');

      // Generate username for existing users from email
      await connection.execute(`
        UPDATE users 
        SET username = SUBSTRING_INDEX(email, '@', 1)
        WHERE username IS NULL AND email IS NOT NULL
      `);
      console.log('✅ Generated usernames for existing users');

    } else {
      console.log('ℹ️ Username column already exists');
    }

    console.log('🎉 Migration completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

migrate().catch(console.error);

