-- Migration: Add unique constraints for email and wallet addresses
-- Date: 2025-10-15
-- Description: Ensure one email address and wallet address can only be used for one account across all account types

-- First, clean up any existing duplicate data (if any)
-- Remove duplicate customers by keeping the one with the earliest created_at
WITH customer_duplicates AS (
    SELECT address, 
           ROW_NUMBER() OVER (PARTITION BY LOWER(email) ORDER BY created_at) as rn
    FROM customers 
    WHERE email IS NOT NULL AND email != ''
)
DELETE FROM customers 
WHERE address IN (
    SELECT address FROM customer_duplicates WHERE rn > 1
);

WITH customer_wallet_duplicates AS (
    SELECT address, 
           ROW_NUMBER() OVER (PARTITION BY wallet_address ORDER BY created_at) as rn
    FROM customers
)
DELETE FROM customers 
WHERE address IN (
    SELECT address FROM customer_wallet_duplicates WHERE rn > 1
);

-- Remove duplicate shops by keeping the one with the earliest created_at
WITH shop_duplicates AS (
    SELECT shop_id, 
           ROW_NUMBER() OVER (PARTITION BY LOWER(email) ORDER BY created_at) as rn
    FROM shops 
    WHERE email IS NOT NULL AND email != ''
)
DELETE FROM shops 
WHERE shop_id IN (
    SELECT shop_id FROM shop_duplicates WHERE rn > 1
);

WITH shop_wallet_duplicates AS (
    SELECT shop_id, 
           ROW_NUMBER() OVER (PARTITION BY wallet_address ORDER BY created_at) as rn
    FROM shops
)
DELETE FROM shops 
WHERE shop_id IN (
    SELECT shop_id FROM shop_wallet_duplicates WHERE rn > 1
);

-- Remove any cross-account conflicts (if email exists in both tables, keep customer)
DELETE FROM shops 
WHERE LOWER(email) IN (
    SELECT LOWER(email) 
    FROM customers 
    WHERE email IS NOT NULL AND email != ''
);

-- Remove any cross-account wallet conflicts (if wallet exists in both tables, keep customer)
DELETE FROM shops 
WHERE wallet_address IN (
    SELECT wallet_address 
    FROM customers
);

-- Add unique constraints
-- For customers table
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_customers_email 
ON customers (LOWER(email)) 
WHERE email IS NOT NULL AND email != '';

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_customers_wallet 
ON customers (wallet_address);

-- For shops table
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_shops_email 
ON shops (LOWER(email)) 
WHERE email IS NOT NULL AND email != '';

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_shops_wallet 
ON shops (wallet_address);

-- Create a function to check cross-table email uniqueness
CREATE OR REPLACE FUNCTION check_email_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if email exists in customers table (for shop inserts/updates)
    IF TG_TABLE_NAME = 'shops' AND NEW.email IS NOT NULL AND NEW.email != '' THEN
        IF EXISTS (SELECT 1 FROM customers WHERE LOWER(email) = LOWER(NEW.email)) THEN
            RAISE EXCEPTION 'Email address already exists in customers table: %', NEW.email
                USING ERRCODE = '23505';
        END IF;
    END IF;
    
    -- Check if email exists in shops table (for customer inserts/updates)
    IF TG_TABLE_NAME = 'customers' AND NEW.email IS NOT NULL AND NEW.email != '' THEN
        IF EXISTS (SELECT 1 FROM shops WHERE LOWER(email) = LOWER(NEW.email)) THEN
            RAISE EXCEPTION 'Email address already exists in shops table: %', NEW.email
                USING ERRCODE = '23505';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a function to check cross-table wallet uniqueness
CREATE OR REPLACE FUNCTION check_wallet_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if wallet exists in customers table (for shop inserts/updates)
    IF TG_TABLE_NAME = 'shops' THEN
        IF EXISTS (SELECT 1 FROM customers WHERE wallet_address = NEW.wallet_address) THEN
            RAISE EXCEPTION 'Wallet address already exists in customers table: %', NEW.wallet_address
                USING ERRCODE = '23505';
        END IF;
    END IF;
    
    -- Check if wallet exists in shops table (for customer inserts/updates)
    IF TG_TABLE_NAME = 'customers' THEN
        IF EXISTS (SELECT 1 FROM shops WHERE wallet_address = NEW.wallet_address) THEN
            RAISE EXCEPTION 'Wallet address already exists in shops table: %', NEW.wallet_address
                USING ERRCODE = '23505';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for email uniqueness
CREATE TRIGGER trigger_customers_email_uniqueness
    BEFORE INSERT OR UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION check_email_uniqueness();

CREATE TRIGGER trigger_shops_email_uniqueness
    BEFORE INSERT OR UPDATE ON shops
    FOR EACH ROW
    EXECUTE FUNCTION check_email_uniqueness();

-- Create triggers for wallet uniqueness
CREATE TRIGGER trigger_customers_wallet_uniqueness
    BEFORE INSERT OR UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION check_wallet_uniqueness();

CREATE TRIGGER trigger_shops_wallet_uniqueness
    BEFORE INSERT OR UPDATE ON shops
    FOR EACH ROW
    EXECUTE FUNCTION check_wallet_uniqueness();

-- Update the init.sql sample data to avoid conflicts
-- (Remove the sample data insertion since it may conflict)
DELETE FROM customers WHERE address IN (
    '0x1234567890123456789012345678901234567890',
    '0x2345678901234567890123456789012345678901',
    '0x3456789012345678901234567890123456789012'
);

DELETE FROM shops WHERE shop_id IN ('shop001', 'shop002', 'shop003');