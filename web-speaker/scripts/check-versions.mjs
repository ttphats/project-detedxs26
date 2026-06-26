import mysql from 'mysql2/promise';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env
const envContent = fs.readFileSync(join(__dirname, '../.env'), 'utf-8');
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

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1)
  });

  console.log('=== LAYOUT VERSIONS ===');
  const [versions] = await connection.execute('SELECT id, event_id, version_name, status, is_active FROM seat_layout_versions');
  console.table(versions);

  console.log('\n=== SEATS COUNT ===');
  const [seats] = await connection.execute('SELECT event_id, seat_type, COUNT(*) as count FROM seats GROUP BY event_id, seat_type');
  console.table(seats);

  await connection.end();
}

main().catch(console.error);

