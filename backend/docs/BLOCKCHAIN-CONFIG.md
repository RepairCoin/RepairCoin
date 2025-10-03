# Blockchain Configuration Guide

## Overview
This guide explains how to configure blockchain minting and transfers for RepairCoin.

## Environment Variables

### ENABLE_BLOCKCHAIN_MINTING
- **Default**: `false`
- **Description**: Enables/disables blockchain operations
- **When true**: Customer rewards are sent on-chain
- **When false**: Rewards are tracked in database only

### BLOCKCHAIN_METHOD (New - Optional)
- **Default**: `transfer_then_mint`
- **Options**:
  - `transfer_then_mint`: Try transfer first, mint if it fails
  - `mint_only`: Always mint new tokens (most reliable)
  - `transfer_only`: Only use transfers (requires admin balance)

## Current Flow

### Shop Purchases
- Database-only (no blockchain operations)
- Saves gas fees
- Shop balance tracked in `purchased_rcn_balance`

### Customer Rewards
1. **If blockchain enabled**:
   - First attempts to transfer from admin wallet
   - If transfer fails, mints new tokens as fallback
   - Both methods credit customer's blockchain wallet

2. **If blockchain disabled**:
   - Only updates database
   - Can be enabled later without data loss

## Troubleshooting Transfer Failures

### Common Causes:
1. **Insufficient Admin Balance**: Check with `npx ts-node scripts/check-admin-balance.ts`
2. **Gas Issues**: Ensure admin wallet has ETH for gas
3. **Network Congestion**: Base Sepolia may be slow
4. **MINTER_ROLE Missing**: Admin needs minting permission

### Recommended Settings:
```env
# For most reliable operation
ENABLE_BLOCKCHAIN_MINTING=true
BLOCKCHAIN_METHOD=mint_only

# For gas-efficient operation (if admin has balance)
ENABLE_BLOCKCHAIN_MINTING=true
BLOCKCHAIN_METHOD=transfer_then_mint
```

## Security Notes
- Admin wallet private key required
- Only admin wallet can mint/transfer
- All operations logged for audit trail