# Implementation Plan — AI Campaigns (Advanced) [Business tier]

**Feature:** the pricing.jpeg Business-tier item **"AI Campaigns (Advanced)"**. The autonomous/automated
counterpart to Growth's assistive AI Marketing Suite: **Growth = "AI drafts a campaign when you ask, you
press send"; Business = "AI runs campaigns for you — automatically, on triggers, over time."**

**Maps to:** feature gate `aiCampaignsAdvanced: 'business'` (already declared in `featureTiers.ts`, currently
unused). Related: the gap note `../pricing-alignment/marketing-tier-gap-ai-campaigns-advanced.md` (what's
built per tier + the recommended capability split) and the WS2 feature-gating scope.

**Status (2026-07-20):** planning. Grounded in a read-only code audit (below).

---

## Audit findings (what actually exists today)

- **Campaign Builder (Growth) — BUILT.** Entire `MarketingDomain` (`backend/src/domains/MarketingDomain/routes.ts`)
  gated to `campaignBuilder`. Manual campaign CRUD, audience resolve (`all_customers`, `top_spenders`,
  `frequent_visitors`, `active_customers`, `select_customers`, `imported_winback`), email + in-app send,
  send-later scheduling, contacts/CSV import, RCN reward attach. **No SMS in campaign send** (email + in-app
  only), no recurring, no A/B, no drip, basic stats only.
- **AI Marketing Suite (Growth) — BUILT + CORRECT.** `/api/ai/marketing-chat` (`requireTier('aiMarketingSuite')`)
  + the unified-assistant marketing capability (`UnifiedAssistantPanel` `can("aiMarketingSuite")`). Assistive,
  draft-and-send-now only (prompt is explicit: "No scheduling — send-now only"). **Leave at Growth.**
- **`aiCampaignsAdvanced` (Business) — DECLARATION-ONLY / UNUSED.** No `requireTier('aiCampaignsAdvanced')`,
  no frontend `TierGate`/`can()`. A Business shop currently gets the *same* marketing surface as Growth.
- **⚠️ The automation engine already exists but is UNGATED (open to Starter).** `AutoMessageSchedulerService`
  (`backend/src/services/AutoMessageSchedulerService.ts`) + routes `backend/src/domains/messaging/routes.ts:248–300`
  (protected only by `authMiddleware` — no `requireRole`, no `requireTier`). It supports:
  - **Recurring** scheduled messages — daily/weekly/monthly (`shouldRunNow`)
  - **Event-triggered** messages — `booking_completed`, `first_visit`, `booking_cancelled` (`handleEventTrigger`,
    wired in `messaging/index.ts`)
  - **Inactive-customer / win-back** automation (`processInactiveCustomers`)
  This IS the autonomous "Advanced" capability — currently free to every tier. It's the core of this workstream.

**Net:** most "Advanced" rows are net-new (A/B, drip, cross-channel, attribution), but **triggered +
recurring + win-back automation already exist** — they just live in an ungated subsystem and aren't surfaced
as "campaigns." So a large part of AI Campaigns (Advanced) is **gate + surface + AI-ify what exists**, not
build-from-scratch.

---

## Phase 1 — Tier cleanup (DO FIRST)

Goal: correct the tier boundaries so Advanced is built on a clean base. Findings-driven, mostly middleware.

1. **Confirm the drafter stays Growth.** `/marketing-chat` + unified-panel marketing = `aiMarketingSuite`
   (Growth). Correct — **do not move to Business.** (This resolves the common misread that "it uses AI ⇒
   Business"; Growth AI is assistive, Business AI is autonomous.)
2. **Gate the automation subsystem to Business.** Add `requireRole(['shop'])` + `requireTier('aiCampaignsAdvanced')`
   to the auto-message routes (`/api/messages/auto-messages*`). This is the actual mis-tier fix — the
   recurring/triggered/win-back engine becomes the Business differentiator it was always meant to be.
3. **Frontend gate.** Wrap the auto-message UI (if surfaced) in `<TierGate feature="aiCampaignsAdvanced">`;
   add the sidebar/lock hint.
4. **Confirm manual builder stays Growth.** `campaignBuilder` gating of `MarketingDomain` is correct — no change.
5. **Document the boundary** in the gap note: drafter + manual builder = Growth; automation = Business.

**⚠️ Rollout caution (breaking change):** the automation subsystem is currently OPEN to all tiers. Gating it
to Business will lock out existing Starter/Growth shops that already use auto-messages. Decide the rollout:
- **Grandfather** existing users (allow-list shops with active auto-message rules), OR
- Ship the gate **flag-off** first, notify affected shops, then enable — same pattern as the pricing rollout WS.
Do NOT flip the gate on without this decision; it's a live-customer-impacting change, not a silent cleanup.

**Phase 1 deliverables:** middleware on the auto-message routes + frontend gate + rollout strategy + gap-note
update. Small code, but the rollout decision is the real gate.

---

## Phase 2 — Surface + AI-ify the existing automation (leverage what's built)

Turn the ungated engine into a first-class **"AI Campaigns"** Business surface. Highest value / lowest cost.

- Unify the auto-message triggers (booking-completed, first-visit, cancelled, inactive win-back) + recurring
  rules under an "AI Campaigns" UI in the marketing area (Business-gated).
- Let the **AI generate the content** for each automated campaign (reuse the marketing AI + brand kit + the
  date-context + campaign-rewards attach), instead of static templates.
- Expand triggers using signals already in the repo: lapsed-audience model (`service_orders`-based),
  insights anomaly signals (slow day / low bookings), post-service follow-up.
- Reuse `CampaignScheduler` / the auto-message loop for execution; reuse campaign-rewards for incentives.

**Reuse:** `AutoMessageSchedulerService`, `MarketingService.resolveTargetAudience` (`imported_winback`),
marketing AI (`aiMarketingSuite` orchestration), campaign rewards, insights signals, lapsed-audience model.

---

## Phase 3 — A/B testing + optimization (net-new)

- AI generates N content variants, splits the audience, sends, measures opens/clicks/bookings, picks + reports
  the winner. New: variant model, split-assignment, results aggregation. (Growth's "two draft versions" is NOT
  this — that's just two drafts, no audience split.)

## Phase 4 — Multi-step drip sequences (net-new)

- AI designs + runs a sequence (e.g. reminder → offer → last-chance) with per-step delays and exit conditions
  (e.g. stop on booking). New: sequence/step model + a stepper in the scheduler loop.

## Phase 5 — Cross-channel orchestration + attribution (net-new, larger)

- **Cross-channel:** campaign send is email + in-app today; SMS isn't wired into the campaign sender (it lives
  in the messaging subsystem), WhatsApp is a separate Meta integration. "AI picks email/SMS/WhatsApp per
  recipient" needs the campaign sender extended to those channels + per-recipient channel selection. (Depends
  on the SMS provider decision — see the Twilio/Telnyx note.)
- **Attribution:** revenue-per-campaign, cohort lift, ROI — beyond the current basic `getCampaignStats`.
  Reuse the ads conversion-attribution pattern (contact-match paid orders → campaign) as a template.

---

## Suggested sequencing

1. **Phase 1** (tier cleanup + rollout decision) — required first; unblocks selling Business honestly.
2. **Phase 2** (surface + AI-ify existing automation) — best value-to-effort; makes "AI Campaigns (Advanced)"
   a real, shippable Business feature mostly from existing parts.
3. **Phases 3–5** — incremental net-new capability; prioritize by what best justifies the Business price
   (A/B + drip are common expectations; cross-channel waits on the SMS-provider decision).

Phase 1 + Phase 2 alone deliver a genuine Business differentiator. 3–5 deepen it.

## Open decisions
- **D1 — Rollout for gating the auto-message engine** (grandfather vs flag-off-then-notify). Blocks Phase 1 go-live.
- **D2 — Scope of "Advanced" for launch** — which gap-note rows ship first (recommend triggered + recurring + win-back = Phase 2).
- **D3 — Cross-channel** depends on the Twilio→Telnyx / SMS-in-campaigns decision (currently campaign send = email + in-app only).
- **D4 — Descope option** — if Business won't ship near-term, remove "AI Campaigns (Advanced)" from the pricing sheet rather than advertise an undefined upsell (per the gap note).

**Key files:** `backend/src/config/featureTiers.ts` (+ frontend), `backend/src/domains/messaging/routes.ts`
(auto-message routes — Phase 1 gate), `backend/src/services/AutoMessageSchedulerService.ts` (the engine),
`backend/src/domains/MarketingDomain/**` (manual builder), `backend/src/domains/AIAgentDomain/routes.ts`
(marketing-chat, stays Growth). Related: [[project-ai-marketing-campaigns-state]],
[[project-lapsed-audience-data-model]], [[project-campaign-rewards-state]], the pricing rollout + Twilio/Telnyx note.
