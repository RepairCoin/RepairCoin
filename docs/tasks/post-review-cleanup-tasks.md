# Post-Review Cleanup Tasks

## Date: 2026-03-23
## Source: Team code review feedback
## Status: Open

---

## Task 1: Clean Up Debug Logs

### Priority: High (before production deploy)

Debug `console.log`, `RAISE NOTICE`, and temporary logging statements were added during no-show/dispute development and need to be removed before production.

### Files to clean:

| File | What to remove |
|------|----------------|
| `backend/src/services/NoShowPolicyService.ts` | `console.log('🔍 [NoShowPolicyService]...')` debug statements in `getShopPolicy()` |
| `backend/src/domains/ServiceDomain/controllers/DisputeController.ts` | `debug: error?.message` in catch block (line ~224) — remove `debug` field from error response |
| `backend/src/routes/health.ts` | Verify `diag-waitlist` endpoint was removed (was temporary) |

### Approach:
- Remove all `console.log` with `[NoShowPolicyService]` or `[DEBUG]` prefixes
- Remove `debug` field from error responses (only return `error` message)
- Keep `logger.info/error/warn` calls (those are proper structured logging)

---

## Task 2: Regression Checklist for Settings

### Priority: Medium

Create a manual regression checklist to verify settings functionality after changes.

### Email Settings Checklist:
- [ ] Load settings page → email preferences load correctly
- [ ] Toggle a notification switch → UI updates
- [ ] Click Save → success toast
- [ ] Refresh page → saved values persist
- [ ] Click Cancel → restores original values

### No-Show Policy Checklist:
- [ ] Load settings → default policy values shown
- [ ] Change tier threshold values → Save
- [ ] Refresh page → values persist
- [ ] Toggle dispute settings → Save → persist
- [ ] Test auto-approve first offense toggle

### Shop Profile Checklist:
- [ ] Load profile → fields populated from DB
- [ ] Edit shop name → type without reset → Save
- [ ] Edit social media URLs → type without reset → Save
- [ ] Refresh → saved values persist
- [ ] Switch to another settings tab and back → values unchanged

### Social Media Checklist:
- [ ] Load Social Media tab → existing links shown
- [ ] Add new link → type URL → Save
- [ ] Edit existing link → Save
- [ ] Remove link (clear field) → Save
- [ ] Invalid URL → shows validation error

---

## Task 3: Fix Migration Numbering (Duplicates)

### Priority: High
### Status: Fixed locally, needs commit + deploy

Two duplicate migration numbers were found and renamed:

| Original | Renamed To | Reason |
|----------|-----------|--------|
| `073_fix_customer_redemption_balances.sql` | `094_fix_customer_redemption_balances.sql` | Duplicate of `073_create_auto_messages.sql` |
| `092_fix_no_show_history_service_id_type.sql` | `093_fix_no_show_history_service_id_type.sql` | Duplicate of `092_create_moderation_system.sql` |

### Current clean sequence (090+):
```
090_add_waitlist_lead_fields.sql
091_add_waitlist_assigned_to.sql
092_create_moderation_system.sql          (Zeff - moderation)
093_fix_no_show_history_service_id_type.sql  (renamed from 092)
094_fix_customer_redemption_balances.sql     (renamed from 073)
```

### Impact:
- **`093`** was never applied on staging or production because it was `092` and conflicted with the moderation migration. After rename, the migration runner will see version 93 as new and apply it.
- **`094`** was never applied anywhere because it was a duplicate `073` — `073_create_auto_messages.sql` ran first and version 73 was recorded. After rename, version 94 will be applied.

### Remaining risk:
- Both migrations use `IF NOT EXISTS` / `ALTER TABLE ... TYPE` so they're safe to run even if the schema was already fixed by `ensureCriticalSchema`
- The `ensureCriticalSchema` safety net in `app.ts` already applies the `no_show_history.service_id` fix directly, so 093 is redundant but harmless

### Action needed:
- [ ] Commit renamed migration files
- [ ] Deploy to staging → verify 093 and 094 apply
- [ ] Deploy to production → verify same

---

## Task 4: Remove Temporary Test Scripts

### Priority: Low

Debug/test scripts created during dispute development should be removed or moved before production:

| File | Purpose | Action |
|------|---------|--------|
| `backend/scripts/debug-dispute.js` | Standalone dispute flow debugger | Remove |
| `backend/scripts/test-dispute-api.js` | HTTP API endpoint tester | Remove |
| `backend/scripts/test-noshow-tiers.js` | Tier restriction live tester | Keep (useful for future testing) or move to `tests/` |

---

## Task 5: Audit `ensureCriticalSchema` Safety Net

### Priority: Low (after migrations are stable)

The `ensureCriticalSchema()` function in `backend/src/app.ts` was added as a workaround when the migration runner wasn't working on production. Now that migrations run correctly, this function should be reviewed:

### Current contents:
- Waitlist columns (`inquiry_type`, `business_category`, `city`, `assigned_to`, index)
- `shop_email_preferences` table creation
- `no_show_history.service_id` type fix
- `schema_migrations` backfill for 004-068 and 1000-series

### Recommendation:
- **Keep** the schema_migrations backfill (one-time, idempotent)
- **Keep** the safety net for now but add a TODO comment to remove after 2-3 stable production deploys
- **Remove** individual column/table fixes once confirmed applied by migrations on both staging and production
