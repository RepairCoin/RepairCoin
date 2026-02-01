# BUG-005: Appointment time slot availability issues

**Type:** Bug
**Severity:** High
**Priority:** P1
**Component:** Backend - Appointment Service, Frontend - Availability Settings
**Labels:** bug, backend, frontend, appointments, availability
**Status:** FIXED ✅
**Date Fixed:** December 2025

---

## Description

Multiple issues with the appointment time slot availability system:

1. **Sunday shows "No available time slots"** even when configured as Open in Shop Operating Hours
2. **Some dates show no availability** despite having configured operating hours (Dec 17, 18, 21, 28, Jan 4, 11)
3. **Shop Operating Hours changes affect ALL services** - This is by design but may confuse shop owners who expect per-service configuration

---

## Steps to Reproduce

### Issue 1: Sunday No Time Slots

1. Login as shop owner
2. Navigate to any service → Availability tab
3. Verify Sunday is configured as Open (09:00 - 18:00)
4. Verify "Allow weekend bookings (Saturday & Sunday)" is checked
5. Login as customer
6. Navigate to Marketplace → Book the service
7. Select any Sunday date (e.g., Dec 21, Dec 28)
8. Observe: "No available time slots" message appears

### Issue 2: Inconsistent Date Availability

1. Using same configuration from Issue 1
2. In customer booking calendar, observe:
   - Dec 17 (Wed) - No green dot, no slots
   - Dec 18 (Thu) - No green dot, no slots
   - Dec 19 (Fri) - Green dot, HAS slots
   - Dec 20 (Sat) - Green dot, HAS slots
   - Dec 21 (Sun) - Green dot but NO slots
   - Dec 22 (Mon) - Green dot, HAS slots
   - ...pattern continues inconsistently

### Issue 3: Shop-Wide Hours Affects All Services

1. Login as shop owner
2. Go to Service A → Availability → Shop Operating Hours
3. Uncheck "Open" for Monday
4. Go to Service B → Availability → Shop Operating Hours
5. Observe: Monday is also unchecked (change applied globally)

---

## Expected Result

1. **Sunday**: Should show available time slots when configured as Open AND weekend bookings allowed
2. **All configured days**: Should consistently show time slots based on operating hours
3. **Per-service control**: Shop owners should be able to configure availability per service (or at minimum, the UI should clearly indicate changes are shop-wide)

---

## Actual Result

1. **Sunday**: Always shows "No available time slots" regardless of configuration
2. **Some weekdays**: Inconsistently show no slots even when configured as Open
3. **Shop-wide changes**: Changes to one service's operating hours affect all services (by design, but unclear in UI)

---

## Root Cause Analysis

### Issue 1 & 2: Time Calculation Bug

**File:** `backend/src/domains/ServiceDomain/services/AppointmentService.ts`

**Lines 65-70:**
```typescript
const now = new Date();
const bookingDate = new Date(date);
const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);

if (hoursUntilBooking < config.minBookingHours) {
  return []; // Too soon to book
}
```

**Problem:** `bookingDate` is parsed as midnight (00:00:00) of the target date. When comparing against `now`, if `now` is later than midnight of the booking date, `hoursUntilBooking` becomes **negative**, which is always less than `minBookingHours` (2 hours), causing an early return with empty slots.

**Example:**
- User is viewing Dec 21 (Sunday)
- Server time: Dec 17, 15:00:00 (Wednesday 3 PM)
- `bookingDate` = Dec 21, 00:00:00 (midnight)
- `hoursUntilBooking` = 81 hours (should work)

But if there's a **timezone mismatch**:
- Server is in UTC, user is in UTC+8
- `date` parameter might be "2025-12-21" but parsed differently

**Possible timezone issue in date parsing:**
```typescript
const bookingDate = new Date(date); // "2025-12-21" might become Dec 20 23:00 UTC
```

### Issue 3: Shop-Wide Hours (By Design)

**File:** `frontend/src/components/shop/service/ServiceAvailabilitySettings.tsx`

The UI shows a yellow info box stating:
> "Shop-Wide Hours: These are your shop's overall operating hours. All services will follow these hours. Changes here affect all your services."

This is **intentional behavior** - the `shop_availability` table stores shop-level availability, not service-level. However, the UX may be confusing because:
- The settings appear under each service's Availability tab
- Users may expect to configure per-service hours

---

## Screenshots Evidence

| Screenshot | Date | Day | Expected | Actual |
|------------|------|-----|----------|--------|
| Screenshot_4 | Dec 17 | Wed | Slots (Open) | No green dot |
| Screenshot_5 | Dec 18 | Thu | Slots (Open) | No green dot |
| Screenshot_6 | Dec 19 | Fri | Slots (Open) | ✅ Has slots |
| Screenshot_7 | Dec 20 | Sat | Slots (Open) | ✅ Has slots |
| Screenshot_8 | Dec 21 | Sun | Slots (Open+Weekend) | ❌ No slots |
| Screenshot_9 | Dec 22 | Mon | Slots (Open) | ✅ Has slots |
| Screenshot_10 | Dec 23 | Tue | Slots (Open) | ✅ Has slots |
| Screenshot_11 | Dec 24 | Wed | Slots (Open) | ✅ Has slots |
| Screenshot_13 | Dec 28 | Sun | Slots (Open+Weekend) | ❌ No slots |

---

## Acceptance Criteria

- [ ] Sunday shows time slots when configured as Open AND weekend bookings enabled
- [ ] All days configured as Open show consistent availability
- [ ] Time slot calculation handles timezone correctly
- [ ] Per-service availability OR clear shop-wide indicator in UI
- [ ] Add logging to diagnose slot generation failures

---

## Technical Fix Recommendations

### Fix 1: Timezone-safe date parsing

```typescript
// Instead of:
const bookingDate = new Date(date);

// Use:
const [year, month, day] = date.split('-').map(Number);
const bookingDate = new Date(year, month - 1, day, 0, 0, 0);
```

### Fix 2: Improve early return logging

```typescript
if (hoursUntilBooking < config.minBookingHours) {
  logger.info('No slots: too soon to book', {
    date,
    hoursUntilBooking,
    minBookingHours: config.minBookingHours,
    now: now.toISOString(),
    bookingDate: bookingDate.toISOString()
  });
  return [];
}
```

### Fix 3: Fix the hoursUntilBooking check for same-day

The current logic blocks ALL slots for a date if the date itself is within minBookingHours. It should instead check each individual slot time:

```typescript
// Remove the early return at line 69-70
// The per-slot check at lines 115-126 already handles this correctly
```

### Fix 4: UI clarity for shop-wide settings

Move Shop Operating Hours to a dedicated shop settings page, not under each service's Availability tab. Or add a more prominent warning that changes affect all services.

---

## Related Files

| File | Issue |
|------|-------|
| `backend/src/domains/ServiceDomain/services/AppointmentService.ts` | Time calculation, early return logic |
| `backend/src/repositories/AppointmentRepository.ts` | Shop availability queries |
| `frontend/src/components/shop/service/ServiceAvailabilitySettings.tsx` | UI for availability settings |
| `frontend/src/components/customer/TimeSlotPicker.tsx` | Customer booking calendar |

---

## Additional Notes

- The `allowWeekendBooking` flag is checked at line 36-38, but this appears to be working (Saturday shows slots)
- The issue may be specific to Sunday (dayOfWeek=0) due to JavaScript Date quirks
- Database should be checked to verify Sunday (dayOfWeek=0) exists in shop_availability table
