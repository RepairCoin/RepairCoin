# Bug: Time slot picker hides slots off-screen with no scroll hint

**Status:** Completed
**Priority:** High
**Est. Effort:** 30 min
**Created:** 2026-03-31
**Updated:** 2026-03-31
**Completed:** 2026-03-31

## Problem / Goal

The TimeSlotPicker uses a horizontal ScrollView with the scroll indicator hidden. On mobile screens (~360-400px), only 4 time slots are visible. Remaining slots are hidden off-screen with no visual cue to scroll, making users think fewer slots are available.

**Steps to reproduce:**
1. Login as customer
2. Select a service from a shop with operating hours 9:00 AM - 5:00 PM
3. Select a date — backend returns 8 time slots (9 AM - 4 PM)
4. Only 4 slots (9:00 AM - 12:00 PM) are visible
5. No scroll indicator or visual hint that more slots exist to the right

**Expected:** All time slots visible (wrapping grid like web version)
**Actual:** Only first 4 visible, rest hidden off-screen

## Analysis

**Root Cause:** `mobile/feature/appointment/components/TimeSlotPicker.tsx` uses horizontal ScrollView with hidden indicator:
```tsx
<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  className="-mx-4"
  contentContainerStyle={{ paddingHorizontal: 16 }}
>
```

Each button is ~90-100px wide, so exactly 4 fit on screen with no partial overhang to hint at more content. The web version uses a grid layout that wraps to multiple rows, showing all slots at once.

## Implementation

Replace horizontal ScrollView with a wrapping grid layout (`flexWrap`) so all time slots are visible without scrolling — matching the web behavior.

## Verification Checklist

- [ ] All time slots visible on screen (no hidden slots)
- [ ] Slots wrap to multiple rows when needed
- [ ] Selected slot highlighted correctly
- [ ] Works on small and large screens
- [ ] Matches web version layout

## Notes

- Backend returns correct data — purely a UI layout issue
- Affects the booking flow — customers may miss preferred time slots
