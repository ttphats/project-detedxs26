import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

// Load .env file manually
const envContent = readFileSync('.env', 'utf-8');
const envLines = envContent.split('\n');
for (const line of envLines) {
  if (line.startsWith('#') || !line.includes('=')) continue;
  const eqIndex = line.indexOf('=');
  const key = line.slice(0, eqIndex).trim();
  let value = line.slice(eqIndex + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

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

// Fix datetime columns
console.log('🔧 Fixing datetime columns...');

await connection.execute(`UPDATE users SET created_at = NOW(), updated_at = NOW() WHERE created_at IS NULL OR created_at = '0000-00-00 00:00:00' OR updated_at IS NULL OR updated_at = '0000-00-00 00:00:00'`);
console.log('  ✅ users fixed');

await connection.execute(`UPDATE roles SET created_at = NOW(), updated_at = NOW() WHERE created_at IS NULL OR created_at = '0000-00-00 00:00:00' OR updated_at IS NULL OR updated_at = '0000-00-00 00:00:00'`);
console.log('  ✅ roles fixed');

await connection.end();
console.log('\n🎉 Done!');

