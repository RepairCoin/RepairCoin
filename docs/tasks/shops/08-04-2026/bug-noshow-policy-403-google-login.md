# Bug: No-Show Policy Tab Returns 403 for Google Login Shops

## Status: Fixed (2026-04-08)
## Priority: High
## Date: 2026-04-08
## Category: Bug - Settings / Authorization
## Affected: Shop Settings → No-Show Policy tab (web)

---

## Overview

When a shop logged in via Google (social login) navigates to Settings → No-Show Policy, the tab shows "Unauthorized: You can only view your own shop policy" with a 403 error. Works fine for MetaMask login.

Same root cause as the email preferences 403 bug — wallet address comparison fails for social login.

---

## Root Cause

**File:** `backend/src/domains/ServiceDomain/controllers/NoShowPolicyController.ts`

All 3 endpoints (GET, PUT, POST/initialize) verified shop ownership by comparing `shop.walletAddress` with `req.user?.address`:

```typescript
if (shop.walletAddress.toLowerCase() !== userAddress) {
  return res.status(403).json({ error: 'Unauthorized' });
}
```

For Google login, `req.user.address` differs from `shop.walletAddress` → 403.

---

## Fix Applied

Replaced wallet address comparison with `req.user?.shopId` in all 3 endpoints:

```typescript
const userShopId = req.user?.shopId;
if (!userShopId || userShopId !== shopId) {
  return res.status(403).json({ error: 'Unauthorized' });
}
```

Also removed unnecessary DB query to fetch shop record just for authorization — shopId from JWT is sufficient.

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/domains/ServiceDomain/controllers/NoShowPolicyController.ts` | GET, PUT, POST: use shopId comparison, fix logger references |

---

## QA Test Plan

1. Login as shop via **Google** → Settings → No-Show Policy
2. **Expected**: Policy loads without error
3. Toggle settings → Save → **Expected**: Saves successfully
4. Login via **MetaMask** → same page → **Expected**: Still works
