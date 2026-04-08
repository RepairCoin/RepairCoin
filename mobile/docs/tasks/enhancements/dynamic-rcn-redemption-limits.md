# Feature: Dynamic RCN Redemption Limits (Cross-Shop & No-Show Tier)

**Status:** Open
**Priority:** High
**Est. Effort:** 3-4 hrs
**Created:** 2026-04-08
**Updated:** 2026-04-08

## Overview

The mobile app hardcodes a flat 20 RCN maximum redemption for all bookings. It does not implement:

1. **Cross-shop 20% limit** — customers can redeem 100% RCN at the shop where they earned it, but only 20% at other shops
2. **No-show tier cap** — customers with no-show history (caution/deposit_required tiers) have further RCN redemption restrictions

Both features work correctly on web and are enforced by the backend.

**Affected:** Customer booking payment (mobile only)

---

## Current Mobile Behavior (Broken)

**File:** `mobile/feature/appointment/screens/AppointmentCompleteScreen.tsx` lines 57-68

```typescript
const MAX_RCN_DISCOUNT = 20;  // Hardcoded flat limit
const RCN_TO_USD = 0.10;
const availableRcn = balanceData?.totalBalance || 0;

const maxRcnRedeemable = Math.min(
  availableRcn,
  MAX_RCN_DISCOUNT,        // Always capped at 20 RCN
  servicePrice / RCN_TO_USD
);
```

**Problems:**
- Customer with 500 RCN at their home shop can only redeem 20 (should be up to service price)
- Customer at a cross-shop sees the same 20 limit (should be 20% of their balance)
- No-show caution tier customers have no additional restriction (should be capped at shop policy %)

---

## Web Behavior (Correct)

**File:** `frontend/src/components/customer/ServiceCheckoutModal.tsx` lines 228-248

```typescript
const isHomeShop = noShowStatus?.isHomeShop === true;
const isRestrictedTier = noShowStatus?.tier === 'caution' || noShowStatus?.tier === 'deposit_required';
const baseRate = isHomeShop ? 1.00 : 0.20;  // 100% home, 20% cross-shop
const tierCap = isRestrictedTier && noShowStatus?.maxRcnRedemptionPercent
  ? noShowStatus.maxRcnRedemptionPercent / 100
  : 1.00;
const MAX_DISCOUNT_PCT = Math.min(baseRate, tierCap);

const maxDiscountUsd = service.priceUsd * MAX_DISCOUNT_PCT;
const maxRcnRedeemable = Math.floor(Math.min(maxDiscountUsd / RCN_TO_USD, customerBalance));
```

Web fetches no-show status (includes `isHomeShop`, `tier`, `maxRcnRedemptionPercent`) and calculates the limit dynamically.

---

## Backend Enforcement (Correct)

The backend enforces both limits regardless of what the client sends:

**Cross-shop** (`VerificationService.ts` lines 103-120):
- Home shop: `maxRedeemable = availableBalance` (100%)
- Cross-shop: `maxRedeemable = availableBalance × 0.20` (20%)

**No-show tier** (`PaymentService.ts` lines 228-237):
- Caution/deposit_required tier: `maxRedeemable = servicePrice × (maxRcnRedemptionPercent / 100)`

So even if mobile sends a higher amount, the backend rejects it. But the mobile UI shows wrong limits to the user — they don't know how much they can actually redeem.

---

## What Mobile Has But Doesn't Use

A `calculateMaxRedeemable` utility already exists but is never called in the booking flow:

**File:** `mobile/feature/redeem-token/utils/calculateMaxRedeemable.ts`

```typescript
export function calculateMaxRedeemable(params: RedemptionLimitParams): number {
  const { balance, lifetimeEarnings, isHomeShop } = params;
  if (isHomeShop) return balance;
  const crossShopLimit = lifetimeEarnings * 0.20;
  return Math.min(balance, crossShopLimit);
}
```

This handles cross-shop but not no-show tier caps.

---

## Fix Required

### Step 1: Fetch no-show status before payment screen

In `AppointmentCompleteScreen.tsx`, add an API call to get the customer's no-show status for this shop. The backend endpoint already exists:

```
GET /api/tokens/verify-redemption?customerAddress={addr}&shopId={shopId}
```

Or use the no-show policy endpoint that returns `isHomeShop`, `tier`, and `maxRcnRedemptionPercent`.

### Step 2: Replace hardcoded limit with dynamic calculation

```typescript
// Replace this:
const MAX_RCN_DISCOUNT = 20;

// With this:
const isHomeShop = noShowStatus?.isHomeShop === true;
const isRestrictedTier = noShowStatus?.tier === 'caution' || noShowStatus?.tier === 'deposit_required';
const baseRate = isHomeShop ? 1.00 : 0.20;
const tierCap = isRestrictedTier && noShowStatus?.maxRcnRedemptionPercent
  ? noShowStatus.maxRcnRedemptionPercent / 100
  : 1.00;
const maxDiscountPct = Math.min(baseRate, tierCap);
const maxDiscountUsd = servicePrice * maxDiscountPct;
const maxRcnRedeemable = Math.floor(Math.min(maxDiscountUsd / RCN_TO_USD, availableRcn));
```

### Step 3: Show informative messages

Display context to the user:
- Home shop: "You can redeem up to 100% at this shop (your home shop)"
- Cross-shop: "Cross-shop limit: 20% of your balance"
- No-show restricted: "Due to your booking history, redemption is limited to X% of the service price"

---

## Comparison Table

| Scenario | Mobile (Current) | Web (Correct) | Backend Enforces |
|----------|-----------------|---------------|------------------|
| Home shop, 500 RCN, $100 service | Max 20 RCN ($2) | Max 1000 RCN ($100) | 100% of balance |
| Cross-shop, 500 RCN, $100 service | Max 20 RCN ($2) | Max 100 RCN ($10) | 20% of balance |
| No-show caution, 50% cap, $100 service | Max 20 RCN ($2) | Max 500 RCN ($50) | 50% of service price |

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/appointment/screens/AppointmentCompleteScreen.tsx` | Fetch no-show status, replace hardcoded limit |
| `mobile/feature/appointment/screens/AppointmentDiscountScreen.tsx` | Show context messages about redemption limits |
| `mobile/shared/services/appointment.services.ts` | Add no-show status API call (if not exists) |

---

## QA Test Plan

### Cross-shop limit

1. Earn RCN at Shop A (complete a booking)
2. Book a service at Shop B (different shop)
3. On payment screen, check max redeemable
4. **Expected:** Max = 20% of balance (not flat 20 RCN)

### Home shop full redemption

1. Earn RCN at Shop A
2. Book another service at Shop A (same shop)
3. On payment screen, check max redeemable
4. **Expected:** Max = full balance up to service price (not capped at 20)

### No-show tier restriction

1. Get a customer into "caution" no-show tier
2. Book a service
3. On payment screen, check max redeemable
4. **Expected:** Max = restricted by shop's `maxRcnRedemptionPercent` setting

### Backend enforcement

1. Manually send a higher RCN amount than allowed via API
2. **Expected:** Backend rejects with appropriate error message
