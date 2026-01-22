# Mint to Wallet - Frontend Testing Guide

## Overview

The "Mint to Wallet" feature allows customers to transfer their off-chain RCN balance to their actual blockchain wallet. This is a manual action initiated by the customer from their Overview page.

## Prerequisites

1. **Customer Account**: A registered customer with off-chain RCN balance
2. **Test Wallet**: Coinbase Wallet, MetaMask, or social login account
3. **Access**: Customer dashboard at `/customer/overview`
4. **Off-chain Balance**: Customer must have available RCN balance > 0

## Test Scenarios

### Scenario 1: Basic Mint to Wallet

**Steps:**
1. Login as a customer with available RCN balance
2. Navigate to Customer Overview page
3. Locate the "Mint to Wallet" section (shows current off-chain balance)
4. Enter the amount to mint (e.g., 10 RCN)
5. Click "Mint to Wallet" button
6. Confirm the transaction in wallet (if external wallet)
7. Wait for transaction to complete

**Expected Results:**
- [ ] Transaction is submitted to blockchain
- [ ] Loading/pending state shown during transaction
- [ ] Success message displayed after completion
- [ ] Off-chain balance decreases by minted amount
- [ ] On-chain wallet balance increases by minted amount
- [ ] Transaction appears in customer's transaction history
- [ ] Transaction hash is recorded in database

**Verification:**
```
1. Check on-chain balance: https://sepolia.basescan.org/token/0xBFE793d78B6B83859b528F191bd6F2b8555D951C?a={CUSTOMER_ADDRESS}
2. Check transaction history in app
3. Verify database transaction has real tx hash (not offchain_)
```

---

### Scenario 2: Mint Full Balance

**Steps:**
1. Login as customer with available balance (e.g., 50 RCN)
2. Navigate to Overview page
3. Click "Max" or enter full balance amount
4. Click "Mint to Wallet"
5. Confirm transaction

**Expected Results:**
- [ ] Full balance is minted to wallet
- [ ] Off-chain balance shows 0 after completion
- [ ] On-chain balance reflects full amount
- [ ] No error for minting full balance

---

### Scenario 3: Insufficient Balance

**Steps:**
1. Login as customer with 10 RCN balance
2. Try to mint 20 RCN (more than available)

**Expected Results:**
- [ ] Error message: "Insufficient balance"
- [ ] Mint button disabled or validation prevents submission
- [ ] No transaction is submitted

---

### Scenario 4: Minimum Amount Validation

**Steps:**
1. Try to mint 0 RCN
2. Try to mint negative amount
3. Try to mint 0.001 RCN (if minimum exists)

**Expected Results:**
- [ ] Validation error for 0 amount
- [ ] Validation error for negative amount
- [ ] Check if minimum amount is enforced

---

### Scenario 5: Social Login (Embedded Wallet)

**Steps:**
1. Login via Google/Email (embedded wallet)
2. Navigate to Overview page
3. Mint 5 RCN to wallet

**Expected Results:**
- [ ] No wallet popup (signs automatically)
- [ ] Transaction completes without manual signing
- [ ] Tokens appear in embedded wallet
- [ ] Can verify on block explorer

---

### Scenario 6: External Wallet (MetaMask/Coinbase)

**Steps:**
1. Login via MetaMask or Coinbase Wallet
2. Navigate to Overview page
3. Mint 5 RCN to wallet

**Expected Results:**
- [ ] Wallet popup appears for signing (if required)
- [ ] Transaction completes after user confirms
- [ ] Tokens appear in external wallet
- [ ] Gas fee is paid from admin wallet (not customer)

---

### Scenario 7: Network Error Handling

**Steps:**
1. Start mint transaction
2. Simulate network disconnect during transaction
3. Reconnect and check state

**Expected Results:**
- [ ] Appropriate error message shown
- [ ] Balance not deducted if transaction failed
- [ ] User can retry after reconnection

---

### Scenario 8: Transaction Pending State

**Steps:**
1. Initiate mint transaction
2. Observe UI during blockchain confirmation

**Expected Results:**
- [ ] Loading spinner or pending indicator shown
- [ ] Mint button disabled during transaction
- [ ] User cannot double-submit
- [ ] Status updates when confirmed

---

## Database Verification

After each successful mint, verify in database:

```sql
-- Check transaction record
SELECT
  id,
  type,
  amount,
  customer_address,
  transaction_hash,
  status,
  created_at
FROM transactions
WHERE customer_address = '{CUSTOMER_ADDRESS}'
  AND type = 'mint_to_wallet'
ORDER BY created_at DESC
LIMIT 5;

-- Verify transaction hash is real (not offchain_)
-- Real hash starts with 0x and is 66 characters
```

## Block Explorer Verification

1. Go to: `https://sepolia.basescan.org/address/{CUSTOMER_ADDRESS}`
2. Click on "Token Transfers" tab
3. Look for RCN token transfers
4. Verify:
   - From: Admin wallet (treasury)
   - To: Customer wallet
   - Amount: Matches minted amount
   - Token: RCN (0xBFE793d78B6B83859b528F191bd6F2b8555D951C)

## Test Accounts

| Role | Address | Notes |
|------|---------|-------|
| Test Customer | `0x6F359646065e7FCFC4eB3cE4D108283268761063` | Coinbase Wallet |
| RCN Contract | `0xBFE793d78B6B83859b528F191bd6F2b8555D951C` | Base Sepolia |

## Common Issues

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| Transaction fails | Insufficient gas in admin wallet | Fund admin wallet with ETH |
| Balance not updating | Cache not refreshed | Pull to refresh or wait |
| Wallet popup not appearing | Embedded wallet used | Expected for social login |
| "Contract paused" error | Emergency freeze active | Contact admin to unpause |

## Environment

- **Network**: Base Sepolia (Testnet)
- **RCN Contract**: `0xBFE793d78B6B83859b528F191bd6F2b8555D951C`
- **Block Explorer**: https://sepolia.basescan.org

---

## Sign-off

| Tester | Date | Result | Notes |
|--------|------|--------|-------|
| | | | |
| | | | |
