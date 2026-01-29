import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

// Load .env
const envContent = readFileSync('.env', 'utf-8');
for (const line of envContent.split('\n')) {
  if (line.startsWith('#') || !line.includes('=')) continue;
  const eqIndex = line.indexOf('=');
  const key = line.slice(0, eqIndex).trim();
  let value = line.slice(eqIndex + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

const url = new URL(process.env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1)
});

console.log('🔌 Connected to database!\n');

// 1. Add missing Economy ticket type for evt-tedx-2026
console.log('📦 Checking ticket types for evt-tedx-2026...');
const [existing] = await conn.execute(
  "SELECT name FROM ticket_types WHERE event_id = 'evt-tedx-2026' AND name = 'ECONOMY'"
);
if (existing.length === 0) {
  console.log('   Adding ECONOMY ticket type...');
  await conn.execute(
    `INSERT INTO ticket_types (id, event_id, name, description, price, color, icon, sort_order) 
     VALUES (?, 'evt-tedx-2026', 'ECONOMY', 'Ghế phổ thông, giá ưu đãi', 800000, '#06b6d4', '💺', 3)`,
    [crypto.randomUUID()]
  );
  console.log('✅ ECONOMY ticket type added!');
} else {
  console.log('ℹ️  ECONOMY ticket type already exists');
}

// 2. Create seat_layout_versions table
console.log('\n📦 Creating seat_layout_versions table...');
await conn.execute(`
  CREATE TABLE IF NOT EXISTS seat_layout_versions (
    id VARCHAR(36) PRIMARY KEY,
    event_id VARCHAR(100) NOT NULL,
    version_name VARCHAR(255) NOT NULL,
    description TEXT,
    layout_config JSON NOT NULL COMMENT 'rows, leftSeats, rightSeats, aisleWidth',
    seats_data JSON NOT NULL COMMENT 'Array of seat configurations',
    status ENUM('DRAFT', 'PUBLISHED') DEFAULT 'DRAFT',
    is_active BOOLEAN DEFAULT FALSE COMMENT 'Only one published version can be active',
    created_by VARCHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    published_at DATETIME,
    INDEX idx_event_id (event_id),
    INDEX idx_status (status),
    INDEX idx_is_active (is_active),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  )
`);
console.log('✅ seat_layout_versions table created!\n');

// 3. Show final ticket types
console.log('=== FINAL TICKET TYPES ===');
const [ticketTypes] = await conn.execute(
  'SELECT event_id, name, price, color, icon FROM ticket_types ORDER BY event_id, sort_order'
);
console.table(ticketTypes);

await conn.end();
console.log('\n🎉 Setup completed!');

