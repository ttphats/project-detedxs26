import mysql from 'mysql2/promise'

const connection = await mysql.createConnection({
  host: '103.179.188.241',
  port: 3306,
  user: 'rymukbi_admin',
  password: 'Admin@2026',
  database: 'rymukbi_easyticketdb',
})

console.log('🔧 Renaming "Early Bird" to "ECONOMY"...\n')

// Update seats table
const [seatsResult] = await connection.execute(
  `UPDATE seats SET seat_type = 'ECONOMY' WHERE seat_type = 'Early Bird'`
)
console.log(`✅ Updated ${seatsResult.affectedRows} seats from "Early Bird" to "ECONOMY"`)

// Show current distribution
const [stats] = await connection.execute(
  `SELECT seat_type, COUNT(*) as count, MIN(price) as price 
   FROM seats 
   WHERE event_id = 'evt-tedx-2026' 
   GROUP BY seat_type, price 
   ORDER BY price DESC`
)

console.log('\n📊 Updated Seat Types:')
console.table(stats)

await connection.end()
console.log('\n🎉 Done!')
