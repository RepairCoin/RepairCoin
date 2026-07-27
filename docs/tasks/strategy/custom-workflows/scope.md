# Scope — Custom Workflows (T7.2) [Business tier]

**Feature:** the pricing.jpeg Business-tier item **"Custom Workflows"** (bundled on the sheet under
"Advanced AI Memory & Automation"). A shop-facing **automation builder**: "when X happens, do Y" — the
general-purpose *if-this-then-that* for a repair shop.

**Maps to:** task **T7.2** in `../pricing-alignment/pricing-rollout-task-breakdown.md` (Business, XL,
net-new/not-started). No dedicated scope existed before this doc; no `customWorkflows` feature gate; no code.

**Status (2026-07-21):** scoping. The primary purpose of this note is to **define the feature AND draw the
boundary vs. AI Campaigns (Advanced)** — the two overlap on the same automation engine, and that must be
resolved before building either. See `../ai-campaigns-advanced/implementation-plan.md`.

---

## 1. What it is (and is it AI?)

**Definition:** a visual builder where a shop composes automations from **triggers → conditions → actions**.
Examples: "when a booking completes → wait 3 days → send a thank-you + review request"; "when inventory for
part X drops below 5 → notify the owner + draft a reorder"; "when a customer hasn't booked in 60 days → send
a win-back offer."

**Is it AI?** At its core, **no** — the engine is a rules/automation orchestrator (like a mini-Zapier),
not a model. It becomes **AI-powered through its action steps**: "AI drafts the message," "AI decides the
offer," "AI summarizes." That's why the sheet groups it under Business *AI* — the Business theme is "the AI
does things for you," and workflows are the container that wires AI (and non-AI) actions to triggers. So:
**engine = orchestration; the valuable steps inside can be AI.** (Same framing as Growth-vs-Business AI:
Growth = "AI acts when you ask"; Business = "AI/automation runs on its own.")

---

## 2. Current state (what already exists)

The **automation engine is already built** — it just has no builder UI and isn't a "workflow" concept yet:
- `backend/src/services/AutoMessageSchedulerService.ts` — supports **recurring** (daily/weekly/monthly),
  **event-triggered** (`booking_completed`, `first_visit`, `booking_cancelled`), and **inactive-customer /
  win-back** automation. Routes: `backend/src/domains/messaging/routes.ts` (`/api/messages/auto-messages*`).
- **⚠️ Currently UNGATED** (open to Starter — only `authMiddleware`). Same leak flagged in the AI Campaigns
  Advanced plan; Business-gating this engine is shared Phase-1 cleanup for both features.
- Existing triggers/actions are **messaging-only** (send a message). A true workflow builder generalizes
  triggers and actions across domains (inventory, bookings, customers, rewards).

So T7.2 is largely **"promote the existing event-driven handlers into a real builder + generalize the
action set,"** not build-an-engine-from-scratch.

---

## 3. The boundary vs. AI Campaigns (Advanced) — the conflict to resolve

Both features are described in the docs with the same phrase ("promote the event-driven handlers into a
builder") and both sit on the **same auto-message/event engine**. Building them independently would build
the trigger/automation core **twice**. Proposed split:

- **AI Campaigns (Advanced)** = *marketing-specific* autonomous **sends to an audience** (triggered/recurring
  campaigns, drip, A/B, win-back-as-marketing). Audience-centric.
- **Custom Workflows** = *general-purpose* automation across **all domains** (bookings, inventory, customers,
  rewards) — single-entity or operational actions, not audience blasts. Operations-centric.
- **Overlap** (win-back, post-service follow-up) is expressible in either; treat **campaigns as one *type* of
  workflow action** ("send campaign") so there's one engine, not two.

**Recommended architecture: ONE shared trigger→action engine; two product surfaces on top.**
- A single automation core (generalize `AutoMessageSchedulerService` into a trigger registry + condition
  evaluator + action registry).
- "AI Campaigns (Advanced)" is the **marketing-flavored surface** (audience + send actions).
- "Custom Workflows" is the **general builder surface** (all triggers + all actions, including "run a
  campaign" and AI action steps).
- Both gate on their own feature key but reuse the core. Avoids double-building and keeps behavior consistent.

---

## 4. Candidate triggers & actions (for the builder)

**Triggers:** booking created / completed / cancelled / no-show; first visit; customer inactive N days;
review left (or low rating); inventory below threshold; RCN balance/tier change; scheduled (recurring);
service-order status change; ad-lead created.

**Conditions:** customer tier/spend, service/category, time-of-day / business hours, tag/segment, amount
thresholds.

**Actions:** send message (email/SMS/in-app) · **AI-draft a message** · send/attach RCN reward or coupon ·
**run a marketing campaign** (the Campaigns-Advanced bridge) · notify the owner/staff · create a task/flag ·
draft a reorder (inventory) · escalate to a human. AI action steps reuse the marketing AI + brand kit +
`modelFor()` model config.

---

## 5. Suggested phasing

1. **P0 — shared engine + tier cleanup.** Generalize the auto-message engine into a trigger/condition/action
   core; **gate it to Business** (`aiCampaignsAdvanced` or a new `customWorkflows` key — decide in D2). This is
   the SAME Phase-1 cleanup the Campaigns Advanced plan calls for — do it once, for both. *(Breaking change:
   the engine is currently free to all tiers — needs a grandfather-or-notify rollout, same caution as Campaigns.)*
2. **P1 — Custom Workflows builder UI** over the core: pick trigger → conditions → actions, with the existing
   messaging/win-back automations as the first templates.
3. **P2 — generalize actions** beyond messaging (rewards, inventory, staff notify, "run a campaign", AI steps).
4. **P3 — AI-assisted authoring** ("describe the automation and the AI builds the workflow").

P0+P1 ship a real Business feature mostly from existing parts. P2–P3 deepen it.

---

## 6. Open decisions
- **D1 — one engine, two surfaces?** Confirm the shared-core architecture (§3) so Campaigns Advanced and
  Custom Workflows don't build the trigger engine twice. **This is the decision that gates both features.**
- **D2 — feature gate.** Add a `customWorkflows: 'business'` key, or fold under `aiCampaignsAdvanced`? (Lean:
  separate `customWorkflows` key for clean pricing, shared engine underneath.)
- **D3 — rollout for gating the existing engine** (currently ungated/free-to-all) — grandfather vs notify.
- **D4 — launch scope** — which triggers/actions ship first (recommend: the messaging/win-back set that
  already exists, wrapped in the builder).
- **D5 — descope option** — if Business won't ship near-term, remove "Custom Workflows" from the pricing sheet
  rather than advertise an undefined upsell (same as the Campaigns gap note).

**Key files:** `backend/src/services/AutoMessageSchedulerService.ts` (the engine), `backend/src/domains/
messaging/routes.ts` (`/auto-messages*`, ungated), `backend/src/config/featureTiers.ts` (+ frontend, gate).
Related: [[project-ai-campaigns-advanced-state]], [[project-pricing-rollout-state]],
[[project-auto-replies-channel-expansion-state]], [[project-ai-memory-state]] (the other half of the sheet's
"AI Memory & Automation" line).
