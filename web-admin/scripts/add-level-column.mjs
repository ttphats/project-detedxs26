#!/usr/bin/env node

/**
 * Migration: Add `level` column to ticket_types table
 * 
 * This script adds the `level` column to existing ticket_types without losing data.
 * It assigns levels based on price: lowest price = level 1, highest price = level 3
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Parse DATABASE_URL from .env
const dbUrl = process.env.DATABASE_URL || 'mysql://rymukbi_admin:Admin%402026@103.179.188.241:3306/rymukbi_easyticketdb';
const urlMatch = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);

if (!urlMatch) {
  console.error('❌ Invalid DATABASE_URL format');
  process.exit(1);
}

const [, user, password, host, port, database] = urlMatch;
const decodedPassword = decodeURIComponent(password);

const connection = await mysql.createConnection({
  host,
  port: parseInt(port),
  user,
  password: decodedPassword,
  database,
});

console.log('🔗 Connected to database');

// Check if level column exists
console.log('\n🔍 Checking if level column exists...');
const [columns] = await connection.execute(
  `SHOW COLUMNS FROM ticket_types LIKE 'level'`
);

if (columns.length > 0) {
  console.log('✅ Level column already exists!');
  await connection.end();
  process.exit(0);
}

// Add level column
console.log('📦 Adding level column to ticket_types table...');
await connection.execute(`
  ALTER TABLE ticket_types 
  ADD COLUMN level INT NOT NULL DEFAULT 1 COMMENT 'Ticket level: 1=cheapest, 2=mid, 3=expensive' AFTER price,
  ADD INDEX idx_level (level)
`);
console.log('✅ Level column added!');

// Auto-assign levels based on price for each event
console.log('\n🎯 Auto-assigning levels based on price...');
const [events] = await connection.execute(
  'SELECT DISTINCT event_id FROM ticket_types'
);

for (const event of events) {
  const eventId = event.event_id;
  
  // Get all ticket types for this event, ordered by price
  const [ticketTypes] = await connection.execute(
    'SELECT id, name, price FROM ticket_types WHERE event_id = ? ORDER BY price ASC',
    [eventId]
  );
  
  if (ticketTypes.length === 0) continue;
  
  console.log(`\n   Event: ${eventId}`);
  console.log(`   Found ${ticketTypes.length} ticket types`);
  
  // Assign levels based on position in sorted array
  for (let i = 0; i < ticketTypes.length; i++) {
    const tt = ticketTypes[i];
    let level = 1;
    
    if (ticketTypes.length === 1) {
      level = 1; // Only one type = level 1
    } else if (ticketTypes.length === 2) {
      level = i === 0 ? 1 : 3; // Two types: level 1 and 3
    } else {
      // Three or more types: distribute evenly
      const third = Math.ceil(ticketTypes.length / 3);
      if (i < third) {
        level = 1; // First third = level 1
      } else if (i < third * 2) {
        level = 2; // Second third = level 2
      } else {
        level = 3; // Last third = level 3
      }
    }
    
    await connection.execute(
      'UPDATE ticket_types SET level = ? WHERE id = ?',
      [level, tt.id]
    );
    
    console.log(`   ✓ ${tt.name} (${tt.price.toLocaleString('vi-VN')} VNĐ) → Level ${level}`);
  }
}

console.log('\n✅ Migration completed!');
await connection.end();
