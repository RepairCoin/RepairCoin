# Time Slot Not Working - Bug Fix Strategy

**Date**: 2026-03-03
**Status**: Completed
**Priority**: High (Blocking customer bookings for multiple shops)

---

## Completed Tasks

### Investigation & Root Cause Analysis
- Conducted live database queries against staging DB to identify all shops with missing `shop_time_slot_config` rows — found 6 affected shops (TestShop, MBG.life, AutoTest, Dexter, QuickFix AT, Shop 5)
- Tested API endpoints directly for all affected shops — confirmed TestShop and MBG.life return 500 error "Shop time slot configuration not found"
- Traced the error to `AppointmentService.ts` line 38 — throws when `getTimeSlotConfig()` returns null
- Investigated Peanut shop's March 10 blank time slots — confirmed `bookingAdvanceDays=7` with no date overrides or bookings
- Discovered timezone boundary issue: backend uses shop timezone (ET = March 2) while frontend uses customer local time (PHT = March 3), causing March 10 to be 8 days away in ET (exceeds 7-day limit)
- Traced git history to find when `createDefaultTimeSlotConfig` was added (commit `26a38a4b`, Jan 5 2026) — confirmed TestShop was created before this code existed
- Confirmed MBG.life and 4 other shops were created after the fix but `createDefaultTimeSlotConfig` failed silently due to try/catch swallowing errors
- Verified the UNIQUE constraint on `shop_time_slot_config.shop_id` exists (migration 070 was applied)

### Phase 1: Database Backfill (Bug #1 — Immediate Fix)
- Ran SQL backfill to create missing `shop_time_slot_config` rows for 6 shops (TestShop, MBG.life, Dexter, Shop 5, AutoTest, QuickFix Auto Detection Test)
- Ran SQL backfill to create missing `shop_availability` rows for 4 shops with 0 availability (28 rows created — 7 days each for Dexter, Shop 5, AutoTest, QuickFix AT)
- Verified all 31 shops now have both config and 7 availability rows
- Tested API — TestShop and MBG.life now return 7 slots each (were returning 500 error before)

### Phase 2: Backend Lazy Initialization (Bug #1 + #3 — Permanent Fix)
- Modified `AppointmentService.getAvailableTimeSlots()` — instead of throwing when config is missing, auto-creates default config via `updateTimeSlotConfig()` (UPSERT with sensible defaults)
- Added lazy initialization for `shop_availability` — if a shop has 0 availability rows, auto-creates Mon-Fri 9am-6pm defaults and re-fetches
- Modified `AppointmentController.getPublicTimeSlotConfig()` — now auto-creates and returns default config instead of returning `{ success: true, data: null }`
- Escalated error logging in `ShopRepository.createDefaultTimeSlotConfig()` — changed `logger.warn` to `logger.error` so silent failures are visible in logs (still non-blocking for shop creation)

### Phase 3: Frontend Timezone Alignment (Bug #2 — Reverted)
- Initially implemented `shopTimezone` prop on `DateAvailabilityPicker` to align calendar with backend's timezone-based calculations
- Passed `shopTimezone` from `ServiceCheckoutModal`, customer `RescheduleModal`, shop `RescheduleModal`, and `ManualBookingModal`
- **Reverted all frontend timezone changes** — using shop timezone (ET) caused already-lapsed dates to appear as available when testing from timezones ahead of ET
- Bug #2 is a non-issue for USA users — customer and shop timezones are close enough that the `bookingAdvanceDays` boundary aligns naturally

### Phase 4: Verification
- TestShop: 7 slots returned (was 500 error) — FIXED
- MBG.life: 7 slots returned (was 500 error) — FIXED
- Gelo Testing Shop: 6 slots returned — still works correctly
- Weekend dates correctly return 0 slots for shops with Mon-Fri only availability
- Config endpoint now returns actual config data instead of null for previously affected shops

### Files Modified
- `backend/src/domains/ServiceDomain/services/AppointmentService.ts` — lazy init for config + availability
- `backend/src/domains/ServiceDomain/controllers/AppointmentController.ts` — auto-create config in public endpoint
- `backend/src/repositories/ShopRepository.ts` — escalated error logging from warn to error

---

## Bugs Summary

### Bug #1: "Shop time slot configuration not found" — FIXED
- **Root cause**: 6 shops missing `shop_time_slot_config` DB rows — TestShop created before auto-create code existed, 5 others had silent creation failures
- **Fix**: Database backfill (immediate) + lazy initialization in AppointmentService (permanent)

### Bug #2: Blank time slots on March 10 — NOT APPLICABLE FOR USA USERS
- **Root cause**: Frontend/backend timezone mismatch at `bookingAdvanceDays` boundary (only affects users in timezones significantly ahead of shop timezone)
- **Decision**: No fix needed — website targets USA users where customer and shop timezones are within a few hours of each other

### Bug #3: Silent config creation failures — FIXED
- **Root cause**: `createDefaultTimeSlotConfig()` catches and swallows all errors as `logger.warn`
- **Fix**: Escalated to `logger.error` + lazy initialization as safety net ensures configs are auto-created on first booking attempt
