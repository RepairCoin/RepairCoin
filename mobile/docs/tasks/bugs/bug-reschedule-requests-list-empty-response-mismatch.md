# Bug: Reschedule Requests Not Listed — Response Structure Mismatch

## Status: Open
## Priority: High
## Date: 2026-04-10
## Category: Bug - Response Structure Mismatch
## Affected: Shop Reschedule Requests screen (mobile)

---

## Overview

The shop's Reschedule Requests screen on mobile shows empty list even though pending requests exist in the database and display correctly on web. The requests are created successfully by customers but the mobile can't read them due to a response field mismatch.

---

## Root Cause

**Backend returns** (`AppointmentController.ts` lines 775-781):
```json
{
  "success": true,
  "data": {
    "requests": [ { ... } ],
    "pendingCount": 1
  }
}
```

**Mobile reads** (`appointment.services.ts` line 270):
```typescript
const response = await apiClient.get('/services/appointments/reschedule-requests...');
return response.data || [];  // response.data = { requests: [...], pendingCount: 1 }
```

After `apiClient.get` unwraps `response.data`, the result is `{ success: true, data: { requests: [...], pendingCount: 1 } }`. So `response.data` is an **object** `{ requests, pendingCount }`, not an array. The mobile returns this object, then the query/component tries to map it as an array — it fails silently and renders empty.

---

## Fix Required

**File:** `mobile/shared/services/appointment.services.ts` line 270

Change:
```typescript
return response.data || [];
```

To:
```typescript
return response.data?.requests || response.data || [];
```

---

## File to Modify

| File | Change |
|------|--------|
| `mobile/shared/services/appointment.services.ts:270` | Read `response.data.requests` instead of `response.data` |

---

## QA Test Plan

1. Customer submits a reschedule request on a booking
2. Login as shop on mobile → navigate to Reschedule Requests
3. **Before fix**: Empty list, no pending requests shown
4. **After fix**: Pending request appears with customer name, dates, approve/reject buttons
5. Verify pending count badge also shows correctly
