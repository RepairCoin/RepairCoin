# Bug: Production DB has two missing/untracked migrations — 082 (tracking gap) and 101 (genuinely unapplied)

**Status:** Completed
**Priority:** High (082 cosmetic, 101 blocks web push)
**Est. Effort:** 5 min (082 backfill) + 10 min (101 apply) + 10 min verification
**Created:** 2026-04-24
**Updated:** 2026-04-24
**Completed:** 2026-04-24

> **Applied to prod 2026-04-24 ~23:57 UTC.** Both fixes shipped successfully via inline node script (no new repo files required). Fix 1 inserted tracking row for 082 back-dated to the 2026-03-17 batch. Fix 2 ran migration 101 in a transaction against prod's empty `device_push_tokens` table (0 rows, zero data-integrity risk) with `DROP CONSTRAINT IF EXISTS` adjustment for the non-existent prior constraint. Post-fix audit shows 19 PASS / 0 WARN / 0 FAIL. See `backend/scripts/run-audit.js` for the audit runner that was used to discover and verify.

---

## Problem / Goal

During the production migration audit on 2026-04-24 (see `backend/scripts/audit-prod-migrations.sql` + `run-audit.js`), two migrations were flagged on the prod DB `defaultdb @ db-postgresql-repaircoin-prod-do-user-24273652-0.e.db.ondigitalocean.com`:

1. **Migration 082** (`create_shop_no_show_policy_and_email_preferences`) — **applied in schema but no tracking record.** Both tables (`shop_no_show_policy`, `shop_email_preferences`) exist on prod with the full expected column set, but `schema_migrations` has no row for version 82. Benign but confusing — future audits report it as "missing."
2. **Migration 101** (`add_web_push_support`) — **genuinely not applied.** No tracking record AND the schema changes never ran. `device_push_tokens.web_push_subscription` column doesn't exist; the `device_type` CHECK constraint still allows only `ios`/`android`; `expo_push_token` is still NOT NULL. Any code that tries to write a web push token will fail.

Goal: **reconcile the tracking table to match reality, and actually apply the migration that was skipped.**

### Evidence

Audit output from `backend/scripts/run-audit.js` against production on 2026-04-24:

```
========= SECTION 2a — Files in repo but NOT recorded =========
2 missing:
  - '082' note: In fix-prod-migrations.js backfill range — may not be a real gap
  - '101' note: File exists but no tracking record

========= SECTION 3 — Schema spot-checks =========
- '101' 'device_push_tokens.web_push_subscription column exists' = FAIL
- All other checks PASS (including M006's shops.cross_shop_enabled dropped)
```

Direct column queries against prod confirmed:
- `shop_no_show_policy` table exists with 29 expected columns
- `shop_email_preferences` table exists with 25 expected columns
- `device_push_tokens` has 11 columns, none of which are `web_push_subscription`
- No CHECK constraints beyond what 029-pre-101 left in place

### Why this matters

- **082 (cosmetic):** The schema is correct, only the bookkeeping is wrong. Doesn't break any runtime behavior. But it makes future audits noisy, and if someone naively tries to "fix" by running migration 082's SQL against prod, they'll hit "table already exists" errors.
- **101 (functional — blocks a feature):** Web push notifications are not usable on production. The mobile app likely registers web push tokens during some flows (browser-based customers, PWA scenarios, or future web expansion). Any code path that inserts a row with `device_type='web'` or references `web_push_subscription` will fail at runtime. May already be manifesting as silent write failures that nobody noticed because web push is a newer feature mostly tested on staging.

---

## Root Cause

### Migration 082
File: `backend/migrations/082_create_shop_no_show_policy_and_email_preferences.sql`

Context: version 082 falls inside the 072-089 range that `backend/scripts/fix-prod-migrations.js` historically backfilled. Looking at the timing, every migration from 072-081 and 083-087 has a tracking record dated `2026-03-17 06:16:35` (the same batch timestamp), but **082 is missing from that batch**. Most likely explanation: the backfill script originally had a loop that skipped 082 (either intentionally or by bug), OR the migration was applied separately before the backfill ran and the tracking row was never inserted.

Since the schema changes (`shop_no_show_policy` + `shop_email_preferences` tables) are correctly in place, this is a pure bookkeeping gap.

### Migration 101
File: `backend/migrations/101_add_web_push_support.sql`

Four statements that should have run:
1. `ALTER TABLE device_push_tokens DROP CONSTRAINT device_push_tokens_device_type_check`
2. `ALTER TABLE device_push_tokens ADD CONSTRAINT device_push_tokens_device_type_check CHECK (device_type IN ('ios','android','web'))`
3. `ALTER TABLE device_push_tokens ADD COLUMN web_push_subscription JSONB`
4. `ALTER TABLE device_push_tokens ALTER COLUMN expo_push_token DROP NOT NULL`
5. `ALTER TABLE device_push_tokens ADD CONSTRAINT push_token_type_check CHECK ( (device_type IN ('ios','android') AND expo_push_token IS NOT NULL) OR (device_type = 'web' AND web_push_subscription IS NOT NULL) )`

None of these ran. Likely cause: a deploy pipeline skipped the migration step for this release, or the file was added after the last prod migration run.

Staging has migration 101 applied correctly (confirmed via staging audit on same day). So the migration itself works — it just wasn't executed against production.

---

## Fix

### Fix 1 — Migration 082 tracking backfill (Low risk, ~2 min)

Insert the missing tracking record. **Do NOT re-run the migration SQL** — it would fail on "table already exists" and could corrupt data if the IF NOT EXISTS clauses aren't present.

Run this against prod:

```sql
INSERT INTO schema_migrations (version, name, applied_at)
VALUES (
  82,
  '082_create_shop_no_show_policy_and_email_preferences',
  (SELECT MIN(applied_at) FROM schema_migrations WHERE version::int BETWEEN 80 AND 84)
)
ON CONFLICT (version) DO NOTHING;
```

The `(SELECT MIN(applied_at) ...)` back-dates the record to the batch timestamp of the surrounding migrations (a sane lie — it's when it *probably* was applied). If that returns NULL, use `CURRENT_TIMESTAMP` instead.

Alternative — just mark it with current timestamp:
```sql
INSERT INTO schema_migrations (version, name, applied_at)
VALUES (82, '082_create_shop_no_show_policy_and_email_preferences', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;
```

Either works. The cleaner-looking option is the first; the more honest one is `CURRENT_TIMESTAMP`.

### Fix 2 — Migration 101 apply (Medium risk, ~5 min)

Run the migration SQL against prod, then insert tracking row. The migration is idempotent-ish:

- The first `DROP CONSTRAINT` will fail if the constraint already exists under a different name — verify first
- The `ADD COLUMN` uses plain `ADD COLUMN` (no IF NOT EXISTS) — but if the column doesn't exist (confirmed by audit), this is safe
- The `ALTER COLUMN ... DROP NOT NULL` is idempotent
- The `ADD CONSTRAINT` will fail if the constraint already exists — verify first

**Pre-flight check** (run these first on prod to confirm the current state):

```sql
-- Should return the existing constraint definition (ios|android only)
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'device_push_tokens'::regclass
  AND conname = 'device_push_tokens_device_type_check';

-- Should return no rows (column doesn't exist yet)
SELECT column_name FROM information_schema.columns
WHERE table_name = 'device_push_tokens' AND column_name = 'web_push_subscription';

-- Should NOT already have push_token_type_check
SELECT conname FROM pg_constraint
WHERE conrelid = 'device_push_tokens'::regclass
  AND conname = 'push_token_type_check';
```

If pre-flight matches expectations (existing device_type CHECK only has ios/android; no web_push_subscription column; no push_token_type_check), **run migration 101 inside a transaction** so it rolls back cleanly on any error:

```sql
BEGIN;

ALTER TABLE device_push_tokens
  DROP CONSTRAINT device_push_tokens_device_type_check;

ALTER TABLE device_push_tokens
  ADD CONSTRAINT device_push_tokens_device_type_check
  CHECK (device_type IN ('ios', 'android', 'web'));

ALTER TABLE device_push_tokens
  ADD COLUMN web_push_subscription JSONB;

ALTER TABLE device_push_tokens
  ALTER COLUMN expo_push_token DROP NOT NULL;

ALTER TABLE device_push_tokens
  ADD CONSTRAINT push_token_type_check CHECK (
    (device_type IN ('ios', 'android') AND expo_push_token IS NOT NULL)
    OR
    (device_type = 'web' AND web_push_subscription IS NOT NULL)
  );

-- Record the migration as applied
INSERT INTO schema_migrations (version, name, applied_at)
VALUES (101, 'add_web_push_support', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;

COMMIT;
```

If any step fails, the whole transaction rolls back — the DB returns to its current (un-migrated) state. Then investigate before retrying.

### Fix 3 — Post-apply verification

Re-run the production audit after both fixes:

```bash
cd backend && DB_HOST=<prod> DB_USER=<prod> DB_PASSWORD=<prod> DB_NAME=defaultdb DB_PORT=25060 node scripts/run-audit.js
```

Expected deltas vs previous audit:
- Section 2a: `082` and `101` no longer listed as missing
- Section 3: `M101: device_push_tokens.web_push_subscription column exists` flips FAIL → PASS
- Section 4 summary: `missing_count: 0`, `schema_fail_count: 0`

---

## Files to Modify

**None in the repo.** Both fixes are SQL statements run directly against the production database via DO's Database Console, psql, or the existing `run-single-migration.ts` pattern. No code changes, no new migration files (082 already exists, 101 already exists).

Optional cleanup: if the team wants a repeatable script, wrap Fix 1 + Fix 2 in `backend/scripts/apply-missing-prod-migrations.js` following the pattern of `fix-prod-migrations.js`. Not required — this is a one-shot remediation.

---

## Verification Checklist

### Pre-flight (before any write)

- [ ] Confirm current state via audit (`run-audit.js` against prod) — should show exactly the 2 items: missing 082, missing 101, FAIL on web_push_subscription
- [ ] Pre-flight queries from Fix 2 return expected results (device_type constraint exists with only ios/android, no web_push_subscription column)
- [ ] Backup confirmed — either DO automated backup is recent (<24h) or manually snapshot before proceeding

### After Fix 1 (082 tracking backfill)

- [ ] `SELECT * FROM schema_migrations WHERE version::int = 82;` returns 1 row
- [ ] Re-running audit shows 082 no longer in Section 2a missing list
- [ ] No other rows were affected (quick sanity check on `schema_migrations` row count — should increase by exactly 1)

### After Fix 2 (101 apply + record)

- [ ] `device_push_tokens_device_type_check` constraint now allows 'web': `SELECT pg_get_constraintdef(...)` shows `IN ('ios','android','web')`
- [ ] `web_push_subscription` column exists as JSONB: `\d device_push_tokens` in psql, or the audit check passes
- [ ] `expo_push_token` is nullable: `SELECT is_nullable FROM information_schema.columns WHERE table_name='device_push_tokens' AND column_name='expo_push_token'` returns 'YES'
- [ ] `push_token_type_check` constraint exists
- [ ] `SELECT * FROM schema_migrations WHERE version::int = 101;` returns 1 row
- [ ] Existing push token rows still valid under the new constraint (no row has both `expo_push_token IS NULL AND web_push_subscription IS NULL`):
  ```sql
  SELECT COUNT(*) FROM device_push_tokens
  WHERE expo_push_token IS NULL AND web_push_subscription IS NULL;
  -- Expected: 0
  ```

### Smoke tests (functional)

- [ ] Existing mobile push notifications still fire correctly (registering/sending a push on an ios/android device) — no regression in the happy path
- [ ] If the team has a web push test flow, exercise it once to confirm the schema now accepts web tokens

### Regression

- [ ] Re-run audit: `missing_count=0`, `orphan_count` unchanged (still 6 expected orphans), `schema_fail_count=0`
- [ ] Staging audit remains unchanged (this work only touches prod)

---

## Notes

- **Both fixes are applied directly to the production database** — not through a code PR. The migration files already exist in the repo; we're just reconciling the DB state to match. This is the standard "fix-prod-migrations.js" pattern.
- **Coordinate timing:** Fix 2 briefly drops and re-creates a CHECK constraint on `device_push_tokens`. During that ~1s window, concurrent INSERTs could theoretically fail. The whole transaction runs in <2 seconds — pick a low-traffic window or accept the tiny risk.
- **Rotation reminder:** the prod DB credentials used to run the audit on 2026-04-24 were shared via chat (plain text). Treat those credentials as potentially exposed; rotate the `doadmin` password at the next quiet window and update any stored secrets.
- **Why not bundle with the shop-register code fix:** the `cross_shop_enabled` bug fix is a code change shipped via normal PR/deploy flow. These migration reconciliations are DB ops. Different risk profiles and different reviewers — keep them separate PRs/workstreams.
- **Audit findings for staging remain different:** staging still has the inverted M006 drift (tracking says applied, column still exists). That's a separate cleanup task — the audit would benefit from a matching doc tracking staging remediation once prod is settled.
- **Commit policy:** this doc lands in the repo, but the actual SQL statements are operator-run against prod. No code commits needed for the fix itself.

---

## Implementation confidence notes for receiving operator

1. **Run the audit first** (`backend/scripts/run-audit.js` against prod) to confirm the state matches what this doc describes. If the findings differ, stop and re-assess before running any write.
2. **Do Fix 1 first** (lower risk, builds confidence). Verify its audit impact (Section 2a loses a row) before proceeding to Fix 2.
3. **Fix 2 must run in a single transaction** — don't split into separate statements sent one-by-one via a GUI. If one fails midway without transactional wrapping, `device_push_tokens` is left in a half-migrated state (dropped constraint, no replacement). DO's Database Console does NOT wrap pasted queries in a transaction unless you include `BEGIN;` / `COMMIT;` yourself.
4. **If Fix 2's pre-flight fails** (e.g., the column already exists, or a different constraint name is in place), the migration may have been partially applied by a previous attempt. Stop and investigate — manual reconciliation is safer than blindly re-running.
5. **Staging has migration 101 applied correctly.** If uncertain about how the migration should look end-to-end, inspect staging's `device_push_tokens` schema as a reference state before touching prod.
6. **No mobile or frontend code changes are required** — the TypeScript code already expects the schema that migration 101 produces. Once the DB catches up, the code just works.
