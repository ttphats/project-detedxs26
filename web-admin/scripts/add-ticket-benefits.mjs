import mysql from 'mysql2/promise';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env
const envContent = fs.readFileSync(join(__dirname, '../.env'), 'utf-8');
const envLines = envContent.split('\n');
for (const line of envLines) {
  if (line.startsWith('#') || !line.includes('=')) continue;
  const eqIndex = line.indexOf('=');
  const key = line.slice(0, eqIndex).trim();
  let value = line.slice(eqIndex + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1)
  });

  console.log('Connected to database');

  // Check if columns exist
  const [columns] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_types' 
     AND COLUMN_NAME IN ('benefits', 'subtitle')`
  );

  const existingColumns = columns.map(c => c.COLUMN_NAME);
  console.log('Existing columns:', existingColumns);

  // Add subtitle column if not exists
  if (!existingColumns.includes('subtitle')) {
    console.log('Adding subtitle column...');
    await connection.execute(`
      ALTER TABLE ticket_types 
      ADD COLUMN subtitle VARCHAR(500) NULL AFTER description
    `);
    console.log('✅ Added subtitle column');
  } else {
    console.log('subtitle column already exists');
  }

  // Add benefits column if not exists
  if (!existingColumns.includes('benefits')) {
    console.log('Adding benefits column...');
    await connection.execute(`
      ALTER TABLE ticket_types 
      ADD COLUMN benefits JSON NULL AFTER subtitle
    `);
    console.log('✅ Added benefits column');
  } else {
    console.log('benefits column already exists');
  }

  // Update existing ticket types with sample benefits
  console.log('\nUpdating existing ticket types with sample benefits...');

  // VIP benefits
  const vipBenefits = JSON.stringify([
    "Ghế hạng nhất (Hàng A-B)",
    "Gặp gỡ diễn giả",
    "Tiệc tối độc quyền",
    "Quà tặng VIP",
    "Check-in ưu tiên"
  ]);

  await connection.execute(`
    UPDATE ticket_types 
    SET subtitle = 'Premium seating, Speaker meet & greet, Exclusive dinner',
        benefits = ?
    WHERE UPPER(name) = 'VIP'
  `, [vipBenefits]);

  // Standard benefits
  const standardBenefits = JSON.stringify([
    "Ghế tiêu chuẩn (Hàng C-H)",
    "Tham gia tất cả các phiên",
    "Bao gồm bữa trưa",
    "Tài liệu sự kiện"
  ]);

  await connection.execute(`
    UPDATE ticket_types 
    SET subtitle = 'General admission, All talks access, Lunch included',
        benefits = ?
    WHERE UPPER(name) = 'STANDARD'
  `, [standardBenefits]);

  // Economy benefits
  const economyBenefits = JSON.stringify([
    "Ghế hàng sau",
    "Tham gia các phiên chính",
    "Nước uống miễn phí"
  ]);

  await connection.execute(`
    UPDATE ticket_types 
    SET subtitle = 'Budget-friendly, Main sessions access',
        benefits = ?
    WHERE UPPER(name) = 'ECONOMY'
  `, [economyBenefits]);

  console.log('✅ Updated ticket types with benefits');

  // Show result
  const [result] = await connection.execute(`
    SELECT id, name, subtitle, benefits FROM ticket_types
  `);
  console.log('\n=== Updated Ticket Types ===');
  for (const tt of result) {
    console.log(`\n${tt.name}:`);
    console.log(`  Subtitle: ${tt.subtitle}`);
    console.log(`  Benefits: ${tt.benefits}`);
  }

  await connection.end();
  console.log('\n✅ Migration completed!');
}

main().catch(console.error);

