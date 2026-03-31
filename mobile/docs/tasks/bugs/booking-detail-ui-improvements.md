# Bug: Booking Detail Screen UI Improvements

**Status:** In Progress
**Priority:** Medium
**Est. Effort:** 1-2 hrs
**Created:** 2026-03-30
**Updated:** 2026-03-31

## Problem / Goal

Two UI issues on the booking detail screen:
1. The shop/customer card header only shows "SHOP" or "CUSTOMER" — should show "SHOP INFORMATION" or "CUSTOMER INFORMATION"
2. In all info rows (date, time, status, address), icons don't align to the top when text wraps to multiple lines

## Implementation

### 1. Section Header Text
- File: `feature/booking/screens/BookingDetailScreen.tsx`
- Change "Customer" → "Customer Information" and "Shop" → "Shop Information"

### 2. Icon Alignment (InfoRow + Status Row)
- File: `feature/booking/components/InfoRow.tsx`
  - Change `items-center` → `items-start` on the row container
  - Add `mt-0.5` to icon wrapper to align with first line of text
- File: `feature/booking/screens/BookingDetailScreen.tsx`
  - Same fix for the inline Status row (not using InfoRow component)

## Verification Checklist

- [x] Shop header shows "SHOP INFORMATION" (customer view)
- [x] Customer header shows "CUSTOMER INFORMATION" (shop view)
- [ ] InfoRow icons align to top when value text wraps
- [ ] Status row icon aligns to top
- [ ] No visual regression on other booking detail sections

## Notes

- Header text fix applied, but InfoRow and Status row alignment keeps getting reverted by editor/linter
- Changes needed in InfoRow.tsx: `items-center` → `items-start`, add `mt-0.5` to icon View
- Changes needed in BookingDetailScreen.tsx Status row: same alignment fix
