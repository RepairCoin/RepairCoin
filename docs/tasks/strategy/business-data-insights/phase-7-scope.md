# Task Scope — Phase 7: Intelligence Layer

**Status:** Scoping — not started.
**Folder:** `docs/tasks/strategy/business-data-insights/`
**Created:** 2026-05-22 (post-Phase-6.3 merge).
**Companion docs:**
- `business-data-insights-scope.md` — original v1 scoping.
- `business-data-insights-implementation.md` — Phases 1-6 implementation
  + per-task checkpoints (1.1 through 6.3.4).
- `phase-6-plus-roadmap.md` — ranked gap-closers to Square AI; Phase 7
  items live in rows 6-12 of that table.
- `qa-test-guide.md` — manual browser-QA matrix.

---

## 1. Problem

After Phase 6 we have a **breadth-complete** insights assistant —
11 tools, calendar + rolling ranges, tap-able exploration chips,
honest sample-size warnings. Shop owners can ASK any business
question and get an answer.

What we **don't** have is the *intelligence layer*: the assistant
never volunteers anything. The shop owner has to know what to ask.
A no-show spike from 3 → 12 in a week sits in the data unseen until
someone manually checks `bookings_breakdown`. Square AI's
differentiator over a chat-wrapped SQL tool is that it **brings
patterns to the user without being asked**.

Phase 7 closes that gap.

---

## 2. Scope — what's in and what's not

**In scope (recommended Phase 7 — ~7-8 days):**

- **Anomaly detection** — nightly job scans each shop's recent
  metrics, flags week-over-week movements > 2σ (or configurable),
  surfaces the most relevant 1-3 in a top-of-panel banner the
  shop owner sees on next panel-open. Includes a "dismiss" /
  "tell me more" affordance per anomaly.
- **Comparison display variant** — new `ToolDisplay.kind:
  "comparison"` rendering current-vs-prior side-by-side numbers
  with a delta indicator. Supports `revenue_summary({compare:
  "prior"})` better than the current `list` variant AND
  natively serves the anomaly banner ("no-shows this week
  vs last week: 12 vs 3, ↑300%").
- **Saved queries** — "pin this question" button on each card.
  Pinned queries live in a separate tab in the panel; tap to
  re-run. Persisted across sessions (new table). Surfaces what
  the shop owner cares about most over time.

**Stretch (only if anomaly detection lands cleanly + has time):**

- ~~**Voice input** — Web Speech API for input. ~2 days.~~ **SUPERSEDED 2026-05-28** by the platform-wide voice strategy at `docs/tasks/strategy/voice-ai-dispatcher/scope.md`. Voice input for Insights will land via Phase 5.5 of that workstream (per-panel inline mic, shared `<InlineVoiceMic />` component, Whisper-backed STT instead of Web Speech API). Do NOT build per-panel voice as part of Insights Phase 7.

**Out of scope (Phase 8 candidates):**

- Forecasting / "what if" projections — sample sizes at most
  shops too small for confident linear fits (peanut has 108
  orders over 5 months). Defer until anomaly detection's
  below-threshold safeguards are battle-tested.
- Cross-shop / cohort benchmarks — needs a daily aggregation
  pipeline + privacy review. Strategic decision, not a Phase 7
  pickup.
- Admin platform-wide Q&A — separate audience, separate toolkit,
  separate audit table discriminator. Reasonable Phase 8 work.
- Weekly digest email — high engagement potential but adds
  email-deliverability ops we don't have. Phase 8.
- Mobile-optimized panel — current Sheet works on mobile but
  isn't designed for thumb-anchored interaction. Phase 8.
- Real charts (Recharts integration) — bundle weight not
  justified until a tool actually demands it. Time-of-day
  sparkline covers the only v1 visualization use case.
- NL→SQL fallback — rejected in v1 scope doc, still rejected.
- Writing operations of any kind.

---

## 3. What already exists (reusable)

- **`MetricsAggregator`** — the existing analytics SQL with the
  Phase 6.1 `windowEnd` extension can compute "this week" and
  "last week" stats with the same query shape. Anomaly detection
  rides on this, not new SQL.
- **`ai_insights_messages`** audit table — already has the
  per-tool-call JSONB. Anomaly detection writes a separate
  table (`ai_insights_anomalies`) since the data isn't a
  request/response pair.
- **`SpendCapEnforcer`** — anomaly detection's nightly Claude
  calls (for natural-language phrasing of each anomaly) get the
  same per-shop monthly budget treatment.
- **Sheet + Dialog z-index ladder** from Phase 6.5 — banner UI
  sits in the existing slide-over.
- **`InsightsToolCallCard` variant pattern** — adding a
  `comparison` variant follows the same shape as the existing 5.
- **DigitalOcean App Platform cron support** — node-cron or
  the platform's scheduled-job feature; need to confirm which
  the project uses.

---

## 4. The core design problem — how does anomaly detection actually work?

This is the biggest unsolved question. Three patterns:

| Pattern | What it is | Verdict |
|---|---|---|
| **A. Statistical-only** | Nightly job runs N metrics × M shops, flags week-over-week deltas > 2σ. Banner shows raw delta. No AI in the loop. | Predictable + cheap, but feels mechanical. Misses *why*. |
| **B. Statistical + Claude phrasing** | Same nightly job, but each flagged anomaly gets a one-shot Claude call to phrase it ("Your no-shows tripled this week — last week 3, this week 12"). | **Recommended.** Adds the "feels human" layer without putting Claude in the loop for every anomaly. |
| **C. Claude-first** | Claude reads the raw metric series each night per shop and decides what's anomalous. | Cost too high (nightly Sonnet × every shop), unpredictable surfacing, no statistical floor. |

**Why B wins:**
- Statistical detection is the **safety floor** — even if Claude
  is wrong, the math is right.
- Claude phrasing is the **emotional layer** — shop owners hear
  "your no-shows tripled" instead of "no_show count delta:
  +9.0 (σ=2.31)".
- Cost is bounded — one Sonnet call per *flagged* anomaly, not
  per metric scan.
- Easy to audit: stat layer produces a deterministic flag list,
  Claude only adds phrasing.

---

## 5. v1 anomaly detection — which metrics?

Each Phase 6.2 tool maps to one or more *metric series* anomaly
detection can watch. Recommended starter set (highest signal):

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Weekly revenue | revenue_summary (this_week vs last_week) | ±30% delta OR > 2σ | Owners care first about money. |
| Weekly no-show count | bookings_breakdown | > 2× last week | No-shows hurt morale + revenue; spikes are actionable. |
| Weekly cancellation count | cancellation_breakdown | > 2× last week | Different signal from no-shows (customer choice vs absence). |
| Weekly AI conversation count | ai_assistant_impact | > 50% drop | If AI traffic drops something is broken upstream. |
| Weekly bookings | bookings_breakdown total | > 30% delta | The basic volume signal. |

5 metrics × 7 days running history = manageable storage + simple
queries. Adding more later is the Phase 2 template (add metric →
re-run nightly job).

---

## 6. Comparison display variant — why it ships in Phase 7

Phase 7's anomaly banners render `current vs prior + delta` —
that's exactly what the comparison variant is for. Building it
once and reusing in:
- Anomaly banner rendering
- `revenue_summary({compare: "prior"})` (currently uses `list`)
- Future Phase 8 forecasting (current vs forecast)

ROI multiplier from a 1-day investment.

---

## 7. Saved queries — why it ships in Phase 7

The "real-traffic to watch" list in Phase 6.3 included **which
questions shop owners actually ask**. Saved queries gives us
that data for free — anything pinned IS the question that
matters to that shop owner. Plus shop owners get a "morning
check-in" workflow ("open panel, hit my 3 pinned queries").

Light DB work — one new table (`ai_insights_pinned_queries`)
+ one new endpoint. Frontend gets a second tab in the panel.

---

## 8. Design decisions

| # | Decision | Recommendation |
|---|---|---|
| A | Anomaly detection pattern | **B — Statistical + Claude phrasing** (Section 4). |
| B | Anomaly storage | New `ai_insights_anomalies` table. Per-shop, per-metric, per-detection-run. Includes `dismissed_at` for shop-owner "got it" + `claude_phrasing` JSON. |
| C | Anomaly surface | Banner at top of Insights panel on next panel-open. Up to 3 anomalies shown, dismissable. Older un-dismissed anomalies expire after 14 days. |
| D | Anomaly spend-cap interaction | Claude phrasing calls share the shop's monthly AI budget. Each anomaly = one short Sonnet call (~$0.001). At 5 anomalies/shop/week max, cost is bounded. Skip phrasing for the month when budget is exhausted. |
| E | Comparison display shape | `{ kind: "comparison"; label: string; current: {value: string, sublabel?: string}; prior: {value: string, sublabel?: string}; delta: {value: string; direction: "up"\|"down"\|"flat"; magnitude?: "small"\|"medium"\|"large"} }`. Frontend renders side-by-side with a colored delta indicator. |
| F | Saved queries shape | `{ id, shop_id, question_text, pinned_at, last_run_at?, last_response_excerpt? }`. Pinning = just storing the question text; re-running = submitting via the existing chat pipeline. Display: second tab "Pinned" with a list view, tap-to-run, swipe-to-unpin. |
| G | Nightly job platform | Use whatever DigitalOcean App Platform offers OR fall back to `node-cron` in the existing backend process. **Decision needed** — let me know what's already wired. |
| H | Anomaly thresholds — per-shop configurable? | **No for v1.** Single global threshold per metric. Per-shop tuning lands in Phase 8 if needed (shop-side noise complaints). |
| I | Banner persistence | Stored anomalies survive across panel-opens until dismissed or expired. NOT stored in client state. |
| J | Voice input | ~~**Stretch only.** Land if anomaly detection ships under budget; otherwise defer to Phase 8.~~ **SUPERSEDED 2026-05-28** — voice input for Insights now lands via the platform-wide voice strategy (`docs/tasks/strategy/voice-ai-dispatcher/scope.md` Phase 5.5). Do NOT build per-panel voice in Insights Phase 7. |

---

## 9. Open questions for review

1. **Nightly job platform** — does the project already have a
   cron / scheduled job mechanism? Need to confirm before
   building. node-cron in the backend process works but adds
   risk (one job failure kills the whole API).
2. **Anomaly thresholds** — 2σ feels right but is arbitrary.
   Worth running a 1-week dry-run nightly (compute the flags,
   log them, don't show) to see what the real flag rate looks
   like on production data before going live.
3. **Banner real estate** — the Sheet is already 672-1024px
   wide depending on expand state. Where exactly does the
   banner go? Above the panel title? Above the input? Inside
   the chat area as a "first message"?
4. **Saved queries discoverability** — tab vs a "pin" affordance
   on every card? Recommendation: both (tap pin → adds to tab;
   tab is where the pinned queries are visible). Tradeoff:
   adds a small icon to every card.
5. **Anomaly metric expansion** — the 5 starter metrics are
   conservative. Worth shipping with all 5 OR cutting to 3
   (revenue + no-shows + cancellations) for v1 to keep the
   signal-to-noise ratio observable in the first week?
6. **Dismissal model** — soft dismiss (banner hidden but
   anomaly row stays) or hard (delete on dismiss)? Soft is
   safer for analytics; hard is what users expect from "dismiss
   forever" UI.
7. **Cost ceiling on Claude phrasing** — already gated by the
   monthly per-shop budget. Worth adding a per-day soft cap
   specifically for nightly phrasing calls (e.g. 10 phrasings
   per shop per day)?

---

## 10. Work breakdown (rough — sharpens in the impl doc)

### Phase 7.1 — Comparison display variant (~1 day)
- New ToolDisplay union variant.
- Frontend card renderer.
- Wire `revenue_summary({compare:"prior"})` to emit
  `comparison` instead of `list`.

### Phase 7.2 — Anomaly detection (~4-5 days)
- Migration: `ai_insights_anomalies` table.
- `AnomalyDetector` service — pure SQL aggregations, no Claude.
- Nightly cron / scheduled job to run the detector per shop.
- `AnomalyPhraser` service — one-shot Sonnet calls per flagged
  anomaly to phrase + write to the row's `claude_phrasing` column.
- `GET /api/ai/insights/anomalies` endpoint — returns
  un-dismissed anomalies for the requesting shop.
- `POST /api/ai/insights/anomalies/:id/dismiss` endpoint.
- Frontend banner component at top of the Insights panel.

### Phase 7.3 — Saved queries (~2 days)
- Migration: `ai_insights_pinned_queries` table.
- CRUD endpoints (`POST` to pin, `DELETE` to unpin, `GET` to list).
- "Pin" icon on every InsightsToolCallCard (number/table/list/
  sparkline — NOT on the `follow_ups` chip row).
- New "Pinned" tab in the panel (or expand the existing
  expand-toggle pattern into a tab switcher).

### Phase 7.4 — Stretch: voice input — **SUPERSEDED 2026-05-28**

This phase is no longer part of the Insights workstream. Voice input for the Insights panel now lands via the platform-wide voice strategy: `docs/tasks/strategy/voice-ai-dispatcher/scope.md` Phase 5.5 (per-panel inline mic).

Key differences from the original plan:
- Whisper-backed STT instead of Web Speech API (better quality, consistent across browsers, costs ~$0.006/min counted toward the shop's existing spend cap)
- Shared `<InlineVoiceMic />` component reused across Insights / Marketing / Help panels (build once, mount three places)
- Edit-confirm step before send fires (STT can mistranscribe; mandatory safety valve)

Original Phase 7.4 contents preserved below for historical context (do NOT implement):

> - Web Speech API integration in the input area.
> - Mic button alongside the send button.
> - Skip text-to-speech for replies (incremental value).

### Phase 7.5 — Tests + polish
- Jest tests for AnomalyDetector + AnomalyPhraser.
- Migration verification scripts.
- Update QA test guide with new browser-test scenarios.

---

## 11. Rough effort

**~7-8 developer-days** total for Phases 7.1-7.3 (recommended scope):
- Phase 7.1 (comparison variant): ~1 day.
- Phase 7.2 (anomaly detection): ~4-5 days.
- Phase 7.3 (saved queries): ~2 days.

Stretch — voice input: +2 days.

**Hidden cost reminder:** anomaly detection's signal-to-noise
ratio. Plan a 1-week dry-run period BEFORE making the banner
visible to shop owners — log flags, don't render — so we can
tune thresholds before users see noise.

---

## 12. Strategic position post-Phase-7

If Phase 7 ships as recommended:
- **Conversational surface:** ~80% (unchanged — Phase 7 doesn't
  add tools).
- **Intelligence layer:** 0% → ~50% (anomaly detection only;
  forecasting + benchmarks still missing).
- **Polish/UX:** 40% → 60% (saved queries + comparison variant).
- **Overall vs Square AI:** ~80% → ~85%.

The remaining ~15% is forecasting, cohort benchmarks, voice
output, multi-location, weekly digest emails. Strategic decisions
for Phase 8+.

---

## 13. Relationship to other docs

- **Continues** `business-data-insights-implementation.md` Phase
  6 work — Phase 7 sections will be appended (Section 8c).
- **Resolves** items 6-9 of `phase-6-plus-roadmap.md` ranked
  table (comparison variant, saved queries, anomaly detection,
  voice input).
- **Defers** items 10-17 of the same table to Phase 8+.
- **Builds on** Phase 6.3's chip pattern — anomaly banner's
  "Tell me more" tap submits a question via the same
  `submitText` pipeline.
