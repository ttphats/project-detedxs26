-- Add check-in columns to orders table

ALTER TABLE orders
ADD COLUMN checked_in_at DATETIME NULL COMMENT 'Check-in timestamp',
ADD COLUMN checked_in_by VARCHAR(36) NULL COMMENT 'Admin user ID who performed check-in',
ADD INDEX idx_checked_in_at (checked_in_at);

-- Add foreign key to users table (optional, if you want to track who did the check-in)
-- ALTER TABLE orders
-- ADD CONSTRAINT fk_orders_checked_in_by FOREIGN KEY (checked_in_by) REFERENCES users(id) ON DELETE SET NULL;
