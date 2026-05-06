import mysql from 'mysql2/promise'

const connection = await mysql.createConnection({
  host: '103.179.188.241',
  port: 3306,
  user: 'rymukbi_admin',
  password: 'Admin@2026',
  database: 'rymukbi_easyticketdb',
})

console.log('💰 Updating seats price based on ticket types...\n')

const eventId = 'evt-tedx-2026'

// Get ticket types for this event
const [ticketTypes] = await connection.execute(
  'SELECT name, price FROM ticket_types WHERE event_id = ?',
  [eventId]
)

console.log('📋 Ticket types:')
console.table(ticketTypes)

// Update seats price based on seat_type -> ticket_type.name mapping
for (const tt of ticketTypes) {
  const [result] = await connection.execute(
    `UPDATE seats 
     SET price = ? 
     WHERE event_id = ? 
       AND seat_type = ? 
       AND price = 0`,
    [tt.price, eventId, tt.name]
  )
  
  console.log(`✅ Updated ${result.affectedRows} seats with type '${tt.name}' to price ${tt.price}`)
}

// Show sample seats after update
const [seats] = await connection.execute(
  'SELECT seat_number, seat_type, price FROM seats WHERE event_id = ? ORDER BY row, col LIMIT 10',
  [eventId]
)

console.log('\n📌 Sample seats after update:')
console.table(seats)

await connection.end()
console.log('\n🎉 Done!')
