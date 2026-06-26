import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

// Load .env file manually
const envContent = readFileSync('.env', 'utf-8');
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

// Parse DATABASE_URL
const dbUrl = process.env.DATABASE_URL;
const url = new URL(dbUrl);

const config = {
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
};

console.log('🔌 Connecting to database...');
const connection = await mysql.createConnection(config);
console.log('✅ Connected!\n');

// Show tables
console.log('📋 Tables in database:');
const [tables] = await connection.execute('SHOW TABLES');
console.log(tables);

// Check events table structure
console.log('\n📋 Events table structure:');
try {
  const [eventsDesc] = await connection.execute('DESCRIBE events');
  console.log(eventsDesc);
} catch (e) {
  console.log('❌ Events table does not exist');
}

// Check if events exist
console.log('\n📋 Events data:');
try {
  const [events] = await connection.execute('SELECT id, name FROM events LIMIT 5');
  console.log(events);
} catch (e) {
  console.log('❌ No events found');
}

// Check speakers
console.log('\n📋 Speakers data:');
try {
  const [speakers] = await connection.execute('SELECT id, name, company, topic FROM speakers');
  console.log(speakers);
} catch (e) {
  console.log('❌ No speakers found:', e.message);
}

await connection.end();

