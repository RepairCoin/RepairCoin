# Resubscription Blocked by Stale Subscription Record

## Status: 🔲 TODO

**Priority:** High
**Area:** Backend - Subscription Service
**Reported:** March 5, 2026
**Shop:** DC Shopuo (`dc_shopu`) — wallet `0x42be8b92a770eb5eb97b7abe7a06183952ec5eb0`

---

## Problem Statement

A shop with an ended/cancelled subscription cannot resubscribe. Clicking "Subscribe Again" returns:

```
400 Bad Request — "Shop already has an active subscription"
```

The shop's UI correctly shows "Subscription Cancelled" (cancelled 2/22/2026), but the backend rejects the resubscription attempt.

---

## Root Cause

### Stale `active` record in `stripe_subscriptions` table

The shop has 3 subscription records:

| id | stripe_subscription_id | status | period_end | canceled_at |
|----|----------------------|--------|------------|-------------|
| 22 | sub_1SWsc... | **canceled** | 2026-02-24 | 2026-02-19 |
| 14 | sub_1SURj... | **canceled** | 2026-01-17 | 2026-01-01 |
| 11 | sub_1SQ4k... | **active** | 2025-01-01 | NULL |

Row `id=11` is a ghost record:
- Status is `active` in the DB but **does not exist on Stripe** (returns `resource_missing`)
- Period ended **January 2025** — over a year ago
- Was never properly cancelled/cleaned up in the database

### Why it blocks resubscription

`SubscriptionService.createSubscription()` (line 50-54) calls `getActiveSubscription()` before allowing a new subscription:

```typescript
const existingSubscription = await this.getActiveSubscription(shopId);
if (existingSubscription) {
  throw new Error('Shop already has an active subscription');
}
```

`getActiveSubscription()` (line 211-230) queries:

```sql
SELECT * FROM stripe_subscriptions
WHERE shop_id = $1 AND status IN ('active', 'past_due', 'unpaid')
ORDER BY created_at DESC LIMIT 1
```

This returns row `id=11` because it only checks `status` — it does NOT verify:
1. Whether `current_period_end` has passed
2. Whether the subscription still exists on Stripe

---

## Proposed Fix

### Option A: Add period expiry check to query (Recommended)

**File:** `backend/src/services/SubscriptionService.ts` — `getActiveSubscription()`

```sql
SELECT * FROM stripe_subscriptions
WHERE shop_id = $1
  AND status IN ('active', 'past_due', 'unpaid')
  AND current_period_end > NOW()
ORDER BY created_at DESC LIMIT 1
```

This ensures expired subscriptions are not considered "active" even if their status was never updated.

### Option B: Sync with Stripe before checking

In `createSubscription()`, if an "active" subscription is found, verify it with Stripe before rejecting:

```typescript
const existingSubscription = await this.getActiveSubscription(shopId);
if (existingSubscription) {
  // Verify with Stripe that it's actually active
  try {
    const stripeStatus = await this.stripeService.getSubscription(existingSubscription.stripeSubscriptionId);
    if (stripeStatus.status === 'canceled' || stripeStatus.status === 'incomplete_expired') {
      // Update stale record and allow resubscription
      await this.pool.query(
        `UPDATE stripe_subscriptions SET status = $1 WHERE id = $2`,
        [stripeStatus.status, existingSubscription.id]
      );
    } else {
      throw new Error('Shop already has an active subscription');
    }
  } catch (stripeError) {
    // Subscription doesn't exist on Stripe — mark as canceled
    await this.pool.query(
      `UPDATE stripe_subscriptions SET status = 'canceled' WHERE id = $1`,
      [existingSubscription.id]
    );
  }
}
```

### Option C: Immediate data fix + Option A

Fix the stale record now and add the query guard:

```sql
UPDATE stripe_subscriptions
SET status = 'canceled', canceled_at = NOW()
WHERE id = 11 AND shop_id = 'dc_shopu';
```

**Recommendation:** Option A + C. Fix the data now, and add the period check to prevent future occurrences. Option B can be added later for extra resilience.

---

## Potential Scope

Other shops may have similar stale records. A cleanup query should be run:

```sql
-- Find all stale "active" subscriptions with expired periods
SELECT id, shop_id, stripe_subscription_id, status, current_period_end
FROM stripe_subscriptions
WHERE status IN ('active', 'past_due', 'unpaid')
  AND current_period_end < NOW();
```

---

## Files to Change

| File | Change |
|------|--------|
| `backend/src/services/SubscriptionService.ts` | Add `current_period_end > NOW()` to `getActiveSubscription()` query |

---

## Testing

1. Verify DC Shopuo can resubscribe after fix
2. Check other shops with stale subscription records
3. Verify active subscriptions still work correctly (not broken by the period check)
4. Test cancelling and resubscribing flow end-to-end
