# Bug: Availability settings changes not persisted in service form modal

**Status:** Completed
**Priority:** High
**Est. Effort:** 2-3 hrs
**Created:** 2026-03-30
**Updated:** 2026-03-31
**Completed:** 2026-03-31

## Problem / Goal

When a shop owner opens the Availability Settings modal from the Add/Edit Service form, modifies settings, and taps "Done", the changes are not saved. Reopening the modal shows the original values. The web version works correctly with dedicated Save buttons.

**Steps to reproduce:**
1. Login as shop
2. Go to Service tab → Add or Edit a service
3. Open the Availability Settings modal
4. Change settings (slot duration, max concurrent bookings, advance booking, etc.)
5. Tap "Done"
6. Reopen the Availability Settings modal
7. Settings show original values — changes were lost

**Expected:** Changed settings are saved and persist when reopening the modal
**Actual:** Changes are discarded on modal close, original values shown

## Analysis

- The modal likely manages settings in local state only and doesn't call the save API on "Done"
- Web version has dedicated Save buttons that trigger API calls per section
- Mobile modal may need to either save on "Done" or pass the changed values back to the parent form
- Check if the issue is API not being called, or state not being passed back to parent

## Implementation

1. Check the Availability Settings modal component for save logic
2. Ensure "Done" button triggers the API save (or passes state back to parent)
3. Compare with web implementation for the correct API endpoints
4. Verify saved values load correctly on modal reopen

## Verification Checklist

- [ ] Change slot duration → tap Done → reopen → value persisted
- [ ] Change max concurrent bookings → tap Done → reopen → value persisted
- [ ] Change advance booking setting → tap Done → reopen → value persisted
- [ ] Change operating hours → tap Done → reopen → value persisted
- [ ] Changes reflected in booking flow (correct slots shown to customers)

## Notes

- High priority — shops can't configure their availability from mobile
- Web version saves via dedicated Save buttons per section and works correctly
- Mobile should match the web behavior or save all on "Done"
