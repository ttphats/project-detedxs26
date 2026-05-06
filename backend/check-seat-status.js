import mysql from 'mysql2/promise'

const connection = await mysql.createConnection({
  host: '103.179.188.241',
  port: 3306,
  user: 'rymukbi_admin',
  password: 'Admin@2026',
  database: 'rymukbi_easyticketdb',
})

console.log('🔍 Checking seats for evt-tedx-2026...\n')

// Get all seats by status
const [byStatus] = await connection.execute(
  `SELECT status, COUNT(*) as count FROM seats WHERE event_id = ? GROUP BY status`,
  ['evt-tedx-2026']
)

console.log('📊 Seats by status:')
byStatus.forEach((row) => {
  console.log(`  - ${row.status}: ${row.count} seats`)
})

// Get total
const [total] = await connection.execute(
  `SELECT COUNT(*) as total FROM seats WHERE event_id = ?`,
  ['evt-tedx-2026']
)
console.log(`\nTotal seats: ${total[0].total}`)

// Check what would be returned by API query
const [apiSeats] = await connection.execute(
  `SELECT COUNT(*) as count FROM seats 
   WHERE event_id = ? AND status IN ('AVAILABLE', 'SOLD', 'RESERVED', 'LOCKED')`,
  ['evt-tedx-2026']
)
console.log(`\nSeats returned by API query: ${apiSeats[0].count}`)

// Sample some seats
const [sample] = await connection.execute(
  `SELECT seat_number, row, status, seat_type FROM seats WHERE event_id = ? LIMIT 20`,
  ['evt-tedx-2026']
)
console.log('\n📝 Sample seats:')
sample.forEach((s) => {
  console.log(`  ${s.seat_number} (row ${s.row}): ${s.status} - ${s.seat_type}`)
})

await connection.end()
