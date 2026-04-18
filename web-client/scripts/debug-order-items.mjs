import mysql from 'mysql2/promise'
import {readFileSync, existsSync} from 'fs'
import {join} from 'path'

const envPath = join(process.cwd(), '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const ORDER_NUMBER = process.argv[2] || 'TKH2EI324'
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

try {
  const [orders] = await pool.query(
    'SELECT id, order_number FROM orders WHERE order_number = ?',
    [ORDER_NUMBER]
  )
  if (!orders.length) { console.log('NO ORDER'); process.exit(0) }
  const orderId = orders[0].id

  console.log(`\n=== order_items for ${ORDER_NUMBER} (id=${orderId}) ===`)
  const [items] = await pool.query(
    `SELECT oi.seat_id, oi.seat_number, oi.seat_type, oi.price,
            s.status AS seat_status, s.row, s.section
     FROM order_items oi
     LEFT JOIN seats s ON oi.seat_id = s.id
     WHERE oi.order_id = ?`,
    [orderId]
  )
  console.table(items)
  console.log('\nTotal items:', items.length)
} catch (e) {
  console.error('ERROR:', e.message)
} finally {
  await pool.end()
}
