# BUG: current_rcn_balance Does Not Account for Minted-to-Wallet Tokens

**Status:** Fixed (pending deployment)
**Priority:** Critical
**Type:** Bug (Data Integrity)
**Reported:** 2026-03-09
**Related:** bug-redemption-not-deducting-customer-balance.md

## Description

The `current_rcn_balance` column on the `customers` table does not account for tokens that have been minted to the customer's blockchain wallet. This causes the customer dashboard to display an **inflated available balance** that doesn't match the actual redeemable amount.

The `VerificationService` and dashboard both read `current_rcn_balance` directly, while the correct formula is:

```
available = lifetime_earnings - total_redemptions - pending_mint - minted_to_wallet
```

This formula is already computed as `calculated_available_balance` in `CustomerRepository.getCustomerBalance()` (line 644-658) but is **never used** by the consuming code.

## Evidence

Customer `0x150e4a7bcf6204bebe0efe08fe7479f2ee30a24e`:

| Field | Value |
|---|---|
| `current_rcn_balance` | 15 (dashboard shows this) |
| `lifetime_earnings` | 180 |
| `total_redemptions` | 78 |
| `minted_to_wallet` | 100 (from instant_mint transactions) |
| **Correct available** | **180 - 78 - 100 = 2 RCN** |

Dashboard shows 15 RCN available. Verification service correctly blocks redemption at 2 RCN (on deployed version). The mismatch confuses both shops and customers.

## Root Cause

Three code paths use `currentRcnBalance` (the raw column) instead of the calculated available balance:

### 1. VerificationService.calculateAvailableBalance() — line 367
```typescript
// WRONG: returns raw column that doesn't subtract minted_to_wallet
return balanceInfo.currentRcnBalance;
```

### 2. CustomerBalanceService.getCustomerBalanceInfo() — line 71
```typescript
// WRONG: dashboard shows raw column as "available balance"
databaseBalance: balanceInfo.currentRcnBalance,
```

### 3. CustomerRepository.syncCustomerBalance() — line 931
```typescript
// WRONG: sync recalculates without subtracting minted_to_wallet
current_rcn_balance = GREATEST(0, bc.total_earned - bc.total_redeemed)
```

## Fixes Applied

### Fix 1: Unified balance formula includes net transfers
`CustomerRepository.getCustomerBalance()` — Updated `calculated_available_balance` SQL to:
```
available = lifetime_earnings + net_transfers - total_redemptions - pending_mint - minted_to_wallet
```
Added `net_transfers` subquery for `transfer_in`/`transfer_out` transactions. This is now the single source of truth.

### Fix 2: VerificationService.getBalance() (dashboard endpoint)
Changed from `customer.currentRcnBalance` to `balanceInfo.databaseBalance` (the calculated formula).

### Fix 3: VerificationService.calculateAvailableBalance() (redemption check)
Changed from `balanceInfo.currentRcnBalance` to `balanceInfo.databaseBalance`.

### Fix 4: CustomerBalanceService.getCustomerBalanceInfo() (balance API)
Changed from manual formula to `balanceInfo.databaseBalance`.

### Fix 5: Gift token transfer routes (transfer.ts)
Both `/transfer` (line 147) and `/validate-transfer` (line 503) changed from `currentRcnBalance` to `databaseBalance`. Previously gift tokens used the raw column which didn't account for minted-to-wallet tokens.

### Fix 6: syncCustomerBalance()
Updated to include `net_transfers` and `minted_to_wallet` in the recalculation formula.

### Fix 7: Data correction (pending)
`current_rcn_balance` for customers with `minted_to_wallet > 0` needs correction. Consider running `syncCustomerBalance()` for affected customers after deployment.

## Files Changed
- `backend/src/repositories/CustomerRepository.ts` — getCustomerBalance(), syncCustomerBalance()
- `backend/src/domains/token/services/VerificationService.ts` — getBalance(), calculateAvailableBalance()
- `backend/src/domains/customer/services/CustomerBalanceService.ts` — getCustomerBalanceInfo()
- `backend/src/domains/token/routes/transfer.ts` — /transfer, /validate-transfer

## Impact (before fix)

- Dashboard showed inflated balance for any customer who minted tokens to wallet
- Customers could attempt redemptions that got rejected by verification service
- Gift token transfers didn't account for minted-to-wallet deductions
- syncCustomerBalance() would re-inflate balances by ignoring minted-to-wallet and transfers
- All customers with `minted_to_wallet > 0` or gift token activity were potentially affected
