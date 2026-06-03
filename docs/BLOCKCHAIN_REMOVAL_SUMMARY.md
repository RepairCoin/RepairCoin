# Blockchain Removal - Quick Summary

## The Bottom Line

RepairCoin can have blockchain removed in **5-6 weeks for ~$14,400**. It's not as hard as it might seem because **balances are already tracked in the database**.

## Current State (Good News)

- Database has `current_rcn_balance`, `lifetime_earnings`, `total_redemptions`
- Blockchain is **optional** - "Mint to Wallet" is customer-initiated
- System already operates in database-first mode
- `ENABLE_BLOCKCHAIN_MINTING` is **already disabled by default**
- All transaction history exists in PostgreSQL

## What Needs to Change

### Files Affected: ~60 files, ~13,000 lines of code

**Must Delete:**
- `backend/src/contracts/TokenMinter.ts` (902 lines)
- `backend/src/contracts/MultiContractMinter.ts`
- `backend/src/contracts/RCGTokenReader.ts`
- `backend/src/domains/shop/services/BlockchainService.ts`
- All Thirdweb imports from frontend/mobile

**Must Update:**
- 10+ backend services using `getTokenMinter()`
- 20+ frontend components showing blockchain balances
- 9+ mobile screens with wallet auth
- 13 test files mocking blockchain

**Can Keep:**
- Database balance tracking (already perfect)
- Customer tier system (just remove blockchain part)
- Admin token operations (convert to database-only)
- All transaction history

## Key Changes

| What | Before | After |
|------|--------|-------|
| RCN Balances | DB + Blockchain | DB only |
| Login | Email or Wallet | Email only |
| "Mint to Wallet" | Available | Gone |
| Earning RCN | Instant, DB tracked | Same, DB tracked |
| Redeeming RCN | Instant, DB tracked | Same, DB tracked |
| Admin Operations | Blockchain + DB | DB only |
| RCG Token | Governance system | Needs redesign or removal |
| Performance | ~300ms (blockchain calls) | ~50ms (DB only) |

## Phased Approach (5-6 Weeks)

**Week 1:** Audit & planning  
**Weeks 2-3:** Backend refactoring (create DatabaseTokenService)  
**Weeks 3-4:** Frontend simplification (remove wallet auth)  
**Weeks 4-5:** Mobile app updates (email-only registration)  
**Weeks 5-6:** Testing & production deployment  

## Files That Show This is Already DB-Centric

Look at these to understand the current architecture:

1. **TokenMinter.ts line 355-357** - "DB-only earning: tokens go to platform balance"
2. **CustomerBalanceService.ts line 40** - "Handles real-time balance tracking, mint-to-wallet queuing"
3. **Migration #094** - Recalculates all balances from transaction history
4. **BlockchainService.ts line 40-54** - "If blockchain disabled, log for future processing"

The comment in TokenMinter says it all: **blockchain was made optional by design**.

## What Gets Deleted

```
Backend:
- 4 contract files (1,517 LOC)
- BlockchainService.ts

Frontend:
- src/utils/thirdweb.ts
- src/config/contracts.ts
- WalletConnectPrompt.tsx
- useWalletDetection.tsx
- RCG transfer/staking pages

Mobile:
- ConnectWalletScreen.tsx
- useRedemptionSignature.ts
- Wallet registration flow
- thirdweb.ts config

NPM:
- Remove thirdweb package (saves 8-10 MB bundle size)
```

## What Stays (Database-First)

```
- customers table (with current_rcn_balance)
- transactions table (with full history)
- customer_affiliate_group_balances
- All earning/redemption logic
- All balance calculations
- Email/password authentication
- Admin token operations
```

## Breaking Changes for Users

1. **Can't login with wallet anymore** - Use email instead
2. **Can't mint tokens to blockchain** - Stay in database
3. **RCG staking won't work** - Shop tier system needs redesign
4. **Can't manually transfer tokens** - Only earn/redeem through app

**Mitigation:** 2-week deprecation notice via email

## Questions Before Starting

Confirm with client:

1. Keep RCG token for shop tiers or remove it too?
2. How many customers have minted to blockchain? Need migration path?
3. Keep shop tier subscription system or change?
4. Still need admin manual mint/transfer? (YES - both stay as DB operations)
5. Timeline constraints? Blue-green deployment needed?

## Why This Works

- Hybrid model was built with this in mind
- Database is the source of truth
- Blockchain is read-only verification only
- No critical business logic depends on blockchain
- Clean separation of concerns

## Expected Outcomes

After removal:
- ✅ Simpler codebase (delete ~1,700 lines)
- ✅ Better performance (300ms → 50ms for balance checks)
- ✅ Easier compliance (rewards points vs crypto)
- ✅ Lower operational cost (no Thirdweb fees)
- ✅ Simpler deployment (no contract management)
- ✅ Single login method (email only)

## Cost Estimate

- **Time:** 5-6 weeks
- **Team:** 2-3 developers + 1 QA
- **Budget:** ~$14,400 at $60/hr (240 hours)

---

**Full detailed report:** See `BLOCKCHAIN_REMOVAL_ANALYSIS.md`
