#!/usr/bin/env node

/**
 * Migration & Seed: Speaker Registration System Tables
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env file from the parent directory of scripts
dotenv.config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL || 'mysql://rymukbi_admin:Admin%402026@103.179.188.241:3306/rymukbi_easyticketdb';
const cleanDbUrl = dbUrl.replace(/^"(.*)"$/, '$1');

const urlMatch = cleanDbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);

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

try {
  // 1. Create speaker_registration_config table
  console.log('📦 Creating speaker_registration_config table...');
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS speaker_registration_config (
      id VARCHAR(36) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      rules TEXT NOT NULL,
      description TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ speaker_registration_config table checked/created.');

  // 2. Create speaker_form_fields table
  console.log('📦 Creating speaker_form_fields table...');
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS speaker_form_fields (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      label VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      is_required TINYINT(1) NOT NULL DEFAULT 0,
      placeholder VARCHAR(255),
      options TEXT,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sort_order (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ speaker_form_fields table checked/created.');

  // 3. Create speaker_submissions table
  console.log('📦 Creating speaker_submissions table...');
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS speaker_submissions (
      id VARCHAR(36) PRIMARY KEY,
      answers TEXT NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ speaker_submissions table checked/created.');

  // Seeding Default Config
  console.log('\n🌱 Seeding default config data...');
  const [existingConfigs] = await connection.execute('SELECT COUNT(*) as count FROM speaker_registration_config');
  if (existingConfigs[0].count === 0) {
    const configId = randomUUID();
    const defaultTitle = 'Đăng ký trở thành Diễn giả TEDxFPTUniversityHCMC 2026';
    const defaultDesc = 'TEDx là sân chơi toàn cầu cho các ý tưởng độc đáo, truyền cảm hứng và đột phá. Hãy chia sẻ câu chuyện và góc nhìn sắc bén của bạn cùng chúng tôi!';
    const defaultRules = JSON.stringify([
      'Bài thuyết trình phải nằm trong giới hạn tối đa 18 phút theo tiêu chuẩn bản quyền của TED.',
      'Ý tưởng phải là của chính diễn giả, có luận điểm sắc bén và không sao chép.',
      'Nội dung mang tính học thuật, nghệ thuật hoặc trải nghiệm truyền cảm hứng; hoàn toàn không chứa quảng cáo sản phẩm, tôn giáo hoặc chính trị.',
      'Cam kết tham gia đầy đủ các buổi tổng duyệt chuẩn bị nội dung và phong cách trình bày cùng Ban tổ chức.',
      'Đại diện cho các lĩnh vực công nghệ, giải trí, thiết kế hoặc các chủ đề sáng tạo mới mẻ.'
    ]);
    
    await connection.execute(
      'INSERT INTO speaker_registration_config (id, title, description, rules) VALUES (?, ?, ?, ?)',
      [configId, defaultTitle, defaultDesc, defaultRules]
    );
    console.log('✅ Default config seeded successfully.');
  } else {
    console.log('ℹ️ Config already exists, skipping seed.');
  }

  // Seeding Default Form Fields
  console.log('🌱 Seeding default form fields...');
  const [existingFields] = await connection.execute('SELECT COUNT(*) as count FROM speaker_form_fields');
  if (existingFields[0].count === 0) {
    const defaultFields = [
      {
        name: 'fullName',
        label: 'Họ và tên',
        type: 'text',
        is_required: 1,
        placeholder: 'Nhập đầy đủ họ và tên của bạn',
        sort_order: 1
      },
      {
        name: 'email',
        label: 'Địa chỉ Email',
        type: 'email',
        is_required: 1,
        placeholder: 'Địa chỉ email để Ban tổ chức liên hệ',
        sort_order: 2
      },
      {
        name: 'phone',
        label: 'Số điện thoại',
        type: 'phone',
        is_required: 1,
        placeholder: 'Số điện thoại liên hệ (có Zalo)',
        sort_order: 3
      },
      {
        name: 'topic',
        label: 'Chủ đề bài thuyết trình',
        type: 'text',
        is_required: 1,
        placeholder: 'Ý tưởng hoặc tên chủ đề dự kiến của bạn',
        sort_order: 4
      },
      {
        name: 'summary',
        label: 'Tóm tắt ý tưởng bài nói',
        type: 'textarea',
        is_required: 1,
        placeholder: 'Tóm tắt thông điệp cốt lõi và giá trị mang lại cho khán giả (khoảng 200 - 300 từ)',
        sort_order: 5
      },
      {
        name: 'videoUrl',
        label: 'Link video thuyết trình nháp hoặc giới thiệu bản thân (nếu có)',
        type: 'text',
        is_required: 0,
        placeholder: 'Link Drive, Youtube, Dropbox...',
        sort_order: 6
      }
    ];

    for (const field of defaultFields) {
      await connection.execute(
        'INSERT INTO speaker_form_fields (id, name, label, type, is_required, placeholder, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [randomUUID(), field.name, field.label, field.type, field.is_required, field.placeholder, field.sort_order]
      );
      console.log(`  ✓ Field '${field.name}' seeded.`);
    }
    console.log('✅ Default form fields seeded successfully.');
  } else {
    console.log('ℹ️ Form fields already exist, skipping seed.');
  }

  console.log('\n🎉 Speaker system tables migration & seeding completed successfully!');
} catch (error) {
  console.error('❌ Migration error:', error.message);
} finally {
  await connection.end();
}
