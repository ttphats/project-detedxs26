import mysql from 'mysql2/promise'

const connection = await mysql.createConnection({
  host: '103.179.188.241',
  port: 3306,
  user: 'rymukbi_admin',
  password: 'Admin@2026',
  database: 'rymukbi_easyticketdb',
})

console.log('🔧 Fixing ticket type levels...\n')

const eventId = 'evt-tedx-2026'

// Get current ticket types
const [current] = await connection.execute(
  'SELECT id, name, level, price FROM ticket_types WHERE event_id = ? ORDER BY price ASC',
  [eventId]
)

console.log('Current ticket types:')
console.table(current)

// Update levels based on price (cheapest = level 1)
const updates = [
  { name: 'Early Bird', level: 1 },
  { name: 'Gia đình', level: 1 }, // Keep as level 1 if you want it same as Early Bird
  { name: 'Standard', level: 2 },
  { name: 'VIP', level: 3 },
]

for (const update of updates) {
  const [result] = await connection.execute(
    'UPDATE ticket_types SET level = ? WHERE name = ? AND event_id = ?',
    [update.level, update.name, eventId]
  )
  if (result.affectedRows > 0) {
    console.log(`✅ Updated ${update.name} to level ${update.level}`)
  }
}

// OR: Auto-assign levels based on price order
const [sorted] = await connection.execute(
  'SELECT id, name, price FROM ticket_types WHERE event_id = ? ORDER BY price ASC',
  [eventId]
)

let level = 1
for (const ticket of sorted) {
  await connection.execute(
    'UPDATE ticket_types SET level = ? WHERE id = ?',
    [level, ticket.id]
  )
  console.log(`✅ Set ${ticket.name} (${ticket.price}đ) to level ${level}`)
  level++
}

// Show final result
const [final] = await connection.execute(
  'SELECT name, price, level, color FROM ticket_types WHERE event_id = ? ORDER BY level',
  [eventId]
)

console.log('\n📊 Final ticket types:')
console.table(final)

await connection.end()
console.log('\n🎉 Done!')
