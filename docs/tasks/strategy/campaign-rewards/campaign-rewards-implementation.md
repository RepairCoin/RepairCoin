# Implementation Plan — Campaign Rewards

Companion to `campaign-rcn-auto-issue.md` (the spec). Turns the unified reward
model into ordered, file-level tasks. **Phased so each phase ships independently**;
Phase 0 is shared foundation, Phases 1–4 add reward capabilities.

Legend: ➕ new file · ✏️ edit · 🗄️ migration · 🧪 tests.

---

## Phase 0 — Foundation (shared by all later phases)

### 0.1 Migrations
- 🗄️ `migrations/1XX_campaign_rewards.sql`
  - `marketing_campaigns` ADD: `reward_type TEXT NOT NULL DEFAULT 'none'`,
    `reward_mode TEXT`, `reward_rcn_amount NUMERIC(12,2)`,
    `reward_rcn_by_tier JSONB`, `reward_spend_bands JSONB`,
    `fulfillment_trigger TEXT NOT NULL DEFAULT 'on_send'`, `return_window_days INT`.
  - `marketing_campaign_recipients` ADD: `reward_kind TEXT`,
    `reward_amount NUMERIC(12,2)`, `reward_status TEXT`,
    `reward_promo_code TEXT`, `reward_tx_hash TEXT`,
    `reward_issued_at TIMESTAMPTZ`, `reward_redeemed_at TIMESTAMPTZ`,
    `reward_expires_at TIMESTAMPTZ`, `reward_error TEXT`.
  - Index `marketing_campaign_recipients (customer_address, reward_status)` for
    the redemption lookup (Phase 2).
- 🗄️ `migrations/1XX_campaign_rewards_flag.sql`
  - `ai_shop_settings` ADD `campaign_rewards_enabled BOOLEAN NOT NULL DEFAULT false`.
- Record + verify both on staging (mirror the migration-verify scripts pattern).

### 0.2 Extract the shared issuance service
- ➕ `domains/AIAgentDomain/.../` → actually `services/RewardIssuanceService.ts`
  (under `src/services/`, next to MarketingService).
  - Move the mint + balance-deduct + transaction-record + idempotency logic out
    of `shop/routes/index.ts` `POST /:shopId/issue-reward` (≈ lines 1999–21xx).
  - Public API:
    `issueExact({ shopId, customerAddress, rcnAmount, source, idempotencyKey }) → { ok, txHash?, error? }`
    — issues a FIXED amount (campaigns pass the resolved amount; no repair-amount
    math). Internally: validate shop active/verified, customer registered+active,
    not self → debit `purchased_rcn_balance` → enqueue on-chain mint → record
    transaction (tagged `source`) → return.
- ✏️ `shop/routes/index.ts` — refactor `/issue-reward` to compute base+tier+promo
  as today, then call `RewardIssuanceService.issueExact(...)` for the mint/debit/
  record tail. (No behavior change — pure extraction; covered by existing tests.)
- 🧪 Unit tests for `issueExact`: success, insufficient balance, unregistered
  customer, idempotent replay.

### 0.3 Admin feature flag (reuses the AI Images toggle pattern)
- ✏️ `SettingsController.ts` — add `campaignRewardsEnabled` to `ShopAiSettings`,
  `AdminShopAiSettingsUpdate`, the validator, `fetchSettings`, `ADMIN_SELECT`,
  `mapAdminRow`, and the admin upsert `add()` (exactly like `aiImagesEnabled`).
- ✏️ `frontend/.../aiSettings.ts` — add `campaignRewardsEnabled` to the read +
  admin-update types.
- ✏️ `frontend/.../AdminAISettingsTab.tsx` — add a "Campaign Rewards" `Switch`
  column + summary count.

### 0.4 Repository plumbing
- ✏️ `MarketingCampaignRepository.ts` — read/write the new reward columns in
  create/update/find + the row mapper.
- ✏️ recipients access (in repo or MarketingService) — add:
  `markRecipientReward(campaignId, address, patch)`,
  `findPendingRewardForCustomer(address)` (Phase 2),
  `findFailedRewardRecipients(campaignId)` (retry).

**DoD Phase 0:** migrations applied; `/issue-reward` still green via the
extracted service; admin can toggle `campaign_rewards_enabled`; campaigns can
persist (unused) reward config.

---

## Phase 1 — on_send RCN, flat amount

### 1.1 Reward orchestration service
- ➕ `services/CampaignRewardService.ts`
  - `validateConfig(campaign)` — type/mode/amount/fulfillment sanity + flag check.
  - `resolveAmounts(recipients, campaign)` — flat → same N each (variable in P3).
  - `eligibilitySplit(recipients)` — registered wallet + not shop's own →
    `eligible[]`; rest → `skipped` with reason.
  - `balanceGate(shopId, totalNeeded)` — throws a typed "insufficient balance"
    (shop balance < total) → caller blocks the send.
  - `fulfillOnSend(campaign, eligible)` — atomic debit of total + mark `pending`;
    then per recipient `RewardIssuanceService.issueExact(...)` with key
    `campaign:{id}:{address}`; success → `issued`(+txHash); failure → `failed` +
    refund that recipient's amount. Returns `{ issued, skipped, failed, totalIssued }`.

### 1.2 Wire into the send pipeline
- ✏️ `MarketingService.sendCampaign` — after `getTargetAudience`, if
  `reward_type !== 'none'` and `fulfillment_trigger='on_send'`:
  run `CampaignRewardService.balanceGate` (block on fail) → `fulfillOnSend`,
  merge reward counts into `CampaignDeliveryResult`. (Email loop unchanged;
  everyone still gets the message.)
- ✏️ `CampaignScheduler` — no change needed; it calls `processScheduledCampaigns`
  → `sendCampaign`, so scheduled sends inherit rewards. Confirm idempotency on a
  repeated tick (the per-recipient ledger guarantees it).

### 1.3 Retry failed
- ✏️ route `POST /api/.../campaigns/:id/retry-rewards` → re-run `issueExact` for
  `failed` recipients (idempotent), debit only what re-issues.

### 1.4 AI + frontend surfacing
- ✏️ `proposeCampaignDraft.ts` — add `reward_rcn` (+ later mode/fulfillment) to
  the input schema; persist to campaign; add to the `campaign_draft` display.
- ✏️ `estimateCampaignRevenue` card area / `CampaignDraftCard` — show
  "Reward: N RCN each · X recipients · total N·X RCN".
- ✏️ `proposeCampaignSend` / `CampaignReviewModal` — show RCN cost + balance
  check before the Send tap; block with "buy more RCN" if short.
- ✏️ Orchestrate prompt — allow stating the real reward in copy when configured;
  keep the "no invented offer" rule otherwise.

### 1.5 🧪 Tests
- balanceGate (enough/short), eligibility split, idempotent re-send (no double
  issue/debit), per-recipient failure + refund, retry-failed.
- Integration (staging test shop, known balance): 2-recipient flat reward issues
  on-chain + debits + ledger + tagged transactions.

**DoD Phase 1:** owner can attach a flat RCN reward, send (or schedule), and
recipients actually receive RCN; balance enforced; failures retryable.

---

## Phase 2 — redeem-on-return (RCN)

### 2.1 Pending at send
- ✏️ `CampaignRewardService` — `fulfillOnReturn(campaign, eligible)`: write
  `reward_status='pending'` + `reward_expires_at = now + return_window_days`,
  **no debit** at send.

### 2.2 Redemption handler
- ➕ `domains/AIAgentDomain/services/CampaignRewardRedemptionHandler.ts`
  - Subscribe `service.order_completed` (via EventBus, like
    OrderConfirmationHandler / messaging).
  - On event: `findPendingRewardForCustomer(address)` within window & not
    redeemed → `RewardIssuanceService.issueExact` → mark `redeemed`. Idempotent
    (status guard). Catch errors so a redemption never breaks order completion.
- ✏️ register the handler in `AIAgentDomain/index.ts` (mirrors the existing
  `service.order_completed` subscription).

### 2.3 Expiry sweep
- ➕ `services/CampaignRewardExpiryScheduler.ts` — node-cron (mirror
  `CampaignScheduler`): flip `pending` past `reward_expires_at` → `expired`.
  Wire start/stop in `app.ts`.

### 2.4 AI + frontend
- ✏️ draft tool — `fulfillment` + `return_window_days` args; card shows
  "25 RCN when they return (30 days) · up to N·X RCN".
- ✏️ AI default: win-back/lapsed audiences → suggest `on_return`.

### 2.5 🧪 Tests
- Pending written at send (no debit); redemption fires once on a simulated
  `service.order_completed`; second event for the same customer is a no-op;
  expiry sweep flips overdue rows.

**DoD Phase 2:** a win-back campaign grants RCN only when the customer actually
returns, within the window.

---

## Phase 3 — variable RCN (by_tier, by_spend)

- ✏️ `CampaignRewardService.resolveAmounts` — branch on `reward_mode`:
  - `by_tier` → read each recipient's tier (CustomerRepository) → map
    `reward_rcn_by_tier`.
  - `by_spend` → bucket by historical spend → `reward_spend_bands`.
- ✏️ `balanceGate` already sums per-recipient (works unchanged).
- ✏️ draft tool — accept the tier map / spend bands; card shows the schedule
  ("Gold 50 / Silver 25 / Bronze 10 RCN · total …").
- 🧪 amount resolution per mode; balance total with mixed amounts.

**DoD Phase 3:** rewards can scale by tier or spend.

---

## Phase 4 — discount coupons

### 4.1 Generation at send
- ✏️ `CampaignRewardService` — for `reward_type='coupon'`, generate a
  **per-recipient unique code** via `PromoCodeRepository` (value/type/expiry from
  the campaign's `coupon_value`/`coupon_type`/`coupon_expires_at`), store on the
  recipient ledger (`reward_promo_code`), and inject it into that recipient's
  email body.

### 4.2 Redemption at checkout
- ✏️ `ServiceDomain` PaymentService (checkout/order path) — accept a campaign
  coupon code: reuse the atomic `PromoCodeRepository.validateAndReserveAtomic`
  pattern → apply the discount → consume the code (one-time) → mark recipient
  `redeemed`. Works for both on_send (code emailed now) and on_return.

### 4.3 AI + frontend
- ✏️ draft tool — coupon args (value/type/expiry); card shows "20% off, expires
  …"; copy may state the offer (it's real now).
- 🧪 code generation uniqueness, validate/consume one-time, expiry, redeem marks
  recipient redeemed.

**DoD Phase 4:** campaigns can hand out trackable discount codes redeemable at
checkout.

---

## Cross-cutting

- **Flag gate** (`campaign_rewards_enabled`) checked in `CampaignRewardService`
  and the draft tool — no reward config or fulfillment without it.
- **Idempotency** everywhere via the recipient ledger row + `issueExact` keys.
- **Audit**: every issuance is a transaction tagged `source='marketing_campaign'`
  + `campaign_id`; reward status visible per recipient in the campaign detail.
- **Security**: shopId from JWT; coupon codes bound to (campaign, customer);
  on-chain mints go through the existing queue (no inline chain calls in loops).

## Sequencing & effort
1. **Phase 0** (M) — must land first (migrations + extracted service + flag).
2. **Phase 1** (M) — first user-visible value (on_send RCN flat).
3. **Phase 2** (M) — redeem-on-return.
4. **Phase 3** (S–M) — variable.
5. **Phase 4** (M) — coupons (checkout hook is the real work).

Ship Phase 0+1 together as the MVP; 2–4 as follow-ups. Each later phase mostly
adds a branch to `CampaignRewardService` + a card variant, not new plumbing.

## Rollout checklist (per phase)
- Migration recorded + verified on staging.
- `npm ci && npm run build` (backend) + frontend typecheck clean.
- Tested on a staging test shop with a known RCN balance (no real customer sends).
- Behind `campaign_rewards_enabled` (default OFF) until QA signs off.
