# Implementation Plan — Phase 7: Intelligence Layer

**Status:** Plan only — code not started.
**Companion to:** `phase-7-scope.md` (read first).
**Base branch:** off latest `main` (currently at PR-merging-Phase-6.3
HEAD). Suggested new branch name: `deo/business-insights-phase-7`.
**Created:** 2026-05-22.

---

## 1. Decisions carried in (from scope doc Section 8)

| # | Decision | Locked? |
|---|---|---|
| A | Statistical + Claude-phrasing anomaly pattern (B) | ✅ |
| B | Per-anomaly storage in `ai_insights_anomalies` | ✅ |
| C | Top-of-panel banner with dismiss + 14-day expiry | ✅ |
| D | Phrasing calls share monthly per-shop budget | ✅ |
| E | New `comparison` ToolDisplay variant shape | ✅ (see §3.1) |
| F | Saved queries shape — pin = stored question text | ✅ (see §3.2) |
| G | Nightly job platform | ✅ **A — node-cron in backend process** (2026-05-22). Mirror `LowStockAlertScheduler` pattern. Env-gated start (`NODE_ENV === 'production' \|\| INSIGHTS_ANOMALY_DETECTION_ENABLED === 'true'`). Wrap each per-shop iteration in try/catch. |
| H | Global thresholds for v1, per-shop later | ✅ |
| I | Anomalies survive across panel-opens | ✅ |
| J | Voice input is stretch-only | ✅ |

**All blocking decisions resolved (2026-05-22):**
- Decision G: option A (node-cron in backend process). See Section 9.
- Scope Q#5: **ship all 5 starter metrics with conservative thresholds**;
  tune via dry-run data after 1 week of detection runs. Cheaper to
  loosen than to add metrics later.

---

## 2. Reusable infrastructure (do not rebuild)

- **`MetricsAggregator.aggregate()`** with the Phase 6.1 `windowEnd`
  param — supports "this week" + "last week" queries unchanged.
- **`AnthropicClient.complete()`** — anomaly phrasing is a single
  short Sonnet call. No tool-use roundtrip needed.
- **`SpendCapEnforcer`** — wraps phrasing calls per the shared
  monthly budget. Skip phrasing if `canSpend()` returns false.
- **`ai_insights_messages`** — phrasing calls audit-log here too,
  with a new `source: 'anomaly_phrasing'` field in
  `request_payload` so post-hoc cost analysis can isolate the
  anomaly-driven spend.
- **`InsightsToolCallCard` variant pattern** — adding
  `comparison` follows the existing 4-variant switch.
- **Frontend `Sheet` z-index ladder** — banner sits inside the
  existing slide-over; no z-index changes.
- **Phase 6.3 chip submit pipeline** (`submitText`) — anomaly
  banner's "Tell me more" tap reuses it.

---

## 3. Type extensions (gather before coding)

### 3.1 Comparison display variant

```ts
// backend services/insights/types.ts + frontend services/api/aiInsights.ts
| {
    kind: "comparison";
    label: string;                  // e.g. "Revenue (this week vs last)"
    current: {
      value: string;                // pre-formatted (e.g. "$2,117")
      sublabel?: string;            // e.g. "Mon-Thu"
    };
    prior: {
      value: string;
      sublabel?: string;            // e.g. "Mon-Thu last week"
    };
    delta: {
      value: string;                // e.g. "+38.7%" or "+$1,108"
      direction: "up" | "down" | "flat";
      magnitude?: "small" | "medium" | "large"; // drives color intensity
    };
  };
```

**Color mapping** (frontend):
- `direction: "up"` + revenue-like → green
- `direction: "up"` + no-show-like → red
- `direction: "down"` + revenue-like → red
- `direction: "down"` + no-show-like → green
- `direction: "flat"` → gray

The good/bad direction is contextual. **Tools decide** which way
"up" means good — done by emitting the right `magnitude` based on
the metric. Renderer doesn't try to interpret.

### 3.2 Saved query shape

```ts
// New table:
CREATE TABLE ai_insights_pinned_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  question_text VARCHAR(2000) NOT NULL,
  pinned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_run_at TIMESTAMP,
  last_response_excerpt TEXT,        -- first 200 chars of last Claude reply
  display_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_ai_insights_pinned_shop_order
  ON ai_insights_pinned_queries(shop_id, display_order, pinned_at DESC);
```

### 3.3 Anomaly shape

```ts
// New table:
CREATE TABLE ai_insights_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  metric_key VARCHAR(64) NOT NULL,    -- 'weekly_revenue', 'weekly_no_shows', etc.
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  current_value NUMERIC NOT NULL,
  prior_value NUMERIC NOT NULL,
  delta_value NUMERIC NOT NULL,       -- current - prior
  delta_pct NUMERIC,                  -- null when prior=0
  z_score NUMERIC,                    -- for tunability later
  severity VARCHAR(16) NOT NULL,      -- 'low' | 'medium' | 'high'
  claude_phrasing TEXT,               -- one-paragraph natural-language summary
  follow_up_question TEXT,            -- suggested chat question Claude paired
  dismissed_at TIMESTAMP,             -- NULL = active
  expires_at TIMESTAMP NOT NULL       -- detected_at + 14 days
);
CREATE INDEX idx_ai_insights_anomalies_shop_active
  ON ai_insights_anomalies(shop_id, dismissed_at, expires_at);
```

`claude_phrasing` is one paragraph max. `follow_up_question` is
the "Tell me more" chip target — submitting it kicks off a normal
tool-use round through the insights pipeline (e.g.
`bookings_breakdown` for a no-show anomaly).

---

## 4. Phase 7.1 — Comparison display variant (~1 day)

**Goal:** new `ToolDisplay.kind: "comparison"` variant available
end-to-end. Existing `revenue_summary({compare: "prior"})` emits
it instead of the current `list`.

- [x] **7.1.1** Add `comparison` variant to backend
  `services/insights/types.ts` per §3.1 above.
  > **Done 2026-05-22.** Added the 5th `ToolDisplay` variant.
  > **Deviated from the scope-doc shape**: added a `sentiment`
  > field separate from `direction`. Scope-doc spec'd a single
  > `magnitude` field that doubled as both intensity AND color
  > signal ("up + revenue-like = green"), which would force the
  > frontend renderer to know each metric's polarity. Cleaner:
  > tool emits `sentiment: positive | negative | neutral`,
  > renderer just maps sentiment → color. Tool keeps full
  > control over what "up" means for its metric.
- [x] **7.1.2** Mirror on frontend `services/api/aiInsights.ts`
  `ToolDisplay` union.
  > **Done 2026-05-22.** Same shape as backend (sentiment +
  > direction + magnitude all surfaced).
- [x] **7.1.3** Frontend renderer in `InsightsToolCallCard` —
  new `ComparisonDisplay` component for compact view +
  `ExpandedComparison` for the Dialog. Side-by-side number tiles,
  colored delta indicator.
  > **Done 2026-05-22.** Two new shared subcomponents
  > (`ComparisonTile` for the side-by-side number tiles +
  > `DeltaBadge` for the sentiment-colored pill) reused by both
  > compact and expanded views with a `size` prop. Color tone
  > driven entirely by `delta.sentiment` (green/red/gray), arrow
  > driven by `delta.direction` (↑↓→), prominence (padding/font)
  > driven by `delta.magnitude`. Hover tooltip on the badge
  > shows raw direction+sentiment for debugging. Both `case
  > "comparison"` branches added to the DisplayBody +
  > ExpandedDisplayBody switches; type exhaustiveness preserved.
- [x] **7.1.4** Migrate `revenueSummary` tool's `compareResult()`
  to emit `comparison` instead of `list`. The `list` variant
  becomes "single-comparison fallback" if Claude ever requests
  multi-comparison.
  > **Done 2026-05-22.** Sentiment math: deltaUsd > 0 → positive,
  > deltaUsd < 0 → negative, deltaUsd === 0 → neutral. (First
  > implementation hardcoded sentiment=neutral when deltaPct was
  > null, but going from $0 → $2,117 is unambiguously good news;
  > fixed to follow deltaUsd regardless of whether percent is
  > computable.) Magnitude buckets: |deltaPct| ≥ 25% = large,
  > 5-25% = medium, <5% = small. Magnitude defaults to "small"
  > when deltaPct is null (no percentage to size against).
  > Sublabels carry order counts ("7 orders" / "3 orders") so
  > the compact tile has context beyond the headline number.
- [x] **7.1.5** Tests:
  > **Done 2026-05-22.** `revenueSummary.test.ts` updated — 14 → 16
  > tests. Existing compare='prior' test reassertions on the new
  > comparison-shape display (current.value, prior.value,
  > direction, sentiment, magnitude). Added a new test for
  > revenue-going-DOWN (negative sentiment + down direction).
  > Added a third test exercising the 3 magnitude buckets (3% →
  > small, 10% → medium, 100% → large). Frontend visual-snapshot
  > test deferred — manual browser check is the meaningful
  > verification + the unit tests cover the data contract.

**Acceptance:** ✅ "Compare this week to last week" → `comparison`
card with current + prior + delta. Color of delta reflects metric
sentiment (green when up = good for revenue). Full insights jest:
**140/140 across 13 suites** (+2 vs Phase 6.3's 138). `tsc --noEmit`
clean on both backend + frontend.

---

## 5. Phase 7.2 — Anomaly detection (~4-5 days)

**Goal:** nightly job detects week-over-week anomalies per shop,
phrases them via Claude, surfaces in the panel banner. Dismissible.

### 5.1 Migration + types (½ day)

- [x] **7.2.1** Migration `125_create_ai_insights_anomalies.sql`
  per §3.3. Apply + verify on DO.
  > **Done 2026-05-22.** 14 columns + 2 indexes + ck_severity CHECK
  > constraint. Applied + recorded in schema_migrations.
  > Verification script `scripts/record-and-verify-migration-125.ts`
  > confirms columns, FK, CHECK constraint rejects bogus severity
  > values, INSERT + DELETE round-trip works on a real shop.
- [x] **7.2.2** Backend types — `Anomaly`, `AnomalyMetric`,
  `AnomalySeverity` interfaces.
  > **Done 2026-05-22.** `services/insights/anomalies/types.ts`
  > exports `MetricKey` union (5 starter metrics),
  > `Severity` (low/medium/high), `AnomalySentiment`
  > (positive/negative/neutral), `MetricDefinition` interface (with
  > injectable `compute(pool, shopId)`), `DetectedAnomaly` output
  > shape. Renamed scope-doc's "AnomalyMetric" → "MetricDefinition"
  > because the interface IS the definition, not the metric itself.

### 5.2 AnomalyDetector service (1 day)

- [x] **7.2.3** `services/insights/anomalies/AnomalyDetector.ts`
  with a `runDetection(shopId: string)` + `runForAllShops()`.
- [x] **7.2.4** 5 MetricDefinitions in
  `services/insights/anomalies/metrics.ts`. All reuse
  `windowBoundsFor('this_week' | 'last_week')` from Phase 6.1.
  Per-metric `minPriorSignal` floor ($50 for revenue, 1 for
  no-shows/cancellations, 3 for AI conversations/bookings).
- [x] **7.2.5** Detection logic with severity bands matching the
  spec (30/60/150% breakpoints). Sentiment mapping respects each
  metric's `upIsGood` flag — revenue ↑ = positive sentiment;
  no-shows ↑ = negative sentiment; renderer + phraser stay
  metric-agnostic.
- [x] **7.2.6** Persists via `INSERT INTO ai_insights_anomalies` with
  `expires_at = NOW() + INTERVAL '14 days'`. Per-metric AND per-shop
  failures are caught + logged without sinking the rest of the batch.
  > **Done 2026-05-22.** **Made metrics array injectable** for
  > testing (`new AnomalyDetector({ metrics: [fakeMetric1, ...] })`)
  > so the production METRIC_DEFINITIONS const stays untouched in
  > tests. Resulted in 15 jest assertions covering: 4 severity-band
  > thresholds (high/medium/low/no-flag), negative-direction case,
  > 2 noise-floor cases (below minPriorSignal + prior=0), 4 sentiment
  > mappings (upIsGood × direction combinations), 2 persistence
  > assertions (INSERT shape + no-INSERT when no flags), 2 error-
  > resilience cases (metric throws, persist throws).

### 5.3 AnomalyPhraser service (1 day)

- [x] **7.2.7** `services/insights/anomalies/AnomalyPhraser.ts`
  exposes `phraseAnomaly(a)` (single row) and `phraseAllPending()`
  (walks every NULL-phrasing row).
- [x] **7.2.8** Single short Sonnet call per anomaly, maxTokens=300.
- [x] **7.2.9** Prompt asks for strict JSON `{phrasing, followUp}`.
  System prompt cached. User prompt includes metric label,
  current+prior values, formatted delta-pct, direction +
  "good/bad news" framing pulled from `metric.upIsGood`.
  > **Done 2026-05-22.** JSON parsing tolerates markdown-fence
  > wrapping (Claude sometimes wraps in ` ```json ... ``` `) via
  > a strip-then-parse helper. Returns null on shape mismatch;
  > caller treats null as "phrasing failed" → row stays with
  > `claude_phrasing = NULL` → banner falls back to template.
- [x] **7.2.10** Spend-cap gate via `SpendCapEnforcer.canSpend()`.
  On exhausted: log + leave row's phrasing NULL + return false.
  `recordSpend` only called after successful Claude reply.
- [x] **7.2.11** Each phrasing call audit-logged to
  `ai_insights_messages` with `request_payload.source =
  'anomaly_phrasing'` + `anomalyId` for post-hoc cost isolation.
  Failure paths ALSO audit-log (with null response, captured
  error message) so we can count failure rates separately.

### 5.4 Nightly job (½ day — pending Decision G)

- [x] **7.2.12** `services/InsightsAnomalyScheduler.ts` — mirrors
  the `LowStockAlertScheduler` pattern (node-cron, env-gated
  start, idempotent start/stop, `getStatus()` snapshot for ops).
  Pipeline: `AnomalyDetector.runForAllShops()` → `AnomalyPhraser.
  phraseAllPending()`. Both layers internally non-throwing so
  a single bad shop / metric / anomaly can't sink the batch.
  `runNightlyDetection()` exposed publicly for manual triggering
  during the dry-run period.
- [x] **7.2.13** Schedule `0 3 * * *` UTC. Boots from
  `AIAgentDomain/index.ts` initialize() gated on
  `NODE_ENV === 'production' || INSIGHTS_ANOMALY_DETECTION_ENABLED
  === 'true'`. Mirror of the existing `AI_FOLLOWUP_ENABLED`
  kill-switch pattern. Graceful shutdown via `domain.cleanup()`
  → dynamic-imported stop() call (avoids hard import dependency).

### 5.5 Endpoints + frontend (1 day)

- [x] **7.2.14** `GET /api/ai/insights/anomalies` — returns
  active (un-dismissed, un-expired) anomalies for the requesting
  shop, max 3, ordered by detected_at DESC.
  > **Done 2026-05-22.** Shop-scoped via `(req as any).user.shopId`
  > from the JWT — never trusts URL or body for scope. Returns
  > `AnomalyDto` shape with `phrasing: string | null` so the
  > frontend can fall back to template rendering when phrasing is
  > NULL (spend-cap exhausted or Claude failure case).
- [x] **7.2.15** `POST /api/ai/insights/anomalies/:id/dismiss`
  — soft-dismiss. UPDATE shop-scopes via `WHERE shop_id = $2`
  AND `dismissed_at IS NULL` (idempotent — double-dismissing
  returns 404 to avoid existence leakage).
- [x] **7.2.16** Frontend `InsightsAnomalyBanner` component.
  > **Done 2026-05-25.** New component
  > `frontend/src/components/shop/insights/InsightsAnomalyBanner.tsx`.
  > Up to 3 anomaly rows stacked at the top of the chat tab (above
  > messages list, hidden on Pinned tab). Each row: severity-toned
  > border + left bar (low=amber / medium=orange / high=red),
  > AlertTriangle icon, Claude's `phrasing` text (or a neutral
  > template fallback when phrasing is null — spend-cap or Claude
  > failure path), "Tell me more" chip wired to `followUpQuestion`,
  > "Detected Xh ago" recency hint, dismiss `X` in top-right.
  > Severity colors lean alert-toned regardless of sentiment because
  > the phrasing already carries good/bad framing in words — the
  > banner's job is "this is worth attention," not "this is bad."
  > Template fallback formats revenue as currency and counts as
  > integers; deltaPct shown as `+/-NN%` when present.
- [x] **7.2.17** Fetch on panel mount; refetch when the panel
  is reopened.
  > **Done 2026-05-25.** Standard `useEffect(..., [])` on
  > `InsightsPanel` mount. The shadcn `Sheet` remounts the panel on
  > every reopen (same lifecycle the sessionId-per-mount + pinned-
  > queries fetch already rely on), so this single mount-effect
  > satisfies the "refetch when panel reopened" requirement
  > naturally. Failure to load is silent — chat + pinned keep
  > working; the banner just doesn't render. Dismiss is optimistic
  > with a restore-on-failure branch that treats a server 404 as
  > "already dismissed" (existence-leak prevention path) and keeps
  > the optimistic remove. "Tell me more" auto-dismisses the
  > anomaly before reusing `submitText()` so the banner doesn't
  > re-nag after the user has engaged with it.

### 5.6 Dry-run period (no checkbox — operational note)

After 7.2.1-7.2.13 land, run for 1 week with the frontend
endpoint NOT yet wired. Log flagged anomalies; inspect
`ai_insights_anomalies` daily. Tune thresholds before
exposing the banner to users. **Don't merge frontend
banner 7.2.16-7.2.17 until tuning is done.**

**Acceptance:** Manual test: insert a synthetic week of
elevated no-shows for `peanut`, run AnomalyDetector
directly, see a high-severity row in `ai_insights_anomalies`
with Claude-phrased natural-language summary + actionable
follow-up question.

---

## 6. Phase 7.3 — Saved queries (~2 days)

**Goal:** shop owner can pin questions; pinned queries live in
a second tab in the panel; tap re-runs them through the
existing chat pipeline.

### 6.1 Migration + endpoints (½ day)

- [x] **7.3.1** Migration `126_create_ai_insights_pinned_queries.sql`
  applied + verified on DO (7 cols, 1 index, FK to shops, INSERT/
  DELETE round-trip).
- [x] **7.3.2** `POST /api/ai/insights/pinned` — body `{
  questionText: string }`. Trim + validate (non-empty, ≤2000 chars).
  **Dedupes on (shop_id, question_text)** — pinning the same text
  twice returns the existing row instead of creating a duplicate.
  **409 at MAX_PINS_PER_SHOP=50** to prevent runaway clients.
- [x] **7.3.3** `DELETE /api/ai/insights/pinned/:id` — shop-scoped
  (`WHERE id = $1 AND shop_id = $2`); 404 when row doesn't belong
  to the requesting shop.
- [x] **7.3.4** `GET /api/ai/insights/pinned` — list ordered by
  `display_order ASC, pinned_at DESC` so v1's all-zero `display_order`
  yields "most-recently-pinned first" naturally.
- [x] **7.3.5** `PUT /api/ai/insights/pinned/:id/run` — body `{
  excerpt: string }`. Sets `last_run_at = NOW()` + truncates
  excerpt to 500 chars before persisting. Non-blocking from the
  panel's perspective — reply already shipped.
  > **Done 2026-05-22.** `InsightsPinnedController` with all 4
  > endpoints + factory pattern matching `HelpAssistantController`.
  > Jest **20/20 pass** in `InsightsPinnedController.test.ts`
  > covering: auth 401 on every endpoint, validation 400 paths,
  > dedupe semantics (same text returns existing), pin cap 409,
  > shop-scoped DELETE/UPDATE (`WHERE shop_id = $N`), excerpt
  > truncation to 500 chars.

### 6.2 Frontend (~1 day)

- [x] **7.3.6** Pin button on every InsightsToolCallCard sits
  alongside the Expand button in the card header. Hidden on
  `follow_ups` chip rows (no `originatingQuestion` prop = no
  button). Optimistic states: idle → pinning → pinned (✓ for
  1.5s) → idle. Error state shows red for 2s then reverts.
- [x] **7.3.7** Tab switcher above the messages list:
  "Chat" / "Pinned (N)". Pinned count badge ticks up as user
  pins; counter colored in yellow (`#FFCC00`/20 bg) for
  scannability. `aria-selected` set correctly; underline border
  for active tab.
- [x] **7.3.8** PinnedTab body — empty state, loading state,
  error state, and list state all handled. Each row: question
  text + `last_run_at` relative timestamp ("3h ago") + truncated
  response excerpt preview (80 chars). Unpin via small `X` in
  top-right corner; tap row body to re-run.
- [x] **7.3.9** Tap-to-run flow uses a `pendingRunRef` to remember
  which pin triggered the submit. After the assistant reply
  lands, `submitText()` calls `recordPinnedRun(id, excerpt)`
  AND optimistically updates the local pinned-list state (so
  the Pinned tab reflects the new `lastRunAt` without a refetch).
  Tap also auto-switches back to Chat tab so the user sees
  the typing indicator + reply.
  > **Done 2026-05-22.** Plumbing chain:
  > `InsightsPanel.handlePin / handleUnpin / handlePinnedTap`
  > → `TurnBubble` (gets `originatingQuestion` from
  > `priorUserQuestion(turns, i)` helper that walks back to find
  > the prior user message) → `InsightsToolCallCard` → `PinButton`.
  > Range-chip + footer + input row hidden on Pinned tab to keep
  > the surface clean. `recordPinnedRun` failure is non-fatal —
  > the reply already shipped to the user; the timestamp just
  > won't reflect the most recent run.

### 6.3 Tests (½ day)

- [x] **7.3.10** Jest tests for the 4 new endpoints. **20/20
  pass** in `InsightsPinnedController.test.ts` — auth 401 on
  every endpoint via `.each`, validation 400 branches (missing /
  empty / non-string / oversized), shop-scoped CRUD assertions
  (`WHERE shop_id = $N` parameter shape), dedupe semantics,
  pin cap 409, excerpt truncation, ISO date serialization.
- [ ] **7.3.11** Frontend smoke (manual browser): pin a query
  → reload panel → see in Pinned tab → tap → see fresh reply
  in Chat tab. **Deferred to user post-deploy verification.**

**Acceptance:** Pin "How much did I earn this month?", reload
the panel, switch to Pinned tab, see the question listed with
its last-run snippet, tap it → returns to Chat tab + fresh
Claude reply + new data card.

---

## 7. Phase 7.4 — Stretch: voice input (~2 days)

Only if Phase 7.1-7.3 land under budget. Defer to Phase 8 if
not.

- [ ] **7.4.1** Mic icon in the input row next to the send
  button. Disabled state when speech API unavailable.
- [ ] **7.4.2** Web Speech API integration with browser-native
  `SpeechRecognition`. Auto-stop on silence.
- [ ] **7.4.3** Transcription text populates the input textarea
  before submit (user can edit). NO auto-submit.
- [ ] **7.4.4** Permission-denied UX — fall back to text-only,
  hide the mic icon.

**Acceptance:** Click mic, dictate "how much did I earn this
month", text appears in input, hit send.

---

## 8. Phase 7.5 — Tests + polish

- [ ] **7.5.1** Per-service jest tests:
  - `AnomalyDetector.test.ts` — math correctness on canned
    metric values, threshold classification, MIN_SIGNAL
    skipping.
  - `AnomalyPhraser.test.ts` — mocked Claude call, falls back
    to template on spend-cap exhaustion, audit row written.
- [ ] **7.5.2** Pipeline integration smoke — synthetic anomaly
  inserted → fetched via GET endpoint → frontend renders banner
  → "Tell me more" tap → real follow-up question reaches Claude.
- [x] **7.5.3** Update `qa-test-guide.md` with Phase 7 sections:
  - Section 10: Banner appearance + dismiss flow.
  - Section 11: Pinned queries (pin, list, run, unpin).
  > **Done 2026-05-25.** §10 covers 13 scenarios (10.0 synthetic-
  > insert setup, 10.1 hidden state, 10.2 fresh-anomaly render,
  > 10.3 severity color matrix, 10.4 template fallback when
  > phrasing NULL, 10.5 "Tell me more" + auto-dismiss, 10.6
  > dismiss-X optimistic, 10.7 restore-on-failure, 10.8 404-as-
  > success, 10.9 max-3 cap, 10.10 14-day expiry, 10.11 shop
  > isolation, 10.12 banner hidden on Pinned tab, 10.13 refetch
  > on reopen). §11 covers 12 scenarios for pinned queries
  > including the dedupe-on-`(shop_id, question_text)` guarantee,
  > the 50-pin 409 cap, and cross-session persistence. Acceptance
  > summary block updated to call out which §10/§11 scenarios are
  > load-bearing for ship-readiness.
- [ ] **7.5.4** Cost review of nightly phrasing: after 1 week
  of staging, sum `ai_insights_messages.cost_usd` WHERE
  `request_payload->>'source' = 'anomaly_phrasing'`. Decide
  if a per-day cap is needed.

---

## 9. Open decisions blocking code-start

### Decision G — Nightly cron platform

The Phase 7.2 nightly job needs somewhere to run. Three options:

**A. `node-cron` inside the existing backend process** — simplest,
no infra changes. Risk: one cron failure can crash the API process
unless wrapped carefully.

**B. DigitalOcean App Platform "Jobs"** — if the project's DO
config has a Jobs section, use it. Isolated process; doesn't
affect API uptime.

**C. New worker process (separate Dockerfile)** — heaviest;
overkill for a once-daily job.

**Action needed:** confirm which of A/B already has infra
support in this repo. Look in `app.yaml` / `app.json` / the DO
dashboard. **I'll defer code-start on 7.2.12 until this is
answered.**

### Decision (scope Q#5) — 5 starter metrics or trim to 3?

Recommendation: ship all 5 but **start with severity
thresholds set conservatively** (lean toward false-negatives).
After 1 week of dry-run data, lower thresholds for any metric
that's silent and raise for any that's noisy. Cheaper to tune
than to add metrics later.

**Action needed:** confirm "ship 5, tune via thresholds" is
acceptable, OR pick 3 metrics for v1. Recommended 3:
revenue, no_shows, cancellations.

---

## 10. Out of scope for Phase 7

- Forecasting (Phase 8).
- Cohort / cross-shop benchmarks (Phase 8 strategic decision).
- Admin platform-wide Q&A (Phase 8).
- Weekly digest email (Phase 8).
- Mobile-optimized panel redesign (Phase 8).
- Real-time anomaly detection (we run nightly only).
- Per-shop anomaly threshold tuning (Phase 8).
- Anomaly notifications outside the panel (email / push) —
  starts as in-panel banner only.
- Anomalies on metrics other than the 5 starter ones.

---

## 11. Risk checklist

- **Anomaly noise** — flagging too aggressively → users tune out
  → banner becomes wallpaper. Mitigation: dry-run period;
  conservative thresholds for v1.
- **Claude phrasing cost** — if every shop has 5 anomalies per
  day × 30 days × N shops, cost adds up. Mitigation: shared
  monthly budget; per-shop runaway already capped.
- **Stale anomalies** — auto-expire at 14 days; explicit
  `expires_at` column.
- **Privacy regression** — `AnomalyDetector` runs per-shop;
  no cross-shop reads. Hardcode this in the service interface
  (one shop ID per `runDetection` call).
- **Pinned-query staleness** — `last_response_excerpt` shown in
  the Pinned tab is from the LAST run, not real-time. Display
  clearly ("Last run: 3 days ago") so users know.
- **Cron-process fragility** — if option G(A) is chosen, wrap
  every job in try/catch + Sentry-style error reporter (or
  whatever the project uses). Don't let one shop's failure
  break the rest.

---

## 12. Rough effort recap

| Phase | Effort | Cumulative |
|---|---|---|
| 7.1 Comparison variant | 1d | 1d |
| 7.2 Anomaly detection | 4-5d | 5-6d |
| 7.3 Saved queries | 2d | 7-8d |
| 7.5 Tests + polish | ~1d (folded into each) | 7-8d |
| 7.4 Voice input (stretch) | 2d | 9-10d |

**Plan for the recommended scope (no voice input): ~7-8 days.**

---

## 13. Day-one starting point (when code work begins)

1. Create new branch off latest main:
   `git checkout main && git pull && git checkout -b deo/business-insights-phase-7`
2. Resolve Decision G (cron platform) and scope Q#5 (5 vs 3
   metrics).
3. Start Phase 7.1 (comparison display variant) — small,
   isolated, no infra dependencies. Builds team momentum +
   ships a frontend improvement that benefits the existing
   `revenue_summary({compare: "prior"})` path immediately.
4. Then Phase 7.2 (anomaly detection) — the flagship work.
   Dry-run period starts as soon as 7.2.12 lands.
5. Phase 7.3 (saved queries) in parallel-ish with 7.2's dry-run
   week — saved queries are isolated from anomaly detection
   so they can ship independently.
