# Bug: Migration Runner Cannot Find SQL Files on Production Container

**Status**: Open
**Priority**: High
**Date**: 2026-03-16

## Description

The migration runner (`scripts/run-migrations.ts`) cannot locate the `migrations/` directory when running as compiled JS (`dist/scripts/run-migrations.js`) on the DigitalOcean App Platform production container. This means no new migrations are ever applied automatically on production deploys.

## Root Cause

The migration runner resolves the migrations directory using `__dirname`:

```ts
// scripts/run-migrations.ts
const projectRoot = path.resolve(__dirname, '..');
const candidate = path.join(projectRoot, 'migrations');
if (fs.existsSync(candidate)) {
  this.migrationsDir = candidate;
} else {
  this.migrationsDir = path.resolve(__dirname, '..', '..', 'migrations');
}
```

- **ts-node** (local dev): `__dirname` = `scripts/` → `../migrations` = `migrations/` - works
- **Compiled JS** (local): `__dirname` = `dist/scripts/` → fallback `../../migrations` = `migrations/` - works
- **Compiled JS** (production): `__dirname` = `/workspace/backend/dist/scripts/` → neither path resolves to the actual `migrations/` directory on the production container

The production container's file layout differs from local. The `migrations/` directory may be at `/workspace/backend/migrations/` but the fallback path resolves elsewhere.

## Impact

- No migrations run automatically on production deploys via `prestart`
- The stale migration detection cleared `schema_migrations` records 69-87 but couldn't re-apply them
- Had to manually fix `inquiry_type` column via a diagnostic endpoint
- `shop_email_preferences` table and other migration 069-086 objects are still missing on prod
- Any future migrations added to `main` → `prod` will NOT be applied

## Evidence

From diagnostic endpoint (`/api/health/diag-waitlist`):
- `migrationRecords: []` — migrations 85/87 not in schema_migrations (deleted by stale check, never re-applied)
- `shopEmailPrefsExists: false` — migration 082 table missing
- `alterTable: "SUCCESS"` — DDL works fine when run directly (not a permissions issue)

## Recommended Fix

1. **Log the resolved path** in the migration runner so we can see exactly where it's looking on prod
2. **Use `process.cwd()`** instead of `__dirname` — on DO App Platform, `process.cwd()` is `/workspace/backend/`, so `path.join(process.cwd(), 'migrations')` should always work regardless of compiled JS location
3. **Add a diagnostic log** at startup showing the resolved migrations path and file count
4. **Re-run all missing migrations** (069-086) on prod after fixing the path

## Files to Fix

- `backend/scripts/run-migrations.ts` — fix path resolution logic
- `backend/src/app.ts` — `ensureCriticalSchema` can be removed once migrations work properly

## How to Verify

1. Deploy the fix to prod
2. Check Runtime Logs for migration output showing correct path and file count
3. Hit `/api/health/diag-waitlist` to confirm `shopEmailPrefsExists: true` and all migration records present
4. Remove diagnostic endpoint after confirmation

## Related

- `docs/tasks/bug-waitlist-submit-500-production.md` — the symptom this caused
- `docs/tasks/strategy/staging-environment-setup.md` — deployment workflow docs
