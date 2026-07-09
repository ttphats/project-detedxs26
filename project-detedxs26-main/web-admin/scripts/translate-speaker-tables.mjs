#!/usr/bin/env node

/**
 * Migration: Translate Speaker Registration System config & form fields to English
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  // 1. Update speaker_registration_config
  console.log('📝 Translating speaker_registration_config to English...');
  const defaultTitle = 'Register to Become a Speaker - TEDxFPTUniversityHCMC 2026';
  const defaultDesc = 'TEDx is a global platform for unique, inspiring, and groundbreaking ideas. Share your story and sharp perspective with us!';
  const defaultRules = JSON.stringify([
    'The presentation must be within a maximum limit of 18 minutes, adhering to TED licensing standards.',
    'The ideas must belong to the speaker, featuring sharp arguments and no plagiarism.',
    'Content must be academic, artistic, or inspiring; strictly no commercial advertisements, religious, or political preaching.',
    'Commit to fully participating in all rehearsal sessions to prepare content and presentation style with the Organizing Committee.',
    'Represent fields in technology, entertainment, design, or other fresh creative topics.'
  ]);

  await connection.execute(
    'UPDATE speaker_registration_config SET title = ?, description = ?, rules = ?',
    [defaultTitle, defaultDesc, defaultRules]
  );
  console.log('✅ Config translated.');

  // 2. Translate form field labels and placeholders
  console.log('📝 Translating speaker_form_fields to English...');
  const translations = [
    { name: 'fullName', label: 'Full Name', placeholder: 'Enter your full name' },
    { name: 'email', label: 'Email Address', placeholder: 'Your contact email address' },
    { name: 'phone', label: 'Phone Number', placeholder: 'Your contact number (with country code)' },
    { name: 'topic', label: 'Presentation Topic', placeholder: 'Your proposed topic or title' },
    { name: 'summary', label: 'Presentation Summary', placeholder: 'Summarize your core message and value for the audience (approx. 200 - 300 words)' },
    { name: 'videoUrl', label: 'Draft Presentation Video Link (Optional)', placeholder: 'Google Drive, Youtube, Dropbox link...' }
  ];

  for (const trans of translations) {
    await connection.execute(
      'UPDATE speaker_form_fields SET label = ?, placeholder = ? WHERE name = ?',
      [trans.label, trans.placeholder, trans.name]
    );
    console.log(`  ✓ Translated field: ${trans.name}`);
  }

  console.log('\n🎉 Translation to English completed successfully!');
} catch (error) {
  console.error('❌ Translation error:', error.message);
} finally {
  await connection.end();
}
