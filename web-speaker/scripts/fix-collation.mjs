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
  console.log('Fixing collation to utf8mb4_unicode_ci...\n');

  // Get all tables
  const [tables] = await connection.execute('SHOW TABLES');
  const tableKey = Object.keys(tables[0])[0];

  for (const row of tables) {
    const tableName = row[tableKey];
    console.log('Fixing table:', tableName);
    try {
      await connection.execute(`ALTER TABLE \`${tableName}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log('  ✅ Done');
    } catch (err) {
      console.log('  ❌ Error:', err.message);
    }
  }

  console.log('\n✅ All tables processed!');
  await connection.end();
}

main().catch(console.error);

