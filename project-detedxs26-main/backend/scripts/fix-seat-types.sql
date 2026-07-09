-- Fix seat types for TEDx event
-- Set rows A-B as VIP, rows C-H as STANDARD

-- Update rows A and B to VIP with VIP pricing
UPDATE seats 
SET seat_type = 'VIP', 
    price = 2500000
WHERE event_id = 'evt-tedx-2026' 
  AND row IN ('A', 'B');

-- Update rows C-H to STANDARD with standard pricing
UPDATE seats 
SET seat_type = 'STANDARD', 
    price = 1500000
WHERE event_id = 'evt-tedx-2026' 
  AND row IN ('C', 'D', 'E', 'F', 'G', 'H');

-- Verify the changes
SELECT 
  row,
  seat_type,
  COUNT(*) as seat_count,
  MIN(price) as min_price,
  MAX(price) as max_price
FROM seats 
WHERE event_id = 'evt-tedx-2026'
GROUP BY row, seat_type
ORDER BY row;
