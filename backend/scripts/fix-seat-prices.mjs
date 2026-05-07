import 'dotenv/config';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || '103.179.188.241',
  user: process.env.DB_USER || 'rymukbi_admin',
  password: process.env.DB_PASSWORD || 'Admin@2026',
  database: process.env.DB_NAME || 'rymukbi_easyticketdb',
});

async function fixSeatPrices() {
  console.log('🔧 Fixing seat prices based on seat_type and ticket_types...\n');

  const eventId = 'evt-tedx-2026';

  // Get ticket types
  const [ticketTypes] = await pool.query(`
    SELECT level, price, name
    FROM ticket_types
    WHERE event_id = ? AND is_active = 1
    ORDER BY level ASC
  `, [eventId]);

  console.log('📋 Ticket types:');
  console.table(ticketTypes);

  // Update seats based on LEVEL_X
  for (const tt of ticketTypes) {
    const seatType = `LEVEL_${tt.level}`;

    const [result] = await pool.query(`
      UPDATE seats
      SET price = ?
      WHERE event_id = ? AND seat_type = ?
    `, [tt.price, eventId, seatType]);

    console.log(`✅ Updated ${result.affectedRows} seats of type ${seatType} (${tt.name}) to price ${tt.price}`);
  }

  // Check results
  const [stats] = await pool.query(`
    SELECT seat_type, COUNT(*) as count, MIN(price) as min_price, MAX(price) as max_price
    FROM seats
    WHERE event_id = ?
    GROUP BY seat_type
    ORDER BY min_price ASC
  `, [eventId]);

  console.log('\n📊 Updated seat prices:');
  console.table(stats);

  await pool.end();
  console.log('\n✅ Done!');
}

fixSeatPrices().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
