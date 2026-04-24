// ============================================================================
// Migration Audit Runner
// ============================================================================
// Executes backend/scripts/audit-prod-migrations.sql section-by-section and
// prints readable results. Uses DB_* env vars from backend/.env.
//
// Safety: READ-ONLY. Only SELECT queries. Safe against any environment.
//
// Usage:
//   cd backend && node scripts/run-audit.js
// ============================================================================

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const EXPECTED_VERSIONS = [
  '004','006','008','016','017','018','019','020','021','022','023','024',
  '025','026','027','028','029','030','034','035','036','037','038','039',
  '040','041','042','043','044','045','046','047','048','049','050','051',
  '052','053','054','055','056','057','058','059','060','061','062','063',
  '065','066','067','068','069','070','071','072','073','074','075','076',
  '077','078','079','080','081','082','083','084','085','086','087','088',
  '089','090','091','092','093','094','095','096','097','098','099','100',
  '101','102','103','104','105'
];

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

function banner(label) {
  const line = '='.repeat(72);
  console.log('\n' + line);
  console.log(label);
  console.log(line);
}

async function main() {
  banner(`Connecting to: ${process.env.DB_HOST} / ${process.env.DB_NAME}`);

  // -- Section 1: Inventory --
  banner('SECTION 1 — schema_migrations inventory');
  const inv = await pool.query(
    'SELECT version, name, applied_at FROM schema_migrations ORDER BY version::int'
  );
  console.log(`Total rows: ${inv.rows.length}`);
  if (inv.rows.length <= 120) {
    console.table(inv.rows.map(r => ({
      version: r.version,
      name: r.name,
      applied_at: r.applied_at ? new Date(r.applied_at).toISOString().slice(0, 19) : '-',
    })));
  } else {
    console.log('(too many to print — showing first 20 and last 20)');
    console.table(inv.rows.slice(0, 20));
    console.log('...');
    console.table(inv.rows.slice(-20));
  }

  // -- Section 2a: Missing --
  banner('SECTION 2a — Files in repo but NOT recorded in schema_migrations');
  const appliedSet = new Set(inv.rows.map(r => String(r.version).padStart(3, '0')));
  const missing = EXPECTED_VERSIONS.filter(v => !appliedSet.has(v));
  if (missing.length === 0) {
    console.log('(none — every repo migration is recorded)');
  } else {
    console.log(`${missing.length} missing:`);
    console.table(missing.map(v => ({
      missing_version: v,
      note: (parseInt(v) >= 72 && parseInt(v) <= 89)
        ? 'In fix-prod-migrations.js backfill range — may not be a real gap'
        : 'File exists but no tracking record',
    })));
  }

  // -- Section 2b: Orphans --
  banner('SECTION 2b — Tracking rows that do NOT match any repo file');
  const expectedSet = new Set(EXPECTED_VERSIONS);
  const orphans = inv.rows.filter(
    r => !expectedSet.has(String(r.version).padStart(3, '0'))
  );
  if (orphans.length === 0) {
    console.log('(none)');
  } else {
    console.log(`${orphans.length} orphans:`);
    console.table(orphans.map(r => ({
      version: r.version,
      name: r.name,
      applied_at: r.applied_at ? new Date(r.applied_at).toISOString().slice(0, 19) : '-',
    })));
  }

  // -- Section 3: Spot-checks --
  banner('SECTION 3 — Schema spot-checks (the one that matters)');
  const checksSql = `
    WITH checks AS (
      SELECT '006' AS migration, 'shops.cross_shop_enabled dropped' AS check_name,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='shops' AND column_name='cross_shop_enabled')
          THEN 'FAIL' ELSE 'PASS' END AS status,
        'Directly related to 2026-04-23 shop-register 500' AS note
      UNION ALL SELECT '006','customers.daily_earnings dropped',
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='customers' AND column_name='daily_earnings')
          THEN 'FAIL' ELSE 'PASS' END,
        'Obsolete per universal redemption'
      UNION ALL SELECT '006','customers.monthly_earnings dropped',
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='customers' AND column_name='monthly_earnings')
          THEN 'FAIL' ELSE 'PASS' END,
        'Obsolete per universal redemption'
      UNION ALL SELECT '008','shop_time_slot_config table exists',
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_name='shop_time_slot_config') THEN 'PASS' ELSE 'FAIL' END,
        'Booking scheduling — note: singular, not plural'
      UNION ALL SELECT '016','shops social media columns exist',
        CASE WHEN (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_name='shops' AND column_name IN ('facebook','twitter','instagram'))=3
          THEN 'PASS' ELSE 'FAIL' END,
        'Shop registration sends these'
      UNION ALL SELECT '017','notifications table exists',
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_name='notifications') THEN 'PASS' ELSE 'FAIL' END,
        'In-app notification bell'
      UNION ALL SELECT '018','affiliate_shop_groups table exists',
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_name='affiliate_shop_groups') THEN 'PASS' ELSE 'FAIL' END,
        'Group rewards feature'
      UNION ALL SELECT '027','shops.category column exists',
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='shops' AND column_name='category') THEN 'PASS' ELSE 'FAIL' END,
        'Shop registration sends this'
      UNION ALL SELECT '027','shops_category_check constraint exists',
        CASE WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname='shops_category_check')
          THEN 'PASS' ELSE 'WARN' END,
        'Valid category values enforced at DB level'
      UNION ALL SELECT '029','refresh_tokens table exists',
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_name='refresh_tokens') THEN 'PASS' ELSE 'FAIL' END,
        'Auth session refresh'
      UNION ALL SELECT '044','customers.first_name exists',
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='customers' AND column_name='first_name') THEN 'PASS' ELSE 'FAIL' END,
        'Customer registration sends this'
      UNION ALL SELECT '044','customers.last_name exists',
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='customers' AND column_name='last_name') THEN 'PASS' ELSE 'FAIL' END,
        'Customer registration sends this'
      UNION ALL SELECT '089','waitlist.utm_campaign dropped',
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='waitlist' AND column_name='utm_campaign')
          THEN 'FAIL' ELSE 'PASS' END,
        'Should not exist after migration 089'
      UNION ALL SELECT '095','chk_service_category constraint exists',
        CASE WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_service_category')
          THEN 'PASS' ELSE 'FAIL' END,
        'Valid service categories enforced'
      UNION ALL SELECT '100','bug_reports table exists',
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_name='bug_reports') THEN 'PASS' ELSE 'FAIL' END,
        'In-app bug reporting'
      UNION ALL SELECT '101','device_push_tokens.web_push_subscription column exists',
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='device_push_tokens' AND column_name='web_push_subscription')
          THEN 'PASS' ELSE 'FAIL' END,
        'Web push support — migration 101 added a column, not a new table'
      UNION ALL SELECT '103','messages.client_message_id exists',
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='messages' AND column_name='client_message_id')
          THEN 'PASS' ELSE 'WARN' END,
        'Messaging dedupe — non-critical'
      UNION ALL SELECT '105','email_templates table exists',
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_name='email_templates') THEN 'PASS' ELSE 'FAIL' END,
        'Transactional email rendering'
      UNION ALL SELECT 'meta','schema_migrations table exists',
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_name='schema_migrations') THEN 'PASS' ELSE 'FAIL' END,
        'Audit meaningless without this'
    )
    SELECT migration, check_name, status, note
    FROM checks
    ORDER BY CASE status WHEN 'FAIL' THEN 1 WHEN 'WARN' THEN 2 ELSE 3 END,
             migration::text, check_name
  `;
  const checks = await pool.query(checksSql);
  console.table(checks.rows);

  const failCount = checks.rows.filter(r => r.status === 'FAIL').length;
  const warnCount = checks.rows.filter(r => r.status === 'WARN').length;
  const passCount = checks.rows.filter(r => r.status === 'PASS').length;
  console.log(`\nSummary: ${passCount} PASS, ${warnCount} WARN, ${failCount} FAIL`);

  // -- Section 4: Top-level counts --
  banner('SECTION 4 — Top-level summary');
  console.table([{
    expected_migrations_in_repo: EXPECTED_VERSIONS.length,
    applied_per_tracking_table: inv.rows.length,
    missing_count: missing.length,
    orphan_count: orphans.length,
    schema_fail_count: failCount,
    schema_warn_count: warnCount,
    schema_pass_count: passCount,
  }]);

  await pool.end();
}

main().catch(e => {
  console.error('\nAudit failed:', e.message);
  process.exit(1);
});
