/**
 * Migration script for event_timelines table
 * Implements timeline management for TEDx events
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from web-admin directory
dotenv.config({ path: join(__dirname, '../.env') });

// Parse DATABASE_URL from .env
function parseDatabaseUrl(url) {
  const regex = /mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
  const match = url.match(regex);
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }
  return {
    user: match[1],
    password: decodeURIComponent(match[2]), // Decode URL-encoded password
    host: match[3],
    port: parseInt(match[4]),
    database: match[5].split('?')[0], // Remove query params
  };
}

async function migrate() {
  let connection;
  
  try {
    // Read and parse DATABASE_URL from .env file
    const envPath = join(__dirname, '../.env');
    const envContent = readFileSync(envPath, 'utf-8');
    const databaseUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
    
    if (!databaseUrlMatch) {
      throw new Error('DATABASE_URL not found in .env file');
    }
    
    const dbConfig = parseDatabaseUrl(databaseUrlMatch[1]);
    console.log(`📦 Connecting to database: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');

    // Check events table info
    const [eventsInfo] = await connection.execute(
      "SELECT TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events'"
    );
    console.log('📋 Events table collation:', eventsInfo[0]?.TABLE_COLLATION);

    // Check events.id column definition
    const [eventsIdCol] = await connection.execute(
      "SELECT COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events' AND COLUMN_NAME = 'id'"
    );
    console.log('📋 Events.id column:', eventsIdCol[0]);

    // Check if events.id has PRIMARY KEY or INDEX
    const [eventsIndexes] = await connection.execute(
      "SHOW INDEX FROM events WHERE Column_name = 'id'"
    );
    console.log('📋 Events.id indexes:', eventsIndexes.length > 0 ? eventsIndexes[0].Key_name : 'NO INDEX');

    // Check if table already exists
    const [existingTable] = await connection.execute(
      "SHOW TABLES LIKE 'event_timelines'"
    );
    if (existingTable.length > 0) {
      console.log('⚠️ Table event_timelines already exists, skipping...');
      // Show existing structure
      const [columns] = await connection.execute('DESCRIBE event_timelines');
      console.log('\n📋 Existing table structure:');
      columns.forEach(col => {
        console.log(`   - ${col.Field}: ${col.Type}`);
      });
      console.log('\n🎉 Migration completed (table exists)!');
      return;
    }

    // Check events table engine
    const [eventsEngine] = await connection.execute(
      "SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events'"
    );
    console.log('📋 Events table engine:', eventsEngine[0]?.ENGINE);

    // Create event_timelines table WITHOUT foreign key first, then add FK separately
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS event_timelines (
        id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY,
        event_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        start_time VARCHAR(10) NOT NULL COMMENT 'HH:mm format',
        end_time VARCHAR(10) NOT NULL COMMENT 'HH:mm format',
        title VARCHAR(200) NOT NULL,
        description TEXT,
        speaker_name VARCHAR(100),
        speaker_avatar_url VARCHAR(500),
        type VARCHAR(20) NOT NULL DEFAULT 'OTHER' COMMENT 'TALK, BREAK, CHECKIN, OTHER',
        order_index INT NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT, PUBLISHED',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_event_id (event_id),
        INDEX idx_event_status (event_id, status),
        INDEX idx_order (order_index)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Timeline items for events - TEDx schedule management';
    `;

    console.log('🔄 Creating event_timelines table...');
    await connection.execute(createTableSQL);
    console.log('✅ Table event_timelines created successfully!');

    // Try to add foreign key (may fail on some hosts, that's OK)
    try {
      console.log('🔄 Adding foreign key constraint...');
      await connection.execute(`
        ALTER TABLE event_timelines
        ADD CONSTRAINT fk_timeline_event
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      `);
      console.log('✅ Foreign key constraint added');
    } catch (fkError) {
      console.log('⚠️ Could not add foreign key (may already exist or not supported):', fkError.message);
    }

    // Verify table exists
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'event_timelines'"
    );

    if (tables.length > 0) {
      console.log('✅ Verified: event_timelines table exists');

      // Show table structure
      const [columns] = await connection.execute('DESCRIBE event_timelines');
      console.log('\n📋 Table structure:');
      columns.forEach(col => {
        console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(nullable)' : '(required)'}`);
      });
    }

    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('👋 Database connection closed');
    }
  }
}

migrate().catch(console.error);

