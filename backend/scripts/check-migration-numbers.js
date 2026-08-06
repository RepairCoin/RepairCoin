#!/usr/bin/env node
/**
 * Migration number guard.
 *
 * Every migration must have a UNIQUE numeric prefix. The runner identifies a migration
 * solely by that number (schema_migrations.version is a PRIMARY KEY), so two files
 * sharing a number means one is silently skipped on fresh builds — its schema change
 * never lands. That's the failure mode behind the original "DB can't be built from
 * scratch" bug.
 *
 * The repo contains a few legacy duplicates whose effects are captured in
 * 000_base_schema.sql and already applied on staging/prod. Those are grandfathered
 * below. This guard freezes that state: it allows the known duplicates but fails on
 * ANY new one.
 *
 * Usage: node scripts/check-migration-numbers.js   (npm run db:check-migrations)
 * Exit code 1 on a violation — wire into CI / pre-commit.
 */

const fs = require('fs');
const path = require('path');
// Optional: lets the database check below run from a plain `npm run db:check-migrations` locally.
// Absent in CI, which is fine — that check reports itself as skipped rather than failing.
try { require('dotenv').config(); } catch (_) { /* optional */ }

// Exact filenames of the pre-existing duplicate-numbered migrations. Do NOT add to this
// list — fix the collision instead (npm run db:create-migration picks the next free
// number automatically).
const GRANDFATHERED = new Set([
  '095_add_category_check_constraint.sql',
  '095_create_calendar_integration.sql',
  '117_add_human_reply_baseline_to_ai_shop_settings.sql',
  '117_create_inventory_v2_enhancements.sql',
  '132_add_suspension_columns.sql',
  '132_create_ai_orchestrate_messages.sql',
  '132_fix_purchase_order_number_uniqueness.sql',
]);

/**
 * Files whose number is recorded on the shared databases under a DIFFERENT name.
 *
 * Historical drift, from before the numbering rules were enforced — the same failure this guard now
 * catches, discovered after the fact. Their effects are already applied, so renumbering them today
 * would re-run SQL against databases that have it. Frozen here for the same reason as GRANDFATHERED
 * above: allow what already exists, fail on anything new.
 *
 * Do NOT add to this list. A new entry means a migration that will never run.
 */
const DB_NAME_DRIFT = new Set([
  '000_base_schema.sql',
  '053_create_appointment_reschedule_requests.sql',
  '054_add_multi_reminder_tracking.sql',
  '118_create_po_suggestions_system.sql',
]);

const migrationsDir = path.join(__dirname, '..', 'migrations');

if (!fs.existsSync(migrationsDir)) {
  console.error(`❌ migrations directory not found: ${migrationsDir}`);
  process.exit(1);
}

const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));

let hadError = false;
const byNumber = new Map();

for (const file of files) {
  const match = file.match(/^(\d+)_/);
  if (!match) {
    console.error(`❌ Migration file has no numeric prefix: ${file}`);
    hadError = true;
    continue;
  }
  const num = parseInt(match[1], 10);
  if (!byNumber.has(num)) byNumber.set(num, []);
  byNumber.get(num).push(file);
}

const offenders = [];
for (const [num, group] of byNumber) {
  if (group.length < 2) continue;
  // A shared number is only allowed if EVERY file in the group is grandfathered.
  const newDupes = group.filter((f) => !GRANDFATHERED.has(f));
  if (newDupes.length > 0) offenders.push([num, group, newDupes]);
}

if (offenders.length > 0) {
  hadError = true;
  console.error('❌ Duplicate migration number(s) detected. Each migration must have a UNIQUE number.\n');
  for (const [num, group, newDupes] of offenders.sort((a, b) => a[0] - b[0])) {
    console.error(`   [${String(num).padStart(3, '0')}]`);
    for (const f of group) {
      const tag = newDupes.includes(f) ? '  <-- offending (new)' : '  (grandfathered)';
      console.error(`     - ${f}${tag}`);
    }
  }
  console.error('\n   Fix: renumber the new file to the next free number.');
  console.error('   Tip: `npm run db:create-migration <name>` picks a free number automatically.');
}

/**
 * The check the file comparison above cannot make.
 *
 * A number can be unique among FILES and still be dead on arrival, because the runner keys on
 * schema_migrations.version. If that version is already recorded — claimed by a migration from another
 * branch that reached this database first — the runner treats it as applied and skips the SQL. Not an
 * error. Not a log line. The table simply never appears, and the failure surfaces later as a missing
 * relation at runtime.
 *
 * That happened: 268_create_shop_tasks.sql shipped first as 267, passed this check, deployed green, and
 * created nothing, because staging already had 267 = fix_subscription_status_trigger.
 *
 * Advisory, not fatal, and deliberately so. CI has no database credentials, so this must not turn every
 * CI run red — it reports what it could not check instead of pretending. Locally, where .env points at
 * staging, it is the check that would have caught the bug before the deploy.
 */
async function checkAgainstDatabase() {
  if (!process.env.DB_HOST && !process.env.DATABASE_URL) {
    console.log('ℹ️  Skipped the database check — no DB_HOST/DATABASE_URL in the environment.');
    console.log('   Files can only prove a number is unique in the REPO. Run this locally with .env');
    console.log('   loaded to also prove it is free on the target database.');
    return true;
  }

  let Client;
  try {
    ({ Client } = require('pg'));
  } catch {
    console.log('ℹ️  Skipped the database check — `pg` is not installed here.');
    return true;
  }

  const host = process.env.DB_HOST || '';
  const client = process.env.DATABASE_URL
    ? new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    : new Client({
        host,
        port: Number(process.env.DB_PORT || 25060),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: host.includes('digitalocean') || process.env.DB_SSL === 'true'
          ? { rejectUnauthorized: false }
          : undefined,
      });

  try {
    await client.connect();
    const { rows } = await client.query('SELECT version, name FROM schema_migrations');
    // `name` is stored inconsistently — some rows keep the numeric prefix ("233_add_auto_message_ab_test"),
    // others do not ("fix_subscription_status_trigger"), depending on which tool applied them. Normalise
    // both sides or every correctly-numbered migration looks like a clash.
    const norm = (s) => String(s).replace(/^\d+_/, '').replace(/\.sql$/, '');
    const appliedName = new Map(rows.map((r) => [Number(r.version), norm(r.name)]));

    const clashes = [];
    for (const [num, group] of byNumber) {
      const recorded = appliedName.get(num);
      if (!recorded) continue;
      for (const file of group) {
        if (GRANDFATHERED.has(file) || DB_NAME_DRIFT.has(file)) continue;
        // The runner records `name` as the filename minus its numeric prefix and .sql. A different name
        // under the same version means this file's SQL will never run here.
        const ownName = file.replace(/^\d+_/, '').replace(/\.sql$/, '');
        if (ownName !== recorded) clashes.push({ num, file, recorded });
      }
    }

    if (clashes.length) {
      console.error('\n❌ Number already applied to the database under a DIFFERENT migration.');
      console.error('   The runner keys on version, so this SQL would be SKIPPED — silently.\n');
      for (const c of clashes.sort((a, b) => a.num - b.num)) {
        console.error(`   [${String(c.num).padStart(3, '0')}] ${c.file}`);
        console.error(`         database already has ${c.num} = ${c.recorded}`);
      }
      console.error('\n   Fix: renumber to a number free in ALL THREE — local files, every git ref,');
      console.error('   and schema_migrations on the target database.');
      return false;
    }

    console.log(`✅ Database check OK — ${appliedName.size} applied versions, none claimed by a different file.`);
    return true;
  } catch (err) {
    // Unreachable database is not a failing build. Say so loudly rather than passing quietly.
    console.log(`ℹ️  Skipped the database check — could not connect (${err.message}).`);
    return true;
  } finally {
    await client.end().catch(() => {});
  }
}

(async () => {
  if (!hadError) {
    console.log(`✅ Migration numbers OK — ${files.length} files, no new duplicates.`);
  }
  const dbOk = await checkAgainstDatabase();
  if (hadError || !dbOk) process.exit(1);
})();
