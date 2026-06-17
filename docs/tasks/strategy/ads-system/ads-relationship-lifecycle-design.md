# Design — Ads Relationship Lifecycle

**Date:** 2026-06-16
**Status:** Design (decisions locked). No code beyond what's already built. Standing rule: don't build/commit until told.
**Why:** the current opt-in is a one-shot handshake (request → approve → done). It has no ongoing campaign
requests, no capacity model, no shop-facing tier record, no tier-change flow, and only ephemeral one-way
comms — not solid for an ongoing, money-bearing relationship. This designs the complete lifecycle.
**Builds on:** flat-tier billing (built), campaign brief #1 (built), enrollment opt-in (built),
`ads-enrollment-brief-and-comms-scope.md` (the brief/comms scope this supersedes for comms).

---

## 1. Locked decisions (2026-06-16)

1. **Tier changes** — **upgrades apply immediately + prorated**; **downgrades take effect next billing cycle**.
2. **Capacity** — **soft-block + upsell**: at the tier's campaign limit, block the new request and surface a
   one-click upgrade.
3. **Downgrade overflow** — at the cycle flip, if over the new limit, **the shop picks which campaign(s) to keep**;
   the rest **auto-pause** (reversible).
4. **Comms** — a **durable two-way message thread** per shop (audit trail; money is involved).
5. **Model** — **hybrid**: **all tier selection is shop self-serve** (the billing knob — including the
   **initial opt-in**, which is just the first tier change none→tier: active + billed immediately, **no admin
   approval**); campaign building stays **concierge** (shop requests w/ brief, admin builds — Q8 protects ad
   quality + agency standing). The admin gate is on campaigns, never on the subscription.

---

## 2. Two lifecycles (today they're mashed into one)

### A. Ads subscription (the tier) — persistent, visible, changeable
- **States:** `none → active → active'(after change) → paused → cancelled` (no `pending` — the subscription
  is never admin-gated).
- **Initial opt-in = self-serve, immediate (no admin approval).** Shop picks a tier → subscription record
  **active** (requires a saved card, §9.1). They then submit a **campaign request** (the brief) which the admin
  builds — that's the only gate. **The monthly fee begins only when the first campaign goes live (§9.2)** — an
  idle subscription is never billed.
- **Tier change (while active):** **self-serve.** Upgrade → immediate + prorated charge. Downgrade →
  **scheduled** for next cycle (no mid-cycle disruption, no credit-gaming).
- *(This changes the current built flow, which admin-approves the enrollment. The approval step goes away;
  the admin's queue becomes "campaign requests to build," not "shops to approve.")*
- **Always visible** to the shop (tier, inclusions, fee, next charge, change controls) + **full history**.

### B. Campaign requests — recurring, capacity-aware, first-class
- A shop submits **many over time** (not one-shot). Each carries the **brief** (services/budget/offer/radius/goal).
- **States:** `pending → approved → building → live → (paused | ended)` · or `pending → declined`.
- **Capacity-checked at submit** against the tier's campaign limit (decision #2).
- Each links to a real `ad_campaigns` row once the admin builds it.

### C. Communication + audit — the money layer
- A **durable per-shop thread** (`ad_messages`): two-way, timestamped, nothing overwritten.
- **System auto-posts** lifecycle events into the same thread (tier changed, campaign approved/declined, invoice
  sent) → one unified, permanent timeline both sides can refer to.

### D. Shop dashboard (Plans & Billing → Ads section)
Surfaces it all: current tier + inclusions, **usage (X/Y campaigns)**, billing + next charge + history,
**upgrade/downgrade**, **request a campaign**, campaign-request list, and the **message thread**.

---

## 3. Data model

**Reuse (built):**
- `ad_billing_plans` — the shop's active tier (`plan_type='flat'`, `flat_tier_name`, `flat_fee_cents`). The
  subscription state of record.
- `ad_billing_charges` — monthly `flat_tier_fee` accrual (`accrueMonthlyFees`).
- `ad_enrollment_requests` — the **opt-in** handshake (+ the brief from #1; brief migrates to campaign_requests).
- `ad_campaigns` — the built campaigns.

**Tier capacity (code config, not schema)** — extend `FLAT_TIER_FEES` with a `TIER_LIMITS` map:
```ts
starter:  { maxCampaigns: 1,  channels: ['facebook'],                    aiAutoAnswer: false }
growth:   { maxCampaigns: 3,  channels: ['facebook','instagram'],        aiAutoAnswer: true  }
business: { maxCampaigns: 10, channels: ['facebook','instagram','google'], aiAutoAnswer: true }
```

> **Capacity unit = campaigns, and in v1 `1 campaign = 1 ad set` (one budget + one audience).** Our schema is
> flat — `ad_campaigns` (one `daily_budget_cents`) → `ad_creatives`; **there is no ad-set entity.** On the real
> platforms the hierarchy is Campaign → Ad Set(s) → Ad(s), so one campaign *can* fan out into many ad sets — but
> we don't model that yet, so counting campaigns accurately counts "things running." **Stage-4 refinement (when
> live Meta exposes multiple ad sets per campaign):** counting campaigns becomes leaky (a shop could pack many
> ad sets/budgets into one campaign), so either model ad sets explicitly **or** switch the tier guardrail to a
> **managed monthly-spend ceiling** (adset-proof). See §7.

**New tables:**

`ad_plan_changes` — tier-change history + the scheduled-downgrade mechanism:
```sql
id UUID PK, shop_id TEXT, from_tier TEXT, to_tier TEXT,
kind TEXT CHECK (kind IN ('upgrade','downgrade','cancel')),
status TEXT CHECK (status IN ('applied','scheduled','cancelled')),   -- downgrades sit 'scheduled' until cycle flip
effective_at TIMESTAMPTZ, prorated_amount_cents INTEGER,             -- + for upgrade charge, - for credit
requested_by TEXT, created_at TIMESTAMPTZ
```

`ad_campaign_requests` — recurring campaign asks (the brief lives here for 2nd+ campaigns):
```sql
id UUID PK, shop_id TEXT,
promote_service_ids TEXT[], monthly_budget_cents INT, offer TEXT, target_radius_miles INT, goal TEXT,
status TEXT CHECK (status IN ('pending','approved','building','live','declined','cancelled')),
campaign_id UUID NULL REFERENCES ad_campaigns(id),                   -- set when admin builds it
decided_by TEXT, decided_at TIMESTAMPTZ, created_at TIMESTAMPTZ
```

`ad_messages` — durable two-way thread (decision #4):
```sql
id UUID PK, shop_id TEXT,
author TEXT CHECK (author IN ('shop','admin','system')),
body TEXT, kind TEXT DEFAULT 'message',                             -- 'message' | 'event' (auto-posted lifecycle)
created_at TIMESTAMPTZ
```

> Migration numbers: verify next-free against the live `schema_migrations` at build time (DB authoritative —
> see [[feedback-check-migration-number-before-building]]).

---

## 4. Key flows

### Tier change (self-serve)
1. Shop opens Plans & Billing → Ads → **Change tier**.
2. **Upgrade:** apply now → bump `ad_billing_plans` tier + write `ad_plan_changes(kind=upgrade,status=applied)` +
   a **prorated** charge to `ad_billing_charges` + auto-post to the thread.
3. **Downgrade:** write `ad_plan_changes(kind=downgrade,status=scheduled,effective_at=next cycle)`; tier stays
   until the flip. The nightly job applies scheduled downgrades at the cycle boundary.
4. **At a downgrade flip, if over the new campaign limit (#3):** prompt the shop to pick which to keep; pause the
   rest (`ad_campaigns.status='paused'`); post the outcome to the thread.

### Campaign request (concierge, capacity-aware)
1. Shop submits a request (brief). **Capacity check:** if active campaigns ≥ tier max → **soft-block + upsell**
   (no row created; show "upgrade for more").
2. Otherwise create `ad_campaign_requests(status=pending)` + notify admin + thread post.
3. Admin reviews (can ask via thread), **approves**, **builds** the `ad_campaigns` row → links it → status
   `building`→`live`. Each step posts to the thread.

### Comms (always-on)
- Either side posts to `ad_messages` anytime; the other is notified. All lifecycle events auto-post as `event`
  rows, so the thread is the single source of "what was agreed."

---

## 5. How the built work folds in
- **Flat-tier billing (built)** = the subscription billing engine. Tier changes just add proration +
  `ad_plan_changes`; `accrueMonthlyFees` already handles the monthly fee.
- **Campaign brief #1 (built on `ad_enrollment_requests`)** = the brief. In the target it moves onto
  `ad_campaign_requests` (the opt-in keeps a copy for the *first* campaign; 2nd+ go through campaign_requests).
- **Comms scope #2 (`needs_info`)** = **superseded** by the durable thread (decision #4).
- **Enrollment opt-in (built)** = becomes the **self-serve subscribe** (tier set immediately on the shop's
  pick; the admin-approval step is removed). The built `AdEnrollmentRequests` admin panel repurposes from
  "approve shops" → "campaign requests to build" (Phase 2). The brief moves to `ad_campaign_requests`.

---

## 6. Phasing (incremental build)

| Phase | Scope | Status |
|---|---|---|
| 0 | Opt-in + tier set + first-campaign brief | ✅ built |
| 1 | **Tier capacity config + usage display** (TIER_LIMITS; "X/Y campaigns"; soft-block + upsell) | scoped here |
| 2 | **Campaign requests** (`ad_campaign_requests`; recurring; brief moves here; admin build→link) | scoped here |
| 3 | **Tier change flow** (`ad_plan_changes`; upgrade immediate+prorate; downgrade scheduled; overflow pick-keepers) | scoped here |
| 4 | **Durable comms thread** (`ad_messages`; two-way + auto-posted events) | scoped here |
| 5 | **Shop dashboard** Ads section (tier+inclusions+usage+billing+history+change+request+thread) | scoped here |

Each phase is buildable independently and behind the existing flag. Recommended order: 1 → 4 → 2 → 3 → 5 (capacity
+ comms first, since they de-risk the money/communication concerns; then recurring requests, tier changes, and
the unified dashboard).

---

## 7. Still gated / out of scope (unchanged)
- **Live Meta/Google connection** (OAuth onto the shop's account) — the campaign only goes truly live with the
  registered Meta App (Stage 4). Until then campaigns are records + manual metrics.
- **Outbound lead transport** (SMS/WhatsApp/Messenger) + **AI auto-booking** — separate.
- **Ad-set capacity refinement (Stage 4+).** v1 models a flat campaign (1 campaign = 1 budget/audience = 1
  implicit ad set; no ad-set table) and limits by campaign count. When live Meta exposes multiple ad sets per
  campaign, revisit decision #2: model ad sets explicitly and/or move the tier guardrail to a managed
  monthly-spend ceiling so the limit can't be gamed by packing ad sets into one campaign.
- Per [[project-ads-system-state]] and the pricing-alignment docs.

---

## 8. Decisions still open (minor)
- ✅ **Resolved 2026-06-16:** initial opt-in is **self-serve, immediate, no admin approval** (consistent with #5
  — it's the first tier change). Admin gate is on campaign building only.
- Proration rounding/midnight boundary for upgrades (rec: prorate by remaining days in the cycle).
- Thread retention (rec: keep indefinitely — it's the money audit trail).

---

## 9. Edge cases & money safeguards (closes the loophole audit, 2026-06-16)

The §1–§8 happy path was solid; these rules make the **unhappy / money paths** solid too.

> **Implementation status (2026-06-16).** Built & wired: 9.1 card gate, 9.2 bill-at-first-live, 9.3 cancel
> (pauses campaigns, no refund), 9.5 capacity at submit + build **+ reactivation gate (new)**, 9.6 connect gate,
> 9.7 supersede. **Still outstanding (tracked):** 9.1 *dunning* state machine (`past_due → paused`, moot until
> `ADS_BILLING_STRIPE_ENABLED`); decision #3 *interactive keeper-selection* (today: auto-keep-oldest, pause newest
> excess); 9.2 *admin build SLA + escalation*; shop-side *"Connect ad account"* affordance (admin-flip only).
> Real money movement (proration/accrual/refund) and Stage-4 (Meta OAuth + ad-set modeling) remain gated per §7.

### 9.1 Payment method required + dunning
- **A tier cannot activate without a saved payment method.** Self-serve subscribe → if no card on file, route to
  the existing `PaymentMethodsTab` first. No card → no active subscription (no "active but unpaid").
- **Failed charge → dunning:** subscription → `past_due` (retry window, e.g. 7 days) → if still unpaid →
  `paused` (campaigns pause). Each step notifies + posts to the thread. Real collection stays behind
  `ADS_BILLING_STRIPE_ENABLED` (accrue-only until on).

### 9.2 Billing starts at FIRST CAMPAIGN LIVE — never pay for nothing *(refines §2.A / decision #1)*
- Self-serve subscribe sets the **intended tier** and activates the *record*, but **the monthly tier fee does
  not begin until the shop's first campaign is live.** An idle subscription (no live campaign) is **not billed**.
- This single rule kills "paying for nothing" (no campaign requested, admin hasn't built, or Meta not connected
  → no charge) and the declined-request case (9.4).
- **Upgrades** (shop already has a live campaign) bill **immediately + prorated** per decision #1. Downgrades
  next cycle per #1.
- **Admin build SLA:** an approved campaign request should be built within **N business days** (e.g. 5); breach
  → escalate + still no billing (since not live).

### 9.3 Cancel / refund
- Shop can **cancel anytime** (self-serve). Effect: tier → `cancelled` at **period end** (no new charge),
  campaigns **pause/stop**, the shop's own ad spend stops. **No prorated refund** of the current period's
  management fee (standard SaaS — access runs to period end). Underperformance make-goods are handled by the
  separate **ROI-refund** safeguard (9.8), not by cancel.

### 9.4 Declined campaign request
- If a request is declined and the shop has **no other live campaign**, it is **not billed** (per 9.2). The
  shop can revise + resubmit via the thread, or cancel with no charge. No "stuck paying with nothing."

### 9.5 Capacity counting (precise definition)
- A campaign counts toward the tier limit when it is **`live` OR `building` OR `approved`** (in-flight to live).
  `pending` requests may queue, but a **new request is soft-blocked + upsold** once `live+building+approved ≥
  tier max`. `paused` / `ended` / `declined` do **not** count.
- **Reactivating a paused campaign re-checks capacity** — blocked + upsell if at the cap (closes the
  downgrade-then-unpause loophole). ✅ **Built 2026-06-16** — `CampaignController.updateCampaign` intercepts any
  transition to `status='active'` and re-runs `getShopCapacity`; at the cap it returns 409 `tier_capacity_reached`
  with the upsell (admin toggle surfaces the message). Submit / build / reactivate now share one capacity rule.

### 9.6 Meta-connect is an activation gate
- A campaign **cannot go `live` without the shop's ad account connected** (live-Meta). The build flow requires
  it; pre-live-Meta this is the manual/record state. Because billing starts at first-live (9.2), an unconnected
  shop is **never billed** — the gate and the billing rule reinforce each other.

### 9.7 One pending tier change at a time
- A new tier change **supersedes** a pending scheduled downgrade: mark the old `ad_plan_changes(status=
  scheduled)` → `cancelled`, then apply the new change. Never two competing pending changes.

### 9.8 ROI-refund ↔ lifecycle
- The **ROI-refund** safeguard (separate scope) is the *backward-looking* make-good — it refunds the
  `flat_tier_fee` for an underperforming campaign. Cancel (9.3) is the *forward-looking* stop. Both post to the
  thread; both operate on the same `ad_billing_charges` the lifecycle accrues.

> Net effect: a shop is billed **only** while it has a live campaign on a connected account with a valid card;
> every money path (no card, failed charge, no campaign, declined, cancel, downgrade overflow, underperformance)
> now has a defined, audit-logged outcome.
