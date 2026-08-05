import mysql from 'mysql2/promise'
import crypto from 'crypto'
import {readFileSync, existsSync} from 'fs'
import {join} from 'path'

// Load .env manually (no dotenv)
const envPath = join(process.cwd(), '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const ORDER_NUMBER = process.argv[2] || 'TKH2EI324'
const TOKEN = process.argv[3] || null

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

console.log('=== DB Config ===')
console.log({host: process.env.DB_HOST, db: process.env.DB_NAME, user: process.env.DB_USER})

try {
  const [dbRow] = await pool.query('SELECT DATABASE() AS db, NOW() AS now_utc, @@time_zone AS tz')
  console.log('Connected:', dbRow[0])

  console.log(`\n=== Exact match: order_number = '${ORDER_NUMBER}' ===`)
  const [exact] = await pool.query(
    'SELECT id, order_number, status, event_id, expires_at, created_at, access_token_hash, TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS time_remaining FROM orders WHERE order_number = ?',
    [ORDER_NUMBER]
  )
  console.log('rows:', exact.length)
  for (const r of exact) {
    console.log({
      id: r.id,
      order_number: r.order_number,
      status: r.status,
      event_id: r.event_id,
      expires_at: r.expires_at,
      time_remaining_sec: r.time_remaining,
      token_hash_prefix: r.access_token_hash?.substring(0, 16) + '...',
      token_hash_len: r.access_token_hash?.length,
    })
    if (TOKEN) {
      const inputHash = crypto.createHash('sha256').update(TOKEN).digest('hex')
      console.log(`\n  Input token: ${TOKEN.substring(0, 16)}... (len=${TOKEN.length})`)
      console.log(`  Input hash : ${inputHash.substring(0, 16)}...`)
      console.log(`  Stored hash: ${r.access_token_hash?.substring(0, 16)}...`)
      console.log(`  MATCH      : ${inputHash === r.access_token_hash}`)
    }
  }

  console.log(`\n=== LIKE match: order_number LIKE '%${ORDER_NUMBER.slice(-6)}%' ===`)
  const [like] = await pool.query(
    'SELECT order_number, status, created_at FROM orders WHERE order_number LIKE ? ORDER BY created_at DESC LIMIT 5',
    [`%${ORDER_NUMBER.slice(-6)}%`]
  )
  console.table(like)

  console.log(`\n=== Last 10 orders ===`)
  const [recent] = await pool.query(
    'SELECT order_number, status, created_at, expires_at, customer_email FROM orders ORDER BY created_at DESC LIMIT 10'
  )
  console.table(recent)

  console.log(`\n=== Collation of orders.order_number ===`)
  const [col] = await pool.query(
    "SELECT COLUMN_NAME, COLLATION_NAME, CHARACTER_SET_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='orders' AND COLUMN_NAME='order_number'"
  )
  console.table(col)
} catch (e) {
  console.error('ERROR:', e.message)
} finally {
  await pool.end()
}
