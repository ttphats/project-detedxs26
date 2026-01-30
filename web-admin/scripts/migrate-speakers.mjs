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
if (!dbUrl) {
  console.error('❌ DATABASE_URL not found in .env');
  process.exit(1);
}
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

// Create speakers table (without FK constraint to avoid charset issues)
const createSpeakersTable = `
CREATE TABLE IF NOT EXISTS speakers (
  id VARCHAR(36) PRIMARY KEY,
  event_id VARCHAR(36) NOT NULL,
  name VARCHAR(200) NOT NULL,
  title VARCHAR(500),
  company VARCHAR(200),
  bio TEXT,
  image_url VARCHAR(500),
  topic VARCHAR(300),
  social_links JSON,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_speakers_event (event_id),
  INDEX idx_speakers_active (is_active),
  INDEX idx_speakers_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

console.log('📦 Creating speakers table...');
await connection.execute(createSpeakersTable);
console.log('✅ speakers table created!\n');

// Get first event to seed sample speakers
const [events] = await connection.execute('SELECT id FROM events LIMIT 1');
if (events.length > 0) {
  const eventId = events[0].id;
  
  // Check if speakers already exist
  const [existing] = await connection.execute('SELECT COUNT(*) as count FROM speakers WHERE event_id = ?', [eventId]);
  
  if (existing[0].count === 0) {
    console.log('🌱 Seeding sample speakers...');
    
    const speakers = [
      {
        name: 'Dr. Nguyen Thi Mai',
        title: 'AI Research Director tại VinAI Research với hơn 15 năm kinh nghiệm trong lĩnh vực Machine Learning và Computer Vision.',
        company: 'VinAI Research',
        bio: 'Leading AI researcher with 15+ years of experience in machine learning and computer vision. Published 50+ papers at top conferences.',
        image_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop',
        topic: 'The Future of AI in Southeast Asia',
        sort_order: 1
      },
      {
        name: 'Tran Minh Duc',
        title: 'Founder & CEO của EcoVietnam, người tiên phong trong lĩnh vực nông nghiệp bền vững.',
        company: 'EcoVietnam',
        bio: 'Social entrepreneur revolutionizing sustainable agriculture in Vietnam.',
        image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
        topic: 'Reimagining Agriculture for Climate Resilience',
        sort_order: 2
      },
      {
        name: 'Le Hoang Anh',
        title: 'Creative Director và nhà thiết kế đa phương tiện với tầm nhìn độc đáo về nghệ thuật số.',
        company: 'Studio Anh',
        bio: 'Award-winning creative director blending traditional Vietnamese art with digital innovation.',
        image_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
        topic: 'Digital Art and Cultural Identity',
        sort_order: 3
      },
      {
        name: 'Pham Van Khanh',
        title: 'Nhà khoa học thần kinh và chuyên gia về sức khỏe tâm thần tại Đại học Y Hà Nội.',
        company: 'Hanoi Medical University',
        bio: 'Neuroscientist dedicated to mental health awareness and brain research.',
        image_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop',
        topic: 'Understanding the Teenage Brain',
        sort_order: 4
      }
    ];
    
    for (const speaker of speakers) {
      const id = crypto.randomUUID();
      await connection.execute(
        `INSERT INTO speakers (id, event_id, name, title, company, bio, image_url, topic, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, eventId, speaker.name, speaker.title, speaker.company, speaker.bio, speaker.image_url, speaker.topic, speaker.sort_order]
      );
    }
    
    console.log(`✅ Seeded ${speakers.length} sample speakers!\n`);
  } else {
    console.log('ℹ️ Speakers already exist, skipping seed.\n');
  }
}

await connection.end();
console.log('🎉 Migration completed successfully!');

