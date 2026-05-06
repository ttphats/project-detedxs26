import mysql from 'mysql2/promise'

const connection = await mysql.createConnection({
  host: '103.179.188.241',
  port: 3306,
  user: 'rymukbi_admin',
  password: 'Admin@2026',
  database: 'rymukbi_easyticketdb',
})

console.log('📊 Creating seat_layout_versions table...\n')

await connection.execute(`
  CREATE TABLE IF NOT EXISTS seat_layout_versions (
    id VARCHAR(36) PRIMARY KEY,
    event_id VARCHAR(36) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    layout_data JSON NOT NULL,
    created_by VARCHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active TINYINT(1) DEFAULT 1,
    notes TEXT,
    INDEX idx_event_id (event_id),
    INDEX idx_version (version)
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci
`)

console.log('✅ Table created successfully!')

// Check structure
const [cols] = await connection.execute('DESCRIBE seat_layout_versions')
console.log('\n📋 Table structure:')
cols.forEach((col) => {
  console.log(`  - ${col.Field} (${col.Type})`)
})

await connection.end()
