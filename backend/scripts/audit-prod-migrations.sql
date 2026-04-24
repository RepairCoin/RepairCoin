-- ============================================================================
-- Migration Audit Script for Production Database
-- ============================================================================
-- Purpose: Verify that the schema migrations recorded in `schema_migrations`
--          actually match the real schema state on disk. The tracking table
--          can lie — backend/scripts/fix-prod-migrations.js has historically
--          inserted "applied" rows without running the migration (see its
--          lines 14-19, the 072-087 backfill). This script checks three
--          layers to catch any drift:
--
--   Section 1 — What the tracking table CLAIMS is applied.
--   Section 2 — Gap analysis: what's in the repo vs what's recorded applied
--               (missing = unapplied, orphan = applied but no file).
--   Section 3 — Actual schema spot-checks: verifies critical columns,
--               constraints, and tables exist (or don't) as expected.
--   Section 4 — Summary counts for a quick top-level view.
--
-- Safety: READ-ONLY. No INSERT, UPDATE, DELETE, ALTER, DROP, or CREATE.
--         Every statement is a SELECT. Safe to run against production.
--
-- How to run:
--   psql "$DATABASE_URL" -f backend/scripts/audit-prod-migrations.sql
--   (or paste section-by-section into any SQL client — DBeaver, pgAdmin,
--    Supabase SQL editor, DigitalOcean Database console, etc.)
--
-- Expected file list reflects the migrations present in backend/migrations/
-- as of 2026-04-24. Re-generate the expected array if new migrations land:
--   ls backend/migrations/ | grep -E "^[0-9]{3}" | sed 's/_.*//' | sort -u
-- ============================================================================


-- ============================================================================
-- SECTION 1 — APPLIED MIGRATIONS INVENTORY
-- What the schema_migrations tracking table currently claims.
-- ============================================================================

SELECT '=== SECTION 1: Applied migrations (per schema_migrations table) ===' AS section;

SELECT
  version,
  name,
  applied_at
FROM schema_migrations
ORDER BY version::int;

SELECT
  COUNT(*) AS total_rows_in_schema_migrations,
  MIN(version::int) AS lowest_version_recorded,
  MAX(version::int) AS highest_version_recorded
FROM schema_migrations;


-- ============================================================================
-- SECTION 2 — GAP ANALYSIS
-- Compare the repo file list to what the tracking table reports.
-- ============================================================================

SELECT '=== SECTION 2a: Migrations in repo but NOT recorded as applied ===' AS section;

WITH expected(version) AS (VALUES
  ('004'),('006'),('008'),('016'),('017'),('018'),('019'),('020'),
  ('021'),('022'),('023'),('024'),('025'),('026'),('027'),('028'),
  ('029'),('030'),('034'),('035'),('036'),('037'),('038'),('039'),
  ('040'),('041'),('042'),('043'),('044'),('045'),('046'),('047'),
  ('048'),('049'),('050'),('051'),('052'),('053'),('054'),('055'),
  ('056'),('057'),('058'),('059'),('060'),('061'),('062'),('063'),
  ('065'),('066'),('067'),('068'),('069'),('070'),('071'),('072'),
  ('073'),('074'),('075'),('076'),('077'),('078'),('079'),('080'),
  ('081'),('082'),('083'),('084'),('085'),('086'),('087'),('088'),
  ('089'),('090'),('091'),('092'),('093'),('094'),('095'),('096'),
  ('097'),('098'),('099'),('100'),('101'),('102'),('103'),('104'),('105')
)
SELECT
  e.version AS missing_version,
  CASE
    WHEN e.version::int BETWEEN 72 AND 89
      THEN 'Previously backfilled by fix-prod-migrations.js; may not be a real gap'
    ELSE 'File exists in backend/migrations/ but schema_migrations has no record'
  END AS note
FROM expected e
LEFT JOIN schema_migrations a
  ON LPAD(a.version, 3, '0') = e.version
WHERE a.version IS NULL
ORDER BY e.version::int;


SELECT '=== SECTION 2b: Orphans in schema_migrations (recorded but no file) ===' AS section;

WITH expected(version) AS (VALUES
  ('004'),('006'),('008'),('016'),('017'),('018'),('019'),('020'),
  ('021'),('022'),('023'),('024'),('025'),('026'),('027'),('028'),
  ('029'),('030'),('034'),('035'),('036'),('037'),('038'),('039'),
  ('040'),('041'),('042'),('043'),('044'),('045'),('046'),('047'),
  ('048'),('049'),('050'),('051'),('052'),('053'),('054'),('055'),
  ('056'),('057'),('058'),('059'),('060'),('061'),('062'),('063'),
  ('065'),('066'),('067'),('068'),('069'),('070'),('071'),('072'),
  ('073'),('074'),('075'),('076'),('077'),('078'),('079'),('080'),
  ('081'),('082'),('083'),('084'),('085'),('086'),('087'),('088'),
  ('089'),('090'),('091'),('092'),('093'),('094'),('095'),('096'),
  ('097'),('098'),('099'),('100'),('101'),('102'),('103'),('104'),('105')
)
SELECT
  a.version,
  a.name,
  a.applied_at,
  'No matching file in backend/migrations/ for this version' AS note
FROM schema_migrations a
LEFT JOIN expected e
  ON e.version = LPAD(a.version, 3, '0')
WHERE e.version IS NULL
ORDER BY a.version::int;


-- ============================================================================
-- SECTION 3 — ACTUAL SCHEMA SPOT-CHECKS
-- The critical layer. Verifies the real schema state regardless of what
-- the tracking table claims. Each check outputs PASS / FAIL / WARN with
-- a hint about which migration it verifies.
-- ============================================================================

SELECT '=== SECTION 3: Actual schema state vs expected ===' AS section;

WITH checks AS (

  -- Migration 006: columns that should be DROPPED from shops
  SELECT
    '006' AS migration,
    'shops.cross_shop_enabled dropped' AS check_name,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='shops' AND column_name='cross_shop_enabled'
    ) THEN 'FAIL' ELSE 'PASS' END AS status,
    'Directly related to 2026-04-23 shop-register 500 bug' AS note

  UNION ALL SELECT '006', 'customers.daily_earnings dropped',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='customers' AND column_name='daily_earnings'
    ) THEN 'FAIL' ELSE 'PASS' END,
    'Obsolete per universal redemption'

  UNION ALL SELECT '006', 'customers.monthly_earnings dropped',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='customers' AND column_name='monthly_earnings'
    ) THEN 'FAIL' ELSE 'PASS' END,
    'Obsolete per universal redemption'

  -- Migration 008: appointment scheduling tables
  UNION ALL SELECT '008', 'appointment_scheduling tables exist',
    CASE WHEN (
      SELECT COUNT(*) FROM information_schema.tables
      WHERE table_name IN ('shop_time_slot_configs','shop_date_overrides')
    ) = 2 THEN 'PASS' ELSE 'FAIL' END,
    'Booking feature depends on this'

  -- Migration 016: social media columns on shops
  UNION ALL SELECT '016', 'shops social media columns exist',
    CASE WHEN (
      SELECT COUNT(*) FROM information_schema.columns
      WHERE table_name='shops' AND column_name IN ('facebook','twitter','instagram')
    ) = 3 THEN 'PASS' ELSE 'FAIL' END,
    'Shop registration sends these — FAIL blocks shop signup'

  -- Migration 017: notifications table
  UNION ALL SELECT '017', 'notifications table exists',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name='notifications'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'In-app notification bell requires this'

  -- Migration 018: affiliate_shop_groups
  UNION ALL SELECT '018', 'affiliate_shop_groups table exists',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name='affiliate_shop_groups'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'Group rewards feature'

  -- Migration 027: shops.category with CHECK constraint
  UNION ALL SELECT '027', 'shops.category column exists',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='shops' AND column_name='category'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'Shop registration sends category — FAIL blocks shop signup'

  UNION ALL SELECT '027', 'shops_category_check constraint exists',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname='shops_category_check'
    ) THEN 'PASS' ELSE 'WARN' END,
    'Valid category values enforced at DB level'

  -- Migration 029: refresh_tokens table (auth)
  UNION ALL SELECT '029', 'refresh_tokens table exists',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name='refresh_tokens'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'Session refresh — FAIL blocks login persistence'

  -- Migration 044: first_name / last_name on customers
  UNION ALL SELECT '044', 'customers.first_name exists',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='customers' AND column_name='first_name'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'Customer registration sends first_name'

  UNION ALL SELECT '044', 'customers.last_name exists',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='customers' AND column_name='last_name'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'Customer registration sends last_name'

  -- Migration 088: waitlist campaign tracking
  UNION ALL SELECT '088', 'waitlist.utm_source column exists',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='waitlist' AND column_name='utm_source'
    ) THEN 'WARN' ELSE 'PASS' END,
    'Added by 088 then dropped by 089 — should NOT exist after both applied'

  -- Migration 089: drop waitlist utm columns
  UNION ALL SELECT '089', 'waitlist.utm_campaign dropped',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='waitlist' AND column_name='utm_campaign'
    ) THEN 'FAIL' ELSE 'PASS' END,
    'Should not exist — utm_medium/campaign moved to campaigns table'

  -- Migration 095: service category CHECK constraint
  UNION ALL SELECT '095', 'chk_service_category constraint exists',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname='chk_service_category'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'Valid service categories enforced at DB level'

  -- Migration 099: service_group availability unique constraint
  UNION ALL SELECT '099', 'service_shop_groups unique constraint exists',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename='service_shop_groups' AND indexname LIKE '%service_id%group_id%'
    ) THEN 'PASS' ELSE 'WARN' END,
    'Prevents duplicate service-group links'

  -- Migration 100: bug_reports table
  UNION ALL SELECT '100', 'bug_reports table exists',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name='bug_reports'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'In-app bug reporting feature'

  -- Migration 101: web push support
  UNION ALL SELECT '101', 'push_subscriptions table exists',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name='push_subscriptions'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'Web push notifications'

  -- Migration 103: client_message_id column
  UNION ALL SELECT '103', 'messages.client_message_id exists',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='messages' AND column_name='client_message_id'
    ) THEN 'PASS' ELSE 'WARN' END,
    'Messaging dedupe — non-critical'

  -- Migration 105: email_templates table
  UNION ALL SELECT '105', 'email_templates table exists',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name='email_templates'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'Transactional email rendering'

  -- Meta: schema_migrations table itself exists
  UNION ALL SELECT 'meta', 'schema_migrations table exists',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name='schema_migrations'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'Audit is meaningless without this'
)
SELECT
  migration,
  check_name,
  status,
  note
FROM checks
ORDER BY
  CASE status WHEN 'FAIL' THEN 1 WHEN 'WARN' THEN 2 ELSE 3 END,
  migration::text,
  check_name;


-- ============================================================================
-- SECTION 4 — SUMMARY
-- Top-level counts so the audit result is scannable in 5 seconds.
-- ============================================================================

SELECT '=== SECTION 4: Top-level summary ===' AS section;

WITH expected(version) AS (VALUES
  ('004'),('006'),('008'),('016'),('017'),('018'),('019'),('020'),
  ('021'),('022'),('023'),('024'),('025'),('026'),('027'),('028'),
  ('029'),('030'),('034'),('035'),('036'),('037'),('038'),('039'),
  ('040'),('041'),('042'),('043'),('044'),('045'),('046'),('047'),
  ('048'),('049'),('050'),('051'),('052'),('053'),('054'),('055'),
  ('056'),('057'),('058'),('059'),('060'),('061'),('062'),('063'),
  ('065'),('066'),('067'),('068'),('069'),('070'),('071'),('072'),
  ('073'),('074'),('075'),('076'),('077'),('078'),('079'),('080'),
  ('081'),('082'),('083'),('084'),('085'),('086'),('087'),('088'),
  ('089'),('090'),('091'),('092'),('093'),('094'),('095'),('096'),
  ('097'),('098'),('099'),('100'),('101'),('102'),('103'),('104'),('105')
)
SELECT
  (SELECT COUNT(*) FROM expected) AS expected_migrations_in_repo,
  (SELECT COUNT(*) FROM schema_migrations) AS applied_according_to_tracking_table,
  (SELECT COUNT(*) FROM expected e
    LEFT JOIN schema_migrations a ON LPAD(a.version, 3, '0') = e.version
    WHERE a.version IS NULL) AS missing_count,
  (SELECT COUNT(*) FROM schema_migrations a
    LEFT JOIN expected e ON e.version = LPAD(a.version, 3, '0')
    WHERE e.version IS NULL) AS orphan_count;


-- ============================================================================
-- How to read the output
-- ============================================================================
-- Section 1: Scroll through to eyeball the applied list. Anything unexpected?
-- Section 2a (missing): Every row here = a migration in the repo that prod
--   has NOT recorded. Run `backend/scripts/run-single-migration.ts <version>`
--   after confirming it's safe (see the individual migration file).
-- Section 2b (orphans): Rare. Usually means a migration was renamed or the
--   tracking row was inserted manually (e.g., by fix-prod-migrations.js).
--   Investigate each one — there's no harm in leaving them if the schema is
--   otherwise correct, but they make future audits confusing.
-- Section 3 (spot-checks): THE ONE THAT MATTERS. Any row with status='FAIL'
--   indicates the tracking table claims a migration applied but the actual
--   schema doesn't match. Examples:
--     * M006 FAIL on cross_shop_enabled dropped → explains the current
--       shop-registration bug; the code expects the column to exist.
--     * M027 FAIL on shops.category → shop registration will reject with
--       missing-column error if the route sends category.
--   'WARN' = either-way-is-valid, but note the expected outcome.
-- Section 4: One-line sanity. If missing_count > 0 or orphan_count > 0,
--   Sections 2a/2b explain which ones.
-- ============================================================================
