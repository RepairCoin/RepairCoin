# RepairCoin — Current Status & Next Tasks

**Last Updated:** June 11, 2026
**Maintainer note:** This is the single durable status doc. Update it at the end of each session instead of creating new SESSION_*/WHATS_NEXT_* files.

---

## 🟢 Done this session (June 11, 2026) — UNCOMMITTED

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

1. **Review & commit** the uncommitted work above (nothing is committed yet). Suggested branch: `feat/token-provider-abstraction` for the backend Phase 1+2; the AI chat tabs can be a separate frontend commit.
2. **Product decision:** what should "Mint to Wallet" do in database-only mode? (hide the button, or no-op). Blocks finalizing the mint-to-wallet path.
3. **Phase 3 (later):** archive blockchain files (`contracts/TokenMinter.ts`, etc.) once the team confirms — keep `ENABLE_BLOCKCHAIN_MINTING=false`. See `docs/blockchain-removal/`.
4. Optional: fix the pre-existing `CustomerAIPanel.tsx` response-type errors.

---

## 📁 Key references

- **Blockchain removal strategy & analysis:** `docs/blockchain-removal/` (start with `BLOCKCHAIN_ANALYSIS_INDEX.md`; Strategy B = `BLOCKCHAIN_REVERSIBLE_REMOVAL_STRATEGY.md`)
- **Architecture / commands:** `CLAUDE.md`
- **Feature status:** `FEATURES_IMPLEMENTATION_STATUS.md`, `docs/AI_ASSISTANT_PROGRESS_TRACKER.md`
