#!/usr/bin/env node

/**
 * Migration: Add `show_in_marquee` column to partners table
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env file from the parent directory of scripts
dotenv.config({ path: path.join(__dirname, '../.env') });

// Parse DATABASE_URL from .env
const dbUrl = process.env.DATABASE_URL || 'mysql://rymukbi_admin:Admin%402026@103.179.188.241:3306/rymukbi_easyticketdb';
// Strip quotes if any
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

// Check if show_in_marquee column exists
console.log('\n🔍 Checking if show_in_marquee column exists...');
const [columns] = await connection.execute(
  `SHOW COLUMNS FROM partners LIKE 'show_in_marquee'`
);

if (columns.length > 0) {
  console.log('✅ show_in_marquee column already exists!');
  await connection.end();
  process.exit(0);
}

// Add show_in_marquee column
console.log('📦 Adding show_in_marquee column to partners table...');
await connection.execute(`
  ALTER TABLE partners 
  ADD COLUMN show_in_marquee TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Show partner in homepage scrolling conveyor belt' AFTER is_active,
  ADD INDEX idx_show_in_marquee (show_in_marquee)
`);
console.log('✅ show_in_marquee column added!');

// Set show_in_marquee = 1 for existing active partners so they are visible by default
console.log('\n🎯 Setting show_in_marquee = 1 for active partners to prevent empty conveyor belt...');
const [result] = await connection.execute(
  'UPDATE partners SET show_in_marquee = 1 WHERE is_active = 1'
);
console.log(`✅ Updated ${result.affectedRows} partners!`);

console.log('\n✅ Migration completed successfully!');
await connection.end();
process.exit(0);
