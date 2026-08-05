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

**`payment_failed` — BUILT 2026-07-29.** The emit path did exist after all: `PaymentService`
handles `payment_intent.payment_failed` / `payment_intent.canceled` from Stripe in
`handlePaymentFailure`, and the payment-intent metadata carries `shopId`, `customerAddress`, `orderId`
and `serviceId` — everything the automation needs. It just wasn't published. It now is
(`service.payment_failed`), in its own try/catch so a bus failure can never fail the webhook, which
Stripe would then retry.

Customer-scoped, so it uses the normal path. Tenth template: **"Recover a failed payment"** —
message the customer after an hour, then notify the team a day later if they still haven't rebooked,
with `stopOnBooking` so nobody chases a customer who already sorted it. A decline is a recoverable
sale, not a lost customer.

**Every trigger in §8's list is now built.**

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

### Revised remaining work — SUPERSEDED, see §9

*(A1, A2, A3 and A4 are all built. §9 is the current remaining-work list.)*

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

## 9. Remaining work (updated 2026-08-05)

**Shipped and live on staging:** **11 event triggers** + schedules · **6 actions** · 10 templates ·
multi-step sequences · A/B · Draft→Publish · team alerts · template relevance numbers · AI
recommendations that deep-link into a workflow · per-workflow outcome metrics · AI-written campaigns
inside the builder. Everything in §7 (W0–W3) and §8 (A1–A4) is built and merged.

### 9.0 WHAT IS LEFT — read this first

Two different lists, and conflating them is what made this section unreadable. **Feature work is not what
stands between this and production.**

**A. Blocks production (4) — decisions and checks, mostly not code**

1. **Prod has never been measured.** Staging was measured before the flag flip and found 0 breaks. The
   same "which shops have automations, at what tier" query has never been run on prod. Do this first.
2. **Campaign rewards on automated sends — an open decision.** A workflow firing a reward campaign
   weekly is a standing order against the shop's RCN balance that nobody re-approves. `issue_reward`
   caps at 100 RCN; `run_campaign` currently drops rewards from the clone rather than carry them
   uncapped. Someone has to choose a cap or a per-run budget. See §9.2.3.
3. **The stale-draft sweep is not flag-gated.** It runs on the first nightly pass wherever it deploys.
   Run `backend/scripts/_qa_stale_draft_dryrun.ts` (read-only) against prod to see the number before
   that merge. See §9.4.1.
4. **The actions/triggers QA checklist was written but never walked end-to-end** in a browser
   (publish → fire → verify) — `docs/tasks/test/qa-workflow-actions-triggers-staging-checklist.md`.
   Parts are covered ad hoc: `ai_step` live-verified, `draft_reorder` 8/8 automated, the campaign path
   browser-verified 2026-08-05. `run_campaign` firing on a real trigger is the untested one.

**B. Scoped feature work not yet built (4) — the feature is usable without all of it**

1. **1 action of the 4 in §9.2:** *create a task / flag*. The other three shipped.
2. **3 triggers of the 4 in §9.3:** *booking created*, *repair ready for pickup*, *subscription lapsed*.
   *new ad lead* shipped. These are the larger items — each needs an event **emitted** from wherever it
   happens, which was the real work in `no_show` and `payment_failed`.

**Implementation plan for all four: `remaining-actions-triggers-implementation.md`.** Read it before
estimating — **only one of the four is small.** §9.2's "a new action costs one `register()` call" held
because the thing each shipped action acts on already existed; it does not hold here. Headlines: there is
**no task table anywhere** on the platform (so that action needs a surface or it writes into a void);
`service.order_created` exists but **the main customer booking path never publishes it**, so a naive
`booking_created` would fire only for manual/ad-lead bookings; the engine **skips shops that are not
entitled**, which is exactly what a lapsed subscription makes a shop, so `subscription_lapsed` is dead on
arrival without a carve-out; and **`repair_ready` has no status to fire on** — it is an order-lifecycle
change wearing a trigger's clothes, and should be handed back for scoping as one.

Plus §9.4 (M4 benchmarks, blocked on data) and §9.5 (deferred by decision — not gaps).

### 9.1 To ship the CURRENT scope — verification only, no code

- ~~Browser QA tests 4 and 5~~ **DONE 2026-08-03 — all 5 passed on `peanut`.** The edit P0 fix is
  confirmed in a browser, not just over the API. See the result block at the top of
  `docs/tasks/test/qa-custom-workflows-staging-checklist.md`.
- ~~One metrics check on `dc_shopu`~~ **DONE 2026-08-03** (verified against the live API). Setting this
  check up is what surfaced the revenue-attribution bug fixed in `6c388d31e`: `booked` and `revenue`
  shared one filter, so expired and no-show orders counted as money taken (~45% of the figure).
- ~~The AI-recommendation → workflow deep-link~~ **PASSED on dc_shopu 2026-08-03** — card → Automation
  with the win-back template open, `?template=` stripped, create mode, mixed `message → +48h RCN 25`
  sequence rendering.

**§9.1 is complete. The current scope is shipped on staging.** The browser pass was worth running: it
found **four bugs that 2,656 passing unit tests and a clean typecheck could not see**, three of them
silent by construction —

1. `6c388d31e` revenue counted `expired`/`no_show` orders as money taken.
2. `58c73e67c` recommendations froze on first detection and could never refresh (`ON CONFLICT DO
   NOTHING` against an index that ignores expiry, plus no purge anywhere). This is what made the
   deep-link untestable at first — every stored card predated M2.
3. `d95feeb07` an empty `targetAudience` passed validation, then meant *everyone* on create
   (`|| 'all'`) and *nobody* on update (`default: return []`).
4. `a62584696` (PR #716) the Target Audience dropdown showed a placeholder over a correct stored value.
   **Root cause never identified** — the fix is correct under both candidate causes. The first attempt
   at it failed. Full write-up at the end of
   `docs/tasks/test/qa-custom-workflows-staging-checklist.md`; read it before touching that modal.

**Next is prod.** D3 measured staging before flipping and found 0 breaks; **prod is still unmeasured** —
run the same "which shops have automations, at what tier" query there first.

### 9.2 ACTIONS — 3 of 4 now built, 1 left

Registry is now 6: `send_message` · `issue_reward` · `notify_staff` · `run_campaign` · `ai_step` ·
`draft_reorder` (`backend/src/services/autoMessageActions/registry.ts`).

Each was **small**, as designed: W1's dispatcher was built so a new action costs one `register()` call
plus its config UI, and a test asserts exactly that.

1. **Create a task / flag** — ⬜ **THE ONLY ACTION LEFT.** Put an item on the shop's to-do list, or flag a
   customer/booking for follow-up. Turns "tell me" into "remind me until it's done".
2. ~~**Draft a reorder (purchase order)**~~ **BUILT 2026-08-05.** On low stock, drafts a PO to approve
   rather than only alerting — closing the loop `low_stock` opens. Shop-scoped, and it **drafts, it does
   not order**: the suggestion goes to `purchase_order_suggestions` for a human to approve, never to a
   supplier. Deduped, so repeated `low_stock` firings cannot stack suggestions for the same item.
   **Verified 8/8 by an automated end-to-end run** (`backend/scripts/_qa_draft_reorder_e2e.ts`) against
   the deployed API and the real engine entry point — including that a draft workflow stays inert, that
   a second firing does not duplicate, and that the guard refuses `low_stock` + `send_message`.
3. ~~**Run a campaign**~~ **BUILT + MERGED 2026-08-03 (`566b80bf9`, PR #717).** The Campaigns-Advanced
   bridge from §3, and the first action that can send **email** — every other action writes an in-app
   message, which only reaches customers who open the app.
   **Two non-obvious constraints decided the design.** It is **shop-scoped**: the scheduler runs an
   action once per customer in the audience, so a per-customer campaign action would fire one campaign
   per recipient, each resolving the same audience again. And it **clones**: `sendCampaign` throws on
   `status === 'sent'` and then calls `markAsSent`, so pointing an action straight at a campaign works
   exactly once and throws on every later trigger — a recurring workflow that quietly stops. The
   configured campaign is a TEMPLATE; each firing clones it to a fresh draft and sends the clone, which
   also gives every run its own stats instead of overwriting one row's history.
   **Open decision: the clone drops campaign rewards.** A workflow firing a reward campaign weekly is a
   standing order against the shop's RCN balance that nobody re-approves. It needs a cap or a per-run
   budget (compare `issue_reward`'s 100 RCN limit) before rewards should carry through.
   Backend verified against the deployed API 2026-08-03. The **picker and preview are browser-verified
   as of 2026-08-05**; what is still untested is `run_campaign` actually **firing on a live trigger** —
   see §9.0 A4.
   **Since built, the picker became AI-first** (§9.2.5): the manual designer is still there for editing,
   but the default path is a one-line brief.
4. ~~**AI step**~~ **BUILT 2026-08-05.** Composes the message at send time from live context instead of a
   fixed template with `{{variables}}`, reusing the marketing AI + brand kit.
   **Generated once per firing, not once per recipient.** It only fans out across an audience when the
   trigger provides one, and the generated copy is memoised for that run — otherwise a 200-person
   audience would mean 200 model calls and 200 different messages, which is both a bill and a
   support problem. Output is validated before it can be sent, and only `{{customerName}}` /
   `{{shopName}}` survive as variables.
   **Live-verified on staging** (a "Friday Freebies" rule: one generation, three sends, names correctly
   swapped per recipient).
   **Limit:** in-app only — no email, no push. `run_campaign` is the action that reaches inboxes.
5. **AI-written campaigns in the builder** — **BUILT 2026-08-05**, not originally scoped. Management's
   note was that building a campaign by hand inside a workflow "is a chaos". The builder now takes a
   one-line brief and generates subject, body and a banner image, with a preview before anything
   publishes; the designer is gated to **design-only** inside a workflow so its "Send now" button cannot
   contradict the workflow that is supposed to own the send. See `ai-campaign-in-workflow.md` and
   `campaign-action-editor-embed.md`. Its side effect — draft accumulation — is §9.4.1.

**Highest impact was 3 and 4**, and both shipped. The one left (1) is a convenience.

### 9.3 TRIGGERS — 1 of 4 built, 3 left

Currently accepted (`VALID_EVENT_TYPES` in `AutoMessageController.ts`): `booking_completed` ·
`booking_cancelled` · `first_visit` · `inactive_30_days` · `low_bookings` · `no_show` · `review_received`
· `low_rating` · `payment_failed` · `low_stock` · `new_ad_lead`.

These are **larger than the actions**, because each needs an event **emitted** from wherever it happens.
That was the real work in `no_show` and `payment_failed`: the state already existed, nothing published it.

1. ⬜ **Booking created** (today: completed / cancelled / no-show only)
2. ⬜ **Repair ready for pickup**
3. ~~**New ad lead**~~ **BUILT 2026-08-05.** Emitted from `MessagingDomain`. Shop-scoped — it happens to
   the shop with no customer attached — so it is in `SHOP_SCOPED_EVENTS` and only pairs with actions that
   need no recipient.
4. ⬜ **Subscription lapsed**

**Every action/trigger pairing is now validated** (`actionTriggerError` in `AutoMessageController.ts`,
mirrored in the builder UI so the action list filters by the chosen trigger). Before this, a shop-scoped
trigger like `low_stock` could be paired with `send_message`, and the rule would sit there looking active
while the engine had nobody to send to. The form was also reordered — **trigger first, then action** —
because the action list is what narrows.

### 9.4 Supporting work

- **M4 — real performance benchmarks.** Replace each template's qualitative `benefit` with a measured
  figure, behind an explicit minimum-sample gate. Blocked on data: outcome collection began 2026-07-30.
  See `management-change-request.md` D1 for why the requested "12–18%" was not shipped as static copy.
- **`service_orders.payment_status`** — would let the failed-payment template show a relevance number
  like the others. It is the one template with no line today.

### 9.4.1 Draft-campaign accumulation — BUILT + VERIFIED 2026-08-05 (`ad0637c64`, `bc0c8e0ca`)

Making campaign creation AI-driven created a cost nobody budgeted for: the assistant persists a draft on
**every** proposal (deliberately — the id has to outlive the chat session so the shop can go and edit it),
and nothing ever removed the ones they scrolled past. Measured platform-wide 2026-08-05:

- **111 `ai_agent` drafts against 37 `ai_agent` sends** — roughly three quarters are never used.
- **Manual is the opposite: 8 drafts to 58 sends.** That asymmetry is the whole argument. A hand-built
  draft is somebody's unfinished work; an ignored AI proposal is a suggestion nobody took.
- Concentrated in `peanut` (73) and `1111` (34) — i.e. the shops that used the feature most are the ones
  whose campaign list became least usable.

Two fixes, chosen over a third (a "drafts" filter in the list) because that one hides the mess rather than
removing it:

1. **Stop creating the debt.** `AutoMessageRuleModal` now tracks the draft it just generated
   (`disposableDraftId`) and deletes it when the owner regenerates — best-effort and unawaited, so tidying
   up can never turn a successful generation into an error. It stops being disposable the moment the owner
   opens Preview or Edit: **once they have looked at it, it is their work, not ours.**
2. **Expire what already accumulated.** `StaleCampaignDraftSweeper` runs on the existing nightly pass in
   `InsightsAnomalyScheduler`, alongside anomaly detection and the recommendation feed. Four conditions,
   every one load-bearing: `created_by_source='ai_agent'` · `status='draft' AND sent_at IS NULL` · older
   than `STALE_DRAFT_DAYS = 60` · **not referenced by any `run_campaign` rule** (delete a template a live
   workflow points at and the shop keeps a published workflow that quietly does nothing on every firing).

**Verified by a read-only dry-run against staging** (`backend/scripts/_qa_stale_draft_dryrun.ts`), which
also prices each guard by what it protects: the first nightly pass would remove **37**, while the guards
hold back 7 manual drafts, 15 already-sent AI campaigns, and 74 drafts newer than 60 days. 7 unit tests
pin each clause; they can only inspect the statement, which is why the dry-run exists.

**60 days is deliberately generous.** Keeping one too long costs a row in a list. Deleting one a shop
meant to use costs work they cannot get back and had no warning was at risk.

**Not covered:** a draft generated and then abandoned by closing the modal without saving. Deleting on
close would punish an accidental close; the sweeper collects these at 60 days instead.

#### Verified on staging 2026-08-05 — both fixes, end to end

**The sweeper: 8/8, live.** `_qa_stale_draft_sweep_live.ts` invoked the real `sweep()` (not a copy of its
SQL) after snapshotting all 37 rows. Removed exactly 37 — peanut 28, `1111` 8, `shop-3` 1; total 214 → 177.
The assertions that matter are the ones about **what survived**: 8 manual drafts, 37 already-sent AI
campaigns, 74 drafts under 60 days and 0 workflow-referenced drafts all untouched, no `run_campaign` rule
left pointing at a missing campaign, and a second pass deleted 0. A sweeper that deleted everything would
pass a "37 gone" check just as happily, which is why the test is written the other way round. Reversible
via `_qa_stale_draft_restore.ts` + the snapshot JSON.

**The builder: browser + DB, both directions.** Counting rows is what makes this real — the picker
swapping names only shows a selection changed, not that a row went away.

- *Discards:* two "Create it for me" presses in one session left **one** row (45 → 46). The superseded
  draft was gone from the table, not merely deselected. Pre-fix that same sequence left two, and every
  regenerate after it another — which is how peanut reached 73.
- *Stops discarding once opened:* generate → **Preview** → generate again left **both** (47 → 49). The
  previewed draft survived the next generation, as intended: looking at it makes it the owner's work.

The second direction is the one worth having. A fix that only deleted would have passed the first test
and quietly destroyed drafts shops were in the middle of reading.

### 9.5 Deferred BY DECISION — not gaps

- **Branching (if/else)** — only if linear sequences plus exit conditions prove insufficient. They have
  not; `stop_on_booking` covers the common case.
- **Folders / smart lists** — shops have 0–4 workflows. Folders solve nothing at that scale.
- **Build-with-AI authoring** — templates already answer "where do I start", which is the problem it was
  meant to solve.

### 9.6 Known limits, documented rather than fixed

- **Delays are hourly-granular.** `delayHours: 3` means 3–4h, because queued sends drain on the hourly
  tick. Fine for follow-ups; matters only if minute-level timing is ever wanted.
- **An hour-23 schedule cannot be caught up** across midnight if the backend is down for that hour — the
  UTC day changes and the day checks stop matching. Pinned in `AutoMessageCatchUp.test.ts`.
- **Attribution is correlation.** Booked/revenue count orders within 14 days of a message; the UI says so
  on hover. Do not let it be reported as caused.

---

**Key files:** `backend/src/services/AutoMessageSchedulerService.ts` (the engine, 1,021 lines) ·
`backend/src/services/autoMessageActions/registry.ts` (the 6 actions + what each one NEEDS) ·
`backend/src/domains/messaging/controllers/AutoMessageController.ts:26` (`VALID_EVENT_TYPES`,
`SHOP_SCOPED_EVENTS`, `actionTriggerError` — the pairing guard) ·
`backend/src/domains/messaging/routes.ts:22` (`autoMessageGuard` — gated, dark) ·
`backend/src/config/featureTiers.ts:26,56` (`aiCampaignsAdvanced` + its rollout flag) ·
`frontend/src/components/messaging/AutoMessageRuleModal.tsx` (the builder, 1,593 lines) ·
`frontend/src/components/messaging/AutoMessagesManager.tsx` ·
`frontend/src/components/shop/tabs/MarketingTab.tsx:732` (where it's mounted) ·
`backend/src/middleware/tierGuard.ts` (`requireTierRollout`).
Related: [[project-ai-campaigns-advanced-state]], [[project-pricing-rollout-state]],
[[project-auto-replies-channel-expansion-state]], [[project-ai-memory-state]] (the other half of the sheet's
"AI Memory & Automation" line).
