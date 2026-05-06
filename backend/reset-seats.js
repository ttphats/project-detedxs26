import mysql from 'mysql2/promise'

const connection = await mysql.createConnection({
  host: '103.179.188.241',
  port: 3306,
  user: 'rymukbi_admin',
  password: 'Admin@2026',
  database: 'rymukbi_easyticketdb',
})

console.log('🔄 Resetting all seats to AVAILABLE...\n')

// Check current status
const [beforeStats] = await connection.execute(`
  SELECT status, COUNT(*) as count 
  FROM seats 
  GROUP BY status
`)

console.log('📊 Before reset:')
beforeStats.forEach((stat) => {
  console.log(`  - ${stat.status}: ${stat.count} seats`)
})

// Reset all seats to AVAILABLE
const [result] = await connection.execute(`
  UPDATE seats
  SET status = 'AVAILABLE'
  WHERE is_disabled = 0
`)

console.log(`\n✅ Updated ${result.affectedRows} seats to AVAILABLE`)

// Check after status
const [afterStats] = await connection.execute(`
  SELECT status, COUNT(*) as count 
  FROM seats 
  GROUP BY status
`)

console.log('\n📊 After reset:')
afterStats.forEach((stat) => {
  console.log(`  - ${stat.status}: ${stat.count} seats`)
})

// Delete seat locks
await connection.execute('DELETE FROM seat_locks')
console.log('\n🗑️  Deleted all seat locks')

// Delete orders
await connection.execute('DELETE FROM order_items')
await connection.execute('DELETE FROM payments')
await connection.execute('DELETE FROM orders')
console.log('🗑️  Deleted all orders')

await connection.end()
console.log('\n✅ Done!')
