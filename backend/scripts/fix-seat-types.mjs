/**
 * Fix seat types in database
 * Sets rows A-B as VIP and rows C-H as STANDARD
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log('🔧 Fixing seat types...\n');

  try {
    // Update rows A and B to VIP
    console.log('Updating rows A-B to VIP...');
    const [vipResult] = await connection.execute(
      `UPDATE seats 
       SET seat_type = 'VIP', price = 2500000
       WHERE event_id = 'evt-tedx-2026' AND row IN ('A', 'B')`
    );
    console.log(`✅ Updated ${vipResult.affectedRows} seats to VIP\n`);

    // Update rows C-H to STANDARD
    console.log('Updating rows C-H to STANDARD...');
    const [stdResult] = await connection.execute(
      `UPDATE seats 
       SET seat_type = 'STANDARD', price = 1500000
       WHERE event_id = 'evt-tedx-2026' AND row IN ('C', 'D', 'E', 'F', 'G', 'H')`
    );
    console.log(`✅ Updated ${stdResult.affectedRows} seats to STANDARD\n`);

    // Verify changes
    console.log('📊 Current seat distribution:');
    const [rows] = await connection.execute(
      `SELECT 
         row,
         seat_type,
         COUNT(*) as seat_count,
         MIN(price) as min_price,
         MAX(price) as max_price
       FROM seats 
       WHERE event_id = 'evt-tedx-2026'
       GROUP BY row, seat_type
       ORDER BY row`
    );
    console.table(rows);

    console.log('\n✅ Seat types fixed successfully!');
    console.log('\n🔄 Please refresh your browser to see the changes.');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
