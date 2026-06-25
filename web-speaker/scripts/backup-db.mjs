/**
 * Database Backup Script
 * 
 * Creates a backup of critical tables before testing payment flow
 * Run: node scripts/backup-db.mjs
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

console.log('🔌 Connecting to database...');
const connection = await mysql.createConnection(config);
console.log('✅ Connected!\n');

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = path.join(process.cwd(), 'backups');

// Create backups directory if not exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

console.log('📦 Creating backup...\n');

// Tables to backup
const tables = ['orders', 'order_items', 'payments', 'seats', 'email_logs', 'audit_logs'];

const backup = {
  timestamp,
  database: url.pathname.slice(1),
  tables: {}
};

for (const table of tables) {
  try {
    const [rows] = await connection.execute(`SELECT * FROM ${table}`);
    backup.tables[table] = rows;
    console.log(`  ✅ ${table}: ${rows.length} rows`);
  } catch (e) {
    console.log(`  ⚠️ ${table}: ${e.message}`);
    backup.tables[table] = [];
  }
}

// Save backup to JSON file
const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));

// Also save as "latest" for easy rollback
const latestFile = path.join(backupDir, 'backup-latest.json');
fs.writeFileSync(latestFile, JSON.stringify(backup, null, 2));

await connection.end();

console.log(`\n✅ Backup saved to:`);
console.log(`   📁 ${backupFile}`);
console.log(`   📁 ${latestFile} (for rollback)`);
console.log('\n💡 To rollback, run: node scripts/rollback-db.mjs\n');

