const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('Running migration...');
    const query = `
      ALTER TABLE order_items 
      ADD COLUMN attendee_name VARCHAR(255) DEFAULT NULL,
      ADD COLUMN attendee_email VARCHAR(255) DEFAULT NULL,
      ADD COLUMN attendee_phone VARCHAR(50) DEFAULT NULL;
    `;
    
    // First, let's check if the columns exist
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'order_items' AND COLUMN_NAME = 'attendee_name'
    `, [process.env.DB_NAME]);

    if (columns.length > 0) {
      console.log('Columns already exist, skipping migration.');
    } else {
      await connection.query(query);
      console.log('Migration successful.');
    }
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

migrate();
