# Instant Mint Does Not Decrease Available Balance

## Status: ✅ COMPLETED

**Priority:** Critical
**Area:** Backend - Customer Balance / Token Domain
**Reported:** March 4, 2026
**Completed:** March 4, 2026
**Regression From:** Commit `4957a79a` (token gifting fix, March 3, 2026)

---

## Problem Statement

When a customer uses "Mint RCN to Wallet" (instant mint), the tokens are successfully minted on the blockchain (wallet balance increases), but the **available balance (`current_rcn_balance`) is not decreased** in the database. This means the customer can mint the same RCN repeatedly, effectively creating tokens out of thin air.

### Reproduction (Lee Ann — `0x960Aa947468cfd80b8E275C61Abce19E13D6a9e3`)
1. Customer had 280 RCN available balance
2. Minted 10 RCN to wallet twice (20 RCN total) — wallet balance increased
3. Available balance stayed at 280 RCN (should have been 260)
4. Total minted to wallet across all time: 156 RCN — none ever decreased `current_rcn_balance`
5. **Correct available balance was 85 RCN** (inflated by 185 RCN)

### Impact
- **Critical financial bug** — customers can mint unlimited RCN to their wallet
- Available balance never decreases, allowing infinite minting
- Breaks the balance integrity between database and blockchain

---

## Regression Analysis

**This was working before.** It broke in commit `4957a79a` (token gifting fix).

### Before the fix (minting worked correctly)
```typescript
// VerificationService.getBalance() — OLD
const availableBalance = Math.max(0, lifetimeEarnings - totalRedeemed - pendingMintBalance - totalMintedToWallet);

// calculateAvailableBalance() — OLD
return balanceInfo.databaseBalance;  // = lifetime - redeemed - pending - mintedToWallet
```
The old formula subtracted `totalMintedToWallet` (computed by summing `instant_mint` transactions from the DB). When `instantMint` recorded a transaction, the next balance check would subtract it — available balance decreased correctly.

### After the fix (minting broke)
```typescript
// VerificationService.getBalance() — NEW (commit 4957a79a)
const availableBalance = customer.currentRcnBalance || 0;

// calculateAvailableBalance() — NEW
return balanceInfo.currentRcnBalance;
```
Changed to use `current_rcn_balance` column directly to fix token gifting (the old formula didn't account for received transfers, causing gifted-token balances to show 0). But `instantMint()` never decreases `current_rcn_balance`, so the available balance stays stale after minting.

### The tradeoff that caused the regression
| | Old formula | New approach (current) |
|---|---|---|
| **Token gifting** | Broken (received transfers not counted) | Works correctly |
| **Instant minting** | Works (totalMintedToWallet subtracted) | **Broken** (current_rcn_balance not decremented) |

**Reference:** `docs/tasks/token-gifting-e2e-testing.md` — see "Extra Fix" and "Bug 5" in the Resolution Summary.

---

## Root Cause

**File:** `backend/src/domains/customer/services/CustomerBalanceService.ts`

The `instantMint()` method mints tokens on-chain and records the transaction, but **never updates `current_rcn_balance`** in the customers table. This wasn't an issue before because the old formula computed available balance from transactions. Now that available balance reads `current_rcn_balance` directly, it must be kept in sync.

---

## Resolution

### Code Fix (2 files changed)

**1. `backend/src/repositories/CustomerRepository.ts`** — Added `decreaseBalanceAfterMint()` method:
```typescript
async decreaseBalanceAfterMint(address: string, amount: number): Promise<void> {
  const query = `
    UPDATE customers
    SET
      current_rcn_balance = GREATEST(0, COALESCE(current_rcn_balance, 0) - $1),
      updated_at = NOW()
    WHERE address = $2
      AND COALESCE(current_rcn_balance, 0) >= $1
  `;
  const result = await this.pool.query(query, [amount, address.toLowerCase()]);
  if (result.rowCount === 0) {
    throw new Error('Insufficient balance for minting or customer not found');
  }
}
```
- Decreases only `current_rcn_balance` — does NOT touch `lifetime_earnings` or `total_redemptions`
- `GREATEST(0, ...)` prevents negative balance
- `WHERE current_rcn_balance >= amount` as safety guard
- Same pattern as existing `updateBalanceAfterRedemption()`

**2. `backend/src/domains/customer/services/CustomerBalanceService.ts`** — Added Step 3 in `instantMint()`:
```typescript
// Step 3: Decrease available balance (current_rcn_balance) since tokens are now on-chain
try {
  await customerRepository.decreaseBalanceAfterMint(address, amount);
} catch (balanceError) {
  // Log but don't fail - the blockchain mint already succeeded
  logger.error('Failed to decrease balance after mint, but blockchain mint succeeded', { ... });
}
```
- Runs after blockchain mint succeeds (Step 2), before recording transaction (Step 4)
- Non-blocking error handling: if DB update fails, blockchain mint is already done (logged for manual reconciliation)

### Data Fix (Lee Ann)

Corrected Lee Ann's `current_rcn_balance` from **270 → 85 RCN** via reconciliation query:
```sql
current_rcn_balance = lifetime_earnings(721) - total_redemptions(483) - total_minted_to_wallet(156) + net_transfers(+3) = 85
```

### No Conflicts With Other RCN Balances
| Balance | Source | Affected? |
|---------|--------|-----------|
| Shop `purchasedRcnBalance` | `shops` table (separate field) | No |
| Shop redeem tab customer lookup | `VerificationService.getBalance()` → `currentRcnBalance` | Yes — will now show correct lower balance |
| Token gifting validation | `currentRcnBalance` in transfer routes | No conflict — unchanged |
| RCN redemption service | `customer.currentRcnBalance` | Yes — will now show correct lower balance |
| Admin metrics | `SUM(current_rcn_balance)` | Yes — totals will be accurate now |

### Outstanding: Full Customer Reconciliation
Lee Ann was fixed manually. Other customers who used instant mint may also have inflated `current_rcn_balance`. A reconciliation scan across all customers is recommended — see separate task if needed.

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/repositories/CustomerRepository.ts` | Added `decreaseBalanceAfterMint()` method |
| `backend/src/domains/customer/services/CustomerBalanceService.ts` | Added `current_rcn_balance` decrease in `instantMint()` after blockchain mint |

---

## Testing

1. ✅ Check customer's available balance before mint
2. ✅ Mint 10 RCN to wallet
3. ✅ Verify available balance decreased by 10
4. ✅ Verify wallet balance increased by 10
5. ✅ Try minting more than available balance — should be rejected
6. ✅ Verify the transaction record has correct amount and status
7. ✅ Lee Ann's balance corrected from 270 → 85 RCN
8. ✅ TypeScript build passes (`npx tsc --noEmit`)
