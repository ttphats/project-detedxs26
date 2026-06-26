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

  const [versions] = await connection.execute('SELECT * FROM seat_layout_versions WHERE is_active = 1');
  
  if (versions.length > 0) {
    const v = versions[0];
    console.log('=== ACTIVE VERSION ===');
    console.log('ID:', v.id);
    console.log('Name:', v.version_name);
    console.log('Status:', v.status);
    
    const seatsData = typeof v.seats_data === 'string' ? JSON.parse(v.seats_data) : v.seats_data;
    
    // Count by type
    const counts = {};
    seatsData.forEach(s => {
      counts[s.type] = (counts[s.type] || 0) + 1;
    });
    
    console.log('\n=== SEATS IN VERSION ===');
    console.table(counts);
    console.log('Total:', seatsData.length);
  } else {
    console.log('No active version found');
  }

  await connection.end();
}

main().catch(console.error);

