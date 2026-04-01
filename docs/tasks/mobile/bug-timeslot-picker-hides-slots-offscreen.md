# Bug: TimeSlotPicker Hides Time Slots Off-Screen

**Status:** open
**Priority:** medium
**Date:** 2026-04-01
**Platform:** Mobile (React Native / Expo)

---

## Summary

The TimeSlotPicker component uses a horizontal ScrollView with the scroll indicator hidden (`showsHorizontalScrollIndicator={false}`). On a standard mobile screen (~360-400px), only the first 4 time slots are visible. The remaining slots are hidden off-screen to the right with no visual cue to scroll, making users think fewer slots are available than actually returned by the API.

This was observed when comparing web (8 slots visible) vs mobile (4 slots visible) for the same service and date. The backend returns all 8 slots correctly — the issue is purely a UI layout problem.

---

## Steps to Reproduce

1. Log in as customer on mobile
2. Select a service from a shop with operating hours 9:00 AM - 5:00 PM (e.g., dc_shopu, service 22)
3. Select a date (e.g., Thursday) — backend returns 8 time slots (9 AM - 4 PM)
4. Only 4 slots (9:00 AM - 12:00 PM) are visible
5. No scroll indicator or visual hint that more slots exist to the right

---

## Root Cause

`mobile/feature/appointment/components/TimeSlotPicker.tsx` uses a horizontal ScrollView with hidden indicator:

```tsx
<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}  // No scroll indicator
  className="-mx-4"
  contentContainerStyle={{ paddingHorizontal: 16 }}
>
```

Each button is ~90-100px wide (`px-5 py-3 mr-3`), so exactly 4 fit on screen with no partial overhang to hint at more content.

The web version uses a grid layout that wraps to multiple rows, showing all slots at once.

---

## Solution

Replace the horizontal ScrollView with a **wrapping grid layout** (using `flexWrap`) so all time slots are visible on screen without scrolling — matching the web behavior.

---

## Affected File

- `mobile/feature/appointment/components/TimeSlotPicker.tsx`

---

## Comparison

| | Web | Mobile (current) | Mobile (fix) |
|---|---|---|---|
| Layout | Grid (wraps) | Horizontal scroll | Grid (wraps) |
| All slots visible | Yes | No | Yes |
| Scroll needed | No | Yes (hidden) | No |
