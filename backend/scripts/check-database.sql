-- Check Database Tables Script
-- Run this in TablePlus to verify all tables exist and are properly set up

-- 1. Check which tables exist
SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            'customers', 'shops', 'transactions', 'webhook_logs', 
            'shop_rcn_purchases', 'referrals', 'customer_rcn_sources',
            'redemption_sessions', 'token_sources', 'cross_shop_verifications',
            'tier_bonuses', 'admin_logs', 'admin_treasury', 'unsuspend_requests',
            'wallet_registrations'
        ) THEN '✅ Required'
        ELSE '⚠️  Extra'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY 
    CASE 
        WHEN table_name IN (
            'customers', 'shops', 'transactions', 'webhook_logs', 
            'shop_rcn_purchases', 'referrals', 'customer_rcn_sources',
            'redemption_sessions', 'token_sources', 'cross_shop_verifications',
            'tier_bonuses', 'admin_logs', 'admin_treasury', 'unsuspend_requests',
            'wallet_registrations'
        ) THEN 0
        ELSE 1
    END,
    table_name;

-- 2. Check for missing required tables
SELECT 
    'Missing Table: ' || table_name as issue
FROM (
    VALUES 
        ('customers'),
        ('shops'),
        ('transactions'),
        ('webhook_logs'),
        ('shop_rcn_purchases'),
        ('referrals'),
        ('customer_rcn_sources'),
        ('redemption_sessions'),
        ('token_sources'),
        ('cross_shop_verifications'),
        ('tier_bonuses'),
        ('admin_logs'),
        ('admin_treasury'),
        ('unsuspend_requests'),
        ('wallet_registrations')
) AS required_tables(table_name)
WHERE NOT EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = required_tables.table_name
);

-- 3. Check if customers table has all required columns
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'customers'
ORDER BY ordinal_position;

-- 4. Check if customer_rcn_sources table exists and has data
SELECT 
    'customer_rcn_sources' as table_name,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'customer_rcn_sources'
    ) as table_exists,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'customer_rcn_sources'
        ) THEN (SELECT COUNT(*) FROM customer_rcn_sources)
        ELSE 0
    END as row_count;

-- 5. Check if referrals table exists and structure
SELECT 
    'referrals' as table_name,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'referrals'
    ) as table_exists,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'referrals'
        ) THEN (SELECT COUNT(*) FROM referrals)
        ELSE 0
    END as row_count;

-- 6. Check for any errors in the earning balance query
-- This simulates what the API is trying to do
SELECT 
    'Test Query Result' as test,
    COALESCE(SUM(amount), 0) as total_earned
FROM transactions 
WHERE customer_address = '0x0b96c2f730bfeceb501c4ae95c0256faa303981d'
AND status = 'confirmed'
AND type IN ('mint', 'tier_bonus');

-- 7. Summary of database health
SELECT 
    'Database Health Check' as check_type,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as total_tables,
    (SELECT COUNT(*) FROM customers) as total_customers,
    (SELECT COUNT(*) FROM shops) as total_shops,
    (SELECT COUNT(*) FROM transactions) as total_transactions,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_rcn_sources')
        THEN 'EXISTS'
        ELSE 'MISSING - This is causing the referral tab error!'
    END as customer_rcn_sources_status;