# Blockchain Integration - Complete File Inventory

## Contract Files (CRITICAL - Delete/Refactor)

### Backend Contracts (`backend/src/contracts/`)

| File | Lines | Status | Action |
|------|-------|--------|--------|
| `TokenMinter.ts` | 902 | CORE | Extract `TierManager`, delete rest |
| `TierManager.ts` | 312 | CORE | Keep tier logic, remove Thirdweb calls |
| `MultiContractMinter.ts` | 90 | UNUSED | DELETE |
| `RCGTokenReader.ts` | 213 | RCG-ONLY | DELETE (unless keeping RCG) |

---

## Backend Service Layer (Update or Delete)

### Token & Blockchain Services

| File | Location | Lines | Uses | Action |
|------|----------|-------|------|--------|
| `TokenService.ts` | `domain/token/services/` | ~300 | `getTokenMinter()` | Replace with `DatabaseTokenService` |
| `CustomerBalanceService.ts` | `domain/customer/services/` | ~250 | `getTokenMinter()` | Remove blockchain calls |
| `BlockchainService.ts` | `domain/shop/services/` | ~140 | Token minting | DELETE entirely |
| `RedemptionSessionService.ts` | `domain/token/services/` | ~150 | Signature verification | Remove signature logic |

### Admin & Operations Services

| File | Location | Lines | Uses | Action |
|------|----------|-------|------|--------|
| `AdminService.ts` | `domain/admin/services/` | ~400 | `getTokenMinter()` | Remove blockchain operations |
| `TokenOperationsService.ts` | `domain/admin/services/operations/` | ~250 | Token mint/transfer | Keep DB operations only |
| `ContractOperationsService.ts` | `domain/admin/services/operations/` | ~200 | Contract calls | DELETE |

### Other Services

| File | Location | Lines | Uses | Action |
|------|----------|-------|------|--------|
| `CustomerService.ts` | `domain/customer/services/` | ~300 | `getTokenMinter()` | Update calls to DatabaseTokenService |
| `EmergencyFreezeService.ts` | `services/` | ~100 | Contract pause/unpause | DELETE |
| `MonitoringService.ts` | `services/` | ~150 | Blockchain status checks | DELETE or convert to DB monitoring |
| `WebhookLoggingService.ts` | `services/` | ~80 | Logs blockchain events | DELETE |

---

## Backend Routes & Endpoints

### Customer Routes

**File:** `backend/src/domains/customer/routes/balance.ts`

Endpoints to DELETE:
```
POST   /queue-mint-to-wallet         # Queue for blockchain mint
POST   /instant-mint-to-wallet       # Immediate blockchain mint
```

Endpoints to KEEP:
```
GET    /balance                      # Database balance only
```

### Admin Routes

**File:** `backend/src/domains/admin/routes/treasury.ts`

Endpoints to DELETE:
```
POST   /transfer-rcg                 # RCG token transfer
POST   /mint-rcn-admin               # Admin RCN mint to blockchain
POST   /contract-pause               # Pause smart contract
POST   /contract-unpause             # Unpause smart contract
GET    /contract-stats               # Get blockchain contract stats
```

Endpoints to KEEP/UPDATE:
```
GET    /overview                     # Dashboard (remove blockchain balance)
POST   /admin-mint-database          # Manual DB-only mint
```

### Shop Routes

**File:** `backend/src/domains/shop/routes/index.ts`

Remove:
```
GET    /rcg-balance/{address}        # Blockchain RCG balance check
POST   /check-tier-eligibility       # Based on blockchain RCG holdings
```

### Webhook Routes

**File:** `backend/src/domains/shop/routes/webhooks.ts`

Remove blockchain webhook listeners if any exist.

### Health/Status Routes

**File:** `backend/src/routes/health.ts`

Remove blockchain status checks.

---

## Backend Handlers & Utilities

| File | Location | Uses Blockchain | Action |
|------|----------|-----------------|--------|
| `webhookHandlers.ts` | `handlers/` | ✅ | Remove blockchain event handlers |
| `authRecovery.ts` | `utils/` | ❌ | No change |
| Other utilities | `utils/` | ❌ | No change |

---

## Backend Configuration & Startup

| File | Location | What to Remove |
|------|----------|---|
| `.env` | Root | `RCN_THIRDWEB_CLIENT_ID`, `RCN_THIRDWEB_SECRET_KEY`, `RCN_CONTRACT_ADDRESS`, `RCG_CONTRACT_ADDRESS`, `PRIVATE_KEY`, `ADMIN_ADDRESSES`, `NETWORK`, `ENABLE_BLOCKCHAIN_MINTING` |
| `.env.staging` | Root | Same as .env |
| `config/production.ts` | `backend/src/` | Remove contract address imports |
| `app.ts` | `backend/src/` | Remove blockchain startup validation |

---

## Backend Tests (Simplify)

### Test Files Needing Updates

**Customer Tests** (mock TokenMinter):
- `tests/customer/customer.admin-operations.test.ts`
- `tests/customer/customer.earnings.test.ts`
- `tests/customer/customer.balance.test.ts`
- `tests/customer/customer.mint-to-wallet.test.ts`
- `tests/customer/customer.approvals.test.ts`
- `tests/customer/customer.gift-tokens.test.ts`

**Shop Tests** (mock blockchain):
- `tests/shop/shop.buy-credits.test.ts`
- `tests/shop/shop.staking.test.ts`
- `tests/shop/shop.affiliate-groups.test.ts`
- `tests/shop/shop.disputes.test.ts`

**Admin Tests**:
- `tests/admin/admin.treasury.test.ts`
- `tests/admin/admin.auth.test.ts`

**Integration Tests**:
- `tests/integration/full-flow.test.ts`

**Action:** Remove blockchain mocks, keep database verification

---

## Frontend Configuration (DELETE)

### Thirdweb Setup

| File | Path | Lines | Action |
|------|------|-------|--------|
| `thirdweb.ts` | `src/utils/` | 14 | DELETE |
| `contracts.ts` | `src/config/` | 69 | DELETE |

### Providers

| File | Path | Action |
|------|------|--------|
| `providers.tsx` | `src/app/` | Remove `<ThirdwebProvider>` wrapper |
| `AuthProvider.tsx` | `src/providers/` | Remove wallet detection logic |

---

## Frontend Components (Update or Delete)

### Core Auth Components

| File | Path | Status | Action |
|------|------|--------|--------|
| `DualAuthConnect.tsx` | `src/components/auth/` | UPDATE | Remove wallet option, keep email |
| `WalletConnectPrompt.tsx` | `src/components/` | DELETE | Not needed without wallets |

### Hooks (Delete or Simplify)

| File | Path | Status | Action |
|------|------|--------|--------|
| `useAuth.tsx` | `src/hooks/` | UPDATE | Remove wallet detection |
| `useWalletDetection.tsx` | `src/hooks/` | DELETE | Entire hook not needed |
| `useAuthInitializer.ts` | `src/hooks/` | UPDATE | Remove wallet check |
| `useTokenRefresh.ts` | `src/hooks/` | UPDATE | Remove blockchain sync |

### Customer Components (Update Balance Display)

| File | Path | What Changes |
|------|------|---|
| `OverviewTab.tsx` | `src/components/customer/` | Remove blockchain balance check, show DB-only |
| `TokenGiftingTab.tsx` | `src/components/customer/` | Simplify (no blockchain needed) |
| `RedemptionApprovals.tsx` | `src/components/customer/` | Remove blockchain confirmation |
| `NotificationPreferences.tsx` | `src/components/customer/` | Update to not show blockchain alerts |
| `SettingsTab.tsx` | `src/components/customer/` | Remove wallet settings |

### Shop Components

| File | Path | Action |
|------|------|--------|
| `StakingTab.tsx` | `src/components/shop/tabs/` | DELETE (RCG staking) |
| `ShopDashboardClient.tsx` | `src/components/shop/` | Update balance display |
| `ShopGroupsClient.tsx` | `src/components/shop/groups/` | Keep group balances (DB only) |

### Admin Components

| File | Path | Action |
|------|------|--------|
| `AdminDashboardClient.tsx` | `src/components/admin/` | Update to DB balances only |
| `ShopsTab.tsx` | `src/components/admin/tabs/` | Remove blockchain checks |

### Payment & Utility Components

| File | Path | Action |
|------|------|--------|
| `ThirdwebPayment.tsx` | `src/components/` | KEEP if using for Stripe/fiat (not blockchain) |
| `WalletConnectPrompt.tsx` | `src/components/` | DELETE |
| `CommunityBanner.tsx` | `src/components/` | Update if mentions wallets |
| `Header.tsx` | `src/components/` | Update wallet display |

---

## Frontend Pages (Update or Delete)

### Authentication Pages

| File | Path | Action |
|------|------|--------|
| `choose/page.tsx` | `src/app/(auth)/` | Remove "Connect Wallet" option |
| `register/customer/page.tsx` | `src/app/(auth)/register/` | Remove wallet slide |
| `register/shop/page.tsx` | `src/app/(auth)/register/` | Remove wallet slide |

### Customer Dashboard Pages

| File | Path | Update |
|------|------|--------|
| `CustomerDashboardClient.tsx` | `src/app/(authenticated)/customer/` | Remove blockchain balance syncs |

### Shop Pages

| File | Path | Action |
|------|------|--------|
| `subscription-form/page.tsx` | `src/app/(authenticated)/shop/` | Update (if mentions blockchain) |
| `rcg-otc/page.tsx` | `src/app/(authenticated)/shop/` | DELETE (RCG trading) |

### Admin Pages

| File | Path | Action |
|------|------|--------|
| `transfer-rcg/page.tsx` | `src/app/(authenticated)/admin/` | DELETE (RCG transfers) |

---

## Frontend Services

| File | Path | Uses | Action |
|------|------|------|--------|
| `rcgPriceService.ts` | `src/services/` | RCG price feed | DELETE (if no RCG) |

---

## Mobile App (Update or Delete)

### Thirdweb Configuration

| File | Path | Lines | Action |
|------|------|-------|--------|
| `thirdweb.ts` | `shared/constants/` | 14 | DELETE |

### App Layout & Providers

| File | Path | Action |
|------|------|--------|
| `_layout.tsx` | `app/` | Remove Thirdweb provider setup |

### Auth Screens & Hooks

| File | Path | Action |
|------|------|--------|
| `ConnectWalletScreen.tsx` | `feature/auth/screens/connect/` | DELETE entire screen |
| `useCustomerRegister.ts` | `feature/auth/hooks/` | Remove wallet registration part |
| `useShopRegister.ts` | `feature/auth/hooks/` | Remove wallet registration part |

### Token Features

| File | Path | Action |
|------|------|--------|
| `useRedemptionSignature.ts` | `feature/token/redeem/hooks/` | DELETE (signature verification) |
| `useBalance.ts` | `feature/services/appointment/hooks/` | Update to DB-only balance |

### Registration Flow

| File | Path | What Changes |
|------|------|---|
| `CustomerRegisterScreen.tsx` | `feature/auth/screens/register/` | Remove wallet slide (3 slides → 2) |
| `ThirdSlide.tsx` | `feature/auth/components/form-register/` | Remove wallet connection |

---

## Dependencies to Remove

### Backend `package.json`

```json
// REMOVE:
"thirdweb": "^5.0.0"
```

**Command:**
```bash
cd backend && npm uninstall thirdweb
```

### Frontend `package.json`

```json
// REMOVE:
"thirdweb": "^5.105.16"
```

**Command:**
```bash
cd frontend && npm uninstall thirdweb
```

### Mobile `package.json`

```json
// REMOVE:
"thirdweb": "^5.105.41"
```

**Command:**
```bash
cd mobile && npm uninstall thirdweb
```

---

## Database Changes

### Schema Updates (Optional)

**Remove columns from `customers` table:**
```sql
ALTER TABLE customers DROP COLUMN IF EXISTS last_blockchain_sync;
ALTER TABLE customers DROP COLUMN IF EXISTS balance_synced;
ALTER TABLE customers DROP COLUMN IF EXISTS total_minted_to_wallet;
ALTER TABLE customers DROP COLUMN IF EXISTS pending_mint_balance;
```

**Note:** Only do this after 3-6 months if you don't need audit trail. Keep initially for safety.

### Verify Migration #094

This migration is **critical** - verify it correctly calculates balances:
```
migration/094_fix_customer_redemption_balances.sql
```

Formula it uses:
```sql
current_rcn_balance = lifetime_earnings - total_redemptions - pending_mint_balance
```

---

## Summary by Category

### DELETE These Entirely (~20 files)

```
Backend:
- TokenMinter.ts (except TierManager logic)
- MultiContractMinter.ts
- RCGTokenReader.ts
- BlockchainService.ts
- EmergencyFreezeService.ts (if blockchain-only)
- MonitoringService.ts (if blockchain-only)
- ContractOperationsService.ts
- RedemptionSessionService.ts (signature verification)

Frontend:
- WalletConnectPrompt.tsx
- useWalletDetection.tsx
- StakingTab.tsx
- transfer-rcg/page.tsx
- rcg-otc/page.tsx
- src/utils/thirdweb.ts
- src/config/contracts.ts

Mobile:
- ConnectWalletScreen.tsx
- useRedemptionSignature.ts
- shared/constants/thirdweb.ts
```

### UPDATE These (~30 files)

All files that call `getTokenMinter()`:
- 10+ backend services
- 10+ frontend components
- 5+ frontend pages
- 5+ mobile features

### KEEP These (~20 files)

- CustomerRepository, ShopRepository
- TransactionRepository
- All database-focused services
- Email/password auth
- Balance calculation logic

---

## Implementation Order

1. **Phase 1:** Delete contract files and BlockchainService
2. **Phase 2:** Create DatabaseTokenService replacement
3. **Phase 3:** Update all service imports
4. **Phase 4:** Remove Thirdweb providers
5. **Phase 5:** Delete unused pages/components
6. **Phase 6:** Simplify auth flows
7. **Phase 7:** Update tests
8. **Phase 8:** Remove dependencies

---

**Total Files to Modify/Delete: ~60**  
**Total Lines of Code Affected: ~13,000**  
**Estimated Effort: 5-6 weeks**
