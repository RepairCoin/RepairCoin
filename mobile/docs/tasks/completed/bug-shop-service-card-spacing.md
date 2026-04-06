# Bug: Improper spacing on shop profile service cards

**Status:** Completed
**Priority:** Low
**Est. Effort:** 30 min
**Created:** 2026-03-30
**Updated:** 2026-03-31
**Completed:** 2026-03-31

## Problem / Goal

Service cards on the shop profile (viewed from customer side) have inconsistent or incorrect spacing. Cards appear too close together or have uneven padding/margins.

**Steps to reproduce:**
1. Login as customer
2. Go to Service tab
3. Click any service item
4. Click "View Shop" to open the shop profile
5. Click the Services tab
6. Cards have improper spacing

## Implementation

1. Check the service card list component in the shop profile screen (customer view)
2. Fix card margins, padding, and gap between cards
3. Ensure consistent spacing across all card sizes and screen widths

## Verification Checklist

- [ ] Even spacing between service cards
- [ ] Consistent padding inside cards
- [ ] Looks correct on small and large screens
- [ ] No overlap or visual clipping

## Notes

- Client feedback: spacing needs to be proper on shop service cards
