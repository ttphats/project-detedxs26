import mysql from 'mysql2/promise'

const connection = await mysql.createConnection({
  host: '103.179.188.241',
  port: 3306,
  user: 'rymukbi_admin',
  password: 'Admin@2026',
  database: 'rymukbi_easyticketdb',
})

console.log('🔧 Adding ticket_type_id column to seat_locks table...\n')

try {
  // Add ticket_type_id column (nullable, as it's optional)
  await connection.execute(`
    ALTER TABLE seat_locks 
    ADD COLUMN ticket_type_id VARCHAR(36) NULL 
    AFTER session_id
  `)
  
  console.log('✅ Column ticket_type_id added successfully!')
} catch (error) {
  if (error.code === 'ER_DUP_FIELDNAME') {
    console.log('ℹ️  Column ticket_type_id already exists')
  } else {
    throw error
  }
}

// Show updated schema
const [cols] = await connection.execute('DESCRIBE seat_locks')
console.log('\n📋 Updated seat_locks schema:')
console.table(cols)

await connection.end()
console.log('\n🎉 Done!')
