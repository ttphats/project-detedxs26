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

const EVENT_ID = process.argv[2] || 'evt-tedx-2026'
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

try {
  console.log(`=== Event lookup: ${EVENT_ID} ===`)
  const [events] = await pool.query(
    'SELECT id, slug, name, event_date, venue FROM events WHERE id = ? OR slug = ? LIMIT 1',
    [EVENT_ID, EVENT_ID]
  )
  console.table(events)

  if (events.length > 0) {
    const ev = events[0]
    const [seatsCount] = await pool.query(
      "SELECT status, COUNT(*) AS cnt FROM seats WHERE event_id = ? GROUP BY status",
      [ev.id]
    )
    console.log('\n=== Seats distribution ===')
    console.table(seatsCount)

    const [ticketTypes] = await pool.query(
      'SELECT id, name, price, is_active FROM ticket_types WHERE event_id = ?',
      [ev.id]
    )
    console.log('\n=== Ticket types ===')
    console.table(ticketTypes)
  }
} catch (e) {
  console.error('ERROR:', e.message)
} finally {
  await pool.end()
}
