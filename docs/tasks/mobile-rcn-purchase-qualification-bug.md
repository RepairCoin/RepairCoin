# Mobile RCN Purchase Qualification Bug

## Priority: High
## Status: Open
## Assignee: Mobile Developer

## Problem

When an RCG holder tries to buy RCN tokens in the mobile app, they incorrectly see the "Monthly Subscription" modal even though they should be qualified to purchase RCN directly without a subscription.

This issue does NOT occur on the web - it's specific to the mobile app.

## Root Cause

The mobile app uses `/auth/check-user` for login which does NOT return `operational_status` for shops. The web frontend uses `/shops/wallet/:address` which DOES return and properly syncs `operational_status`.

### Code Flow Comparison

| Aspect | Web Frontend | Mobile App |
|--------|-------------|------------|
| API for shop data | `/shops/wallet/:address` | `/auth/check-user` |
| Returns `operational_status`? | Yes | **No** |
| Syncs RCG balance from blockchain? | Yes | No |
| Result | Shop correctly identified as `rcg_qualified` | `operational_status` is always `undefined` |

### Mobile Code Path

1. `useAuth.ts` calls `/auth/check-user` on login
2. Response sets `userProfile` but **without** `operational_status`
3. `useBuyTokenQueries.ts` line 7-9 checks:
   ```typescript
   const isQualified =
     userProfile?.operational_status === "subscription_qualified" ||
     userProfile?.operational_status === "rcg_qualified";
   ```
4. Since `operational_status` is `undefined`, `isQualified` is always `false`
5. `usePurchaseUI.ts` line 17-19 shows subscription modal when `!isQualified`

## Affected Files

### Backend (needs fix)
- `backend/src/routes/auth.ts` - `/auth/check-user` endpoint (lines 431-456)
  - Missing `operational_status` in shop user response

### Mobile (alternative fix location)
- `mobile/feature/buy-token/hooks/queries/useBuyTokenQueries.ts`
- `mobile/hooks/auth/useAuth.ts`

## Solution Options

### Option A: Backend Fix (Recommended)
Add `operational_status` to the `/auth/check-user` response for shops in `backend/src/routes/auth.ts`:

```typescript
// Around line 435-455 in /auth/check-user endpoint
return res.json({
  exists: true,
  type: 'shop',
  user: {
    id: shop.shopId,
    shopId: shop.shopId,
    // ... existing fields ...
    operational_status: shop.operational_status,  // ADD THIS
    rcg_balance: shop.rcg_balance,                // ADD THIS for display
    rcg_tier: shop.rcg_tier,                      // ADD THIS
    subscriptionActive: shop.subscriptionActive,  // ADD THIS
  }
});
```

Note: This won't sync RCG balance from blockchain like the web does. Consider also syncing in this endpoint or calling the sync separately.

### Option B: Mobile Fix (Call separate endpoint)
After login, have mobile call `/shops/wallet/:address` to get full shop data including synced `operational_status`:

```typescript
// In useAuth.ts after successful login for shop type
if (result.type === 'shop') {
  // Fetch full shop data with synced operational_status
  const shopData = await apiClient.get(`/shops/wallet/${normalizedAddress}`);
  setUserProfile({
    ...result.user,
    ...shopData.data,
  });
}
```

### Option C: Both (Most robust)
1. Add `operational_status` to `/auth/check-user` for immediate availability
2. Also have mobile call `/shops/wallet/:address` to ensure RCG balance sync

## Testing Checklist

- [ ] Login as RCG holder shop (1000+ RCG balance)
- [ ] Navigate to Buy RCN screen
- [ ] Verify subscription modal does NOT appear
- [ ] Verify can purchase RCN directly
- [ ] Login as non-qualified shop (no subscription, <10000 RCG)
- [ ] Verify subscription modal DOES appear
- [ ] Login as subscribed shop
- [ ] Verify can purchase RCN directly

## Test Scenarios

### Scenario 1: RCG Qualified Shop
- Use a shop account with RCG balance >= 10,000
- Expected: Can purchase RCN directly without subscription modal

### Scenario 2: Subscription Qualified Shop
- Use a shop account with active Stripe subscription
- Expected: Can purchase RCN directly without subscription modal

### Scenario 3: Non-Qualified Shop
- Use a shop account with no subscription AND RCG balance < 10,000
- Expected: Subscription modal appears correctly

**Note**: The RCG qualification threshold is 10,000 RCG (not 1,000).

## References

- Web implementation: `frontend/src/services/api/shop.ts` - `getShopByWallet()`
- Web qualification check: `frontend/src/components/shop/ShopDashboardClient.tsx` lines 319-324
- Backend shop endpoint: `backend/src/domains/shop/routes/index.ts` lines 230-380
- Mobile purchase flow: `mobile/feature/buy-token/screens/BuyTokenScreen.tsx`
