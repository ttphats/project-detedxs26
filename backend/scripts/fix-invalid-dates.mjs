import { getPool } from '../dist/db/mysql.js';

async function fixInvalidDates() {
  const pool = getPool();

  try {
    console.log('🔧 Fixing invalid datetime values...');

    // Fix seats table - updated_at
    const [seatsResult] = await pool.query(
      `UPDATE seats 
       SET updated_at = created_at 
       WHERE updated_at = '0000-00-00 00:00:00' OR updated_at IS NULL OR updated_at < '1970-01-01'`
    );
    console.log(`✅ Fixed ${seatsResult.affectedRows} rows in seats table (updated_at)`);

    // Fix seats table - created_at if needed
    const [seatsCreatedResult] = await pool.query(
      `UPDATE seats 
       SET created_at = NOW() 
       WHERE created_at = '0000-00-00 00:00:00' OR created_at IS NULL OR created_at < '1970-01-01'`
    );
    console.log(`✅ Fixed ${seatsCreatedResult.affectedRows} rows in seats table (created_at)`);

    // Then fix updated_at again if created_at was just set
    const [seatsResult2] = await pool.query(
      `UPDATE seats 
       SET updated_at = created_at 
       WHERE updated_at = '0000-00-00 00:00:00' OR updated_at IS NULL OR updated_at < '1970-01-01'`
    );
    console.log(`✅ Fixed ${seatsResult2.affectedRows} more rows in seats table (updated_at second pass)`);

    console.log('✅ All invalid dates fixed!');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing dates:', error);
    process.exit(1);
  }
}

fixInvalidDates();
