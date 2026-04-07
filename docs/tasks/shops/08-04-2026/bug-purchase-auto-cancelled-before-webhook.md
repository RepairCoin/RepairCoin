# Bug: RCN Purchase Auto-Cancelled Before Webhook Can Complete It

## Status: Fixed (2026-04-08)
## Priority: Critical
## Date: 2026-04-08
## Category: Bug - Payment / Purchase Flow
## Affected: Shop Buy Credits (web + mobile)

---

## Overview

When a shop purchases RCN via Stripe checkout, the payment succeeds on Stripe but the purchase record gets auto-cancelled before the webhook can mark it as completed. The shop's operational balance never increases despite successful payment.

---

## Root Cause

**File:** `backend/src/domains/shop/services/ShopPurchaseService.ts` lines 251-290

The `getPurchaseHistory()` method has an aggressive auto-cancel mechanism. Every time the purchase history is fetched (e.g., when the "Recent Purchases" list refreshes), it loops through all pending purchases older than 2 minutes and cancels them if the Stripe session isn't `'complete'`.

```typescript
// Line 257-265: Cancel pending purchases older than 2 minutes
if (purchase.status === 'pending') {
  const ageMinutes = Math.floor((Date.now() - purchaseAge.getTime()) / 60000);
  if (ageMinutes < 2) {
    continue; // Give 2 min grace period
  }

  // Line 271-289: Check Stripe session
  const session = await stripeService.getCheckoutSession(purchase.payment_reference);
  if (session.payment_status === 'paid' && session.status === 'complete') {
    await shopRepository.completeShopPurchase(purchaseId, session.id); // ✓ complete
  } else {
    await shopRepository.cancelShopPurchase(purchase.id); // ✗ CANCELS even if payment succeeded
  }
}
```

### The Race Condition

```
0:00  Purchase created (status: pending)
0:00  User redirected to Stripe checkout
0:30  User completes payment on Stripe
0:31  Stripe starts processing webhook
1:00  Frontend refreshes "Recent Purchases" list
1:00  getPurchaseHistory() checks Stripe session
1:00  Session status may be 'open' (not yet 'complete') even though payment_status is 'paid'
1:00  → Auto-cancels the purchase!
2:00  Webhook arrives → finds status 'cancelled' → "Purchase already completed or in status: cancelled"
```

The problem is timing — Stripe's `checkout.session.completed` webhook and the session status update don't happen instantly after payment. There's a window where `payment_status: 'paid'` but `status: 'open'` (session not yet finalized). The auto-cancel treats any non-'complete' status as abandoned.

---

## Evidence

**Shop:** DC Shopuo (dc_shopu, wallet 0x42be8b92a770eb5eb97b7abe7a06183952ec5eb0)

3 consecutive purchase attempts all cancelled despite successful Stripe payment:
```
id:218 | 10 RCN | status: cancelled | 2026-04-07 14:49
id:217 | 10 RCN | status: cancelled | 2026-04-07 14:28
id:216 | 10 RCN | status: cancelled | 2026-04-07 13:41
```

Backend webhook log error:
```
Error completing RCN purchase: Purchase already completed or in status: cancelled
```

Balance unchanged: 5033 RCN (should be 5063 after 3 × 10 RCN purchases)

---

## Fix Required

### Option A: Check `payment_status` not just `status` (recommended)

The auto-cancel should NOT cancel a purchase if Stripe says `payment_status: 'paid'`, even if session status isn't `'complete'` yet.

```typescript
if (session.payment_status === 'paid') {
  // Payment received — complete the purchase regardless of session status
  await shopRepository.completeShopPurchase(purchase.id, session.id);
} else if (session.status === 'expired') {
  // Session expired without payment — safe to cancel
  await shopRepository.cancelShopPurchase(purchase.id);
} else {
  // Still open/processing — leave as pending, don't cancel yet
  continue;
}
```

### Option B: Increase grace period

Change the 2-minute grace period to something longer (e.g., 30 minutes). Stripe checkout sessions expire after 24 hours, so there's plenty of room.

### Option C: Remove auto-cancel from getPurchaseHistory

Don't cancel purchases as a side-effect of reading history. Instead, rely on:
1. Webhook (`checkout.session.completed`) for normal completion
2. `check-payment` polling endpoint for fallback
3. A dedicated cleanup cron job for truly abandoned purchases (24h+ old)

### Recommended: Option A + C combined

- Fix the auto-cancel logic to respect `payment_status: 'paid'` (Option A)
- Move cleanup to a dedicated job that only runs for purchases > 24 hours old (Option C)
- Don't mutate data as a side-effect of a read operation (`getPurchaseHistory`)

---

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/domains/shop/services/ShopPurchaseService.ts:251-310` | Fix auto-cancel logic — don't cancel paid sessions |

---

## QA Test Plan

### After fix
1. Login as shop → Buy Credits → purchase 10 RCN
2. Complete Stripe payment
3. **Expected**: Balance increases by 10 RCN
4. Purchase shows as "completed" in Recent Purchases
5. Try purchasing again immediately → should also work

### Edge cases
- Purchase abandoned (user closes Stripe without paying) → should eventually cancel (after 24h, not 2 min)
- Stripe session expired → should mark as failed
- Webhook arrives late (> 2 min) → should still complete successfully
