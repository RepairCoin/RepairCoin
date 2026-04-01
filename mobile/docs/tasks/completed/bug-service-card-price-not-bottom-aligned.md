# Bug: Service card price and separator not always at bottom

**Status:** Completed
**Priority:** Medium
**Est. Effort:** 30 min
**Created:** 2026-03-31
**Updated:** 2026-03-31
**Completed:** 2026-03-31

## Problem / Goal

The line separator and price section on service cards don't always stick to the bottom. When cards have shorter descriptions or missing content, the price floats up instead of staying pinned at the bottom, causing misalignment across cards in the grid.

**Expected:** Price and separator always at the bottom of every card regardless of content length
**Actual:** Price position varies based on content, cards look uneven in a grid

## Implementation

- Use flex layout to push the price section to the bottom of the card
- Add `flex-1` to the content area and `mt-auto` to the price section
- File: `shared/components/shared/ServiceCard.tsx`

## Verification Checklist

- [ ] Price and separator always at the bottom of grid cards
- [ ] Cards with short descriptions align with cards with long descriptions
- [ ] Cards with no description align correctly
- [ ] No visual clipping or overflow

## Notes

- Affects grid variant of ServiceCard
- Card has a fixed height (255px) so flex layout should work well
