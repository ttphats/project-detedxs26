import { getPool } from '../dist/db/mysql.js';

async function checkMySQLMode() {
  const pool = getPool();

  try {
    console.log('🔍 Checking MySQL configuration...\n');

    // Check SQL mode
    const [modeResult] = await pool.query('SELECT @@sql_mode as sql_mode');
    console.log('📋 Current SQL Mode:');
    console.log(modeResult[0].sql_mode);
    console.log('');

    // Check for strict mode
    const sqlMode = modeResult[0].sql_mode;
    const hasStrictMode = sqlMode.includes('STRICT_TRANS_TABLES') || sqlMode.includes('STRICT_ALL_TABLES');
    const hasNoZeroDate = sqlMode.includes('NO_ZERO_DATE');
    const hasNoZeroInDate = sqlMode.includes('NO_ZERO_IN_DATE');

    console.log('✅ STRICT_TRANS_TABLES:', hasStrictMode ? 'Enabled ✓' : 'Disabled ✗');
    console.log('✅ NO_ZERO_DATE:', hasNoZeroDate ? 'Enabled ✓' : 'Disabled ✗');
    console.log('✅ NO_ZERO_IN_DATE:', hasNoZeroInDate ? 'Enabled ✓' : 'Disabled ✗');
    console.log('');

    // Check MySQL version
    const [versionResult] = await pool.query('SELECT VERSION() as version');
    console.log('📌 MySQL Version:', versionResult[0].version);
    console.log('');

    // Check seats table structure
    const [columnsResult] = await pool.query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'seats'
      AND COLUMN_NAME IN ('created_at', 'updated_at')
    `);

    console.log('📊 Seats datetime columns:');
    columnsResult.forEach(col => {
      console.log(`  ${col.COLUMN_NAME}: ${col.DATA_TYPE}, default=${col.COLUMN_DEFAULT}, nullable=${col.IS_NULLABLE}`);
    });
    console.log('');

    // Check for invalid dates
    const [invalidCount] = await pool.query(`
      SELECT COUNT(*) as count
      FROM seats
      WHERE updated_at = '0000-00-00 00:00:00' 
         OR updated_at IS NULL 
         OR YEAR(updated_at) = 0
         OR created_at = '0000-00-00 00:00:00'
         OR YEAR(created_at) = 0
    `);

    console.log('⚠️  Invalid dates in seats table:', invalidCount[0].count);

    if (!hasStrictMode || !hasNoZeroDate) {
      console.log('\n⚠️  WARNING: MySQL is not running in strict mode!');
      console.log('This allows invalid datetime values like 0000-00-00.');
      console.log('\nTo fix permanently, add to MySQL config (my.cnf or my.ini):');
      console.log('[mysqld]');
      console.log('sql_mode=STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE');
    }

    await pool.end();
    console.log('\n✅ Check complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkMySQLMode();
