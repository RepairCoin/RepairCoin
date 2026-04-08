# Bug: Groups Page Shows "Subscription Required" for Google Login / RCG Holders

## Status: Fixed (2026-04-08)
## Priority: High
## Date: 2026-04-08
## Category: Bug - Authorization / Subscription Guard
## Affected: /shop/groups page (web)

---

## Overview

When a shop logged in via Google (social login) navigates to /shop/groups, the page shows "Subscription Required" even if the shop has an active subscription or qualifies via RCG holdings. The subscription guard fails because it looks up the shop by wallet address, which doesn't match for Google login accounts.

---

## Root Cause

**File:** `frontend/src/hooks/useSubscriptionCheck.ts` line 64

```typescript
const result = await apiClient.get(`/shops/wallet/${walletAddress}`);
```

**File:** `frontend/src/components/shop/groups/ShopGroupsClient.tsx` line 43-44

```typescript
} = useSubscriptionCheck(
  account?.address,  // null for Google login (no MetaMask)
  ...
);
```

Two issues:
1. `account?.address` from Thirdweb's `useActiveAccount()` is null for Google login → hook returns early → `subscriptionActive: false`
2. Even with a fallback address, `/shops/wallet/{address}` endpoint may not find the shop if the Google-generated address differs from the shop's stored wallet address

---

## Fix Applied

### Fix 1: ShopGroupsClient — pass fallback address

```typescript
// Before:
} = useSubscriptionCheck(account?.address, ...);

// After:
} = useSubscriptionCheck(account?.address || userProfile?.address, ...);
```

### Fix 2: useSubscriptionCheck — fallback to JWT-based endpoint

When `/shops/wallet/{address}` fails (404), the hook now falls back to `/shops/subscription/status` which uses the JWT `shopId` — works for all login methods:

```typescript
try {
  result = await apiClient.get(`/shops/wallet/${walletAddress}`);
} catch {
  // Fallback: subscription status endpoint uses JWT shopId
  const subResult = await apiClient.get("/shops/subscription/status");
  // Map to same format...
}
```

### Why this doesn't break the subscription guard

- The guard logic (`subscriptionActive || operational_status === 'rcg_qualified'`) is unchanged
- Only the data fetching method changed — fallback when wallet lookup fails
- MetaMask login still uses wallet lookup first (fastest path)
- Google login uses JWT-based fallback (works without wallet)
- The actual subscription/RCG check is still the same server-side validation

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/hooks/useSubscriptionCheck.ts` | Added fallback to `/shops/subscription/status` when wallet lookup fails |
| `frontend/src/components/shop/groups/ShopGroupsClient.tsx` | Added `userProfile?.address` fallback, fixed loadData guard |

---

## QA Test Plan

### Google login
1. Login as shop via **Google** → navigate to /shop/groups
2. **Before fix**: "Subscription Required" modal
3. **After fix**: Groups page loads correctly

### MetaMask login (regression)
1. Login as shop via **MetaMask** → /shop/groups
2. **Expected**: Still works as before (wallet lookup succeeds)

### RCG holder without subscription
1. Login as shop with 10K+ RCG tokens (no Stripe subscription)
2. Navigate to /shop/groups
3. **Expected**: Page loads (RCG qualified bypasses subscription requirement)

### No subscription and no RCG
1. Login as shop with no subscription and no RCG
2. Navigate to /shop/groups
3. **Expected**: "Subscription Required" modal shown (correct behavior)
