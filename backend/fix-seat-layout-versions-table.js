import mysql from 'mysql2/promise'

const connection = await mysql.createConnection({
  host: '103.179.188.241',
  port: 3306,
  user: 'rymukbi_admin',
  password: 'Admin@2026',
  database: 'rymukbi_easyticketdb',
})

console.log('🔧 Fixing seat_layout_versions table...\n')

// 1. Drop old table (if exists)
console.log('❌ Dropping old seat_layout_versions table...')
await connection.execute('DROP TABLE IF EXISTS seat_layout_versions')
console.log('✅ Dropped!\n')

// 2. Create new table with correct schema
console.log('📦 Creating new seat_layout_versions table with correct schema...')
await connection.execute(`
  CREATE TABLE seat_layout_versions (
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
    INDEX idx_is_active (is_active)
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
`)
console.log('✅ Created with correct schema!\n')

// 3. Verify table structure
console.log('🔍 Verifying table structure...')
const [columns] = await connection.execute('DESCRIBE seat_layout_versions')
console.table(columns)

await connection.end()
console.log('\n🎉 Fix completed! You can now save drafts.')
