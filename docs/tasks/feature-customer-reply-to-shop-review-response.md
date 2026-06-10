# Feature — Customer Reply to Shop Review Response

## Overview

Customers can write a review on a completed service order, and shops can respond to that review. However, the conversation ends there — customers have no way to reply back to the shop's response. This ticket covers adding a single customer counter-reply to the existing shop response.

**Created**: June 5, 2026
**Status**: Open
**Priority**: Medium
**Category**: Feature / Mobile + Backend

---

## Current Behavior

| Actor | Action | Supported |
|---|---|---|
| Customer | Write a review | ✅ |
| Shop | Reply to review | ✅ |
| Customer | Reply back to shop response | ❌ |

The review thread is currently one-way. Once a shop responds, customers can read the reply but cannot engage further.

---

## Desired Behavior

After a shop has responded to a review, the customer who wrote the review can post a single counter-reply visible beneath the shop's response.

```
Customer Review: "Great service, very fast!"
  └── Shop Response: "Thank you! Hope to see you again."
        └── Customer Reply: "Will definitely be back!"   ← NEW
```

---

## Affected Files

| File | Change |
|---|---|
| `backend/migrations/???_add_customer_reply_to_reviews.sql` | Add `customer_reply` + `customer_reply_at` columns |
| `backend/src/repositories/ReviewRepository.ts` | Add `addCustomerReply()` method |
| `backend/src/domains/ServiceDomain/controllers/ReviewController.ts` | Add `addCustomerReply` handler |
| `backend/src/domains/ServiceDomain/routes.ts` | Register `POST /reviews/:reviewId/reply` |
| `mobile/feature/services/services/service.interface.ts` | Add `customerReply` + `customerReplyAt` fields to `ReviewData` |
| `mobile/feature/services/services/service.services.ts` | Add `addCustomerReply()` API call |
| `mobile/feature/services/services-main/feature-tab/components/ReviewCard.tsx` | Display reply + input field |
| `mobile/feature/services/services-main/feature-tab/components/UnifiedReviewsSection.tsx` | Display reply in service detail view |

---

## Implementation Plan

### 1. Database Migration

```sql
ALTER TABLE service_reviews
  ADD COLUMN customer_reply TEXT,
  ADD COLUMN customer_reply_at TIMESTAMPTZ;
```

### 2. Backend — Repository

Add to `ReviewRepository.ts`:

```typescript
async addCustomerReply(reviewId: string, reply: string): Promise<ReviewData> {
  const result = await this.pool.query(
    `UPDATE service_reviews
     SET customer_reply = $1, customer_reply_at = NOW()
     WHERE review_id = $2
     RETURNING *`,
    [reply, reviewId]
  );
  return this.mapRow(result.rows[0]);
}
```

### 3. Backend — Controller

Add to `ReviewController.ts`:

```typescript
/**
 * POST /api/services/reviews/:reviewId/reply
 * Customer counter-reply to shop response (one reply per review)
 */
async addCustomerReply(req: Request, res: Response): Promise<void> {
  const { reviewId } = req.params;
  const { reply } = req.body;
  const customerAddress = req.user?.address;

  // Validate ownership — only the original reviewer can reply
  // Only allow reply if shop has responded
  // Only allow one reply (block if customerReply already exists)
}
```

### 4. Backend — Route

```typescript
router.post(
  '/reviews/:reviewId/reply',
  authMiddleware,
  requireRole(['customer']),
  reviewController.addCustomerReply.bind(reviewController)
);
```

### 5. Mobile — Interface

```typescript
// service.interface.ts
export interface ReviewData {
  // existing fields...
  shopResponse: string | null;
  shopResponseAt: string | null;
  customerReply: string | null;       // NEW
  customerReplyAt: string | null;     // NEW
}
```

### 6. Mobile — API Service

```typescript
// service.services.ts
async addCustomerReply(reviewId: string, reply: string) {
  return await apiClient.post(`/services/reviews/${reviewId}/reply`, { reply });
}
```

### 7. Mobile — UI (ReviewCard.tsx)

Show the customer reply beneath the shop response. If no reply yet and the current user is the original reviewer, show a reply input field.

```
Shop Response box
  └── Customer reply text (if exists)
      OR
      [Reply input + Submit button] (if current user = reviewer AND no reply yet)
```

---

## Business Rules

- Only the customer who wrote the original review can post a reply
- A reply can only be posted after the shop has responded (no reply without a shop response)
- Only one customer reply allowed per review (not an open thread)
- Reply length limit: 1,000 characters
- Reply cannot be edited after submission

---

## Verification Checklist

- [ ] Customer sees a reply input under shop response on their own review
- [ ] Customer cannot reply to reviews they did not write
- [ ] Reply input does not appear if shop has not yet responded
- [ ] Reply input does not appear if customer has already replied
- [ ] Submitted reply appears immediately without re-login (cache invalidation)
- [ ] Other customers viewing the service can see the customer reply
- [ ] Shop can see the customer reply in their Reviews tab
- [ ] Reply is capped at 1,000 characters with validation

---

## References

- **Existing shop respond endpoint**: `backend/src/domains/ServiceDomain/controllers/ReviewController.ts:305` — `addShopResponse`
- **Review interface**: `mobile/feature/services/services/service.interface.ts:259`
- **ReviewCard component**: `mobile/feature/services/services-main/feature-tab/components/ReviewCard.tsx:165`
- **UnifiedReviewsSection**: `mobile/feature/services/services-main/feature-tab/components/UnifiedReviewsSection.tsx:162`
- **Shop reply API call**: `mobile/feature/services/services/service.services.ts:222`
