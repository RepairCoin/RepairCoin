# RepairCoin — Current Status & Next Tasks

**Last Updated:** June 16, 2026
**Maintainer note:** This is the single durable status doc. Update it at the end of each session instead of creating new SESSION_*/WHATS_NEXT_* files.

---

## 🟢 Done this session (June 15–16, 2026) — UNCOMMITTED (working tree)

> Blockchain-removal initiative (Strategy B) — picked up from the June 11 Phase 1+2 work below. Phase 1+2 were committed as `572e9fed`; everything in this section is **still uncommitted** in the working tree.

### 1. RCG shop-tier / pricing moved fully off-chain (was the main blocker)
Shop tier (Standard/Premium/Elite) and RCN purchase pricing now derive from admin-managed DB columns `shops.rcg_tier` / `shops.rcg_balance` instead of reading the RCG balance from chain. No active code path reads RCG balance/tier on-chain anymore. Converted: `RCGService`, `ShopPurchaseService`, shop `/rcg-info`, shop data-fetch sync, admin `rcg-management /distribution`; `RCGTokenReader.getContractStats()` made chain-free. `RCGTokenReader.getBalance()`/`getShopTier()` are now dormant. (typecheck clean)

### 2. Database-only mode rolled into deploy configs
`ENABLE_BLOCKCHAIN_MINTING=false` added to `.do/app.yaml` (staging auto-deploy), `backend/app.yaml`, `backend/.env.staging`. Dev `.env` already false.

### 3. Live DB-only earn→redeem walkthrough — PASSED ✅ (June 16)
Ran the real `TokenProviderFactory → DatabaseTokenProvider` path against an isolated local Postgres (flag `false`): EARN 25 → bal 25, REDEEM 10 → bal 15, OVER-REDEEM 1000 rejected, ledger shows `mint`+`redeem` confirmed with **no on-chain hash**. 220 tests pass with the flag off.
- **Finding:** `DatabaseTokenProvider` constructs `new TierManager()`, whose constructor throws without Thirdweb creds even in DB-only mode — unnecessary coupling. Folded into Phase 3 Step 0.

### 4. Phase 3 archive — ✅ DONE (June 16, verified June 17)
The 14 static `TokenMinter` importers were all converted to flag-gated `await import('../contracts/_archive/TokenMinter')`, and `TokenMinter`/`MultiContractMinter`/shop `BlockchainService` were physically moved into `backend/src/contracts/_archive/`. `ContractAdminService.ts` is now the single lazy blockchain-admin entry point and is wired into 5 consumers (AdminService, ContractOperationsService, health, MonitoringService, EmergencyFreezeService). `TierManager` was decoupled (Thirdweb client now lazy, constructor no longer throws without creds). `RCGTokenReader` deliberately kept active (chain-free pricing helper). Verified: `tsc --noEmit` clean; 13 provider + 91 redeem tests pass with the flag off. Only cosmetic nit left: a type-only `import type { MintResult }` still points into `_archive/` (erased at compile, harmless). See `docs/blockchain-removal/PHASE3_CLEANUP_PLAN.md`.

### 5. Living tracker updated
`docs/blockchain-removal/IMPLEMENTATION_STATUS.md` is the current source of truth for done-vs-still-connected.

---

## 🟢 Previously done (June 11, 2026)

> Phase 1+2 below are now **committed** (`572e9fed`). The AI chat tab strip status is unverified — confirm before assuming it's committed.

### 1. AI Repair Assistant — "Recent Chats" tab strip (frontend-only)

### 1. AI Repair Assistant — "Recent Chats" tab strip (frontend-only)
Customers can keep up to 5 recent conversations and switch between them via a thin tab strip; each thread keeps its own messages, auto-titled from the first message; `+` starts a new chat, `×` closes one. Persisted in `localStorage` (per-device), with a migration that wraps any existing single conversation into a thread (no data loss).

**Files:**
- `frontend/src/types/aiChat.ts` — added `ChatThread`
- `frontend/src/stores/aiChatStore.ts` — thread ring (max 5), `switchThread`/`deleteThread`, auto-title, persist v1 + migration
- `frontend/src/components/customer/ai/CustomerAIPanel.tsx` — tab strip UI, reusable `createSession()`, `handleNewChat()`, failure back-off

> Note: a few pre-existing `tsc` errors remain in `CustomerAIPanel.tsx` from earlier June-9 WIP (API response types describe the old `{success,data}` wrapper while the client already unwraps the body). They don't block builds (`next.config` has `ignoreBuildErrors: true`). Optional cleanup: fix `StartChatResponse`/`SendMessageResponse`/`UploadImageResponse` to the unwrapped shapes.

### 2. Blockchain Reversible Removal — Strategy B (Provider Pattern)
Implemented the abstraction that lets blockchain be toggled on/off via `ENABLE_BLOCKCHAIN_MINTING` with no code changes. Strategy docs now live in **`docs/blockchain-removal/`**.

**Phase 1 — abstraction layer (new, non-breaking):**
- `backend/src/interfaces/ITokenProvider.ts`
- `backend/src/providers/DatabaseTokenProvider.ts` (active provider)
- `backend/src/providers/BlockchainTokenProvider.ts` (dormant; composes the DB provider + adds on-chain mint/burn)
- `backend/src/providers/TokenProviderFactory.ts` (reads the flag)
- `backend/tests/providers/DatabaseTokenProvider.test.ts` — **13 tests, passing**

**Phase 2 — wired the clean credit/debit flows:**
- `TokenOperationsService.processManualRedemption` → `provider.debitTokens`
- `TokenService.redeemTokens` → `provider.debitTokens`
- Both were **broken in DB-only mode** (they checked the on-chain balance, ≈0 when blockchain is off) — now fixed. Existing `tests/shop/shop.redeem.test.ts` (91 tests) still pass.

**Key correctness fact:** the canonical available balance is the *calculated* `customerRepository.getCustomerBalance().databaseBalance`, NOT the raw `current_rcn_balance` column. `TokenService.getBalance/getRCNBalance` return the *on-chain* balance — do not confuse the two.

**Deliberately NOT migrated** (blockchain-native or composite-atomic; already flag-gated, so they run DB-only when the flag is off — forcing the provider would double-write or break atomicity):
`RewardIssuanceService` (issueRewardAtomic), `RedemptionSessionService.processApprovedRedemption`, shop routes redemption (index.ts ~1329/2231), `manualMint` + `CustomerBalanceService` mint-to-wallet, admin treasury batch-mint.

---

## ⏭️ Next steps

1. ~~**Review & commit** the backend Phase 1–3 working-tree changes~~ ✅ DONE June 17 — committed as `5ffd1e20` on branch `chore/blockchain-removal-phase3` (RCG-off-chain, deploy-config flags, `ContractAdminService.ts`, `_archive/` move + 14 consumers, `TierManager` decouple, docs). Confirmed nothing had previously landed on `origin/main`. **Not pushed yet.**
2. **Manual prod step (STILL PENDING):** set `ENABLE_BLOCKCHAIN_MINTING=false` on the **live DigitalOcean prod** App Platform component (dashboard → App → Settings → env vars). The in-repo `.do/app.yaml` only covers staging auto-deploy.
3. ~~**Product decision: "Mint to Wallet" in DB-only mode**~~ ✅ DECIDED + IMPLEMENTED June 17 — decision: **hide** all blockchain-only UI when the flag is off. Implemented (uncommitted): new public `GET /api/config` returning `{ blockchainEnabled }` (mirrors the env flag) + frontend `AppConfigProvider`/`useBlockchainEnabled()` hook (fails closed). Hidden when off: customer Mint-to-Wallet, admin Bulk Mint + Manual Transfer + RCG Transfer page (redirect), shop Stake-RCG nav/tab + RCG OTC page (redirect) + crypto ThirdwebPayment + "Buy RCG" buttons (RCGBalanceCard/OnboardingModal/OnboardingBanner). **Kept:** login/wallet-connect, Stripe RCN purchase, RCG tier/balance display (DB-backed). Backend + touched-frontend typecheck clean (pre-existing FE errors unrelated). Decision was: keep login as-is (auth removal stays a separate track).
4. **Commit the #3 work** — the config endpoint + frontend hiding are uncommitted (12 files + new `frontend/src/contexts/AppConfigContext.tsx`). Suggested as a second commit on the same branch, then push + open PR.
5. **DECISION (June 18): wallet login via Thirdweb is KEPT permanently** — it is NOT part of the blockchain-removal scope. Do not remove wallet/Thirdweb authentication. Only blockchain *token actions* (mint/burn/RCG/staking/crypto-pay) are gated off in DB-only mode; auth stays as-is. **Mobile** is still blockchain-coupled for *token* features (redemption signature, thirdweb constants) — those could be revisited later, but the wallet-connect login screen stays.
6. Optional cleanup: (a) move the `MintResult` type out of `_archive/TokenMinter` so nothing — not even a type import — reaches into `_archive/`; (b) run the Phase 3 Step-5 re-enable smoke test (`=true` in a throwaway env) — partially covered by the new `backend/tests/_resolve.test.ts`; (c) optionally gate the admin `debug-pending-mints` page (direct-URL debug tool); (d) fix the pre-existing `CustomerAIPanel.tsx` response-type errors.

---

## 📁 Key references

- **Blockchain removal strategy & analysis:** `docs/blockchain-removal/` (start with `BLOCKCHAIN_ANALYSIS_INDEX.md`; Strategy B = `BLOCKCHAIN_REVERSIBLE_REMOVAL_STRATEGY.md`)
- **Architecture / commands:** `CLAUDE.md`
- **Feature status:** `FEATURES_IMPLEMENTATION_STATUS.md`, `docs/AI_ASSISTANT_PROGRESS_TRACKER.md`
