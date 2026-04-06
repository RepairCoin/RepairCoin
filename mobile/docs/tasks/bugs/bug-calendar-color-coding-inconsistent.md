# Bug: Calendar Color Coding Inconsistent Between Views

## Status: Open
## Priority: Medium
## Date: 2026-04-06
## Category: Bug - UI Inconsistency
## Affected: Shop booking/appointment calendars (mobile)

---

## Overview

The mobile app has two calendar views (basic weekly in Booking tab, full monthly in Appointment tab) that use different color mappings for the same booking statuses. Additionally, both legends display incorrect colors — the legend says "Approved = blue" but the actual dot renders as green/emerald. The web calendar uses a third set of colors entirely.

---

## Color Mapping Comparison

| Status | Booking Basic Calendar | Appointment Full Calendar | Web Calendar |
|---|---|---|---|
| **pending** | `#FFCC00` (yellow) | Not shown | `#FBBF24` (yellow) |
| **paid** | `#FFCC00` (yellow) | `#3b82f6` (blue) | `#60A5FA` (blue) |
| **approved** | `#10b981` (emerald) via wrapper | `#10b981` (emerald) | N/A |
| **in_progress** | `#22c55e` (green) | `#10b981` (emerald) | `#A78BFA` (purple) |
| **completed** | `#22c55e` (green) | `#22c55e` (green) | `#4ADE80` (green) |
| **cancelled** | `#ef4444` (red) | `#ef4444` (red) | `#F87171` (red) |
| **expired** | `#f97316` (orange) | `#f97316` (orange) | N/A |

---

## Specific Issues

### 1. Legend Does Not Match Actual Dot Colors

Both calendars show the same incorrect legend:

**Legend says:**
- Approved: `#3b82f6` (blue)
- Completed: `#22c55e` (green)
- Cancelled: `#ef4444` (red)

**Actual dots render:**
- Approved: `#10b981` (emerald) — NOT blue
- Completed: `#22c55e` (green) — correct
- Cancelled: `#ef4444` (red) — correct

**Files:**
- Booking tab legend: `mobile/feature/booking/components/BookingShopTab.tsx:209-227`
- Full calendar legend: `mobile/feature/appointment/components/MonthlyCalendarView.tsx:195-214`

### 2. "Paid" Status Shows Different Colors

- **Booking basic calendar**: `#FFCC00` (yellow) — via `booking/utils/statusUtils.ts`
- **Full calendar**: `#3b82f6` (blue) — via `appointment/utils/statusUtils.ts`

Same booking appears yellow in one view and blue in the other.

**Files:**
- `mobile/feature/booking/utils/statusUtils.ts` — paid = `#FFCC00`
- `mobile/feature/appointment/utils/statusUtils.ts` — paid = `#3b82f6`

### 3. Two Separate Status Color Utilities

The app has **two different `statusUtils.ts` files** with conflicting mappings:

**`mobile/feature/booking/utils/statusUtils.ts`:**
```
paid: #FFCC00, approved: #22c55e, in_progress: #22c55e
```

**`mobile/feature/appointment/utils/statusUtils.ts`:**
```
paid: #3b82f6, approved: #10b981, in_progress: #10b981
```

### 4. Booking Basic Calendar Uses Wrapper That Adds More Confusion

`BookingShopTab.tsx` lines 34-42 has `getDisplayStatusColor()` that overrides the util:
- If `status === "paid" && shopApproved` → returns `#10b981` (emerald)
- Otherwise delegates to `getStatusColor()` → paid = `#FFCC00` (yellow)

This means "paid + approved" shows emerald but "paid + not approved" shows yellow — a subtle distinction users can't understand from the legend.

### 5. Legend Missing Statuses

Both legends only show 3 statuses (Approved, Completed, Cancelled) but the calendars can display 6+ statuses: pending, paid, approved, in_progress, completed, cancelled, expired.

---

## Recommended Fix

### Step 1: Create a single shared color mapping

Create one source of truth in `mobile/shared/constants/` or `mobile/shared/utilities/`:

```typescript
// mobile/shared/constants/booking-colors.ts
export const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending:      "#FFCC00",  // Yellow
  paid:         "#3b82f6",  // Blue (matches web)
  approved:     "#3b82f6",  // Blue (paid+approved, matches web "confirmed")
  scheduled:    "#3b82f6",  // Blue
  in_progress:  "#a855f7",  // Purple (matches web)
  completed:    "#22c55e",  // Green
  cancelled:    "#ef4444",  // Red
  expired:      "#6b7280",  // Gray
  no_show:      "#f97316",  // Orange
};
```

### Step 2: Use it in both calendars

Replace imports in both files:
- `mobile/feature/booking/components/BookingShopTab.tsx`
- `mobile/feature/appointment/components/MonthlyCalendarView.tsx`

Remove `getDisplayStatusColor()` wrapper — use the shared mapping directly.

### Step 3: Fix legends to match

Update both legends to show all relevant statuses with correct colors from the shared mapping.

### Step 4: Align with web where possible

Use similar color families as web to reduce cross-platform confusion:
- Paid/Confirmed = Blue (both platforms)
- In-progress = Purple (both platforms)
- Completed = Green (both platforms)
- Cancelled = Red (both platforms)

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/shared/constants/booking-colors.ts` | Create — single source of truth for status colors |
| `mobile/feature/booking/utils/statusUtils.ts` | Update to use shared colors |
| `mobile/feature/appointment/utils/statusUtils.ts` | Update to use shared colors |
| `mobile/feature/booking/components/BookingShopTab.tsx:34-42` | Remove `getDisplayStatusColor` wrapper |
| `mobile/feature/booking/components/BookingShopTab.tsx:209-227` | Fix legend to match actual colors |
| `mobile/feature/appointment/components/MonthlyCalendarView.tsx:195-214` | Fix legend to match actual colors |

---

## QA Test Plan

### Color consistency
1. Create bookings in various statuses (pending, paid, approved, completed, cancelled)
2. Open Booking tab → check basic calendar dot colors
3. Open Full Calendar → check monthly calendar dot colors
4. **Verify**: Same booking shows same color in both views
5. **Verify**: Legend matches actual dot colors

### Cross-platform
1. View the same date with bookings on web and mobile
2. **Verify**: Color families are similar (blue = paid/confirmed, green = completed, red = cancelled)

### Legend completeness
1. Have bookings in all statuses on the same week
2. **Verify**: Legend shows all status types that appear as dots
