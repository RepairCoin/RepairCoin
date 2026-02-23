# Task: Reschedule Pending Badge & Auto-Expiration

## Status: ✅ COMPLETED
**Date:** February 16, 2026
**Developer:** Deo
**Branch:** deo/dev

---

## Summary

Added visual badges to notify shops of pending reschedule requests and implemented automatic expiration of unanswered requests after 48 hours.

---

## Features Implemented

### 1. Reschedule Pending Badge (Frontend)

**Problem:** Shops had no visual indicator that reschedule requests were waiting for approval.

**Solution:** Added badge indicators showing pending count in two locations:

| Location | Badge Behavior |
|----------|----------------|
| Sidebar → Appointments | Red badge when count > 0, hidden when 0 |
| Sub-tab → Reschedules | Red badge when count > 0, gray "0" when empty |

**Files Modified:**
- `frontend/src/components/shop/tabs/AppointmentsTab.tsx`
- `frontend/src/components/ui/sidebar/ShopSidebar.tsx`
- `frontend/src/components/ui/sidebar/BaseSidebar.tsx`
- `frontend/src/components/ui/sidebar/useSidebar.ts`

---

### 2. Auto-Expiration Service (Backend)

**Problem:** Reschedule requests stayed "pending" indefinitely if shops didn't respond. The expiration code existed but was never scheduled to run.

**Solution:** Created scheduled service that:
- Runs every **1 hour**
- Finds pending requests where `expires_at < NOW()`
- Updates status to `'expired'`
- Emits `reschedule:request_expired` event
- Sends notification to customer

**Files Created/Modified:**
- `backend/src/services/RescheduleExpirationService.ts` (NEW)
- `backend/src/repositories/RescheduleRepository.ts`
- `backend/src/domains/ServiceDomain/services/RescheduleService.ts`
- `backend/src/domains/notification/NotificationDomain.ts`
- `backend/src/app.ts`

---

## Technical Details

### Expiration Flow
```
Scheduled Job (every 1 hour)
    ↓
RescheduleExpirationService.runExpirationCheck()
    ↓
RescheduleService.expireOldRequests()
    ↓
RescheduleRepository.expireOldRequests()
    → SELECT expired requests with details
    → UPDATE status = 'expired'
    → RETURN list of expired requests
    ↓
For each expired request:
    → Emit 'reschedule:request_expired' event
    ↓
NotificationDomain.handleRescheduleRequestExpired()
    → Create notification for customer
    → Send via WebSocket (real-time)
```

### Customer Notification Message
> "Your reschedule request for {serviceName} at {shopName} has expired. Please submit a new request if needed."

### Default Configuration
- **Expiration time:** 48 hours (configurable per shop)
- **Check frequency:** Every 1 hour
- **Original booking:** Unchanged after expiration

---

## Testing

### Test Script
```bash
cd backend
npx ts-node scripts/test-reschedule-expiration.ts
```

### Test Results
- ✅ Creates expired test request
- ✅ Expiration service finds and updates it
- ✅ Status changes to 'expired'
- ✅ Event emitted correctly
- ✅ Notifications sent in production server

---

## Acceptance Criteria

- [x] Red badge appears on "Appointments" sidebar when pending count > 0
- [x] Red badge appears on "Reschedules" tab when pending count > 0
- [x] Gray "0" badge shows on "Reschedules" tab when no pending requests
- [x] Badges auto-refresh every 30 seconds
- [x] Expired requests automatically marked after 48 hours
- [x] Customer receives notification when request expires
- [x] Original booking unchanged after expiration
- [x] Backend compiles without errors
- [x] Test script passes

---

## Screenshots

### Before (No Badge)
```
SERVICE
├── Services
├── Bookings
├── Analytics
└── Appointments        ← No indicator
```

### After (With Badge)
```
SERVICE
├── Services
├── Bookings
├── Analytics
└── Appointments (2)    ← Red badge shows pending count
      ├── Appointments
      └── Reschedules (2)  ← Also shows in sub-tab
```

---

## Related Files

- Strategy Doc: `docs/tasks/strategry/reschedule-pending-badge.md`
- Test Script: `backend/scripts/test-reschedule-expiration.ts`

---

## Notes

- Badge count fetched via existing API: `GET /api/services/appointments/reschedule-requests/count`
- Expiration service initialized on server startup
- Graceful shutdown stops the service
- No database migrations required (used existing schema)
