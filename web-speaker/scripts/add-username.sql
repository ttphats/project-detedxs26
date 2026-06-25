-- Migration: Add username column to users table
-- Run this SQL on the database server

-- 1. Add username column
ALTER TABLE users 
ADD COLUMN username VARCHAR(50) NULL AFTER email;

-- 2. Add unique index on username
ALTER TABLE users 
ADD UNIQUE INDEX idx_username (username);

-- 3. Generate username for existing users from email
UPDATE users 
SET username = SUBSTRING_INDEX(email, '@', 1)
WHERE username IS NULL AND email IS NOT NULL;

-- 4. Verify
SELECT id, username, email, full_name FROM users;

