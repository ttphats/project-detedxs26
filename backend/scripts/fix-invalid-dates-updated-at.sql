-- Fix invalid updated_at dates in seats table
UPDATE seats
SET updated_at = created_at
WHERE updated_at = '0000-00-00 00:00:00' OR updated_at IS NULL OR YEAR(updated_at) = 0;

-- Update any still invalid
UPDATE seats
SET updated_at = NOW()
WHERE updated_at = '0000-00-00 00:00:00' OR YEAR(updated_at) = 0;
