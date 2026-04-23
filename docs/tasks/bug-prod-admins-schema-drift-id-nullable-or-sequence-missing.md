# Bug: Production admins.id Schema Drift — NULL IDs Accepted, Sequence/Constraint Missing

## Status: Open
## Priority: Medium
## Date: 2026-04-22
## Category: Infrastructure / Database / Schema Drift
## Affects: `admins` table in production DigitalOcean Managed PostgreSQL
## Found by: Manual admin INSERT for Princess Lim (`0xf4A77623...`) on prod — INSERT succeeded with `id = NULL`

---

## Problem

The production `admins` table accepts `NULL` values in its `id` column when a row is INSERTed without specifying an id. Staging does not have this behavior — staging's schema has `NOT NULL` + `DEFAULT nextval('admins_id_seq'::regclass)`.

### Evidence from 2026-04-22

While promoting Princess Lim to admin on prod (for waitlist management testing), a plain INSERT statement that omitted the `id` column inserted the row successfully with `id = NULL`:

```sql
INSERT INTO admins (
  wallet_address, name, email, role, is_super_admin, is_active,
  permissions, created_by, metadata
) VALUES (
  '0xf4a77623e1706717eda890c40a43ac73b0c3a2fb',
  'Princess Lim', ..., 'admin', false, true, ...
);
-- Result: 1 row affected, but id column was NULL
```

**This is impossible with a `NOT NULL DEFAULT nextval(...)` column.** PostgreSQL would either:
- Use the default sequence value, producing an integer id, OR
- Raise a `null value in column "id" violates not-null constraint` error

Neither happened — the row was inserted with NULL. Root cause must be one of:

1. `is_nullable = 'YES'` on prod's id column (NOT NULL constraint was never added, or was dropped)
2. `column_default` is NULL or empty on prod (auto-increment default was never set, or was dropped)
3. `admins_id_seq` sequence doesn't exist on prod (the default references a non-existent sequence, which in some PostgreSQL configurations can silently fall back to NULL depending on the exact definition)
4. The column's primary key constraint is missing on prod (so duplicate NULLs wouldn't conflict)

Staging's equivalent column (verified 2026-04-22 via `backend/scripts/inspect-admins-schema.ts`):
```
id   integer   null=NO   default=nextval('admins_id_seq'::regclass)
```

### Immediate mitigation (already done)

Princess's row was manually set to `id = 5` via `UPDATE admins SET id = 5 WHERE wallet_address = ...` so she could log in and access the admin UI. This mitigation is row-specific; the underlying schema issue remains.

If the sequence exists, it should also be bumped to at least 5 with:
```sql
SELECT setval('admins_id_seq', 5, true);
```

---

## Impact

**Today (not urgent):**
- Princess's row works after manual fix. No other known impact.

**Next time someone adds an admin on prod:**
- If they INSERT without specifying id, they'll hit the same NULL-id issue and need manual fix
- If they INSERT specifying a hardcoded id that coincidentally matches a future sequence value, could cause primary key conflicts (assuming the PK exists)
- Any backend code that queries admins by id (JOINs on audit logs, references from other tables) may silently return no results for NULL-id admins

**Risks of leaving it unpatched:**
- Onboarding the next admin will hit this footgun and require manual fix
- Schema drift suggests other tables may ALSO have diverged between prod and staging — worth a broader audit
- Any migration that assumes the current schema matches (both environments) could fail on prod

---

## Investigation Required

### Step 1 — Capture prod's actual schema

Run on prod (via TablePlus or DO web console):

```sql
-- Column definition
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'admins' AND column_name = 'id';

-- Primary key / unique constraints
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'admins'::regclass;

-- Sequence existence
SELECT sequence_name, last_value, is_called
FROM pg_sequences
WHERE sequence_name = 'admins_id_seq';

-- How many rows have NULL id
SELECT COUNT(*) AS null_id_rows, MAX(id) AS max_id
FROM admins
WHERE id IS NULL;
```

Paste results into this task doc's Notes section when investigating.

### Step 2 — Identify the divergence point

Compare prod output with staging output (from `backend/scripts/inspect-admins-schema.ts`). Identify which migrations created the difference:

```bash
# In the backend/migrations folder, find the initial admins table creation
grep -rn "CREATE TABLE.*admins\|ALTER TABLE admins" backend/migrations | grep -iE "id|primary key|sequence"
```

Check which migrations have been applied on prod vs staging (there's likely a migrations tracking table):

```sql
-- Most Node/Express migration libraries track applied migrations in a table
-- Common names: pgmigrations, migrations, schema_migrations, knex_migrations
SELECT * FROM pgmigrations ORDER BY run_on DESC LIMIT 20;
-- OR
SELECT * FROM migrations ORDER BY id DESC LIMIT 20;
```

### Step 3 — Determine the fix path

Based on what Step 1 reveals:

**If `is_nullable = 'YES'` AND sequence exists AND has a reasonable last_value:**
```sql
-- Backfill any NULL ids first
UPDATE admins
SET id = nextval('admins_id_seq')
WHERE id IS NULL;

-- Then enforce NOT NULL
ALTER TABLE admins ALTER COLUMN id SET NOT NULL;

-- Verify the default is set correctly
ALTER TABLE admins ALTER COLUMN id SET DEFAULT nextval('admins_id_seq');
```

**If sequence doesn't exist:**
```sql
-- Create sequence matching staging's definition
CREATE SEQUENCE admins_id_seq;

-- Set sequence to past existing max id
SELECT setval('admins_id_seq', COALESCE((SELECT MAX(id) FROM admins), 0) + 1, false);

-- Attach as default to id column
ALTER TABLE admins ALTER COLUMN id SET DEFAULT nextval('admins_id_seq');

-- Own the sequence to the column (auto-drops if column is dropped)
ALTER SEQUENCE admins_id_seq OWNED BY admins.id;

-- Backfill NULL ids
UPDATE admins SET id = nextval('admins_id_seq') WHERE id IS NULL;

-- Enforce NOT NULL
ALTER TABLE admins ALTER COLUMN id SET NOT NULL;
```

**If primary key constraint is missing:**
```sql
-- After ensuring all ids are non-null and unique
ALTER TABLE admins ADD CONSTRAINT admins_pkey PRIMARY KEY (id);
```

### Step 4 — Run as a migration, not ad-hoc SQL

The fix should be captured as a new migration file so:
- It's version-controlled
- It can be applied to any other environment that has drifted
- The team has a record of what changed

Suggested file: `backend/migrations/0XX_fix_admins_id_schema_drift.sql` (use next available migration number).

---

## Related Schema Drift Audit (follow-up)

Once this table is fixed, do a broader comparison between prod and staging schemas to catch other drifted tables:

```bash
# Dump schema-only from both environments
pg_dump --schema-only $PROD_DATABASE_URL > prod.schema.sql
pg_dump --schema-only $STAGING_DATABASE_URL > staging.schema.sql
diff prod.schema.sql staging.schema.sql
```

File findings as separate bug docs per table affected.

---

## Verification

After the fix migration runs on prod:

- [ ] `SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='admins' AND column_name='id';` returns `null=NO, default=nextval('admins_id_seq'::regclass)`
- [ ] `SELECT sequence_name FROM pg_sequences WHERE sequence_name='admins_id_seq';` returns 1 row
- [ ] `SELECT COUNT(*) FROM admins WHERE id IS NULL;` returns 0
- [ ] Test: manually INSERT a new admin without specifying id → row gets a valid auto-incremented id, not NULL
- [ ] Princess Lim's row still has id=5 and no regressions (role='admin', is_active=TRUE)
- [ ] `npm run admin:promote <address>` script (per CLAUDE.md) works end-to-end on prod

---

## Notes

- **Mitigation already applied 2026-04-22:** Princess Lim's row (wallet `0xf4A77623...`) was manually set to `id=5` via UPDATE. She's fully functional as an admin. This is row-specific, not a schema fix.
- **Sequence bump recommended today** (separate from the full schema fix): `SELECT setval('admins_id_seq', 5, true);` protects against future collision if the sequence exists but is behind. Runs in a few ms; safe if seq exists, errors harmlessly if not.
- **Not blocking any active work.** Raised as a latent footgun. Current prod admins (Jeff, Khalid, Ian, deo, Princess) all have valid ids and can log in.
- **Possible cause:** the initial migration that created the admins table may not have been applied to prod; a later migration that ALTERed the table to set the sequence may have skipped prod; or someone ran a manual DB change on prod that diverged. Investigation step 2 will tell us.
- **Referenced today's work:**
  - Admin insert performed via raw SQL in TablePlus (not via `admin:promote` script, per operator's direction at the time)
  - Staging schema captured via `backend/scripts/inspect-admins-schema.ts`
  - Parent context: Princess needed waitlist management access; role='admin' + route middleware `requireAdmin` is sufficient
