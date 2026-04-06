# Bug: Customer RCN Balance Shows 0 — Wrong Calculation Method

## Status: Open
## Priority: High
## Date: 2026-04-06
## Category: Bug - Balance Display
## Affected: Customer home screen (mobile only)

---

## Overview

The mobile customer home screen shows 0 RCN balance while the web shows the correct balance. The mobile calculates balance client-side using `lifetimeEarnings - totalRedemptions` instead of using the `currentRcnBalance` field that the backend already provides. This calculation is both incorrect (doesn't account for transfers, refunds, etc.) and may produce 0 if the fields fail to load.

---

## Example

A customer with the following DB state:

```
current_rcn_balance:  155.00  ← authoritative balance (what web uses)
lifetime_earnings:    295.00
total_redemptions:    150.00
```

- **Web displays**: 155 RCN (correct — uses `currentRcnBalance`)
- **Mobile calculates**: `295 - 150 = 145` (wrong — misses transfers/refunds)
- **Mobile actually shows**: 0 RCN (fields likely not loading or named differently)

---

## Root Cause

**`mobile/feature/home/components/customer-wallet/index.tsx`** lines 87-89:

```typescript
const totalBalance =
  (customerData?.customer?.lifetimeEarnings || 0) -
  (customerData?.customer?.totalRedemptions || 0);
```

### Two problems:

1. **Wrong calculation** — `lifetimeEarnings - totalRedemptions` doesn't account for transfers in/out, refunds, service redemption refunds, cancelled redemptions, etc. The backend maintains `current_rcn_balance` as the authoritative balance that includes all these adjustments.

2. **Showing 0** — Even the wrong calculation should show 145, not 0. This means `customerData?.customer?.lifetimeEarnings` is falsy (undefined/null/0), which suggests either:
   - The API response structure doesn't match what the mobile expects
   - The customer data query failed silently
   - The field name in the response doesn't match `lifetimeEarnings`

### How Web Gets It Right

The web uses `balanceData.availableBalance` from a dedicated balance endpoint in `VerificationService.ts`, or reads `currentRcnBalance` from the customer profile. It does NOT calculate balance from lifetime earnings minus redemptions.

### Backend Response Includes the Correct Field

`CustomerRepository.ts` line 127:
```typescript
currentRcnBalance: row.current_rcn_balance ? parseFloat(row.current_rcn_balance) : 0,
```

The backend returns `currentRcnBalance: 155` in the customer profile response — the mobile just doesn't use it.

---

## Fix Required

Replace the client-side calculation with the authoritative `currentRcnBalance` from the API response.

**`mobile/feature/home/components/customer-wallet/index.tsx`** lines 87-89:

Change:
```typescript
const totalBalance =
  (customerData?.customer?.lifetimeEarnings || 0) -
  (customerData?.customer?.totalRedemptions || 0);
```

To:
```typescript
const totalBalance = customerData?.customer?.currentRcnBalance || 0;
```

Also verify that the `CustomerData` interface in `mobile/shared/interfaces/customer.interface.ts` includes `currentRcnBalance`:
```typescript
currentRcnBalance?: number;
```

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/home/components/customer-wallet/index.tsx:87-89` | Use `currentRcnBalance` instead of calculated value |
| `mobile/shared/interfaces/customer.interface.ts` | Verify `currentRcnBalance` field exists in interface |

---

## QA Test Plan

### Before fix
1. Login as any customer with RCN balance on mobile → Home shows **0 RCN**
2. Login as same customer on web → Shows correct balance

### After fix
1. Login as customer on mobile → Should show correct balance matching web
2. Compare with web → Both should match
3. Earn RCN (shop issues reward) → Pull to refresh → Balance updates
4. Redeem RCN → Balance decreases correctly
5. Test with a new customer (0 balance) → Should show 0
