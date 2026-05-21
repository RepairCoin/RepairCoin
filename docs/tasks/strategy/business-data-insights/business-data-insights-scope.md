# Task Scope — Business-Data Insights ("Ask about your business")

**Status:** Scoping — not started.
**Folder:** `docs/tasks/strategy/business-data-insights/` — dedicated
home for this feature's scope, plans, and status as it evolves.
**Created:** 2026-05-21
**Origin:** Square AI's *"Ask about your business"* half. The
How-To Assistant (shipped via PR #367) covered the *how-to / product
help* half; this doc scopes the **live-data Q&A** half.
**Audience of the feature:** shop owners (primary). Admin platform-wide
Q&A is a fast-follow.

---

## 1. Problem

The shop owner can see fixed dashboards (Impact Metrics, Services tab,
Customers tab, etc.), but they can't ask the system in plain English:

- *"How much did I earn last week?"*
- *"Who are my top 5 customers by RCN earned?"*
- *"Which service has the lowest booking rate?"*
- *"Show me cancellations this month vs last month."*

Today this requires a dev to write a query, or the shop owner has to
manually combine numbers from multiple tabs. Either is friction;
neither scales.

This feature gives shop owners a conversational way to query their
own shop's data. The How-To Assistant explains *how to use the
software*; this assistant explains *what your business is doing*.

---

## 2. Scope — what's in and what's not

**In scope (v1):**
- A small, fixed set of business-data questions the assistant can
  answer about the requesting shop's own data: revenue, bookings,
  top customers, top services, conversion, RCN flow.
- Each question maps to a curated, parameter-typed backend query
  (the "tool" in tool-use terms — see Section 4).
- Plain-English summary + structured payload (numbers, lists, maybe a
  small inline chart) returned to the panel.
- Shop-scoped: the assistant can ONLY see the requesting shop's own
  data. Cross-shop queries are blocked at the query layer, not just
  the prompt.

**Out of scope (v1, but worth flagging):**
- Free-form NL→SQL — see Section 4 for why we're rejecting this for
  v1.
- Admin platform-wide Q&A ("which shops are growing fastest?") —
  fast-follow.
- Anomaly alerts / proactive notifications ("revenue dropped 30%
  vs last week") — separate feature.
- Forecasting / "what if" projections.
- Cross-shop competitive comparisons.
- Writing operations — the assistant only reads. No "discount all my
  services 10%" or similar.
- Visualizations beyond very simple inline tables / sparklines.

---

## 3. What already exists (reusable)

- `AnthropicClient` — Claude calls with tool-use support already
  wired (used by `AgentOrchestrator`).
- `SpendCapEnforcer` — per-shop monthly USD cap.
- The audit table pattern (`ai_help_messages`, `ai_agent_messages`).
- `MetricsAggregator` (Impact Metrics) — already computes some
  business metrics (conversations, bookings, revenue, customers
  recovered). Several of its SQL queries are reusable as tool
  implementations.
- The shop dashboard's right-side action cluster — has room for a
  second "Ask" launcher OR a tab inside the existing Help panel.
- Service order / customer / transaction repositories.

---

## 4. The core design problem — how does Claude reach the data?

This is the single biggest decision. Three patterns:

| Pattern | What it is | Verdict |
|---|---|---|
| **A. Tool-use with pre-defined query functions** | Claude has a typed toolkit (`getRevenueByDateRange`, `getTopCustomersByRcn`, etc.). Each tool is a backend function with parameter validation + hardcoded shop-scoping. Claude picks the right tool for the question and supplies typed args. | **Recommended for v1.** |
| B. Read-only NL→SQL with sanitization | Claude writes a SQL query; backend validates (SELECT-only, allowed views, mandatory `WHERE shop_id = $myShopId`). | **Reject for v1.** Too risky: NL→SQL is brittle, easy to leak cross-shop data, can return confidently-wrong answers from a misinterpreted join, can run expensive queries. |
| C. Pre-computed daily summaries | Backend computes summary stats nightly; Claude formats them into prose. | Limited — can't answer ad-hoc questions or pick custom date ranges. Worth keeping as a fallback layer below A, not a replacement. |

**Why A wins for v1:**
- **Safe by construction**: SQL is hand-written, shop-scoping is in the
  function not the prompt, parameter types are enforced.
- **Auditable**: every question maps to a known query; we can review
  cost + correctness per tool.
- **Predictable cost**: queries don't fan out unexpectedly.
- **Builds on existing Anthropic SDK tool-use** that the orchestrator
  already exercises.
- **Limited by design**: the assistant can ONLY answer questions the
  tools support. That's a feature — it stops Claude from
  hallucinating numbers.

The tradeoff: adding a new question type = adding a new tool. That's
real engineering work per new question. v1 ships with a small set;
later we expand.

---

## 5. v1 toolkit (proposed starter set)

Each tool is a backend function with strict typed args, hardcoded
shop-scoping, and a single SQL query (or a small set of joined ones).
Claude picks among them based on the question.

| Tool | Question shape | Notes |
|---|---|---|
| `revenue_summary({ range, compare? })` | "How much did I earn last week?" "Compare this month to last month." | Sum of paid+completed `service_orders.total_amount` in range; optional comparison window. |
| `top_customers({ range, by, limit })` | "Top 5 customers by RCN earned this quarter." | `by` ∈ `rcn_earned | spend | order_count`. |
| `top_services({ range, by, limit })` | "Which services made the most revenue last month?" | `by` ∈ `revenue | bookings | conversion`. |
| `bookings_breakdown({ range })` | "How many bookings did I have this week, broken down by status?" | Counts per `service_orders.status`. |
| `cancellation_breakdown({ range })` | "Why are bookings cancelling?" | Status counts for `cancelled | no_show | expired`; reason flags if available. |
| `customer_tier_distribution()` | "How many of my customers are Gold tier?" | Counts per Bronze/Silver/Gold; reuses customer-domain logic. |
| `rcn_balance_summary()` | "What's my RCN treasury?" | Total purchased − total issued; current available; monthly burn. |
| `ai_assistant_impact({ range })` | "How is my AI sales assistant doing?" | Reuses the Impact Metrics aggregator. |

8 tools covers the most common shop-owner ask patterns observed in
the Impact Metrics scope review. Easy to add more later.

---

## 6. Design decisions

| # | Decision | Recommendation |
|---|---|---|
| A | Data-access pattern | **A — tool-use** (see Section 4). |
| B | Audience | **Shop only for v1.** Admin platform Q&A is a fast-follow. |
| C | Surface | **New launcher in the action cluster** (icon: chart / sparkline), separate Sheet from the How-To Assistant. Mixing how-to + data Q&A into one panel confuses the answer model and the user. |
| D | Conversation shape | Multi-turn (follow-ups like "what about this month?" are natural). Same `sessionId` discipline as the help assistant. |
| E | Output shape | Claude returns prose + a structured payload (numbers/list/sparkline). Frontend renders a "data card" inline in the chat. |
| F | Charts | Inline sparkline + simple bar/list for v1. No interactive charts (defer to a dedicated reports page). |
| G | Audit table | New `ai_insights_messages` table (separate from help + sales agent); columns mirror `ai_help_messages` plus a `tool_calls` jsonb column capturing which tools Claude invoked + args. |
| H | Spend cap | Share with the AI Sales Agent / How-To Assistant monthly budget for v1; revisit after the first month if insights drives material spend. |
| I | Model | **Sonnet, not Haiku.** Tool-use + structured reasoning benefits from the stronger model. Cost stays bounded by short tool-call payloads + short final replies. |
| J | Cross-shop guard | Shop-scoping happens in the TOOL implementations (every SQL adds `WHERE shop_id = $shopFromJwt`), never via the prompt. Claude cannot see another shop's data even if it asks. |
| K | "I can't answer that" copy | If no tool matches, Claude declines with a fixed line ("I can answer questions about your shop's revenue, bookings, customers, and services. For other questions, try the **Help** assistant.") |

---

## 7. Open questions for review

1. **Launcher placement** — separate icon in the action cluster
   (recommended), or a tab inside the existing Help panel?
2. **v1 tool list** — Section 5 proposes 8 tools. Worth ranking which
   3–5 are the most important to ship; we can defer the rest.
3. **Chart rendering** — v1 ships text + simple inline tables. When
   should we invest in real charts (Recharts / Visx)?
4. **"What about last month?" follow-ups** — does the frontend
   maintain the last-asked time range in the session for the
   follow-up to pick up automatically?
5. **Read-only NL→SQL** — confirm we're parking this for v1. Some
   product teams want it as a fallback for "unmatched" questions.
   v1 recommendation: skip; let those questions decline politely.
6. **Cost ceiling** — Sonnet + tool-use can be 5–10× Haiku's cost
   per turn. Decide on a per-shop daily soft-cap for insights so a
   chatty shop can't burn the monthly budget in an afternoon.
7. **Admin audience scope** — if/when admin Q&A ships, does it need
   a separate toolkit (`admin_top_shops_by_revenue`, etc.) or
   parameterized versions of the shop tools?

---

## 8. Work breakdown (rough — phases will get sharper in the impl doc)

### Phase 1 — Audit table + tool framework
- Migration: `ai_insights_messages` table.
- `BusinessInsightsTool` interface: `{ name, description, inputSchema, execute(shopId, args) }`.
- Tool registry + tool-dispatch helper.

### Phase 2 — Implement the v1 tools
- One tool per Section 5 entry. Each tool: typed args, shop-scoped
  SQL, structured return.

### Phase 3 — Controller + endpoint
- `POST /api/ai/insights` — same shape as `/api/ai/help` but model =
  Sonnet, tools enabled. Spend-cap-gated, audit-logged.
- System prompt: explain the assistant's purpose, the available
  tools (Claude reads tool descriptions), the decline copy, and the
  shop-scoping invariant.

### Phase 4 — Frontend launcher + panel
- New launcher icon (chart) in the action cluster.
- Insights panel — similar to the Help panel but renders tool-call
  output (numbers, tables, sparklines) inline.
- Multi-turn with sessionId.

### Phase 5 — Tests + polish
- Per-tool unit tests (shop-scoping is the critical invariant —
  every test passes a different `shopId` and asserts the SQL never
  reads another shop's row).
- Manual QA per starter question.
- Cost audit after first week of staging.

---

## 9. Rough effort

**~7–10 developer-days** total (significantly more than the How-To
Assistant since this involves real query work):

- Phase 1 (audit table + tool framework): ~1 day.
- Phase 2 (8 tools, each with SQL + tests): ~3–4 days.
- Phase 3 (controller + endpoint + prompt): ~1 day.
- Phase 4 (frontend panel + chart rendering): ~2 days.
- Phase 5 (tests + polish + cost review): ~1–2 days.

**Hidden cost**: getting tool descriptions tight enough that Claude
picks the right one consistently. Tool descriptions live in the
prompt context, so each one is a tradeoff between clarity and
prompt-size. Plan a focused tuning pass during Phase 5.

---

## 10. Relationship to other docs

- **Companion to** `how-to-assistant/` — this is the *data Q&A* half
  of Square AI; that one was the *how-to* half. They are separate
  features with separate audiences-of-thought (how-to is product
  help; insights is business intelligence). Distinct panels.
- **Reuses parts of** `ai-sales-agent-impact-metrics/` — several of
  the Section 5 tools wrap or extend `MetricsAggregator` SQL.
- **Companion to but distinct from** Reports tabs in the dashboard
  — those are fixed views; this is conversational ad-hoc Q&A.
