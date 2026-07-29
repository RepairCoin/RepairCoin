# Scope — Custom Workflows (T7.2) [Business tier]

**Feature:** the pricing.jpeg Business-tier item **"Custom Workflows"** (bundled on the sheet under
"Advanced AI Memory & Automation"). A shop-facing **automation builder**: "when X happens, do Y" — the
general-purpose *if-this-then-that* for a repair shop.

**Maps to:** task **T7.2** in `../pricing-alignment/pricing-rollout-task-breakdown.md` (Business, XL,
net-new/not-started). No dedicated scope existed before this doc; no `customWorkflows` feature gate; no code.

**Status (2026-07-21):** scoping. The primary purpose of this note is to **define the feature AND draw the
boundary vs. AI Campaigns (Advanced)** — the two overlap on the same automation engine, and that must be
resolved before building either. See `../ai-campaigns-advanced/implementation-plan.md`.

**REVISED 2026-07-28 after re-reading the code.** AI Campaigns (Advanced) Phases 1–4 shipped in the
meantime and moved the baseline. Two corrections that change what this feature actually is:

1. **The builder UI already exists.** `frontend/src/components/messaging/AutoMessageRuleModal.tsx` (640
   lines) + `AutoMessagesManager.tsx` (308) are mounted at **Marketing tab → "AI Campaigns" sub-tab**
   (`MarketingTab.tsx:732`), wrapped in `<TierGate feature="aiCampaignsAdvanced">`. It already composes
   trigger → condition → action, including multi-step sequences and A/B variants. §5's "P1 — build the
   builder UI" is largely done.
2. **The engine is still messaging-shaped.** There is no `action_type` anywhere; the action is implicit in
   `message_template` / `steps[].messageTemplate`. P0's *gating* half landed with Campaigns Phase 1; its
   *generalization* half did not.

**So the phasing below is inverted relative to the real work.** The accurate one-line framing:
**the automation builder can already do everything except do anything other than send a message.**
Action is the only axis that isn't generalized. See §7 for the corrected plan.

**TARGET SET 2026-07-29 — see §8.** The product target is a **GHL-shaped Automation section** (top-level
nav, workflows list with status + enrolled counts, multi-step builder) scoped to repair-shop triggers and
actions. §7's W4 ("give it its own home") badly understates that. §8 supersedes it and carries the revised
A1–A4 plan.

---

## 1. What it is (and is it AI?)

**Definition:** a visual builder where a shop composes automations from **triggers → conditions → actions**.
Examples: "when a booking completes → wait 3 days → send a thank-you + review request"; "when inventory for
part X drops below 5 → notify the owner + draft a reorder"; "when a customer hasn't booked in 60 days → send
a win-back offer."

**Is it AI?** At its core, **no** — the engine is a rules/automation orchestrator (like a mini-Zapier),
not a model. It becomes **AI-powered through its action steps**: "AI drafts the message," "AI decides the
offer," "AI summarizes." That's   why the sheet groups it under Business *AI* — the Business theme is "the AI
does things for you," and workflows are the container that wires AI (and non-AI) actions to triggers. So:
**engine = orchestration; the valuable steps inside can be AI.** (Same framing as Growth-vs-Business AI:
Growth = "AI acts when you ask"; Business = "AI/automation runs on its own.")

---

## 2. Current state (what already exists)

*(Verified against code 2026-07-28. The pre-existing text said the engine had "no builder UI" and was
"currently UNGATED" — both are now out of date.)*

**Engine** — `backend/src/services/AutoMessageSchedulerService.ts` (848 lines): recurring, event-triggered,
delayed, and **multi-step sequences** (`steps[]` with per-step `delayHours`) plus A/B variants
(`variant_b`). Routes `/api/messages/auto-messages*`.

**Gating — DONE, but shipped dark.** `messaging/routes.ts:22`:
`const autoMessageGuard = [requireRole(['shop']), requireTierRollout('aiCampaignsAdvanced')]`.
`requireTierRollout` enforces **only** when `ENFORCE_CAMPAIGN_AUTOMATION_TIER=true`; `.env.example` ships
it `false`. So the gate is in place and inert. `featureTiers.ts:26` `aiCampaignsAdvanced: 'business'`.

**Builder UI — EXISTS.** Marketing → "AI Campaigns" sub-tab → `AutoMessagesManager` → `AutoMessageRuleModal`.
What a shop can configure today:
- **Triggers:** `schedule` (day-of-week / day-of-month / hour) or `event` — `booking_completed`,
  `booking_cancelled`, `first_visit`, `inactive_30_days`, `low_bookings`, with `delay_hours`.
- **Conditions:** `target_audience` — one of 5 fixed segments (all / active / inactive 30d / has RCN
  balance / completed a booking).
- **Actions:** send a message. **Only that.** With AI-drafted content, multi-step sequences, and A/B.

**What is therefore actually missing** (the real T7.2 scope):
1. **Actions as data** — an `action_type` + payload instead of a hardcoded message. Everything else hangs
   off this.
2. **Non-messaging actions** — issue reward/coupon, notify staff, flag for reorder, create task, run a
   campaign, AI step.
3. **Operations triggers** — all 5 event types today are marketing/customer events. Low stock, payment
   failed, no-show, review received do not exist.
4. **Conditions beyond a 5-value customer-segment enum.**
5. **Surfacing / IA** — it lives inside the *Marketing* tab, labelled *"AI Campaigns"*. An owner looking
   for "when inventory drops → notify Joe" will never find it there. This is why the existing builder is
   invisible as a workflow feature even to people who built it.

So T7.2 is **"generalize the action side, add operations triggers, and surface it outside Marketing"** —
not build-an-engine, and not build-a-builder.

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

## 5. Suggested phasing — SUPERSEDED, see §7

*(Kept for history. Written 2026-07-21 when the engine was ungated and the builder didn't exist. Both
assumptions are now false — P1 is largely built and P0's gating half is done. Do not plan off this list.)*

1. ~~**P0 — shared engine + tier cleanup.**~~ Gating done (dark). Generalization NOT done.
2. ~~**P1 — Custom Workflows builder UI** over the core.~~ Largely built as the AI Campaigns sub-tab.
3. **P2 — generalize actions** beyond messaging. ← *this is the actual feature, not phase three*
4. **P3 — AI-assisted authoring.**

---

## 6. Open decisions

- **D1 — one engine, two surfaces?** Confirm the shared-core architecture (§3) so Campaigns Advanced and
  Custom Workflows don't build the trigger engine twice. **This is the decision that gates both features.**
  *(2026-07-28: effectively already true — Campaigns Advanced built the engine and the builder. The
  question is now the narrower one in D6: extend it in place, or fork it.)*
- **D2 — feature gate.** Add a `customWorkflows: 'business'` key, or fold under `aiCampaignsAdvanced`?
  **Recommendation (2026-07-28): separate `customWorkflows: 'business'` key.** It changes nothing
  functionally today — both are Business-only — but they are separate bullets on the pricing sheet, so one
  key silently entitles a Campaigns buyer to Workflows and vice versa. That is fine only while both sit on
  the same tier; it breaks the moment either is trialled, moved, or sold as an add-on. Also, gating a
  workflow builder behind a flag literally named `ENFORCE_CAMPAIGN_AUTOMATION_TIER` will mislead whoever
  reads it next. Cost: one line now, versus touching every guard and the feature-access map later.
- **D3 — rollout for gating the existing engine — RESOLVED, it's a non-decision.** Measured on staging
  2026-07-28: only **2 shops have any automations at all, and both are already Business tier**
  (`dc_shopu` 3 rules, `7777` 1 rule). **0 of 2 lose anything when `ENFORCE_CAMPAIGN_AUTOMATION_TIER`
  flips.** No grandfathering, no migration, no customer comms. Flip it whenever convenient — and prefer
  sooner: every below-Business shop that adopts automations before the flip converts a zero-cost change
  into a support conversation. *(Prod not measured — same query should be run there before flipping.)*
- **D4 — launch scope** — which triggers/actions ship first (recommend: the messaging/win-back set that
  already exists, wrapped in the builder).
- **D5 — descope option** — if Business won't ship near-term, remove "Custom Workflows" from the pricing sheet
  rather than advertise an undefined upsell (same as the Campaigns gap note).
- **D6 — NEW (2026-07-28): extend `shop_auto_messages` in place, or build a parallel workflow model?**
  In-place means adding `action_type` (+ payload) and making the message columns nullable — less
  duplication, one engine, but it is schema surgery on a live revenue-facing marketing feature that two
  Business shops use daily. Parallel is safer but re-creates the trigger/scheduler machinery, i.e. exactly
  the two-engines outcome D1 exists to prevent. **Lean: in-place, staged** — add `action_type` defaulting
  to `send_message` so every existing rule keeps working untouched, then add new action types behind it.
  *This is the decision to make before any code.*

---

## 7. Corrected plan (2026-07-28)

**W0 — flip enforcement.** Set `ENFORCE_CAMPAIGN_AUTOMATION_TIER=true` once prod exposure is confirmed
zero (D3). Independent of everything else; do it first because the cost only rises with adoption. ~XS

**W1 — actions as data.** Migration: `action_type` on `shop_auto_messages` defaulting to `send_message`,
message columns nullable, action payload as JSONB. Engine dispatches on `action_type` with `send_message`
as the first (and initially only) handler — a pure refactor that must leave existing rules byte-identical
in behaviour. This is the keystone; everything else is additive after it. ~M

**W2 — non-messaging actions.** Issue reward/coupon, notify staff, create task/flag, draft a reorder,
run a campaign, AI step. Each is a handler registered against the dispatcher from W1. ~M, incremental.

> **`issue_reward` BUILT 2026-07-29** — and it proved W1's claim: a whole new action type needed one
> handler file, one line in the registry, and no edit to the scheduler's trigger/audience/timing logic.
> Migration 248 drops `NOT NULL` on `message_template` (the last place the schema assumed every
> automation is a message); issuance goes through the existing guarded `RewardIssuanceService`; the
> payload is validated at write time so a bad amount 400s instead of failing silently every tick; capped
> at `MAX_AUTOMATED_RCN = 100` so a runaway rule can't drain a shop.
> **Verified on staging with a real 1 RCN transfer** — shop −1, customer +1, `message_id = null`.
> Two caveats: NULL-template storage is unverified until 248 deploys (staging still had the constraint,
> so the test used a placeholder), and the issuance reason is discarded downstream — see
> `docs/bugs/BUG-013-reward-issuance-reason-discarded.md`, deliberately NOT fixed here because
> `RewardIssuanceService` is shared with campaign rewards.
> **Trap for the next action:** `backend/tsconfig.json` has `strict: false`, so widening a type to
> `| null` gives NO compile-time protection. Both engine paths resolve the message template *before*
> dispatching, and an action with a null template would crash there — guarded by `NON_MESSAGING_ACTIONS`.

**W3 — operations triggers. BUILT 2026-07-29 (partially — see the low-stock note).** Until now every
trigger was a marketing/customer moment; these are what a shop reacts to operationally.
- **`no_show`** — `service.order_no_show` published from `OrderController.markAsNoShow` (the status
  already existed with real usage; nothing was emitting it). Fires inside its own try/catch so a bus
  failure can never fail the no-show itself.
- **`review_received`** and **`low_rating`** — both from the existing `review:created` event, which
  gained a `shopId` field (additively; every current subscriber still reads `shopAddress`). Two event
  types rather than one because the engine has no condition system to branch on rating.
  `LOW_RATING_THRESHOLD = 2`: 1–2 of 5 is unambiguously unhappy, 3 is mixed, and running a "let us make
  it right" flow at someone who left a fair review reads as tone-deaf.

Three A3 templates became possible: **Recover a no-show**, **Make a bad review right** (low rating →
message → +2d 20 RCN), **Thank a happy customer**.

**Test pins the wiring in both directions** — every accepted event type must be fired by a real
subscription (or a scheduled sweep), and every fired type must be accepted. The failure this guards
against is silent: a trigger offered in the UI that nothing publishes means a shop builds a workflow,
activates it, and waits forever with no error to show for it.

**`low_stock` — BUILT 2026-07-29.** The first **shop-scoped** trigger: it happens to the shop, with no
customer anywhere in it. Three things that made it different from every trigger before it:

- **No emit path was needed.** `LowStockAlertService` already publishes `inventory:low_stock_alert`,
  *and already throttles per item and honours the shop's digest preference*. The automation subscribes to
  that and inherits the de-duplication. Building a second notion of "have we already said this" would
  eventually produce duplicates or silence depending on which won — so `handleShopEvent` deliberately
  contains no dedup at all, and a test asserts it.
- **A shop-scoped execution path** (`AutoMessageSchedulerService.handleShopEvent`): no audience to
  resolve, so the action runs exactly once with no customer in context. Still gated by
  `isShopEntitled`.
- **Migration 252** makes `auto_message_sends.customer_address` nullable — NULL meaning "fired for the
  shop, not for anybody". The enrolled counts are `COUNT(DISTINCT customer_address)` and SQL ignores
  NULLs, so a shop-scoped workflow correctly shows 0 enrolled; "Last run" keeps working off `sent_at`.

The API **rejects a shop-scoped rule wired to a customer action** (`SHOP_SCOPED_EVENTS`) — a low_stock
rule set to "send a message" has nobody to send to, and would otherwise sit in the list looking active
while silently doing nothing. The builder mirrors this: picking the trigger fixes the action to "Notify
my team" and hides the message/sequence/A-B controls.

Ninth template: **"Tell me when stock runs low"**.

**Still absent: `payment_failed`** — no confirmed emit path.

### `notify_staff` — BUILT 2026-07-29

The first action that talks to the **shop** rather than the customer: "a no-show just happened", "this
customer left 1 star", "stock is low". Its significance is structural, not cosmetic — every trigger so
far had to be customer-scoped because messaging and rewards both need a recipient. This is what makes a
shop-scoped trigger useful at all.

- Delivery goes through the **notification gateway**, never hand-wired: a `workflow_staff_alert` row in
  `notificationRegistry.ts` + one `dispatch()` call. Per CLAUDE.md, hand-wiring
  `createNotification` + `wsManager` + `pushDispatcher` at each site is exactly how channels get
  silently dropped.
- **Addressed by `shopId`, never a wallet** — a shop login is frequently a social wallet that doesn't
  match `shops.wallet_address`, so wallet-addressed shop notifications quietly fail to reach anyone.
  A test pins this.
- Not `transactional`: the shop opted in by building the workflow, so it can also mute the type via
  preferences without deleting the automation.
- Payload is `{ message? }`, capped at 500 chars, and everything is optional — an alert with no text
  falls back to the workflow name, so "just tell me when this happens" needs no composing.
- Available as a rule action and as a **step** action ("Notify my team" in the per-step picker).

**W4 — surface it.** *Superseded — see §8. The target is a GHL-shaped Automation section, which is much
more than "give it its own home".*

**W5 — AI-assisted authoring.** "Describe the automation and the AI builds it." ~M

W1 is the whole unlock: until actions are data, every new action type means editing the scheduler.

---

## 8. The actual target (2026-07-29) — GHL-shaped, FixFlow-scoped

Product direction, set by comparing against GoHighLevel's **Automation → Workflows** section: copy the
SHAPE, narrow the VOCABULARY. GHL is generic because it must be; FixFlow knows what a repair shop does,
so its triggers and actions can be few and opinionated.

**Copy the shape:**
- A **top-level `Automation` nav item** — not a sub-tab inside Marketing.
- A **workflows list**: Status (Draft/Published), Total enrolled, Active enrolled, Last updated, Created
  on, search; folders later.
- A **multi-step builder**: one trigger, then several actions with waits between them.

**Narrow the vocabulary** to what the platform already tracks (~10 triggers, ~7 actions):

- **Triggers:** booking created / completed / cancelled / no-show · repair ready for pickup · first visit
  · customer inactive N days · low stock on a part · review received (esp. < 3★) · new ad lead ·
  subscription lapsed.
- **Actions:** send message (in-app/email/SMS) · **issue RCN** *(built, W2)* · notify owner/staff ·
  create task/flag · draft a reorder · run a campaign · AI step (draft the message, decide the offer).

### The one structural gap

Everything else is surface work. This is not:

```
SequenceStep = { messageTemplate, delayHours }          // today — message-only
            →  { actionType, actionPayload, delayHours } // any action, per step
```

`action_type` currently sits on the RULE, so a rule does exactly one thing. A GHL workflow is an ordered
list of steps that each do something different.

**We are closer than the comparison suggests.** The drip-sequence machinery is already a workflow engine:
`steps[]` carries per-step waits, `auto_message_sends.step_index` tracks where each customer is, and the
scheduler logs *"Enrolled 0x… in sequence 'X' (step 1)"* then enqueues the next step after each fires —
verified running live 2026-07-28. Enrollment, progression and waits all exist. They are simply hardcoded
to message steps. Applying **W1's move one level down** yields
*"booking completed → wait 3 days → send review request → wait 2 days → if no review, issue 10 RCN."*

### Deliberately out of scope for v1

**Full if/else branching.** Most repair-shop flows are linear with an exit condition, and `stop_on_booking`
already proves that pattern. Linear steps + a few exit conditions cover every template below; branching can
be added later without rework.

### Revised remaining work

**A1 — action steps.** Generalize `steps[]` from message steps to action steps (mirrors W1, one level
down). Reuses enrollment, waits and step tracking that already work. **This is the structural unlock.** ~M

**A2 — the Automation surface. BUILT 2026-07-29.**
- **Its own nav destination** — `Automation` in the shop sidebar beside Marketing, `/shop?tab=automation`.
  Not a Marketing sub-tab: an owner looking for "when inventory drops → notify Joe" would never open
  Marketing.
- **`WorkflowsList`** — a table, not a card wall: Name (with `trigger → steps` beneath), Status
  (Active/Paused), **Total enrolled**, **Active enrolled**, Last run, Created, plus search and
  create/edit/pause/delete. Enrolled counts are derived from `auto_message_sends`, which has tracked
  per-customer step progress all along — no new bookkeeping.
- **`customWorkflows: 'business'` added (D2 executed)**, and the surface gates on it. The shared
  `/auto-messages*` routes now use a new `requireAnyTierRollout([...])` so a shop entitled to EITHER
  surface gets in — gating on `aiCampaignsAdvanced` alone would have locked a Workflows-only shop out of
  its own workflows.
- **One builder, two entry points** (not a second builder that drifts): `AutoMessageRuleModal` takes a
  `surface` prop. For `workflow` it retitles to "New Workflow", fixes the max-sends copy to "how many
  times this workflow can run for the same customer", and **gives every sequence step its own action
  picker** — Send a message / Issue RCN — which is A1 finally reachable from the UI.

**Left for A3+:** Draft/Published lifecycle (today it's Active/Paused off `is_active`), folders and
smart lists, and repair-shop templates.

**A3 — repair-shop templates. BUILT 2026-07-29.** Five, in
`frontend/src/components/shop/automation/workflowTemplates.ts`:
- **Post-repair follow-up** — booking completed → 1d thank-you → +2d review request → +1d 10 RCN
- **Win back lapsed customers** — inactive 30 days → message → +2d 25 RCN (stops if they book)
- **Welcome a new customer** — first visit → welcome → +1d 15 RCN
- **Rescue a cancelled booking** — booking cancelled → +2h reschedule offer
- **Fill a slow week** — low bookings → message to active customers

Picking one **prefills the builder rather than creating the workflow** — it opens as a draft (a partial
with no `id`, so the modal stays in create mode) and the owner edits the wording and timing before
anything goes live. The gallery shows automatically when the shop has no workflows: a blank canvas is
the worst possible first screen for someone who has never built an automation.

**Constraint honoured:** every template uses only triggers and actions that EXIST today. "Low-stock
reorder" and "Bad review escalation" from the original list are deliberately absent — their triggers
are W3 work, and shipping a template that cannot run would be worse than shipping none.

**A4 — later.** Branching, folders/smart lists, Build-with-AI.

Reuse the existing builder component rather than writing a second one: it already handles trigger
selection, audience, scheduling and validation. Two entry points over one component, not two builders that
drift apart.

### New decision this raises

- **D7 — surface ownership — DECIDED + BUILT 2026-07-29 (migration 249).**
  **Record it, don't derive it.** `shop_auto_messages.surface` is `'campaign' | 'workflow'`, set by
  whichever screen creates the rule, defaulting to `'campaign'` — factually correct, since Marketing →
  AI Campaigns is the only surface that has ever existed.
  Derivation was rejected: `action_type` can't distinguish them (a workflow may legitimately send a
  message — "on no-show → text the customer"), and neither can `trigger_type` (campaigns are
  event-triggered too).
  **The load-bearing half is the negative rule: the SCHEDULER never filters by surface.**
  `getByShopId` filters (UI); `getActiveScheduleRules` / `getActiveEventRules` deliberately do not. A
  rule that stopped firing because of which screen created it would be absurd, and would fail silently —
  the rule sits there looking active while nothing happens. A test asserts the engine queries stay
  surface-blind.
  API: `GET /api/messages/auto-messages?surface=workflow`; create takes `surface` in the body. Absent =
  `'campaign'`, so every existing client is unchanged and today the filter is a no-op.
  **A2 is unblocked.**

---

**Key files:** `backend/src/services/AutoMessageSchedulerService.ts` (the engine, 848 lines) ·
`backend/src/domains/messaging/routes.ts:22` (`autoMessageGuard` — gated, dark) ·
`backend/src/config/featureTiers.ts:26,56` (`aiCampaignsAdvanced` + its rollout flag) ·
`frontend/src/components/messaging/AutoMessageRuleModal.tsx` (the builder, 640 lines) ·
`frontend/src/components/messaging/AutoMessagesManager.tsx` ·
`frontend/src/components/shop/tabs/MarketingTab.tsx:732` (where it's mounted) ·
`backend/src/middleware/tierGuard.ts` (`requireTierRollout`).
Related: [[project-ai-campaigns-advanced-state]], [[project-pricing-rollout-state]],
[[project-auto-replies-channel-expansion-state]], [[project-ai-memory-state]] (the other half of the sheet's
"AI Memory & Automation" line).
