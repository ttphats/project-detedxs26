import mysql from 'mysql2/promise'

const connection = await mysql.createConnection({
  host: '103.179.188.241',
  port: 3306,
  user: 'rymukbi_admin',
  password: 'Admin@2026',
  database: 'rymukbi_easyticketdb',
})

console.log('🔍 Checking ALL seats in database...\n')

// Get all seats with details
const [allSeats] = await connection.execute(
  `SELECT seat_number, row, section, seat_type, status FROM seats WHERE event_id = ? ORDER BY row, seat_number`,
  ['evt-tedx-2026']
)

console.log(`Total seats: ${allSeats.length}\n`)

// Group by status
const byStatus = allSeats.reduce((acc, seat) => {
  acc[seat.status] = (acc[seat.status] || 0) + 1
  return acc
}, {})

console.log('📊 Seats by status:')
Object.entries(byStatus).forEach(([status, count]) => {
  console.log(`  - ${status}: ${count} seats`)
})

// Show SOLD seats
const soldSeats = allSeats.filter(s => s.status === 'SOLD')
if (soldSeats.length > 0) {
  console.log(`\n⚠️  FOUND ${soldSeats.length} SOLD SEATS:`)
  soldSeats.forEach((seat) => {
    console.log(`  - ${seat.seat_number} (row ${seat.row}, ${seat.section}, ${seat.seat_type})`)
  })
}

// Show first 20 seats
console.log('\n📝 First 20 seats:')
allSeats.slice(0, 20).forEach((s) => {
  console.log(`  ${s.seat_number} (${s.row}): ${s.status} - ${s.seat_type}`)
})

await connection.end()
