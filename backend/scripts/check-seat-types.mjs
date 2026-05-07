import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '123123',
  database: 'tedx_db',
});

async function checkSeatTypes() {
  const [seats] = await pool.query(`
    SELECT seat_type, COUNT(*) as count, MIN(price) as min_price, MAX(price) as max_price
    FROM seats
    WHERE event_id = 'evt-tedx-2026'
    GROUP BY seat_type
  `);

  console.log('📊 Seat types in database:');
  console.table(seats);

  const [sample] = await pool.query(`
    SELECT id, seat_number, row, seat_type, price
    FROM seats
    WHERE event_id = 'evt-tedx-2026'
    LIMIT 10
  `);

  console.log('\n🔍 Sample seats:');
  console.table(sample);

  await pool.end();
}

checkSeatTypes().catch(console.error);
