import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

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
console.log('DATABASE_URL:', dbUrl);
if (!dbUrl) {
  console.error('❌ DATABASE_URL not found in .env');
  process.exit(1);
}
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

// Create ticket_types table
console.log('📦 Creating ticket_types table...');
await connection.execute(`
  CREATE TABLE IF NOT EXISTS ticket_types (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    event_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    color VARCHAR(20) DEFAULT '#10b981',
    icon VARCHAR(50) DEFAULT '🎫',
    max_quantity INT DEFAULT NULL,
    sold_quantity INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_event_id (event_id),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  )
`);
console.log('✅ ticket_types table created!\n');

// Check if ticket_type_id column exists in seats
console.log('🔍 Checking seats table for ticket_type_id column...');
const [columns] = await connection.execute(`SHOW COLUMNS FROM seats LIKE 'ticket_type_id'`);

if (columns.length === 0) {
  console.log('📦 Adding ticket_type_id column to seats table...');
  await connection.execute(`
    ALTER TABLE seats 
    ADD COLUMN ticket_type_id VARCHAR(36) NULL,
    ADD INDEX idx_ticket_type_id (ticket_type_id)
  `);
  console.log('✅ ticket_type_id column added!\n');
} else {
  console.log('ℹ️  ticket_type_id column already exists\n');
}

// Seed some default ticket types for existing events
console.log('🌱 Seeding default ticket types...');
const [events] = await connection.execute('SELECT id, name FROM events LIMIT 5');

for (const event of events) {
  // Check if ticket types exist for this event
  const [existing] = await connection.execute(
    'SELECT COUNT(*) as count FROM ticket_types WHERE event_id = ?',
    [event.id]
  );
  
  if (existing[0].count === 0) {
    console.log(`   Creating ticket types for: ${event.name}`);
    
    const ticketTypes = [
      { name: 'VIP', description: 'Ghế VIP hàng đầu, view tốt nhất', price: 2000000, color: '#f59e0b', icon: '🌟', sort_order: 1 },
      { name: 'Standard', description: 'Ghế tiêu chuẩn, view tốt', price: 1500000, color: '#10b981', icon: '🎫', sort_order: 2 },
      { name: 'Economy', description: 'Ghế phổ thông, giá ưu đãi', price: 800000, color: '#06b6d4', icon: '💺', sort_order: 3 },
    ];
    
    for (const tt of ticketTypes) {
      const id = crypto.randomUUID();
      await connection.execute(
        `INSERT INTO ticket_types (id, event_id, name, description, price, color, icon, sort_order) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, event.id, tt.name, tt.description, tt.price, tt.color, tt.icon, tt.sort_order]
      );
    }
  }
}
console.log('✅ Default ticket types seeded!\n');

await connection.end();
console.log('🎉 Migration completed!');

