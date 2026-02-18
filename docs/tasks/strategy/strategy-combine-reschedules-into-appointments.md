# Strategy: Combine Reschedules Tab into Appointments Tab

## Status: Implemented
## Priority: Medium
## Date: February 3, 2026

## Goal

Remove "Reschedules" as a separate sidebar menu item and embed it as a sub-tab inside the "Appointments" tab, similar to how the "Tools" tab has sub-tabs (Issue Rewards / Redeem / Promo Codes).

## Current State (Before)

```
Sidebar (SERVICE section):
  - Services
  - Bookings
  - Analytics
  - Appointments    → /shop?tab=appointments   (calendar view)
  - Reschedules     → /shop?tab=reschedules    (reschedule requests list)
```

## Target State (After)

```
Sidebar (SERVICE section):
  - Services
  - Bookings
  - Analytics
  - Appointments    → /shop?tab=appointments

Inside Appointments tab:
  ┌──────────────────────────────────────────────┐
  │  📅 Appointments    🔄 Reschedules           │  ← sub-tabs
  │  ─────────────────────────────────────────── │
  │                                              │
  │  [Calendar / Reschedule Requests content]    │
  │                                              │
  └──────────────────────────────────────────────┘
```

## Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `frontend/src/components/ui/sidebar/ShopSidebar.tsx` | Removed "Reschedules" menu item and unused `RefreshCw` import |
| 2 | `frontend/src/components/shop/tabs/AppointmentsTab.tsx` | Added sub-tab navigation (Appointments / Reschedules), imported `RescheduleRequestsTab`, added `defaultSubTab` prop |
| 3 | `frontend/src/components/shop/ShopDashboardClient.tsx` | Changed standalone `reschedules` tab to render `AppointmentsTab` with `defaultSubTab="reschedules"` for backwards compatibility |

## Backwards Compatibility

- `/shop?tab=reschedules` still works — renders `AppointmentsTab` with the Reschedules sub-tab pre-selected
- `/shop?tab=appointments` renders with the Appointments sub-tab (calendar) as default
- `RescheduleRequestsTab` component is unchanged — all approve/reject/filter functionality preserved

## Rollback Plan

If issues arise, revert the 3 files to their previous state:

1. **Restore sidebar item**: Re-add the "Reschedules" entry in `ShopSidebar.tsx`
2. **Restore AppointmentsTab**: Remove sub-tab logic, revert to calendar-only view
3. **Restore ShopDashboardClient**: Re-add the standalone `reschedules` tab rendering block

Since no backend or database changes are involved, rollback is a clean frontend-only revert:

```bash
git checkout HEAD -- \
  frontend/src/components/ui/sidebar/ShopSidebar.tsx \
  frontend/src/components/shop/tabs/AppointmentsTab.tsx \
  frontend/src/components/shop/ShopDashboardClient.tsx
```

## End-to-End Testing Checklist

### 1. Sidebar Navigation
- [ ] "Reschedules" no longer appears in the sidebar
- [ ] "Appointments" still appears in the sidebar under SERVICE section
- [ ] Clicking "Appointments" navigates to `/shop?tab=appointments`

### 2. Appointments Sub-tab (Calendar)
- [ ] Sub-tab bar shows "Appointments" and "Reschedules" buttons
- [ ] "Appointments" sub-tab is active by default
- [ ] Calendar view renders correctly with month navigation
- [ ] Stats cards (Pending, Confirmed, Completed, Cancelled, No Show) display
- [ ] Sidebar shows upcoming appointments
- [ ] Clicking a date with bookings shows that date's appointments
- [ ] Clicking a booking card navigates to bookings tab with search

### 3. Reschedules Sub-tab
- [ ] Clicking "Reschedules" sub-tab switches to reschedule requests view
- [ ] Header shows "Reschedule Requests" with pending count badge
- [ ] Filter buttons work (Pending, Approved, Rejected, Expired, Cancelled, All)
- [ ] Request cards display correctly with original vs requested time
- [ ] Approve button works with confirmation dialog
- [ ] Reject button opens modal with optional reason input
- [ ] Reject submission works
- [ ] Switching back to "Appointments" sub-tab returns to calendar view

### 4. Backwards Compatibility
- [ ] Direct URL `/shop?tab=reschedules` opens Appointments tab with Reschedules sub-tab pre-selected
- [ ] Direct URL `/shop?tab=appointments` opens with calendar view (Appointments sub-tab)

### 5. Subscription Guard
- [ ] SubscriptionGuard overlay appears for paused/expired/pending shops on both sub-tabs
- [ ] Blocked shops see the appropriate warning message

## Risk Assessment

- **Risk**: Low — frontend-only change, no API or database modifications
- **Impact**: Shop owners access reschedules from within Appointments tab instead of sidebar
- **Backwards compatibility**: `/shop?tab=reschedules` URL still works via `defaultSubTab` prop
