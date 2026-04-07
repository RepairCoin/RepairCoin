# Bug: Reschedule Requests Screen Exists But Has No Navigation Entry Point

## Status: Open
## Priority: Medium
## Date: 2026-04-07
## Category: Bug - Navigation / UX
## Affected: Shop reschedule request management (mobile only)

---

## Overview

The shop reschedule requests screen is fully built and functional (`RescheduleRequestsScreen.tsx`) with filtering, approve/reject actions, and pending count badge. However, there is no button, tab, or link anywhere in the shop UI to navigate to it. The screen is an orphaned route at `/shop/reschedule-requests` — shops have no way to discover or access it.

The web app has a dedicated "Reschedule Requests" tab in the shop's booking management area.

---

## What Exists (Fully Implemented)

| Component | File | Status |
|---|---|---|
| Screen | `mobile/feature/booking/screens/RescheduleRequestsScreen.tsx` | Built |
| Route | `mobile/app/(dashboard)/shop/reschedule-requests/index.tsx` | Registered |
| Request cards | `mobile/feature/booking/components/RescheduleRequestCard.tsx` | Built |
| Query hook | `mobile/feature/booking/hooks/queries/useRescheduleRequests.ts` | Built |
| Count hook | `useRescheduleRequestCountQuery()` | Built |
| Approve mutation | `useApproveRescheduleRequestMutation()` | Built |
| Reject mutation | `useRejectRescheduleRequestMutation()` | Built |
| API methods | `appointment.services.ts` — getShopRescheduleRequests, approve, reject | Built |

## What's Missing

**No navigation link from any shop screen to `/shop/reschedule-requests`.**

Checked locations with no reference:
- `BookingShopTab.tsx` — no reschedule link
- Shop tabs layout — no reschedule tab
- Shop sidebar/menu — no reschedule entry
- Booking list header — no reschedule badge/button

---

## Web Reference

The web app shows reschedule requests as a tab within the shop's appointment management:
- `frontend/src/components/shop/tabs/RescheduleRequestsTab.tsx`
- Accessible from the shop sidebar under "Appointments"
- Shows pending count badge

---

## Fix Required

Add a navigation entry point to the reschedule requests screen. Options:

### Option A: Badge button in Bookings tab header (recommended)

Add a bell/calendar icon with pending count badge in the Bookings tab header bar:

```tsx
// In BookingShopTab.tsx or the Bookings tab header
const { data: pendingCount } = useRescheduleRequestCountQuery();

<TouchableOpacity onPress={() => router.push('/shop/reschedule-requests')}>
  <Feather name="repeat" size={22} color="#FFCC00" />
  {pendingCount > 0 && (
    <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-4 h-4 items-center justify-center">
      <Text className="text-white text-[10px] font-bold">{pendingCount}</Text>
    </View>
  )}
</TouchableOpacity>
```

### Option B: Section in Bookings list view

Add a "Pending Reschedule Requests" banner at the top of the bookings list when there are pending requests.

### Option C: Separate tab in Bookings

Add "Reschedule" as a filter tab alongside All, Approved, Completed, Cancelled, Expired.

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/booking/components/BookingShopTab.tsx` | Add reschedule requests button with badge in header |

---

## QA Test Plan

### After fix
1. Login as shop
2. Have a customer submit a reschedule request
3. Go to Bookings tab
4. **Expected**: See a reschedule icon/button with pending count badge
5. Tap it → navigates to Reschedule Requests screen
6. **Expected**: See the pending request with Approve/Reject buttons
7. Approve or reject → returns updated status
8. Badge count updates accordingly
