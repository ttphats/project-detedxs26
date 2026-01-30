import mysql from 'mysql2/promise';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

// Parse DATABASE_URL
function parseDbUrl(url) {
  const regex = /mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
  const match = url.match(regex);
  if (!match) throw new Error('Invalid DATABASE_URL');
  return {
    user: match[1],
    password: decodeURIComponent(match[2]),
    host: match[3],
    port: parseInt(match[4]),
    database: match[5].split('?')[0],
  };
}

const dbConfig = parseDbUrl(process.env.DATABASE_URL);

// Mock timeline data from web-client
const tedxTimeline = [
  { time: '08:30', endTime: '09:00', title: 'Registration & Welcome Coffee', description: 'Check-in and networking', type: 'CHECKIN' },
  { time: '09:00', endTime: '09:30', title: 'Opening Ceremony', description: 'Welcome address and introduction', type: 'TALK' },
  { time: '09:30', endTime: '10:00', title: 'The Future of AI in Southeast Asia', description: 'Keynote by Dr. Nguyen Thi Mai', type: 'TALK', speakerName: 'Dr. Nguyen Thi Mai' },
  { time: '10:00', endTime: '10:30', title: 'Reimagining Agriculture', description: 'Talk by Tran Minh Duc', type: 'TALK', speakerName: 'Tran Minh Duc' },
  { time: '10:30', endTime: '11:00', title: 'Coffee Break', description: 'Refreshments and networking', type: 'BREAK' },
  { time: '11:00', endTime: '11:30', title: 'Stories That Connect Us', description: 'Talk by Le Hoang Anh', type: 'TALK', speakerName: 'Le Hoang Anh' },
  { time: '11:30', endTime: '12:00', title: 'Quantum Leap', description: 'Talk by Prof. Pham Van Tuan', type: 'TALK', speakerName: 'Prof. Pham Van Tuan' },
  { time: '12:00', endTime: '14:00', title: 'Lunch Break', description: 'Networking lunch with speakers', type: 'BREAK' },
  { time: '14:00', endTime: '14:30', title: 'Musical Performance', description: 'Live performance by local artists', type: 'OTHER' },
  { time: '14:30', endTime: '15:30', title: 'Panel Discussion', description: 'Innovation in Vietnam', type: 'TALK' },
  { time: '15:30', endTime: '17:00', title: 'Networking Session', description: 'Connect with speakers and attendees', type: 'OTHER' },
  { time: '17:00', endTime: '18:00', title: 'Closing Ceremony', description: 'Wrap-up and photo session', type: 'TALK' },
];

async function seedTimelines() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('🔗 Connected to database');
    
    // Get event ID (evt-tedx-2026 or first event)
    const [events] = await connection.execute(
      "SELECT id, name FROM events WHERE id = 'evt-tedx-2026' OR slug = 'tedx-fpt-2026' LIMIT 1"
    );
    
    let eventId;
    if (events.length > 0) {
      eventId = events[0].id;
      console.log(`📅 Found event: ${events[0].name} (${eventId})`);
    } else {
      // Get any event
      const [anyEvents] = await connection.execute("SELECT id, name FROM events LIMIT 1");
      if (anyEvents.length === 0) {
        console.log('❌ No events found in database. Please create an event first.');
        return;
      }
      eventId = anyEvents[0].id;
      console.log(`📅 Using event: ${anyEvents[0].name} (${eventId})`);
    }
    
    // Check if timelines already exist for this event
    const [existing] = await connection.execute(
      'SELECT COUNT(*) as count FROM event_timelines WHERE event_id = ?',
      [eventId]
    );
    
    if (existing[0].count > 0) {
      console.log(`⚠️ Event already has ${existing[0].count} timeline items. Skipping seed.`);
      console.log('   To reseed, delete existing timelines first.');
      return;
    }
    
    // Insert timeline items
    console.log('📝 Inserting timeline items...');
    
    for (let i = 0; i < tedxTimeline.length; i++) {
      const item = tedxTimeline[i];
      const id = randomUUID();
      
      await connection.execute(
        `INSERT INTO event_timelines 
         (id, event_id, start_time, end_time, title, description, speaker_name, speaker_avatar_url, type, order_index, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PUBLISHED', NOW(), NOW())`,
        [
          id,
          eventId,
          item.time,
          item.endTime,
          item.title,
          item.description,
          item.speakerName || null,
          null, // speaker avatar
          item.type,
          i,
        ]
      );
      
      console.log(`   ✅ ${item.time} - ${item.title}`);
    }
    
    console.log(`\n🎉 Successfully seeded ${tedxTimeline.length} timeline items!`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

seedTimelines();

