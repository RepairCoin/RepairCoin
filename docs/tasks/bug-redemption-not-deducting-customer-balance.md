# BUG: RCN Redemption Not Deducting Customer Available Balance

**Status:** Open
**Priority:** Critical
**Type:** Bug (Regression)
**Reported:** 2026-03-09
**Affected Customer:** 0x150e4A7bCF6204BEbe0EFe08fE7479f2eE30A24e
**Affected Shop:** 0xb3afc20c0f66e9ec902bd7df2313b57ae8fb1d81

## Description

When a customer redeems RCN tokens at a shop, the redemption transaction is recorded and "Tokens Redeemed" counter increases, but the customer's **Available Balance does not decrease**. The customer's balance stays at 150 RCN despite redeeming 3 x 10 RCN (30 total).

## Root Cause

The call to `customerRepository.updateCustomerAfterRedemption()` was **removed** from the shop redemption endpoint but never replaced with an equivalent.

**Breaking commit:**
```
a736bf56 - Zeff01 <jzeffsomera@gmail.com>
Mon Oct 13 20:07:23 2025 +0800
"feat: Implement complete redemption system overhaul and mint-to-wallet functionality"
```

### What was removed (the working code):

```typescript
// REMOVED in a736bf56:
- // Update customer redemption total
- await customerRepository.updateCustomerAfterRedemption(customerAddress, amount);
```

### What replaced it (incorrect comment):

```typescript
// ADDED in a736bf56:
+ // Customer balance is updated via the transaction record above
```

This comment is **wrong**. The balance calculation in `CustomerRepository.getCustomerBalance()` (line 643-658) computes available balance as:

```sql
available = lifetime_earnings - total_redemptions - pending_mint - minted_to_wallet
```

The `total_redemptions` column on the `customers` table must be incremented for the balance to decrease. The transaction record alone does NOT update this column.

## Developer Who Altered Working Code

**Zeff01** (jzeffsomera@gmail.com) in commit `a736bf56` on Oct 13, 2025.

The commit message states "Fix critical double-deduction bug" — the developer likely removed the balance deduction call thinking the transaction record would handle it, but the balance calculation reads from the `customers.total_redemptions` column, not from summing transactions.

The original working code was also by Zeff01 in commit `29a42ab7` (Aug 9, 2025).

## Evidence from Database

- Customer `current_rcn_balance`: 150 RCN (unchanged)
- Customer `total_redemptions`: 46 RCN (should be 76+ after 3x10 redemptions)
- Customer `lifetime_earnings`: 165 RCN
- 3 confirmed redemption transactions on March 8, 2026 (IDs 885, 886, 887) with strategy `database_only`
- Customer `updated_at`: 2026-03-04 (not updated since before the redemptions)

## Affected Files

- `backend/src/domains/shop/routes/index.ts` (line ~1423) - Missing customer balance update in atomic transaction
- `backend/src/repositories/CustomerRepository.ts` (line 730) - `updateBalanceAfterRedemption()` method EXISTS but is never called

## Fix Required

Inside the atomic transaction block in `backend/src/domains/shop/routes/index.ts`, after the session is marked as used (line 1423) and before COMMIT (line 1427), add:

```typescript
// 4d. Deduct from customer's available balance
await dbClient.query(
  `UPDATE customers
   SET
     current_rcn_balance = GREATEST(0, COALESCE(current_rcn_balance, 0) - $1),
     total_redemptions = COALESCE(total_redemptions, 0) + $1,
     updated_at = NOW()
   WHERE address = $2`,
  [amountFromDatabase, customerAddress.toLowerCase()]
);
```

This must be inside the same `dbClient` transaction so it rolls back with everything else if any step fails.

## Data Fix Required

The affected customer's `total_redemptions` needs to be corrected to match the actual sum of confirmed redemption transactions:

```sql
UPDATE customers
SET total_redemptions = (
  SELECT COALESCE(SUM(ABS(amount)), 0)
  FROM transactions
  WHERE customer_address = '0x150e4a7bcf6204bebe0efe08fe7479f2ee30a24e'
    AND type = 'redemption'
    AND status = 'confirmed'
),
current_rcn_balance = GREATEST(0, lifetime_earnings - (
  SELECT COALESCE(SUM(ABS(amount)), 0)
  FROM transactions
  WHERE customer_address = '0x150e4a7bcf6204bebe0efe08fe7479f2ee30a24e'
    AND type = 'redemption'
    AND status = 'confirmed'
)),
updated_at = NOW()
WHERE address = '0x150e4a7bcf6204bebe0efe08fe7479f2ee30a24e';
```

## Impact

- ALL customer redemptions since Oct 13, 2025 (commit a736bf56) have NOT been deducting from customer balances
- Customers can redeem unlimited RCN without their balance decreasing
- Shop statistics (tokens credited) are correct, but customer-side is broken
- This is effectively an infinite RCN exploit
