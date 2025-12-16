# Instant Mint Endpoint Implementation

**Date:** 2025-12-16
**Feature:** Customer Instant Mint to Wallet
**Endpoint:** `POST /api/customers/balance/{address}/instant-mint`

---

## Overview

This feature allows customers to instantly mint their off-chain RCN balance directly to their blockchain wallet. Unlike the queue-and-approve workflow, this endpoint processes the mint immediately without requiring admin approval.

### Key Benefits
- **Instant gratification** - Customers see tokens in wallet immediately
- **No queue waiting** - Bypasses admin approval process
- **Atomic operations** - Rollback on failure protects customer balance
- **Gas paid by platform** - Customers don't need ETH for gas fees

---

## Architecture

### Flow Diagram

```
Customer Request
       │
       ▼
┌─────────────────────────────────────┐
│  POST /instant-mint                 │
│  - Validate address format          │
│  - Validate amount (0 < amt ≤ 10k)  │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  CustomerBalanceService.instantMint │
│  - validateMintRequest()            │
│  - Check sufficient balance         │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  CustomerRepository.queueForMinting │
│  - Deduct from current_rcn_balance  │
│  - Add to pending_mint_balance      │
│  - Atomic SQL UPDATE                │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  TokenMinter.adminMintTokens        │
│  - Prepare mintTo() transaction     │
│  - Send via admin wallet            │
│  - Wait for blockchain confirmation │
└─────────────────────────────────────┘
       │
       ├──── SUCCESS ────┐
       │                 ▼
       │    ┌────────────────────────────┐
       │    │ CustomerRepository         │
       │    │ .completeMint()            │
       │    │ - Clear pending_mint       │
       │    │ - Set last_blockchain_sync │
       │    └────────────────────────────┘
       │                 │
       │                 ▼
       │         Return Success
       │         + Transaction Hash
       │
       └──── FAILURE ────┐
                         ▼
            ┌────────────────────────────┐
            │ ROLLBACK                   │
            │ CustomerRepository         │
            │ .cancelPendingMint()       │
            │ - Return to current_rcn    │
            │ - Clear pending_mint       │
            └────────────────────────────┘
                         │
                         ▼
                  Return Error
```

---

## API Specification

### Endpoint

```
POST /api/customers/balance/{address}/instant-mint
```

### Request

**Headers:**
```
Content-Type: application/json
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | Customer wallet address (0x + 40 hex chars) |

**Body:**
```json
{
  "amount": 50
}
```

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `amount` | number | Yes | > 0, ≤ 10,000 | RCN tokens to mint |

### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "transactionHash": "0x1234567890abcdef...",
    "amount": 50,
    "customerAddress": "0xAbC123..."
  },
  "message": "Successfully minted 50 RCN to wallet"
}
```

**Error (400) - Validation Failed:**
```json
{
  "success": false,
  "error": "Insufficient database balance"
}
```

**Error (400) - Blockchain Failed:**
```json
{
  "success": false,
  "error": "Blockchain mint failed: insufficient gas"
}
```

**Error (500) - Server Error:**
```json
{
  "success": false,
  "error": "Failed to mint tokens to wallet"
}
```

### Error Codes

| HTTP Status | Error | Cause |
|-------------|-------|-------|
| 400 | Invalid wallet address format | Address doesn't match `0x[a-fA-F0-9]{40}` |
| 400 | Invalid amount | Amount is null, zero, or negative |
| 400 | Amount exceeds maximum limit | Amount > 10,000 RCN |
| 400 | Customer not found | Address not in database |
| 400 | Insufficient database balance | `current_rcn_balance` < amount |
| 400 | Blockchain mint failed | Smart contract call failed |
| 500 | Failed to mint tokens | Unexpected server error |

---

## Files Modified

### 1. CustomerBalanceService.ts
**Path:** `backend/src/domains/customer/services/CustomerBalanceService.ts`

**Changes:**
- Added `TokenMinter` import
- Added `InstantMintResult` interface
- Added `getTokenMinter()` private method (lazy initialization)
- Added `instantMint()` method

```typescript
export interface InstantMintResult {
  success: boolean;
  transactionHash?: string;
  amount?: number;
  error?: string;
}

async instantMint(address: string, amount: number): Promise<InstantMintResult> {
  // 1. Validate mint request
  // 2. Deduct from database (queueForMinting)
  // 3. Mint to blockchain (adminMintTokens)
  // 4. On success: completeMint()
  // 5. On failure: cancelPendingMint() rollback
}
```

### 2. CustomerRepository.ts
**Path:** `backend/src/repositories/CustomerRepository.ts`

**Changes:**
- Added `cancelPendingMint()` method for rollback support

```typescript
async cancelPendingMint(address: string, amount: number): Promise<void> {
  // Reverses queueForMinting:
  // - Adds amount back to current_rcn_balance
  // - Deducts from pending_mint_balance
}
```

### 3. balance.ts (Routes)
**Path:** `backend/src/domains/customer/routes/balance.ts`

**Changes:**
- Added `POST /:address/instant-mint` route
- Added Swagger documentation

---

## Database Operations

### Balance Fields

| Column | Type | Description |
|--------|------|-------------|
| `current_rcn_balance` | NUMERIC | Available balance (can redeem or mint) |
| `pending_mint_balance` | NUMERIC | Tokens queued for blockchain mint |
| `lifetime_earnings` | NUMERIC | Total RCN ever earned |
| `total_redemptions` | NUMERIC | Total RCN redeemed at shops |
| `last_blockchain_sync` | TIMESTAMP | Last successful mint completion |

### SQL Operations

**Step 1: Deduct from balance (queueForMinting)**
```sql
UPDATE customers
SET
  current_rcn_balance = GREATEST(0, COALESCE(current_rcn_balance, 0) - $1),
  pending_mint_balance = COALESCE(pending_mint_balance, 0) + $1,
  updated_at = NOW()
WHERE address = $2
AND COALESCE(current_rcn_balance, 0) >= $1
```

**Step 2a: Complete mint (on success)**
```sql
UPDATE customers
SET
  pending_mint_balance = GREATEST(0, COALESCE(pending_mint_balance, 0) - $1),
  last_blockchain_sync = NOW(),
  updated_at = NOW()
WHERE address = $2
AND COALESCE(pending_mint_balance, 0) >= $1
```

**Step 2b: Rollback (on failure)**
```sql
UPDATE customers
SET
  current_rcn_balance = COALESCE(current_rcn_balance, 0) + $1,
  pending_mint_balance = GREATEST(0, COALESCE(pending_mint_balance, 0) - $1),
  updated_at = NOW()
WHERE address = $2
AND COALESCE(pending_mint_balance, 0) >= $1
```

---

## Rollback Mechanism

### When Rollback Occurs

Rollback is triggered when `TokenMinter.adminMintTokens()` returns `success: false`. Common causes:

| Cause | Description |
|-------|-------------|
| Contract paused | RCN contract is in paused state |
| Insufficient gas | Admin wallet has insufficient ETH |
| Invalid address | Blockchain rejects the address |
| Network error | RPC connection failed |
| Access denied | Admin wallet lacks minter role |

### Rollback Process

1. **Detect failure** - `mintResult.success === false`
2. **Log error** - Record failure details for debugging
3. **Call cancelPendingMint()** - Atomic SQL to restore balance
4. **Log rollback** - Record rollback success/failure
5. **Return error** - Inform customer of failure

### Rollback Failure Handling

If `cancelPendingMint()` itself fails (rare):
- Error is logged with `Manual intervention required`
- Customer's tokens remain in `pending_mint_balance`
- Admin must manually investigate and fix

```typescript
try {
  await customerRepository.cancelPendingMint(address, amount);
  logger.info('Instant mint: Rollback successful', { address, amount });
} catch (rollbackError) {
  logger.error('Instant mint: Rollback failed! Manual intervention required', {
    address,
    amount,
    rollbackError
  });
}
```

---

## Gas Fees

### Who Pays?

The **platform wallet** pays all gas fees. Customers do not need ETH.

### How It Works

```typescript
// TokenMinter.ts
const result = await sendTransaction({
  transaction,
  account: this.account,  // Admin wallet from PRIVATE_KEY
});
```

The `this.account` is derived from `PRIVATE_KEY` in `.env`. This wallet must have sufficient ETH to cover gas.

### Cost by Network

| Network | Avg Gas per Mint | Notes |
|---------|------------------|-------|
| Base Sepolia | Free | Testnet - use faucet ETH |
| Base Mainnet | ~$0.01 | Production - very cheap |
| Ethereum Mainnet | $5-50 | Not recommended |

### Monitoring Gas Balance

Ensure admin wallet maintains sufficient ETH:
- Base Mainnet: Keep at least 0.1 ETH (~1000 mints)
- Set up alerts when balance drops below threshold

---

## Testing

### Manual API Test

```bash
# Test with valid address and amount
curl -X POST http://localhost:4000/api/customers/balance/0x1234567890123456789012345678901234567890/instant-mint \
  -H "Content-Type: application/json" \
  -d '{"amount": 10}'
```

### Test Cases

| Test | Input | Expected |
|------|-------|----------|
| Valid mint | amount: 10, balance: 50 | Success + tx hash |
| Zero amount | amount: 0 | 400 error |
| Negative amount | amount: -5 | 400 error |
| Exceeds balance | amount: 100, balance: 50 | 400 error |
| Exceeds max | amount: 15000 | 400 error |
| Invalid address | address: "invalid" | 400 error |
| Customer not found | new address | 400 error |

### Verify on Block Explorer

After successful mint:
1. Copy `transactionHash` from response
2. Go to https://sepolia.basescan.org (testnet) or https://basescan.org (mainnet)
3. Search for transaction hash
4. Verify: To address, amount, success status

---

## Comparison: Queue-Mint vs Instant-Mint

| Feature | Queue-Mint | Instant-Mint |
|---------|------------|--------------|
| Endpoint | `/queue-mint` | `/instant-mint` |
| Admin approval | Required | Not required |
| Processing time | Minutes to hours | Seconds |
| Rollback | Manual | Automatic |
| Use case | Large amounts, audit trail | Small amounts, instant UX |
| Gas timing | Batched by admin | Immediate |

---

## Security Considerations

1. **Amount limits** - Max 10,000 RCN per transaction
2. **Balance validation** - Atomic SQL check prevents overdraft
3. **Rollback protection** - Failed mints restore balance
4. **Address validation** - Strict Ethereum address format
5. **Rate limiting** - Consider adding per-address rate limits (future)

---

## Future Enhancements

1. **Rate limiting** - Limit mints per address per day
2. **Minimum amount** - Require minimum mint (e.g., 1 RCN)
3. **Transaction history** - Store mint transactions in separate table
4. **Email notifications** - Notify customer on successful mint
5. **Frontend integration** - Add "Mint to Wallet" button with tx hash display
6. **Wallet balance display** - Show on-chain balance in customer dashboard

---

## Swagger Documentation

The endpoint is documented in Swagger at:
```
http://localhost:4000/api-docs
```

Look under **Customer Balance** tag for `POST /api/customers/balance/{address}/instant-mint`.
