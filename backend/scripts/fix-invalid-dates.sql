-- Fix Invalid Datetime Values in Database
-- Run this on production database to fix zero dates

-- Fix orders table
UPDATE orders 
SET updated_at = COALESCE(created_at, NOW())
WHERE updated_at = '0000-00-00 00:00:00' 
   OR updated_at IS NULL 
   OR updated_at < '1000-01-01'
   OR YEAR(updated_at) = 0;

-- Fix seats table
UPDATE seats 
SET updated_at = COALESCE(created_at, NOW())
WHERE updated_at = '0000-00-00 00:00:00' 
   OR updated_at IS NULL 
   OR updated_at < '1000-01-01'
   OR YEAR(updated_at) = 0;

-- Fix events table
UPDATE events 
SET updated_at = COALESCE(created_at, NOW())
WHERE updated_at = '0000-00-00 00:00:00' 
   OR updated_at IS NULL 
   OR updated_at < '1000-01-01'
   OR YEAR(updated_at) = 0;

-- Fix users table
UPDATE users 
SET updated_at = COALESCE(created_at, NOW())
WHERE updated_at = '0000-00-00 00:00:00' 
   OR updated_at IS NULL 
   OR updated_at < '1000-01-01'
   OR YEAR(updated_at) = 0;

-- Fix speakers table (if exists)
UPDATE speakers 
SET updated_at = COALESCE(created_at, NOW())
WHERE updated_at = '0000-00-00 00:00:00' 
   OR updated_at IS NULL 
   OR updated_at < '1000-01-01'
   OR YEAR(updated_at) = 0;

-- Fix timelines table (if exists)
UPDATE timelines 
SET updated_at = COALESCE(created_at, NOW())
WHERE updated_at = '0000-00-00 00:00:00' 
   OR updated_at IS NULL 
   OR updated_at < '1000-01-01'
   OR YEAR(updated_at) = 0;

-- Verify fixes
SELECT 'Orders with invalid dates:' as check_name, COUNT(*) as count 
FROM orders 
WHERE updated_at = '0000-00-00 00:00:00' OR updated_at IS NULL OR YEAR(updated_at) = 0
UNION ALL
SELECT 'Seats with invalid dates:', COUNT(*) 
FROM seats 
WHERE updated_at = '0000-00-00 00:00:00' OR updated_at IS NULL OR YEAR(updated_at) = 0
UNION ALL
SELECT 'Events with invalid dates:', COUNT(*) 
FROM events 
WHERE updated_at = '0000-00-00 00:00:00' OR updated_at IS NULL OR YEAR(updated_at) = 0;
