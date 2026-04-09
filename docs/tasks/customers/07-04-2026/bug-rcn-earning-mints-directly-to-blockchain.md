# Bug: RCN Earnings Mint Directly to Blockchain Instead of Platform Balance

## Status: Fixed (2026-04-09)
## Priority: Critical
## Date: 2026-04-07
## Category: Bug - Token Economics / Smart Contract
## Affected: All RCN earning flows (service completion, referrals, bonuses)

---

## Overview

When a customer earns RCN (service completion, referrals, etc.), the tokens are immediately minted to their on-chain blockchain wallet via the smart contract's `mintTo()` function. The intended flow is for earnings to go to the **platform balance only** (`current_rcn_balance` in the database), and customers should explicitly use "Mint RCN to Wallet" to transfer tokens on-chain.

---

## Current Flow (Wrong)

```
Service completed
  → TokenMinter.mintRepairTokens() called
    → this.mintTokens(customerAddress, amount)
      → Smart contract mintTo(customerAddress, amount)  ← MINTS ON-CHAIN IMMEDIATELY
    → customerRepository.updateCustomerAfterEarning()   ← Also updates DB balance
  → Both on-chain wallet AND platform balance increase simultaneously
```

Customer's blockchain wallet balance increases automatically — no "Mint to Wallet" step needed.

## Expected Flow (Correct)

```
Service completed
  → Update platform balance in database only (current_rcn_balance)
  → Customer sees balance in app
  → Customer explicitly taps "Mint RCN to Wallet"
    → ONLY THEN: Smart contract mintTo(customerAddress, amount)
    → On-chain wallet balance increases
    → Platform balance (pending_mint_balance) adjusts accordingly
```

---

## Root Cause

**File:** `backend/src/contracts/TokenMinter.ts` lines 312-374

```typescript
async mintRepairTokens(customerAddress, repairAmount, shopId, customerData): Promise<MintResult> {
  // Calculate tokens
  let tokensToMint: number;
  if (repairAmount >= 100) {
    tokensToMint = 25;
  } else if (repairAmount >= 50) {
    tokensToMint = 10;
  }

  // THIS IS THE PROBLEM — mints to blockchain immediately
  const result = await this.mintTokens(customerAddress, tokensToMint, `repair_${shopId}_${Date.now()}`);
  // ...
}
```

**File:** `backend/src/contracts/TokenMinter.ts` lines 689-714

```typescript
private async mintTokens(toAddress, amount): Promise<MintResult> {
  const mintAmount = BigInt(amount * Math.pow(10, 18));
  const transaction = prepareContractCall({
    contract,
    method: "function mintTo(address to, uint256 amount) public",
    params: [toAddress, mintAmount]  // ← Mints directly to customer's wallet
  });
  await sendTransaction({ transaction, account: this.account });
}
```

**File:** `backend/src/domains/token/services/TokenService.ts` lines 192-242

The `processServiceMarketplaceEarning()` calls `mintRepairTokens()` which does both on-chain mint AND DB update — these should be separated.

---

## Evidence

Order BK-58419E (Mongo Tea, $200, shop peanut):
- Customer: Mamaw Cou (anna.cagunot@gmail.com)
- Transaction: 25 RCN minted (type: "mint", status: "confirmed")
- `current_rcn_balance`: 25.00 (DB platform balance)
- Blockchain wallet: Also shows 25 RCN (should be 0 until explicit mint)

---

## Token Calculation Rules (Confirmed Correct)

| Service Price | RCN Earned | Tier Bonus |
|---|---|---|
| $100+ | 25 RCN | Bronze: +0, Silver: +2, Gold: +5 |
| $50-$99 | 10 RCN | Bronze: +0, Silver: +2, Gold: +5 |
| Below $50 | 0 RCN | Minimum $50 required |

The 25 RCN for a $200 service is correct. The issue is only about WHERE the tokens go.

---

## Fix Required

### Step 1: Separate earning from minting

`mintRepairTokens()` should only calculate the token amount and return it — NOT call `mintTokens()` on the smart contract.

```typescript
// Change mintRepairTokens to a pure calculation + DB update
async calculateRepairTokens(repairAmount: number, customerData: CustomerData): Promise<{
  tokensToMint: number;
  newTier: string;
}> {
  if (repairAmount >= 100) return { tokensToMint: 25, newTier: ... };
  if (repairAmount >= 50) return { tokensToMint: 10, newTier: ... };
  return { tokensToMint: 0, newTier: customerData.tier };
}
```

### Step 2: Update earning flow to DB-only

In `TokenService.processServiceMarketplaceEarning()`:
- Calculate tokens (no blockchain call)
- Update `current_rcn_balance` in database
- Record transaction as "earned" (not "mint")
- Customer sees balance in app

### Step 3: "Mint to Wallet" triggers blockchain

The existing "Mint RCN to Wallet" feature should be the ONLY path to call `mintTokens()`:
- Customer requests mint of X RCN
- Deduct from `current_rcn_balance`
- Add to `pending_mint_balance` during processing
- Call smart contract `mintTo()`
- On success: clear `pending_mint_balance`

---

## Impact

This affects ALL earning flows that call `mintRepairTokens()`:
- Service marketplace completion (`TokenService.processServiceMarketplaceEarning`)
- Repair completion (`TokenService.processRepairEarning`)
- Referral rewards (`TokenMinter.mintReferralTokens`)

All need to be updated to DB-only earning with separate on-chain minting.

---

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/contracts/TokenMinter.ts` | Separate calculation from on-chain minting |
| `backend/src/domains/token/services/TokenService.ts` | Earning flows update DB only, no blockchain call |
| `backend/src/handlers/webhookHandlers.ts` | If repair webhooks also mint, update same way |

---

## QA Test Plan

### After fix — earning flow
1. Complete a service booking ($200)
2. Check platform balance → should show 25 RCN
3. Check blockchain wallet → should show 0 RCN (unchanged)
4. Check transaction history → should show "earned" type

### After fix — mint to wallet flow
1. Customer has 25 RCN platform balance
2. Tap "Mint RCN to Wallet"
3. Check blockchain wallet → should now show 25 RCN
4. Check platform balance → should decrease by 25 RCN

### Regression
1. Verify all earning paths (service, referral, bonus) update DB only
2. Verify no blockchain calls happen during earning
3. Verify existing "Mint to Wallet" feature still works
