# Implementation Plan — AI Sales Agent Impact Metrics

**Status:** NOT STARTED — plan of record, no code written yet.
**Folder:** `docs/tasks/strategy/ai-sales-agent/`
**Created:** 2026-05-20
**Scope doc:** [`ai-sales-agent-impact-metrics.md`](./ai-sales-agent-impact-metrics.md)
— read that first for the *why* + the resolved decisions. This doc is the
*how* + the live progress checkpoint.

> **Crash-recovery note:** this doc is the single source of truth for where
> the build stands. Before stopping (or if a session crashes mid-task),
> update Section 1 (Progress) and tick the relevant checkboxes. A fresh
> session should be able to read this file and continue with no other
> context.

---

## 1. Progress checkpoint

| Phase | State | Notes |
|---|---|---|
| Phase 1 — Setup + per-shop baseline config | ☑ done (user-verified) | All 5 tasks landed. DB layer smoke-tested against real DO. **User confirmed 2026-05-20** that the baseline input loads with 240 in the browser. |
| Phase 2 — Backend metrics endpoint | ☑ done (HTTP smoke pending) | Aggregator + controller + route + cache + status-filter all verified. SQL-level smoke test against real DO PASS. End-to-end HTTP curl not yet run — Phase 3 frontend will be the first real consumer. |
| Phase 3 — Frontend Impact section | ☑ done (browser verify pending) | All 7 tasks landed. Section is wired top-down: service → picker → empty state → cards → section component (state + states) → mount + skeleton + error UI. No browser smoke test yet. |
| Phase 4 — Tests + polish + copy review | ◐ in progress | Backend tests (28) green. Manual QA + exec copy review still pending. |

**Last worked on:** 2026-05-20 — Phase 4.1 (added
`tests/ai-agent/MetricsAggregator.test.ts` (11 tests) and
`MetricsController.test.ts` (17 tests). Covers: shape mapping, no-data
zero-not-NaN, belowThreshold flip at N=5 boundary, conversionRate
divide-by-zero guard, responseTimeSavedHours math + slower-than-baseline
clamp + zero-replies edge, structural SQL guards (paid/completed filter,
DISTINCT customer recovery, ai_followup tag, 7-day interval, successful-
reply latency filter), parseMetricsRange + windowStartForRange pure
helpers, 401/400 auth+validation, baseline lookup + 240 fallback, cache
hit within TTL, refetch after expiry, per-(shop,range) keying, no
poisoning on failure. Suite: 28/28 green).
**Next action:** Phase 4.2 — manual QA across three traffic profiles
(healthy / brand-new / N=3 awkward middle). Then Phase 4.3 exec copy
review before ship.
**Open blockers:** none.
**Mid-QA spec change — `responseTimeSavedHours` switched to
per-conversation (Option A) on 2026-05-20** after user QA found that the
original per-message formula produced unrealistic claims (3 conversations
× ~100 replies ≈ 1163h "saved"). New formula:
`(baseline − avg_AI_latency) × distinct_AI_conversations ÷ 60`, with a
guard returning 0 when zero successful replies exist. Applied across
backend math, frontend tile tooltip, scope doc Section 4, and aggregator
tests. Browser-confirmed on 2026-05-20: 3 conversations now read as
~12.0h saved (was 1163.7h under the old formula).
**Side observation worth flagging to the team:** 2 of 3 AI-originated
orders on DO are `expired` ($910 in lost AI-driven revenue). Not a
metrics bug — a real product signal about payment-link expiration on
chat-driven bookings.

States: ☐ not started · ◐ in progress · ☑ done.

---

## 2. Decisions carried in (from scope doc Section 6)

1. **Labels** — shop-owner-perspective, plain-English. Draft labels in
   scope-doc Section 4; final copy gets an exec review pass before ship.
2. **Currency** — USD only.
3. **Customers recovered / Missed leads recovered** — collapsed into one
   metric: *"Customers your AI brought back"*.
4. **Response time saved baseline** — per-shop configurable, default 4h
   (240 minutes). Always rendered with an "estimated" label + baseline
   visible.
5. **Upsells suggested** — deferred to v2. No new tracking in v1.
6. **Low-sample threshold** — show metrics only when N ≥ 5 conversations
   in the selected window; otherwise render empty state.

Other locked-in choices (scope-doc Section 5): two cards (Business Impact
+ AI Performance), single fetch; placed at the top of the AI settings
page; time-range picker 7d / 30d / 90d / all-time, default 30d.

---

## 3. Reusable infrastructure (do not rebuild)

- **`ai_agent_messages`** audit table — source of conversation count, AI
  message count, response time.
- **`service_orders.conversation_id`** (migration 115) — links orders to
  AI conversations; source of bookings + revenue generated.
- **`AISalesFollowUpHandler`** + `ai_followup_settings` (migration 116) —
  source of "Customers your AI brought back".
- **`ai_shop_settings`** table + `SettingsController` — extend with the
  new baseline column; reuse the existing PUT path.
- **`AISalesAgentSettings.tsx`** — the surface the new Impact section
  mounts on top of.
- **Migration runner** — `backend/scripts/run-single-migration.ts` for
  applying migration 117 against the DO Postgres.

No retrieval, no AI calls — this feature is pure SQL aggregation +
charting. The Anthropic client is **not** involved.

---

## 4. Phase 1 — Setup + per-shop baseline config

**Goal:** the per-shop baseline column exists in the DB, the SettingsController
can read/write it, and the shop UI can edit it. Plus a shared sample-threshold
constant in one place.

- [x] **1.1** Write migration `backend/migrations/117_add_human_reply_baseline_to_ai_shop_settings.sql`:
  - `ALTER TABLE ai_shop_settings ADD COLUMN human_reply_baseline_minutes INTEGER NOT NULL DEFAULT 240;`
  - Add a `CHECK` constraint for a sane range (15 ≤ x ≤ 1440).
  - **Done 2026-05-20** on branch `deo/ai-impact-metrics`. Idempotent
    (uses `ADD COLUMN IF NOT EXISTS` + drop-then-add for the constraint).
- [x] **1.2** Apply migration via `run-single-migration.ts` against the
  DO Postgres; record in `schema_migrations`.
  - **Done 2026-05-20** — column + CHECK constraint + `schema_migrations`
    row (version 117) all verified on DO via
    `scripts/record-and-verify-migration-117.ts`.
- [x] **1.3** Add the shared threshold constant —
  `backend/src/domains/AIAgentDomain/constants.ts` (or extend the existing
  domain constants file): `export const MIN_SAMPLE_N = 5;`. Used by both
  the metrics endpoint and the frontend (mirrored).
  - **Done 2026-05-20** — new file at
    `backend/src/domains/AIAgentDomain/constants.ts` (no prior constants
    file existed in the domain). Frontend mirror will land with Phase 3.
    `tsc` clean.
- [x] **1.4** Extend `SettingsController` (GET + PUT `/api/ai/settings`)
  to read/write `human_reply_baseline_minutes`. Add validator entry
  (min 15, max 1440, integer).
  - **Done 2026-05-20** — `ShopAiSettings` + `AdminShopAiSettings` now
    include `humanReplyBaselineMinutes`; validator treats the field as
    **optional** (backwards-compat for clients that don't send it yet);
    upsert refactored to dynamic columns; admin SELECT + row mapper
    updated; 10 new validator tests added (boundaries + reject cases);
    full SettingsController test suite 52/52 green; `tsc` clean.
- [x] **1.5** Update the shop AI settings UI to expose the baseline as a
  small numeric input (label: "Estimated human reply time"; suffix:
  "minutes"; help text: "Used to estimate the time your AI saves").
  Check shadcn for the input component first.
  - **Done 2026-05-20** — added input + state plumbing to
    `frontend/src/components/shop/AISalesAgentSettings.tsx`; service
    types extended in `frontend/src/services/api/aiSettings.ts` (added
    field + bounds 15–1440). Kept the plain `<input>` pattern of the two
    sibling fields for visual consistency inside the same card — a
    shadcn refactor would belong as a separate task spanning all three.
    `tsc` clean on changed files. **Browser verification pending.**

**Acceptance:** GET returns the baseline; PUT validates and persists;
the shop UI shows + saves the value; `tsc` clean.

---

## 5. Phase 2 — Backend: metrics endpoint

**Goal:** `GET /api/ai/metrics?range=30d` returns a single response covering
both cards. Below the sample threshold the endpoint returns a flag (not
zeros) so the UI renders the empty state honestly.

- [x] **2.1** New service
  `backend/src/domains/AIAgentDomain/services/MetricsAggregator.ts` —
  one method per metric or one combined SQL (measure latency, pick).
  Implements every metric defined in scope-doc Section 4.
  - **Done 2026-05-20** — class with pool injection (mirrors
    SettingsController testability). Single public `aggregate()` method
    runs three parallel queries: `queryMessageStats` (distinct
    conversations + successful replies + avg latency from
    `ai_agent_messages`), `queryOrderStats` (bookings + revenue from
    `service_orders` where `conversation_id IS NOT NULL` and status in
    paid/completed), and `queryCustomersRecovered` (JOIN on
    `request_payload->>'source' = 'ai_followup'`, 7-day attribution
    window). TS does the derived math (`conversionRate` clamped when
    `aiConversations = 0`; `responseTimeSavedHours` clamped when AI is
    slower than baseline). `tsc` clean.
- [x] **2.2** New controller
  `backend/src/domains/AIAgentDomain/controllers/MetricsController.ts` —
  parses `range` (7d / 30d / 90d / all), reads the shop's baseline, calls
  the aggregator, returns:
  ```ts
  {
    range: '30d',
    sampleN: number,
    belowThreshold: boolean,        // true when sampleN < MIN_SAMPLE_N
    baselineMinutes: number,
    businessImpact: { aiConversations, bookingsGenerated, revenueGenerated, customersRecovered, responseTimeSavedHours },
    performance: { conversionRate, avgResponseTimeSeconds, bookingsCreated }
  }
  ```
  - **Done 2026-05-20** — factory `makeMetricsController(deps)` mirrors
    SettingsController; pure helpers `parseMetricsRange` +
    `windowStartForRange` exported for unit tests; default range 30d;
    `fetchBaselineMinutes` falls back to 240 for shops with no settings
    row; auth check (401 no shop), validation (400 bad range), 500 on
    DB error; `tsc` clean. (Tests for these helpers + the auth/validation
    branches will land in Phase 4.)
- [x] **2.3** Register `GET /api/ai/metrics` in
  `AIAgentDomain/routes.ts`, shop-role guarded.
  - **Done 2026-05-20** — `router.get('/metrics', authMiddleware,
    requireRole(['shop']), getMetrics)` mirrors the `/settings` route
    shape. Header comment block + `/health` endpoint list updated.
    Endpoint is now reachable but HTTP-level smoke test deferred until
    the frontend (Phase 3) calls it or the user requests a curl pass.
- [x] **2.4** Server-side cache the response per `(shopId, range)` for
  ~60s (in-memory Map with TTL is enough — these are not real-time).
  - **Done 2026-05-20** — closure-scoped `Map` inside
    `makeMetricsController` (per-instance, so tests get fresh caches).
    Key `${shopId}:${range}`. 60s default TTL via `DEFAULT_CACHE_TTL_MS`.
    Injectable `now` + `cacheTtlMs` deps for Phase 4 cache tests. Only
    successful responses are cached (5xx skips cache write). Lazy
    eviction on expired reads. `tsc` clean.
- [x] **2.5** Verify `service_orders` revenue uses `paid` + `completed`
  statuses only (refunds, cancelled, no_show, expired excluded).
  - **Done 2026-05-20** — `scripts/smoke-test-metrics-status-filter.ts`
    ran against DO. Statuses found: paid, completed, cancelled, expired,
    no_show (no pending/refunded yet — filter handles them when they
    appear). Aggregator SQL totals exactly match the manually-summed
    INCLUDED rows. No unknown statuses. PASS on both assertions.

**Acceptance:** curl with a shop JWT returns the expected shape; refunded
orders are excluded; a brand-new shop returns `belowThreshold: true`;
`tsc` clean.

---

## 6. Phase 3 — Frontend: Impact section

**Goal:** a two-card Impact section sitting at the top of the AI settings
page, with a range pill selector and an honest empty state.

- [x] **3.1** API service
  `frontend/src/services/api/aiMetrics.ts` — `getAiMetrics(range)` →
  `GET /api/ai/metrics`. Typed response matching Phase 2's shape.
  - **Done 2026-05-20** — exports `AiMetricsRange`,
    `AiMetricsBusinessImpact`, `AiMetricsPerformance`,
    `AiMetricsResponse`, and `getAiMetrics(range)`. Mirrors the backend
    shape exactly; uses the existing `apiClient` pattern (same style as
    `aiSettings.ts`). Range is required (no default) — the caller always
    knows the active pill. `MIN_SAMPLE_N` deliberately NOT mirrored —
    the backend returns `belowThreshold` directly so the frontend just
    reads the flag. `tsc` clean.
- [x] **3.2** Range pill selector — 7d / 30d / 90d / All, defaults 30d.
  Check shadcn for `ToggleGroup` / `Tabs`.
  - **Done 2026-05-20** — picked shadcn `ToggleGroup` (`type="single"`).
    File: `frontend/src/components/shop/AISalesImpactRangePicker.tsx`.
    Controlled (value + onChange + optional disabled). Default 30d lives
    at the parent (Phase 3.6 mount), not in the picker — picker just
    renders what it's given. Guards the Radix quirk where clicking the
    active pill fires `onValueChange("")` (ignored — keeps existing
    value). `tsc` clean.
- [x] **3.3** Empty state card — used when `belowThreshold === true` OR
  on initial load. Copy: *"Still collecting data — turn the AI on for a
  service and check back after a few conversations."*
  - **Done 2026-05-20** — single-variant presentational component at
    `frontend/src/components/shop/AISalesImpactEmptyState.tsx`. Friendly
    tone (not apologetic), `BarChart3` icon in `#FFCC00` over a small
    dark badge, dark-theme card matches the AI settings panel. No
    conditional copy for now (scope decision: keep simple — nuance per
    sampleN level can be added if it surfaces as a UX gap). `tsc` clean.
- [x] **3.4** Card components (dark-themed, yellow-accent — match the
  surrounding `AISalesAgentSettings.tsx` panel; the impl doc earlier said
  "light-themed/green-accent" but user picked dark/yellow on 2026-05-20
  for coherence with the rest of the settings tab):
  - `AISalesImpactBusinessCard.tsx` — 5 metrics from `businessImpact`.
  - `AISalesImpactPerformanceCard.tsx` — 3 metrics from `performance`.
  - Each metric: shop-facing label (per scope-doc Section 4 table) + the
    formatted value + a tooltip explaining how it's calculated.
  - **Done 2026-05-20** — added a shared `AISalesImpactMetricTile.tsx`
    used by both cards (label, formatted value, optional subtitle for
    baseline disclosure, hover-tooltip from the project's
    `components/ui/tooltip` with a flattened trigger style). Business
    card lays out 5 tiles in a responsive 1/2/3-col grid; Performance
    card uses 1/3-col. Formatting helpers are inline per card
    (counts/USD/hours in Business; percent/seconds/counts in
    Performance). `tsc` clean.
- [x] **3.5** "Time your AI saved you" must visibly show the baseline used
  (e.g. *"≈ 4h estimated, vs your 4h baseline"*) and the "estimated" tag,
  per scope-doc decision E.
  - **Done 2026-05-20** — baked into the Business card's
    `responseTimeSavedHours` tile via the tile's `subtitle` slot.
    Renders as *"Estimated · vs your 4h baseline"* (or
    *"Estimated · vs your 240m baseline"* for non-hour values). Formatter
    `formatBaselineSubtitle` lives next to the card.
- [x] **3.6** Mount the Impact section at the **top** of
  `AISalesAgentSettings.tsx`, above the configuration cards. Single fetch
  on mount + on range change.
  - **Done 2026-05-20** — extracted to its own component
    (`AISalesImpactSection.tsx`) so the parent file stays focused.
    Mounted directly after the "AI Sales Assistant" header, before the
    existing Status section. Internal useEffect runs on mount and on
    range change with proper cancellation guards. Backend cache (60s)
    makes range-toggling cheap.
- [x] **3.7** Loading skeletons + error state (fallback to a small banner,
  do not blow up the configuration controls below).
  - **Done 2026-05-20** — three pieces inside `AISalesImpactSection.tsx`:
    (1) `ImpactLoadingSkeleton` — 2-card placeholder matching the real
    layout (5-tile + 3-tile grids with animated pulses); (2)
    `ImpactErrorBanner` — red-themed banner shown when the initial fetch
    fails with no prior data (Status/Behavior below are untouched);
    (3) `ImpactStaleDataNotice` — small orange inline strip shown above
    the cards when a refetch fails but we still have the prior data
    (avoids jarring full-section unmounts on transient errors).

**Acceptance:** open the AI settings page → Impact section renders →
range switching refetches → a brand-new shop sees the empty state →
loading + error states behave; light theme matches the rest of the panel.

---

## 7. Phase 4 — Tests + polish + copy review

- [x] **4.1** Backend tests for `MetricsAggregator` —
  - revenue excludes refunded / cancelled / no_show orders;
  - `belowThreshold` flips correctly at N = MIN_SAMPLE_N;
  - `responseTimeSavedHours` math against a known fixture;
  - `customers_recovered` does not double-count a customer who got
    multiple nudges.
  - **Done 2026-05-20** — two test files (28 tests total, all green):
    - `MetricsAggregator.test.ts` (11 tests) — response-shape mapping,
      no-data → zeros (not NaN), belowThreshold flip across the N=5
      boundary (cases 0/4/5/6/100), conversionRate divide-by-zero
      guard, responseTimeSavedHours math vs known fixture, slower-than-
      baseline clamp, zero-replies edge. Plus structural SQL guards
      that fail if anyone later strips the `status IN ('paid',
      'completed')` filter, the `COUNT(DISTINCT customer_address)`, the
      `'ai_followup'` tag, the `INTERVAL '7 days'` window, or the
      successful-reply latency filter.
    - `MetricsController.test.ts` (17 tests) — `parseMetricsRange` +
      `windowStartForRange` pure helpers, 401/400 auth+validation,
      baseline lookup + 240 fallback, cache hit within TTL, refetch
      after TTL expiry (uses injectable `now` — no fake timers), per-
      (shopId, range) keying refetches, 5xx doesn't poison cache.
    - Pre-existing `SettingsController.test.ts` still 52/52 green
      after the earlier dynamic-columns refactor.
- [ ] **4.2** Manual QA: a shop with healthy traffic (real numbers
  visible), a brand-new shop (empty state), a shop in the awkward middle
  (N = 3 → still empty state by design).
- [ ] **4.3** Exec copy review — walk through every shop-facing label
  with the exec before ship. Update the labels in
  `AISalesImpactBusiness/PerformanceCard.tsx` based on feedback.
- [ ] **4.4** `tsc` + jest clean. Frontend lint clean.

---

## 8. Out of scope for v1 (do not build)

- Admin platform-wide roll-up of these metrics.
- Per-service or per-customer drilldown.
- CSV / export.
- RCN-equivalent displays (USD only per exec).
- Upsells suggested metric (deferred to v2 — needs new instrumentation).
- "AI Personality presets" (exec idea #3 — separate scope doc).
- "AI Status Live" badge (exec idea #4 — separate scope doc).

---

## 9. Rough effort

**~4–5 developer-days** total (from scope-doc Section 8):
- Phase 1 (setup + baseline config): ~0.5 day.
- Phase 2 (metrics endpoint + SQL): ~2 days.
- Phase 3 (frontend Impact section): ~1.5 days.
- Phase 4 (tests + copy review): ~1 day.

**Hidden cost reminder** (from scope doc): getting metric *definitions*
right matters more than the engineering — a wrong revenue number or a
double-counted recovered customer kills shop owner trust. Allocate the
exec copy review (Task 4.3) and a real-shop sanity check before shipping.
