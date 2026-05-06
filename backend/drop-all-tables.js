import mysql from 'mysql2/promise'

async function dropAllTables() {
  const connection = await mysql.createConnection({
    host: '103.179.188.241',
    port: 3306,
    user: 'rymukbi_admin',
    password: 'Admin@2026',
    database: 'rymukbi_easyticketdb',
  })

  console.log('✅ Connected to database')

  // Disable foreign key checks
  await connection.execute('SET FOREIGN_KEY_CHECKS = 0')
  console.log('🔓 Disabled foreign key checks')

  // Get all tables
  const [tables] = await connection.execute('SHOW TABLES')
  console.log(`\n📋 Found ${tables.length} tables`)

  // Drop each table
  for (const table of tables) {
    const tableName = Object.values(table)[0]
    console.log(`  🗑️  Dropping ${tableName}...`)
    await connection.execute(`DROP TABLE IF EXISTS \`${tableName}\``)
  }

  // Re-enable foreign key checks
  await connection.execute('SET FOREIGN_KEY_CHECKS = 1')
  console.log('🔒 Re-enabled foreign key checks')

  console.log('\n✅ All tables dropped successfully!')

  await connection.end()
}

dropAllTables().catch(console.error)
