import mysql from 'mysql2/promise'

const connection = await mysql.createConnection({
  host: '103.179.188.241',
  port: 3306,
  user: 'rymukbi_admin',
  password: 'Admin@2026',
  database: 'rymukbi_easyticketdb',
})

console.log('🔍 Checking ticket_types table encoding...\n')

// Check table collation
const [tables] = await connection.execute(
  "SELECT TABLE_NAME, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'rymukbi_easyticketdb' AND TABLE_NAME = 'ticket_types'"
)
console.log('📊 Table collation:', tables[0])

// Check icon column collation
const [columns] = await connection.execute(
  "SELECT COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'rymukbi_easyticketdb' AND TABLE_NAME = 'ticket_types' AND COLUMN_NAME = 'icon'"
)
console.log('\n📋 Icon column collation:', columns[0])

// Check current data
const [tickets] = await connection.execute('SELECT id, name, icon FROM ticket_types')
console.log('\n🎫 Current tickets:')
tickets.forEach((t) => {
  console.log(`  - ${t.name}: icon="${t.icon}" (length: ${t.icon ? t.icon.length : 0})`)
  if (t.icon) {
    console.log(`    Hex: ${Buffer.from(t.icon, 'utf8').toString('hex')}`)
  }
})

await connection.end()
