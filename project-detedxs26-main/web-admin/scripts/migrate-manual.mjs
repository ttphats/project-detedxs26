import mysql from 'mysql2/promise';
import bcryptjs from 'bcryptjs';
import { readFileSync } from 'fs';

// Load .env file manually
const envContent = readFileSync('.env', 'utf-8');
const envLines = envContent.split('\n');
for (const line of envLines) {
  if (line.startsWith('#') || !line.includes('=')) continue;
  const eqIndex = line.indexOf('=');
  const key = line.slice(0, eqIndex).trim();
  let value = line.slice(eqIndex + 1).trim();
  // Remove quotes
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

// Parse DATABASE_URL
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
console.log(`   Host: ${config.host}:${config.port}`);
console.log(`   User: ${config.user}`);
console.log(`   Database: ${config.database}`);

const connection = await mysql.createConnection(config);
console.log('✅ Connected to database!\n');

// Create tables
const createTables = `
-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  permissions TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(50),
  role_id VARCHAR(36) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role_id (role_id),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  venue VARCHAR(500) NOT NULL,
  event_date DATETIME NOT NULL,
  doors_open_time DATETIME NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  status VARCHAR(50) DEFAULT 'DRAFT',
  max_capacity INT NOT NULL,
  available_seats INT NOT NULL,
  banner_image_url VARCHAR(500),
  thumbnail_url VARCHAR(500),
  is_published BOOLEAN DEFAULT FALSE,
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_slug (slug),
  INDEX idx_status (status),
  INDEX idx_event_date (event_date)
);

-- Seat layouts table
CREATE TABLE IF NOT EXISTS seat_layouts (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  event_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  layout_data TEXT NOT NULL,
  total_seats INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_event_id (event_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Seats table
CREATE TABLE IF NOT EXISTS seats (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  event_id VARCHAR(36) NOT NULL,
  seat_number VARCHAR(50) NOT NULL,
  \`row\` VARCHAR(10) NOT NULL,
  col VARCHAR(10) NOT NULL,
  section VARCHAR(50) NOT NULL,
  seat_type VARCHAR(50) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'AVAILABLE',
  position_x INT,
  position_y INT,
  is_disabled BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_seat (event_id, seat_number),
  INDEX idx_event_status (event_id, status),
  INDEX idx_seat_type (seat_type),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  user_id VARCHAR(36),
  event_id VARCHAR(36) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING',
  customer_email VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50),
  expires_at DATETIME,
  paid_at DATETIME,
  cancelled_at DATETIME,
  cancellation_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_event_id (event_id),
  INDEX idx_status (status),
  INDEX idx_order_number (order_number),
  INDEX idx_customer_email (customer_email),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (event_id) REFERENCES events(id)
);
`;

console.log('📦 Creating tables...');
const statements = createTables.split(';').filter(s => s.trim());
for (const stmt of statements) {
  if (stmt.trim()) {
    await connection.execute(stmt);
  }
}
console.log('✅ Tables created!\n');

await connection.end();
console.log('🎉 Migration completed!');

