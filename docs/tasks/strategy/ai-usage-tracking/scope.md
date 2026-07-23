# Scope — AI Usage Tracking + Spend-Counter Integrity

Two problems that share one root cause and one fix:

1. **Admin can't see real AI spend.** The admin cost-summary reports ~30% of actual Claude/AI cost.
2. **The spend cap under-enforces.** The per-shop budget counter drifts low, so shops can exceed their AI
   budget without the cap catching it.

Both stem from AI cost being an **incrementing counter over ~8 fragmented per-feature tables**. Both are
fixed by deriving spend from a single unified view instead.

---

## Evidence (measured on staging, 2026-07 month-to-date)

**Admin dashboard is 70% blind.** True AI cost this month vs what the admin cost-summary shows:

```
ai_agent_messages        $2.71   ← the ONLY table the admin summary reads
ai_orchestrate_messages  $4.22   (unified assistant — the live AI surface, invisible to admin)
ai_image_generations     $1.79
ai_insights_messages     $0.37   (insights, anomaly + recommendation phrasing)
ai_voice_transcriptions  $0.02
  TRUE TOTAL             $9.11
  admin shows            $2.71   → 70% of real spend is invisible
```

`SpendController.getAdminCostSummary` aggregates `FROM ai_agent_messages` only. There are ~8 cost tables
(`110/121/122/128/129/130/132/134`), each logging `cost_usd` per call.

**The enforcement counter under-reports.** `ai_shop_settings.current_month_spend_usd` per shop vs true:

```
shop                 true$    counter$   under-enforced by
peanut               2.24      0.78       $1.46
1111                 5.80      5.64       $0.16
7777                 0.44      0.35       $0.10
ancient-realm-tech   0.63      0.57       $0.06
  TOTAL              9.11      7.35       $1.76
```

---

## Scope: THREE money systems, three lenses (don't conflate)

Admin AI monitoring must cover all three, but they are different *directions* of money — summing them into one
number is meaningless.

```
1. AI-budget COGS   8 Claude/OpenAI feature tables     $9.11   money OUT — shop consumption vs plan allowance
2. Ads AI COGS      ad_ai_costs (mig 150, in CENTS)    $0.07   money OUT — creative gen + lead AI; feeds ads True Margin; INVISIBLE to the AI cost-summary today
3. Overage REVENUE  ai_overage_charges (mig 225)       $0.00   money IN — what FixFlow bills shops past their cap (×3); none yet (AI_OVERAGE_STRIPE_ENABLED off)
```

**Decision — coverage:**
- **Include Ads AI COGS in the unified view.** It is the same Anthropic/OpenAI money going out; $0.07 now but it
  grows with ad volume, and it's currently invisible in `getAdminCostSummary`. Add `ad_ai_costs` to the view
  (normalize cents→usd, tag `feature='ads'`). It STAYS in the ads per-campaign True-Margin view too — same
  table, two lenses.
- **Surface Overage as REVENUE, a separate section — not added to COGS.** It's already half-built on the
  `messaging-costs` tab (`getAdminOverageSummary` + invoice button); **consolidate it into the AI Usage
  dashboard** where it belongs.
- **Dashboard layout = three panels:** (a) **AI COGS** by feature (incl. ads) — money out; (b) **Overage
  revenue** — money in; (c) **Margin / reconciliation** — COGS vs the AI allowance baked into plan price vs
  overage revenue, and audit-total vs the real Anthropic/OpenAI/Stripe invoices.

Only system #1 has the integrity bug below; #2 and #3 are correct, just under-surfaced.

## Root causes (three, one dominant)

1. **Mid-month counter resets — the real bug.** `current_month_started_at` is meant to advance only on a
   calendar-month rollover, but peanut's is **July 14** (mid-month) while others are July 1–3. Spend before a
   mid-month reset is wiped from the counter but stays in the audit tables → the shop silently gets extra
   budget headroom. Something rewrites `current_month_started_at` mid-month (suspected: lazy budget
   provisioning / a settings write — see `project_ai_spend_cap_new_shop`). Needs a code fix regardless.
2. **Fragmentation.** Cost lives in ~8 tables; every consumer (admin summary, and the counter's increment
   path) has to touch all of them and doesn't. The admin reads one; the counter increments per-call and drifts
   on any missed increment or reset.
3. **A residual orchestrate gap** (needs code review, not resolved from data): even post-reset, peanut's
   counter ($0.78) is below its post-reset orchestrate cost alone ($1.25), suggesting the orchestrator's
   `recordSpend(cumulative.costUsd)` and the per-message `cost_usd` logged to `ai_orchestrate_messages` don't
   always agree.

**By-design, NOT a bug:** image gen has `if (useCase !== 'ads') recordSpend(...)` — ads images bill to the
ads budget, not the AI counter. Correct; just a legitimate reason the two numbers differ.

**Caveat:** peanut is the noisiest shop (this session's testing stubbed `recordSpend`, toggled its tier, ran
SMS tests). The clean, reproducible evidence is the mid-month `started_at`, not peanut's exact totals.

---

## The fix — derive, don't increment

The incrementing counter is the source of the whole class of drift. Replace it with a **single source of
truth**:

1. **`ai_usage_events` view** — `UNION ALL` of every per-feature cost table **plus `ad_ai_costs`
   (cents→usd, feature='ads')** into one shape: `(shop_id, feature, model, input_tokens, output_tokens,
   cost_usd, created_at)`. One migration, no write-path changes. (`ai_dispatch_audit` has no `cost_usd` —
   add it or exclude with a note; `ad_ai_costs` keys on campaign_id → join to `ad_campaigns.shop_id`.)
2. **Derive the enforcement counter** from the view: "spend this month" = `SUM(cost_usd)` over the view for
   the current calendar month, per shop, minus the `useCase='ads'` carve-out. Then:
   - Drift becomes **impossible** — the counter can't disagree with the audit because it IS the audit.
   - Mid-month resets stop mattering; no `current_month_started_at` field to corrupt.
   - Keep the denormalized counter only as a cache if perf demands it, refreshed from the view (self-healing),
     never hand-incremented.
3. **Point the admin cost-summary at the view** — total, by feature, by model, by shop, over time.
4. **Admin "AI Usage" dashboard** — render the above. Mirror the `Admin → Messaging Costs` tab's layout
   (periods, stat cards, per-shop breakdown), fed by the AI view instead of the carrier-cost ledger.
5. **Reconciliation panel** — audit-view total vs the real Anthropic/OpenAI invoice, ± caching. Surfacing
   drift is what caught the 70% gap; keep it visible so future metering bugs show up.

---

## Phased plan

- **Phase 1 — Integrity fix (do first).** `ai_usage_events` view + derive the spend-cap check from it
  (`SpendCapEnforcer.canSpend` reads the view sum, not the incrementing field). Kills the under-enforcement.
  Small, high-value.
- **Phase 2 — Admin visibility.** Repoint `getAdminCostSummary` at the view + build the Admin AI Usage
  dashboard (by feature / model / shop / time + reconciliation).
- **Phase 3 — Cleanup.** Investigate + fix the mid-month `current_month_started_at` rewrite (belt-and-braces
  even if the derived counter makes it moot), and the orchestrate `recordSpend` vs logged-cost mismatch.

---

## Decisions

- **D1 — Derived counter vs fix-the-increment.** *Recommend derived* (the view is the counter). Alternative:
  keep the incrementing field and just fix the reset + missing increments — less code now, but the drift class
  stays reachable. Perf: a `SUM` over ~8 tables per `canSpend` call may need an indexed cache; measure first.
- **D2 — `ai_dispatch_audit` has no `cost_usd`.** Add the column (so voice-router cost counts) or document the
  exclusion. *Recommend add* — it's real spend.
- **D3 — Ads-attributed cost in the ADMIN view.** The enforcement counter correctly excludes `useCase='ads'`
  (ads bills to the ads budget), but the admin COGS view should show ALL AI spend including ads. So: the
  *counter* excludes ads; the *dashboard COGS panel* includes it (feature-split). Two different consumers of
  the same view, filtered differently.
- **D4 — Existing admin tabs.** `/admin?tab=ai-agent` (AdminAISettingsTab — per-shop AI config/budget) and
  `/admin?tab=messaging-costs` (carrier SMS/WhatsApp costs + the overage summary) already exist. Decide:
  fold the new AI Usage view into a tab, and **move the overage panel off messaging-costs** into it (overage
  is AI revenue, not carrier cost — it's on the wrong tab today).
- **D5 — Should each ads tier carry its OWN AI allowance, or keep drawing on the general AI budget?**
  (pricing/product decision, surfaced while standardizing AI-usage tracking)

  **Current, incoherent, state:** the ads system is a SEPARATE self-serve add-on, separately billed
  (`ad_billing_plans`: Starter $199 / Growth $499 / Business $999) and NOT gated by the general subscription
  tier (`featureTiers.ts` has no ads gate — any general plan can subscribe). The ads tiers cap **campaign
  capacity** (`maxCampaigns` per tier) and **channels** (Facebook all tiers, Google = Business-ads-tier only)
  — **not AI dollars.** Ads AI (creative gen, lead outreach) is spend-capped against the shop's **GENERAL**
  monthly AI budget (`SpendCapEnforcer.canSpend` → "Monthly AI budget exhausted" 429). Consequences:
  - A $999 ads-Business shop gets **no more AI headroom** than a $199 ads-Starter shop — the AI cap is the
    general plan's, identical for both.
  - To use ads AI at all, a shop needs BOTH an ads subscription AND a general plan with an AI budget; a
    **free-tier** shop's ads AI is blocked (no AI budget), even if subscribed to ads.
  - Ads AI is gated by one budget (general) but its COST is billed to another (`ad_ai_costs` / ads True
    Margin, via the `useCase='ads'` carve-out) — gated ≠ billed.

  **Recommend: give each ads tier its own AI allowance**, since ads AI COGS is already tracked separately
  (`ad_ai_costs`) and feeds ads True Margin. That makes the $199/$499/$999 tiers mean something for AI,
  decouples ads AI from the general budget, and removes the free-tier-blocks-paid-ads-AI trap.
  *Alternative:* keep drawing on the general budget (simplest, no new cap) but then the ads tiers don't gate
  AI and the coupling above stays. Blocks nothing in Phase 1; it's a billing-model decision for management.

## Effort

Phase 1 ~1 day (view + canSpend rewrite + reconciliation test). Phase 2 ~1–2 days (endpoint + dashboard UI,
cloning Messaging Costs). Phase 3 ~0.5–1 day (root-cause the reset + orchestrate mismatch).

## Source / code touchpoints

- `SpendController.getAdminCostSummary` (reads `ai_agent_messages` only — the 70% bug)
- `SpendCapEnforcer` (`canSpend` / `recordSpend`, the incrementing counter)
- `ai_shop_settings.current_month_spend_usd` / `current_month_started_at` (the drifting field + reset)
- Per-feature cost tables: migrations 110/121/122/128/129/130/132/134
- Template for the UI: `Admin → Messaging Costs` tab (`AdminMessagingCostsTab.tsx`)
- Related: `project_ai_spend_cap_new_shop` (lazy provisioning — suspected reset trigger),
  `reference_ai_model_config`, `project_anthropic_spend_baseline`.
