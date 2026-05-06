import mysql from 'mysql2/promise'

const connection = await mysql.createConnection({
  host: '103.179.188.241',
  port: 3306,
  user: 'rymukbi_admin',
  password: 'Admin@2026',
  database: 'rymukbi_easyticketdb',
})

console.log('🔍 Checking for invalid datetime values...\n')

// Check for bad datetime
const [badRows] = await connection.execute(`
  SELECT id, seat_number, created_at, updated_at 
  FROM seats 
  WHERE updated_at IS NULL OR updated_at = '0000-00-00 00:00:00' OR updated_at < '1970-01-01'
  LIMIT 10
`)

console.log(`Found ${badRows.length} rows with invalid datetime:`)
if (badRows.length > 0) {
  console.table(badRows)
  
  console.log('\n✅ Fixing invalid datetime...')
  const [result] = await connection.execute(`
    UPDATE seats 
    SET updated_at = COALESCE(created_at, NOW())
    WHERE updated_at IS NULL 
      OR updated_at = '0000-00-00 00:00:00' 
      OR updated_at < '1970-01-01'
  `)
  console.log(`Fixed ${result.affectedRows} rows!`)
} else {
  console.log('✅ No invalid datetime found!')
}

await connection.end()
console.log('\n🎉 Done!')
