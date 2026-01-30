import { v2 as cloudinary } from 'cloudinary';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

// Configure Cloudinary from URL
const cloudinaryUrl = env.CLOUDINARY_URL;
if (cloudinaryUrl) {
  const match = cloudinaryUrl.match(/cloudinary:\/\/(\d+):([^@]+)@(.+)/);
  if (match) {
    cloudinary.config({
      cloud_name: match[3],
      api_key: match[1],
      api_secret: match[2],
    });
    console.log('✅ Cloudinary configured:', match[3]);
  }
}

// Sample images to upload (from Unsplash)
// Thumbnail: TEDx audience image (photo-1540575467063-178a50c2df87)
// Banner: TEDx stage/speaker image
const eventImages = {
  'evt-tedx-2026': {
    banner: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=600&fit=crop',
  },
  'evt-tedxyouth-2026': {
    banner: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=600&fit=crop',
  },
};

// Speaker sample images (professional portraits)
const speakerImages = [
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop', // female 1
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop', // male 1
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop', // female 2
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop', // male 2
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop', // female 3
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop', // male 3
];

async function uploadEventImage(imageUrl, publicId, isThumb = false) {
  try {
    const transformation = isThumb
      ? [{ width: 800, height: 600, crop: 'fill', quality: 'auto', format: 'auto' }]
      : [{ width: 1920, height: 1080, crop: 'fill', quality: 'auto', format: 'auto' }];

    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: 'tedx-fptuhcmc/events',
      public_id: publicId,
      overwrite: true,
      transformation,
    });
    console.log(`  ✅ Uploaded: ${publicId}`);
    return result.secure_url;
  } catch (error) {
    console.error(`  ❌ Failed to upload ${publicId}:`, error.message);
    return null;
  }
}

async function uploadSpeakerImage(imageUrl, publicId) {
  try {
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: 'tedx-fptuhcmc/speakers',
      public_id: publicId,
      overwrite: true,
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto', format: 'auto' }
      ]
    });
    console.log(`  ✅ Uploaded: ${publicId}`);
    return result.secure_url;
  } catch (error) {
    console.error(`  ❌ Failed to upload ${publicId}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('\n🚀 Starting event images seed...\n');

  // Connect to database
  const connection = await mysql.createConnection({
    host: env.DB_HOST || '202.92.4.66',
    port: parseInt(env.DB_PORT || '3306'),
    user: env.DB_USER || 'jyndyeeuhosting_easyticketdb',
    password: env.DB_PASSWORD || 'Easyticket@2026',
    database: env.DB_NAME || 'jyndyeeuhosting_easyticketdb',
  });
  console.log('✅ Connected to database\n');

  // Get existing events
  const [events] = await connection.execute('SELECT id, name FROM events');
  console.log(`Found ${events.length} events:\n`);

  for (const event of events) {
    console.log(`📸 Processing: ${event.name} (${event.id})`);
    
    const images = eventImages[event.id];
    if (!images) {
      console.log('  ⚠️ No images configured for this event\n');
      continue;
    }

    // Upload banner
    const bannerUrl = await uploadEventImage(
      images.banner,
      `${event.id}-banner`,
      false
    );

    // Upload thumbnail
    const thumbnailUrl = await uploadEventImage(
      images.thumbnail,
      `${event.id}-thumbnail`,
      true
    );

    // Update database
    if (bannerUrl || thumbnailUrl) {
      const updates = [];
      const values = [];
      
      if (bannerUrl) {
        updates.push('banner_image_url = ?');
        values.push(bannerUrl);
      }
      if (thumbnailUrl) {
        updates.push('thumbnail_url = ?');
        values.push(thumbnailUrl);
      }
      
      values.push(event.id);
      
      await connection.execute(
        `UPDATE events SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      console.log('  ✅ Database updated\n');
    }
  }

  // Verify event updates
  console.log('\n📋 Final event data:\n');
  const [updatedEvents] = await connection.execute(
    'SELECT id, name, banner_image_url, thumbnail_url FROM events'
  );

  for (const event of updatedEvents) {
    console.log(`${event.name}:`);
    console.log(`  Banner: ${event.banner_image_url || '(none)'}`);
    console.log(`  Thumbnail: ${event.thumbnail_url || '(none)'}\n`);
  }

  // ============ SPEAKERS ============
  console.log('\n🎤 Processing speakers...\n');

  const [speakers] = await connection.execute('SELECT id, name, image_url FROM speakers');
  console.log(`Found ${speakers.length} speakers:\n`);

  for (let i = 0; i < speakers.length; i++) {
    const speaker = speakers[i];
    console.log(`🎤 Processing: ${speaker.name} (${speaker.id})`);

    // Use a different image for each speaker (cycle through available images)
    const imageUrl = speakerImages[i % speakerImages.length];

    const uploadedUrl = await uploadSpeakerImage(imageUrl, speaker.id);

    if (uploadedUrl) {
      await connection.execute(
        'UPDATE speakers SET image_url = ? WHERE id = ?',
        [uploadedUrl, speaker.id]
      );
      console.log('  ✅ Database updated\n');
    }
  }

  // Verify speaker updates
  console.log('\n📋 Final speaker data:\n');
  const [updatedSpeakers] = await connection.execute(
    'SELECT id, name, image_url FROM speakers'
  );

  for (const speaker of updatedSpeakers) {
    console.log(`${speaker.name}: ${speaker.image_url || '(none)'}`);
  }

  await connection.end();
  console.log('\n✅ All done!\n');
}

main().catch(console.error);

