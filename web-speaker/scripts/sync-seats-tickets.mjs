import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

// Load .env file manually
const envContent = readFileSync('.env', 'utf-8');
const envLines = envContent.split('\n');
for (const line of envLines) {
  if (line.startsWith('#') || !line.includes('=')) continue;
  const eqIndex = line.indexOf('=');
  const key = line.slice(0, eqIndex).trim();
  let value = line.slice(eqIndex + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

const dbUrl = process.env.DATABASE_URL;
const url = new URL(dbUrl);
const config = {
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
};

console.log('🔌 Connecting to database...');
const connection = await mysql.createConnection(config);
console.log('✅ Connected!\n');

// Get main event
const [events] = await connection.execute(`SELECT id, name FROM events WHERE is_published = 1 LIMIT 1`);
if (events.length === 0) {
  console.log('❌ No published event found');
  process.exit(1);
}
const eventId = events[0].id;
const eventName = events[0].name;
console.log(`📅 Event: ${eventName}\n`);

// Delete old ticket types for this event
console.log('🗑️  Deleting old ticket types...');
await connection.execute(`DELETE FROM ticket_types WHERE event_id = ?`, [eventId]);

// Create new ticket types matching seat structure
console.log('🎫 Creating ticket types matching seats...');
const ticketTypes = [
  { 
    id: randomUUID(),
    name: 'VIP', 
    description: 'Ghế VIP hàng A-B, view tốt nhất, gần sân khấu', 
    price: 2500000, 
    color: '#f59e0b', 
    icon: '🌟', 
    sort_order: 1,
    rows: ['A', 'B']
  },
  { 
    id: randomUUID(),
    name: 'STANDARD', 
    description: 'Ghế tiêu chuẩn hàng C-H, view tốt', 
    price: 1500000, 
    color: '#10b981', 
    icon: '🎫', 
    sort_order: 2,
    rows: ['C', 'D', 'E', 'F', 'G', 'H']
  },
];

for (const tt of ticketTypes) {
  await connection.execute(
    `INSERT INTO ticket_types (id, event_id, name, description, price, color, icon, sort_order, max_quantity, sold_quantity, is_active, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, NOW(), NOW())`,
    [tt.id, eventId, tt.name, tt.description, tt.price, tt.color, tt.icon, tt.sort_order, tt.rows.length * 12]
  );
  console.log(`  ✅ ${tt.name}: ${tt.price.toLocaleString('vi-VN')} VNĐ (${tt.rows.join(', ')})`);
}

// Update seats to match ticket types
console.log('\n🪑 Syncing seats with ticket types...');

// Update VIP seats (rows A, B)
await connection.execute(
  `UPDATE seats SET seat_type = 'VIP', price = 2500000, updated_at = NOW() WHERE event_id = ? AND row IN ('A', 'B')`,
  [eventId]
);
const [vipResult] = await connection.execute(`SELECT COUNT(*) as count FROM seats WHERE event_id = ? AND row IN ('A', 'B')`, [eventId]);
console.log(`  ✅ VIP seats updated: ${vipResult[0].count} seats`);

// Update Standard seats (rows C-H)
await connection.execute(
  `UPDATE seats SET seat_type = 'STANDARD', price = 1500000, updated_at = NOW() WHERE event_id = ? AND row IN ('C', 'D', 'E', 'F', 'G', 'H')`,
  [eventId]
);
const [stdResult] = await connection.execute(`SELECT COUNT(*) as count FROM seats WHERE event_id = ? AND row IN ('C', 'D', 'E', 'F', 'G', 'H')`, [eventId]);
console.log(`  ✅ STANDARD seats updated: ${stdResult[0].count} seats`);

// Update sold quantity in ticket types
console.log('\n📊 Updating sold quantities...');
const [soldVIP] = await connection.execute(`SELECT COUNT(*) as count FROM seats WHERE event_id = ? AND row IN ('A', 'B') AND status = 'SOLD'`, [eventId]);
const [soldStd] = await connection.execute(`SELECT COUNT(*) as count FROM seats WHERE event_id = ? AND row IN ('C', 'D', 'E', 'F', 'G', 'H') AND status = 'SOLD'`, [eventId]);

await connection.execute(`UPDATE ticket_types SET sold_quantity = ? WHERE event_id = ? AND name = 'VIP'`, [soldVIP[0].count, eventId]);
await connection.execute(`UPDATE ticket_types SET sold_quantity = ? WHERE event_id = ? AND name = 'STANDARD'`, [soldStd[0].count, eventId]);
console.log(`  ✅ VIP sold: ${soldVIP[0].count}, STANDARD sold: ${soldStd[0].count}`);

// Summary
console.log('\n📊 Summary:');
const [allSeats] = await connection.execute(`SELECT seat_type, COUNT(*) as count, SUM(price) as total_value FROM seats WHERE event_id = ? GROUP BY seat_type`, [eventId]);
for (const row of allSeats) {
  console.log(`   ${row.seat_type}: ${row.count} seats, Total value: ${Number(row.total_value).toLocaleString('vi-VN')} VNĐ`);
}

const [ticketTypesResult] = await connection.execute(`SELECT name, price, max_quantity, sold_quantity FROM ticket_types WHERE event_id = ?`, [eventId]);
console.log('\n🎫 Ticket Types:');
for (const tt of ticketTypesResult) {
  console.log(`   ${tt.name}: ${Number(tt.price).toLocaleString('vi-VN')} VNĐ (${tt.sold_quantity}/${tt.max_quantity} sold)`);
}

await connection.end();
console.log('\n🎉 Sync completed!');

