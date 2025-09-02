-- Migration to fix case-sensitive referral code lookups
-- This creates an index to improve performance of case-insensitive searches

-- Create a case-insensitive index on referral_code
CREATE INDEX IF NOT EXISTS idx_customers_referral_code_upper 
ON customers (UPPER(referral_code));

-- Optional: Create a function to look up customers by referral code (case-insensitive)
CREATE OR REPLACE FUNCTION get_customer_by_referral_code(code TEXT)
RETURNS TABLE (
    address VARCHAR,
    name VARCHAR,
    email VARCHAR,
    referral_code VARCHAR,
    referral_count INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT c.address, c.name, c.email, c.referral_code, c.referral_count
    FROM customers c
    WHERE UPPER(c.referral_code) = UPPER(code);
END;
$$ LANGUAGE plpgsql;

-- Test the function
-- SELECT * FROM get_customer_by_referral_code('tolvwa7v');