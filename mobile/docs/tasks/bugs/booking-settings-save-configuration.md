# Bug: Booking Settings Save Configuration Fails

**Status:** ALREADY FIXED
**Priority:** HIGH
**Est. Effort:** 2-3 hours
**Created:** 2026-03-10
**Verified:** 2026-03-10

---

## Problem

"Save Configuration" fails with database error. Multiple secondary bugs cause silent data corruption.

## Bugs to Fix - ALL ALREADY FIXED

| Bug | Status | Location |
|-----|--------|----------|
| 1. Missing UNIQUE constraint | ✅ Fixed | `migrations/070_fix_time_slot_config_unique_constraint.sql` |
| 2. `slotDurationMinutes` missing | ✅ Fixed | `ServiceAvailabilitySettings.tsx:142` |
| 3. `||` treats 0 as falsy | ✅ Fixed | Uses `??` throughout |
| 4. `timezone` not sent | ✅ Fixed | `ServiceAvailabilitySettings.tsx:148` |
| 5. Display defaults mismatch | ✅ Fixed | All inputs use `??` with matching defaults |

## Remaining Action

- [ ] Verify migration `070` has been run on staging/production database

## Verification Checklist

- [x] Save Configuration succeeds without error (code ready)
- [x] `slotDurationMinutes` preserved after save
- [x] Setting values to `0` works correctly
- [x] Timezone preserved
