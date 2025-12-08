-- Migration: Add first_name and last_name columns to customers table
-- This migration splits the existing 'name' field into separate first and last name columns
-- for better data organization and querying capabilities

-- Add first_name column if it doesn't exist
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);

-- Add last_name column if it doesn't exist
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_first_name
    ON customers(first_name);

CREATE INDEX IF NOT EXISTS idx_customers_last_name
    ON customers(last_name);

-- Add comments for documentation
COMMENT ON COLUMN customers.first_name IS 'Customer first name';
COMMENT ON COLUMN customers.last_name IS 'Customer last name';

-- Populate first_name and last_name from the name column
-- Only update rows where first_name and last_name are NULL (idempotent)
UPDATE customers
SET
    first_name = CASE
        WHEN name IS NULL OR TRIM(name) = '' THEN NULL
        WHEN POSITION(' ' IN TRIM(name)) = 0 THEN TRIM(name)
        ELSE TRIM(SUBSTRING(TRIM(name) FROM 1 FOR LENGTH(TRIM(name)) - LENGTH(SPLIT_PART(TRIM(name), ' ', ARRAY_LENGTH(STRING_TO_ARRAY(TRIM(name), ' '), 1))) - 1))
    END,
    last_name = CASE
        WHEN name IS NULL OR TRIM(name) = '' THEN NULL
        WHEN POSITION(' ' IN TRIM(name)) = 0 THEN NULL
        ELSE SPLIT_PART(TRIM(name), ' ', ARRAY_LENGTH(STRING_TO_ARRAY(TRIM(name), ' '), 1))
    END
WHERE first_name IS NULL AND last_name IS NULL;

-- Record migration
INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('044', 'add_name_columns_to_customers', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;
