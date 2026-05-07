import 'dotenv/config';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123123',
  database: process.env.DB_NAME || 'tedx_db',
});

async function debugSeatTypes() {
  console.log('🔍 Debugging seat types in database...\n');

  // Check seat types distribution
  const [seatTypes] = await pool.query(`
    SELECT seat_type, COUNT(*) as count, MIN(price) as min_price, MAX(price) as max_price
    FROM seats
    WHERE event_id = 'evt-tedx-2026'
    GROUP BY seat_type
    ORDER BY min_price ASC
  `);

  console.log('📊 Seat types distribution:');
  console.table(seatTypes);

  // Check sample seats
  const [sample] = await pool.query(`
    SELECT id, seat_number, row, seat_type, price, status
    FROM seats
    WHERE event_id = 'evt-tedx-2026'
    ORDER BY row, seat_number
    LIMIT 20
  `);

  console.log('\n🔍 Sample seats (first 20):');
  console.table(sample);

  // Check ticket types
  const [ticketTypes] = await pool.query(`
    SELECT id, name, level, price, color
    FROM ticket_types
    WHERE event_id = 'evt-tedx-2026' AND is_active = 1
    ORDER BY level ASC
  `);

  console.log('\n🎫 Ticket types for this event:');
  console.table(ticketTypes);

  await pool.end();
  console.log('\n✅ Done!');
}

debugSeatTypes().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
