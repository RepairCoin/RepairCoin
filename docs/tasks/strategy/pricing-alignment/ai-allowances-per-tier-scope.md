# Scope — Per-Tier AI Allowances ($10 / $30 / $75) + Soft-Landing Cap

**Workstream:** WS3 (AI usage allowances) of the pricing rollout — see `pricing-rollout-task-breakdown.md`.
**Covers:** T3.1 (per-tier allowance), T3.1b (soft-landing cap), with T3.3 / T3.5 as tight follow-ups.
**Decision basis:** D2 (LOCKED 2026-06-22) — allowances are real metered caps; soft-land at the cap, never dead-end.
**Status:** ✅ **BUILT 2026-07-13** (T3.1 + T3.1b + T3.3). Backend tsc clean; SpendCapEnforcer 12/12 + regression
26/26. No schema change. Uncommitted. See "Built" note at the bottom for what shipped + follow-ups.

---

## Why this is the correct FIRST fix

- **Unblocked now.** The master breakdown marks T3.1 "depends on T1.2" (persist a `plan_tier` column). But
  `utils/shopTier.getShopTier(shopId)` **already resolves the tier** today: `trialing → business`, active
  `subscription_type → starter|growth|business` (legacy `standard|premium|custom → business`), else fail-closed to
  `starter`. So we can wire per-tier allowances **without waiting for the WS1 schema work** — T1.2 becomes a later
  normalization, not a blocker.
- **Self-contained.** Touches one service (`SpendCapEnforcer`) + the subscription create/change hook + the AI
  orchestrator's read of the spend decision. No cross-domain ripple.
- **Locked decision (D2).** The numbers and the cap behavior are already agreed — no product ambiguity.
- **High value.** Replaces a flat $20-for-everyone budget with the tiered allowance the pricing sheet advertises,
  and removes the "AI just stops" dead-end (current 100% hard block) that reads as broken.
- **Financially safe to ship before feature gating (WS2).** The allowance is a hard cap regardless, so a Starter
  shop can't overspend even if it can still *see* expensive ops. WS2 makes the tiers *coherent* (hides image-gen /
  Voice AI from Starter) but is NOT required for the cap to hold. Order: allowances first, gating follows.

---

## Current state (grounded in code)

- `AIAgentDomain/services/SpendCapEnforcer.ts`:
  - `DEFAULT_MONTHLY_BUDGET = 20.0` — flat, same for every shop.
  - `canSpend(shopId)` reads `ai_shop_settings.monthly_budget_usd` (admin-editable per shop); lazily provisions a
    `$20` row for a brand-new shop.
  - Cap behavior: **≥70%** → `useCheaperModel` (Haiku); **≥100%** → `allowed:false` → orchestrator **aborts** (hard
    block — the dead-end D2 wants gone).
  - `recordSpend(shopId, costUsd)` increments `current_month_spend_usd`; auto-rolls the calendar month.
- `utils/shopTier.getShopTier(shopId)` → `SubscriptionTier` — works today (see above). Reusable as-is.
- `config/subscriptionPlans.ts` — tier enum + rank; **NOTE the Starter price bug: coded $80, sheet says $99** (WS1
  fix, orthogonal to allowances — flag it, fix in the WS1 slice).
- `ai_shop_settings` table: `monthly_budget_usd` (default 20), `current_month_spend_usd`, `current_month_started_at`.

---

## Task flow (execute in this order)

### T3.1 — Allowance is a PURE FUNCTION of the shop's selected tier (no manual admin setting)
- Add a single source-of-truth map: `AI_TIER_ALLOWANCE = { starter: 10, growth: 30, business: 75 }` (in
  `config/subscriptionPlans.ts`, next to the tier defs).
- **The AI budget is ALWAYS derived from the tier — never hand-set by an admin.** In `SpendCapEnforcer.canSpend`,
  compute the effective budget as `AI_TIER_ALLOWANCE[getShopTier(shopId)]` (fail-closed to `starter/$10`). This
  follows the shop's *currently selected* tier automatically: an upgrade/downgrade takes effect on the very next
  call, with **no sync step and no stored value to drift**.
- **Drop the flat `$20` default entirely.** A shop with no settings row still gets its tier allowance via
  `getShopTier` — the enforcer no longer reads a stored `monthly_budget_usd` as the cap.
- `ai_shop_settings.current_month_spend_usd` + `current_month_started_at` stay (spend tracking + month rollover).
  `monthly_budget_usd` is no longer the cap authority — optionally keep it tier-synced on subscription change for
  dashboard display only, but the enforcer computes the cap from the tier.
- **Deprecate the admin manual-budget control.** The existing admin "set monthly AI budget" endpoint/UI
  (`SettingsController` / `SpendController`) must no longer drive the AI cap — remove or hide it so the budget
  **cannot** be hand-set. The tier is the single source of truth (per product decision, 2026-07-13).

### T3.1b — Replace the 100% hard block with the D2 soft landing
- In `SpendCapEnforcer.canSpend`, at **≥100%**: return `allowed: true` + `useCheaperModel: true` + a new
  `limitReached: true` signal (extend `SpendCheckResult`) — **do not** return `allowed:false`.
- Update the AI orchestrator: on `limitReached`, force **Haiku-only** (calls never abort) and surface the
  user-facing line.
- Keep the **70% → Haiku** downshift exactly as-is.
- **DECIDED 2026-07-13 — upgrade-only first; overage is a T3.2 follow-up.** So in Phase 1 the cap message offers
  ONLY the upgrade path: *"You've reached your plan's AI limit — upgrade your plan for more AI."* Do **not**
  advertise pay-as-you-grow yet (the button wouldn't work). When T3.2 (overage/Usage ×3 metered billing) ships,
  the message gains the second option *"…or enable pay-as-you-grow."* Until then, **Haiku-only is the ceiling**.

### T3.3 — Exempt ads-AI COGS from the shop pool (fairness prerequisite, do WITH T3.1)
- Ads creative / auto-answer AI spend currently drains the shop's included budget via `recordSpend`. It's **COGS**
  tracked separately in `ad_ai_costs`, not part of the shop's advertised allowance.
- Route ads-AI spend so it **does not** count against `ai_shop_settings.monthly_budget_usd` (add a `source`/skip
  flag on `recordSpend`, or record ads spend only to `ad_ai_costs`). Otherwise a shop's ads usage silently eats its
  $10/$30/$75 and the number is a lie.

### T3.5 — Verify new-shop provisioning interplay (verify-only)
- Confirm the existing lazy `$20` default fix (`AI spend-cap new-shop`) now provisions the **tier** default and
  doesn't 429-block a fresh shop. Add a regression test.

### Out of scope (this slice)
- **T3.2** AI Usage Overage billing (3× "Usage ×3") — separate add-on, `ai-usage-overage-scope.md`.
- **T3.4** Usage-meter UI ("X of $Y used") — small frontend follow-up; the add-on hub already renders a bar.
- **T1.2** `plan_tier` column persistence — later WS1 normalization; not needed (getShopTier suffices).
- **Starter $80 → $99** price fix — WS1; flag but don't fix here.

---

## Open decisions (small)

1. **Admin manual override — RESOLVED (2026-07-13): none.** The AI budget is purely tier-driven; admins do NOT
   set it manually. The existing admin monthly-budget control is deprecated for the AI cap (remove/hide it).
2. **Shop with no active subscription** (not trial, not RCG) — resolves to `starter`/$10 via getShopTier fail-close.
   Acceptable? (Recommend: yes — lowest tier is the safe default.)
3. **RCG-qualified shops** (≥10K RCG bypass subscription) — today they get "everything"; what AI allowance? Inherit
   `getShopTier` (→ starter/$10 unless they also hold a subscription). Flag for PM (ties to T2.6). (Recommend:
   treat as starter for AI budget unless separately decided — non-blocking.)

---

## Testing
- Unit: `AI_TIER_ALLOWANCE` mapping; `canSpend` computes the budget from `getShopTier` per tier (starter/growth/
  business/trial) **regardless of any stored `monthly_budget_usd`** (compute-at-read; a hand-set value is ignored);
  soft-landing returns `allowed:true + limitReached` at ≥100% (not a block); 70% still downshifts; ads-AI spend does
  NOT decrement the shop pool (T3.3).
- Regression: new-shop first AI call isn't 429-blocked and gets its tier allowance (T3.5).

## Rollout
- No migration. Behavior change is guarded by shipping value (tiered budget + soft landing) — low risk, but land
  behind existing subscription flows. Verify against staging spend history before locking the numbers (D2 follow-up).

---

## Built 2026-07-13 (what shipped)

- **`config/subscriptionPlans.ts`** — `AI_TIER_ALLOWANCE = { starter: 10, growth: 30, business: 75 }`.
- **`SpendCapEnforcer`** — budget = `AI_TIER_ALLOWANCE[getShopTier(shopId)]` (compute-at-read, fail-closed to
  starter/$10); flat $20 removed; no-row shops get their tier budget. At ≥100%: soft landing —
  `allowed:true + useCheaperModel:true + limitReached:true` (never a hard block).
- **`SpendCheckResult`** — new `limitReached?` field.
- **Consumer cost-safety (so soft landing doesn't uncap spend):** `InsightsController` + `MarketingChatController`
  (Sonnet) now honor `useCheaperModel` → Haiku at ≥70% and past cap (also fixes a latent 70% bug). Cheap-model
  consumers (Help/Voice/FAQ/ads = already Haiku) need no change. `BrandKitController` (vision, can't degrade)
  treats `limitReached` as a block with an "upgrade your plan" message.
- **T3.3** — ads-AI (`AdCreativeService`, `GoogleAdsCreativeService`, `LeadAIService`, `LeadAutoAnswerService`)
  no longer calls `spendCap.recordSpend` → ads COGS (already tracked in `ad_ai_costs`) stops draining the shop's
  $10/$30/$75 pool.

## Follow-ups (not in this slice)
- **Hide/remove the admin "set monthly AI budget" control** (`SettingsController` / `SpendController` + its UI).
  It's now **inert** — the enforcer computes the cap from the tier and ignores any stored `monthly_budget_usd`.
  A dead setting is confusing; remove it. (Small.)
- **Surface the limit message in the chat UIs** — text features (Insights/Marketing/Unified) currently degrade to
  Haiku *silently* at the cap. Show "You've reached your plan's AI limit — upgrade for more AI" in the UI. Best
  done with **T3.4** (usage-meter UI). BrandKit already shows it (block path).
- **T3.2** overage / pay-as-you-grow (3× metered billing) — deferred by decision (upgrade-only first).
