# Bug: Total Redeemed Value Mismatch Between Web and Mobile

**Status:** Open
**Priority:** High
**Est. Effort:** 2-3 hrs
**Created:** 2026-04-16
**Updated:** 2026-04-16

---

## Problem

The "Total Redeemed" value differs between web and mobile for the same customer. For customer "Qua Ting":

- **Web** ("Tokens Redeemed"): **281 RCN**
- **Mobile** ("Total Redeemed"): **305 RCN**

These are supposed to show the same metric but pull from different data sources that have diverged.

---

## Root Cause

Web and mobile read from different data sources:

| | Source | Value | Refunds subtracted? | Includes `redeem` type? |
|---|---|---|---|---|
| **Web** | `GET /tokens/balance/:address` → sums `transactions` table | 281 RCN | Yes (-54 refunded) | Yes (+30) |
| **Mobile** | `GET /customers/:address` → `customers.total_redemptions` column | 305 RCN | No | No |

### Web (correct — transaction-based)

**File:** `backend/src/repositories/TransactionRepository.ts` (lines 181-193)

```sql
SELECT COALESCE(SUM(CASE
  WHEN type IN ('redeem', 'service_redemption') THEN amount
  WHEN type = 'service_redemption_refund' THEN -amount
  ELSE 0
END), 0) as total_redeemed
FROM transactions
WHERE customer_address = $1
```

This correctly:
- Sums `redeem` transactions (shop-initiated redemptions): +30
- Sums `service_redemption` transactions (booking discount redemptions): +305
- Subtracts `service_redemption_refund` transactions: -54
- **Net total: 281 RCN**

### Mobile (stale — profile column)

**File:** `mobile/feature/redeem-token/hooks/queries/useCustomerRedeemData.ts` (line 30)

```typescript
const totalRedeemed = customerData?.customer?.totalRedemptions || 0;
```

Reads `customers.total_redemptions` directly from the customer profile. This column:
- Gets incremented on `service_redemption` (+305)
- Does NOT get decremented on `service_redemption_refund` (-54 missed)
- Does NOT include `redeem` type transactions (+30 missed)
- **Stale total: 305 RCN**

### Database proof (customer "Qua Ting")

| Transaction Type | Count | Total |
|---|---|---|
| `service_redemption` | 4 | 305 RCN |
| `service_redemption_refund` | 2 | -54 RCN |
| `redeem` | 3 | 30 RCN |
| **Net redeemed** | | **281 RCN** |
| `customers.total_redemptions` | | **305 RCN** (out of sync) |

---

## Fix Options

### Option A: Mobile reads from token balance endpoint (recommended)

Change mobile to use the same data source as web — `GET /tokens/balance/:address` — which returns the transaction-based `totalRedeemed`.

**File:** `mobile/feature/redeem-token/hooks/queries/useCustomerRedeemData.ts`

```typescript
// Before (reads stale profile column):
const totalRedeemed = customerData?.customer?.totalRedemptions || 0;

// After (reads from token balance endpoint):
const totalRedeemed = balanceData?.totalRedeemed || 0;
```

The mobile redeem screen already fetches balance data via `useTokenQueries` — the `totalRedeemed` field from `/tokens/balance/:address` is already available. Just need to use it instead of the profile column.

**Also update `totalBalance` calculation:**

```typescript
// Before (calculated from profile columns):
const totalBalance =
  (customerData?.customer?.lifetimeEarnings || 0) -
  (customerData?.customer?.totalRedemptions || 0);

// After (use the balance endpoint's availableBalance directly):
const totalBalance = balanceData?.availableBalance || 0;
```

### Option B: Fix the `total_redemptions` column sync (backend)

Ensure the `total_redemptions` column is decremented on refunds and incremented on `redeem` type transactions. This fixes the root cause but still leaves two sources of truth.

**Files to check:**
- Refund handler — does it decrement `total_redemptions`? (likely missing)
- `redeem` transaction handler — does it increment `total_redemptions`? (likely missing)

### Option C: Both (recommended for full fix)

Apply Option A (mobile uses transaction-based data) AND Option B (fix the column sync so other consumers aren't affected).

---

## Files to Modify

### Option A (mobile fix):

| File | Change |
|------|--------|
| `mobile/feature/redeem-token/hooks/queries/useCustomerRedeemData.ts` | Use `balanceData.totalRedeemed` instead of `customerData.customer.totalRedemptions` |

### Option B (backend fix):

| File | Change |
|------|--------|
| Backend refund handler (service_redemption_refund) | Decrement `customers.total_redemptions` on refund |
| Backend redeem handler (shop redeem) | Increment `customers.total_redemptions` on `redeem` type |

---

## Verification Checklist

- [ ] Mobile "Total Redeemed" matches web "Tokens Redeemed" for same customer
- [ ] After a service redemption refund, both values decrease
- [ ] After a shop-initiated redemption (`redeem` type), both values increase
- [ ] Query database: `customers.total_redemptions` matches `SUM(transactions)` for test customer
- [ ] Customer "Qua Ting": both web and mobile show 281 RCN (or correct current value)
- [ ] New customer with 0 redemptions: both show 0

---

## Notes

- The `customers.total_redemptions` column is a denormalized counter that has drifted out of sync with the transactions table. The transaction-based calculation is the source of truth.
- This same pattern (profile column vs transaction sum) could affect other counters like `lifetime_earnings`. Worth auditing if those also diverge.
- The web balance endpoint (`GET /tokens/balance/:address`) already does the correct aggregation — mobile just needs to use it.
- A one-time data migration may be needed to reconcile existing `total_redemptions` values across all customers if Option B is applied.
