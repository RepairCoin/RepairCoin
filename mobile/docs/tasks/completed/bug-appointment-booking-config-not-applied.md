# Bug: Appointment Booking Config Not Applied on Mobile

**Status:** Completed
**Priority:** High
**Est. Effort:** 4-6 hrs
**Created:** 2026-04-06
**Updated:** 2026-04-06
**Completed:** 2026-04-06

## Overview

The mobile customer booking calendar does not fetch or apply the shop's time slot configuration. All constraints (advance booking days, buffer time, minimum notice, max concurrent bookings) are either hardcoded or ignored. The web app applies all settings correctly.

**Affected:** Customer booking flow (mobile only)
**Shop:** peanut | **Customer:** qua ting | **Service:** Aqua Tech

## Database Config for Shop "peanut"

| Setting | Value |
|---------|-------|
| slot_duration_minutes | 60 |
| buffer_time_minutes | 20 |
| max_concurrent_bookings | 1 |
| booking_advance_days | 7 |
| min_booking_hours | 2 |
| allow_weekend_booking | true |
| timezone | America/New_York |

---

## Bug 1: Advance Booking Days — Hardcoded to 30 Instead of Shop Config

**Severity:** High

**What happens:** Customer can select any date up to 30 days in the future, regardless of the shop's `booking_advance_days` setting (7 days for peanut).

**Web behavior:** Correctly limits calendar to 7 days ahead (greyed out dates beyond that).

**Root cause:** `AppointmentScheduleScreen.tsx` line 22-26 hardcodes `maxDate` to 30 days:

```typescript
const maxDate = useMemo(() => {
  const date = new Date();
  date.setDate(date.getDate() + 30);  // HARDCODED — should use shop config
  return date.toISOString().split("T")[0];
}, []);
```

The parent screen `AppointmentCompleteScreen.tsx` (line 43-55) fetches `shopAvailability` and `timeSlots` but never fetches the time slot config — `useTimeSlotConfigQuery` is never called.

**Fix required:**
1. In `AppointmentCompleteScreen.tsx`: fetch time slot config using the public endpoint `GET /api/services/appointments/time-slot-config/{shopId}`
2. Pass `bookingAdvanceDays` to `AppointmentScheduleScreen`
3. In `AppointmentScheduleScreen.tsx`: replace hardcoded 30 with the config value

**Web reference:** `ServiceCheckoutModal.tsx` line 189-202 loads config, line 602 passes `maxAdvanceDays={timeSlotConfig?.bookingAdvanceDays || 30}` to `DateAvailabilityPicker`.

**Files:**
- `mobile/feature/appointment/screens/AppointmentCompleteScreen.tsx` — needs to fetch config
- `mobile/feature/appointment/screens/AppointmentScheduleScreen.tsx:22-26` — needs to use config value
- `mobile/feature/appointment/types.ts` — may need to add prop for config

---

## Bug 2: Minimum Notice Hours — Not Enforced

**Severity:** Medium

**What happens:** Customer can book a time slot that's less than `min_booking_hours` (2 hours) away. No validation prevents booking too soon.

**Web behavior:** Validates at payment time — shows "Booking Time Too Soon" error and disables the payment button.

**Root cause:** `AppointmentCompleteScreen.tsx` has no validation for minimum booking hours before proceeding to payment. The web version (`ServiceCheckoutModal.tsx` lines 265-297) validates `minBookingHours` and blocks payment if the selected time is too soon.

**Fix required:**
1. After selecting date + time, validate that the booking is at least `minBookingHours` in the future
2. Show error message if too soon
3. Disable "Continue" button if validation fails

**Web reference:** `ServiceCheckoutModal.tsx` lines 265-297 `validateAdvanceBooking()` function.

---

## Bug 3: Max Concurrent Bookings — Not Enforced Client-Side

**Severity:** Low (backend enforces this)

**What happens:** The mobile calendar/time picker shows all generated time slots without considering how many bookings already exist for each slot. If `max_concurrent_bookings` is 1 and a slot is already booked, it still shows as available.

**Web behavior:** The backend endpoint `GET /api/services/appointments/available-slots` handles this server-side — it checks existing bookings and removes fully-booked slots. So if the mobile app calls this endpoint correctly, concurrent booking limits ARE enforced.

**Investigation result:** The mobile DOES call `useAvailableTimeSlotsQuery` which hits the backend endpoint. The backend (`AppointmentService.ts` line 289+) generates slots and checks existing bookings. This is likely working correctly since enforcement is server-side. However, if the mobile is generating slots client-side instead of using the API response, this would fail.

**Status:** Needs manual QA verification — book the same time slot twice and see if the second attempt is blocked.

---

## Bug 4: Buffer Time — Appears as 0 in Mobile Settings Display

**Severity:** Low (display only — does not affect customer booking)

**What happens:** The mobile shop settings page (AvailabilityModal) shows buffer time = 0m when opened, even though the saved value is 20 minutes.

**Web behavior:** Shows the correct saved value (20 minutes).

**Root cause:** The `AvailabilityModal.tsx` settings display uses preset button options (0, 5, 10, 15, 30). The saved value of 20 doesn't match any preset, so no button appears selected — it looks like 0 is selected because 0 is the first option.

The `useAvailabilityModal.ts` hook (line 54-84) correctly loads the config from the API and stores it in state. The issue is purely visual — the `SettingCard` component highlights the button matching `selectedValue`, but 20 is not in the options array `[0, 5, 10, 15, 30]`.

**Fix required:** Either:
- Add 20 to the buffer time options: `[0, 5, 10, 15, 20, 30]`
- Or use a different UI that shows the exact value (number input or slider)

**File:** `mobile/feature/service/components/AvailabilityModal.tsx` — buffer time options array

---

## Bug 5: Weekend Booking Restriction — Not Applied

**Severity:** Low

**What happens:** The calendar disables dates based on `shopAvailability` (which days are open/closed) but does NOT check `allow_weekend_booking` from the time slot config.

**Web behavior:** `DateAvailabilityPicker.tsx` line 70 checks `allowWeekendBooking` and disables Saturday/Sunday if false.

**Root cause:** Same as Bug 1 — the time slot config is never fetched, so `allowWeekendBooking` is unavailable.

**Fix:** Resolves automatically when Bug 1 fix fetches the config. Just needs to additionally check `allowWeekendBooking` when marking dates as disabled.

---

## Summary Table

| Bug | Severity | Status | Description |
|-----|----------|--------|-------------|
| 1 | High | Open | Advance booking days hardcoded to 30 instead of shop config |
| 2 | Medium | Open | Minimum notice hours not enforced |
| 3 | Low | Open | Max concurrent bookings — needs QA verification |
| 4 | Low | Open | Buffer time displays as 0 instead of saved value |
| 5 | Low | Open | Weekend booking restriction not applied |

## Files to Modify

| File | Bugs |
|------|------|
| `mobile/feature/appointment/screens/AppointmentCompleteScreen.tsx` | 1, 2, 5 |
| `mobile/feature/appointment/screens/AppointmentScheduleScreen.tsx` | 1, 5 |
| `mobile/feature/appointment/types.ts` | 1 |
| `mobile/feature/service/components/AvailabilityModal.tsx` | 4 |

## QA Test Plan

### Bug 1: Advance Booking
1. Open mobile app as customer "qua ting"
2. Browse to "Aqua Tech" service from shop "peanut"
3. Tap Book → Select Schedule
4. **Before fix:** All dates up to 30 days ahead are selectable
5. **After fix:** Only dates within 7 days should be selectable

### Bug 2: Minimum Notice
1. Select today's date
2. Select a time slot less than 2 hours from now
3. **Before fix:** Can proceed to payment
4. **After fix:** Should show error "Booking requires at least 2 hours notice"

### Bug 4: Buffer Time Display
1. Login as shop "peanut"
2. Go to service → Availability Settings → Settings tab
3. **Before fix:** Buffer Time shows 0m selected
4. **After fix:** Buffer Time shows 20m selected

### Comparison Test
1. Book the same service on web and mobile
2. Verify both show identical available dates and time slots
3. Verify both enforce the same restrictions
