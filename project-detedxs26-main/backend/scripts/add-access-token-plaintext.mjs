#!/usr/bin/env node
/**
 * Migration: Add access_token column to orders table
 * This stores the plaintext token for sending in emails
 */

import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import {fileURLToPath} from 'url'
import {dirname, join} from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment from backend/.env
dotenv.config({path: join(__dirname, '../.env')})

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tedx_db',
}

async function migrate() {
  const connection = await mysql.createConnection(dbConfig)

  try {
    console.log('🔧 Adding access_token column to orders table...\n')

    // Check if column already exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'orders' 
        AND COLUMN_NAME = 'access_token'
    `)

    if (columns.length > 0) {
      console.log('✅ access_token column already exists!\n')
      await connection.end()
      process.exit(0)
    }

    // Add column
    await connection.query(`
      ALTER TABLE orders
      ADD COLUMN access_token VARCHAR(64) NULL 
        COMMENT 'Plaintext access token for ticket URL in emails'
        AFTER access_token_hash
    `)

    console.log('✅ Added column: access_token (VARCHAR(64))\n')

    // Verify
    const [verify] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'orders' 
        AND COLUMN_NAME = 'access_token'
    `)

    console.log('📋 Verification:')
    for (const col of verify) {
      console.log(
        `   ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}) - ${col.COLUMN_COMMENT || 'No comment'}`
      )
    }

    console.log('\n✅ Migration completed successfully!')
    console.log(
      '\n⚠️  NOTE: Existing orders will have NULL access_token. New token will be generated when email is sent.'
    )
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  } finally {
    await connection.end()
  }
}

migrate()
