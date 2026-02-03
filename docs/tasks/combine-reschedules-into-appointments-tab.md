# Task: Combine Reschedules Tab into Appointments Tab

## Status: Complete
## Priority: Medium
## Date: February 3, 2026

## Description

Removed "Reschedules" as a separate sidebar menu item and embedded it as a sub-tab inside the "Appointments" tab, matching the pattern used by the "Tools" tab (Issue Rewards / Redeem / Promo Codes).

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/components/ui/sidebar/ShopSidebar.tsx` | Removed "Reschedules" menu item and unused `RefreshCw` import |
| `frontend/src/components/shop/tabs/AppointmentsTab.tsx` | Added sub-tab navigation (Appointments / Reschedules), imported `RescheduleRequestsTab`, added `defaultSubTab` prop |
| `frontend/src/components/shop/ShopDashboardClient.tsx` | Changed standalone `reschedules` tab to render `AppointmentsTab` with `defaultSubTab="reschedules"` for backwards compatibility |

## Backwards Compatibility

- `/shop?tab=reschedules` still works — opens Appointments tab with Reschedules sub-tab pre-selected
- `/shop?tab=appointments` opens with calendar view as default
- `RescheduleRequestsTab` component unchanged — all approve/reject/filter functionality preserved

## Strategy & Rollback

See `docs/tasks/strategry/strategy-combine-reschedules-into-appointments.md`
