-- Allow NULL for updated_at column in seats table
-- This prevents invalid datetime errors (0000-00-00) on non-strict MySQL

ALTER TABLE seats MODIFY COLUMN updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(3);

-- Verify the change
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'seats' 
  AND COLUMN_NAME = 'updated_at';
