import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

async function cleanupSoldSeatLocks() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123123',
    database: process.env.DB_NAME || 'tedx_db',
    waitForConnections: true,
    connectionLimit: 10,
  });

  try {
    console.log('🧹 Cleaning up seat locks for SOLD seats...\n');

    // Find seat locks for seats that are SOLD
    const [locks] = await pool.query(`
      SELECT sl.id, sl.seat_id, s.seat_number, s.status
      FROM seat_locks sl
      JOIN seats s ON sl.seat_id = s.id
      WHERE s.status = 'SOLD'
    `);

    if (locks.length === 0) {
      console.log('✅ No orphaned locks found for SOLD seats.\n');
      await pool.end();
      process.exit(0);
    }

    console.log(`⚠️  Found ${locks.length} locks for SOLD seats:\n`);
    for (const lock of locks) {
      console.log(`   - Seat ${lock.seat_number} (${lock.seat_id})`);
    }

    // Delete these locks
    const [result] = await pool.query(`
      DELETE sl FROM seat_locks sl
      JOIN seats s ON sl.seat_id = s.id
      WHERE s.status = 'SOLD'
    `);

    console.log(`\n✅ Deleted ${result.affectedRows} orphaned seat locks.\n`);

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

cleanupSoldSeatLocks();
