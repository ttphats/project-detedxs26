// Migration script for email_templates table update
import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: '202.92.4.66',
  port: 3306,
  user: 'jyndyeeuhosting_easyticketdb',
  password: 'Easyticket@2026',
  database: 'jyndyeeuhosting_easyticketdb',
};

async function migrate() {
  console.log('🔄 Connecting to database...');
  const connection = await mysql.createConnection(DB_CONFIG);

  try {
    console.log('✅ Connected! Running migration...\n');

    // 1. Check if email_templates table exists and needs updating
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'email_templates'"
    );

    if (tables.length > 0) {
      console.log('📋 email_templates table exists. Checking columns...');
      
      const [columns] = await connection.execute(
        "SHOW COLUMNS FROM email_templates"
      );
      
      const columnNames = columns.map(c => c.Field);
      console.log('Current columns:', columnNames.join(', '));

      // Add purpose column if not exists
      if (!columnNames.includes('purpose')) {
        console.log('➕ Adding purpose column...');
        await connection.execute(`
          ALTER TABLE email_templates 
          ADD COLUMN purpose VARCHAR(50) DEFAULT 'TICKET_CONFIRMED' AFTER id
        `);
      }

      // Add version column if not exists
      if (!columnNames.includes('version')) {
        console.log('➕ Adding version column...');
        await connection.execute(`
          ALTER TABLE email_templates 
          ADD COLUMN version INT DEFAULT 1 AFTER is_active
        `);
      }

      // Add created_by column if not exists
      if (!columnNames.includes('created_by')) {
        console.log('➕ Adding created_by column...');
        await connection.execute(`
          ALTER TABLE email_templates 
          ADD COLUMN created_by VARCHAR(36) NULL AFTER version
        `);
      }

      // Drop unique constraint on name if exists
      try {
        await connection.execute(`
          ALTER TABLE email_templates DROP INDEX name
        `);
        console.log('🗑️ Dropped unique index on name');
      } catch (e) {
        // Index might not exist
      }

      // Change html_content to LONGTEXT if needed
      console.log('📝 Updating html_content column type...');
      await connection.execute(`
        ALTER TABLE email_templates 
        MODIFY COLUMN html_content LONGTEXT
      `);

      // Add indexes
      try {
        await connection.execute(`
          CREATE INDEX idx_purpose ON email_templates(purpose)
        `);
        console.log('➕ Added index on purpose');
      } catch (e) {
        // Index might already exist
      }

      try {
        await connection.execute(`
          CREATE INDEX idx_is_active ON email_templates(is_active)
        `);
        console.log('➕ Added index on is_active');
      } catch (e) {
        // Index might already exist
      }

      console.log('✅ email_templates table updated!\n');
    } else {
      console.log('❌ email_templates table does not exist. Creating...');
      await connection.execute(`
        CREATE TABLE email_templates (
          id VARCHAR(36) PRIMARY KEY,
          purpose VARCHAR(50) NOT NULL,
          name VARCHAR(100) NOT NULL,
          subject VARCHAR(200) NOT NULL,
          html_content LONGTEXT NOT NULL,
          text_content TEXT,
          variables TEXT,
          is_active BOOLEAN DEFAULT FALSE,
          version INT DEFAULT 1,
          created_by VARCHAR(36),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_purpose (purpose),
          INDEX idx_is_active (is_active),
          INDEX idx_created_by (created_by)
        )
      `);
      console.log('✅ email_templates table created!\n');
    }

    // 2. Update email_logs table
    const [logsTable] = await connection.execute(
      "SHOW TABLES LIKE 'email_logs'"
    );

    if (logsTable.length > 0) {
      console.log('📋 email_logs table exists. Checking columns...');
      
      const [logColumns] = await connection.execute(
        "SHOW COLUMNS FROM email_logs"
      );
      
      const logColumnNames = logColumns.map(c => c.Field);

      if (!logColumnNames.includes('purpose')) {
        console.log('➕ Adding purpose column to email_logs...');
        await connection.execute(`
          ALTER TABLE email_logs 
          ADD COLUMN purpose VARCHAR(50) DEFAULT 'TICKET_CONFIRMED' AFTER id
        `);
      }

      if (!logColumnNames.includes('template_id')) {
        console.log('➕ Adding template_id column to email_logs...');
        await connection.execute(`
          ALTER TABLE email_logs 
          ADD COLUMN template_id VARCHAR(36) NULL AFTER purpose
        `);
      }

      if (!logColumnNames.includes('metadata')) {
        console.log('➕ Adding metadata column to email_logs...');
        await connection.execute(`
          ALTER TABLE email_logs 
          ADD COLUMN metadata TEXT NULL AFTER error
        `);
      }

      // Change html_content to LONGTEXT
      console.log('📝 Updating html_content column type in email_logs...');
      await connection.execute(`
        ALTER TABLE email_logs 
        MODIFY COLUMN html_content LONGTEXT
      `);

      console.log('✅ email_logs table updated!\n');
    }

    console.log('🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await connection.end();
    console.log('\n👋 Database connection closed.');
  }
}

migrate();

