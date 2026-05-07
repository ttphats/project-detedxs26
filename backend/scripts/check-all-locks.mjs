import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

async function checkAllLocks() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123123',
    database: process.env.DB_NAME || 'tedx_db',
    waitForConnections: true,
    connectionLimit: 10,
  });

  try {
    console.log('🔍 Checking all seat locks...\n');

    const [locks] = await pool.query(`
      SELECT
        sl.id,
        sl.seat_id,
        sl.session_id,
        sl.expires_at,
        (sl.expires_at < NOW()) as is_expired,
        s.seat_number,
        s.status as seat_status
      FROM seat_locks sl
      LEFT JOIN seats s ON sl.seat_id = s.id
      ORDER BY sl.expires_at DESC
    `);

    if (locks.length === 0) {
      console.log('✅ No seat locks found.\n');
    } else {
      console.log(`🔒 Found ${locks.length} seat locks:\n`);
      for (const lock of locks) {
        console.log(`Seat: ${lock.seat_number}`);
        console.log(`  Seat Status: ${lock.seat_status}`);
        console.log(`  Session ID: ${lock.session_id}`);
        console.log(`  Expires At: ${lock.expires_at}`);
        console.log(`  Is Expired: ${lock.is_expired ? 'YES ⏰' : 'NO ✅'}`);
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

checkAllLocks();
