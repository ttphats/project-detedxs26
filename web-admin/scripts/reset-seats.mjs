import mysql from 'mysql2/promise';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

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

  console.log('Connected to database');

  const eventId = 'evt-tedx-2026';
  
  // Delete all existing seats for this event
  console.log('Deleting existing seats...');
  await connection.execute('DELETE FROM seats WHERE event_id = ?', [eventId]);
  console.log('✅ Deleted all seats');

  // Get STANDARD ticket type price
  const [ticketTypes] = await connection.execute(
    "SELECT price FROM ticket_types WHERE event_id = ? AND UPPER(name) = 'STANDARD'",
    [eventId]
  );
  const standardPrice = ticketTypes[0]?.price || 1500000;
  console.log(`Standard price: ${standardPrice}`);

  // Create 100 STANDARD seats (10 rows x 10 cols)
  console.log('Creating 100 STANDARD seats...');
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const colsPerRow = 10;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 1; c <= colsPerRow; c++) {
      const seatId = randomUUID();
      const seatNumber = `${row}${c}`;
      const section = c <= 5 ? 'LEFT' : 'RIGHT';
      
      await connection.execute(
        `INSERT INTO seats (id, event_id, seat_number, row, col, section, seat_type, price, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'STANDARD', ?, 'AVAILABLE', NOW(), NOW())`,
        [seatId, eventId, seatNumber, row, c, section, standardPrice]
      );
    }
  }

  console.log('✅ Created 100 STANDARD seats (10 rows x 10 cols)');

  // Verify
  const [count] = await connection.execute(
    'SELECT COUNT(*) as total, seat_type, status FROM seats WHERE event_id = ? GROUP BY seat_type, status',
    [eventId]
  );
  console.log('\n=== Seats Summary ===');
  console.table(count);

  await connection.end();
  console.log('\n✅ Done!');
}

main().catch(console.error);

