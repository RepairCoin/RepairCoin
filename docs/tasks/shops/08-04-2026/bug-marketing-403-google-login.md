# Bug: Marketing Campaign Tab Returns 403 for Google Login Shops

## Status: Fixed (2026-04-08)
## Priority: High
## Date: 2026-04-08
## Category: Bug - Marketing / Authorization
## Affected: Shop Marketing → Campaigns tab (web)

---

## Overview

When a shop logged in via Google (social login) navigates to Marketing → Campaigns, the tab shows "Failed to load marketing data" with 403 errors. Same wallet address comparison bug as email preferences and no-show policy.

11 endpoints in MarketingController all compared `shop.walletAddress` with `req.user.address`, failing for Google login.

---

## Fix Applied

Replaced all 11 wallet address comparisons with `req.user?.shopId` check. Two patterns:

**For shop-scoped routes** (shopId in URL params):
```typescript
const userShopId = req.user?.shopId;
if (!userShopId || userShopId !== shopId) { ... }
```

**For campaign-scoped routes** (campaignId in URL, check campaign.shopId):
```typescript
if (!req.user?.shopId || req.user.shopId !== campaign.shopId) { ... }
```

Also removed unnecessary shop DB fetches from auth checks (kept only where shop data is needed for business logic like sending campaign emails).

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/domains/MarketingDomain/controllers/MarketingController.ts` | All 11 methods: shopId comparison instead of wallet address |

---

## Verification: No More Wallet Auth Comparisons

Searched entire `src/domains/` directory — zero remaining `shop.walletAddress !== userAddress` patterns in any controller. All three affected controllers are fixed:
- EmailPreferencesController ✓
- NoShowPolicyController ✓
- MarketingController ✓
