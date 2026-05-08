-- Fix Invalid Datetime Values in Database
-- Run this on production database to fix zero dates
-- WARNING: Manually check if table has updated_at column before running!

-- Fix orders table
-- Run this ONLY if orders table has updated_at column
UPDATE orders
SET updated_at = COALESCE(created_at, NOW())
WHERE updated_at = '0000-00-00 00:00:00'
   OR updated_at IS NULL
   OR updated_at < '1000-01-01'
   OR YEAR(updated_at) = 0;

-- Fix seats table
-- Run this ONLY if seats table has updated_at column
UPDATE seats
SET updated_at = COALESCE(created_at, NOW())
WHERE updated_at = '0000-00-00 00:00:00'
   OR updated_at IS NULL
   OR updated_at < '1000-01-01'
   OR YEAR(updated_at) = 0;

-- Fix events table
-- Run this ONLY if events table has updated_at column
UPDATE events
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
