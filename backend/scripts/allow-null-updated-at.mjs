import { getPool } from '../dist/db/mysql.js';

async function allowNullUpdatedAt() {
  const pool = getPool();

  try {
    console.log('🔧 Modifying seats.updated_at to allow NULL...\n');

    // Modify column to allow NULL
    await pool.query(`
      ALTER TABLE seats 
      MODIFY COLUMN updated_at DATETIME NULL DEFAULT NULL 
      ON UPDATE CURRENT_TIMESTAMP(3)
    `);

    console.log('✅ Column modified successfully!\n');

    // Verify the change
    const [result] = await pool.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'seats' 
        AND COLUMN_NAME = 'updated_at'
    `);

    console.log('📊 New column definition:');
    console.log(result[0]);
    console.log('');

    // Set existing invalid dates to NULL
    const [updateResult] = await pool.query(`
      UPDATE seats 
      SET updated_at = NULL 
      WHERE updated_at = '0000-00-00 00:00:00' 
         OR YEAR(updated_at) = 0
    `);

    console.log(`✅ Set ${updateResult.affectedRows} invalid dates to NULL\n`);

    await pool.end();
    console.log('✅ Migration complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

allowNullUpdatedAt();
