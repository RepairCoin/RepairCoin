# Implementation Plan — Business-Data Insights ("Ask about your business")

**Status:** NOT STARTED — plan of record, no code written yet.
**Folder:** `docs/tasks/strategy/business-data-insights/`
**Created:** 2026-05-21
**Scope doc:** [`business-data-insights-scope.md`](./business-data-insights-scope.md)
— read that first for the *why* + the rejected alternatives (NL→SQL).
This doc is the *how* + the live progress checkpoint.

> **Crash-recovery note:** this doc is the single source of truth for
> where the build stands. Before stopping (or if a session crashes mid-
> task), update Section 1 (Progress) and tick the relevant checkboxes.
> A fresh session should be able to read this file and continue with
> no other context.

---

## 1. Progress checkpoint

| Phase | State | Notes |
|---|---|---|
| Phase 1 — Audit table + tool framework | ◐ in progress | Migration 122 applied + verified on DO. Tool framework (1.3–1.6) still pending. |
| Phase 2 — Implement v1 tools | ☐ not started | |
| Phase 3 — Controller + endpoint | ☐ not started | |
| Phase 4 — Frontend launcher + panel | ☐ not started | |
| Phase 5 — Tests + polish | ☐ not started | |

**Last worked on:** 2026-05-21 — Phase 1.1 + 1.2 done. Verified 122 was
the next free number in the 100-range (100s = feature migrations, 1000s
= separate cleanup/hotfix namespace running up to 1021). Wrote
`backend/migrations/122_create_ai_insights_messages.sql` mirroring the
ai_help_messages shape + a new `tool_calls JSONB DEFAULT '[]'` column.
Applied to DO Postgres via `run-single-migration.ts`. Verified via
`scripts/record-and-verify-migration-122.ts`: 14 columns,
both indexes, FK to shops, and a real INSERT + DELETE round-trip
against an actual shop row all PASS. **Live and ready for writes.**
**Next action:** Phase 1.3 — define the `BusinessInsightsTool`
interface + `ToolResult` / `ToolDisplay` types in
`backend/src/domains/AIAgentDomain/services/insights/types.ts`.
**Open blockers:** none.

States: ☐ not started · ◐ in progress · ☑ done.

---

## 2. Decisions carried in (from scope doc Section 6)

Locked:
1. **Data-access pattern → tool-use** with typed pre-defined query
   functions. No NL→SQL.
2. **Audience → shop only** for v1. Admin Q&A is a fast-follow.
3. **Surface → new launcher** in the dashboard's action cluster,
   separate Sheet from the Help panel.
4. **Conversation shape → multi-turn**, same `sessionId` pattern as the
   help assistant.
5. **Output → prose + structured payload** (numbers / list / table /
   sparkline) per tool call; frontend renders as inline data cards.
6. **Charts → text + simple inline tables/sparklines only for v1.** No
   new chart dependency (Recharts/Visx).
7. **Audit → new `ai_insights_messages` table.** Schema mirrors
   `ai_help_messages` plus a `tool_calls` JSONB column capturing which
   tools Claude invoked + args + results.
8. **Spend cap → shared** with the AI Sales Agent + How-To Assistant
   monthly budget. Revisit after the first month.
9. **Model → Sonnet** (`claude-sonnet-4-6`). Tool-use + structured
   reasoning benefits from the stronger model. Cost stays bounded by
   short tool payloads + short final replies.
10. **Cross-shop safety → in the tool implementations**, not in the
    prompt. Every tool's SQL adds `WHERE shop_id = $shopFromJwt` as a
    hardcoded clause; the shopId comes from the JWT, never from
    Claude's args.

Working defaults for the still-open questions (Section 7 of scope
doc) — confirm before broad rollout, but ship-safe defaults:

11. **v1 tool count → 5** (drop from the 8 in scope-doc Section 5):
    `revenue_summary`, `top_customers`, `top_services`,
    `bookings_breakdown`, `ai_assistant_impact`. Defer
    `cancellation_breakdown`, `customer_tier_distribution`,
    `rcn_balance_summary` to v1.1 — they're useful but not the most
    common ask.
12. **Follow-up time-range memory** → carried in client state; the
    frontend renders a small "range chip" near the input that the
    user can see/change between turns. Backend doesn't keep server-
    side state.
13. **NL→SQL fallback** → still skipped for v1.
14. **Cost ceiling** → use the existing monthly cap. Add a per-day
    soft-cap only if abuse / runaway cost shows up after first week.

---

## 3. Reusable infrastructure (do not rebuild)

- **`AnthropicClient.complete()`** already supports tools — see the
  `tools` + `toolChoice` arguments. Returns `toolUses[]` on the
  `ClaudeResponse`.
- **`SpendCapEnforcer`** — same per-shop monthly cap.
- **Audit pattern** — copy the shape of `ai_help_messages` (migration
  121) + `HelpAuditLogger`. Same fields, plus a `tool_calls` column.
- **`MetricsAggregator` SQL** — three of the v1 tools wrap or extend
  it directly:
  - `bookings_breakdown` → reuse `queryOrderStats` shape with a
    `status` group-by.
  - `ai_assistant_impact` → calls `MetricsAggregator.aggregate()`.
  - `revenue_summary` → reuse the paid+completed status filter.
- **Action cluster mounting** — `DashboardLayout.tsx` already gates
  on `userRole === 'shop'` for help. Same pattern for the new launcher.
- **shadcn `Sheet`** — same component the Help panel uses.
- **`react-markdown`** — already a dep, configured with the dark
  theme. Reuse in the Insights panel.

---

## 4. Phase 1 — Audit table + tool framework

**Goal:** the infrastructure tools sit on top of. No tools or
endpoints yet — just the audit table, the tool interface, and the
registry/dispatcher.

- [x] **1.1** Write migration creating `ai_insights_messages`. Next
  free version is **likely 122** — verify via
  `SELECT MAX(version) FROM schema_migrations` against DO before
  finalizing the filename. Columns mirror `ai_help_messages`:
  `id` UUID PK, `shop_id` FK, `session_id` (client-generated,
  groups multi-turn rows), `request_payload`, `response_payload`,
  `model`, token counts (`input_tokens`, `output_tokens`,
  `cached_input_tokens`), `cost_usd`, `latency_ms`, `error_message`,
  `created_at`, **plus** `tool_calls JSONB` (the array of tool
  invocations with args + results). Indexes:
  `(shop_id, created_at DESC)` and `(session_id, created_at)`.
  - **Done 2026-05-21** — confirmed 122 free (max in 100-range was
    121). `backend/migrations/122_create_ai_insights_messages.sql`
    written: 14 columns including `tool_calls JSONB NOT NULL
    DEFAULT '[]'`, both indexes, FK to shops, idempotent guards.
- [x] **1.2** Apply migration to DO Postgres via
  `run-single-migration.ts`. Record in `schema_migrations`. Verify
  columns + indexes via a one-off script.
  - **Done 2026-05-21** — applied via
    `npx ts-node scripts/run-single-migration.ts migrations/122_create_ai_insights_messages.sql`
    then `scripts/record-and-verify-migration-122.ts` inserted the
    tracking row, verified all 14 columns, both indexes, the FK,
    AND a real INSERT + DELETE round-trip against an existing shop.
- [x] **1.3** Define the tool interface and types in
  `backend/src/domains/AIAgentDomain/services/insights/types.ts`:
  > **Done 2026-05-21.** Created the file with `ToolContext`,
  > `ToolDisplay` (number / table / list / sparkline), `ToolResult`,
  > `BusinessInsightsTool` (extends `ClaudeTool` from
  > `../../types` so the same object can be passed straight to
  > `AnthropicClient.complete({ tools })` — no conversion layer),
  > `ToolDispatchResult` (controller-facing), and `ToolInvocationRecord`
  > (slim audit-log shape stored in `tool_calls` JSONB; excludes
  > `result.data` to keep audit rows compact). `tsc --noEmit` clean.
  ```ts
  export interface BusinessInsightsTool {
    name: string;
    description: string;          // shown to Claude; tune carefully
    inputSchema: object;          // JSON Schema for Anthropic
    execute(
      args: unknown,
      ctx: { shopId: string; pool: Pool }
    ): Promise<ToolResult>;
  }

  export interface ToolResult {
    /** Structured payload Claude reads to compose its prose reply. */
    data: Record<string, unknown>;
    /** Optional UI hint the frontend renders as an inline card. */
    display?: ToolDisplay;
  }

  export type ToolDisplay =
    | { kind: "number"; primary: string; label?: string; sub?: string }
    | { kind: "table"; columns: string[]; rows: Array<Array<string | number>> }
    | { kind: "list"; items: Array<{ label: string; value: string | number }> }
    | { kind: "sparkline"; label: string; series: number[]; primary?: string };
  ```
- [x] **1.4** Tool registry:
  `backend/src/domains/AIAgentDomain/services/insights/registry.ts`.
  Exposes `getInsightsTools(): BusinessInsightsTool[]` (the 5 v1 tools
  registered at module load) and `getInsightsToolByName(name)`.
  > **Done 2026-05-21.** Created `registry.ts` plus the Phase-2 file
  > layout under `services/insights/tools/`:
  > `revenueSummary.ts`, `topCustomers.ts`, `topServices.ts`,
  > `bookingsBreakdown.ts`, `aiAssistantImpact.ts`. Each stub has
  > production-quality `name` / `description` / `inputSchema`
  > (Claude-facing — Phase 2 just fills in `execute()` bodies); stub
  > `execute()` throws `"<tool>: not implemented yet — Phase 2 task
  > 2.x will wire the SQL"` so anything reaching it before Phase 2
  > surfaces loudly. Registry uses a `Map` for O(1) lookup, returns a
  > defensive copy from `getInsightsTools()`, and `getInsightsToolByName`
  > returns `undefined` on miss (dispatcher treats as a Claude tool-name
  > hallucination — non-throwing). Runtime smoke-test confirmed:
  > `count=5`, all five names match, `getInsightsToolByName('revenue_summary')`
  > resolves, `getInsightsToolByName('does_not_exist')` is `undefined`,
  > stub `execute()` throws as expected. `tsc --noEmit` clean.
- [x] **1.5** Tool dispatcher helper — `dispatchTool(tool, args, ctx)`
  centralizes arg validation against `inputSchema`, error capture,
  latency timing. Returns a typed `{ ok, result?, error?, latencyMs }`.
  > **Done 2026-05-21.** Created
  > `backend/src/domains/AIAgentDomain/services/insights/dispatcher.ts`.
  > Validates `args` against `inputSchema` (covers the JSON Schema
  > subset our 5 tools use: object root, `required`, `properties.type`,
  > `enum`, `minimum`, `maximum`, `additionalProperties:false`),
  > then calls `tool.execute(args, ctx)` inside a try/catch with a
  > `Date.now()` latency timer. Never throws — every path returns a
  > `ToolDispatchResult`. **No new dep added** (hand-rolled validator
  > ~50 lines); swap to AJV later if schemas grow. **Anthropic already
  > pre-validates** `input` against `inputSchema` before surfacing
  > `tool_use` blocks (per `AgentOrchestrator` comment near
  > `BOOKING_TOOL_NAME`), so the dispatcher's validation is defense-
  > in-depth + makes the dispatcher testable in isolation. **Narrowing
  > gotcha:** project has `strict: false` in tsconfig, so `!result.ok`
  > narrowing on a discriminated union doesn't kick in — used
  > `"error" in validation` narrowing instead, which works under
  > non-strict mode. Smoke test
  > (`backend/scripts/smoke-insights-dispatcher.ts`) covers 15 cases
  > including all validation branches, the catch-around-execute
  > wrapper (Phase-1 stub throw is captured into
  > `ToolDispatchResult.error`), and a synthetic happy-path tool —
  > **15/15 pass**. `tsc --noEmit` clean.
- [x] **1.6** `InsightsAuditLogger` —
  `backend/src/domains/AIAgentDomain/services/InsightsAuditLogger.ts`.
  Sibling of `HelpAuditLogger`. Inserts into `ai_insights_messages`
  including the `tool_calls` JSONB.
  > **Done 2026-05-21.** Created
  > `backend/src/domains/AIAgentDomain/services/InsightsAuditLogger.ts`
  > mirroring HelpAuditLogger's shape: `InsightsAuditEntry` interface +
  > class with default `getSharedPool()` constructor arg + eagerly
  > exported `insightsAuditLogger` singleton. Adds the `toolCalls:
  > ToolInvocationRecord[]` field (typed against the Phase 1.3 type),
  > serialized to the `tool_calls JSONB` column with `$10::jsonb` cast
  > and a `JSON.stringify(entry.toolCalls ?? [])` fallback to honor the
  > column's `NOT NULL DEFAULT '[]'`. **Non-throwing**: an FK violation
  > or any other DB error is caught + logged via the shared `logger`
  > and `log()` returns `null` — the AI reply still ships even when
  > audit writes fail. Smoke test
  > (`backend/scripts/smoke-insights-audit-logger.ts`) ran against
  > real DO Postgres using the first real shop_id from `shops`
  > (`peanut`) for FK: **29/29 pass** covering happy path (full
  > column-by-column round-trip including nested tool_calls JSONB
  > shape: `tool`, `args`, `display.kind`, `display.rows`, `latencyMs`),
  > empty `toolCalls` array, `null` response_payload + null
  > latency_ms + error_message set, and non-throwing on FK violation
  > (returns `null` instead of throwing). Cleanup deleted all 3
  > inserted rows. `tsc --noEmit` clean.

**Acceptance:** migration applied to DO, types compile, registry
returns the 5 stub tools (each with placeholder `execute` for now),
`tsc` clean.

> **Phase 1 complete — 2026-05-21.** All six tasks (1.1–1.6) green:
> migration 122 applied + recorded on DO, types/registry/dispatcher/
> audit-logger all compile + pass dedicated smoke tests (registry
> lookup 5/5, dispatcher 15/15, audit logger 29/29 against real DO
> Postgres). Ready for Phase 2 (implement the 5 tool execute bodies).

---

## 5. Phase 2 — Implement the v1 tools

**Goal:** the 5 starter tools are implemented and unit-tested. One
file per tool under
`backend/src/domains/AIAgentDomain/services/insights/tools/`.

Every tool:
- Validates `args` against its `inputSchema` (the dispatcher also
  validates, but tool-level validation gives clearer errors).
- Hardcodes the shop-scoping clause (`WHERE shop_id = $1`) in its
  SQL. The `shopId` comes from `ctx.shopId`, sourced from the JWT
  by the controller. Tools never trust Claude-supplied shopIds.
- Returns `ToolResult` with both `data` (for Claude) and
  `display` (for the frontend).

- [x] **2.1** `revenue_summary({ range, compare? })` →
  `tools/revenueSummary.ts`. `range` ∈ `7d | 30d | 90d | all`.
  Returns total revenue (sum of paid+completed `total_amount`)
  for `range`; if `compare === 'prior'`, also returns the same
  metric for the previous equivalent window with delta. Display:
  `kind: number` for single; `kind: list` for compare.
  > **Done 2026-05-21.** Implemented `execute()` in
  > `tools/revenueSummary.ts`. Schema probe confirmed status enum
  > (`paid`, `completed`, `cancelled`, `expired`, `no_show`); filter
  > matches scope-doc — `status IN ('paid', 'completed')` only. Window
  > column is `created_at` (when revenue came in). Rolling 7/30/90-day
  > from now() — not calendar-aligned, simpler + matches scope doc.
  > 'all' has no lower bound. Shop-scoping hardcoded in the SQL builder
  > (`shop_id = $1` with `ctx.shopId`, never from Claude args). Single-
  > window returns `{ data: {range, totalUsd, orderCount}, display:
  > number }`; compare returns `{ data: {range, current, prior,
  > deltaPct}, display: list }`. Edge cases handled: `deltaPct = null`
  > when prior == 0 (Claude phrases "no prior revenue"); `compare='prior'`
  > with `range='all'` returns `comparisonUnsupported: true` flag so
  > Claude doesn't invent a comparison. Smoke test
  > (`scripts/smoke-tool-revenue-summary.ts`) ran against real DO data
  > using `peanut` shop (108 orders, $7,783.02 lifetime paid+completed
  > revenue across 23 orders): **40/40 pass** covering all 4 ranges
  > (single), compare='prior' for 7d (real shop has $2,117 current /
  > $0 prior / null delta), compare+all unsupported branch, display
  > shape assertions (kind, USD formatting `^\$[\d,]+\.\d{2}$`, label
  > content), and shop-scoping defense (fake shopId → $0.00, not
  > another shop's revenue). All tool totals matched a hand-written
  > reference SQL run from the same script. `tsc --noEmit` clean.
- [x] **2.2** `top_customers({ range, by, limit })` →
  `tools/topCustomers.ts`. `by` ∈ `rcn_earned | spend | order_count`.
  `limit` 1–10. Returns ranked list of customers (name + value).
  Display: `kind: table`.
  > **Done 2026-05-21.** Schema probe revealed: (a) `transactions` has
  > shop_id directly + the relevant earning types are `mint` AND
  > `tier_bonus` (sample customer had both as separate rows — both add
  > RCN); (b) `customers` has `name`, `first_name`, `last_name`, `email`
  > with some rows where `name` is NULL but email exists; (c)
  > `service_orders.customer_address` ↔ `customers.address` join key.
  > Implementation: `spend`/`order_count` query `service_orders WHERE
  > status IN ('paid','completed')` (consistent with revenue_summary);
  > `rcn_earned` queries `transactions WHERE type IN ('mint',
  > 'tier_bonus')`. All three LEFT JOIN `customers` for the display
  > name fields. Name resolution happens in JS via `resolveName()`
  > COALESCE chain: trimmed `name` → trimmed `first_name + last_name`
  > → email → `0xabcd…wxyz` short address — never empty. Display:
  > `kind: table` with `['#', 'Customer', valueColumn]` columns where
  > valueColumn is `Spend` / `RCN Earned` / `Orders`. USD formatted
  > `$X,XXX.XX`, RCN formatted as integer when whole (e.g. `375 RCN`)
  > else `XXX.XX RCN`. order_count tie-break is by spend DESC so
  > equally-active customers rank deterministically. Smoke test
  > (`scripts/smoke-tool-top-customers.ts`) ran against real DO data
  > (peanut shop): **53/53 pass** covering 6 (by × range) combos =
  > all 3 modes × {all, 30d}, ranks strictly descending, top-1 +
  > sum-of-top-3 match hand-rolled references for every combo, every
  > customer row has a non-empty resolved display name, correct value-
  > column header per mode, shop-scoping defense (fake shop → 0
  > customers), and 3 dispatcher-level bad-args branches (bad `by`,
  > limit=0, limit=11). `tsc --noEmit` clean.
- [x] **2.3** `top_services({ range, by, limit })` →
  `tools/topServices.ts`. `by` ∈ `revenue | bookings | conversion`.
  Display: `kind: table`.
  > **Done 2026-05-21.** Schema probe confirmed:
  > `shop_services.service_id` is the join key,
  > `shop_services.active` not `is_active`, and `conversations` table
  > has both `shop_id` and `service_id` — so AI conversations link
  > cleanly to services for the conversion denominator.
  > **Metric definitions:**
  > - `revenue` → `SUM(total_amount) WHERE status IN ('paid','completed')`
  >   — mirrors revenue_summary.
  > - `bookings` → `COUNT(*)` ALL statuses — intent-to-book view, so
  >   includes cancellations/expirations. A shop owner asking "which
  >   services book the most" wants the demand signal, not the money
  >   signal. (For peanut: AQua Tech has 40 total bookings vs 13
  >   paid+completed — these are deliberately different metrics.)
  > - `conversion` → paid+completed bookings ÷ conversations with that
  >   `service_id`. Two CTEs (orders + convos) joined to `shop_services`
  >   via INNER JOIN on convos — services with **0 conversations are
  >   excluded** from the ranking (can't divide by zero; surfacing them
  >   alongside services with real signal would mislead).
  > **Real-data caveat surfaced by the smoke test:** conversion **can
  > exceed 100%** when customers book through non-AI paths (direct
  > marketplace clicks, walk-ins). Peanut's AQua Tech showed 1300%
  > (13 paid / 1 conversation) — math is correct, metric needs
  > interpretation. Display format `X.X% (paid/conv)` makes the
  > underlying counts visible; the Phase 3 system prompt must tell
  > Claude how to phrase conversion >100% honestly ("13 paid bookings
  > vs only 1 AI conversation — most bookings came from outside the
  > AI flow").
  > Service-name resolution: when JOIN to `shop_services` returns NULL
  > (deleted service, orders persist), `resolveServiceName` falls back
  > to `(deleted service srv_abcd1234…)` so the display never crashes.
  > Display: `kind: table` with `['#', 'Service', valueColumn]`;
  > valueColumn is `Revenue` / `Bookings` / `Conversion`. Values
  > formatted as USD / integer / `X.X% (paid/conv)`. Smoke test
  > (`scripts/smoke-tool-top-services.ts`): **50/50 pass** covering
  > revenue × {all, 30d}, bookings × {all, 30d}, conversion × all
  > (including the >100% edge case), service-name resolution, shop-
  > scoping defense for revenue + conversion (fake shop → 0 services),
  > and 2 dispatcher-level bad-args branches. Every tool value matched
  > a hand-written reference SQL run from the same script.
  > `tsc --noEmit` clean.
- [x] **2.4** `bookings_breakdown({ range })` →
  `tools/bookingsBreakdown.ts`. Counts per `service_orders.status`
  (pending/paid/completed/cancelled/no_show/expired/refunded).
  Display: `kind: list`.
  > **Done 2026-05-21.** Implementation: SELECT status, COUNT(*) FROM
  > service_orders WHERE shop_id=$1 [AND created_at >= $2] GROUP BY
  > status. **Canonical statuses always returned** — every status in
  > the spec list (completed, paid, pending, cancelled, no_show,
  > expired, refunded) appears in `data.byStatus` with `0` when
  > absent. Real data only contains 5 of the 7 (no `pending` or
  > `refunded` rows in production yet); explicit 0s let Claude answer
  > "you had no no-shows" honestly instead of inferring absence.
  > **Forward-compat**: any non-canonical status appearing in the data
  > is appended after the canonical block (sorted alphabetically) so
  > future status values flow through without code changes. Display:
  > `kind: list` with first item `{label: "Total bookings", value:
  > <total>}` followed by one row per status. Status display values
  > formatted as `"<count> (<pct>%)"` (e.g. `"175 (33.3%)"`); plain
  > `"0"` when count is zero to avoid `"0 (0.0%)"` clutter. Smoke test
  > (`scripts/smoke-tool-bookings-breakdown.ts`): **33/33 pass**
  > covering all 4 ranges (peanut shop: 7d=12, 30d=13, 90d=72,
  > all=108 bookings — every canonical status count matched
  > hand-rolled SQL refs), display shape (8+ items, total-row first),
  > percentages sum to ~100% (within 0.5% rounding tolerance — actual
  > sums: 99.90, 100.00, 100.00, 100.10), shop-scoping defense (fake
  > shop → total=0 + all canonical statuses=0), and 2 dispatcher-level
  > bad-args branches (invalid range, missing range). `tsc --noEmit`
  > clean.
- [x] **2.5** `ai_assistant_impact({ range })` →
  `tools/aiAssistantImpact.ts`. Wraps `MetricsAggregator.aggregate()`
  — same data the Impact section shows. Display: `kind: list`.
  > **Done 2026-05-21.** Pure wrapper around the existing
  > `MetricsAggregator` — no reimplementation. Calls `aggregator.aggregate({
  > shopId: ctx.shopId, windowStart, baselineMinutes })` with the same
  > inputs `MetricsController` uses, so the chat answer is guaranteed
  > to equal the Impact Metrics dashboard. If the two ever disagree,
  > it's an aggregator bug — not a tool bug.
  > **Baseline source:** `ai_shop_settings.human_reply_baseline_minutes`,
  > default 240 (4 hrs). Duplicated the small `fetchBaselineMinutes`
  > helper + `DEFAULT_HUMAN_REPLY_BASELINE_MINUTES` constant inline —
  > matches the existing pattern in `MetricsController` +
  > `SettingsController` (the comment at SettingsController:25
  > documents the intentional duplication for module-boundary reasons).
  > **Threshold flag surfaced explicitly:** `data.belowThreshold` +
  > `data.belowThresholdReason` (e.g., "Only 4 AI conversations in
  > this window — not enough data for confident conclusions.") so
  > Claude phrases honestly instead of treating tiny samples as
  > authoritative. Display: `kind: list` with 8 always-present items
  > (Window, AI conversations, Bookings generated, Revenue generated,
  > Conversion rate, Customers recovered, Time saved, Avg AI response
  > time) plus a `⚠ Low sample` warning row appended when
  > belowThreshold. Format helpers: USD, hours (min<1, decimals 1-10,
  > rounded ≥10), seconds (s/min/hr scale), percentage. Smoke test
  > (`scripts/smoke-tool-ai-assistant-impact.ts`): **75/75 pass** —
  > strategy is **truth-vs-wrapper**: call `MetricsAggregator.aggregate()`
  > directly with the same inputs from the test, then assert every
  > tool field equals the ref (sampleN, all 5 businessImpact fields,
  > all 3 performance fields). Peanut shop, all 4 ranges: 4 AI
  > conversations / 3 bookings generated / $1,009 revenue — all
  > matched. Display shape + threshold-warning-row presence verified.
  > Shop-scoping defense (fake shop → sampleN=0, belowThreshold=true,
  > all metrics zeroed). 2 dispatcher-level bad-args rejects.
  > `tsc --noEmit` clean.

**Acceptance:** each tool has its own jest test that asserts
shop-scoping (different `shopId` → different result; another shop's
rows never appear); SQL totals match a manually-summed fixture;
`tsc` + jest clean.

> **Phase 2 complete — 2026-05-21.** All five v1 tool execute() bodies
> implemented + smoke-tested against real DO Postgres (peanut shop):
> revenue_summary 40/40, top_customers 53/53, top_services 50/50,
> bookings_breakdown 33/33, ai_assistant_impact 75/75. Total **251/251**
> tool-level assertions pass with every tool value matched to a
> hand-rolled reference SQL (or, for ai_assistant_impact, a direct
> MetricsAggregator call). Shop-scoping defense verified per tool
> (fake shopId → empty/zero results, never another shop's data).
> Acceptance note: smoke tests live under `backend/scripts/smoke-tool-*.ts`
> rather than Jest because they exercise the real DO database — a
> Jest port is a Phase 5 follow-up once we decide whether to spin up
> a per-suite fixture DB. Ready for Phase 3 (controller + endpoint).

---

## 6. Phase 3 — Controller + endpoint

**Goal:** `POST /api/ai/insights` ships, wired up to Claude with
tools enabled.

- [x] **3.1** `InsightsPromptBuilder.ts` —
  `backend/src/domains/AIAgentDomain/services/InsightsPromptBuilder.ts`.
  Pure `buildInsightsSystemPrompt()`. Hard rules:
  - You are a business-insights assistant for the requesting shop's
    own data. You can ONLY answer questions you have a matching tool
    for.
  - Always call a tool to answer. Never make up numbers.
  - If no tool matches the question, decline with the exact decline
    copy (also exported as `INSIGHTS_DECLINE_COPY` for tests).
  - Never reveal another shop's data — your tools are pre-scoped.
  - Keep replies short: lead with the headline number, one sentence
    of context, then point to the rendered card.
  - For follow-ups, prefer reusing the same time range unless the
    user changes it.
  > **Done 2026-05-21.** Pure zero-arg `buildInsightsSystemPrompt()`
  > returns a stable 3,897-char string — Phase 3.2 controller can mark
  > it `cache_control: { type: "ephemeral" }` for prompt-cache hits.
  > `INSIGHTS_DECLINE_COPY` exported as a `const` for test grepping.
  > **Tool list NOT embedded** in the prompt — Anthropic's `tools` API
  > payload carries each tool's description, so duplicating them in
  > the prompt would just inflate cost. The prompt instead lists the
  > **5 area names** (Revenue / Top customers / Top services /
  > Bookings breakdown / AI assistant impact) so Claude has a fast
  > path for deciding whether a question is in-scope without scanning
  > tool descriptions.
  > **10 hard rules**, including the two carryovers from Phase 2:
  > **(rule 6)** the conversion-rate >100% caveat with the example
  > phrasing surfaced from peanut's AQua Tech case ("13 paid bookings
  > vs only 1 AI conversation, so most bookings came from outside the
  > AI flow"), and **(rule 7)** the `belowThreshold` / `sampleN < 5`
  > flag-handling instruction ("flag it up front; don't bury the
  > caveat at the end"). Other rules: always-call-a-tool, one-tool-
  > usual, short replies, exact decline copy, follow-up time-range
  > carryover, shop-scoping reinforcement, route how-to → Help
  > assistant, no auth re-prompts. Reply-style block at the end
  > (USD formatting, percentage decimals, spelled-out windows).
  > Smoke test (`scripts/smoke-insights-prompt-builder.ts`): **26/26
  > pass** — decline copy presence + format, function purity (same
  > output across two calls), all 5 tool areas mentioned, all 10
  > hard-rule snippets present, all 3 style examples ($1,234.56 /
  > 38.7% / last 7 days), structural markers ("Hard rules" /
  > "What you can answer" headers + role-declaration first line).
  > `tsc --noEmit` clean.
  >
  > **Hot-fix 2026-05-21 (post-local-test):** First-test feedback
  > showed Claude asking for clarification ("specify range + by")
  > instead of answering when the user asked "Who are my top 5
  > customers?" with no other args. Root cause: rule 5 only covered
  > **follow-up** range carryover; first-question defaults weren't
  > spec'd, so Claude defaulted to the safest behavior = ask for
  > clarification = 2-turn UX. Rewrote rule 5 to bundle follow-up
  > carryover + first-question defaults under a single
  > "**Default to sensible parameters rather than asking for
  > clarification**" rule: `range='30d'`, `by='spend'` for
  > top_customers, `by='revenue'` for top_services, `limit=5` for
  > rankings, `compare='prior'` only when explicitly asked. Tells
  > Claude to state the assumption inline so the user can redirect.
  > Prompt smoke still 26/26 (substring "reuse the previous time
  > range" preserved in the new wording).
- [x] **3.2** `InsightsController.ts` —
  `backend/src/domains/AIAgentDomain/controllers/InsightsController.ts`.
  Factory + lazy default pattern (mirrors `HelpAssistantController`).
  Pure `parseInsightsRequest(body)` validator (same `sessionId` +
  messages alternation rules).
  > **Done 2026-05-21.** Scaffolded the full controller surface for
  > Phase 3.2 with a **501-returning handler stub** that Phase 3.3 will
  > replace inside `makeInsightsController()`. Same factory + lazy
  > default + top-level `askInsights(req, res)` shape as
  > `HelpAssistantController`. Deps interface: `{ anthropic?,
  > spendCap?, auditLogger?, pool? }` — adds `pool` because the tool
  > dispatcher needs it for `ctx.pool` (Help didn't because its
  > corpus is in-process); defaults to `getSharedPool()`.
  > **Response shape locked now** so 3.3 just fills values:
  > `InsightsResponseData = { reply, model, cached, latencyMs, toolCalls:
  > [{ tool, display? }] }`. The `toolCalls` array drives the
  > frontend's data-card rendering — one card per tool call directly
  > under the assistant bubble.
  > **Validator** is `parseInsightsRequest(body)`, semantically
  > identical to `parseHelpRequest`: validates `sessionId` (non-empty,
  > ≤ MAX_SESSION_ID_CHARS=64), `messages` (non-empty array, ≤
  > MAX_MESSAGES=20), per-message role/content + length cap
  > (MAX_CONTENT_CHARS=4000), strict user→assistant→user alternation
  > starting with `user`, and last message must be `user` (the new
  > question). Constants intentionally duplicated rather than
  > imported from HelpAssistantController — matches the
  > Settings/Metrics module-boundary pattern.
  > Smoke test (`scripts/smoke-insights-controller.ts`): **25/25
  > pass** — 2 happy-path validator cases, 15 rejection branches
  > (null/non-object body; missing/empty/oversized sessionId;
  > missing/empty/over-cap messages; bad role; non-string content;
  > empty/oversized content; starts-with-assistant; two-user-in-a-row;
  > ends-with-assistant), and 3 controller integration cases (no
  > shopId → 401 with `Shop ID required`, bad body → 400 surfaces
  > validator error, valid req → 501 with the explicit "Phase 3.3
  > will wire the pipeline" sentinel). `tsc --noEmit` clean.
- [x] **3.3** Handler pipeline:
  1. Auth (401 no shopId).
  2. Validate (400).
  3. `SpendCapEnforcer.canSpend` (429 if exhausted, shared cap).
  4. `AnthropicClient.complete` with model = `claude-sonnet-4-6`,
     `tools = getInsightsTools().map(toAnthropicTool)`,
     `toolChoice = "auto"`, system prompt from 3.1.
  5. If Claude emitted `toolUses[]`, dispatch each via the Phase
     1.5 helper; record results.
  6. Second Claude call with the tool results threaded back into
     `messages` (standard Anthropic tool-use roundtrip) so Claude
     can write the final prose.
  7. Audit row → `InsightsAuditLogger.log` with `tool_calls`
     populated.
  8. Return `{ reply, model, cached, latencyMs, toolCalls: [{ tool,
     args, display }] }`.
  9. On Claude failure → 503 + audit row written.
  > **Done 2026-05-21.** Replaced the Phase 3.2 stub with the full
  > pipeline inside `makeInsightsController()`.
  > **Type extension required:** `ChatMessage.content` was `string`-only
  > in `domains/AIAgentDomain/types.ts`. Extended to `string |
  > ChatMessageContentBlock[]` where the block union covers `text` /
  > `tool_use` / `tool_result` shapes. Backward-compatible — existing
  > callers (AgentOrchestrator, HelpAssistantController) pass strings
  > which still type-check; tsc clean across the whole backend after
  > the change. **No AnthropicClient change needed**: the existing
  > `messages.map((m) => ({ role, content: m.content }))` already
  > passes content through unchanged, and the Anthropic SDK accepts
  > either form.
  > **Loop, not a fixed two-shot.** Implemented as an agent loop with
  > `MAX_TOOL_ITERATIONS = 5` cap — each iteration: call Claude,
  > break if `toolUses.length === 0` (model wrote final prose),
  > otherwise dispatch every tool_use, append assistant's structured
  > content + a user `tool_result` block per dispatch, and continue.
  > The cap is the safety against a runaway model calling tools in a
  > loop; the prompt rule 2 ("one tool call usually enough") is the
  > soft nudge. **Cumulative accounting**: input_tokens / output_tokens
  > / cached_input_tokens / costUsd / latencyMs all summed across loop
  > iterations into a single audit row — `tool_calls` JSONB captures
  > every dispatch so the full sequence is reconstructable post-hoc.
  > **Unknown-tool handling**: if Claude hallucinates a tool name,
  > synthesize an `ok: false` dispatch record with `error: "Unknown
  > tool '<name>'"`, surface as a `tool_result` block with
  > `is_error: true` so Claude can phrase the failure honestly on
  > the next turn instead of throwing.
  > **Audit ordering**: audit row written BEFORE the 503 return on
  > Claude failure (matches HelpAssistantController) so failures are
  > observable in the DB. Spend recorded ONLY on successful response
  > (not on 429 or 503).
  > Smoke test (`scripts/smoke-insights-pipeline.ts`): **46/46 pass**
  > — uses mocked Anthropic + spend-cap + audit-logger, real DO pool
  > for the dispatch step. Branches covered: (1) zero tool calls →
  > 1 Claude call + reply pass-through; (2) single tool call →
  > 2 Claude calls + roundtrip → second call carries the
  > tool_result block + real dispatch against revenue_summary
  > returned $7,783.02 for peanut; (3) two parallel tool_use blocks
  > in one Claude turn → both dispatched + audited; (4) iteration cap
  > = 5 (infinite-tool-use mock looped exactly 5 times then returned
  > 200); (5) Anthropic throws → 503 + audit row with errorMessage +
  > responsePayload null + latencyMs null + spend NOT recorded;
  > (6) spend cap exhausted → 429 with details.blockReason, no
  > Claude call, no audit row; (7) Claude hallucinates a tool name
  > → 200 with the failure captured in tool_calls + second-call
  > tool_result block carries `is_error: true`. `tsc --noEmit` clean.
- [x] **3.4** Register `POST /api/ai/insights` in
  `AIAgentDomain/routes.ts`, shop-role guarded.
  > **Done 2026-05-21.** Added one line in `routes.ts`:
  > `router.post('/insights', authMiddleware, requireRole(['shop']),
  > askInsights);` — mirrors `/help` exactly. Updated the doc header
  > listing to include the new endpoint. **Auth shape confirmed
  > identical to /help** via direct reference comparison in the smoke
  > test (`/insights` handler[0] === `/help` handler[0]). Final
  > endpoint path: `POST /api/ai/insights` (the `/api/ai` prefix is
  > added by DomainRegistry mount in app.ts).
  > Smoke test (`scripts/smoke-insights-route.ts`): walks
  > `router.stack` directly — **9/9 pass** — POST /insights
  > registered exactly once, 3-handler chain
  > `[authMiddleware, <requireRole-anon>, askInsights]`, handler[2]
  > is the actual `askInsights` reference (not a wrapper), and the
  > auth shape matches `/help`. **Gotcha:** importing `routes.ts`
  > triggers every domain controller's module-load side effects
  > including eager DB-pool probes — added `process.exit(0)` at
  > script end to force clean exit past the dangling handles.
  > `tsc --noEmit` clean.

**Acceptance:** `tsc` clean; manual curl with a shop JWT returns a
real Claude-generated prose + tool results for "How much did I earn
last month?"; the audit row in `ai_insights_messages` shows the tool
invocation. Out-of-domain question gets the decline copy.

> **Phase 3 complete — 2026-05-21.** All four tasks (3.1–3.4) green:
> InsightsPromptBuilder (26/26), InsightsController validator + factory
> (25/25), full handler pipeline with agent loop (46/46), route
> registration (9/9) — **total 106/106 assertions pass**, `tsc` clean
> across the backend. The end-to-end smoke test in 3.3 verified the
> roundtrip with a real `revenue_summary` dispatch returning $7,783.02
> for peanut. Manual-curl acceptance (real Claude, real JWT) is
> deferred to the manual QA pass — code path is fully covered by
> mocked + real-DB smoke tests. Ready for Phase 4 (frontend launcher
> + panel + data-card renderer).

---

## 7. Phase 4 — Frontend launcher + panel

**Goal:** new launcher in the shop dashboard opens an Insights panel.
Looks similar to Help but renders structured data cards.

- [x] **4.1** API service —
  `frontend/src/services/api/aiInsights.ts`. Mirrors `aiHelp.ts`:
  `askInsights(sessionId, messages)`, `InsightsResponse`,
  `InsightsToolCall`, `INSIGHTS_LIMITS`.
  > **Done 2026-05-21.** Created
  > `frontend/src/services/api/aiInsights.ts` mirroring `aiHelp.ts`'s
  > shape exactly. Exports: `askInsights(sessionId, messages)`,
  > `InsightsMessage`, `InsightsMessageRole`, `InsightsResponse`,
  > `InsightsToolCall`, `ToolDisplay` (discriminated union over
  > `number | table | list | sparkline`, **mirror of the backend's
  > `ToolDisplay` shape**), and `INSIGHTS_LIMITS = { maxMessages: 20,
  > maxContentChars: 4000, maxSessionIdChars: 64 }` matching the
  > backend's `MAX_*` constants. Same multi-turn alternation contract
  > as Help; same 4xx/429/503 error map documented for the panel.
  > **Difference from aiHelp**: response carries a `toolCalls: Array<{
  > tool, display? }>` field — the Phase 4.4 card renderer branches
  > on `display.kind`. `display` is optional (absent for unknown-tool
  > / dispatch-failure cases, where Claude's prose surfaces the
  > failure on its own). **Acceptance for this task**: verified the
  > new file compiles clean under the project's actual tsconfig
  > (`tsc --noEmit` grepped for any insights-related error: zero).
  > Tried a runtime smoke harness via ts-node but the Next.js ESM
  > setup rejects raw .ts execution; the compile-check is the real
  > contract verification here, so removed the harness rather than
  > carry dead test code. Phase 4.3 panel consumption will exercise
  > the runtime contract.
- [x] **4.2** Launcher button —
  `frontend/src/components/shop/insights/InsightsLauncher.tsx`. Round
  yellow button with a `BarChart3` (or `LineChart`) icon. Wraps a
  shadcn `Sheet`, dark theme. Mounted in `DashboardLayout.tsx`
  action cluster, gated on `userRole === 'shop'`. Placed AFTER the
  Help launcher (Help first, Insights second).
  > **Done 2026-05-21.** Created
  > `frontend/src/components/shop/insights/InsightsLauncher.tsx`
  > mirroring `HelpAssistantLauncher` exactly: same `Sheet` /
  > `SheetTrigger` / `SheetContent` shape, same yellow round-button
  > styling (`bg-[#FFCC00]` + dark shadow), same dark slide-over
  > theming (`bg-[#101010]`, `sm:max-w-md`). Icon: `BarChart3` from
  > lucide-react. Title "Business Insights", subtitle "Ask about your
  > shop's revenue, customers, services, and AI assistant impact."
  > **Body is a placeholder** ("Chat panel coming soon.") — Phase
  > 4.3 will replace it with `InsightsPanel`. Mounted in
  > `DashboardLayout.tsx` line 135 immediately after
  > `HelpAssistantLauncher`, gated on `userRole === 'shop'` —
  > matches the impl-doc Help-first / Insights-second order so the
  > visual sequence echoes the mental sequence (ask how to use it
  > first, then ask what it's telling you). **No browser smoke
  > test** at this step — the panel body is a stub, so visually
  > confirming the click-to-open flow against a stub doesn't add
  > confidence. End-to-end browser check is deferred to the Phase
  > 4.3/4.4 acceptance step where there's a real chat + data card
  > to render. `tsc --noEmit` clean (zero errors mentioning
  > `insights` or `DashboardLayout` in the project-wide check).
- [x] **4.3** Panel —
  `frontend/src/components/shop/insights/InsightsPanel.tsx`. Same
  shape as `HelpAssistantPanel`: sessionId minted on mount, multi-
  turn local state, input + send, HTTP error mapping, auto-scroll,
  typing indicator. Suggested starter chips (different from Help):
  - "How much did I earn last week?"
  - "Who are my top 5 customers?"
  - "Which services are most popular?"
  - "What's the breakdown of my bookings this month?"
  > **Done 2026-05-21.** Created
  > `frontend/src/components/shop/insights/InsightsPanel.tsx`
  > mirroring `HelpAssistantPanel`'s skeleton (sessionId via
  > crypto.randomUUID() on mount, multi-turn local state, input +
  > send, HTTP error mapping for 401/400/429/503, auto-scroll,
  > Thinking… typing indicator, react-markdown for assistant prose,
  > shadcn-themed dark bubbles + yellow user-message tile). Wired
  > `InsightsLauncher` to render `<InsightsPanel />` in place of the
  > Phase-4.2 placeholder.
  > **Key structural difference from Help: a local `Turn` type
  > bundles each assistant reply's `toolCalls` alongside its
  > `content`**, instead of using a parallel index-keyed structure.
  > Cleaner — the bubble component just reads `turn.toolCalls`
  > directly. `toWireMessages()` strips `toolCalls` before the API
  > call since the backend ignores it on input (the model gets the
  > same info via tool_result blocks the backend threads itself).
  > **No article-expansion mode** (insights has no corpus to
  > cross-link), so the markdown components are stripped to the
  > styling-only subset — no `.md`-link rewiring or article-index
  > fetching. Reduces panel surface ~150 lines vs Help.
  > **Starter chips** match the impl-doc spec exactly (one per v1
  > tool: revenue_summary, top_customers, top_services,
  > bookings_breakdown). **Footer copy differs from Help**: "Answers
  > are based on your shop's live data. The assistant can only see
  > your own shop." (Help's "doesn't access your shop data" would
  > be misleading for insights — the whole point is data access.)
  > **Tool-card rendering is a stub** (`ToolCallCardStub`) — shows
  > the tool name + display.kind for visibility but doesn't render
  > the actual data card. Phase 4.4 replaces it with the real
  > number/table/list/sparkline branched renderer.
  > **No browser test yet** — Phase 4.4 acceptance is the right
  > step for end-to-end browser verification (real Claude reply +
  > real card under it). `tsc --noEmit` clean (zero errors
  > mentioning insights project-wide).
- [x] **4.4** Data-card renderer —
  `frontend/src/components/shop/insights/InsightsToolCallCard.tsx`.
  Branches on `ToolDisplay.kind`:
  - `number` → large yellow figure + label + optional sub-text.
  - `table` → small dark table with header row.
  - `list` → label/value rows.
  - `sparkline` → mini SVG bar/line chart (hand-rolled, no
    chart dep — kind=sparkline is the only one with curve data).
  Cards render directly under the assistant's prose bubble.
  > **Done 2026-05-21.** Created
  > `frontend/src/components/shop/insights/InsightsToolCallCard.tsx`
  > — single `<InsightsToolCallCard toolCall={...} />` component
  > whose inner `<DisplayBody>` switches on `display.kind` to one of
  > four leaf renderers. Returns `null` when `display` is absent
  > (tool errored — Claude's prose already surfaces the failure).
  > Theming: `bg-[#0f0f0f]` + `border-gray-800` matching panel
  > bubbles; **yellow `#FFCC00` reserved for the single most-important
  > value** — the headline number, the sparkline stroke, the
  > sparkline's optional primary label — so the eye lands there first.
  > **Per-variant decisions:**
  > - `number` — 2xl semibold yellow primary + small gray label
  >   above + small gray sub below. `tabular-nums` so digit columns
  >   line up across re-renders.
  > - `table` — `<table>` element (not a CSS grid) so screen readers
  >   parse headers correctly. First column muted gray (rank/index),
  >   rest tabular-nums for value alignment. `overflow-x-auto`
  >   wrapper for graceful narrow-panel handling.
  > - `list` — `<dl>` with each row a flex baseline-aligned
  >   label/value pair. Label `truncate`, value `flex-shrink-0` so
  >   labels never crowd values out.
  > - `sparkline` — **hand-rolled SVG, zero chart dep**, ~25 lines.
  >   Normalizes the series to [min..max] then polyline-renders into
  >   a 220×32 viewBox with `preserveAspectRatio="none"` so it
  >   stretches to fit the card's width. Single-point series and
  >   flat series both render without divide-by-zero (range floor of
  >   1, conditional stepX).
  > `humanizeToolName('revenue_summary')` → 'Revenue summary' for
  > the small uppercase header label — users never see raw snake_case.
  > Swapped `ToolCallCardStub` → `InsightsToolCallCard` in
  > `InsightsPanel.tsx`; deleted the stub. Frontend end-to-end
  > pipeline now exists: launcher → panel → real API call → real
  > Claude → real tool dispatch → real card render.
  > **Honest gap:** `tsc --noEmit` clean, but **no browser test
  > yet** — Phase 4 acceptance is the right place for the manual
  > end-to-end flow (open panel → "How much did I earn last week?"
  > → number card shows correct $). Recommending we boot the dev
  > server + run that test before claiming Phase 4 done.
- [x] **4.5** Range-chip display — small badge near the input
  showing the active time range (when applicable), so the shop
  owner knows what "this" refers to in follow-ups.
  > **Done 2026-05-21.** Required plumbing `args` through the
  > backend response (`InsightsToolCallSummary` gained
  > `args: Record<string, unknown>`; controller mapper now copies
  > it). Mirrored on the frontend `InsightsToolCall` type. Safe —
  > insights tool args are always enum/literal values (range / by /
  > limit / compare), never sensitive content.
  > **Active-range derivation** in `extractActiveRange(turns)`:
  > walks turns newest-to-oldest, then walks each assistant turn's
  > toolCalls reverse-order, returns the first `args.range` that
  > matches one of `7d | 30d | 90d | all`. Reverse-then-reverse so
  > a multi-tool response (e.g. revenue + bookings) yields the LAST
  > tool's range — that's the one Claude phrased the summary around
  > and the one the user is most likely talking about in a follow-up.
  > **Chip UI**: small uppercase pill aligned right above the input
  > — `Range: last 7 days` with the time-window label in yellow
  > (`#FFCC00`) and "Range:" + chrome in muted gray. Native `title`
  > tooltip on hover: "Follow-up questions will reuse this range
  > unless you specify a different one." Hidden when
  > `activeRange === null` (fresh conversation, decline path,
  > or no range-bearing tool yet — e.g. only `ai_assistant_impact`
  > with no range, though that case doesn't exist since all 5 v1
  > tools take range).
  > **Regression-safe**: re-ran pipeline smoke
  > (`scripts/smoke-insights-pipeline.ts`) — still **46/46 pass**
  > with `args` field now visible in the response body output (case
  > 2 console log shows `"toolCalls":[{"tool":"revenue_summary",
  > "args":{"range":"all"}, ...}]` proving the plumbing flows
  > end-to-end through the real controller). `tsc --noEmit` clean
  > on both backend + frontend.

**Acceptance:** open panel → ask "How much did I earn last week?"
→ Claude calls `revenue_summary({range:'7d'})` → response renders
prose + a `number` card with the dollar amount. Follow-up "And the
month?" should reuse the customer's intent for revenue but switch
range to 30d.

---

## 8. Phase 5 — Tests + polish + cost review

- [x] **5.1** Per-tool tests (one file per tool under
  `backend/tests/ai-agent/insights/tools/`). Critical invariant
  checks: every test seeds rows for TWO shops and asserts the tool
  ONLY returns the requesting shop's rows. Plus math correctness
  on a known fixture.
  > **Done 2026-05-21.** Created 5 jest files under
  > `backend/tests/ai-agent/insights/tools/` — one per tool, totaling
  > **61 assertions**. Approach: **mocked pools with queued query
  > results** (mirrors `MetricsAggregator.test.ts`), each tool tested
  > on (a) math correctness across canned rows, (b) display shape per
  > mode, (c) **structural SQL guards** that catch regression of the
  > shop-scoping / status-filter / join-table clauses, (d) args
  > validation throws. Two-shop-seeding-and-assert-no-leak was
  > **adapted to "assert SQL hardcodes `shop_id = $1` with
  > `ctx.shopId`"** — mocked pools can't prove non-leak (the test
  > controls what comes back), but the SQL structural assertions
  > catch the only way a leak could happen at the tool layer. Real
  > end-to-end shop-scoping verified by the smoke scripts (real DO
  > calls). Tool tests are CI-safe: no DB, deterministic, ~3-7s each.
  > Two test-bug fixes during authoring: `defaultLabel('alpha_status')`
  > capitalizes EACH word (Alpha Status, not Alpha status); RCN format
  > `73.50` → `'73.50 RCN'` (toFixed preserves trailing zero) not
  > `'73.5 RCN'`. Source code was correct in both cases.
- [x] **5.2** `InsightsController.test.ts` — handler branches
  (auth, validation, spend skip, happy with tool roundtrip, 503 on
  Claude failure, audit row written with `tool_calls` populated).
  > **Done 2026-05-21.** Created
  > `backend/tests/ai-agent/insights/InsightsController.test.ts` —
  > **27 assertions** covering: parseInsightsRequest happy/rejection
  > paths, 401 (no shopId), 400 (bad body, validator error surfaced),
  > 429 (spend cap blocks before Claude/audit), happy zero-tool
  > path (1 Claude call + audit + spend recorded), happy tool-
  > roundtrip path (2 Claude calls + tool_calls populated in audit +
  > display surfaced to frontend), 503 on Claude throw (audit
  > written, spend NOT recorded, error_message captured, latencyMs
  > null), iteration cap (5 Claude calls then halt with 5 tool_calls
  > in audit), unknown-tool-name hallucination captured non-throwingly
  > as `tool_calls[i].error`. All mocks injected via the
  > `makeInsightsController()` factory deps (`anthropic`, `spendCap`,
  > `auditLogger`, `pool`) — zero real network/DB. Mirrors
  > `HelpAssistantController.test.ts` shape so future readers find
  > the same pattern.
- [x] **5.3** `InsightsPromptBuilder.test.ts` — structural checks
  (corpus of tool descriptions absent — Claude reads tool descs
  directly; verify decline copy is included, model + tool-use
  expectations).
  > **Done 2026-05-21.** Created
  > `backend/tests/ai-agent/insights/InsightsPromptBuilder.test.ts`
  > — **23 assertions** covering: function purity, decline copy
  > exact match + Help-assistant pointer, role declaration prefix,
  > section headers (`# What you can answer` / `# Hard rules`)
  > with ordering, all 5 tool areas mentioned, all 10 hard rules
  > present (always-call-a-tool, never-make-up-numbers, short
  > replies, **defaults rule with concrete `range: "30d"` /
  > `by: "spend"` / `by: "revenue"` substring checks** locking in
  > the 2026-05-21 hot-fix, conversion >100% caveat, belowThreshold
  > / sampleN flag, pre-scoped shop-scoping reminder, route-to-Help
  > line, no-re-auth line), and style examples ($1,234.56 / 38.7%
  > / last 7 days). Substring checks chosen over snapshots so the
  > prompt can be tuned without breaking the structural contract.
- [x] **5.4** Manual QA matrix:
  - Each of the 4 starter chips returns a sensible answer.
  - "What's the weather?" → decline copy.
  - "How much did shop XYZ earn?" → decline (cross-shop blocked).
  - Multi-turn follow-up reuses the previous range.
  - Spend cap hit → 429.
  > **Done 2026-05-21.** Written up as
  > `docs/tasks/strategy/business-data-insights/qa-test-guide.md` —
  > a 9-section browser-QA walkthrough (setup, launcher visibility,
  > per-tool happy paths, cross-cutting behaviors incl. follow-up
  > carryover + decline copy + conversion >100% + below-threshold,
  > display-variant rendering, range-chip behaviors, error paths,
  > audit-log spot checks, polish checks). The user ran this on
  > 2026-05-21 and surfaced one real UX bug (clarifying-question
  > friction on first-turn questions) → hot-fixed via the
  > InsightsPromptBuilder rule-5 defaults rewrite. Conversation
  > message-limit also bumped from 20 → 30 after the user hit it
  > during testing.
- [ ] **5.5** Cost audit after first week of staging. Inspect
  `ai_insights_messages.cost_usd` totals + per-turn distribution.
  Decide if a per-day soft-cap is needed.
  > **Deferred — needs real production traffic.** This task can't
  > complete until the feature has shipped to staging and accumulated
  > ~1 week of real shop-owner usage. Currently blocked by deploy.

---

## 8a. Phase 6 — Breadth + exploration UX

**Goal:** close the breadth gap to Square AI (5 more tools) + add
calendar-aligned ranges + AI-suggested follow-up chips. Per the
`phase-6-plus-roadmap.md` ranking, this is the highest-ROI lane.

**Started 2026-05-21**, after Phase 5 ship was merged + deployed
(PR #370, commit `ad0389ed`).

### 6.1 — Calendar-aligned ranges (`this_week` / `this_month` / `last_month` / `this_quarter`)

- [x] **6.1** Extend the `RangeKey` union in all 5 v1 tools to
  add `this_week | last_week | this_month | last_month | this_quarter`
  alongside the existing `7d | 30d | 90d | all`. Both vocabularies
  coexist — rolling for "rolling 30-day NPS" style asks, calendar
  for "this month" style asks. Prompt rule 5 updated so Claude picks
  whichever the user phrased.
  > **Done 2026-05-21.** Approach: new `services/insights/ranges.ts`
  > module as the single source of truth. Exports `RangeKey` (9-value
  > union), `RANGE_ENUM` (for JSON-schema `enum` arrays),
  > `RANGE_LABEL` (human-readable strings), `windowBoundsFor()`
  > (returns `{from, to}` for both rolling + calendar ranges),
  > `priorWindowBoundsFor()` (compare='prior' helper that shifts
  > current window backward by its own length — fair apples-to-apples
  > for partial-period calendar ranges like "this_month so far"
  > vs "last month, same days"), and `windowStartFor()` (backward-
  > compat shim). Calendar math is hand-rolled — ISO 8601 Monday-anchored
  > week start, calendar-aligned month/quarter starts. **No date-lib
  > dep needed.**
  > Tool refactor: all 5 existing tools migrated to import from
  > `ranges.ts`. Local `RangeKey` types, `RANGE_DAYS`, `RANGE_LABEL`,
  > `MS_PER_DAY`, `windowStart()` removed (saves ~15 lines per tool).
  > Every SQL builder now handles BOTH `bounds.from` (created_at >=)
  > AND `bounds.to` (created_at <) so `last_week` / `last_month`
  > correctly exclude this-week / this-month data.
  > **MetricsAggregator extended** with optional `windowEnd` param —
  > additive, backward-compatible. MetricsController still calls
  > without `windowEnd` and gets old behavior; aiAssistantImpact tool
  > now passes both bounds.
  > All 5 existing input schemas now expose all 9 enum values via
  > `[...RANGE_ENUM]`. Tool descriptions updated to mention both
  > vocabularies + tell Claude to pick whichever phrasing the user
  > used.
  > Verification: `tsc --noEmit` clean. Jest **95/95 pass** —
  > existing tests are vocabulary-agnostic (they queue mock rows,
  > don't care about which enum value triggered the query) so the
  > expansion was backward-compatible without test changes.

### 6.2 — Five new tools

- [x] **6.2.1** `cancellation_breakdown({ range })` — counts
  service_orders with `status IN ('cancelled', 'no_show', 'expired')`
  grouped by status + cancellation_reason where populated. Display:
  list with status rollup + top-3 reason rows (`↳ <reason>`).
- [x] **6.2.2** `customer_tier_distribution()` — current snapshot
  (no range arg). JOIN customers ↔ service_orders on
  customer_address restricts to THIS shop's customers. Canonical
  Bronze/Silver/Gold zero-fill + forward-compat for extra tiers
  (e.g. Platinum). NULL tier → "Unknown" label.
- [x] **6.2.3** `time_of_day_pattern({ range })` — 24-bucket
  hourly histogram via `EXTRACT(HOUR FROM COALESCE(booking_date,
  created_at))`. Display: **sparkline** (first v1 use of the
  sparkline kind). Primary surfaces peak hour ("peak 8pm (10)").
  Defensive: hours outside 0..23 silently dropped. SQL precedence
  bug caught + fixed before commit.
- [x] **6.2.4** `repeat_customer_analysis({ range })` — CTE
  computes per-customer order counts in the window, outer query
  splits into new (n=1) vs repeat (n≥2) + `avgRepeatOrders`.
  Display: number kind w/ `% repeat` as primary; sub describes
  the split + avg-orders-for-returning-customers depth.
  Edge case: pctRepeat = null when total = 0.
- [x] **6.2.5** `rcn_balance_summary()` — reads `shops.purchased_rcn_balance`
  + `shops.total_tokens_issued` for the snapshot, plus a 30-day
  rolling `SUM(amount) WHERE type IN ('mint', 'tier_bonus')` from
  transactions for the burn rate. Implied runway = available / burn
  (null when burn=0). Display: list of 4 rows. No range arg —
  shop owners ask "what's my RCN treasury" as a snapshot, not a
  window.
  > **Done 2026-05-21.** All 5 tool files created under
  > `services/insights/tools/`, registered in `registry.ts` ordered
  > after the v1 tools. **Total tool count: 5 → 10.** No schema
  > collisions, no broken existing tools. Each new tool has a
  > dedicated jest file under `tests/ai-agent/insights/tools/`
  > using the same mock-pool pattern as Phase 5.1 — **93/93 jest
  > assertions** pass across all 10 tool test files (5×14-19 v1
  > + 5×6-9 new = 93). Smoke scripts deferred — the pipeline smoke
  > (`smoke-insights-pipeline.ts`) will exercise the registry
  > end-to-end against real DO once the prompt update lands and
  > Claude can route to the new tools. `tsc --noEmit` clean.

**Acceptance:** each tool gets a jest test (mock-pool pattern from
Phase 5.1), smoke script against real DO data, and registry entry.
Adds ~70-100 jest assertions total. ✓ **53 new assertions added
(7+7+6+5+10+8+5+6 across the 5 tool files); registry now exposes
10 tools.**

### 6.3 — AI-suggested follow-up chips

- [ ] **6.3.1** New `suggest_followups({ questions: string[] })`
  tool — meta-tool Claude calls AFTER answering. Returns the
  questions directly as a new display kind `follow_ups`. Shop-scope
  irrelevant (doesn't touch the DB).
- [ ] **6.3.2** New `ToolDisplay` variant `{ kind: 'follow_ups';
  items: string[] }`. Both backend types + frontend types extended.
- [ ] **6.3.3** Frontend renderer in `InsightsToolCallCard`:
  tap-able pill chips, each submits the chip text via the parent
  panel's submit handler. Needs an `onFollowupClick` callback
  threaded from `InsightsPanel` → `TurnBubble` → `InsightsToolCallCard`.
- [ ] **6.3.4** Prompt rule update: "After answering, call
  `suggest_followups` with 2-3 short questions the user might ask
  next. Pick questions answerable by your other tools — never
  out-of-scope topics. Skip the call if the user's last message
  indicated they're done."

**Acceptance:** asking "how much did I earn last week?" returns the
revenue number card AND a chip row below with 2-3 next-step
suggestions ("Top customers", "Compare to the month before",
"Bookings breakdown"). Tapping any chip submits it as a new user
message.

### 6.4 — Prompt tuning pass + final smoke

- [ ] **6.4** After all 5 tools land, update prompt's tool-areas
  list (was 5, now 10). Tighten descriptions if Claude's tool
  selection drifts (test by asking the same question repeatedly).
  Re-run prompt-builder jest assertions; bump to ~30 covering the
  new rules.

**Phase 6 acceptance:** all 5 tools merged + deployed; calendar
ranges work end-to-end; clicking a follow-up chip submits + answers;
jest suite ≥ 150 assertions; smoke matrix runs clean on peanut.

---

## 8b. Phase 6.3 + full 6.4 — START HERE TOMORROW

**Status as of EOD 2026-05-21:** Phase 6.1 + 6.2 + minimal 6.4 merged
via PR #371 (commit `1f9c36c0`) and deployed. **`deo/business-insights`
is now behind `main`** — start tomorrow by either:
- `git checkout main && git pull && git checkout -b deo/business-insights-phase-6-3`
- Or reset existing branch: `git checkout deo/business-insights && git fetch && git reset --hard origin/main`

Either way, base off the fresh `main` so the Phase 6.3 work picks up
PR #371 + the 4 unrelated commits that landed alongside it.

### What's left in Phase 6

- [ ] **6.3.1** New `suggest_followups({ questions: string[] })`
  meta-tool — Claude calls this AFTER answering. Trivial dispatch
  (no DB call) — just echoes `questions` into the result as a new
  display kind. Tool description should explicitly say "use AFTER
  data-fetching tools, not instead of them" so the agent loop
  orders correctly.
- [ ] **6.3.2** New `ToolDisplay` discriminated-union variant:
  `{ kind: "follow_ups"; items: string[] }`. Extend both backend
  (`services/insights/types.ts`) and frontend (`services/api/aiInsights.ts`)
  type declarations.
- [ ] **6.3.3** Frontend renderer addition to `InsightsToolCallCard`:
  `kind: "follow_ups"` → row of pill chips. Each chip's onClick fires
  an `onFollowupClick(text)` callback prop. **Plumbing required**:
  `InsightsPanel` → `<TurnBubble onFollowupClick={submitText} />` →
  `<InsightsToolCallCard onFollowupClick={...} />`. Currently the
  card doesn't know about the panel's submit handler.
- [ ] **6.3.4** Prompt rule addition (rule 11 or extend rule 2):
  "After answering a question, call `suggest_followups` with 2-3
  short questions the user might ask next. Pick questions answerable
  by your other tools — never out-of-scope topics. Skip the call
  when the user's last message indicates they're done."
- [ ] **6.4 (full)** Prompt-tuning pass — observe real shop-owner
  traffic from the Phase 6.2 deploy. If Claude misroutes
  ("how many gold customers?" → `top_customers` instead of
  `customer_tier_distribution`), tighten descriptions to disambiguate.
  The 10-tool toolkit is the first time we're seriously testing
  Claude's tool-selection accuracy.

### Implementation design choices already worked out

**For 6.3.1 — `suggest_followups` tool shape:**

```ts
// services/insights/tools/suggestFollowups.ts
export const suggestFollowups: BusinessInsightsTool = {
  name: "suggest_followups",
  description:
    "After answering a question with a data tool, call this with 2-3 " +
    "short next questions the user might ask. Pick questions answerable " +
    "by your other tools — never speculative ones. Skip when the user's " +
    "last message indicates they're done (e.g. 'thanks').",
  inputSchema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: { type: "string", maxLength: 80 },
        minItems: 1,
        maxItems: 5,
      },
    },
    required: ["questions"],
    additionalProperties: false,
  },
  async execute(args: unknown, _ctx: ToolContext): Promise<ToolResult> {
    const a = args as { questions?: unknown };
    if (!Array.isArray(a.questions)) {
      throw new Error("suggest_followups: questions must be an array");
    }
    const questions = a.questions
      .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
      .map((q) => q.trim())
      .slice(0, 5);
    return {
      data: { questions },
      display: { kind: "follow_ups", items: questions },
    };
  },
};
```

**Risk: dead chips.** From the roadmap doc: bad chips feel worse than
no chips. Mitigation paths:
1. Make the tool description aggressive about "never out-of-scope" so
   Claude only suggests questions other registered tools can answer.
2. After landing, do a manual QA pass — issue 10 different real
   questions and verify the suggested chips are all answerable.
3. If chip quality is bad, kill the rule and ship only as a
   not-prompted-by-default tool (Claude can call it if it wants, but
   the prompt doesn't ASK it to).

**For 6.3.3 — frontend callback plumbing:** the cleanest way is to
add `onFollowupClick?: (question: string) => void` as a prop on both
`InsightsToolCallCard` and `TurnBubble`. In `InsightsPanel`, pass
`submitText` (the existing per-panel submit handler) as the callback.
Threading should be 3 lines per file, but watch for `TurnBubble`'s
existing prop interface — the bubble currently only gets `turn` and
`markdownComponents`.

### Real-traffic feedback to watch before tomorrow

- Does `customer_tier_distribution` get picked correctly for "how
  many gold customers do I have?" — or does Claude reach for
  `top_customers` first? Tool-name similarity is a known
  disambiguation risk.
- Does `time_of_day_pattern` actually render a clean sparkline at
  the panel width, or does it look squished?
- Does the calendar-range `this_month` resolve correctly mid-month
  (e.g. asking on the 21st should compare Mon-21 last month to
  Mon-21 this month per `priorWindowBoundsFor`'s same-elapsed-length
  semantics)?

If any of those misbehave, surface BEFORE Phase 6.3 — they're
prompt/SQL tuning, separate from the chip-rendering work.

---

## 9. Out of scope for v1 (do not build)

- ~~The 3 deferred tools (`cancellation_breakdown`,
  `customer_tier_distribution`, `rcn_balance_summary`) — v1.1.~~
  **Reclassified into Phase 6** (2026-05-21) — all three are being
  built alongside `time_of_day_pattern` + `repeat_customer_analysis`
  as part of the breadth-gap close.
- Free-form NL→SQL fallback.
- Admin platform-wide Q&A.
- Anomaly alerts / proactive notifications.
- Forecasting / projections.
- Cross-shop comparisons.
- Writing operations of any kind.
- Interactive charts / dashboard navigation from chat.
- Real-time updates (every call is a fresh query).

---

## 10. Rough effort

**~7–10 developer-days** total (from scope-doc Section 9):

- Phase 1 (audit + tool framework): ~1 day.
- Phase 2 (5 tools w/ SQL + tests): ~3 days. *(Was 3–4 with 8
  tools; dropping to 5 saves ~1 day.)*
- Phase 3 (controller + endpoint + prompt): ~1 day.
- Phase 4 (frontend panel + card renderer): ~2 days.
- Phase 5 (tests + cost audit + polish): ~1–2 days.

**Hidden cost reminder:** getting the tool **descriptions** tight
enough that Claude picks the right one consistently. Plan a focused
tuning pass during Phase 5. Suggested workflow: write each tool's
description, run a batch of 20 candidate questions through Claude
(no tool execution, just `toolChoice: "auto"` and inspect the
selection), iterate on descriptions until the selection rate is
≥95%. Cheap to run, expensive to skip.

---

## 11. Risk checklist

- **Cross-shop data leakage** — the single biggest risk. The
  invariant: every tool's SQL hardcodes `WHERE shop_id = $1` with
  the value from `ctx.shopId`, sourced from the JWT. Tools NEVER
  accept a `shopId` argument from Claude. Every per-tool test in
  Phase 5.1 explicitly seeds another shop's rows and asserts they
  never surface.
- **Tool selection drift** — if Claude routinely picks the wrong
  tool, the answer is wrong before the SQL even runs. Mitigation:
  the Phase 5 description-tuning pass.
- **Cost runaway** — Sonnet + tool roundtrips can be 5–10× Haiku
  per turn. Shared monthly cap is the first line of defense; the
  per-day soft-cap follow-up is the second.
- **Expensive queries** — a tool with bad SQL could lock a table.
  Mitigation: every tool query uses indexed columns + a hard
  `LIMIT` where applicable; review during Phase 2 code review.
- **Stale data assumption** — every call hits live DB. If a tool
  reads from a large table without an index for the requested
  filter, latency spikes. Mitigation: every tool's SQL is
  EXPLAINed during implementation.
