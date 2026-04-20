# Bug: Web Cross-Shop RCN Limit Calculates 20% of Service Price Instead of 20% of Balance

**Status:** Open
**Priority:** High
**Est. Effort:** 30 min
**Created:** 2026-04-16
**Updated:** 2026-04-16

---

## Problem

The web checkout modal calculates the cross-shop RCN redemption limit as 20% of the **service price**, but the backend enforces 20% of the customer's **balance**. This mismatch allows the slider to go higher than the backend permits, causing payment failures when customers try to redeem the amount the UI tells them is allowed.

### Example (from staging)

- Customer balance: 161 RCN ($16.10)
- Service price: $44.00
- Cross-shop booking (not home shop)

| | Formula | Max RCN | Result |
|---|---|---|---|
| **Web UI (broken)** | 20% of $44.00 service price | 88 RCN | User selects 88, backend rejects |
| **Backend (correct)** | 20% of 161 RCN balance | 32 RCN | Enforced on server |
| **Mobile (correct)** | 20% of 161 RCN balance | 32 RCN | Matches backend |

---

## Root Cause

**File:** `frontend/src/components/customer/ServiceCheckoutModal.tsx` (lines 237-248)

```typescript
const baseRate = isHomeShop ? 1.00 : 0.20;
const tierCap = isRestrictedTier && noShowStatus?.maxRcnRedemptionPercent
  ? noShowStatus.maxRcnRedemptionPercent / 100
  : 1.00;
const MAX_DISCOUNT_PCT = Math.min(baseRate, tierCap);

const maxDiscountUsd = service.priceUsd * MAX_DISCOUNT_PCT;  // ← BUG: 20% of service price
const maxRcnRedeemable = Math.floor(Math.min(maxDiscountUsd / RCN_TO_USD, customerBalance));
```

The line `service.priceUsd * MAX_DISCOUNT_PCT` applies the 20% to the service price ($44 × 0.20 = $8.80 → 88 RCN). It should apply 20% to the customer's balance.

### Backend reference

**File:** `backend/src/domains/token/services/VerificationService.ts` (lines 108-119)

```typescript
const CROSS_SHOP_REDEMPTION_PERCENTAGE = 0.20;
if (isHomeShop) {
  maxRedeemable = availableBalance;
} else {
  crossShopLimit = Math.floor(availableBalance * CROSS_SHOP_REDEMPTION_PERCENTAGE * 100) / 100;
  maxRedeemable = crossShopLimit;
}
```

Backend clearly calculates 20% of the **balance**, not the service price.

### Mobile reference (correct)

**File:** `mobile/feature/appointment/screens/AppointmentCompleteScreen.tsx` (line 93)

```typescript
const crossShopMaxRcn = isHomeShop ? availableRcn : Math.floor(availableRcn * 0.20 * 100) / 100;
```

Mobile matches the backend formula exactly.

---

## Fix

**File:** `frontend/src/components/customer/ServiceCheckoutModal.tsx`

Replace the cross-shop calculation to match the backend:

```typescript
// Before (wrong — 20% of service price):
const maxDiscountUsd = service.priceUsd * MAX_DISCOUNT_PCT;
const maxRcnRedeemable = Math.floor(Math.min(maxDiscountUsd / RCN_TO_USD, customerBalance));

// After (correct — 20% of balance for cross-shop, then cap by service price):
const crossShopMaxRcn = isHomeShop ? customerBalance : Math.floor(customerBalance * 0.20 * 100) / 100;
const tierMaxRcn = isRestrictedTier && noShowStatus?.maxRcnRedemptionPercent
  ? Math.floor((service.priceUsd * (noShowStatus.maxRcnRedemptionPercent / 100)) / RCN_TO_USD)
  : Infinity;
const servicePriceMaxRcn = Math.floor(service.priceUsd / RCN_TO_USD);
const maxRcnRedeemable = Math.floor(Math.min(crossShopMaxRcn, tierMaxRcn, servicePriceMaxRcn, customerBalance));
```

Also update the slider max label to reflect the correct limit.

---

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/customer/ServiceCheckoutModal.tsx` | Fix cross-shop max calculation to use 20% of balance instead of 20% of service price |

---

## Verification Checklist

- [ ] Cross-shop: 161 RCN balance, $44 service → max shows 32 RCN (not 88)
- [ ] Home shop: 161 RCN balance, $44 service → max shows 161 RCN (full balance, capped by service price 440)
- [ ] Cross-shop: slide to max → payment succeeds (backend accepts)
- [ ] Cross-shop: slider label says correct max with "(Max 20%)"
- [ ] Caution tier: max reduced further by shop's `maxRcnRedemptionPercent`
- [ ] Compare web and mobile side-by-side for same customer/shop → same max RCN
- [ ] Backend typecheck passes: `cd frontend && npm run build`

---

## Notes

- The mobile implementation was recently fixed and correctly matches the backend (see `features/feature-cross-shop-rcn-limit-and-noshow-cap.md`).
- This web bug has been live on staging — customers may have seen "Cross-shop limit exceeded" errors after selecting the amount the UI said was allowed.
- The backend always enforces the correct limit regardless, so no financial risk — just a bad UX where the slider allows more than the backend accepts.
