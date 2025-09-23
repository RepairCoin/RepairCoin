# Multi-Signature Wallet Integration for RepairCoin

## Overview

Instead of storing private keys on the backend, use a multi-sig wallet for minting RCN tokens.

## Setup Process

### 1. Deploy Gnosis Safe on Base
```bash
# Go to: https://app.safe.global
# Select Base network
# Create new Safe with:
- Owner 1: Your wallet
- Owner 2: Business partner wallet  
- Owner 3: Backup wallet
- Threshold: 2 of 3 signatures required
```

### 2. Grant MINTER_ROLE to Safe
```javascript
// Instead of granting to your wallet:
// grantRole(MINTER_ROLE, yourWallet)

// Grant to the Safe contract:
grantRole(MINTER_ROLE, safeContractAddress)
```

### 3. Backend Integration Options

#### Option A: Queue System (Recommended)
```javascript
// Backend creates mint requests but doesn't execute
async function requestMint(shopAddress, amount) {
  // 1. Save to database
  await db.insert('pending_mints', {
    shop_address: shopAddress,
    amount: amount,
    status: 'pending',
    created_at: new Date()
  });
  
  // 2. Return success (no blockchain interaction)
  return { 
    success: true, 
    message: 'Mint request queued for approval' 
  };
}
```

#### Option B: Safe Transaction API
```javascript
// Use Safe SDK to create transactions
import Safe from '@safe-global/safe-core-sdk';
import SafeApiKit from '@safe-global/safe-api-kit';

async function createMintProposal(shopAddress, amount) {
  const safeService = new SafeApiKit({
    chainId: 8453, // Base mainnet
  });
  
  // Create transaction data
  const mintData = tokenContract.interface.encodeFunctionData(
    'mintTo',
    [shopAddress, amount]
  );
  
  // Propose to Safe (requires 1 signature)
  const safeTx = await safeService.proposeTransaction({
    safeAddress: SAFE_ADDRESS,
    to: RCN_CONTRACT_ADDRESS,
    data: mintData,
    value: '0'
  });
  
  return safeTx;
}
```

## Workflow Comparison

### Current (Single Signature)
```
Shop Purchase → Backend mints immediately → Done
```

### With Multi-Sig
```
Shop Purchase → Backend queues mint → Owner 1 signs → Owner 2 signs → Mint executes
```

## Advantages

1. **Security**: No private keys on servers
2. **Control**: Multiple people must approve mints
3. **Audit Trail**: All approvals on-chain
4. **Recovery**: If one key is lost, others can still operate

## Disadvantages

1. **Slower**: Requires manual approval
2. **Gas Costs**: Each signature costs gas
3. **Complexity**: More steps in the process

## Hybrid Approach (Best of Both)

1. **Small Amounts (<$500)**: Use hot wallet for instant mints
2. **Large Amounts (>$500)**: Require multi-sig approval
3. **Daily Limits**: Hot wallet can only mint X tokens per day

```javascript
if (amount < 5000) { // 5000 RCN = $500
  // Use hot wallet (current approach)
  await mintWithHotWallet(shopAddress, amount);
} else {
  // Require multi-sig
  await createMultiSigProposal(shopAddress, amount);
}
```

## Implementation Steps

1. **Keep current system** for testing/small amounts
2. **Deploy Safe** on Base Sepolia first
3. **Test the flow** with small amounts
4. **Gradually migrate** to multi-sig for larger amounts
5. **Production**: Use multi-sig for all mints

## No WebSockets Needed

Multi-sig wallets don't use WebSockets. The flow is:

1. **Propose**: One owner creates transaction
2. **Sign**: Other owners sign via Safe web interface
3. **Execute**: Last signer triggers execution
4. **Events**: Smart contract emits events (can monitor with webhooks)

The Safe web interface polls the blockchain for updates, or you can use their API to check transaction status.