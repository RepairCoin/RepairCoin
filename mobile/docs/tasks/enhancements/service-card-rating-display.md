# Enhancement: Display Ratings on Service Cards

**Status:** Open
**Priority:** Medium
**Est. Effort:** 2-3 hrs
**Created:** 2026-03-30
**Updated:** 2026-03-30

## Problem / Goal

Service cards in the marketplace don't show ratings. Customers have no quick way to judge service quality without tapping into the details. Adding star ratings directly on the card builds trust at a glance and attracts customers to highly-rated services.

## Analysis

- Service cards currently show: image, name, price, category, RCN badge, group badge
- Rating data already exists in the backend (reviews & ratings system)
- Star rating display components already exist in the codebase (used in service details)
- Need to include average rating + review count on each service card

## Implementation

1. Ensure the service list API returns `averageRating` and `reviewCount` for each service
2. Add a star rating row to the service card component (e.g., "★ 4.8 (24 reviews)")
3. Show on all service card views: marketplace, favorites, trending, recently viewed
4. Services with no reviews show "No reviews yet" or hide the rating row

## Verification Checklist

- [ ] Star rating visible on service cards in marketplace
- [ ] Rating shows on favorite service cards
- [ ] Rating shows on trending service cards
- [ ] Rating shows on recently viewed service cards
- [ ] Services with no reviews handled gracefully
- [ ] Rating matches the actual average from reviews
- [ ] Tapping the card still navigates to service details

## Notes

- Client feedback: ratings on cards build customer trust and encourage bookings
- Keep the rating display compact — one line with stars, number, and review count
- Consider color-coding: gold stars for 4+, gray for lower
