# FixFlow AI Operator — Implementation Plan (Phases 1–4, no Twilio)

**Created:** 2026-06-08
**Companion to:** `fixflow-ai-operator-roadmap.md`
**Scope:** the proactive-operator experience — **brief → recommend → act → diagnose** — on the **email + in-app** channels we already have. **No Twilio / no SMS vendor.** Employee roles (Part 1/2 / Phase 5+) are explicitly out of scope here.

## Architecture we build on (already in the repo)
- **Orchestrator:** `AIAgentDomain/controllers/UnifiedAssistantController.ts` — one assistant, `getOrchestratorTools()` = insights (read) + marketing (action) + orchestrator-own (purchase orders). Per-turn audit + spend cap.
- **Insights tools:** `services/insights/tools/*` (revenue, top services, bookings, tiers, AI impact…), `registry.ts`, `dispatcher.ts`.
- **Marketing tools:** `services/marketing/tools/*` (`lookupAudienceCount`, `proposeCampaignDraft`, `proposeCampaignSend`, `suggestCampaignStrategies`, image tools), `MarketingService`.
- **Inventory:** `InventoryDomain` + orchestrator-own `propose_purchase_order`.
- **Pattern:** every tool returns `{ data, display? }`; actions are **propose → owner taps to confirm** (G2). Keep this for everything below.

---

## Phase 0 — Data audit — ✅ DONE 2026-06-08 (run against staging DB)
**Result: overwhelmingly green — the data for Phases 1–4 already exists.** Per-metric:

| Metric (phase) | Status | Source / note |
|---|---|---|
| **Lapsed-customer value** (P1) | ✅ READY | `service_orders` (customer_address, final_amount_usd/total_amount, completed_at, status) — sum spend + last-visit. 733 orders. |
| **Booking utilization** (P1) | ✅ READY | `shop_availability` (hours/breaks per day, 478 rows) + `shop_time_slot_config` (slot_duration, max_concurrent, 68 rows) + `service_orders.booking_time_slot` (617/733 have a slot). |
| **AOV for revenue estimate** (P2) | ✅ READY | `service_orders` completed+paid → **AOV ≈ $181.81**. |
| **Conversion for revenue estimate** (P2) | 🟡 GAP | `marketing_campaigns.emails_opened/clicked` + recipient timestamps **exist but are UNPOPULATED (0 opens tracked)**. → use **repeat-visit rate / a conservative default** for the heuristic, not historical open-rate. (Open-tracking pixel isn't wired.) |
| **Scheduling** (P3) | ✅ SCHEMA READY | `marketing_campaigns.scheduled_at` column **already exists (currently unused)** + `status`, `delivery_method`, `sent_at`. → **no column migration needed**; just the worker + `status='scheduled'` handling + UI. |
| **Response time** (P4) | ✅ DERIVABLE | `messages` (sender_type customer/shop, created_at, conversation_id). 1,492 msgs; 36 convos have both sides on staging → pair customer→shop reply latency. (Sample small on staging; real shops richer.) |
| **Review conversion** (P4) | ✅ READY | `service_reviews.order_id` ↔ `service_orders` completed. **214 completed vs 93 reviews ≈ 43%.** |
| **No-show / cancellation** (P4) | ✅ READY | `no_show_history` (33) + `service_orders.no_show / status IN ('no_show','cancelled') / cancelled_at`. |

**Implications for the plan:**
1. **No blocking data gaps** for Phases 1–4 — every metric is ready or trivially derivable from existing tables.
2. **Phase 3 is lighter than estimated** — the `scheduled_at` column is already there; drop the column migration (just worker + UI + status).
3. **One real gap (🟡):** email open/click tracking isn't populated, so the Phase-2 revenue heuristic must use repeat-rate / a default conversion, not historical open-rate. (Wiring open-tracking is a separate small task if we want true email-funnel numbers later — also relevant to a Phase-4 email-conversion metric.)

---

## Phase 1 — "Morning Briefing" mode · **M** — ✅ CORE BUILT 2026-06-08 (uncommitted)
**Goal:** *"How are we doing?"* → one synthesized briefing (revenue trend, top service, lapsed customers + combined value, low stock, upcoming demand) ending in **one recommendation**.

**Built:** `services/insights/tools/businessBriefing.ts` — one composed tool returning all 5 metrics (revenue 7d-vs-prior, top service 30d, lapsed-90d count + combined spend, low-stock count + top 3, upcoming-booking volume per day + quietest day). Each metric is `safe()`-wrapped (one failure ≠ whole-briefing failure). Registered in the insights registry → available to the orchestrator. Orchestrate prompt updated: broad "how are we doing?" → call `business_briefing` once → Info→Recommendation→Action with ONE rec. **Verified live** against staging: shop 1111 → revenue $528.99 (−78.6% vs prior wk), top service "Fence Installation & Repair" $1,499.97, 9 lapsed worth $1,869.96, 5 low-stock; backend tsc clean. **v1 caveat:** upcoming demand = booking *volume*/day (+ quietest day), NOT capacity-% — true "% booked" (shop_availability + slot-config math) is the fast-follow. NOT browser-tested (tool verified headless; LLM phrasing loop not yet exercised).

**Original plan (for reference):**

**Build (backend):**
- New read tool **`business_briefing`** (`services/insights/tools/businessBriefing.ts`) OR a `BriefingService` that composes existing services in ONE call so the LLM doesn't have to chain 5 tools:
  - revenue trend → reuse `revenue_summary` logic (`compare:"prior"`)
  - top service → reuse top-services logic
  - lapsed customers + **combined value** → reuse lapsed segment (`minDaysSinceLastVisit`) **+ NEW: sum their spend**
  - low stock → reuse low-stock query
  - **NEW: booking utilization** for the next N days (slots booked / slots available)
  - Returns a structured `briefing` object (each metric + a `recommendation` hint).
- Register in the insights registry → auto-available to the orchestrator.

**New metrics (the only net-new data work):**
1. `lapsedCustomerValue(shopId, days)` — segment + `SUM(spend)`.
2. `bookingUtilization(shopId, days)` — needs shop hours/slot config + appointments (see Phase 0).

**Prompt (orchestrate):** add a rule — on "how are we doing / give me a rundown / morning briefing", call `business_briefing` ONCE, then phrase Information → Recommendation → Action (one rec, not five). Keep the no-tables / bulleted format rule.

**Frontend:** none required (renders as the assistant's prose + existing insight cards). Optional: a compact "briefing card."

**Acceptance:** "How are we doing?" returns, in one turn: revenue trend %, top service, lapsed count + $ value, low-stock item(s), an underbooked window, **and** a single concrete recommendation.

**Risks:** booking-utilization data may be 🟡 (needs slot/capacity from the scheduling feature). If missing, ship Phase 1 without it and add later.

---

## Phase 2 — One-tap "Do it" + revenue estimate · **M** — ✅ BUILT 2026-06-08 (uncommitted)
**Goal:** *"Do it."* → the recommendation from Phase 1 becomes a **single confirm-tap** action; proposals show an **estimated revenue opportunity**.

**Built:** (a) `services/marketing/estimateCampaignRevenue.ts` — `recipients × 3–8% (conservative, since open/click isn't tracked) × shop's real AOV` → a labeled **range**. Wired into `proposeCampaignDraft` (data `estimated_revenue` + display `estimatedRevenue`); rendered on `CampaignDraftCard` as "Est. opportunity: $X–$Y (rough estimate)". (b) Orchestrate prompt: "Do it / yes / go ahead" right after a recommendation → go STRAIGHT to lookup_audience_count + propose_campaign_draft reusing the recommended audience/angle (no re-asking); **keeps the owner-taps-Send gate** (never auto-sends). **Verified live:** peanut 4→$43–$115 (AOV $357.85), 1111 9→$59–$157 (AOV $217.61); backend+frontend tsc clean. NOT browser-tested (LLM "Do it" loop not exercised).

**Original plan (for reference):**

**Build (backend):**
- **"Do it" resolution:** the briefing's `recommendation` carries an actionable payload (e.g. `{action:"campaign", audience, angle}`). Orchestrator rule: on "do it / yes / go ahead" following a recommendation, **go straight to the recommended action** (e.g. `lookup_audience_count` → `proposeCampaignDraft` pre-filled from the recommendation) — no re-asking. Reuse the existing draft → confirm-tap send flow (keep the G2 gate).
- **Revenue estimate:** `estimateCampaignRevenue(shopId, audience)` helper — heuristic: `audienceSize × historicalConversionRate × avgOrderValue` → a **range** (low/high). Pull conversion from past campaign performance (or repeat-visit rate as a proxy) + avg order value from transactions.
- Extend the `campaign_draft` display with `estimatedRevenue: { low, high }`.

**Frontend:** show the estimated-revenue range on the draft card + review modal. (Send stays one tap via the existing confirm.)

**Acceptance:** after a briefing recommends a flash campaign, "Do it" → a draft appears pre-filled with the recommended audience + a "$1.5k–2.3k est. opportunity" line → owner taps **Send**. Nothing sends without that tap.

**Risks:** the revenue heuristic is an estimate — label it clearly ("rough estimate") to avoid over-promising. Conversion data may be thin for new shops → fall back to a conservative default.

---

## Phase 3 — Scheduling (send-later) · **M** — *no Twilio* — ✅ BUILT 2026-06-08 (uncommitted)
**Goal:** schedule a campaign to send at a **future time** (email + in-app), not just send-now.

**Discovery shrank this — most existed already:** `marketing_campaigns.scheduled_at` column, `MarketingService.scheduleCampaign/cancelCampaign/processScheduledCampaigns`, `MarketingCampaignRepository.getScheduledCampaigns` (`status='scheduled' AND scheduled_at <= NOW()`), the `POST /campaigns/:id/schedule` route + controller, and the frontend `scheduleCampaign()` API. **Real gaps, now fixed:**
- ✅ **No worker ran** `processScheduledCampaigns` → new `services/CampaignScheduler.ts` (node-cron, every minute, `isRunning` lock). Wired into `app.ts` startup + shutdown.
- ✅ **`processScheduledCampaigns` used PLACEHOLDER shop info** (→ broken sends) → fixed to fetch real shop via `ShopRepository`.
- ✅ **Frontend** — `CampaignReviewModal` got a **"Send now / Schedule for later"** toggle + `datetime-local` picker → existing `scheduleCampaign` endpoint → "Scheduled for <time>". Keeps the owner-taps gate.

**Verified:** scheduler `tick()` runs (0 due → safe no-op); backend + frontend tsc clean. NOT exercised with a real future send (would email real customers; send path reuses proven `sendCampaign`). **AI chat-scheduling** ("schedule for Friday") deferred — owner schedules via the modal.

**Original plan (for reference):**

**Build (backend):**
- **Migration:** add `scheduled_at TIMESTAMPTZ NULL` + status value `'scheduled'` to `marketing_campaigns`.
- **MarketingService:** `scheduleCampaign(id, sendAt)` (validates future time); the existing send path stays for send-now.
- **Worker/cron:** a periodic job (reuse the repo's scheduled-task/cron infra) that picks `status='scheduled' AND scheduled_at <= now()` and runs the existing send → marks `sent`. Idempotent + locked so it can't double-send.
- **Orchestrator/marketing tool:** `proposeCampaignDraft` (or a `schedule` arg) accepts an optional `send_at`; the assistant parses "Friday 2pm" → a timestamp (use the date-context block already in the prompt for "Friday").

**Frontend:** a "Send now / Schedule" toggle + date-time picker in `CampaignReviewModal`; the draft/sent cards show the scheduled time.

**Acceptance:** "schedule the campaign for Friday 2pm" → campaign saved `status=scheduled, scheduled_at=…`; the worker sends it at that time; the card shows "Scheduled for Fri 2:00 PM". Email + in-app only — **no SMS path.**

**Risks:** timezone correctness (store UTC, display shop-local); the cron must be reliable + locked. Keep it simple: minute-granularity polling worker.

---

## Phase 4 — Business diagnostics ("What am I doing wrong?") · **M–L** — ✅ BUILT 2026-06-08 (uncommitted)
**Goal:** surface regressing operational metrics → the AI lists **likely causes**.

**Built:** `services/insights/tools/businessDiagnostics.ts` — one composed tool, 3 health metrics each current-30d vs prior-30d with a `regressed` flag: **response_time** (messages × conversations, customer→next-shop reply latency; join on `c.conversation_id = m.conversation_id`), **review_conversion** (service_reviews ÷ completed orders), **booking_health** (no-show + cancellation rate). Each `safe()`-wrapped + `MIN_SAMPLE=3` + a >15% threshold AND **absolute floors** (response only flags ≥15 min, review only if prior ≥5%, booking only if ≥10%) so a 0→0.1-min jump isn't a false "regression". Registered → orchestrator. Prompt rule: "what am I doing wrong / what's slipping / losing money" → call once → report only regressed metrics → 2-3 hypotheses (grounded, not invented); says per-staff tracking isn't available (Phase 5). **Verified live:** 1111 review conversion 53.8%→18.5% correctly flagged regressed (the Part-3 scenario); peanut 0 regressions (false positive eliminated); backend tsc clean. NOT browser-tested (LLM loop).

**🏁 Track A (Phases 1–4) COMPLETE — the proactive operator (brief → recommend → act → schedule → diagnose) runs on email + in-app, no Twilio, no roles. All uncommitted.**

**Original plan (for reference):**

**Build (backend) — new read tools (gate behind Phase 0 availability):**
- `responseTimeTrend(shopId)` — avg customer-reply latency, this period vs prior. (messaging timestamps)
- `reviewConversion(shopId)` — completed bookings → reviews left, rate + trend.
- `bookingHealth(shopId)` — no-show rate, cancellations, fill rate, trend. (appointments + existing no-show data)
- A composing **`business_diagnostics`** tool that runs these, flags the ones that **regressed**, and returns them with deltas.

**Prompt (orchestrate):** on "what am I doing wrong / what's slipping / where are we losing money", call `business_diagnostics`, report only the metrics that worsened, then offer **2–3 likely causes** (LLM hypotheses, clearly framed as hypotheses, grounded in the deltas — never invented).

**Frontend:** none required (prose + optional small "health" card).

**Acceptance:** "What am I doing wrong?" → returns the 2–3 metrics that regressed (with before→after numbers) + plausible causes. **Excludes** technician-level items ("technicians 22% slower") — that needs employee tracking (Phase 5), and the tool should say so when asked.

**Risks:** response-time + review-funnel data may be 🟡/❌ (Phase 0). Ship with whatever's available; each missing metric is a small derivation task. Keep causes as **hypotheses**, not assertions.

---

## Cross-cutting
- **Safety/gates:** keep spend-cap + per-turn audit (already wired); keep **propose-then-confirm** for every action (no blind auto-send, even on "Do it").
- **Prompts:** all changes are orchestrate-prompt rules + tool descriptions; reuse the existing **date-context block** (for "Friday") and the **no-tables/bulleted** + **readability** conventions.
- **Cost:** briefing/diagnostics call one composed tool each (not 5 round-trips) to keep token cost down.
- **Testing (per project norms):** unit-test each new metric query against the staging DB; headless-verify each new tool end to end on a demo shop **before** wiring the prompt; then browser-test the conversational flows. No confidence claims without an executed run.
- **Flagging:** ship behind a flag (mirror `ai_images_enabled`) for staged rollout.

## Suggested build order
**Phase 0 (audit)** → **Phase 1 (Briefing)** → **Phase 2 (Do it + estimate)** → **Phase 3 (Scheduling)** → **Phase 4 (Diagnostics)**.
Phase 1 delivers the biggest visible win first; 2 closes the loop; 3 adds timing; 4 adds the "coach." All four ship without Twilio, roles, or a new vendor.
