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

if (hadError) process.exit(1);

console.log(`✅ Migration numbers OK — ${files.length} files, no new duplicates.`);
