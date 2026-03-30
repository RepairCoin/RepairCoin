# Bug: Booking tab shows no bookings — wrong API endpoint

**Status:** Open
**Priority:** High
**Est. Effort:** 1-2 hrs
**Created:** 2026-03-30
**Updated:** 2026-03-30

## Problem / Goal

The shop's Service > Booking tab shows no bookings in both Calendar and List views, while the web Appointments page shows many bookings for the same shop (e.g., Shop Peanut: 1 Confirmed, 2 Completed, 10 Cancelled, 8 No Show).

**Steps to reproduce:**
1. Login as shop (e.g., Shop Peanut)
2. Go to Service tab → Booking tab
3. Calendar view shows empty
4. List view shows empty
5. Web Appointments page for the same shop shows 21+ bookings

**Expected:** Mobile booking tab shows all bookings matching the web view
**Actual:** No bookings displayed on mobile

## Analysis

- Mobile uses a wrong API endpoint with a 20-record pagination limit
- Web uses a dedicated calendar endpoint with no pagination that returns all bookings
- The mobile endpoint may be filtering incorrectly or querying different data
- Need to align mobile with the same API endpoint the web uses

## Implementation

1. Identify which endpoint the web Appointments page uses (likely a calendar-specific endpoint)
2. Update the mobile booking tab to use the same endpoint
3. Remove or increase the 20-record pagination limit for booking calendar view
4. Ensure both Calendar and List views show all bookings

## Verification Checklist

- [ ] Calendar view shows all bookings (confirmed, completed, cancelled, no-show)
- [ ] List view shows all bookings
- [ ] Booking count matches the web Appointments page
- [ ] Color coding by status works correctly
- [ ] Tapping a booking opens the detail screen

## Notes

- High priority — shops cannot see their bookings on mobile, critical for daily operations
- Web works correctly — this is a mobile-only API endpoint mismatch
