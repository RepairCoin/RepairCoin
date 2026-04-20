# Bug: Mobile redemption still always detected as cross-shop — 2026-04-16 fix was incomplete

**Status:** Open
**Priority:** Critical
**Est. Effort:** 45 minutes
**Created:** 2026-04-20
**Updated:** 2026-04-20

---

## Problem

Reopening the redemption home-shop detection bug. The 2026-04-16 fix (commit `48717c1d`, documented in `completed/bug-redemption-always-cross-shop.md`) addressed the field-name typo but did not resolve the underlying user-facing behavior. On current `origin/main` and `origin/prod`, the mobile "Process Redemption" screen **still** treats every redemption as cross-shop — even for customers at their home shop.

Reproduction on staging as of 2026-04-20:

- Customer: `Qua Ting` (wallet `0x6cd036477d1c39da021095a62a32c6bb919993cf`)
- Shop: `peanut`
- Database confirms: `customers.home_shop_id = 'peanut'`; 23 earning transactions at `peanut`
- Expected mobile behavior: "Home Shop" badge, full-balance redemption
- Actual mobile behavior: "Cross-Shop Redemption" badge, 20% cap

---

## Root Cause

`hasEarnedAtShop` at `mobile/shared/services/customer.services.ts:87-104` filters the customer's transaction list by an outdated set of transaction-type strings that do not match what the backend returns.

### The mismatch

**Backend** transforms DB type names before returning them to the API in `backend/src/domains/customer/services/CustomerService.ts:313`:

```ts
type: tx.type === 'mint' ? 'earned' : tx.type === 'redeem' ? 'redeemed' : tx.type
```

So the API always returns `'earned'`, never `'earn'` or `'mint'` or `'reward'`.

**Mobile** filters for the wrong set of strings at `customer.services.ts:97-99`:

```ts
return transactions.some(
  (tx: any) =>
    tx.shopId === shopId &&
    (tx.type === 'earn' || tx.type === 'mint' || tx.type === 'reward')
);
```

None of those three values ever appear in the API response. The filter never matches. `hasEarnedAtShop` returns `false` for every shop-customer combination, which means `isHomeShop = false` for every redemption.

### Why the 2026-04-16 fix didn't catch this

The earlier fix only corrected `shopData?.id` → `shopData?.shopId` in `useCustomerLookup.ts`. Before that fix, `shopData.id` was always `undefined`, so `hasEarnedAtShop` was never called at all — the ternary short-circuited to `Promise.resolve(false)`. Once the field-name fix landed, `hasEarnedAtShop` started being called with the correct `shopId`, but it still returns `false` because of this independent type-string mismatch. The user-observable symptom is identical to before the fix.

The fix's verification checklist was marked `[x]` for "Home Shop badge shown" but the actual end-to-end behavior was not tested against a real customer with a known home shop.

---

## Evidence

End-to-end reproduction against the live staging API on 2026-04-20:

- `GET /api/shops/wallet/:address` returns `shop.shopId = "peanut"`, `shop.id = undefined` — field-name fix is correct and `shopData.shopId` flows through as expected.
- `GET /api/customers/:address/transactions?limit=100` for Qua Ting returns 55 transactions. Distinct `type` values in the response: `earned, tier_bonus, service_redemption, cancelled_redemption, rejected_redemption, transfer_in, redeemed, service_redemption_refund`. **No `earn`, `mint`, or `reward` anywhere in the response.**
- Counts of each type at `shopId === 'peanut'` for Qua Ting in the response:
  - `earned`: 23
  - `tier_bonus`: 5
  - `service_redemption`: 4
  - `rejected_redemption`: 5
  - `redeemed`: 3
  - `service_redemption_refund`: 2
  - `cancelled_redemption`: 1
- Running the exact mobile filter logic (`.some(tx => tx.shopId === 'peanut' && ['earn','mint','reward'].includes(tx.type))`) against the same response: returns **`false`**.
- DB ground truth query confirms 23 `mint`-type rows at `shop_id='peanut'` for this customer and `customers.home_shop_id = 'peanut'`. Backend mapping is where `mint` becomes `earned` for the API consumer.

---

## Fix Required

Three options in order of robustness. Recommendation: Option B or C. Option A is the cheapest but most fragile.

### Option A — Minimal string fix (not recommended)

`mobile/shared/services/customer.services.ts` line 97-99:

```diff
  return transactions.some(
    (tx: any) =>
      tx.shopId === shopId &&
-     (tx.type === 'earn' || tx.type === 'mint' || tx.type === 'reward')
+     ['earned', 'earn', 'mint', 'reward'].includes(tx.type)
  );
```

Defensive union of API-level and DB-level type names. Still relies on this list staying in sync with backend enum changes, and still hits the 100-transaction limit for power users.

### Option B — Replace with server-side verification (recommended)

The backend already exposes this check. Use it instead of reimplementing on the client.

`mobile/feature/redeem-token/hooks/queries/useCustomerLookup.ts` line 36-41 — replace the `hasEarnedAtShop` call with a call to `/tokens/verify-redemption`:

```ts
const verifyPromise = shopData?.shopId
  ? apiClient.get(`/tokens/verify-redemption?customerAddress=${address}&shopId=${shopData.shopId}&amount=0`)
      .then((r: any) => r?.data?.isHomeShop ?? false)
      .catch(() => false)
  : Promise.resolve(false);

const [customerResponse, balanceResponse, crossShopResponse, isHomeShop] = await Promise.all([
  customerApi.getCustomerByWalletAddress(address),
  balanceApi.getCustomerBalance(address),
  customerApi.getCrossShopBalance(address).catch(() => null),
  verifyPromise,
]);
```

`hasEarnedAtShop` can then be deleted from `customer.services.ts`. Single source of truth for home-shop logic lives on the backend (`VerificationService.isCustomerHomeShop`), which uses `customers.home_shop_id` directly. No 100-transaction limit, no type-string drift, no payload waste.

### Option C — Expose `home_shop_id` on the customer profile

Add `homeShopId` to the response of `GET /customers/:address` (backend change) and compare in the mobile:

```ts
const isHomeShop = shopData?.shopId && customerData?.customer?.homeShopId === shopData.shopId;
```

No extra HTTP call. Most future-proof because it removes one layer of indirection. Requires a backend field addition and matching TypeScript interface update in `mobile/shared/interfaces/customer.interface.ts`.

---

## Files to Modify

### Option B (recommended)

| File | Change |
|------|--------|
| `mobile/feature/redeem-token/hooks/queries/useCustomerLookup.ts` | Replace `customerApi.hasEarnedAtShop(...)` call with `apiClient.get('/tokens/verify-redemption?...')` returning `isHomeShop` |
| `mobile/shared/services/customer.services.ts` | Delete the `hasEarnedAtShop` method (now unused) |

### Option C

| File | Change |
|------|--------|
| `backend/src/domains/customer/controllers/CustomerController.ts` (or wherever `/customers/:address` is built) | Include `homeShopId` in the returned customer object |
| `mobile/shared/interfaces/customer.interface.ts` | Add `homeShopId?: string \| null` to the `Customer` type |
| `mobile/feature/redeem-token/hooks/queries/useCustomerLookup.ts` | Replace `hasEarnedAtShop` call with `customerData?.customer?.homeShopId === shopData.shopId` comparison |
| `mobile/shared/services/customer.services.ts` | Delete the `hasEarnedAtShop` method (now unused) |

---

## Verification Checklist

- [ ] **Reproduce the current bug**: process a redemption for Qua Ting (`0x6cd036477d1c39da021095a62a32c6bb919993cf`) at shop `peanut` on the current staging build — confirm "Cross-Shop Redemption" badge appears and redeem cap is ~20%. This documents the pre-fix state.
- [ ] After fix: same customer + shop combo now shows "Home Shop" badge (green) with full balance available to redeem.
- [ ] Cross-shop regression check: same customer at a shop that is NOT their home shop — still shows "Cross-Shop Redemption" (amber) with 20% cap.
- [ ] Mobile badge and redemption cap match web for the same customer + shop combination.
- [ ] Power-user edge case: a customer with 100+ transactions at their home shop (older earnings outside the first 100 returned) still shows "Home Shop" correctly. Option B and C both fix this by design; Option A does not.
- [ ] Non-customer auth path: if the redemption screen is ever reached by a shop user (should not happen but worth confirming), the endpoint call still succeeds or gracefully degrades.
- [ ] Error path: if the verify-redemption endpoint (Option B) or customer endpoint (Option C) returns 5xx, `isHomeShop` defaults to `false` (safer fallback to cross-shop cap) — confirm this defensive fallback is preserved.

---

## Notes

- **Supersedes:**
  - `mobile/docs/tasks/bugs/16-04-2026/bug-redemption-home-shop-always-detected-as-cross-shop.md` (still open — same underlying symptom)
  - `mobile/docs/tasks/completed/bug-redemption-always-cross-shop.md` (marked completed, but the user-visible bug described in it persists on `main`/`prod` as of 2026-04-20)
- Both previous docs can remain where they are for history. This doc is the authoritative tracker going forward.
- **Why the earlier fix appeared to pass verification:** the checklist was ticked based on the fact that `shopData.shopId` was now being passed through correctly, not on end-to-end behavior in the app. The 2026-04-16 doc's "Home Shop badge shown" checklist item was not actually validated against a known home-shop customer on a running build.
- **Lesson to encode in future QA:** home-shop detection verification must run against a customer whose `home_shop_id` is populated in the database (e.g. Qua Ting + peanut on staging). Observing that an intermediate variable has the right value is not the same as observing the UI state change.
- **Why this is critical, not high:** every shop processing a redemption for their own customer has been silently capped at 20% since the feature shipped. Shops are actively working around this by processing redemptions in smaller chunks or refusing home-shop redemptions entirely. The backend always enforces the correct cap server-side, so there is no data-integrity risk — the bug only blocks valid redemptions.
- **Out of scope for this task:**
  - Adding a regression test that asserts `hasEarnedAtShop` / `isHomeShop` against a known home-shop fixture. Should be filed as an enhancement once the fix lands so we don't regress a third time.
  - Auditing other mobile code paths that rely on transaction `type` strings — if there are more call sites using DB-level type names against the transformed API response, they will silently misbehave the same way. Grep for `tx.type ===` / `type === "earn"` / `type === "mint"` across the mobile repo as a follow-up.
