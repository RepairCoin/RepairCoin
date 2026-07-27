# Scope — "AI Recommendations for You" (shop dashboard)

Make the shop-overview **AI Recommendations** section real, tier-gated, and actionable. Today it is three
hardcoded strings shown identically to every shop.

Surface: `/shop?tab=overview` → "AI Recommendations for You".
Related: `business-data-insights/` (the anomaly engine this builds on), `ai-campaigns-advanced/` (an action
target), `pricing-alignment/` (tier model).

---

## Build status (2026-07-22)

**Not built.** Frontend mock only. No backend, no endpoint, no table, no gating.

---

## Where we are today

`frontend/src/components/shop/tabs/DashboardOverview.tsx`:

- `MOCK_AI_RECOMMENDATIONS` (lines ~146–171) — 3 hardcoded cards, comment says *"MOCK DATA (temporary —
  replace with real API data)"*.
- `AI_FILTERS` (line 173) — `All | Revenue | Customers | Marketing | RepairCoin`, filters the mock array only.
- `MOCK_PRIORITY_ACTIONS` (lines ~175–197) — the sibling "Priority Actions" section, also mock.
- The cards render as `<button>` with **no `onClick`**; `SectionHeading onViewAll={() => {}}`.

So every shop is told *"AI detected an opportunity to re-engage 87 inactive customers"* and *"8 items running
low"* regardless of their actual data. **This is the main risk to fix:** it is phrased as a finding about
their business, so it reads as a real analysis. A shop with 4 customers and no inventory sees the same text.
Treat this as a correctness bug with an upsell surface attached, not a nice-to-have.

Two of the three categories are also wrong: stock is filed under `RepairCoin`, and no card maps to
`Customers`.

---

## What already exists and is reusable (large head start)

This does **not** need a new AI engine. Almost every signal already has a working implementation.

**1. The anomaly pipeline (Phase 7.2) — the architectural precedent to copy.**
`backend/src/domains/AIAgentDomain/services/insights/anomalies/`:
- `AnomalyDetector.ts` — nightly, **pure SQL, no Claude**. Runs each `MetricDefinition.compute()` for
  week-over-week `{current, prior}`, classifies into severity bands (`low` 30% / `medium` 60% / `high` 150%),
  skips metrics whose prior baseline is under `MIN_SIGNAL` (kills "$0 → $1 = +∞%" noise), persists to
  `ai_insights_anomalies`.
- `metrics.ts` — 5 metrics: `weekly_revenue`, `weekly_bookings`, `weekly_no_shows`, `weekly_cancellations`,
  `weekly_ai_conversations`. Adding one is an append to `METRIC_DEFINITIONS`; the detector loop is
  metric-agnostic.
- `AnomalyPhraser.ts` — Claude runs **only on confirmed anomalies**, after detection.
- `InsightsAnomalyScheduler.ts` — nightly cron.

Its own header states the reasoning we should inherit: deterministic flags are auditable on their own, AI cost
stays bounded, and tuning thresholds doesn't burn budget.

**2. A gated endpoint + dismiss UX already shipped.**
`GET /api/ai/insights/anomalies` and `POST /api/ai/insights/anomalies/:id/dismiss`
(`backend/src/domains/AIAgentDomain/routes.ts:245-257`) — `authMiddleware` + `requireRole(['shop'])` +
**`requireTier('aiInsights')`**, shop-scoped from the JWT (the controller never trusts URL/body for scope).
Frontend: `components/shop/insights/InsightsAnomalyBanner.tsx`.

**3. Nineteen insights tools** in `services/insights/tools/` — directly usable as detectors:
`lowStockItems`, `reorderRecommendation`, `deadStock`, `inventoryStockSummary`, `suggestFollowups`,
`businessDiagnostics`, `repeatCustomerAnalysis`, `topCustomers`, `topServices`, `timeOfDayPattern`,
`revenueSummary`, `cancellationBreakdown`, `bookingsBreakdown`, `customerTierDistribution`, …

**4. Slow-period detection** — `AutoMessageSchedulerService.processLowBookings()`: fires when last-7-day
bookings are < 50% of the trailing 4-week weekly average, with a ≥4-booking baseline so new shops don't
trigger. That is exactly the "Slow Day Tomorrow" card's signal, already written and live-tested.

**5. Lapsed-customer audiences** — resolved from `service_orders` (NOT `transactions` — see
`project_lapsed_audience_data_model`). Powers "re-engage N inactive customers" with a real N.

**6. Action targets already exist** — Marketing → AI Campaigns, Inventory tab, Bookings, the ads lead
Kanban, and the unified assistant `/orchestrate` (which can be opened with a prefilled prompt).

**7. Tier plumbing** — `backend/src/config/featureTiers.ts` + `requireTier()` / `requireTierRollout()`
server-side; `frontend/src/components/shop/TierGate.tsx` + `hooks/useFeatureAccess.ts` client-side. Note
`TierGate` **does not mount the locked child**, so a gated section fires no requests — the right primitive
for a dashboard block.

---

## The core gaps

1. **No recommendation entity.** An anomaly is an *observation* ("revenue down 40% WoW"). A recommendation is
   a *prescription with an action* ("send a win-back campaign to these 87 customers"). Different shape:
   needs a typed action, an evidence payload, and a lifecycle (shown → acted / dismissed / snoozed).
2. **No action routing.** Cards need a typed destination — a tab deep-link, a panel, or a prefilled
   orchestrator prompt — not a dead `<button>`.
3. **No ranking.** Heterogeneous sources compete for 3 slots; needs a comparable score.
4. **No dedup / cooldown.** The same card every morning is noise. Needs dismiss, snooze, and a regeneration
   cadence.
5. **No per-recommendation tier awareness.** A Starter shop must not be told to "review purchase
   suggestions" for an Inventory feature it cannot open. That is precisely the *sell-what-isn't-there* gap
   the AI-Campaigns audit flagged — do not reintroduce it here.
6. **Categories are wrong** and are not derived from anything.

---

## Design

Three layers, mirroring `AnomalyDetector` deliberately.

**Layer 1 — DETECT (pure SQL, zero AI).** A `RecommendationDetector` interface; each detector returns 0..n
candidates with hard evidence numbers and a `requiredFeature`.

```ts
interface RecommendationDetector {
  key: string;                     // 'lapsed_customers'
  category: RecCategory;           // 'revenue' | 'customers' | 'marketing' | 'inventory' | 'operations'
  requiredFeature?: FeatureKey;    // tier gate for the ACTION, e.g. 'campaignBuilder'
  detect(pool: Pool, shopId: string): Promise<RecCandidate[]>;
}

interface RecCandidate {
  key: string;
  severity: 'low' | 'medium' | 'high';
  evidence: Record<string, number | string>;   // { inactiveCustomers: 87 } — drives the copy
  action: RecAction;                           // typed destination, below
  minEvidence?: boolean;                       // detector already applied its floor
}

type RecAction =
  | { kind: 'navigate'; tab: string; sub?: string }
  | { kind: 'assistant'; prompt: string }            // opens the unified assistant prefilled
  | { kind: 'campaign'; audience: string };          // opens AI Campaigns prefilled
```

Every candidate ALSO carries an `assistantPrompt: string` regardless of its primary action — see
"Does clicking open the unified assistant?" below.

### Does clicking a row open the unified assistant?

**Not for every row — by design.** The primary tap does the most direct useful thing; the assistant is
always available as a secondary tap.

- **`navigate`** when the answer is a screen. "8 items running low" → the Inventory table *is* the answer;
  a chat turn to re-render a list that already has a page is slower and worse.
- **`assistant`** when the answer is judgement. "Slow week ahead" → *"draft a promo for next week"*.
  "Revenue down 40%" → *"why did revenue drop?"*
- **`campaign`** when the action is a concrete artifact with a known audience.

**Plus a ✨ secondary affordance on every card** that opens the assistant with that card's
`assistantPrompt` preloaded. One-door access is preserved (see
`feedback_unified_assistant_is_live_ai_surface` — the unified assistant IS the live AI surface, so routing
there is architecturally correct) without charging a Claude turn to every click.

Why not route everything to the assistant: each open is a **billable Claude turn against the shop's AI
budget** — the one with a spend cap and overage billing. Turning the most-visited page's cards into
unconditional AI calls is a real cost line, plus ~3s of latency where navigation is instant.

### Where do the assistant questions come from? (static vs AI-generated)

Three different things, treated differently:

| surface | claims a fact about the shop? | source |
|---|---|---|
| Assistant **starter chips** (`STARTER_PROMPTS`) | No — advertises capability | Static is fine; must stay tier-aware |
| Recommendation **card copy** ("87 inactive customers") | **Yes** | Deterministic from detector `evidence` — never static |
| Card **`assistantPrompt`** | Yes (carries the numbers) | **Template per detector, filled from `evidence`** |

**`assistantPrompt` is templated, NOT AI-generated.** One fixed template per detector, interpolated with the
evidence:

- `lapsed_customers` → `"Draft a win-back campaign for the {n} customers who haven't booked in {days} days"`
- `low_stock` → `"Which {n} items are running low and what should I reorder?"`
- `slow_period` → `"Next week looks slow — draft a promo to fill it"`

Rationale: (1) a template carrying real evidence is *more* precise than an AI paraphrase, which can only
lose information the detector already computed; (2) generating a question with AI in order to send it to AI
is two Claude calls to do a string interpolation — cost + latency against a capped budget, for no gain;
(3) deterministic prompts are assertable in tests.

So the question **shape** is fixed per detector; the **content** is that shop's data. Neither "same static
question everywhere" nor "AI writes the question".

AI phrasing earns its cost elsewhere: card titles/descriptions (P4) and contextual follow-ups *after* a
recommendation is acted on — things a template genuinely can't do.

**Opportunity — feed the starter chips from recommendations.** `STARTER_PROMPTS` is currently 4 hardcoded
generic strings. Seeding the chips with the top 3 `assistantPrompt`s makes the panel open with questions
about *this* shop ("Win back the 87 customers who've gone quiet"), unifies both surfaces behind one engine,
and falls back to the static list when a shop has no recommendations.

**Cleanup to fold in — the starter prompts are triplicated and already drifting:**
`UnifiedAssistantPanel.tsx` (`STARTER_PROMPTS` + `HELP_PROMPTS`), `VoiceCommandPill.tsx`
(`EXAMPLE_PROMPTS`), `DashboardOverview.tsx` (`ASK_AI_EXAMPLES` + `ASK_AI_HELP_EXAMPLES`) — the panel says
*"Win back the customers who've gone quiet"*, the dashboard says *"Win back customers who've gone quiet"*.
Collapse to one tier-aware source.

**⚠️ Prerequisite — the store can't do this yet.** `frontend/src/stores/unifiedAssistantStore.ts` exposes
only `open()` and `openWithMic()`; there is **no prefilled-prompt entry point**. Add `pendingPrompt` +
`consumePendingPrompt()` following the existing `pendingMic` one-shot pattern exactly (the panel consumes
on mount; consuming clears the flag so a StrictMode double-mount can't double-fire). ~15 lines, but it is a
**P0/P2 prerequisite**, not free — nothing with `kind: 'assistant'` works until it lands.

**Layer 2 — RANK + GATE (pure, no AI).** Drop candidates whose `requiredFeature` the shop's tier doesn't
allow; drop dismissed/snoozed; score `severity × recency × actionability`; take top N (3 on the dashboard,
all on "View All").

**Layer 3 — PHRASE.** Deterministic templates from `evidence` for v1 (`"Re-engage {n} inactive customers"`).
Claude phrasing is a later phase, on the cheap model, spend-cap aware, with the deterministic string as
fallback — never let a phrasing failure blank the feed.

**Every number shown must come from `evidence`.** No card may contain a figure the detector didn't compute.
That single rule is what stops today's bug from recurring.

### v1 detectors (the 3 on screen, plus cheap wins)

| detector | source (already exists) | category | action |
|---|---|---|---|
| `lapsed_customers` | `service_orders` lapsed audience | Customers | campaign → AI Campaigns prefilled |
| `low_stock` | `lowStockItems` tool (`inventory_items` / `inventory_item_stock`) | Inventory | navigate → Inventory |
| `slow_period` | `processLowBookings()` logic | Revenue | assistant → "draft a promo for next week" |
| `reorder_needed` | `reorderRecommendation` tool | Inventory | navigate → Purchase Orders |
| `dead_stock` | `deadStock` tool | Inventory | navigate → Inventory |
| `review_requests` | completed bookings without a review | Customers | campaign → review request |
| `unanswered_leads` | ads leads pending in Kanban | Operations | navigate → Ads leads |
| `anomaly_*` | existing `ai_insights_anomalies` rows | varies | assistant → "why did X change?" |

Categories become `Revenue | Customers | Marketing | Inventory | Operations` — derived from the detectors,
replacing the mock's `RepairCoin` filter.

---

## Gating (the tier ask)

**Feed gate — `aiInsights` (Growth).** Consistent with the anomaly endpoint it extends. Free/Starter get the
section wrapped in `<TierGate feature="aiInsights">` — the locked child never mounts, so no requests fire,
and the block doubles as an honest upgrade surface.

**Per-detector gate.** Each detector declares `requiredFeature`; candidates whose feature the tier disallows
are dropped **server-side** (the client is never trusted):

- `low_stock` / `reorder_needed` / `dead_stock` → `inventoryManagement` (Growth); deeper variants →
  `advancedInventory` (Business)
- `lapsed_customers` / `slow_period` / `review_requests` → `campaignBuilder` + `aiMarketingSuite` (Growth)
- *"Let AI run this campaign on its own"* variants → `aiCampaignsAdvanced` (Business)
- `unanswered_leads` → `aiLeadFollowUp` (Growth)

**Enforcement is server-side.** `requireTier('aiInsights')` on the route **and** per-candidate filtering in
the service. `TierGate` is presentation only.

---

## Decisions needed before build

- **D1 — Feed tier.** `aiInsights` (Growth) — *recommended*, matches the anomaly endpoint. Alternative: make
  the feed free-tier as an upsell engine that only ever shows recommendations pointing at paid features.
  That converts better but makes the dashboard an ad; it also contradicts the "don't show what they can't
  use" principle in D2.
- **D2 — Un-actionable recommendations: hide or upsell?** *Recommended:* hide, plus one honest summary line
  (*"2 more recommendations available on Business"*). Alternative: render them locked. Hiding respects the
  sell-what-isn't-there rule; the summary line keeps the upgrade path visible without nagging.
- **D3 — Generation cadence.** *Recommended:* nightly batch, piggybacking `InsightsAnomalyScheduler`
  (bounded cost, instant dashboard load). Alternative: compute on dashboard load — fresher, but puts
  8 detector queries on the critical path of the most-visited page.
- **D4 — AI phrasing in v1?** *Recommended:* no. Ship deterministic copy; add Claude phrasing in P4. The
  value is in *correct signals*, not prettier sentences, and this keeps v1 off the AI budget entirely.
- **D5 — Is "Priority Actions" the same engine?** *Recommended:* yes — same detectors, a `presentation`
  field (`card` vs `action`) selects the surface. Two engines producing overlapping advice will drift.
- **D6 — Dismiss semantics.** *Recommended:* 14-day snooze by default, permanent dismiss for
  "not relevant to my business". A recurring condition should be allowed to resurface.
- **D9 — Seed the assistant starter chips from recommendations?** *Recommended:* yes — the panel opens with
  this shop's real prompts instead of 4 generic strings, and the triplicated prompt lists collapse to one
  source. Alternative: keep them static (zero risk, but the chips stay decorative). Either way, de-duplicate
  the three drifting copies.
- **D8 — Does every card open the assistant?** *Recommended:* no — typed primary action (navigate /
  assistant / campaign) plus a ✨ secondary tap that always opens the assistant with the card's
  `assistantPrompt`. Alternative: route every card to the assistant for a single consistent door — simpler
  to build and better AI engagement, but every dashboard click becomes a billable Claude turn plus ~3s
  latency. Either way, `unifiedAssistantStore` needs a prefilled-prompt entry point first.
- **D7 — Empty state.** What shows when a healthy shop has zero recommendations? *Recommended:* an explicit
  positive ("Nothing needs attention today") — never fall back to mock cards.

---

## Phased plan

- **P0 — Foundation.** `ai_recommendations` table (**migration 234** — 233 is the current max across all
  branches; re-verify at build time per `feedback_check_migration_number_before_building`), types, detector
  interface, `RecommendationService`, `GET /api/ai/recommendations` + `POST /:id/dismiss` (+ snooze), tier
  gate. No detectors yet.
- **P1 — Detectors batch 1.** `lapsed_customers`, `low_stock`, `slow_period` — deliberately the three cards
  on screen, so the pipeline is proven against the exact mock it replaces.
- **P2 — Wire the frontend.** Delete `MOCK_AI_RECOMMENDATIONS`, real categories from the API, click → action
  routing (incl. the `unifiedAssistantStore` prefilled-prompt entry point + the ✨ secondary tap),
  loading/empty/locked states, working "View All". **This is where the credibility bug closes.**
- **P3 — Ranking, dismiss/snooze, nightly generation** via the existing scheduler.
- **P4 — AI phrasing** (cheap model, spend-cap aware, deterministic fallback).
- **P5 — Remaining detectors + Priority Actions** on the same engine (D5).

P0–P2 is the meaningful milestone: real, tier-correct, clickable recommendations. P3–P5 are polish and
breadth.

---

## Testing

- **Detector unit tests with seeded fixtures** — each detector is pure SQL over a known fixture, so assert
  exact counts (follow the `business-data-insights` QA-fixture pattern).
- **Tier matrix test** — for each tier, assert the exact set of detector keys that survive gating (extend
  `backend/tests/config/featureTiers.test.ts`).
- **Threshold/noise review** — run detectors against real staging shops and eyeball the flag rate before
  enabling, exactly as Phase 7.2 did for anomalies. A recommendation feed that cries wolf is worse than none.
- **Live staging pass** on a Business shop (peanut) and a Starter shop, verifying the gate in both
  directions.
- Seeding rules from `ai-campaigns-advanced/qa-guide.md` apply: never let a test seed touch real customers.

---

## Rough effort

P0 ~1.5d · P1 ~1d · P2 ~1d · P3 ~1d · P4 ~0.5d · P5 ~1.5d. **P0–P2 ≈ 3.5 days** for the honest, gated,
clickable version.

---

## Pre-flight (verified against staging 2026-07-22)

Checked before committing to the plan — **no hard blockers; P0 can start immediately.**

- `ai_insights_anomalies` — **EXISTS**. The Phase 7.2 engine is live, so the anomaly source is real.
- `service_orders` — **EXISTS** and supports both `lapsed_customers` and `slow_period` today. Live counts:
  lapsed = 4 / 3 / 3 / 3 / 2 across the top shops; slow-period signal present (shop `10`: 0 bookings last 7d
  vs a 4.3 prior weekly average; `ancient-realm-tech`: 1 vs 2.8).
- Inventory — **EXISTS** as `inventory_items`, `inventory_item_stock`, `inventory_items_with_availability`
  (⚠️ *not* `shop_inventory_items`). Reuse the `lowStockItems` tool, which already targets the right tables,
  rather than writing new SQL.
- Tier resolution — `getShopTier(shopId)` (`backend/src/utils/shopTier.ts`) via `requireTier()`, already live
  on other routes. Note `shops` has **no** `subscription_tier` column (only `rcg_tier`, which is the RCG
  holdings tier and is NOT the plan) — always go through `getShopTier`.
- Migration **234** free across every local + remote branch.

**Calibration warning:** real lapsed counts on staging are single digits, not the mock's 87. Correct copy
will read *"Re-engage 4 inactive customers"*. Apply a `MIN_SIGNAL`-style floor per detector (as
`AnomalyDetector` does) so a shop with 1 lapsed customer gets no card — a feed that fires on trivia is worse
than no feed.

---

## Open decisions

**None block P0.** Earlier drafts called D1/D2 blocking; on inspection both have safe defaults:

- **D1** — default to `aiInsights` (Growth). Changing it later is a one-line swap in the route guard and the
  `<TierGate feature="…">` string.
- **D2** — default to hiding un-actionable recommendations (server-side filter). Adding upsell later is
  purely additive (return them with a `locked` flag).

**D8** (does every card open the assistant) should be settled before **P2**, since it shapes the click
handler and whether the `unifiedAssistantStore` prompt entry point is needed at all. D3–D7 and D9 can be
settled during P1–P3.
