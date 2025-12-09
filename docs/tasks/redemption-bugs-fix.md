# Bug Fix: Redemption System Bugs

**Date:** 2025-12-09
**Priority:** HIGH
**Component:** Token Domain - Redemption / Shop Domain
**Status:** FIXED

## Issues Discovered

During manual testing, 4 critical bugs were discovered in the redemption system:

### Bug 1: Cross-Shop 20% Limit Not Enforced
- **Expected:** Customers can only redeem 20% of their balance at non-home shops
- **Actual:** Customers could redeem 100% of balance at ANY shop
- **Impact:** Violates business rules, customers could bypass home shop incentive

### Bug 2: Shop Balance Not Checked Before Redemption
- **Expected:** Shop must have enough operational RCN to process redemption
- **Actual:** Shop with 1 RCN could process 25 RCN redemption
- **Impact:** Shops could process redemptions they can't fulfill

### Bug 3: Shop Balance Not Credited After Redemption
- **Expected:** When customer redeems RCN, shop's operational balance should increase
- **Actual:** Shop balance remained unchanged after redemption
- **Impact:** Shops lose the RCN tokens they should receive back

### Bug 4: Customer Not Added to Shop After Redemption
- **Expected:** Customer who redeems at a shop should appear in shop's customer list
- **Actual:** Only customers who EARNED at shop appeared in customer list
- **Impact:** Shops couldn't see customers who only redeemed there

## Affected Files
- `backend/src/domains/token/services/VerificationService.ts`
- `backend/src/domains/shop/routes/index.ts`
- `backend/src/repositories/ShopRepository.ts`

## Solutions Implemented

### Fix 1: Enforce 20% Cross-Shop Limit

Updated `VerificationService.verifyRedemption()`:

```typescript
// Calculate maximum redeemable amount based on shop type
const CROSS_SHOP_REDEMPTION_PERCENTAGE = 0.20; // 20%

if (isHomeShop) {
  // Home shop: customer can redeem full balance
  maxRedeemable = availableBalance;
  crossShopLimit = availableBalance;
} else {
  // Cross-shop: customer can only redeem 20% of their balance
  crossShopLimit = Math.floor(availableBalance * CROSS_SHOP_REDEMPTION_PERCENTAGE * 100) / 100;
  maxRedeemable = crossShopLimit;
}
```

### Fix 2: Check Shop Balance Before Redemption

Added shop balance validation in `VerificationService.verifyRedemption()`:

```typescript
// Check if shop has enough operational RCN balance
const shopBalance = shop.purchasedRcnBalance || 0;

if (shopBalance < requestedAmount) {
  return {
    canRedeem: false,
    message: `Shop has insufficient RCN balance. Shop available: ${shopBalance} RCN`
  };
}
```

### Fix 3: Credit Shop Balance After Redemption

Updated redemption route to credit shop's balance:

```typescript
// When customer redeems RCN, the shop receives those tokens back
const previousShopBalance = shop.purchasedRcnBalance || 0;
const newShopBalance = previousShopBalance + amount;

await shopRepository.updateShop(shopId, {
  totalRedemptions: (shop.totalRedemptions || 0) + amount,
  purchasedRcnBalance: newShopBalance,  // Credit the shop
  lastActivity: new Date().toISOString()
});
```

### Fix 4: Include Redeemed Customers in Shop's Customer List

Updated `ShopRepository.getShopCustomers()` query to include both mint AND redeem transactions:

```sql
-- Before (only mint)
WHERE t.shop_id = $1 AND t.type = 'mint'

-- After (mint OR redeem)
WHERE t.shop_id = $1 AND t.type IN ('mint', 'redeem')
```

For lifetime_earnings, only mint transactions are summed (what they actually earned at this shop):
```sql
SUM(CASE WHEN t.type = 'mint' THEN t.amount ELSE 0 END) as lifetime_earnings
```

## Verification Scenarios

### Test 1: Cross-Shop Redemption Limit
```
Customer: 25 RCN balance
Home Shop: DC Shopuo
Redeeming at: Dexters (different shop)

Before Fix: Could redeem 25 RCN (100%)
After Fix: Can only redeem 5 RCN (20%)
```

### Test 2: Shop Balance Check
```
Shop: Dexters with 1 RCN operational balance
Customer: Requests 25 RCN redemption

Before Fix: Redemption processed successfully
After Fix: Error: "Shop has insufficient RCN balance. Shop available: 1 RCN"
```

### Test 3: Shop Balance Credit
```
Shop: Dexters with 10 RCN operational balance
Customer: Redeems 5 RCN

Before Fix: Shop balance stays at 10 RCN
After Fix: Shop balance becomes 15 RCN
```

### Test 4: Customer Added to Shop
```
Customer: Qua Ting (never earned at Dexters)
Action: Redeems 5 RCN at Dexters

Before Fix: Qua Ting not in Dexters' customer list
After Fix: Qua Ting appears in Dexters' customer list
```

## Business Logic Summary

| Scenario | Redemption Limit | Shop Balance Required |
|----------|-----------------|----------------------|
| Customer at HOME shop | 100% of balance | Yes, shop needs enough RCN |
| Customer at OTHER shop | 20% of balance | Yes, shop needs enough RCN |

## Token Flow After Fix

```
1. Customer has 25 RCN (earned at DC Shopuo)
2. Customer wants to redeem at Dexters (not home shop)
3. System checks:
   - Cross-shop limit: 25 * 20% = 5 RCN maximum
   - Dexters balance: must have >= 5 RCN
4. If Dexters has 10 RCN:
   - Redemption approved for up to 5 RCN
   - After 5 RCN redemption:
     - Customer balance: 25 - 5 = 20 RCN
     - Dexters balance: 10 + 5 = 15 RCN
     - Customer appears in Dexters' customer list
```

## Testing

TypeScript compiles without errors.
All 101 existing tests pass.

Manual testing recommended:
1. Try to redeem > 20% at non-home shop (should fail)
2. Try to redeem at shop with insufficient balance (should fail)
3. Complete redemption and verify shop balance increased
4. Verify customer appears in shop's customer list

## Rollback Plan

If issues arise:
1. Revert changes to `VerificationService.ts` (remove cross-shop limit and shop balance check)
2. Revert changes to shop routes (remove balance credit logic)
3. Revert changes to `ShopRepository.ts` (change query back to `type = 'mint'` only)
