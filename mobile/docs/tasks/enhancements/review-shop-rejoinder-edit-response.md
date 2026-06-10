# Feature: Review Thread — Shop Rejoinder, Edit Response & Edit Reply

**Status:** In Progress
**Priority:** Medium
**Est. Effort:** 4-5 hrs
**Created:** 2026-06-08
**Updated:** 2026-06-08

## Problem / Goal

The review system only supported a one-way exchange (customer review → shop response). Customers had no way to reply to a shop's response, and shops had no way to continue the conversation after a customer replied. Additionally, shops and customers could not edit their existing reviews or responses.

Full thread needed:
1. Customer writes review
2. Shop responds
3. Customer replies to shop's response
4. Shop replies back (rejoinder)

All parties should be able to edit their own contributions.

## Analysis

- `service_reviews` table was missing `customer_reply`, `customer_reply_at`, `shop_rejoinder`, `shop_rejoinder_at` columns
- No backend endpoints existed for reply/rejoinder/edit operations
- Mobile `ReviewCard` component had no UI for these interactions
- Two separate ReviewCard implementations exist: `ReviewCard.tsx` (full screen) and the inline one inside `UnifiedReviewsSection.tsx` (service details page)

## Implementation

### Backend
- **Migration 136** (`backend/migrations/136_add_customer_reply_to_reviews.sql`): adds `customer_reply`, `customer_reply_at`
- **Migration 137** (`backend/migrations/137_add_shop_rejoinder_to_reviews.sql`): adds `shop_rejoinder`, `shop_rejoinder_at`
- **`ReviewRepository.ts`**: added `addCustomerReply()`, `updateCustomerReply()`, `updateShopResponse()`, `addShopRejoinder()`, `updateShopRejoinder()`
- **`ReviewController.ts`**: handlers for all new operations with ownership checks and business rules
- **`ServiceDomain/routes.ts`**: new routes:
  - `POST /reviews/:reviewId/reply` — customer adds reply
  - `PUT /reviews/:reviewId/reply` — customer edits reply
  - `PUT /reviews/:reviewId/respond` — shop edits response
  - `POST /reviews/:reviewId/rejoinder` — shop adds rejoinder
  - `PUT /reviews/:reviewId/rejoinder` — shop edits rejoinder

### Mobile
- **`service.interface.ts`**: `ReviewData` extended with `customerReply`, `customerReplyAt`, `shopRejoinder`, `shopRejoinderAt`
- **`service.services.ts`**: API methods for all new endpoints
- **`ReviewCard.tsx`**: full thread timeline UI (avatar circles + vertical connector line) with edit/reply/rejoinder interactions
- **`UnifiedReviewsSection.tsx`**: same thread timeline UI for the compact embedded view on service details page

### Business Rules
- Customer can only reply once (no second reply)
- Customer can edit their reply anytime
- Customer cannot edit review after shop has responded
- Shop can only add rejoinder after customer has replied
- Shop can edit response and rejoinder anytime

## Verification Checklist

- [ ] Migration 136 applied (`customer_reply`, `customer_reply_at` columns exist)
- [ ] Migration 137 applied (`shop_rejoinder`, `shop_rejoinder_at` columns exist)
- [ ] Customer can reply to a shop response
- [ ] Customer can edit their reply
- [ ] Customer cannot reply twice
- [ ] Customer cannot edit review after shop responds
- [ ] Shop can edit their response (pencil icon)
- [ ] Shop can add rejoinder after customer replies
- [ ] Shop can edit their rejoinder
- [ ] Thread displays correctly on service details page (UnifiedReviewsSection)
- [ ] Thread displays correctly on full reviews screen (ReviewCard)
- [ ] Thread timeline design is consistent across both views

## Notes

- Both `ReviewCard.tsx` and `UnifiedReviewsSection.tsx` have independent ReviewCard implementations — changes must be applied to both
- Migration 137 must be run from WSL terminal: `npm run db:migrate` from `backend/` directory
- Branch: `fix/mobile-notifications-favorites-sharing-2026-06-05`
