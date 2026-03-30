# Bug: Waitlist Form Submit Returns 500 on Production

**Status**: Open
**Priority**: High
**Date**: 2026-03-16
**Environment**: Production only (api.repaircoin.ai)

## Description

Submitting the waitlist form (both "Join Waitlist" and "Get Free Demo") on https://www.repaircoin.ai/waitlist returns a 500 Internal Server Error. The same code works on staging.

## Error

```
POST https://api.repaircoin.ai/api/waitlist/submit 500 (Internal Server Error)
Response: {"success":false,"error":"Failed to submit waitlist entry"}
```

## Investigation So Far

1. **Migration 085** (`inquiry_type` column) — confirmed added to prod DB
2. **Migration 082** (`shop_email_preferences` table) — was missing, stale migration detection added to re-apply migrations 069-087
3. **Health check passes** — app is running, DB has 83 tables, connection healthy
4. **`prestart` migration was crashing deployments** — `process.exit(1)` prevented new code from deploying. Fixed to be non-fatal
5. **Debug error details added** to WaitlistController catch block (temporary) — waiting for deployment to go live to capture actual DB error

## Root Cause (Pending)

The exact DB error is unknown because:
- The error catch block returns a generic message
- Debug logging was added but deployments were failing due to `prestart` crash
- Latest fix makes `prestart` non-fatal so debug code should deploy

## Files Involved

- `backend/src/controllers/WaitlistController.ts` — route handler
- `backend/src/repositories/WaitlistRepository.ts` — DB queries
- `backend/src/services/EmailService.ts` — imports EmailPreferencesService
- `backend/src/services/EmailPreferencesService.ts` — queries shop_email_preferences table
- `backend/scripts/run-migrations.ts` — migration runner (fixed path + stale detection)

## Next Steps

1. Wait for current deployment to complete (non-fatal prestart fix)
2. Hit the endpoint again to get the `debug` field with actual error details
3. Fix the root cause based on the actual error
4. Remove temporary debug logging from WaitlistController

## Related Fixes Applied

- `tsconfig.json` — include migration script in build
- `package.json` — `db:migrate` uses compiled JS, `prestart` runs migrations
- `run-migrations.ts` — fixed `__dirname` path resolution for compiled JS
- `run-migrations.ts` — stale migration detection and re-apply
- `run-migrations.ts` — non-fatal error handling
- Migration 087 — re-apply inquiry_type column
