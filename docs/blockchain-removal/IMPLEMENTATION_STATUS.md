# Blockchain Removal — Implementation Status & Connection Inventory

**Strategy:** B (reversible "Provider Pattern" + feature flag) — see `BLOCKCHAIN_REVERSIBLE_REMOVAL_STRATEGY.md`
**Last Updated:** June 17, 2026
**Current mode:** Database-only (`ENABLE_BLOCKCHAIN_MINTING=false` in `backend/.env`)

> **Phase 3 archive: ✅ DONE (June 16, verified June 17).** `TokenMinter`/`MultiContractMinter`/shop `BlockchainService` are now in `src/contracts/_archive/`, reached only via flag-gated `await import()`. All bucket-B contract-admin calls go through `ContractAdminService`. Typecheck clean; provider + redeem tests pass with the flag off. See `PHASE3_CLEANUP_PLAN.md` for the per-step verification.

This is the living tracker for what's **done** vs. what's **still connected to blockchain**.

---

## ✅ Completed

| # | Work | Where | Status |
|---|------|-------|--------|
| 1 | **Provider abstraction layer** — `ITokenProvider`, `DatabaseTokenProvider` (active), `BlockchainTokenProvider` (dormant), `TokenProviderFactory` (flag switch) | `backend/src/interfaces`, `backend/src/providers` | ✅ committed `572e9fed` |
| 2 | **Redeem/debit flows routed through the provider** — `TokenService.redeemTokens` + `TokenOperationsService.processManualRedemption` → `provider.debitTokens()` (both previously broke in DB-only by checking on-chain balance) | `backend/src/domains/token`, `backend/src/domains/admin` | ✅ committed `572e9fed` |
| 3 | **13 provider unit tests** | `backend/tests/providers/DatabaseTokenProvider.test.ts` | ✅ passing |
| 4 | **Verified DB-only** — 104 tests pass (13 provider + 91 redeem) with flag `false` | — | ✅ June 15 |
| 5 | **Flag set to DB-only in dev** | `backend/.env:52` | ✅ June 15 |
| 6 | **Already DB-only by design (no work needed)** — referral rewards (balance-only), shop RCN purchases (no mint), customer tier (Bronze/Silver/Gold from `lifetime_earnings`) | `ReferralService`, `ShopPurchaseService`, `TierManager.calculateTier` | ✅ verified |
| 7 | **RCG shop-tier/pricing moved fully off-chain** — tier + balance now read from DB columns `shops.rcg_tier` / `shops.rcg_balance` (admin-managed). Converted: `RCGService` (tier info, distribution, metrics, top-holders), `ShopPurchaseService`, shop `/rcg-info`, shop data-fetch sync, admin `rcg-management /distribution`. `RCGTokenReader.getContractStats()` made chain-free (it discarded its on-chain read anyway) | `RCGService.ts`, `ShopPurchaseService.ts`, `shop/routes/rcg.ts`, `shop/routes/index.ts`, `routes/admin/rcg-management.ts`, `contracts/RCGTokenReader.ts` | ✅ June 15 (typecheck clean) |
| 8 | **Flag rolled into in-repo deploy configs** — `ENABLE_BLOCKCHAIN_MINTING=false` added to `.do/app.yaml` (staging, auto-deploys from `main`), `backend/app.yaml`, `backend/.env.staging` | deploy configs | ✅ June 15 |
| 9 | **DB-only earn→redeem re-verified** — 220 tests pass with flag `false` (providers + `shop.redeem` + `shop.issue-reward`) | — | ✅ June 15 |

**Decision recorded:** the blockchain toggle stays **env-only** (`ENABLE_BLOCKCHAIN_MINTING`). The admin API endpoint `POST /api/admin/settings/system/blockchain-minting` exists but is intentionally **not wired** to any UI (and would need a `TokenProviderFactory.reset()` call + DB/env sync fix before it could safely toggle at runtime).

---

## 🟡 Still connected to blockchain — but flag-gated + archived (DB-only works today)

These are the "re-enable path." As of Phase 3 they all reach the contract via **flag-gated `await import('../contracts/_archive/TokenMinter')`** — no static import remains, the module only loads when `ENABLE_BLOCKCHAIN_MINTING=true`. Left as composite/atomic flows on purpose (routing through the provider would double-write or break atomicity).

| Flow | File | Note |
|------|------|------|
| Reward issuance (earning) | `services/RewardIssuanceService.ts:90` | DB credit always; mints only if flag on (dynamic import) |
| Redemption session burn | `domains/token/services/RedemptionSessionService.ts:727` | on-chain burn only if flag on (dynamic import) |
| Shop redemption burn | `domains/shop/routes/index.ts:91` | on-chain burn only if flag on (dynamic import) |
| Manual mint / mint-to-wallet | `TokenOperationsService` (`:42`), `CustomerBalanceService` (`:47`), `CustomerService` (`:65`) | blockchain-native, flag-gated (dynamic import) |
| Treasury batch mint | `domains/admin/routes/treasury.ts:18` | batch mint to shop wallets, flag-gated (dynamic import) |
| Webhook minting | `handlers/webhookHandlers.ts:27` | mint repair/referral/engagement, flag-gated (dynamic import) |
| Contract admin (stats/pause) | `services/ContractAdminService.ts:36` | single lazy entry point for bucket-B methods; safe stubs when flag off |
| Archived contract modules | `src/contracts/_archive/{TokenMinter,MultiContractMinter,BlockchainService}.ts` | physically archived; only loaded via the dynamic imports above |

---

## ✅ RESOLVED — RCG shop-tier/pricing now DB-based (was the 🔴 blocker)

> ⚠️ **`ENABLE_BLOCKCHAIN_MINTING` only governs minting/burning.** RCG *reads* used to be independent and hit the chain even in DB-only mode. **As of June 15 that's fixed for shop tier/pricing.**

**Decision taken:** keep the RCG tier concept but make the **DB the source of truth** (do *not* remove RCG). Shop tier (Standard/Premium/Elite) and RCN purchase pricing now derive from the admin-managed DB columns `shops.rcg_tier` / `shops.rcg_balance` (set via `POST /api/admin/shops/:shopId` RCG update → `shopManagement.ts`). No active code path reads RCG balance/tier from chain anymore.

- `RCGTokenReader.getBalance()` / `getShopTier()` are now **dormant** (only referenced by the lazy singleton + dormant `BlockchainTokenProvider`).
- `RCGTokenReader.getRCNPriceForTier()` (sync, pure) and `getContractStats()` (now chain-free constants) remain in active use for pricing/metrics.

### Read-only / monitoring (low priority)
- `services/MonitoringService.ts`, `routes/health.ts`, `services/EmergencyFreezeService.ts`, `config/production.ts` — read contract state for health/monitoring. Harmless in DB-only but still reference the chain.

---

## 🔵 Frontend — blockchain-only UI now flag-gated (June 17); wallet-login removal still pending

**✅ Done June 17 — hide blockchain-only UI in database-only mode (uncommitted):**
The frontend now learns the flag via a new public `GET /api/config` → `{ blockchainEnabled }` (mirrors `ENABLE_BLOCKCHAIN_MINTING`), consumed by `frontend/src/contexts/AppConfigContext.tsx` (`AppConfigProvider` + `useBlockchainEnabled()`; fails closed → hidden while loading/on error). When the flag is off, these are hidden:
- Customer **Mint to Wallet** card (`customer/OverviewTab.tsx`)
- Admin **Bulk Mint** + **Manual Transfer** cards (`admin/tabs/AdvancedTreasuryTab.tsx`); **RCG Transfer** page redirects to `/admin` (`admin/transfer-rcg/page.tsx`)
- Shop **Stake RCG** sidebar item (`ui/sidebar/ShopSidebar.tsx`) + Staking tab render (`shop/ShopDashboardClient.tsx`); **RCG OTC** page redirects to `/shop` (`shop/rcg-otc/page.tsx`); crypto **ThirdwebPayment** modal; **Buy RCG Tokens** buttons (`RCGBalanceCard`, `OnboardingModal`, `OnboardingBanner`)
- **Kept on purpose:** login/wallet-connect (separate track), Stripe RCN purchase, RCG tier/balance display (DB-backed).

**🔵 Still blockchain-coupled (separate frontend track — wallet login removal, breaking):**
- **Wallet auth/login:** `providers/AuthProvider.tsx`, `hooks/useWalletDetection.tsx`, `components/auth/DualAuthConnect.tsx`, `components/WalletConnectPrompt.tsx`, auth pages under `app/(auth)/` — even email login currently runs through Thirdweb's embedded wallet. Removing this is the breaking change that needs a deprecation notice.
- **Config:** `config/contracts.ts`, `utils/thirdweb.ts` (still imported unconditionally).

## 🔵 Mobile — still blockchain-coupled (separate mobile track)
- `feature/auth/screens/connect/ConnectWalletScreen.tsx`, `shared/constants/thirdweb.ts`, `feature/token/redeem/hooks/useRedemptionSignature.ts`, wallet registration flow.
- Note: most mobile "wallet" references are wallet-address-as-identifier (DB), not live chain calls.

---

## Next steps (recommended order)

1. ~~**RCG / shop-tier decision**~~ ✅ DONE June 15 — DB-based tier (see "RESOLVED" section above).
2. ~~**Roll the flag to staging** in-repo configs~~ ✅ DONE June 15 (`.do/app.yaml`, `backend/app.yaml`, `.env.staging`).
   - ⚠️ **Manual step remaining:** set `ENABLE_BLOCKCHAIN_MINTING=false` on the **live DigitalOcean prod** App Platform component (dashboard → App → Settings → component env vars). The in-repo `.do/app.yaml` covers staging auto-deploy only.
3. ~~**Live earn→redeem walkthrough (DB-only)**~~ ✅ DONE June 16 — ran the real `TokenProviderFactory → DatabaseTokenProvider` path against an isolated local postgres (flag `false`): EARN 25 → bal 25, REDEEM 10 → bal 15, OVER-REDEEM 1000 rejected, ledger shows `mint`+`redeem` with **no on-chain hash**. All assertions passed. ⚠️ Finding: `DatabaseTokenProvider` builds `new TierManager()` which needs Thirdweb creds even in DB-only mode — fold into the Phase 3 prep (see plan). A manual UI click-through is still nice-to-have but the code path is proven.
4. ~~**Phase 3 archive**~~ ✅ DONE June 16 (verified June 17). 14 static `TokenMinter` importers converted to flag-gated `await import()`; files moved to `src/contracts/_archive/`; `ContractAdminService` owns bucket-B methods. (`RCGTokenReader` stays — it's now an active chain-free pricing helper.) Optional remaining nit: move the `MintResult` type out of `_archive/` and run the Step-5 re-enable smoke test. **See `PHASE3_CLEANUP_PLAN.md`.**
5. **Frontend/mobile tracks** — remove wallet-only login + RCG/staking UI (breaking change; needs deprecation notice).
