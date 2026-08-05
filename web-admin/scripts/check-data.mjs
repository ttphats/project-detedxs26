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

const conn = await mysql.createConnection({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1)
});

console.log('=== TICKET TYPES ===');
const [ticketTypes] = await conn.execute('SELECT id, event_id, name, price, color, icon, is_active FROM ticket_types');
console.table(ticketTypes);

console.log('\n=== EVENTS ===');
const [events] = await conn.execute('SELECT id, name FROM events');
console.table(events);

console.log('\n=== SEATS SAMPLE (10) ===');
const [seats] = await conn.execute('SELECT id, seat_number, row, col, section, seat_type, price, status FROM seats LIMIT 10');
console.table(seats);

console.log('\n=== SEATS COUNT BY TYPE ===');
const [seatCounts] = await conn.execute('SELECT seat_type, COUNT(*) as count, status FROM seats GROUP BY seat_type, status');
console.table(seatCounts);

await conn.end();

