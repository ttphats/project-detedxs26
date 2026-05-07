import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

async function checkSeats() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123123',
    database: process.env.DB_NAME || 'tedx_db',
    waitForConnections: true,
    connectionLimit: 10,
  });

  try {
    console.log('🔍 Checking seats A2 and D3...\n');

    const [seats] = await pool.query(`
      SELECT 
        s.id, s.event_id, s.seat_number, s.row, s.status,
        sl.session_id as locked_by,
        sl.expires_at as lock_expires_at,
        oi.order_id,
        o.order_number, o.status as order_status
      FROM seats s
      LEFT JOIN seat_locks sl ON s.id = sl.seat_id AND sl.expires_at > NOW()
      LEFT JOIN order_items oi ON s.id = oi.seat_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE s.seat_number IN ('A2', 'D3')
      ORDER BY s.seat_number
    `);

    if (seats.length === 0) {
      console.log('❌ No seats found with numbers A2 or D3\n');
    } else {
      for (const seat of seats) {
        console.log(`📍 Seat: ${seat.seat_number} (${seat.row})`);
        console.log(`   ID: ${seat.id}`);
        console.log(`   Status: ${seat.status}`);
        console.log(`   Locked by: ${seat.locked_by || 'None'}`);
        console.log(`   Lock expires: ${seat.lock_expires_at || 'N/A'}`);
        console.log(`   Order: ${seat.order_number || 'None'} (${seat.order_status || 'N/A'})`);
        console.log('');
      }
    }

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkSeats();
