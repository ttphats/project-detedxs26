import mysql from 'mysql2/promise'

async function checkDatabase() {
  const connection = await mysql.createConnection({
    host: '103.179.188.241',
    port: 3306,
    user: 'rymukbi_admin',
    password: 'Admin@2026',
    database: 'rymukbi_easyticketdb',
  })

  console.log('✅ Connected to database')

  const [tables] = await connection.execute('SHOW TABLES')
  console.log('\n📋 Tables in database:')
  tables.forEach((table) => {
    console.log(`  - ${Object.values(table)[0]}`)
  })

  console.log('\n📊 Seats table structure:')
  const [columns] = await connection.execute('DESCRIBE seats')
  columns.forEach((col) => {
    console.log(`  - ${col.Field} (${col.Type})`)
  })

  console.log('\n📊 Audit_logs table structure:')
  const [auditCols] = await connection.execute('DESCRIBE audit_logs')
  auditCols.forEach((col) => {
    console.log(`  - ${col.Field} (${col.Type}) ${col.Key} ${col.Extra}`)
  })

  // Check ticket_types table
  console.log('\n🎫 Ticket_types table:')
  try {
    const [ttCols] = await connection.execute('DESCRIBE ticket_types')
    ttCols.forEach((col) => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Collation || 'N/A'}`)
    })

    const [tickets] = await connection.execute('SELECT * FROM ticket_types')
    console.log('\n📋 Current ticket types:')
    tickets.forEach((t) => {
      console.log(`  - ${t.name}: icon="${t.icon}", subtitle="${t.subtitle}"`)
    })
  } catch (e) {
    console.log('  Table does not exist')
  }

  await connection.end()
}

checkDatabase().catch(console.error)
