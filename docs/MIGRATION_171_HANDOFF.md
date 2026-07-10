# Action Needed: Run Migration 171 (`fraud_findings`)

**For:** whoever owns DB / deploys
**From:** Zeff
**Date:** June 23, 2026
**Priority:** Required to activate the new Fraud Detection (Trust & Safety) feature

---

## TL;DR

One new database migration needs to run on **staging** and **production**:

```
backend/migrations/171_create_fraud_findings.sql
```

It creates the `fraud_findings` table used by the new admin **Trust & Safety**
feature. The code is already merged to `main`. Until this migration runs, the
nightly fraud scan errors and the Trust & Safety admin tab shows "Failed to load."

**Easiest path: deploy `main` to staging (then prod).** The app runs
`npm run db:migrate` automatically on boot (`prestart` hook), so a normal deploy
applies it — no manual steps.

---

## Why it isn't already applied

The migration is safe and ready — it just hasn't been executed. It couldn't be
run from the dev machine because DigitalOcean managed databases only accept
connections from **allowlisted sources**, and that machine's IP isn't on the
list (connection times out). Running it from inside the DO network (a deploy) or
from an allowlisted machine works fine.

---

## How to run it (pick ONE)

### Option 1 — Deploy `main` (recommended, zero manual steps)
The backend's `prestart` hook runs `npm run db:migrate` on startup from inside
DigitalOcean's network (already allowlisted). Deploying the latest `main` to
**staging** applies migration 171 automatically. Repeat for **production**.

### Option 2 — Run the migration command from an allowlisted machine
From the `backend/` directory, with `DATABASE_URL` pointing at the target DB:
```bash
cd backend && npm run db:migrate
```
(Applies all pending migrations, including 171.) To run only this one:
```bash
cd backend && npx ts-node scripts/run-single-migration.ts migrations/171_create_fraud_findings.sql
```
> If you get a connection timeout: add your IP under DigitalOcean → Databases →
> the DB cluster → **Settings → Trusted Sources**, then re-run.

### Option 3 — Paste into the DigitalOcean DB console
Open the DB cluster's console (runs from inside DO's network) and paste the
contents of `backend/migrations/171_create_fraud_findings.sql`.

---

## Verify it worked

```sql
SELECT COUNT(*) FROM fraud_findings;   -- should return 0 (table exists, empty)
```
After the next nightly scan (or a manual run), findings will start appearing,
and the admin **Trust & Safety** tab will load.

---

## Scope / safety

- **Targets:** staging first, then production (run on both).
- **Safe:** pure `CREATE TABLE` + indexes (`uuid_generate_v4()`, already used
  elsewhere in the schema). Creates a new table only — touches no existing data.
- **Idempotent:** uses `IF NOT EXISTS`, so re-running is harmless.

---

## Related (separate handoff)

`docs/PROD_HANDOFF_2026-06-23.md` covers the other two **production** tasks
(RCG shop-tier backfill + `ENABLE_BLOCKCHAIN_MINTING=false`). Those are
independent of this migration.
