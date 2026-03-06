# Booking Settings — Save Configuration Fails with Toast Error

## Overview

Clicking "Save Configuration" on the Booking Settings section (`/shop/services/{serviceId}?tab=availability`) fails with a toast error "Failed to update time slot configuration" and a console error. The GET request to load the configuration works, but the PUT request to save it fails.

Additionally, several code bugs in the save handler cause silent data corruption even when the save does succeed.

**Created**: March 2, 2026
**Status**: Open
**Priority**: High
**Category**: Bug / Data Integrity

---

## Problem Statement

### Primary Issue: Save fails with error

The "Save Configuration" button triggers `handleSaveTimeSlotConfig()` which calls `PUT /api/services/appointments/time-slot-config`. The request fails, producing:
- **Toast**: "Failed to update time slot configuration"
- **Console**: `Error updating time slot config: [error object]`

The GET request to load the same config works fine, confirming auth, CORS, and basic connectivity are not the issue.

### Secondary Issue: Silent data corruption on save

Even when the save succeeds, the payload has bugs that silently overwrite data.

---

## Affected Files

| File | Role |
|---|---|
| `frontend/src/components/shop/service/ServiceAvailabilitySettings.tsx` | Frontend component (save handler + inputs) |
| `frontend/src/services/api/appointments.ts` | API client function |
| `backend/src/domains/ServiceDomain/controllers/AppointmentController.ts` | Backend controller + validation |
| `backend/src/repositories/AppointmentRepository.ts` | Database UPSERT query |

---

## Bug 1: `slotDurationMinutes` Overwritten on Every Save

**Severity**: High (data loss)

The save handler at `ServiceAvailabilitySettings.tsx:141-147` does NOT include `slotDurationMinutes` in the payload:

```tsx
await appointmentsApi.updateTimeSlotConfig({
  bufferTimeMinutes: timeSlotConfig?.bufferTimeMinutes || 15,
  maxConcurrentBookings: timeSlotConfig?.maxConcurrentBookings || 1,
  bookingAdvanceDays: timeSlotConfig?.bookingAdvanceDays || 30,
  minBookingHours: timeSlotConfig?.minBookingHours || 2,
  allowWeekendBooking: timeSlotConfig?.allowWeekendBooking ?? true
  // slotDurationMinutes is MISSING
});
```

The backend repository at `AppointmentRepository.ts:214` defaults it:
```typescript
config.slotDurationMinutes ?? 60,
```

**Impact**: If a shop set `slotDurationMinutes` to 30 (or any non-60 value), every "Save Configuration" click silently resets it to 60.

**Fix**: Include `slotDurationMinutes` in the save payload:
```tsx
await appointmentsApi.updateTimeSlotConfig({
  slotDurationMinutes: timeSlotConfig?.slotDurationMinutes ?? 60,
  bufferTimeMinutes: ...
});
```

---

## Bug 2: `||` Operator Treats Zero as Falsy

**Severity**: Medium (unexpected behavior)

The save handler uses `||` instead of `??` for numeric defaults:

```tsx
// Line 142-145
bufferTimeMinutes: timeSlotConfig?.bufferTimeMinutes || 15,   // 0 becomes 15
maxConcurrentBookings: timeSlotConfig?.maxConcurrentBookings || 1, // 0 becomes 1
bookingAdvanceDays: timeSlotConfig?.bookingAdvanceDays || 30,  // 0 becomes 30
minBookingHours: timeSlotConfig?.minBookingHours || 2,         // 0 becomes 2
```

The `||` operator treats `0` as falsy. Setting "Buffer Time" to `0` minutes (valid — means no buffer) would silently save as `15`.

**Impact**: Setting `minBookingHours` to `0` (allow last-minute bookings) silently saves as `2`. Setting `bufferTimeMinutes` to `0` (no buffer) silently saves as `15`.

**Fix**: Use nullish coalescing `??`:
```tsx
bufferTimeMinutes: timeSlotConfig?.bufferTimeMinutes ?? 15,
maxConcurrentBookings: timeSlotConfig?.maxConcurrentBookings ?? 1,
bookingAdvanceDays: timeSlotConfig?.bookingAdvanceDays ?? 30,
minBookingHours: timeSlotConfig?.minBookingHours ?? 2,
```

---

## Bug 3: Display Default Mismatch

**Severity**: Low (confusing UX)

The input `value` attributes use different defaults than the save handler:

| Field | Input Display Default | Save Default |
|---|---|---|
| `bufferTimeMinutes` | `\|\| 30` (line 302) | `\|\| 15` (line 142) |
| `maxConcurrentBookings` | `\|\| 1` (line 324) | `\|\| 1` (line 143) |
| `bookingAdvanceDays` | `\|\| 30` (line 345) | `\|\| 30` (line 144) |
| `minBookingHours` | `\|\| 2` (line 366) | `\|\| 2` (line 145) |

**Impact**: If `bufferTimeMinutes` is somehow falsy, the user sees `30` in the input but saves `15`.

**Fix**: Align all defaults to the same values, preferably using `??`.

---

## Bug 4: `timezone` Not Sent in Payload

**Severity**: Low

Similar to `slotDurationMinutes`, the `timezone` field is not included in the save payload. The backend defaults to `'America/New_York'` at `AppointmentRepository.ts:220`:
```typescript
config.timezone ?? 'America/New_York'
```

**Impact**: If a shop configured a different timezone, saving booking settings resets it to Eastern Time.

**Fix**: Include `timezone` in the payload:
```tsx
timezone: timeSlotConfig?.timezone ?? 'America/New_York',
```

---

## Bug 5: Missing UNIQUE Constraint on `shop_id` (Root Cause of Save Failure)

**Severity**: Critical (blocks save entirely)

**Confirmed Error**: `PostgreSQL error 42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification`

The UPSERT query at `AppointmentRepository.ts:182-210` uses `ON CONFLICT (shop_id)`, which requires a UNIQUE constraint on `shop_id`. The migration 008 defined `shop_id VARCHAR(255) NOT NULL UNIQUE`, but the actual database was missing the UNIQUE constraint — it only had a non-unique index.

**Fix Applied**: Migration `070_fix_time_slot_config_unique_constraint.sql` adds the missing UNIQUE constraint:
```sql
ALTER TABLE shop_time_slot_config
ADD CONSTRAINT shop_time_slot_config_shop_id_unique UNIQUE (shop_id);
```

## Bug 6: Backend Controller Doesn't Pass `timezone` to Repository

**Severity**: Low (timezone always resets to default)

The controller destructures fields from `req.body` but omits `timezone`. Even when the frontend sends it, the controller ignores it.

**Fix Applied**: Added `timezone` to the destructuring and repository call in `AppointmentController.ts`.

---

## Recommended Fix

```tsx
// ServiceAvailabilitySettings.tsx - handleSaveTimeSlotConfig
const handleSaveTimeSlotConfig = async () => {
  try {
    setSaving(true);
    await appointmentsApi.updateTimeSlotConfig({
      slotDurationMinutes: timeSlotConfig?.slotDurationMinutes ?? 60,
      bufferTimeMinutes: timeSlotConfig?.bufferTimeMinutes ?? 15,
      maxConcurrentBookings: timeSlotConfig?.maxConcurrentBookings ?? 1,
      bookingAdvanceDays: timeSlotConfig?.bookingAdvanceDays ?? 30,
      minBookingHours: timeSlotConfig?.minBookingHours ?? 2,
      allowWeekendBooking: timeSlotConfig?.allowWeekendBooking ?? true,
      timezone: timeSlotConfig?.timezone ?? 'America/New_York',
    });
    // ... success handling
  } catch (error: any) {
    console.error('Error updating time slot config:', error);
    // Show the actual backend error if available
    const message = error?.message || 'Failed to update time slot configuration';
    toast.error(message);
  } finally {
    setSaving(false);
  }
};
```

Also align input display defaults to use `??` with the same values.

---

## Verification Checklist

- [ ] "Save Configuration" succeeds without toast error
- [ ] `slotDurationMinutes` is preserved after saving booking settings
- [ ] `timezone` is preserved after saving booking settings
- [ ] Setting `bufferTimeMinutes` to 0 saves correctly (not silently changed to 15)
- [ ] Setting `minBookingHours` to 0 saves correctly (not silently changed to 2)
- [ ] Input display defaults match save defaults
- [ ] Check staging backend logs for the specific database error
- [ ] Verify migration `056_add_shop_timezone.sql` has been run on staging

---

## References

- **Frontend save handler**: `frontend/src/components/shop/service/ServiceAvailabilitySettings.tsx:138-158`
- **API function**: `frontend/src/services/api/appointments.ts:210-216`
- **Backend controller**: `backend/src/domains/ServiceDomain/controllers/AppointmentController.ts:180-267`
- **Repository UPSERT**: `backend/src/repositories/AppointmentRepository.ts:180-228`
- **Timezone migration**: `backend/migrations/056_add_shop_timezone.sql`
