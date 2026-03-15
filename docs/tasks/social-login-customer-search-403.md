# Customer Search 403 Error on Social Login (Google)

## Status: ✅ FIXED

**Priority:** High
**Area:** Backend - ManualBookingController
**Reported:** March 5, 2026
**Shop:** Peanut (social login via Google)

---

## Problem Statement

When a shop owner logs in via social login (Google) instead of MetaMask, searching for customers in the manual booking modal fails with:

```
403 — "You do not have permission to search customers for this shop"
```

The same search works correctly when logged in via MetaMask.

---

## Root Cause

### Wallet address mismatch between MetaMask and social login

`ManualBookingController.ts` used `req.user?.address` (the connected wallet) to verify shop ownership by matching against `shops.wallet_address`:

```sql
SELECT shop_id FROM shops WHERE shop_id = $1 AND LOWER(wallet_address) = LOWER($2)
```

**MetaMask login**: `req.user.address` = MetaMask wallet = `shops.wallet_address` → **MATCH** ✓

**Social login (Google)**:
1. Thirdweb generates a different wallet for the Google account
2. The `/auth/shop` endpoint finds the shop via **email fallback** (not wallet)
3. JWT is issued with `address: googleWallet` and `shopId: 'peanut'`
4. `req.user.address` = Google wallet ≠ `shops.wallet_address` (MetaMask wallet) → **NO MATCH** ✗

### Affected endpoints (all 4 in ManualBookingController.ts)

| Function | Endpoint | Error |
|----------|----------|-------|
| `createManualBooking` | `POST /shops/:shopId/appointments/manual` | 403 |
| `searchCustomers` | `GET /shops/:shopId/customers/search` | 403 |
| `getPaymentLink` | `GET /shops/:shopId/appointments/:orderId/payment-link` | 403 |
| `regeneratePaymentLink` | `POST /shops/:shopId/appointments/:orderId/regenerate-payment-link` | 403 |

---

## Fix Applied

Replaced wallet address SQL matching with `req.user?.shopId` comparison from the JWT token. The auth middleware already validates the user and sets `shopId` — this works for both MetaMask and social login.

**Before:**
```typescript
const shopAdminAddress = req.user?.address;
const shopCheck = await pool.query(
  'SELECT shop_id FROM shops WHERE shop_id = $1 AND LOWER(wallet_address) = LOWER($2)',
  [shopId, shopAdminAddress]
);
if (shopCheck.rows.length === 0) {
  res.status(403).json({ error: '...' });
}
```

**After:**
```typescript
if (!req.user?.shopId || req.user.shopId !== shopId) {
  res.status(403).json({ error: '...' });
  return;
}
```

For endpoints that need shop data (`createManualBooking`, `regeneratePaymentLink`), the shop query was kept but without the wallet address condition:
```sql
SELECT shop_id, name FROM shops WHERE shop_id = $1
```

### What won't break
- MetaMask login: `req.user.shopId` is set the same way → still works
- `shopAdminAddress` is still available for tracking (`bookedBy`, `senderAddress` fields)
- Admin wallet lookups in `AdminRepository.ts` are unaffected (different use case)
- No other controllers use this wallet-matching pattern for shop authorization

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/domains/ServiceDomain/controllers/ManualBookingController.ts` | Replaced wallet address auth check with `req.user.shopId` in all 4 endpoints |

---

## Testing

1. Login via MetaMask → search customers in manual booking → should work ✓
2. Login via Google (social login) → search customers → should now work ✓
3. Login via Google → create manual booking → should work ✓
4. Login via Google → regenerate payment link → should work ✓
5. Try accessing another shop's endpoint with wrong shopId → should get 403 ✓
