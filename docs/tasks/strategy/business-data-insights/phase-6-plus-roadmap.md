# Phase 6+ Roadmap — Closing to Square AI

**Status:** Strategy doc, not started.
**Companion to:** `business-data-insights-scope.md`,
`business-data-insights-implementation.md`,
`qa-test-guide.md`.
**Created:** 2026-05-21 (after Phase 5 close-out).
**Audience:** decision-maker. Pick a Phase 6, defer or kill the rest.

---

## 0. How to read this doc

Skim Section 2 (ranked table). Pick a Phase 6. The rest of the doc is
the *why* behind the ranking — read only the rows you're considering.
Section 7 lists the questions you need to answer before picking.

This doc deliberately doesn't choose for you. Each item has:
- **What it is** — one-line product description.
- **Why it matters** — the shop-owner value, not the feature-completeness.
- **Effort** — developer-days. Conservative.
- **Dependencies** — what needs to exist first.
- **Risk** — what could go wrong, what we'd miss-build.
- **ROI band** — high / medium / low — based on value-per-day.

---

## 1. Strategic frame

**Two games we could play:**

| Game | What it looks like | Cost ceiling |
|---|---|---|
| **A. Match Square AI feature-for-feature** | Tools, charts, voice, anomalies, forecasts, benchmarks — chase parity. | Months. Multiple engineers. |
| **B. Match the *value* Square AI delivers** | Prioritize the 20% that gives RepairCoin shop owners 80% of the intelligence-layer benefit. Skip features they wouldn't use here. | Weeks. One engineer. |

We're playing **game B**. RepairCoin is a repair-shop loyalty platform — shop owners care about *their* customers, *their* revenue, *their* AI agent's impact. We don't need parity with Square's retail-POS feature set; we need the conversational shop-data assistant to feel competent and trustworthy.

**Strategic anchor:** the Phase 2 tool template is reusable. Adding a new tool is ~1/2 day of work. **The cheapest, highest-value Phase 6 is more tools, not more features.**

---

## 2. Ranked roadmap (the table to read)

Ranked by ROI = `value × probability-it-actually-helps ÷ effort`.

| Rank | Item | Effort | ROI | Phase |
|---|---|---|---|---|
| 1 | **5 more tools** (cancellation, tier dist, time-of-day, repeat customers, rcn balance) | 3d | High | 6 |
| 2 | **Calendar-aligned ranges** (`this_month` / `last_month` / `this_week`) | ½d | High | 6 |
| 3 | **AI-suggested follow-up chips** after each answer | 2d | High | 6 |
| 4 | **Real chart variant** (`chart` ToolDisplay kind via Recharts) | 1-2d | Med-High | 6 or 7 |
| 5 | **Per-shop daily cost ceiling** + soft-warning UI | 1d | Med-High | 6 |
| 6 | **Comparison display variant** (current vs prior side-by-side numbers) | 1d | Medium | 7 |
| 7 | **Saved queries** (pin a question; one-tap re-run) | 2d | Medium | 7 |
| 8 | **Anomaly detection** (nightly job → in-panel banner) | 4-5d | Med-High | 7 |
| 9 | **Voice input** (Web Speech API, no Whisper for v1) | 2d | Medium | 7 |
| 10 | **Forecasting** (linear regression with uncertainty bands) | 5-7d | Med | 8 |
| 11 | **Admin platform-wide Q&A** (separate toolkit) | 5d | Med | 8 |
| 12 | **Weekly digest email** (auto-generated business summary) | 4d | Med | 8 |
| 13 | **Mobile-optimized panel** (full-screen, thumb-anchored) | 3d | Med | 8 |
| 14 | **Date-range picker UI** (exact start/end dates) | 2d | Low-Med | 8 |
| 15 | **Calendar conversation history** (cross-session persistence) | 4d | Low-Med | Backlog |
| 16 | **Benchmark vs other shops** (anonymized cohort comparison) | 8-12d | High (if data exists) | Strategic decision needed |
| 17 | **Multi-language support** | 3d | Low | Backlog |

**Recommended Phase 6 (this sprint, ~1 week):** items 1, 2, 3, 5 = ~6.5 days. Skips chart variant (#4) until we know whether the existing list/table displays are visually enough.

---

## 3. Phase 6 detail — recommended sprint

### 6.1 — Five more tools (3 days)

The single highest-ROI move. Each tool is the Phase 2 template:
typed args, hardcoded shop-scope, ToolDisplay return.

| Tool | Question shape | Display | Why it matters |
|---|---|---|---|
| `cancellation_breakdown({ range })` | "Why are bookings cancelling?" | list (status counts: cancelled / no_show / expired + reason text where present) | High value: shop owners obsess over no-shows. Already in scope-doc Phase 5 stretch list. |
| `customer_tier_distribution()` | "How many of my customers are Gold tier?" | list (Bronze/Silver/Gold counts) | Surfaces RCG token program effectiveness — uniquely RepairCoin. |
| `time_of_day_pattern({ range })` | "When are my busy hours?" | sparkline (24-bar bar-chart of hourly booking counts) | First sparkline-display use. Operational gold: shop owners can pick coverage hours. |
| `repeat_customer_analysis({ range })` | "How many of my customers are returning?" | number (% with 2+ bookings) + list (new vs returning split) | Loyalty signal — fits RepairCoin's positioning. |
| `rcn_balance_summary()` | "What's my RCN treasury?" | list (purchased / issued / available / monthly burn) | RepairCoin-unique. Phase 5 stretch item moved into Phase 6. |

**Risk:** the prompt may need a tuning pass after adding 5 new tool descriptions — Claude's tool-selection accuracy can degrade when descriptions overlap. Budget half a day for prompt-tuning at the end.

**Verification:** each tool gets a jest test (same mock-pool pattern as Phase 5.1) + a smoke script run against `peanut`. Adds ~15-20 jest assertions per tool, ~80-100 total.

### 6.2 — Calendar-aligned ranges (½ day)

Today's `range` enum is rolling: `7d / 30d / 90d / all`. Square defaults to calendar windows: "this month", "last month", "this quarter."

**Concrete change:** add `this_week | last_week | this_month | last_month | this_quarter` to the enum. Compute windowStart() with `dayjs().startOf('month')` etc. Update prompt rule 5 so Claude maps "this month" → `this_month`, not `30d`.

**Why ½ day:** one helper function + enum addition + prompt update + jest test additions. Window math is well-trodden.

**Decision needed:** keep rolling or replace? Recommendation: **keep both, add calendar ones**. Some questions ("last 7 days") are naturally rolling; others ("this month") are naturally calendar. Let the user phrase either way.

### 6.3 — AI-suggested follow-up chips (2 days)

After each assistant reply, show 2-3 tap-able chips like:
> [ Last 7 days ]   [ Top services ]   [ Compare to last month ]

Each chip submits a pre-composed follow-up question. Claude generates them via a sibling tool call (`suggest_followups({ context: 'just answered top customers' })`).

**Why it matters:** Square does this. It's the difference between "I asked one question" and "I explored my data." Each chip is a guided next-step that reduces typing friction and surfaces what the assistant can do.

**Risk:** chips that go nowhere ("why did this customer book?") are worse than no chips — they make the assistant feel like it can do more than it can. Tool descriptions need a "questions that are answerable" filter built in.

**Implementation:**
- Backend: new `suggest_followups` tool returns `{ kind: 'follow_ups', items: string[] }` — Claude returns 2-3 short questions it could answer next given the prior turn.
- Frontend: new ToolDisplay variant `follow_ups`. Renders as chips below the data card. Tapping submits the question text.

### 6.4 — Real chart variant (1-2 days) — *defer to Phase 7 unless complaints*

`ToolDisplay.kind: 'chart'` rendered via Recharts. Current sparkline handles single-series mini-trends; a real chart variant unlocks:
- Stacked bar (bookings status by week)
- Multi-line (revenue this month vs last month)
- Pie (tier distribution)

**Why defer:** adds ~50KB to the frontend bundle for one variant. Today's list/table/sparkline covers the v1 questions adequately. Wait until shop owners actually ask for visualizations before paying the bundle cost.

**Re-evaluate trigger:** when a Phase 6 tool's display obviously needs more than list/table (e.g., `time_of_day_pattern` — the sparkline already covers it, so maybe never).

### 6.5 — Per-shop daily cost ceiling (1 day)

**Today:** SpendCapEnforcer enforces a *monthly* per-shop budget. A chatty session on day 1 could consume the whole month.

**Fix:** soft per-day cap (e.g., 1/15th of the monthly budget). When exceeded, the panel shows a banner: "you've hit today's soft limit — try again tomorrow or contact support for an extension." Still allows the call through; just nags the user.

**Why now:** the 30-message cap (recently bumped) plus Sonnet's tool-use pricing means a single session can run ~$0.50. At a 100-shop scale that's $50/day if a few shops chat a lot.

**Implementation:** add `ai_shop_settings.daily_soft_cap_usd` column (migration), check in SpendCapEnforcer, surface via a new `softCapWarning` field in the 200 response that the panel renders as a yellow banner.

---

## 4. Phase 7 candidates — month-2 work

Anything in the Phase 7 column of the ranked table. Highlights:

### Anomaly detection (4-5 days)

Nightly cron job that scans `service_orders` + `transactions` for each shop, flags week-over-week metrics that moved > 2σ (configurable). Flags surfaced as a **banner at the top of the Insights panel** ("you had 3× more no-shows this week than usual") so the shop owner sees it on next panel-open without asking.

**Cost:** Postgres-side analytics queries (already used by MetricsAggregator pattern). No new infra. Cron job goes in the existing scheduler.

**Risk:** too many false positives = users tune out. Start conservative — only surface anomalies > 3σ; add toggle to dismiss.

### Comparison display variant (1 day)

When `compare='prior'` is set on a tool, render the data card as a side-by-side comparison instead of plain numbers. Useful for `revenue_summary` + future `cancellation_breakdown`.

### Saved queries (2 days)

"Pin this question" button on each card. Pinned queries live in a separate tab in the panel; tap to re-run. Surfaces what the shop owner cares about most over time. Persistence: new `ai_insights_pinned_queries` table keyed by shop.

### Voice input (2 days)

Web Speech API for input (no Whisper for v1 — browser-native is good enough). Tap a mic icon, dictate the question, edit before sending. Free on Chrome/Safari; degrades to text-only on Firefox.

**Skip:** voice OUTPUT (text-to-speech of the reply). Adds complexity, marginal value — shop owners read replies, they don't listen to them.

---

## 5. Phase 8 / strategic items

### Forecasting (5-7 days)

Linear regression + simple uncertainty bands on revenue/bookings series. New tool `forecast({ metric, range })`. Returns trend slope + 90% confidence interval for the next equivalent window.

**Why later:** sample sizes at most shops are small (peanut has 108 orders over 5 months — barely enough for a linear fit). Forecasts on small data are confidently wrong, which is worse than no forecast. **Don't ship until below-threshold safeguards are bulletproof.**

### Admin platform-wide Q&A (5 days)

Separate toolkit for admins: `admin_top_shops_by_revenue`, `admin_active_shops_count`, `admin_platform_rcn_flow`. Different prompt builder (`AdminInsightsPromptBuilder`), different controller, different audit table (or use `ai_insights_messages` with an `audience` discriminator column).

**Already in scope-doc as fast-follow.** Worth picking up if/when admins start asking platform-wide questions.

### Weekly digest email (4 days)

Cron job runs each shop's `ai_assistant_impact` + `revenue_summary` + `top_services` tools once a week, formats into an email, sends. **Highest-leverage feature in this list** if it drives shop-owner engagement.

**Decision needed:** opt-in or default-on? Default-on with one-click unsubscribe is the move that drives engagement; opt-in is the move that protects deliverability scores. Recommendation: opt-in for v1, default-on after we trust the digest quality.

### Mobile-optimized panel (3 days)

The current Sheet works on mobile but isn't designed for it. Convert to a full-screen modal on small viewports; bigger touch targets; bottom-anchored input. Square AI is mobile-first; we're desktop-first.

**Decision needed:** how much of the shop-owner audience is actually on mobile? If <20%, defer indefinitely.

### Benchmark vs other shops (8-12 days)

The big one. Anonymized cohort comparison: "your conversion rate is 12% — shops your size average 18%." Requires:
- A daily aggregation job building `shop_metrics_anonymized` summary table.
- Cohort definitions (by RCG tier, by shop size, by category).
- A new tool `benchmark_vs_cohort({ metric })`.
- Privacy review (could a shop infer another shop's data from aggregates?).

**Strategic decision needed before building.** This isn't a feature, it's a product positioning move — "RepairCoin shows you where you stand in the RCG cohort." Differentiating, but commits us to maintaining the aggregation pipeline forever.

---

## 6. What we're NOT doing (out of scope)

These came up in the gap analysis but don't make the roadmap:

- **NL→SQL fallback** — fundamentally unsafe; rejected in scope-doc Section 4.
- **Multi-location aggregation** — RepairCoin has no multi-location concept.
- **Inventory queries** — no inventory.
- **Marketing-attribution ROI** — no marketing-attribution data.
- **Real-time updates** — every call is a fresh query; live-updating cards adds complexity for no clear value.
- **Writing operations** — assistant is read-only by design.
- **Multi-language UI** — backlogged at #17 but realistically a v2 problem.
- **Conversation history across sessions** — at #15 in the ranking. May never happen — fresh sessions match the "ask, get answer, move on" pattern.

---

## 7. Decisions needed before Phase 6 starts

1. **Phase 6 scope: 5 tools + range fix + suggested follow-ups + cost cap?**
   ETA ~6.5 days. Or trim to just the 5 tools (3 days) and ship faster?

2. **Calendar ranges: add alongside rolling, or replace?**
   Recommendation: add alongside. Rolling has real use cases ("rolling 30-day NPS").

3. **Suggested follow-ups: ship in Phase 6 or wait?**
   Risk: dead chips feel worse than no chips. Want to ship if we trust the tool descriptions; defer if not.

4. **`rcn_balance_summary` priority: in Phase 6 or kill it?**
   Was in scope-doc but de-scoped during planning. Unique to RepairCoin — re-add or skip?

5. **Anomaly detection (Phase 7): yes/no?**
   The first "intelligence layer" feature. Differentiating vs a pure Q&A bot. Commit now or wait for the Phase 6 ship to land first?

6. **Benchmark vs cohort (Phase 8): build the data pipeline?**
   Biggest strategic call in this doc. Differentiating but expensive. Defer until we have more shops on the platform?

7. **Weekly digest email: opt-in or opt-out?**
   Engagement vs deliverability tradeoff. Default to opt-in for v1?

---

## 8. Suggested next action

If you trust the ranking, **start Phase 6 with the 5-tool sprint** — items 1, 2, 3, 5 of the table. ~6.5 days, immediately closes the breadth gap, and the existing Phase 2 template plus Phase 5 jest infrastructure absorb new tools with near-zero rework.

If you want to be more conservative, **just ship the 5 tools (item 1, 3 days)** and re-evaluate after seeing them in the wild for a week.

If you want to gamble on the intelligence layer, **skip ahead to anomaly detection (item 8, 4-5 days)** — it's the move that most distinguishes us from a pure Q&A bot. Higher risk (false-positive noise) but higher ceiling.

Which lane?
