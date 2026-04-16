# Bug: Redemption Home Shop Always Detected as Cross-Shop

**Status:** Open
**Priority:** Critical
**Est. Effort:** 1 hr
**Created:** 2026-04-16
**Updated:** 2026-04-16

---

## Problem

The mobile shop "Process Redemption" screen always shows "Cross-Shop Redemption" even when the customer's home shop is processing the redemption. This limits the maximum redeemable to 20% instead of 100%, making the feature unusable for home shop redemptions.

### Example (customer "Qua Ting" at shop "Peanut")

- Peanut IS Qua Ting's home shop (23 earning transactions confirmed in DB)
- **Web**: Correctly treats as home shop — full balance redemption allowed
- **Mobile**: Shows "Cross-Shop Redemption" with ~4 RCN limit — blocks valid redemptions

---

## Root Cause

**File:** `mobile/feature/redeem-token/hooks/queries/useCustomerLookup.ts` (line 40)

```typescript
shopData?.id ? customerApi.hasEarnedAtShop(address, shopData.id) : Promise.resolve(false)
```

`shopData?.id` is **always `undefined`** because the shop profile object has no `id` field — the field is called `shopId`.

**Proof:**
```
API response for /shops/wallet/:address:
  id: undefined
  shopId: "peanut"    ← correct field
```

Since `undefined` is falsy, the ternary always resolves to `Promise.resolve(false)`, making `isHomeShop = false` for **every shop**. Every redemption is treated as cross-shop.

---

## Secondary Issue: Flawed `hasEarnedAtShop` Method

Even after fixing the field name, the `hasEarnedAtShop` method has its own problems.

**File:** `mobile/shared/services/customer.services.ts` (lines 87-104)

```typescript
async hasEarnedAtShop(walletAddress: string, shopId: string): Promise<boolean> {
  const response = await apiClient.get(
    `/customers/${walletAddress}/transactions?limit=100`   // ← Only last 100 transactions
  );
  const transactions = response?.data?.transactions || [];
  return transactions.some(
    (tx: any) =>
      tx.shopId === shopId &&
      (tx.type === 'earn' || tx.type === 'mint' || tx.type === 'reward')
  );
}
```

**Problems:**
1. **100 transaction limit** — if the customer earned at this shop 101+ transactions ago, returns `false`
2. **Client-side check** — fetches 100 transactions just to check a boolean. Wasteful.
3. **No backend endpoint** — reinvents what the backend already does server-side

The backend has `VerificationService.isCustomerHomeShop()` which uses `customers.home_shop_id` and `ReferralRepository.getHomeShop()` — a proper server-side check.

The backend also has `GET /api/tokens/verify-redemption?customerAddress=X&shopId=Y` which returns `isHomeShop` as part of the response. The mobile already calls a verification endpoint during redemption session creation — but the home shop check happens earlier in the UI to show the correct badge and limits.

---

## Fix

### Fix 1: Wrong field name (critical)

**File:** `mobile/feature/redeem-token/hooks/queries/useCustomerLookup.ts` (line 40)

```typescript
// Before (broken — shopData.id is always undefined):
shopData?.id ? customerApi.hasEarnedAtShop(address, shopData.id) : Promise.resolve(false),

// After (correct field name):
shopData?.shopId ? customerApi.hasEarnedAtShop(address, shopData.shopId) : Promise.resolve(false),
```

### Fix 2: Replace client-side check with backend call (recommended)

Replace the flawed `hasEarnedAtShop` method with a call to the existing `verify-redemption` endpoint or the `no-show-status` endpoint, both of which return `isHomeShop`.

**Option A — Use verify-redemption endpoint:**

```typescript
// In useCustomerLookup.ts, replace hasEarnedAtShop call:
const verifyResponse = await apiClient.get(
  `/tokens/verify-redemption?customerAddress=${address}&shopId=${shopData.shopId}&amount=0`
);
const isHomeShop = verifyResponse?.data?.isHomeShop ?? false;
```

**Option B — Use no-show-status endpoint (already used in booking flow):**

```typescript
const noShowResponse = await appointmentApi.getCustomerNoShowStatusForShop(address, shopData.shopId);
const isHomeShop = noShowResponse?.isHomeShop ?? false;
```

**Option C — Minimal fix (just fix field name + remove limit):**

```typescript
// customer.services.ts — increase limit or remove it
const response = await apiClient.get(
  `/customers/${walletAddress}/transactions?limit=500`
);
```

---

## Files to Modify

| File | Change |
|------|--------|
| `feature/redeem-token/hooks/queries/useCustomerLookup.ts` | Fix `shopData?.id` → `shopData?.shopId` |
| `shared/services/customer.services.ts` | Replace `hasEarnedAtShop` with backend endpoint call (or increase limit) |

---

## Verification Checklist

- [ ] Customer at home shop → "Home Shop" badge (green) shown
- [ ] Customer at home shop → max redeemable = 100% of balance
- [ ] Customer at cross-shop → "Cross-Shop Redemption" badge (amber) shown
- [ ] Customer at cross-shop → max redeemable = 20% of balance
- [ ] Mobile badge matches web for same customer/shop combination
- [ ] Customer with 100+ transactions → home shop still correctly detected
- [ ] Shop with `shopId` containing special characters → still works

---

## Notes

- This bug means **every** mobile redemption has been incorrectly treated as cross-shop since the feature was built. Shops processing redemptions for their own customers have been limited to 20% when they should have had 100%.
- The web does not have this issue — it uses a different code path for home shop detection.
- The backend always enforces the correct limit via `VerificationService`, so if a shop somehow sent a higher amount for a cross-shop, it would be rejected. But the reverse is happening here — the mobile blocks valid home shop redemptions.
