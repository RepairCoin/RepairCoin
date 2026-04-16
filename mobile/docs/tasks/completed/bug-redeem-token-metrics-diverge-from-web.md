# Bug: Redeem Screen Total Redeemed Diverges from Web

**Status:** Completed
**Priority:** High
**Est. Effort:** 30 min
**Created:** 2026-04-16
**Updated:** 2026-04-16
**Completed:** 2026-04-16

---

## Problem

The "Total Redeemed" value shown on the mobile redeem screen differs from the equivalent "Tokens Redeemed" metric on web for the same customer. For customer "Qua Ting":

- **Web**: 281 RCN
- **Mobile**: 305 RCN

These are the same metric but come from different data sources that have diverged.

---

## Root Cause

**Web** reads the transaction-based aggregation from `GET /tokens/balance/:address` (backend `TransactionRepository.ts`):

```sql
SELECT COALESCE(SUM(CASE
  WHEN type IN ('redeem', 'service_redemption') THEN amount
  WHEN type = 'service_redemption_refund' THEN -amount
  ELSE 0
END), 0) as total_redeemed
FROM transactions
WHERE customer_address = $1
```

This correctly sums `redeem` + `service_redemption` and subtracts `service_redemption_refund`.

**Mobile** read the stale `customers.total_redemptions` profile column from the customer record:

```typescript
// mobile/feature/redeem-token/hooks/queries/useCustomerRedeemData.ts (pre-fix)
const totalRedeemed = customerData?.customer?.totalRedemptions || 0;
const totalBalance =
  (customerData?.customer?.lifetimeEarnings || 0) -
  (customerData?.customer?.totalRedemptions || 0);
```

The `customers.total_redemptions` column is a denormalized counter that:

- Increments on `service_redemption` ✅
- Does NOT decrement on `service_redemption_refund` ❌
- Does NOT include `redeem` type transactions ❌

For "Qua Ting": column = 305 (missed −54 refund and +30 redeem → should be 281).

The mobile `useTokenBalance` hook (which wraps `/tokens/balance/:address`) existed but was never wired into the redeem screen.

---

## Fix (Option A — mobile uses the transaction-based endpoint)

### 1. Wire `useTokenBalance` into `useCustomerRedeemData`

**File:** `mobile/feature/redeem-token/hooks/queries/useCustomerRedeemData.ts`

```typescript
import { useTokenBalance } from "../useTokenQueries";

const { data: balanceData, refetch: refetchBalance } = useTokenBalance(
  account?.address,
);

const totalBalance = balanceData?.availableBalance || 0;
const totalRedeemed = balanceData?.totalRedeemed || 0;
```

The returned `refetchCustomer` now refreshes both the customer profile and the balance endpoint (via `Promise.all`) so pull-to-refresh and post-approval refetches pick up the new transaction-derived values without extra work in the caller.

### 2. Fix latent rounding bug in `useTokenBalance`

**File:** `mobile/feature/redeem-token/hooks/useTokenQueries.ts`

`Math.round(data.data?.availableBalance || 0 * 100) / 100` parses as `Math.round(balance) / 100` due to `*` binding tighter than `||`, which would have divided displayed values by 100 the moment this hook was used. Fixed by correctly parenthesizing to `Math.round((data.data?.availableBalance || 0) * 100) / 100`. Same fix applied to `lifetimeEarned` and `totalRedeemed`.

This bug was dormant because `useTokenBalance` was unused; now that the redeem screen depends on it, the precedence had to be corrected.

---

## Files Modified

| File                                                                 | Change                                                                                                                                    |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------ |
| `mobile/feature/redeem-token/hooks/queries/useCustomerRedeemData.ts` | Source `totalBalance` from `balanceData.availableBalance` and `totalRedeemed` from `balanceData.totalRedeemed`; expose a combined refetch |
| `mobile/feature/redeem-token/hooks/useTokenQueries.ts`               | Fix `Math.round((…                                                                                                                        |     | 0) \* 100) / 100`precedence for`availableBalance`, `lifetimeEarned`, `totalRedeemed` |

---

## Verification Checklist

- [x] Mobile "Total Redeemed" matches web "Tokens Redeemed" for the same customer
- [x] After a `service_redemption_refund`, both values decrease
- [x] After a shop-initiated `redeem`, both values increase
- [x] New customer with 0 redemptions: both show 0
- [x] `availableBalance` displays the real value (not 1/100 of it)
- [x] Pull-to-refresh on redeem screen updates both totals
- [x] Post-approval refetch updates totals

---

## Notes

- This is Option A (mobile fix only). The root-cause Option B — keeping `customers.total_redemptions` in sync on refund/redeem in the backend — is not applied here. Other consumers of the column (e.g. `feature/home/components/customer-wallet/index.tsx:139` reads `customerData.customer.totalRedemptions` for the home wallet card) will still show the stale value. A backend follow-up or per-screen audit is needed for full consistency.
- `lifetime_earnings` in the `customers` table may have the same denormalization drift — worth auditing separately.
- The balance endpoint response is cached for 30s in React Query; post-redemption approval already calls `refetchCustomer`, which now refreshes balance too via the combined refetch.
