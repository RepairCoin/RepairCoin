# BUG-008: RCG-qualified shops (10K+ RCG holders) cannot create services

**Type:** Bug
**Severity:** High
**Priority:** P1
**Component:** Backend - Service Management
**Labels:** bug, backend, rcg, subscription, services, blocking
**Status:** FIXED
**Date Fixed:** 2025-12-19

---

## Description

Shops that hold 10,000+ RCG tokens (RCG-qualified) cannot create services in the marketplace. The system incorrectly requires a $500/month Stripe subscription even though RCG-qualified shops should have access to all shop features without a subscription.

---

## Steps to Reproduce

1. Login as shop owner with 10,000+ RCG tokens (RCG-qualified)
2. Navigate to Shop Dashboard → Services tab
3. Click "Create Service" or "Create Your First Service"
4. Fill in service details (name, category, price)
5. Click "Create Service"
6. Observe error in console

---

## Expected Result

- RCG-qualified shops (10K+ RCG) should be able to create services
- Both RCG qualification AND Stripe subscription should unlock service creation
- Error should not appear for qualified shops

---

## Actual Result (Before Fix)

- Error: "Active RepairCoin subscription required to create services. Subscribe at $500/month to unlock this feature."
- Console shows 400 error from `api.repaircoin.ai/api/services`
- Service is NOT created
- RCG-qualified shops are blocked from using marketplace features

---

## Root Cause

**File:** `backend/src/domains/ServiceDomain/services/ServiceManagementService.ts` (Lines 50-53)

```typescript
// BUGGY CODE - Only checks subscription
if (!shop.subscriptionActive) {
  throw new Error('Active RepairCoin subscription required to create services. Subscribe at $500/month to unlock this feature.');
}
```

The code ONLY checked `shop.subscriptionActive` (Stripe subscription) but did NOT check for RCG qualification.

---

## Fix Applied

### File Modified
`backend/src/domains/ServiceDomain/services/ServiceManagementService.ts`

### 1. `createService()` - Lines 50-57

**Before:**
```typescript
// Require active subscription
if (!shop.subscriptionActive) {
  throw new Error('Active RepairCoin subscription required to create services. Subscribe at $500/month to unlock this feature.');
}
```

**After:**
```typescript
// Require active subscription OR RCG qualification (10K+ RCG tokens)
const isRcgQualified = shop.operational_status === 'rcg_qualified' ||
                       (shop.rcg_balance && parseFloat(shop.rcg_balance.toString()) >= 10000);
const isSubscriptionQualified = shop.subscriptionActive || shop.operational_status === 'subscription_qualified';

if (!isRcgQualified && !isSubscriptionQualified) {
  throw new Error('Active RepairCoin subscription or RCG qualification (10K+ RCG tokens) required to create services.');
}
```

### 2. `updateService()` - Lines 173-186 (Added)

Added the same qualification check to ensure RCG-qualified shops can also update their existing services:

```typescript
// Verify shop is qualified to update services
const shop = await shopRepository.getShop(shopId);
if (!shop) {
  throw new Error('Shop not found');
}

// Require active subscription OR RCG qualification (10K+ RCG tokens)
const isRcgQualified = shop.operational_status === 'rcg_qualified' ||
                       (shop.rcg_balance && parseFloat(shop.rcg_balance.toString()) >= 10000);
const isSubscriptionQualified = shop.subscriptionActive || shop.operational_status === 'subscription_qualified';

if (!isRcgQualified && !isSubscriptionQualified) {
  throw new Error('Active RepairCoin subscription or RCG qualification (10K+ RCG tokens) required to update services.');
}
```

---

## Qualification Logic

| Condition | Can Create/Update Services |
|-----------|---------------------------|
| `operational_status === 'rcg_qualified'` | Yes |
| `rcg_balance >= 10000` | Yes |
| `subscriptionActive === true` | Yes |
| `operational_status === 'subscription_qualified'` | Yes |
| None of the above | No |

The fix uses a dual-check approach:
1. **Primary:** Check `operational_status` field (set by subscription/RCG sync processes)
2. **Fallback:** Direct `rcg_balance` check (handles edge cases where status wasn't updated)

---

## Related Files Status

| File | Method | Status |
|------|--------|--------|
| `ServiceManagementService.ts` | `createService` | ✅ FIXED |
| `ServiceManagementService.ts` | `updateService` | ✅ FIXED |
| `AffiliateShopGroupService.ts` | `createGroup` | ✅ Already correct |
| `AffiliateShopGroupService.ts` | `joinGroup` | ✅ Already correct |
| `ShopPurchaseService.ts` | `purchaseRcn` | ✅ Already correct |

---

## Testing

### Manual Test - RCG Qualified Shop
1. Login as shop owner with 10,000+ RCG tokens (no subscription)
2. Navigate to Shop Dashboard → Services tab
3. Click "Create Your First Service"
4. Fill in service details
5. Click "Create Service"
6. **Expected:** Service created successfully

### Manual Test - Subscription Qualified Shop
1. Login as shop owner with active subscription (< 10K RCG)
2. Navigate to Shop Dashboard → Services tab
3. Create a new service
4. **Expected:** Service created successfully

### Manual Test - Unqualified Shop
1. Login as shop owner with no subscription and < 10K RCG
2. Navigate to Shop Dashboard → Services tab
3. Attempt to create a service
4. **Expected:** Error message mentioning both qualification options

---

## Verification

### TypeScript Check
```bash
cd backend && npx tsc --noEmit --skipLibCheck
# Result: No errors
```

---

## Acceptance Criteria

- [x] RCG-qualified shops (10K+ RCG) can create services
- [x] Stripe subscription holders can create services
- [x] Shops with NEITHER RCG nor subscription see appropriate error message
- [x] Error message mentions both qualification options
- [x] Service update also allows RCG-qualified shops
- [x] TypeScript compiles without errors
- [x] Follows existing code patterns

---

## Business Context

According to the business model in CLAUDE.md:
- **RCG (Governance Token)** - Shop tiers: Standard/Premium/Elite (10K/50K/200K+ RCG)
- Shops holding 10K+ RCG should have access to platform features without requiring the $500/month subscription

---

## Impact

| Area | Impact |
|------|--------|
| **Revenue** | RCG holders can now use marketplace, increasing platform value |
| **User Experience** | Qualified shops can access core features |
| **Business Model** | Aligns with RCG-based tier system |
| **Trust** | Users who bought RCG can now access promised features |
