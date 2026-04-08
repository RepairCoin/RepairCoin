# Bug: Email Preferences Tab Returns 403 "Unauthorized"

## Status: Fixed (2026-04-08)
## Priority: High
## Date: 2026-04-08
## Category: Bug - Settings / Authorization
## Affected: Shop Settings → Emails tab (web)

---

## Overview

When a shop navigates to Settings → Emails, the tab shows "Failed to load email preferences" with a 403 error: "Unauthorized: You can only view your own email preferences." This happens even though the shop is properly logged in.

---

## Root Cause

**File:** `backend/src/domains/ServiceDomain/controllers/EmailPreferencesController.ts`

The GET and PUT endpoints for email preferences verified shop ownership by comparing `shop.walletAddress` with `req.user?.address` from the JWT:

```typescript
if (shop.walletAddress.toLowerCase() !== userAddress) {
  return res.status(403).json({ error: 'Unauthorized: You can only view your own email preferences' });
}
```

This fails when:
- Shop uses **social login** (Google/email) — `req.user.address` may differ from `shop.walletAddress`
- Shop wallet address changed after registration
- Case sensitivity mismatch between stored address and JWT address
- The `walletAddress` field is null or empty in the DB

---

## Fix Applied

Replaced wallet address comparison with `shopId` comparison from the JWT — simpler, more reliable, and works for all login methods:

```typescript
// Before:
const shop = await shopRepository.getShop(shopId);
if (shop.walletAddress.toLowerCase() !== userAddress) { ... }

// After:
const userShopId = req.user?.shopId;
if (!userShopId || userShopId !== shopId) { ... }
```

Applied to both GET and PUT endpoints. Also removed remaining debug `console.error` statements.

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/domains/ServiceDomain/controllers/EmailPreferencesController.ts` | Both GET/PUT: use `req.user.shopId` instead of wallet address comparison, removed debug console.error |

---

## QA Test Plan

1. Login as shop → Settings → Emails
2. **Expected**: Email preferences load without error
3. Toggle a preference → Save
4. **Expected**: Saves successfully
5. Refresh page → preferences persist
6. Test with social login shop (Google) → should also work
