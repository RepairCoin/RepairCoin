# Bug: "Shop data not loaded or wallet not connected" Blocks Purchase

## Status: Fixed (2026-04-08)
## Priority: High
## Date: 2026-04-08
## Category: Bug - Shop Dashboard / Purchase Flow
## Affected: Shop Buy Credits (web — staging + localhost)

---

## Overview

When clicking "Complete Purchase" on the Buy Credits page, the error "Shop data not loaded or wallet not connected" appears even though the shop is logged in and data is visible on the dashboard. This happens intermittently on staging and consistently on localhost when the backend restarts (nodemon).

---

## Root Cause (Two Issues)

### Issue 1: Unnecessary wallet address check

**File:** `frontend/src/components/shop/ShopDashboardClient.tsx` line 846

```typescript
if (!shopData || !account?.address) {
  toast.error("Shop data not loaded or wallet not connected");
  return;
}
```

`account` comes from Thirdweb's `useActiveAccount()` — it can be null if:
- Wallet disconnected while page is open
- MetaMask locked
- Browser tab backgrounded and Thirdweb lost WalletConnect session
- Network switch

But the purchase API only needs `shopId` from the JWT cookie — **wallet address is not needed** for Stripe checkout. The check is overly strict.

### Issue 2: No retry after shop data load failure

**File:** `frontend/src/components/shop/ShopDashboardClient.tsx` lines 386-406

When `loadShopData()` fails (e.g., 401 during backend restart, network blip), it sets `error` state but `shopData` stays null. The useEffect that triggers `loadShopData` has a guard `!shopData` — but since the dependencies (`account?.address`, `userProfile`) haven't changed, React doesn't re-run the effect. Shop data never recovers without a manual page refresh.

---

## Fix Applied

### Fix 1: Remove wallet address check from purchase

```typescript
// Before:
if (!shopData || !account?.address) {
  toast.error("Shop data not loaded or wallet not connected");
}

// After:
if (!shopData) {
  toast.error("Shop data not loaded. Please refresh the page.");
}
```

The Stripe checkout API call only sends `{ amount }` — the backend reads `shopId` from the JWT auth cookie. Wallet address is not involved.

### Fix 2: Auto-retry shop data loading after failure

Added a new useEffect that retries `loadShopData` after 5 seconds if there was an error:

```typescript
useEffect(() => {
  if (error && !shopData && !loading) {
    const retryTimer = setTimeout(() => {
      setError(null);
      loadShopData(true); // force refresh, bypass cache
    }, 5000);
    return () => clearTimeout(retryTimer);
  }
}, [error, shopData, loading]);
```

This handles:
- Backend restart (401 → token refresh → retry succeeds)
- Temporary network blip (retry after 5s)
- Staging deployment (brief downtime → auto-recovery)

---

## Why It Triggered on Staging

The Thirdweb wallet connection can drop during idle periods. On staging, if the user was idle or the browser tab was backgrounded, `useActiveAccount()` returns null. The old check `!account?.address` then blocks the purchase even though the auth session (JWT cookie) is still valid and shop data is loaded.

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/shop/ShopDashboardClient.tsx:846` | Removed `!account?.address` from purchase guard |
| `frontend/src/components/shop/ShopDashboardClient.tsx` | Added auto-retry useEffect for shop data load failure |

---

## QA Test Plan

### Fix 1: Purchase without wallet
1. Login as shop → go to Buy Credits
2. Disconnect MetaMask (or lock it)
3. Click Complete Purchase
4. **Before fix**: "Shop data not loaded or wallet not connected"
5. **After fix**: Purchase proceeds (or "Shop data not loaded" only if data truly missing)

### Fix 2: Auto-retry
1. Login as shop → dashboard loads
2. Restart the backend (kill and restart)
3. Refresh the page
4. **Before fix**: "Failed to load shop data" — stays broken until manual refresh
5. **After fix**: Error appears briefly, then auto-retries after 5 seconds and loads successfully
