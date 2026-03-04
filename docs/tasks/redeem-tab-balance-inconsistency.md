# Redeem Tab Shows Inconsistent Balance Between Step 1 and Step 2

## Status: 🔲 TODO

**Priority:** Medium
**Area:** Backend / Frontend - Shop Redeem Tab
**Reported:** March 4, 2026
**Related:** `docs/tasks/instant-mint-available-balance-not-decreasing.md` (same regression source)

---

## Problem Statement

On the shop Redeem tab (`/shop?tab=tools`, Redeem sub-tab), the customer's available balance shows **two different values** between Step 1 (Select Customer) and Step 2 (Enter Redemption Amount):

- **Step 1:** Balance shows **82 RCN** (missing net transfers)
- **Step 2:** Balance changes to **85 RCN** (correct, includes net transfers)

This is confusing for shop owners — the balance jumps when they start typing a redemption amount.

### Reproduction (Lee Ann — `0x960Aa947468cfd80b8E275C61Abce19E13D6a9e3`)
1. Go to Shop Tools → Redeem tab
2. Search and select "Lee Ann" as customer
3. Redemption Summary shows **Balance: 82 RCN**
4. Enter any amount in Step 2
5. Balance updates to **85 RCN**

---

## Root Cause

Two different API endpoints return balance computed by different formulas:

### Step 1: `GET /api/customers/balance/:address`
- **Frontend:** `RedeemTabV2.tsx:428` reads `result.data?.databaseBalance`
- **Backend:** `CustomerBalanceService.getCustomerBalanceInfo()` returns `balanceInfo.databaseBalance`
- **Source:** `CustomerRepository.getCustomerBalance()` lines 644-658 computes:
  ```sql
  GREATEST(0,
    lifetime_earnings - total_redemptions - pending_mint_balance - total_minted_to_wallet
  ) as calculated_available_balance
  ```
- **Result:** `721 - 483 - 0 - 156 = 82` — does NOT include net transfers (+3 from gifting)

### Step 2: Verification endpoint (pre-validation on amount change)
- **Frontend:** `RedeemTabV2.tsx:217-218` reads `data.availableBalance` and overwrites the balance
- **Backend:** `VerificationService.verifyRedemption()` → `calculateAvailableBalance()` → returns `currentRcnBalance`
- **Source:** `CustomerRepository.getCustomerBalance().currentRcnBalance` = direct DB column value
- **Result:** `85` — includes net transfers (correct)

### Why they differ
The `VerificationService` was updated in commit `4957a79a` to use `currentRcnBalance` (to fix token gifting), but the `databaseBalance` field in `getCustomerBalance()` still uses the old formula. The old formula doesn't account for:
- Received token transfers/gifts (+20 RCN)
- Sent token transfers/gifts (-17 RCN)
- Net: +3 RCN unaccounted → 82 vs 85

---

## Proposed Fix

### Option A: Fix backend — make `databaseBalance` use `currentRcnBalance` (Recommended)

**File:** `backend/src/domains/customer/services/CustomerBalanceService.ts` line 71

```typescript
// BEFORE
databaseBalance: balanceInfo.databaseBalance,

// AFTER — use currentRcnBalance as the authoritative balance
databaseBalance: balanceInfo.currentRcnBalance,
```

This aligns the balance endpoint with the verification endpoint. Both would return the same value. The `canMintToWallet` check on line 80 should also be updated:

```typescript
canMintToWallet: balanceInfo.currentRcnBalance > 0
```

### Option B: Fix frontend — read `currentRcnBalance` instead of `databaseBalance`

**File:** `frontend/src/components/shop/tabs/RedeemTabV2.tsx` line 428

```typescript
// BEFORE
const availableBalance = result.data?.databaseBalance || 0;

// AFTER
const availableBalance = result.data?.currentRcnBalance || result.data?.databaseBalance || 0;
```

Option A is preferred because it fixes the inconsistency at the source for all consumers.

---

## Files to Change

| File | Change |
|------|--------|
| `backend/src/domains/customer/services/CustomerBalanceService.ts` | Use `currentRcnBalance` instead of `databaseBalance` in `getCustomerBalanceInfo()` |

---

## Testing

1. Go to Shop Tools → Redeem tab
2. Select a customer who has received/sent token gifts (e.g., Lee Ann)
3. Verify balance in Redemption Summary matches immediately on customer select
4. Enter a redemption amount — verify balance does NOT change
5. Verify the balance shown matches the customer's dashboard available balance
6. Test with a customer who has no transfers — balance should be the same either way
