# Bug: Shop Availability Missing Validation

## Status: Open
## Priority: Medium
## Date: 2026-03-24
## Category: Bug - Validation
## Found by: E2E testing (`backend/tests/shop/shop.appointments.test.ts`)

---

## Problem

The `PUT /api/services/appointments/shop-availability` endpoint accepts invalid values for day of week and allows close time before open time.

### Bug 1: Day of week out of range

Setting `dayOfWeek: -1` or `dayOfWeek: 7` returns **200 OK** instead of **400 Bad Request**.

```json
// Request
PUT /api/services/appointments/shop-availability
{ "dayOfWeek": 7, "isOpen": true, "openTime": "09:00", "closeTime": "17:00" }

// Expected: 400 "Day of week must be between 0 (Sunday) and 6 (Saturday)"
// Actual: 200 OK (invalid data saved)
```

### Bug 2: Close time before open time

Setting `openTime: '17:00', closeTime: '09:00'` returns **200 OK** instead of **400 Bad Request**.

```json
// Request
PUT /api/services/appointments/shop-availability
{ "dayOfWeek": 1, "isOpen": true, "openTime": "17:00", "closeTime": "09:00" }

// Expected: 400 "Close time must be after open time"
// Actual: 200 OK (invalid hours saved)
```

---

## What works correctly

Time slot config validation is solid:
- Slot duration 0 or 999 → 400 ✅
- Negative buffer → 400 ✅
- Concurrent bookings 0 or 100 → 400 ✅
- Advance days 0 or 999 → 400 ✅
- Invalid time format (25:00) → 400 ✅

---

## Fix

Add validation in the shop availability update handler:

```typescript
// Validate day of week
if (dayOfWeek < 0 || dayOfWeek > 6) {
  return res.status(400).json({
    success: false,
    error: 'Day of week must be between 0 (Sunday) and 6 (Saturday)'
  });
}

// Validate close time is after open time (when open)
if (isOpen && openTime && closeTime && openTime >= closeTime) {
  return res.status(400).json({
    success: false,
    error: 'Close time must be after open time'
  });
}
```

---

## Files to check

- `backend/src/domains/ServiceDomain/controllers/AppointmentController.ts` — availability update handler
- `backend/src/domains/ServiceDomain/routes.ts` — route for `PUT /api/services/appointments/shop-availability`

---

## Verification

- [ ] `dayOfWeek: -1` → 400
- [ ] `dayOfWeek: 7` → 400
- [ ] `dayOfWeek: 0` through `6` → 200 (valid)
- [ ] `openTime > closeTime` → 400
- [ ] `openTime < closeTime` → 200 (valid)
- [ ] `isOpen: false` without times → 200 (valid, times not needed)
