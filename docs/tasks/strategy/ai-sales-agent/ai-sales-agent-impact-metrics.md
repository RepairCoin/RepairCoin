# Task Scope — AI Sales Agent Impact Metrics

**Status:** Scoping — not started.
**Folder:** `docs/tasks/strategy/ai-sales-agent/`
**Created:** 2026-05-20
**Origin:** Executive forwarded message (sc1.png + sc2.png, 2026-05-19 23:52)
proposing "two missing sections" on the shop-side AI settings panel —
*Real Savings/Revenue* and *AI Performance*. Framed as **ideas, not
directives** ("Ideas. Only.").
**Audience of the feature:** shop owners (primary). Admin platform-wide
roll-up is a fast-follow.

---

## 1. Problem

The shop-side AI Sales Agent settings panel we just shipped is all
**configuration** — master toggle, tone, upsell + booking switches, FAQ
editor, spend indicator. It shows nothing about *what the AI is actually
doing for this shop's business*. From the exec's note:

> "Right now it shows: settings, controls. But not: business impact. You
> NEED metrics like AI conversations handled, bookings generated, revenue
> generated… THAT is what makes businesses addicted."

A shop owner has no answer to *"is this AI worth $500/mo to me?"* — the
single biggest retention question. Adding impact metrics on the same page
makes the AI feel like an **employee** (the exec's words: *"turns the AI
from 'feature' into 'employee'"*), not a configurable toy.

---

## 2. Scope — what's in and what's not

Combine the exec's #1 and #2 into a **single Impact Metrics module** on the
shop AI settings page, grouped visually into two cards. Mechanically they
share one data pipeline:

| Card | What's in it |
|---|---|
| **Business Impact** (#1 — "Savings / Revenue") | AI conversations handled · Bookings generated · Revenue generated (from AI bookings) · Customers recovered (from follow-up nudges) · Response time saved |
| **AI Performance** (#2 — operational) | Conversion rate (bookings / AI conversations) · Avg response time · Bookings created · Upsells suggested · Missed leads recovered |

**In scope:**
- A backend metrics endpoint that aggregates per-shop AI metrics over a
  selectable time range.
- A new "Impact" section on the shop AI settings page with two cards.
- A time-range picker (7d / 30d / 90d / all-time).
- An empty state when the shop has no AI traffic yet.

**Out of scope:**
- Exec #3 ("AI Personality presets" — expanded tone library) — its own
  small task when prioritized.
- Exec #4 ("AI Status Live" — green/yellow/red badge) — its own small
  task; visual only, mostly independent of this metrics work.
- Admin platform-wide roll-up of these metrics — separate fast-follow once
  the shop view ships and we know the metric definitions are right.
- Exporting metrics (CSV) — defer.
- Per-service or per-customer drilldown — defer.

---

## 3. What already exists (reusable)

- **`ai_agent_messages`** audit table — every AI turn is logged (model,
  tokens, latency, timestamps). The base for: conversations handled, AI
  message count, response time, model mix.
- **`service_orders.conversation_id`** (migration 115) — set on orders
  that originated from an AI conversation. The base for: bookings
  generated, revenue generated, conversion rate.
- **`AISalesFollowUpHandler`** + `ai_followup_settings` (migration 116) —
  follow-up nudges are audit-logged. The base for: customers recovered /
  missed leads recovered (join "follow-up nudge sent" → next booking by
  the same customer within window).
- **`SpendCapEnforcer`** — daily AI spend is already tracked; we could
  surface "AI cost this month vs revenue generated" as a stretch metric.
- **Shop AI settings page** (`AISalesAgentSettings.tsx`) — the surface to
  add the new section to. Already a card-based layout; an Impact card
  pair slots in cleanly above the configuration controls.

**Gaps** (what doesn't exist and would need new instrumentation):
- **Upsells suggested** — the prompt is *capable* of suggesting upsells
  (`aiSuggestUpsells` toggle), but **we do not record per-turn whether the
  AI actually proposed an upsell**. Needs a lightweight tag at the AI
  response layer (e.g. a `tags: ['upsell_suggested']` field on
  `ai_agent_messages`, or a separate `ai_agent_signals` table).
- **Response time saved** — a counterfactual; needs an assumed human
  baseline (e.g., "shops typically reply in 4–8 hours during business
  hours"). Recommend a configurable default constant, clearly labeled
  *"estimated"* in the UI.

---

## 4. Metric definitions (v1)

Per exec direction (Section 6): shop-facing labels are plain-English and
owner-perspective ("Revenue you didn't have to chase", not "Revenue
generated"). Internal metric names are kept for code and SQL. Final copy
gets a review pass with the exec before ship.

| Internal name | Shop-facing label (draft) | Card | Source | Definition |
|---|---|---|---|---|
| `ai_conversations` | Conversations your AI handled | Business Impact | `ai_agent_messages` | Distinct conversations where the AI sent ≥1 message in the window. |
| `bookings_generated` | Bookings your AI booked | Business Impact | `service_orders` JOIN conversation | `service_orders.conversation_id IS NOT NULL` AND status ∈ (paid, completed) in window. |
| `revenue_generated` | Revenue you didn't have to chase | Business Impact | `service_orders` JOIN conversation | Sum of `total_cents` for AI-originated orders. **USD only.** |
| `customers_recovered` | Customers your AI brought back | Business Impact | follow-up audit + bookings | Customers who got a follow-up nudge AND booked within N days after. (Single metric — "Missed leads recovered" was collapsed into this per exec.) |
| `response_time_saved` | Time your AI saved you | Business Impact | `ai_agent_messages` + per-shop baseline | `(shop_configured_human_baseline − ai_avg_response) × distinct AI conversations`, displayed as hours. **Always labeled "estimated"** with the configured baseline shown ("vs. your 4h baseline"). **Per-conversation, not per-message** — the per-message formula compounded into unrealistic claims on chatty conversations (revised 2026-05-20 during QA). When zero successful AI replies exist, returns 0 regardless of conversation count. |
| `conversion_rate` | Chat-to-booking rate | Performance | derived | `bookings_generated / ai_conversations`. |
| `avg_response_time` | Average reply speed | Performance | `ai_agent_messages` | Mean `(response_ts − inbound_ts)` per AI reply. |
| `bookings_created` | Bookings the AI booked | Performance | same data as `bookings_generated` | Surfaced on both cards — Business Impact frames it as revenue outcome, Performance frames it as throughput. |

**Deferred to v2** (per exec): `upsells_suggested` — needs new per-turn
instrumentation; not worth the lift for v1.

---

## 5. Design decisions

| # | Decision | Recommendation |
|---|---|---|
| A | One section or two cards | **Two cards** (Business Impact + AI Performance), one section, one fetch. Matches the exec's framing while keeping the data pipeline single. |
| B | Where it lives | New "Impact" section at the **top** of `AISalesAgentSettings.tsx`, above the configuration cards. Lead with outcome, then settings. |
| C | Time range | 7 / 30 / 90 / all-time selector, defaults to **30d**. |
| D | Empty state | Friendly empty card — *"No AI traffic yet — turn the AI on for a service to start tracking"* — until the shop has ≥1 AI conversation. |
| E | "Response time saved" honesty | Always label as *estimated*; the human-reply baseline is **per-shop configurable** (per exec), shown alongside the number (e.g., "vs. your 4h baseline"). Default 4h. |
| F | "Customers recovered" vs "Missed leads recovered" | **Collapsed to a single metric — "Customers your AI brought back"** (per exec). The duplicate framing is dropped. |
| G | "Upsells suggested" instrumentation | **Deferred to v2** (per exec). No new tracking columns or prompt tagging in v1. The `tags TEXT[]` approach on `ai_agent_messages` is the recommended shape when v2 is picked up. |
| H | Admin roll-up | Out of scope for v1; revisit after shop view ships and metric definitions are validated. |
| I | Low-sample display threshold | Metrics are only shown when **N ≥ threshold** (per exec — avoid noisy percentages). Recommend N ≥ 5 conversations for the selected window; below that, render the empty state with a "still collecting data" message. |

---

## 6. Resolved decisions (exec, 2026-05-20)

1. **Metric labels → shop-owner-perspective copy.** Plain-English,
   action-oriented framing (e.g., "Revenue you didn't have to chase" not
   "Revenue generated"). Draft labels are in Section 4's table; final
   copy reviewed with the exec before ship.
2. **Currency → USD only** for v1. No RCN-equivalent display.
3. **"Customers recovered" + "Missed leads recovered" → collapsed** into a
   single metric ("Customers your AI brought back"). Avoids double-counting
   in the shop owner's head.
4. **"Response time saved" baseline → per-shop configurable.** Each shop
   sets their own human-reply baseline (default 4h). Displayed value is
   always labeled "estimated" with the configured baseline visible.
5. **Upsells suggested → deferred to v2.** No new tracking columns or
   prompt tagging in v1. Revisit when v2 is prioritized.
6. **Low-sample threshold → show metrics only when N ≥ threshold.** Below
   the threshold, render the empty state instead of noisy percentages.
   Recommend N ≥ 5 conversations for the selected window.

---

## 7. Work breakdown

### Phase 1 — Setup + per-shop baseline config
- Section 4 metric definitions are finalized (Section 6 resolutions
  applied). Section 4 owns the contract from here on.
- Add a per-shop human-reply baseline: extend `ai_shop_settings` with
  `human_reply_baseline_minutes` (default 240 = 4h). Surface it as a
  small control on the existing AI settings panel.
- Define a shared `MIN_SAMPLE_N = 5` constant (used by the metrics
  endpoint and the empty-state UI) so the threshold is one source of
  truth.
- **No upsell instrumentation in v1** — deferred per exec.

### Phase 2 — Backend: metrics endpoint
- New `GET /api/ai/metrics?range=30d` (shop-role) in `AIAgentDomain`.
- One SQL query per card, or one combined aggregate — measure latency
  and pick. Cache for ~60s per (shop, range) to be safe under reloads.
- Unit tests for the SQL (the math is the risky part).

### Phase 3 — Frontend: Impact section
- `AISalesImpactCard.tsx` — two-card layout (Business Impact + AI
  Performance) with a time-range pill selector and an empty state.
- Wire to a new `getAiMetrics(range)` service.
- Loading skeletons, error state.
- Place at top of `AISalesAgentSettings.tsx`.

### Phase 4 — Tests + polish
- Jest tests for the metrics aggregator.
- Manual QA: a shop with healthy traffic, a brand-new shop (empty state),
  a shop in the awkward middle (low N).
- Copy review with the exec before shipping ("does this feel like the
  numbers shops want to see?").

---

## 8. Effort

Engineering: **~4–5 developer-days** (down from 5–7 — deferring upsell
tracking to v2 saves ~1 day).
- Backend baseline-config + metrics endpoint + SQL: 2 days.
- Frontend Impact section + threshold-aware empty state: 1–2 days.
- Tests + polish + copy review with the exec: 1 day.

**Hidden cost:** getting the metric *definitions* right matters more than
the engineering — if "Customers recovered" double-counts or "Revenue
generated" includes refunds, the dashboard loses shop owner trust fast.
Allocate review time with the exec / a real shop before shipping.

---

## 9. Relationship to other docs

- **Companion to** `shop-ai-settings-ui.md` — that doc shipped the
  configuration panel; this adds the impact layer on the same page.
- **Distinct from** the customer-side AI Sales Agent docs — this is
  shop-owner-facing reporting on what the AI did, not a change to what
  the AI says.
- **Exec #3 (AI Personality presets)** and **#4 (AI Status Live)** are
  separate, smaller scope docs — to be written if/when prioritized.
