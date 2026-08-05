/**
 * Fix seat col numbers in database
 * RIGHT section should have col: 1, 2, 3, 4, 5 (not 6, 7, 8, 9, 10)
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

  console.log('🔧 Fixing seat col numbers...\n');

  try {
    // Get all seats for the event, grouped by row and section
    const [seats] = await connection.execute(
      `SELECT id, seat_number, row, col, section 
       FROM seats 
       WHERE event_id = 'evt-tedx-2026'
       ORDER BY row, section, col`
    );

    console.log(`📊 Found ${seats.length} seats to check\n`);

    // Group by row and section
    const updates = [];
    const grouped = {};
    
    for (const seat of seats) {
      const key = `${seat.row}-${seat.section}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(seat);
    }

    // Fix col numbers for each section
    for (const [key, sectionSeats] of Object.entries(grouped)) {
      sectionSeats.sort((a, b) => {
        // Sort by seat_number to maintain order (A1, A2, A3...)
        const numA = parseInt(a.seat_number.replace(/[A-Z]/g, ''));
        const numB = parseInt(b.seat_number.replace(/[A-Z]/g, ''));
        return numA - numB;
      });

      // Assign col numbers 1, 2, 3, 4, 5 for each section
      sectionSeats.forEach((seat, index) => {
        const newCol = index + 1;
        if (seat.col !== newCol) {
          updates.push({
            id: seat.id,
            seat_number: seat.seat_number,
            old_col: seat.col,
            new_col: newCol,
            section: seat.section
          });
        }
      });
    }

    if (updates.length === 0) {
      console.log('✅ All seat col numbers are already correct!');
      await connection.end();
      return;
    }

    console.log(`🔄 Updating ${updates.length} seats...\n`);

    // Perform updates
    for (const update of updates) {
      await connection.execute(
        'UPDATE seats SET col = ? WHERE id = ?',
        [update.new_col, update.id]
      );
      console.log(`  ${update.seat_number} (${update.section}): ${update.old_col} → ${update.new_col}`);
    }

    console.log(`\n✅ Updated ${updates.length} seats successfully!`);

    // Verify the changes
    console.log('\n📊 Verification - Seats by row and section:');
    const [verification] = await connection.execute(
      `SELECT row, section, 
              GROUP_CONCAT(col ORDER BY col) as col_numbers,
              COUNT(*) as count
       FROM seats 
       WHERE event_id = 'evt-tedx-2026'
       GROUP BY row, section
       ORDER BY row, FIELD(section, 'LEFT', 'RIGHT')`
    );
    console.table(verification);

    console.log('\n🔄 Please refresh your browser to see the changes.');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
