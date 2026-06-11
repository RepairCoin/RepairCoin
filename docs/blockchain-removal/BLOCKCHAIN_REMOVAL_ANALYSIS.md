# RepairCoin Blockchain Integration Analysis
## Comprehensive Report on Removal Feasibility

**Date:** June 3, 2026  
**Scope:** Full blockchain removal - Convert RCN from on-chain to database-only token  
**Prepared for:** Client blockchain removal initiative

---

## Executive Summary

The RepairCoin application has **moderate-to-deep blockchain integration** centered on Thirdweb SDK v5. The good news: **balance tracking is already database-centric**, which significantly simplifies removal. The application maintains a hybrid model where:

- **Database side**: Tracks `current_rcn_balance`, `lifetime_earnings`, `total_redemptions` in PostgreSQL
- **Blockchain side**: Optional "mint to wallet" feature for customers who want to move tokens on-chain

This means **you're 60% of the way there already**. Removing blockchain would be **moderate complexity (4-6 week project)**, not a rewrite.

---

## Table of Contents
1. [Blockchain Integration Depth](#integration-depth)
2. [Files Affected](#files-affected)
3. [Smart Contract Usage](#smart-contract-usage)
4. [Database Architecture](#database-architecture)
5. [Key Dependencies](#key-dependencies)
6. [Refactoring Strategy](#refactoring-strategy)
7. [Testing Impact](#testing-impact)
8. [Complexity Assessment](#complexity-assessment)
9. [Recommended Phased Approach](#recommended-phased-approach)

---

## Integration Depth

### Current Architecture (Hybrid Model)

```
┌─────────────────────────────────────────┐
│   RepairCoin Application (Database)     │
├─────────────────────────────────────────┤
│ Customers Table:                        │
│ - current_rcn_balance (main)            │
│ - lifetime_earnings                     │
│ - total_redemptions                     │
│ - pending_mint_balance                  │
└─────────────────────────────────────────┘
              │
              │ Customer chooses
              │ "Mint to Wallet"
              ▼
┌─────────────────────────────────────────┐
│   Thirdweb SDK (Optional)               │
├─────────────────────────────────────────┤
│ RCN Contract:                           │
│ 0xBFE793d78B6B83859b528F191bd6F2b8555D│
│                                         │
│ RCG Contract (governance):              │
│ 0xdaFCC0552d976339cA28EF2e84ca1c6561  │
│                                         │
│ Operations: Mint, Transfer, Burn        │
└─────────────────────────────────────────┘
```

### Key Finding: Already Database-Centric

Looking at `TokenMinter.ts` and `CustomerBalanceService.ts`:

1. **Earnings are recorded in DB first** - No auto-mint to blockchain
2. **"Mint to Wallet" is optional** - Customers explicitly request it
3. **Redemptions tracked in DB** - Off-chain until customer approves burn
4. **All balance calculations use database** - Blockchain is read-only verification

**This is excellent news** - you're already tracking the source of truth in the database.

---

## Files Affected

### Backend Files (Core Blockchain Logic)

**Contract Interface Files** (4 files, ~1,700 LOC):
```
backend/src/contracts/
├── TokenMinter.ts              (902 lines) ⚠️ CRITICAL - Core minting logic
├── TierManager.ts              (312 lines) - Tier calculations (reusable)
├── MultiContractMinter.ts      (90 lines)  - Example/unused
└── RCGTokenReader.ts           (213 lines) - RCG token reader only
```

**Service Files Using Blockchain** (10 files):
```
backend/src/domains/
├── customer/services/CustomerBalanceService.ts      - Optional blockchain checks
├── customer/services/CustomerService.ts             - Uses TokenMinter
├── shop/services/BlockchainService.ts               - Wrapper (can be deleted)
├── token/services/TokenService.ts                   - Uses TokenMinter
├── token/services/RedemptionSessionService.ts       - Signature verification
├── admin/services/AdminService.ts                   - Treasury operations
├── admin/services/operations/TokenOperationsService.ts
├── admin/services/operations/ContractOperationsService.ts
├── shop/routes/index.ts                             - RCG balance checks
└── admin/routes/treasury.ts                         - Admin mint/transfer

backend/src/
├── handlers/webhookHandlers.ts                      - Webhook logging
├── services/EmergencyFreezeService.ts               - Contract operations
├── services/MonitoringService.ts                    - Blockchain status
└── routes/health.ts                                 - Health checks
```

**Test Files** (13 files):
```
backend/tests/
├── customer/customer.admin-operations.test.ts
├── customer/customer.earnings.test.ts
└── All other 11 test files (mock blockchain, can be simplified)
```

### Frontend Files (UI & Wallet Connection)

**Core Configuration** (2 files):
```
frontend/src/
├── utils/thirdweb.ts                    (14 lines) - Client config
├── config/contracts.ts                  (69 lines) - Contract addresses & config
```

**Components Using Blockchain** (20+ files):
```
Key files:
├── components/ThirdwebPayment.tsx       - Payment processing
├── components/WalletConnectPrompt.tsx   - Wallet connection UI
├── components/auth/DualAuthConnect.tsx  - Auth with wallets
├── components/customer/OverviewTab.tsx  - Balance display
├── components/customer/TokenGiftingTab.tsx
├── components/customer/RedemptionApprovals.tsx
├── components/shop/tabs/StakingTab.tsx  - RCG staking
├── app/providers.tsx                    - Thirdweb provider
├── hooks/useAuth.tsx                    - Auth integration
├── hooks/useWalletDetection.tsx         - Wallet detection
└── ... (13 more files with minor blockchain usage)
```

### Mobile App Files (9 files)

```
mobile/
├── app/_layout.tsx                      - Provider setup
├── shared/constants/thirdweb.ts         - Client config
├── feature/auth/screens/connect/ConnectWalletScreen.tsx
├── feature/auth/hooks/useCustomerRegister.ts
├── feature/auth/hooks/useShopRegister.ts
├── feature/token/redeem/hooks/useRedemptionSignature.ts
└── (4 more auth/token files)
```

### Summary of Files

| Category | Count | Lines | Criticality |
|----------|-------|-------|------------|
| Contract Files | 4 | 1,517 | HIGH |
| Backend Services | 10+ | ~2,500 | HIGH |
| Backend Tests | 13 | ~3,000 | MEDIUM |
| Frontend Components | 20+ | ~3,500 | MEDIUM |
| Frontend Hooks | 8+ | ~1,200 | MEDIUM |
| Mobile Files | 9 | ~1,500 | MEDIUM |
| **TOTAL** | **~60** | **~13,000** | - |

---

## Smart Contract Usage

### Smart Contracts on Base Sepolia

1. **RCN Token Contract**
   - Address: `0xBFE793d78B6B83859b528F191bd6F2b8555D951C`
   - Functions Used:
     - `mintTo(address to, uint256 amount)` - Admin minting
     - `balanceOf(address)` - Check customer balance
     - `transfer(address to, uint256 amount)` - Admin transfers
     - `burn(uint256 amount)` - Admin burn
     - `burnFrom(address account, uint256 amount)` - Customer burn (requires approval)
   - Status: **NOT actively minting** (database-only currently)

2. **RCG Token Contract** (Governance - Secondary)
   - Address: `0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D`
   - Used for: Shop tier system (Premium/Elite unlock)
   - Impact: **Would need redesign** if removing all tokens

### Critical Finding

Looking at `TokenMinter.ts` line 355-357:
```typescript
// DB-only earning: tokens go to platform balance (current_rcn_balance)
// Customers must explicitly use "Mint to Wallet" to transfer tokens on-chain
// This was changed from direct blockchain minting to prevent auto-mint on every earning
```

**The system already operates in database mode by default.** Blockchain is opt-in only.

---

## Database Architecture

### Current Balance Tracking

**Customers Table** (PostgreSQL):
```sql
customers (
  address VARCHAR PRIMARY KEY,
  
  -- Current balance (main tracking)
  current_rcn_balance DECIMAL,
  
  -- Historical tracking
  lifetime_earnings DECIMAL,
  total_redemptions DECIMAL,
  pending_mint_balance DECIMAL,    -- Waiting for wallet mint
  total_minted_to_wallet DECIMAL,  -- Already on blockchain
  
  -- Blockchain sync
  last_blockchain_sync TIMESTAMP,
  balance_synced BOOLEAN,
  
  -- Tier system
  tier ENUM ('BRONZE', 'SILVER', 'GOLD'),
  
  ... other fields
)
```

### Migration Files Related to Balances

1. `migrations/024_add_shop_subscriptions_fixed_v2.sql` - Initial schema
2. `migrations/094_fix_customer_redemption_balances.sql` - **KEY MIGRATION**
   - Recalculates `current_rcn_balance` from transaction history
   - Proof that system already uses DB as source of truth
   - Formula: `current_rcn_balance = lifetime_earnings - total_redemptions - pending_mint_balance`

### Transaction Tracking

**Transactions Table**:
```sql
transactions (
  id VARCHAR PRIMARY KEY,
  type ENUM ('mint', 'redemption', 'transfer', 'burn'),
  customer_address VARCHAR,
  amount DECIMAL,
  reason VARCHAR,
  transaction_hash VARCHAR,  -- Blockchain hash (if applicable)
  status ENUM ('pending', 'confirmed', 'failed'),
  timestamp TIMESTAMP,
  metadata JSONB
)
```

**Customer Affiliate Group Balances**:
```sql
customer_affiliate_group_balances (
  customer_address VARCHAR,
  group_id VARCHAR,
  balance DECIMAL,        -- Off-chain tracking
  earned_amount DECIMAL,
  redeemed_amount DECIMAL
)
```

### Key Insight

**The database already maintains complete, auditable transaction history.** You have:
- ✅ All earnings recorded
- ✅ All redemptions tracked
- ✅ All transfers logged
- ✅ All balance calculations documented
- ✅ Migration scripts to recalculate balances

Removing blockchain is just **removing the optional on-chain component**.

---

## Key Dependencies

### NPM Packages Involved

**Backend** (`package.json`):
```json
"thirdweb": "^5.0.0"
```
- **Size**: ~5 MB
- **Used for**: TokenMinter, TierManager, balance checks
- **Removal Impact**: LOW - Can be cleanly removed

**Frontend** (`package.json`):
```json
"thirdweb": "^5.105.16"
```
- **Size**: ~8 MB
- **Used for**: Wallet connection, balance display, RCG operations
- **Removal Impact**: MEDIUM - Affects auth flow

**Mobile** (`package.json`):
```json
"thirdweb": "^5.105.41"
```
- **Size**: ~8 MB
- **Used for**: Wallet connection, token operations
- **Removal Impact**: MEDIUM - Affects auth flow

### Environment Variables Dependent on Blockchain

```bash
# Thirdweb Configuration
RCN_THIRDWEB_CLIENT_ID=<client-id>
RCN_THIRDWEB_SECRET_KEY=<secret-key>
THIRDWEB_CLIENT_ID=<fallback>
THIRDWEB_SECRET_KEY=<fallback>

# Contract Addresses
RCN_CONTRACT_ADDRESS=0xBFE793d78B6B83859b528F191bd6F2b8555D951C
RCG_CONTRACT_ADDRESS=0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D
REPAIRCOIN_CONTRACT_ADDRESS=<legacy>

# Network Configuration
NETWORK=base-sepolia  # or 'production'
NODE_ENV=staging|production

# Wallet Configuration
PRIVATE_KEY=<admin-wallet-key>
ADMIN_ADDRESSES=<comma-separated>

# Feature Flags
ENABLE_BLOCKCHAIN_MINTING=false  # Already disabled by default!
```

---

## Refactoring Strategy

### Phase 1: Audit & Cleanup (1-2 weeks)

**Identify all blockchain dependencies:**

```bash
# Already done - see file list above
```

**Remove feature flags that assume blockchain:**
- Replace `ENABLE_BLOCKCHAIN_MINTING` checks with database-only logic
- Simplify error handling (no more "contract paused" errors)
- Remove blockchain sync attempts

**Files to modify:**
- `BlockchainService.ts` - Can be deleted or gutted
- `TokenMinter.ts` - Keep TierManager, remove contract calls
- All service files using `getTokenMinter()`

### Phase 2: Backend Refactoring (2-3 weeks)

#### Step 1: Create `DatabaseTokenService` (replacement)

```typescript
// backend/src/services/DatabaseTokenService.ts
export class DatabaseTokenService {
  async mintTokens(address: string, amount: number, reason: string): Promise<void> {
    // Just update database - no blockchain calls
    await customerRepository.updateBalanceAfterEarning(address, amount);
    await transactionRepository.recordTransaction({
      type: 'mint',
      customerAddress: address,
      amount,
      reason,
      status: 'confirmed',
      timestamp: new Date().toISOString()
    });
  }

  async redeemTokens(customerAddress: string, shopId: string, amount: number): Promise<void> {
    // Verify balance, update database
    const balance = await customerRepository.getCustomerBalance(customerAddress);
    if (balance.databaseBalance < amount) {
      throw new Error('Insufficient balance');
    }
    
    await customerRepository.updateBalanceAfterRedemption(customerAddress, amount);
    // ... transaction recording
  }

  // No blockchain calls - just database operations
}
```

#### Step 2: Update customer earning flow

**Current flow:**
```
Service Booking Complete
  → OrderController (line 156)
    → Issue RCN to customer
      → CustomerBalanceService.recordEarning()
        → customerRepository.updateBalanceAfterEarning()  [DB]
        → Optional: queue for blockchain mint
```

**New flow (same, skip blockchain):**
```
Service Booking Complete
  → OrderController
    → Issue RCN to customer
      → DatabaseTokenService.mintTokens()
        → customerRepository.updateBalanceAfterEarning()  [DB]
        → transactionRepository.recordTransaction()
      → Done (no blockchain)
```

#### Step 3: Remove wallet mint endpoints

**Files to modify:**
- `backend/src/domains/customer/routes/balance.ts`
  - DELETE: POST `/queue-mint-to-wallet`
  - DELETE: POST `/instant-mint-to-wallet`
  - KEEP: GET `/balance` (database-only)

#### Step 4: Simplify redemption flow

**Current:**
```typescript
// TokenMinter.ts line 78-192
async processRedemption(
  customerAddress, shopAddress, amount, shopId, reason
) {
  // Try to burn from blockchain
  // Fallback to transfer to burn address
  // Fallback to off-chain tracking
}
```

**New:**
```typescript
// DatabaseTokenService.ts
async processRedemption(
  customerAddress, shopId, amount
) {
  // Just verify balance and deduct from database
  const success = await customerRepository.updateBalanceAfterRedemption(
    customerAddress, amount
  );
  if (!success) throw new Error('Insufficient balance');
  
  // Record transaction
  await transactionRepository.recordTransaction({
    type: 'redemption',
    customerAddress,
    shopId,
    amount,
    status: 'confirmed'
  });
}
```

#### Step 5: Update admin operations

**Files to modify:**
- `backend/src/domains/admin/services/operations/TokenOperationsService.ts`
- `backend/src/domains/admin/routes/treasury.ts`

Remove blockchain minting, keep database operations.

### Phase 3: Frontend Refactoring (2-3 weeks)

#### Step 1: Remove Thirdweb from providers

**Current** (`app/providers.tsx`):
```tsx
import { ThirdwebProvider } from "thirdweb/react";

export default function Providers({ children }) {
  return (
    <ThirdwebProvider>
      {children}
    </ThirdwebProvider>
  );
}
```

**New**:
```tsx
export default function Providers({ children }) {
  // Thirdweb provider no longer needed
  return children;
}
```

#### Step 2: Simplify authentication

**Keep existing:** Email/password auth via JWT  
**Remove:** Wallet connection flow  
**Result:** Single login path instead of dual (wallet + email)

**Files to modify:**
- `app/providers.tsx` - Remove Thirdweb
- `app/(auth)/choose/page.tsx` - Remove wallet option or deprecate
- `components/auth/DualAuthConnect.tsx` - Simplify to email-only
- `hooks/useAuth.tsx` - Remove wallet detection

#### Step 3: Simplify balance display

**Current** (OverviewTab.tsx):
```tsx
// Checks blockchain + database
const blockchainBalance = await getTokenMinter().getCustomerBalance(address);
const databaseBalance = await api.getCustomerBalance(address);
```

**New**:
```tsx
// Database only
const balance = await api.getCustomerBalance(address);
```

**Files to modify:**
- `components/customer/OverviewTab.tsx`
- `components/customer/RedemptionApprovals.tsx`
- `components/customer/TokenGiftingTab.tsx`
- All balance display components

#### Step 4: Remove wallet-specific UI

**Delete or deprecate:**
- `WalletConnectPrompt.tsx`
- `components/shop/tabs/StakingTab.tsx` (RCG staking)
- `app/(authenticated)/admin/transfer-rcg/page.tsx`
- `app/(authenticated)/shop/rcg-otc/page.tsx`

**Keep:**
- `ThirdwebPayment.tsx` (if you want to keep payment processing)
- Otherwise delete if blockchain payment is removed

#### Step 5: Update API calls

**Remove endpoints:**
- `POST /customer/queue-mint-to-wallet`
- `POST /customer/instant-mint-to-wallet`
- `GET /admin/contract-stats`
- `POST /admin/transfer-rcg`

**Update:**
- All balance endpoints (remove blockchain checks)
- Redemption endpoints (database-only)
- Admin token operations

### Phase 4: Mobile App Refactoring (1-2 weeks)

#### Step 1: Remove wallet connection

**Delete:**
- `feature/auth/screens/connect/ConnectWalletScreen.tsx`
- `feature/auth/hooks/useCustomerRegister.ts` (wallet part)
- `feature/auth/hooks/useShopRegister.ts` (wallet part)

**Keep:**
- Email/password registration only

#### Step 2: Simplify auth flow

**Current:** 3 registration slides including wallet  
**New:** 2 slides (email + profile info, no wallet)

Files to modify:
- `mobile/app/_layout.tsx`
- `mobile/feature/auth/` screens

#### Step 3: Remove balance blockchain checks

**Delete:**
- `feature/token/redeem/hooks/useRedemptionSignature.ts`

**Keep:**
- Balance display (database-only)
- Redemption flow (database-only)

### Phase 5: Testing Updates (1-2 weeks)

**Simplify test suite:**

```bash
# Current: 13 test files mock blockchain
# New: Remove blockchain mocks, simplify to database tests

# Examples:
backend/tests/customer/customer.earnings.test.ts
  - Remove: Mock TokenMinter
  - Keep: Verify database updates

backend/tests/customer/customer.balance.test.ts
  - Remove: Blockchain balance checks
  - Keep: Database balance calculations

backend/tests/shop/shop.buy-credits.test.ts
  - Remove: Contract mint verification
  - Keep: RCN balance updates
```

---

## Complexity Assessment

### Difficulty Scale: MODERATE (5-6 weeks, 2-3 developers)

**Easy Components** (can be done in parallel):
- Remove Thirdweb packages ✅
- Delete unused contract files ✅
- Simplify test mocks ✅

**Medium Components** (sequential, require testing):
- Update TokenService to DatabaseTokenService
- Modify customer earning flow
- Update redemption flow
- Remove admin blockchain operations

**Hard Components** (high risk, careful testing needed):
- Auth flow redesign (wallet → email-only)
- Mobile app registration refactor
- Frontend UI simplification

### Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Breaking customer earnings | HIGH | Maintain database transaction history, rollback capability |
| Auth flow breaks | HIGH | Thorough testing, staging deployment before prod |
| Balance calculation errors | MEDIUM | Cross-verify with migration script #094 |
| Wallet holders lose access | MEDIUM | Deprecation notice, migration window |
| Admin operations break | LOW | Less used, easier to fix |

### Breaking Changes for Users

1. **Wallet login no longer available** - Must use email/password
2. **Blockchain balances no longer synced** - Database is source of truth
3. **"Mint to Wallet" no longer available** - Can't transfer to blockchain anymore
4. **RCG staking no longer available** - Shop tier system needs redesign
5. **Can't transfer tokens manually** - Only earn/redeem through system

**Recommendation:** 2-week deprecation notice + email campaign

---

## Recommended Phased Approach

### Timeline: 5-6 Weeks Total

**Week 1: Planning & Audit**
- [ ] Complete inventory of all blockchain code (DONE - this report)
- [ ] Document all breaking changes for users
- [ ] Design DatabaseTokenService replacement
- [ ] Create staging environment for testing
- Effort: 1 developer

**Week 2-3: Backend Refactoring**
- [ ] Create DatabaseTokenService
- [ ] Update TokenService to use DB-only logic
- [ ] Remove blockchain mint/transfer endpoints
- [ ] Update admin operations
- [ ] Simplify BlockchainService (or delete)
- Effort: 2 developers, parallel

**Week 3-4: Frontend Refactoring**
- [ ] Remove Thirdweb provider setup
- [ ] Simplify auth to email-only
- [ ] Update all balance display components
- [ ] Remove wallet-specific UI
- Effort: 1-2 developers

**Week 4-5: Mobile App Refactoring**
- [ ] Remove wallet registration screens
- [ ] Update auth flow
- [ ] Remove signature verification
- [ ] Simplify balance display
- Effort: 1 developer

**Week 5-6: Testing & Deployment**
- [ ] Unit test updates (all layers)
- [ ] Integration testing
- [ ] Staging deployment & QA
- [ ] User communication
- [ ] Production deployment with rollback plan
- Effort: 2 developers

### Resource Allocation

**Optimal team:**
- 1 Backend Lead (TokenMinter expertise)
- 1 Backend Developer (services & tests)
- 1 Frontend Developer (UI components)
- 1 Mobile Developer (auth flow)
- 1 QA/Testing

**Cost estimate (at $60/hr):**
- 240 hours × $60 = **$14,400**

---

## Implementation Checklist

### Backend

**Contract & Service Layer:**
- [ ] Create `DatabaseTokenService.ts` (500 lines)
- [ ] Update `TokenService.ts` to use DatabaseTokenService
- [ ] Delete `BlockchainService.ts` or convert to monitoring only
- [ ] Delete `MultiContractMinter.ts` (unused)
- [ ] Simplify `TierManager.ts` (keep calculations, remove contract calls)
- [ ] Update `CustomerBalanceService.ts` (remove blockchain checks)
- [ ] Update all services using `getTokenMinter()`

**Routes & Endpoints:**
- [ ] Delete wallet mint endpoints from `customer/routes/balance.ts`
- [ ] Delete blockchain operations from `admin/routes/treasury.ts`
- [ ] Delete RCG transfer endpoints from `admin/routes/settings.ts`
- [ ] Update error messages (no more "contract paused")

**Configuration:**
- [ ] Delete Thirdweb env vars from `.env`
- [ ] Update `config/production.ts` (remove contract addresses)
- [ ] Update startup validation (remove blockchain checks)

**Testing:**
- [ ] Update 13 test files to remove blockchain mocks
- [ ] Add DatabaseTokenService tests
- [ ] Verify all transaction recording

**Database:**
- [ ] Audit migration #094 (ensure accurate balance formula)
- [ ] Create rollback migration if needed
- [ ] Remove blockchain-related columns (optional: `last_blockchain_sync`, `balance_synced`)

### Frontend

**Configuration:**
- [ ] Delete `src/config/contracts.ts`
- [ ] Delete `src/utils/thirdweb.ts`
- [ ] Remove Thirdweb from `app/providers.tsx`

**Authentication:**
- [ ] Remove wallet option from `app/(auth)/choose/page.tsx`
- [ ] Simplify `components/auth/DualAuthConnect.tsx`
- [ ] Update `hooks/useAuth.tsx` (remove wallet detection)
- [ ] Update `hooks/useWalletDetection.tsx` (deprecate or delete)

**Components:**
- [ ] Update all balance display (remove blockchain checks)
- [ ] Delete `WalletConnectPrompt.tsx`
- [ ] Delete wallet connection from registration
- [ ] Update `CustomerDashboardClient.tsx`
- [ ] Update `AdminDashboardClient.tsx`

**Pages to delete or simplify:**
- [ ] Delete `app/(authenticated)/admin/transfer-rcg/page.tsx`
- [ ] Delete `app/(authenticated)/shop/rcg-otc/page.tsx`
- [ ] Deprecate `components/shop/tabs/StakingTab.tsx`
- [ ] Simplify `app/(authenticated)/shop/subscription-form/page.tsx`

**Styling:**
- [ ] Update error messages
- [ ] Update UI for redemption flow (no blockchain confirmation)

### Mobile

**Configuration:**
- [ ] Delete `shared/constants/thirdweb.ts`
- [ ] Remove Thirdweb from `app/_layout.tsx`

**Authentication:**
- [ ] Delete wallet connection screen
- [ ] Update registration flow (email + profile only)
- [ ] Remove wallet validation from hooks

**Components:**
- [ ] Simplify `feature/auth/screens/register/`
- [ ] Delete `feature/token/redeem/hooks/useRedemptionSignature.ts`
- [ ] Update balance display components

### Dependencies

**Remove from package.json:**
```bash
# Run after code changes
npm uninstall thirdweb

# Update package-lock.json
npm install
```

---

## Data Migration Strategy

### Preserve User Balances

```sql
-- Verify all balances are correct before removal
SELECT 
  address,
  lifetime_earnings,
  total_redemptions,
  current_rcn_balance,
  (lifetime_earnings - total_redemptions) as calculated_balance,
  CASE 
    WHEN ABS(current_rcn_balance - (lifetime_earnings - total_redemptions)) < 0.01
    THEN 'OK'
    ELSE 'MISMATCH'
  END as status
FROM customers
WHERE current_rcn_balance > 0
ORDER BY lifetime_earnings DESC
LIMIT 20;
```

### Optional: Clean Up Blockchain Columns

```sql
-- After confirming no blockchain dependencies
ALTER TABLE customers DROP COLUMN IF EXISTS last_blockchain_sync;
ALTER TABLE customers DROP COLUMN IF EXISTS balance_synced;
ALTER TABLE customers DROP COLUMN IF EXISTS total_minted_to_wallet;
ALTER TABLE customers DROP COLUMN IF EXISTS pending_mint_balance;
```

**Note:** Keep these for audit trail initially, delete after 3-6 months.

---

## Success Criteria

After removal, the system should:

1. ✅ Database balances are the source of truth
2. ✅ No Thirdweb SDK calls from any code
3. ✅ All tests pass without blockchain mocks
4. ✅ Earning, redemption, transfers work via database only
5. ✅ Admin can manually mint/adjust balances (database)
6. ✅ All users can view their balances
7. ✅ No customer data loss
8. ✅ No transaction history loss
9. ✅ RCG governance token removed or redesigned
10. ✅ Performance improves (no blockchain calls)

---

## Comparison: Current vs. After Removal

| Feature | Current | After Removal |
|---------|---------|---------------|
| **RCN Balances** | Database + Blockchain | Database only ✅ |
| **Earnings** | Instant database + optional blockchain | Instant database ✅ |
| **Redemptions** | Database + optional blockchain burn | Database only ✅ |
| **Transfers** | Database + blockchain | Database only ✅ |
| **Wallet Connection** | Required for some features | Not needed ❌ |
| **Login Methods** | Email OR Wallet | Email only ✅ |
| **RCG Staking** | Shop tier system | Needs redesign ⚠️ |
| **Performance** | ~300ms (with blockchain checks) | ~50ms (database only) ✅ |
| **Maintenance** | Higher (contract management) | Lower ✅ |
| **Legal/Tax** | Crypto tokens (complex) | Rewards points (simple) ✅ |

---

## Files to Delete Completely

```
backend/
├── src/contracts/MultiContractMinter.ts
├── src/contracts/RCGTokenReader.ts  (if removing RCG)
└── src/domains/shop/services/BlockchainService.ts (or convert)

frontend/
├── src/utils/thirdweb.ts
├── src/config/contracts.ts
├── src/components/WalletConnectPrompt.tsx
├── src/hooks/useWalletDetection.tsx
├── src/app/(authenticated)/admin/transfer-rcg/page.tsx
└── src/app/(authenticated)/shop/rcg-otc/page.tsx

mobile/
├── shared/constants/thirdweb.ts
├── feature/auth/screens/connect/ConnectWalletScreen.tsx
└── feature/token/redeem/hooks/useRedemptionSignature.ts
```

---

## Questions & Clarifications Needed

Before starting, confirm with client:

1. **RCG Token (Governance):** 
   - Keep it? (affects shop tier system)
   - Remove it too? (simplifies everything)

2. **Wallet Holders:**
   - How many customers have minted tokens to blockchain?
   - Do they need migration path? (keep a bridge endpoint temporarily?)

3. **Shop Tiers:**
   - Currently based on RCG holdings
   - Alternative after removal?
   - Keep subscription model?

4. **Admin Token Operations:**
   - Still need manual mint? (YES - database operations)
   - Still need transfer? (YES - database operations)
   - Still need burn? (NO - just delete from database)

5. **Affiliate Groups:**
   - Currently supports custom tokens
   - After removal: database points only?

6. **Timeline:**
   - Can affect production during refactoring?
   - Need blue-green deployment?
   - Staging test window needed?

---

## Conclusion

**RepairCoin's blockchain integration is REMOVABLE with MODERATE effort.**

**Why it's easier than expected:**
1. System is already database-centric
2. Blockchain is optional "mint to wallet" feature
3. No critical business logic depends on blockchain
4. All audit trails exist in database
5. Thirdweb SDK is cleanly separated

**Key wins after removal:**
- Simpler codebase (delete ~1,700 lines of contract code)
- Better performance (no blockchain calls)
- Simpler user auth (email-only)
- Easier compliance (rewards points, not crypto)
- Reduced maintenance (no contract management)
- Lower operational costs (no Thirdweb bills)

**Estimated cost: $14,400 over 5-6 weeks**

---

## Appendix: File Removal Script

After confirming all changes are complete:

```bash
#!/bin/bash

# Backend
rm backend/src/contracts/MultiContractMinter.ts
rm backend/src/contracts/RCGTokenReader.ts
rm backend/src/domains/shop/services/BlockchainService.ts

# Frontend
rm frontend/src/utils/thirdweb.ts
rm frontend/src/config/contracts.ts
rm frontend/src/components/WalletConnectPrompt.tsx
rm frontend/src/hooks/useWalletDetection.tsx

# Mobile
rm mobile/shared/constants/thirdweb.ts
rm mobile/feature/auth/screens/connect/ConnectWalletScreen.tsx

# NPM cleanup
npm uninstall thirdweb --save
npm install

echo "Blockchain files removed. Review remaining imports."
```

---

**End of Report**
