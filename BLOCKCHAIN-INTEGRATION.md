# RepairCoin Blockchain Integration Guide

## Current Status

✅ **Hybrid Mode Active**: The system is now configured to work with both database tracking and blockchain minting.

### What's Working Now:
1. **Database Tracking**: All RCN purchases and balances are tracked in PostgreSQL
2. **Blockchain Ready**: Code is prepared to mint tokens on-chain when enabled
3. **New Contract Address**: Using 0xBFE793d78B6B83859b528F191bd6F2b8555D951C
4. **Shop Dashboard**: Shows 0 RCN balance (correct for new contract)

### What Needs to Be Done:
1. **Grant MINTER_ROLE**: The contract owner needs to grant MINTER_ROLE to your admin wallet
2. **Enable Blockchain**: Set `ENABLE_BLOCKCHAIN_MINTING=true` in .env file

## How the Hybrid System Works

1. **Shop Purchases RCN**: 
   - Stripe payment processed
   - Database updated with purchased balance
   - If blockchain enabled, tokens are minted on-chain
   - If blockchain disabled, operation logged for future minting

2. **Benefits**:
   - System works without blockchain (database only)
   - Can enable blockchain later without data loss
   - All operations are transparent and auditable
   - No dependency on blockchain availability

## Next Steps

### To Enable Full Blockchain Integration:

1. **Contact the Contract Owner**:
   ```
   Ask them to grant MINTER_ROLE to: 0x761E5E59485ec6feb263320f5d636042bD9EBc8c
   ```

2. **Update Environment Variables**:
   ```bash
   # In your .env file, add:
   ENABLE_BLOCKCHAIN_MINTING=true
   ```

3. **Restart the Backend**:
   ```bash
   npm run server
   ```

4. **Test a Purchase**:
   - Buy RCN through shop dashboard
   - Check blockchain balance on Base Sepolia explorer

### Checking Status:

Run this script to check blockchain integration status:
```bash
npx ts-node src/scripts/check-blockchain-status.ts
```

## Important Notes

- **Database is Primary**: Even with blockchain enabled, the database remains the source of truth
- **No Data Loss**: All purchases are tracked regardless of blockchain status
- **Retroactive Minting**: Past purchases can be minted later if needed
- **Gas Fees**: When blockchain is enabled, RepairCoin pays gas fees for minting

## Contract Information

- **Network**: Base Sepolia (testnet)
- **RCN Contract**: 0xBFE793d78B6B83859b528F191bd6F2b8555D951C
- **Token Symbol**: RCN
- **Decimals**: 18

## Troubleshooting

### "Not Minter" Error
This means the admin wallet doesn't have permission to mint. Contact the contract owner.

### Shop Shows 0 Balance
This is correct! The new contract starts with 0 supply. Balances will increase as shops purchase RCN.

### Old Balance Still Visible
Make sure all frontend components use the new contract address (0xBFE793d78B6B83859b528F191bd6F2b8555D951C).