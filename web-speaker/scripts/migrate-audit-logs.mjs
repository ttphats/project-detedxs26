/**
 * Migration script to add new columns to audit_logs table
 * Run: node scripts/migrate-audit-logs.mjs
 */

import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env file
const envPath = join(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  if (line.startsWith('#') || !line.includes('=')) return;
  const eqIndex = line.indexOf('=');
  const key = line.slice(0, eqIndex).trim();
  let value = line.slice(eqIndex + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"'))) value = value.slice(1, -1);
  process.env[key] = value;
});

async function migrate() {
  console.log('🔌 Connecting to database...');
  
  const url = new URL(process.env.DATABASE_URL);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  });

  console.log('✅ Connected!\n');
  console.log('📦 Running Audit Logs Migration...\n');

  // Add user_role column
  try {
    console.log('1️⃣ Adding user_role column...');
    await connection.execute(`
      ALTER TABLE audit_logs 
      ADD COLUMN user_role VARCHAR(50) NULL AFTER user_id
    `);
    console.log('   ✅ user_role column added');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('   ⏭️ user_role column already exists');
    } else {
      throw error;
    }
  }

  // Add old_value column
  try {
    console.log('2️⃣ Adding old_value column...');
    await connection.execute(`
      ALTER TABLE audit_logs 
      ADD COLUMN old_value TEXT NULL AFTER entity_id
    `);
    console.log('   ✅ old_value column added');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('   ⏭️ old_value column already exists');
    } else {
      throw error;
    }
  }

  // Add new_value column
  try {
    console.log('3️⃣ Adding new_value column...');
    await connection.execute(`
      ALTER TABLE audit_logs 
      ADD COLUMN new_value TEXT NULL AFTER old_value
    `);
    console.log('   ✅ new_value column added');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('   ⏭️ new_value column already exists');
    } else {
      throw error;
    }
  }

  // Add metadata column
  try {
    console.log('4️⃣ Adding metadata column...');
    await connection.execute(`
      ALTER TABLE audit_logs 
      ADD COLUMN metadata TEXT NULL AFTER user_agent
    `);
    console.log('   ✅ metadata column added');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('   ⏭️ metadata column already exists');
    } else {
      throw error;
    }
  }

  // Add indexes
  console.log('5️⃣ Adding indexes...');
  try {
    await connection.execute(`CREATE INDEX idx_audit_user_role ON audit_logs(user_role)`);
    console.log('   ✅ idx_audit_user_role added');
  } catch (error) {
    if (error.code === 'ER_DUP_KEYNAME') {
      console.log('   ⏭️ idx_audit_user_role already exists');
    }
  }
  
  try {
    await connection.execute(`CREATE INDEX idx_audit_entity_id ON audit_logs(entity_id)`);
    console.log('   ✅ idx_audit_entity_id added');
  } catch (error) {
    if (error.code === 'ER_DUP_KEYNAME') {
      console.log('   ⏭️ idx_audit_entity_id already exists');
    }
  }

  // Verify table structure
  console.log('\n📋 Verifying audit_logs table structure...\n');
  const [columns] = await connection.execute('DESCRIBE audit_logs');
  console.log('Audit logs table columns:');
  columns.forEach(col => {
    console.log(`  - ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'nullable' : 'required'})`);
  });

  await connection.end();
  console.log('\n✅ Migration completed!');
}

migrate().catch(console.error);

