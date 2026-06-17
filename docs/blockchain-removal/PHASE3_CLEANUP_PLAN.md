# Phase 3 — Blockchain Code Archive: Ready-to-Execute Plan

**Status:** ✅ DONE (executed June 16, 2026; verified June 17, 2026).
**Last updated:** June 17, 2026
**Goal:** Make `TokenMinter` / `MultiContractMinter` / shop `BlockchainService` have **zero static importers** so they can be physically archived, while keeping `ENABLE_BLOCKCHAIN_MINTING` fully reversible.

This is the concrete follow-up referenced in `IMPLEMENTATION_STATUS.md`.

---

## ✅ Completion summary (verified June 17, 2026)

All steps below are complete. Verified against the working tree:

| Step | State | Evidence |
|------|-------|----------|
| 0.1 Decouple `DatabaseTokenProvider` from `TierManager`'s chain deps | ✅ | `TierManager` constructor no longer creates the Thirdweb client; it's created lazily in `getClient()` (`TierManager.ts:70`), so tier math runs with no creds. `DatabaseTokenProvider` keeps `new TierManager()` safely. |
| 0.2 Create `ContractAdminService` | ✅ | `src/services/ContractAdminService.ts` exists and is **wired into 5 consumers**: `AdminService`, `ContractOperationsService`, `routes/health.ts`, `MonitoringService`, `EmergencyFreezeService`. |
| 1 Route token ops through provider / dynamic import | ✅ | All consumers now `await import('../contracts/_archive/TokenMinter')` — no static runtime import remains. |
| 2 Make dormant provider lazy | ✅ | `BlockchainTokenProvider.ts:34` lazy-imports `getTokenMinter`. |
| 3 Zero static importers | ✅ | Only one `import type { MintResult }` (`TokenService.ts:5`) remains — type-only, erased at compile time, does not load the module at runtime. |
| 4 Archive the 3 files | ✅ | `TokenMinter.ts`, `MultiContractMinter.ts`, `BlockchainService.ts` moved to `src/contracts/_archive/`. `RCGTokenReader.ts` correctly left active. |
| 5 Re-enable test | ⏳ | Not re-run; reversibility is structurally intact (dynamic imports + flag). Optional final smoke test. |

**Verification:** `npx tsc --noEmit` clean; 13 provider tests + 91 shop.redeem tests pass with `ENABLE_BLOCKCHAIN_MINTING=false`.

**Remaining nits:**
- ~~Move the `MintResult` type out of `_archive/TokenMinter`~~ ✅ DONE June 18 — moved to new `backend/src/contracts/tokenTypes.ts`; `TokenService` imports from there; archived `TokenMinter` re-exports it for back-compat. No active code references `_archive/` now (not even a type import).
- Run Step 5 (throwaway-env `=true` smoke test) once to formally prove reversibility survived the archive (partly covered by `backend/tests/_resolve.test.ts`).

The original plan is retained below for history.

---

## Why it was blocked (historical)

`TokenMinter` was **statically imported by 14 active files** — not just dormant code — so moving/deleting it red-built the tree (including active DB-only paths). The archive could not happen until those static imports were gone. ✅ Now resolved.

## DB-only earn→redeem walkthrough (June 16) — passed ✅

Ran the real `TokenProviderFactory → DatabaseTokenProvider` path against an isolated local postgres (never staging/prod), flag `false`:

| Step | Result |
|------|--------|
| Active provider | `database`, blockchainEnabled `false` |
| EARN 25 RCN | success, balance → 25, DB tx id, **no on-chain hash** |
| REDEEM 10 RCN | success, balance → 15 |
| OVER-REDEEM 1000 | rejected ("Insufficient balance"), balance stays 15 |
| Ledger | `mint 25` + `redeem 10`, both `confirmed`, no hash |

**Finding (feed into the refactor):** `DatabaseTokenProvider` constructs `new TierManager()` (DatabaseTokenProvider.ts:41), whose constructor **throws without Thirdweb credentials** (`TierManager.ts:76`). In DB-only mode this is an unnecessary blockchain coupling — staging/prod only work because creds happen to be set. Fix as part of step 0 below.

---

## Method classification (what each consumer calls on TokenMinter)

**A. Provider-able** → route through `TokenProviderFactory.getProvider()`:
- `mintRepairTokens` / `mintReferralTokens` / `mintEngagementTokens` / `adminMintTokens` / `mintTo` / `mintTokens` / `mintShopBalance` → `creditTokens()`
- `burnTokensFromCustomer` / `burnTokens` → `debitTokens()`
- `getCustomerBalance` → `getBalance()`
- `transferTokens` → `transferTokens()`

**B. Inherently blockchain** (no DB equivalent) → move behind a new lazy `ContractAdminService`:
- `getContractStats`, `pauseContract`, `unpauseContract`, `isContractPaused`

---

## Step 0 — Prep (no behavior change)
1. **Decouple `DatabaseTokenProvider` from `TierManager`'s chain deps.** Either lazy-init TierManager, or extract the pure `calculateTier(lifetimeEarnings)` math into a credentials-free helper (`TierCalculator`) and have both TierManager and the provider use it. Verify the walkthrough runs with **no** Thirdweb env vars set.
2. **Create `ContractAdminService`** (`src/services/ContractAdminService.ts`) that owns the bucket-B methods. It `await import('../contracts/TokenMinter')` **only** when `ENABLE_BLOCKCHAIN_MINTING === 'true'`, and returns safe stubs otherwise (`{ paused:false }`, fixed-constant stats, no-op pause/unpause). This becomes the *single* blockchain-admin entry point.

## Step 1 — Route token ops through the provider (kills most static imports)
Per file, replace `TokenMinter` mint/burn/balance/transfer calls with `TokenProviderFactory.getProvider()` and delete the static `import { TokenMinter }`:
- `domains/token/services/TokenService.ts` (biggest: mint*/getCustomerBalance → provider; getContractStats/pause/unpause → ContractAdminService)
- `domains/shop/routes/index.ts` (burn/getBalance/adminMint/transfer → provider)
- `domains/admin/services/operations/TokenOperationsService.ts` (adminMint/mintShopBalance → provider.credit)
- `domains/admin/services/AdminService.ts` (mintShopBalance/getCustomerBalance → provider; stats/pause → ContractAdminService)
- `domains/admin/routes/treasury.ts` (getCustomerBalance/transfer/batch-mint → provider; getContractStats → ContractAdminService)
- `domains/admin/services/operations/ContractOperationsService.ts` (all bucket-B → ContractAdminService)
- `domains/customer/services/CustomerBalanceService.ts` (getCustomerBalance/adminMint → provider)
- `domains/customer/services/CustomerService.ts` (adminMint/getCustomerBalance → provider)
- `handlers/webhookHandlers.ts` (mintRepair/Referral/Engagement → provider.credit or RewardIssuanceService)
- `routes/health.ts` (getContractStats/isContractPaused → ContractAdminService)
- `domains/shop/services/BlockchainService.ts` — itself an archive candidate; make it lazy-import TokenMinter, or fold into BlockchainTokenProvider.

Already fine (no change needed): `RedemptionSessionService.ts` already uses `await import('../../../contracts/TokenMinter')` (dynamic, flag-gated), not a static import.

## Step 2 — Make the dormant provider lazy
`providers/BlockchainTokenProvider.ts` currently imports `getTokenMinter` at module top, and `TokenProviderFactory` statically imports `BlockchainTokenProvider` — so TokenMinter loads even in DB-only. Change `BlockchainTokenProvider` to `await import('../contracts/TokenMinter')` inside each method. (It's only instantiated when the flag is on, so the dynamic import only ever runs in blockchain mode.)

## Step 3 — Verify zero static importers
```
grep -rn "import .*from .*contracts/TokenMinter" backend/src --include="*.ts" | grep -v ".test.ts"
```
Expect **only** `await import(...)` occurrences (BlockchainTokenProvider + ContractAdminService). Run `npx tsc --noEmit` (expect 0) and the test suite.

## Step 4 — Archive
Move `contracts/TokenMinter.ts`, `contracts/MultiContractMinter.ts`, `domains/shop/services/BlockchainService.ts` into `contracts/_archive/` (keep, don't delete). Update the two `await import()` paths. Keep flag `false`.
**Do NOT archive `RCGTokenReader.ts`** — it's now an active chain-free pricing/constants helper.

## Step 5 — Re-enable test
With a throwaway env, set `ENABLE_BLOCKCHAIN_MINTING=true`, `TokenProviderFactory.reset()`, confirm the dynamic imports resolve and blockchain paths still wire up. This proves reversibility survived the archive.

---

## Risk / sizing
~12 files, mostly mechanical, but touches customer balance, treasury, webhooks, and health — **must** run full typecheck + test suite after each file. Recommend its own PR, reviewed independently. Estimated 1–2 focused days.
