# Bug: Booking Settings Save Configuration Fails

**Status:** Open
**Priority:** HIGH
**Est. Effort:** 2-3 hours
**Created:** 2026-03-10

---

## Problem

"Save Configuration" fails with database error. Multiple secondary bugs cause silent data corruption.

## Bugs to Fix

1. Missing UNIQUE constraint on `shop_id` (root cause - migration needed)
2. `slotDurationMinutes` not included in save payload
3. `||` operator treats `0` as falsy (should use `??`)
4. `timezone` not sent in payload
5. Display defaults don't match save defaults

## Files to Modify

- `frontend/src/components/shop/service/ServiceAvailabilitySettings.tsx`
- `backend/src/domains/ServiceDomain/controllers/AppointmentController.ts`
- Run migration `070_fix_time_slot_config_unique_constraint.sql`

## Verification Checklist

- [ ] Save Configuration succeeds without error
- [ ] `slotDurationMinutes` preserved after save
- [ ] Setting values to `0` works correctly
- [ ] Timezone preserved
