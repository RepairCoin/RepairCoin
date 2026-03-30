# Enhancement: Booking Detail Screen UI Improvements

**Status:** Open
**Priority:** Medium
**Est. Effort:** 1-2 hrs
**Created:** 2026-03-30
**Updated:** 2026-03-30

## Problem / Goal

Two UI issues on the booking detail screen:
1. The shop header section lacks an information text — customer doesn't see helpful context about the shop
2. In the address section, the icon doesn't align to the top with the title text when the address wraps to multiple lines

## Implementation

### 1. Shop Header Information Text
- Add a descriptive info text or subtitle next to the shop name/header
- Could include: shop category, operating hours, or a brief tagline
- Keep it concise (one line) to not clutter the header

### 2. Address Section Icon Alignment
- Change the icon + title row from `items-center` to `items-start`
- This keeps the icon aligned to the top of the text when the address wraps to multiple lines
- Apply consistently to all info rows with icons

## Verification Checklist

- [ ] Shop header shows information text beside the shop name
- [ ] Address section icon stays aligned to top when address text wraps
- [ ] Layout looks correct on small and large screens
- [ ] No visual regression on other booking detail sections

## Notes

- Client feedback: improve readability and visual alignment on booking details
- Keep changes minimal — only adjust the two areas mentioned
