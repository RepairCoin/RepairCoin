# Bug: "Service not found" when tapping service card from shop profile

**Status:** Completed
**Priority:** High
**Est. Effort:** 1-2 hrs
**Created:** 2026-03-30
**Updated:** 2026-03-31
**Completed:** 2026-03-31

## Problem / Goal

When a customer navigates to a shop profile and taps a service card under the Services tab, it shows "Service not found" instead of the service details.

**Steps to reproduce:**
1. Login as customer
2. Go to Service tab
3. Click any service item
4. Click "View Shop" to open thethis shop profile
5. Click the Services tab on the shop profile
6. Tap any service card
7. Shows "Service not found"

**Expected:** Service details screen opens with the correct service
**Actual:** "Service not found" error

## Analysis

- The service card on the shop profile likely passes a different ID format or missing parameter when navigating to service details
- The service details screen may expect a different route param than what the shop profile provides
- Could be a routing issue (wrong path) or a data issue (wrong service ID)

## Implementation

1. Check what params the shop profile service card passes on tap
2. Compare with what the service details screen expects
3. Fix the navigation params or the details screen query

## Verification Checklist

- [ ] Tap service from shop profile → service details loads correctly
- [ ] Tap service from marketplace → still works (no regression)
- [ ] Tap service from favorites → still works
- [ ] Service details show correct data (name, price, reviews)

## Notes

- This is a customer-facing bug that blocks service discovery through shop profiles
- High priority — broken navigation path reduces bookings
