import mysql from 'mysql2/promise'

const connection = await mysql.createConnection({
  host: '103.179.188.241',
  port: 3306,
  user: 'rymukbi_admin',
  password: 'Admin@2026',
  database: 'rymukbi_easyticketdb',
})

console.log('🔧 Updating seat types to match layout...\n')

const eventId = 'evt-tedx-2026'

// Update Row A and B to VIP (price: 2,500,000)
const [vipResult] = await connection.execute(
  `UPDATE seats 
   SET seat_type = 'VIP', price = 2500000 
   WHERE event_id = ? AND row IN ('A', 'B')`,
  [eventId]
)
console.log(`✅ Updated ${vipResult.affectedRows} seats to VIP (Row A, B)`)

// Update Row C, D to Early Bird (price: 800,000)
const [earlyBirdResult] = await connection.execute(
  `UPDATE seats 
   SET seat_type = 'Early Bird', price = 800000 
   WHERE event_id = ? AND row IN ('C', 'D')`,
  [eventId]
)
console.log(`✅ Updated ${earlyBirdResult.affectedRows} seats to Early Bird (Row C, D)`)

// Row E, F, G, H remain STANDARD (price: 1,500,000)
console.log(`✅ Rows E-H remain STANDARD (already set)`)

// Show summary
const [summary] = await connection.execute(
  `SELECT seat_type, COUNT(*) as count, MIN(price) as price 
   FROM seats 
   WHERE event_id = ? 
   GROUP BY seat_type, price 
   ORDER BY price DESC`,
  [eventId]
)

console.log('\n📊 Seat Types Summary:')
console.table(summary)

await connection.end()
console.log('\n🎉 Done!')
