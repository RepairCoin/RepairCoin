-- =====================================================
-- COMPREHENSIVE DATABASE SCHEMA ANALYSIS FOR REPAIRCOIN
-- =====================================================
-- This query provides a complete overview of:
-- - All tables with column details
-- - Primary keys, foreign keys, and relationships
-- - Indexes and their usage
-- - Functions, triggers, and views
-- - Database statistics and health metrics
-- =====================================================

-- 1. DATABASE OVERVIEW
SELECT 
    'DATABASE OVERVIEW' as section,
    current_database() as database_name,
    current_user as current_user,
    version() as postgresql_version,
    pg_size_pretty(pg_database_size(current_database())) as database_size;

-- 2. ALL TABLES WITH DETAILED INFORMATION
SELECT 
    'TABLES OVERVIEW' as section,
    schemaname,
    tablename,
    tableowner,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_stat_get_numscans(c.oid) as seq_scans,
    pg_stat_get_tuples_returned(c.oid) as tuples_read,
    pg_stat_get_tuples_inserted(c.oid) as tuples_inserted,
    pg_stat_get_tuples_updated(c.oid) as tuples_updated,
    pg_stat_get_tuples_deleted(c.oid) as tuples_deleted
FROM pg_tables pt
JOIN pg_class c ON c.relname = pt.tablename
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 3. DETAILED COLUMN INFORMATION FOR ALL TABLES
SELECT 
    'COLUMNS DETAIL' as section,
    t.table_name,
    c.column_name,
    c.ordinal_position,
    c.column_default,
    c.is_nullable,
    c.data_type,
    CASE 
        WHEN c.character_maximum_length IS NOT NULL 
        THEN c.data_type || '(' || c.character_maximum_length || ')'
        WHEN c.numeric_precision IS NOT NULL AND c.numeric_scale IS NOT NULL 
        THEN c.data_type || '(' || c.numeric_precision || ',' || c.numeric_scale || ')'
        ELSE c.data_type 
    END as full_data_type,
    c.column_comment
FROM information_schema.tables t
JOIN information_schema.columns c ON c.table_name = t.table_name
WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- 4. PRIMARY KEYS
SELECT 
    'PRIMARY KEYS' as section,
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 5. FOREIGN KEYS AND RELATIONSHIPS
SELECT 
    'FOREIGN KEYS' as section,
    tc.table_name as child_table,
    kcu.column_name as child_column,
    ccu.table_name as parent_table,
    ccu.column_name as parent_column,
    tc.constraint_name,
    rc.update_rule,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc 
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 6. ALL INDEXES
SELECT 
    'INDEXES' as section,
    schemaname,
    tablename,
    indexname,
    indexdef,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 7. INDEX USAGE STATISTICS
SELECT 
    'INDEX USAGE' as section,
    schemaname,
    tablename,
    indexname,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED INDEX'
        WHEN idx_scan < 100 THEN 'LOW USAGE'
        WHEN idx_scan < 1000 THEN 'MEDIUM USAGE'
        ELSE 'HIGH USAGE'
    END as usage_level
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- 8. UNIQUE CONSTRAINTS
SELECT 
    'UNIQUE CONSTRAINTS' as section,
    tc.table_name,
    tc.constraint_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 9. CHECK CONSTRAINTS
SELECT 
    'CHECK CONSTRAINTS' as section,
    tc.table_name,
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_type = 'CHECK'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 10. VIEWS
SELECT 
    'VIEWS' as section,
    table_name as view_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- 11. FUNCTIONS
SELECT 
    'FUNCTIONS' as section,
    routine_name as function_name,
    routine_type,
    data_type as return_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- 12. TRIGGERS
SELECT 
    'TRIGGERS' as section,
    trigger_name,
    event_manipulation,
    event_object_table as table_name,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 13. SEQUENCES
SELECT 
    'SEQUENCES' as section,
    sequence_name,
    data_type,
    numeric_precision,
    numeric_scale,
    start_value,
    minimum_value,
    maximum_value,
    increment,
    cycle_option
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;

-- 14. TABLE RELATIONSHIPS VISUALIZATION
WITH RECURSIVE table_hierarchy AS (
    -- Base case: tables without foreign keys (root tables)
    SELECT 
        t.table_name,
        t.table_name as root_table,
        0 as level,
        ARRAY[t.table_name] as path
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
        AND NOT EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints tc
            WHERE tc.table_name = t.table_name 
                AND tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = 'public'
        )
    
    UNION ALL
    
    -- Recursive case: tables that reference other tables
    SELECT 
        ccu.table_name,
        th.root_table,
        th.level + 1,
        th.path || ccu.table_name
    FROM table_hierarchy th
    JOIN information_schema.table_constraints tc ON tc.table_name = th.table_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND NOT (ccu.table_name = ANY(th.path)) -- Prevent cycles
)
SELECT 
    'TABLE HIERARCHY' as section,
    root_table,
    table_name,
    level,
    array_to_string(path, ' -> ') as relationship_path
FROM table_hierarchy
ORDER BY root_table, level, table_name;

-- 15. STORAGE AND PERFORMANCE STATISTICS
SELECT 
    'STORAGE STATS' as section,
    schemaname,
    tablename,
    attname as column_name,
    n_distinct,
    correlation,
    most_common_vals,
    most_common_freqs
FROM pg_stats
WHERE schemaname = 'public'
    AND n_distinct IS NOT NULL
ORDER BY tablename, attname;

-- 16. REPAIRCOIN SPECIFIC - BALANCE TRACKING ANALYSIS
SELECT 
    'BALANCE TRACKING' as section,
    'Current RCN Distribution' as metric,
    COUNT(*) as total_customers,
    COUNT(CASE WHEN current_rcn_balance > 0 THEN 1 END) as customers_with_balance,
    ROUND(SUM(current_rcn_balance), 2) as total_database_balance,
    ROUND(AVG(current_rcn_balance), 2) as avg_balance,
    ROUND(MAX(current_rcn_balance), 2) as max_balance,
    COUNT(CASE WHEN pending_mint_balance > 0 THEN 1 END) as customers_with_pending_mints,
    ROUND(SUM(pending_mint_balance), 2) as total_pending_mints
FROM customers;

-- 17. REPAIRCOIN SPECIFIC - TRANSACTION ANALYSIS
SELECT 
    'TRANSACTION STATS' as section,
    type as transaction_type,
    COUNT(*) as count,
    ROUND(SUM(amount), 2) as total_amount,
    ROUND(AVG(amount), 2) as avg_amount,
    MIN(created_at) as earliest_transaction,
    MAX(created_at) as latest_transaction
FROM transactions
GROUP BY type
ORDER BY count DESC;

-- 18. DATABASE HEALTH CHECK
SELECT 
    'HEALTH CHECK' as section,
    'Table Bloat Analysis' as check_type,
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size,
    ROUND(
        100.0 * (pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) 
        / NULLIF(pg_total_relation_size(schemaname||'.'||tablename), 0), 
        2
    ) as index_ratio_percent
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;