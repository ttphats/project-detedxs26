+#!/usr/bin/env node

/**
 * Migration: Add `banner_url` column to partners table
 * 
 * This column stores a SEPARATE banner image for the homepage conveyor belt.
 * Recommended size: 400×160px (2.5:1 ratio) — standard for sponsor marquee strips.
 * 
 * This is distinct from `logo_url` which is used in the Partners & Sponsors section.
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL || 'mysql://rymukbi_admin:Admin%402026@103.179.188.241:3306/rymukbi_easyticketdb';
const cleanDbUrl = dbUrl.replace(/^"(.*)"$/, '$1');

const urlMatch = cleanDbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);

if (!urlMatch) {
  console.error('❌ Invalid DATABASE_URL format');
  process.exit(1);
}

const [, user, password, host, port, database] = urlMatch;
const decodedPassword = decodeURIComponent(password);

const connection = await mysql.createConnection({
  host,
  port: parseInt(port),
  user,
  password: decodedPassword,
  database,
});

console.log('🔗 Connected to database');

// Check if banner_url column already exists
console.log('\n🔍 Checking if banner_url column exists...');
const [columns] = await connection.execute(
  `SHOW COLUMNS FROM partners LIKE 'banner_url'`
);

if (columns.length > 0) {
  console.log('✅ banner_url column already exists!');
  await connection.end();
  process.exit(0);
}

// Add banner_url column after logo_url
console.log('📦 Adding banner_url column to partners table...');
await connection.execute(`
  ALTER TABLE partners 
  ADD COLUMN banner_url VARCHAR(500) NULL 
    COMMENT 'Separate banner image for the homepage conveyor belt. Recommended: 400x160px (2.5:1)' 
    AFTER logo_url
`);
console.log('✅ banner_url column added!');

console.log('\n✅ Migration completed successfully!');
console.log('ℹ️  banner_url is NULL by default — existing partners will use logo_url in the marquee as fallback.');
await connection.end();
process.exit(0);
