const mysql = require('mysql2/promise');

const dbConfig = {
  host: '202.92.4.66',
  port: 3306,
  user: 'jyndyeeuhosting_easyticketdb',
  password: 'Easyticket@2026',
  database: 'jyndyeeuhosting_easyticketdb',
};

async function createSeatLocksTable() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('Creating seat_locks table...');
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS seat_locks (
        id VARCHAR(36) PRIMARY KEY,
        seat_id VARCHAR(36) UNIQUE NOT NULL,
        event_id VARCHAR(36) NOT NULL,
        session_id VARCHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE CASCADE,
        INDEX idx_event_id (event_id),
        INDEX idx_session_id (session_id),
        INDEX idx_expires_at (expires_at)
      )
    `);
    
    console.log('✅ seat_locks table created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating table:', error.message);
  } finally {
    await connection.end();
  }
}

createSeatLocksTable();

