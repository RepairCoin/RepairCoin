# Bug: Revenue Sharing All Zeros for Shop Peanut RCN Purchases

## Status: Fixed (2026-04-14 — column name mismatch corrected)
## Priority: Medium
## Date: 2026-04-09
## Category: Bug - Revenue Distribution
## Affected: Shop RCN purchase revenue sharing
## Shop: peanut

---

## Overview

All RCN purchases for shop "peanut" have revenue sharing values of 0 for operations_share, stakers_share, and dao_treasury_share. The expected split is 80% operations / 10% stakers / 10% DAO.

Other shops (e.g., dc_shopu) have correct revenue sharing values. This appears to be shop-specific.

---

## Evidence

Peanut's completed purchases — all zeros:

| ID | Amount | Cost | Operations | Stakers | DAO |
|---|---|---|---|---|---|
| 223 | 10 RCN | $1.00 | 0.00 | 0.00 | 0.00 |
| 215 | 500 RCN | $50.00 | 0.00 | 0.00 | 0.00 |
| 197 | 50 RCN | $5.00 | 0.00 | 0.00 | 0.00 |

dc_shopu's completed purchases — correct:

| ID | Amount | Cost | Operations | Stakers | DAO |
|---|---|---|---|---|---|
| 121 | 50 RCN | $5.00 | 4.00 | 0.50 | 0.50 |
| 99 | 100 RCN | $10.00 | 8.00 | 1.00 | 1.00 |
| 67 | 5000 RCN | $500.00 | 400.00 | 50.00 | 50.00 |

---

## Possible Causes

1. **Revenue distribution not calculated during purchase creation** — the `completePurchase` method might not be calling the distribution service for peanut
2. **Shop tier issue** — peanut might have a tier that skips distribution
3. **Timing issue** — purchases completed via webhook might skip the revenue split step
4. **RCG balance issue** — revenue distribution might depend on RCG holdings that peanut doesn't have

---

## Files to Investigate

| File | Purpose |
|------|--------|
| `backend/src/domains/shop/services/ShopPurchaseService.ts` | Where revenue distribution is calculated during purchase |
| `backend/src/services/RevenueDistributionService.ts` | Revenue split calculation logic |
| `backend/src/repositories/ShopRepository.ts` | `completeShopPurchase()` — does it update revenue shares? |

---

## Actual Root Cause (found 2026-04-14)

The INSERT query in `ShopRepository.createShopPurchase()` used column name `price_per_rcn` but the actual database column is `unit_price`. This caused every INSERT to fail, triggering a fallback query that omitted the revenue share columns entirely.

**File:** `backend/src/repositories/ShopRepository.ts` (line 933)

```diff
- shop_id, amount, price_per_rcn, total_cost,
+ shop_id, amount, unit_price, total_cost,
```

The fallback path (lines 960-977) silently inserted without `operations_share`, `stakers_share`, `dao_treasury_share`, defaulting them to 0. This affected ALL purchases since the column was renamed — not just peanut.

**Fix applied:** Changed `price_per_rcn` to `unit_price` and removed the unnecessary fallback path.

---

## QA Test Plan

1. Shop peanut purchases 10 RCN
2. Check `shop_rcn_purchases` record
3. **Expected**: operations_share: 0.80, stakers_share: 0.10, dao_treasury_share: 0.10
4. **Previously**: All zeros
