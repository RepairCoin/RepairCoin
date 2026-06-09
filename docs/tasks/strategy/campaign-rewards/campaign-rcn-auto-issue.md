# Spec — Campaign Rewards (RCN auto-issue + coupons + redeem-on-return)

**Status:** Proposed (design only — not built)
**Scope:** the COMPREHENSIVE version — folds in every "out of scope" item from
the original RCN-only draft and resolves all open questions. Built as ONE
unified reward model so the pieces share machinery instead of being four
separate features.

## 1. Problem

Marketing campaigns are **message-only**. `sendCampaign` delivers an email +
in-app notification and nothing else — but the AI copy can say *"You've earned a
reward."* That's an unbacked promise. Today the only honest path is vague copy +
manual issuance via `POST /shops/:shopId/issue-reward` when the customer returns.

**Goal:** let a campaign carry a real **reward** that the system fulfills —
RCN (flat or variable) or a discount coupon, granted either **on send** or
**when the customer returns** — reusing existing issuance, balance, coupon, and
event machinery.

## 2. Unified reward model (the key abstraction)

Instead of four features, one configurable reward attached to a campaign:

```
reward = {
  type:               'none' | 'rcn' | 'coupon'        // what they get
  mode (rcn only):    'flat' | 'by_tier' | 'by_spend'  // how much
  fulfillment:        'on_send' | 'on_return'          // WHEN it lands
  return_window_days: number   // only for on_return
  ...amount/coupon fields below
}
```

Every reward type flows through the same lifecycle —
**configure → (send) → fulfill → record → report** — and the same per-recipient
ledger row is the idempotency anchor for all of them.

## 3. Building blocks to REUSE (verified in code)

- **Manual RCN issuance:** `POST /shops/:shopId/issue-reward` — already has
  validation, idempotency (`x-idempotency-key`), active/verified/subscription
  checks, balance handling, on-chain mint, transaction recording.
  → **Extract into `RewardIssuanceService.issue({shopId, customerAddress, rcnAmount, source})`** shared by the route + campaigns.
- **Shop balance:** `shops.purchased_rcn_balance` + `ShopRepository.updateShopRcnBalance`.
- **On-chain mint queue** (`instant-mint` / `queue-mint`) — minting is async + gas-bound; never block the email loop on a chain tx.
- **Coupon system (already scaffolded):** `PromoCodeRepository`; campaign columns
  `campaignType:'offer_coupon'`, `promoCodeId`, `couponValue`,
  `couponType:'fixed'|'percentage'`, `couponExpiresAt`. → wire generation +
  a redemption hook.
- **Return event:** `service.order_completed` (published by ServiceDomain;
  already consumed by OrderConfirmationHandler + auto-messages) → the hook for
  **redeem-on-return**.
- **Tiers:** `CustomerRepository.getCustomersByTier('BRONZE'|'SILVER'|'GOLD')`
  → powers `by_tier` variable rewards.
- **Recipient tracking:** `marketing_campaign_recipients` (addRecipients /
  updateRecipientStatus) → extend into the reward ledger.

## 4. Reward types

### 4a. RCN — flat
Every eligible recipient gets the same N RCN. Simplest; v1 core.

### 4b. RCN — variable (was out of scope → now in)
- **`by_tier`** — `{BRONZE: x, SILVER: y, GOLD: z}`. At fulfillment, look up the
  customer's tier and issue the matching amount. (Reward your best customers more.)
- **`by_spend`** — bands keyed to the customer's historical spend, e.g.
  `[{minSpend:0, rcn:10}, {minSpend:500, rcn:25}, {minSpend:1000, rcn:50}]`.
- Balance pre-check sums the *per-recipient* amount across the eligible set
  (not count × flat).

### 4c. Discount coupon (was out of scope → now in; reuses existing schema)
- Campaign `type='coupon'` → set `couponValue` + `couponType` (fixed $ or %) +
  `couponExpiresAt`.
- **Per-recipient unique code** generated via `PromoCodeRepository` (better
  tracking + prevents sharing/abuse than one shared code), stored on the
  recipient ledger and embedded in the email.
- **Redemption hook** in the checkout/payment path (`ServiceDomain` PaymentService):
  validate the code (belongs to this customer, unexpired, unused) → apply the
  discount → mark the code consumed (one-time). No RCN/balance involved — the
  cost is the discount the shop absorbs at checkout.

## 5. Fulfillment triggers (resolves "issue on send vs on return")

Support **both**, chosen per campaign via `fulfillment`:

### 5a. `on_send` — grant immediately when the campaign sends
- **RCN:** balance pre-check → atomic debit → issue per recipient via mint queue.
- **Coupon:** generate + email the code (no balance impact until redeemed).
- Best for "thank-you gift" campaigns.

### 5b. `on_return` — grant only when the customer comes back
- At send: **don't fulfill.** Write a `pending` reward per recipient with
  `expires_at = now + return_window_days`. Email tells them to come in to claim.
- A new **`CampaignRewardRedemptionHandler` subscribes to
  `service.order_completed`**: when a recipient completes an order within the
  window and hasn't redeemed yet → fulfill (issue RCN / mark coupon used),
  mark `redeemed`. One-time, idempotent.
- Expired pending rewards → swept to `expired`.
- Best for **win-back** (only spend on customers who actually return — far more
  cost-efficient; recommended default for lapsed audiences).

The AI picks a sensible default from intent (win-back → `on_return`; thank-you →
`on_send`) but the owner can override.

## 6. Data model

**`marketing_campaigns`** — add:
- `reward_type TEXT NOT NULL DEFAULT 'none'`  (`none|rcn|coupon`)
- `reward_mode TEXT NULL`  (`flat|by_tier|by_spend`)
- `reward_rcn_amount NUMERIC(12,2) NULL`  (flat)
- `reward_rcn_by_tier JSONB NULL`  (by_tier)
- `reward_spend_bands JSONB NULL`  (by_spend)
- `fulfillment_trigger TEXT NOT NULL DEFAULT 'on_send'`  (`on_send|on_return`)
- `return_window_days INT NULL`
- *(coupons reuse existing `promo_code_id`, `coupon_value`, `coupon_type`, `coupon_expires_at`)*

Default `reward_type='none'` → every existing campaign is untouched. Opt-in.

**`marketing_campaign_recipients`** — add the per-recipient reward ledger:
- `reward_kind TEXT NULL`  (`rcn|coupon`)
- `reward_amount NUMERIC(12,2) NULL`  (RCN issued / coupon value)
- `reward_status TEXT NULL`  (`pending|issued|redeemed|skipped|failed|expired`)
- `reward_promo_code TEXT NULL`  (per-recipient coupon code)
- `reward_tx_hash TEXT NULL`
- `reward_issued_at`, `reward_redeemed_at`, `reward_expires_at TIMESTAMPTZ NULL`
- `reward_error TEXT NULL`

This row prevents double-fulfillment across send retries AND redemption events.

## 7. Flows

**on_send + RCN (immediate):**
1. Resolve recipients → eligibility split (registered wallet, not shop's own;
   ineligible → `skipped`, reason recorded; email still sent to all).
2. Compute `total_needed` = Σ per-recipient amount (handles variable modes).
3. **Balance gate:** `purchased_rcn_balance < total_needed` → block send with a
   clear message. (Resolution to "partial sends": see §8.)
4. Atomically debit `total_needed` + mark recipients `pending`.
5. Issue per recipient via mint queue, source `marketing_campaign`, idempotency
   key `campaign:{id}:{address}`. Success → `issued` + tx hash + transaction row
   tagged `campaign_id`. Failure → `failed` + **refund that recipient's RCN**.
6. Report `rcnIssued / skipped / failed / totalIssued`.

**on_return (RCN or coupon):**
1. At send: write `pending` rewards (+ `expires_at`), email the offer. No debit.
2. `service.order_completed` → redemption handler finds the customer's `pending`
   unexpired reward → fulfill (RCN: balance-check-then-issue; coupon: it was
   already applied at checkout via the code) → `redeemed`. Idempotent.
3. Nightly sweep: `pending` past `expires_at` → `expired`.

**coupon (on_send):** generate per-recipient code → email it. Redemption handled
in the checkout path (validate → apply → consume).

## 8. Resolved open questions

1. **Issue-on-send vs redeem-on-return** → **both**, via `fulfillment_trigger`
   (§5). Default chosen by intent; owner can override.
2. **Partial sends** → **all-or-nothing for `on_send` RCN** (balance must cover
   the full eligible set) — predictable, prevents "some got it, some didn't"
   confusion; the block message prompts "buy more RCN or lower the reward."
   `on_return` needs no upfront lock (balance checked at each redemption), so the
   question is moot there.
3. **Per-shop feature flag** → **yes, gate it.** Add `campaign_rewards_enabled`
   on `ai_shop_settings` (admin-controlled, default OFF), mirroring
   `ai_images_enabled` and surfaced in the same admin AI-settings tab. Controlled
   rollout; gates both attaching a reward and fulfilling it.
4. **Variable rewards** → **in scope** (§4b): `by_tier` + `by_spend`.
5. **Retry failed rewards** → a **"retry failed rewards"** action re-runs
   `RewardIssuanceService` for `failed` recipients (idempotent), surfaced in the
   campaign detail view. Applies to `on_send` RCN.

## 9. Guards & economics

- Shop must be **active + verified + subscribed** (same as manual issuance) and
  have `campaign_rewards_enabled`.
- 1 RCN = $0.10, drawn from **purchased** balance (bought from admin at tier
  price). Coupons cost the shop the discount at checkout, not RCN.
- Unregistered recipients can't receive RCN (no wallet) → emailed, RCN skipped,
  reported (coupons CAN still work for them if redeemed at the shop in person —
  optional).
- Per-recipient amount inherits the `issue-reward` validation bounds.

## 10. AI assistant integration

- **Draft tool** gains reward args (`reward_type`, `reward_mode`, amount(s),
  `fulfillment`, `return_window_days`). "Send 25 RCN to lapsed customers when
  they come back" → on_return RCN flat. Draft card shows
  **"Reward: 25 RCN each · on return (30 days) · up to 100 RCN"**.
- **"No invented offer" guardrail** stays, but the AI may state the reward in the
  copy when a real reward is configured (echoes the actual number/coupon).
- **Send card** shows the cost + balance check before the owner taps; for
  on_return it clarifies "only charged as customers return."

## 11. Components to add

- `RewardIssuanceService` — extracted shared issuance (route + campaigns).
- `CampaignRewardService` — config validation, eligibility, balance gate,
  on_send fulfillment, reporting.
- `CampaignRewardRedemptionHandler` — subscribes `service.order_completed` for
  on_return; nightly expiry sweep.
- Coupon generation (`PromoCodeRepository`) + redemption hook in PaymentService.
- Admin toggle `campaign_rewards_enabled` (mirrors the AI Images toggle work).

## 12. Rollout (phased — keeps each slice shippable)

- **Phase 1:** on_send RCN flat (the original v1) + balance gate + retry +
  feature flag + AI draft/send surfacing.
- **Phase 2:** redeem-on-return (RCN) — the `pending` ledger + order_completed
  handler + expiry sweep.
- **Phase 3:** variable RCN (`by_tier`, `by_spend`).
- **Phase 4:** coupons (per-recipient codes + checkout redemption hook) for both
  on_send and on_return.

Each phase is independently useful; the unified model means later phases mostly
add a branch, not new plumbing.

## 13. Testing

- Unit: balance gate (variable totals), eligibility split, idempotent send retry
  (no double issue/debit), per-recipient failure + refund, on_return redemption
  fires once per customer, expiry sweep, coupon validate/consume one-time.
- Integration (staging, test shop with known balance): on_send RCN issues
  on-chain + debits + ledger + tagged transactions; on_return reward fulfills on
  a simulated `service.order_completed`; coupon redeems at checkout once.
- Verify a scheduled send + a repeated worker tick issue exactly once.

## 14. Effort

- Phase 1 (on_send RCN): **M** (mostly wiring existing issuance/balance/queue).
- Phase 2 (on_return): **M** (new handler + pending ledger + sweep).
- Phase 3 (variable): **S–M**.
- Phase 4 (coupons): **M** (codes are scaffolded; the redemption hook in
  checkout is the real work).

Total **L**, but phased so value ships from Phase 1. The unified reward model is
what keeps it from being four disjoint features.
