# Implementation Plan — Ads Relationship Lifecycle

**Date:** 2026-06-16
**Status:** Plan — no code beyond what's already built. Standing rule: don't build/commit until told.
**Implements:** `ads-relationship-lifecycle-design.md` (decisions #1–#5 + §9 money safeguards).
**Grounded in built code:** `EnrollmentController`/`EnrollmentRepository`/`ad_enrollment_requests`,
`BillingPlanRepository`/`AdBillingService`(`accrueMonthlyFees`)/`BillingChargeRepository`/`AdBillingStripeService`,
`SafeguardScheduler` (nightly), `AdEnrollmentCTA`/`AdEnrollmentRequests`/`BillingPanel`/`ShopPlansBillingTab`/
`ads.ts`, `ad_campaigns`/`ad_creatives`.

> Migration numbers: 156 (brief) is the last applied. Next-free = **157+**, but **re-verify against the live
> `schema_migrations` before each** (DB authoritative — [[feedback-check-migration-number-before-building]]).

---

## 0. Reuse / refactor / remove map (the lifecycle supersedes parts of what's built)

| Built today | Fate under the lifecycle |
|---|---|
| `ad_billing_plans` (flat tier) | **Reuse** as the subscription state of record. + `billing_started_at`, `subscription_status`. |
| `AdBillingService.accrueMonthlyFees` | **Refactor** — bill only when the shop has a live campaign (§9.2). |
| `ad_enrollment_requests` (+ brief #1, mig 156) | **Repurpose/retire** — opt-in becomes self-serve subscribe; the **brief moves to `ad_campaign_requests`**. |
| `EnrollmentController.decideEnrollment` (admin approve) | **Remove** — no admin approval of the subscription (decision #5). |
| `EnrollmentController.requestAds` | **Refactor** → self-serve `subscribe` (sets tier immediately). |
| `AdEnrollmentRequests` (admin "approve shops") | **Repurpose** → "campaign requests to build" queue. |
| `AdEnrollmentCTA` (shop request form) | **Refactor** → subscribe + first campaign request (brief). |
| `needs_info` comms (scope #2) | **Drop** — superseded by the durable `ad_messages` thread (decision #4). |
| `BillingPanel` (admin tier selector) | **Reuse** — already flat-tier; gains plan-change history view. |
| `ShopPlansBillingTab` (hub) | **Reuse/expand** into the full shop Ads dashboard (Phase 5). |
| `AdBillingStripeService` / `StripeService` | **Reuse** — for proration charges + dunning + the (existing) refund path. |
| `SafeguardScheduler.tick` (nightly) | **Reuse** — host the new nightly jobs (scheduled downgrades, dunning, no-campaign checks). |

This is the "clean/reuse previous code" the lifecycle requires — mostly **refactor**, little waste.

---

## 1. Build phases (ordered; each compiles, type-checks, ships behind the flag)

### Phase 1 — Capacity + usage + bill-at-first-live  *(money-safe foundation; mostly reuse)*  ~1–1.5d
- **`TIER_LIMITS`** config (code): starter 1 / growth 3 / business 10 campaigns + channels + aiAutoAnswer.
- **Capacity helper** `countCommittedCampaigns(shopId)` = `live + building + approved` (§9.5).
- **§9.2 bill-at-first-live:** `accrueMonthlyFees` accrues `flat_tier_fee` **only** for shops with ≥1 live
  campaign; add `ad_billing_plans.billing_started_at` (set when first campaign goes live). Migration 157.
- Surface **usage (X/Y)** read for the hub.
- Tests: capacity count; accrual skips no-campaign shops; accrues once a campaign is live.

### Phase 2 — Durable comms thread  *(de-risk the money/communication concern early)*  ~1.5–2d
- **`ad_messages`** table (migration 158): author shop/admin/system, body, kind message|event.
- `LeadMessage`-style repo + endpoints (`GET/POST /ads/shop/messages`, `/ads/admin/shops/:id/messages`).
- **Auto-post lifecycle events** (subscribe, tier change, request approved/declined, invoice) as `event` rows.
- Thread UI: shop (in the hub) + admin (in the ads tab). Reuse `NotificationRepository` for the ping.
- **Removes** the `needs_info` plan from scope #2.

### Phase 3 — Campaign requests  *(recurring; capacity-aware; concierge build)*  ~2–3d
- **`ad_campaign_requests`** table (migration 159) — brief fields move here; status pending/approved/building/
  live/declined; `campaign_id` link. **Migrate** the brief data off `ad_enrollment_requests`.
- Shop submit → **capacity check** (§9.5) → soft-block + upsell at the cap (decision #2).
- Admin queue (**repurpose `AdEnrollmentRequests`**) → review (via thread) → build `ad_campaigns` → link →
  `live` → triggers billing start (§9.2) + thread event.
- §9.4 declined → not billed; revise/resubmit.
- Tests: capacity block + upsell; build→link→first-live billing; declined path.

### Phase 4 — Self-serve subscribe + tier change + proration + payment gate  *(the money core)*  ~3d
- **Self-serve subscribe** (§2.A/#5): refactor `requestAds`→`subscribe` — sets `ad_billing_plans` tier
  immediately, **requires a saved card first (§9.1)**; **remove `decideEnrollment` approval**.
- **`ad_plan_changes`** table (migration 160): tier history + scheduled downgrades.
  - Upgrade: immediate + **prorated charge** via `AdBillingStripeService` (decision #1).
  - Downgrade: `scheduled` → applied at next cycle in `SafeguardScheduler.tick`; **§9.7** new change supersedes
    a pending scheduled one; **decision #3** overflow → shop picks keepers, rest auto-pause.
- **§9.1 dunning:** failed charge → `past_due` → (retry window) → `paused`; nightly in the scheduler.
- **§9.3 cancel:** period-end, campaigns stop, no prorated refund.
- Tests (pure where possible): proration math, downgrade scheduling/supersession, overflow keeper-selection,
  dunning transitions.

### Phase 5 — Shop dashboard + Meta-connect gate  ~2d
- **Expand `ShopPlansBillingTab`** AI-Ads area → current tier + inclusions, **usage (X/Y)**, billing + next
  charge + **plan-change history**, upgrade/downgrade controls, **request a campaign**, and the **thread**.
- **§9.6 Meta-connect gate:** model `shops.ads_account_connected` (or reuse migration-148 meta columns) as a
  precondition — a campaign can't go `live` unconnected (full OAuth is the separate Stage-4 work). Add the
  "Connect ad account" affordance (stubbed until the Meta App exists).
- Admin mirror: per-shop tier + usage + history + thread.

**Recommended order: 1 → 2 → 3 → 4 → 5.** (Capacity+billing-safety and comms first; then requests; then the
heavier self-serve/proration money core; then the unified dashboard.)

---

## 2. Cross-cutting
- **Flag:** all behind `NEXT_PUBLIC_ADS_DASHBOARD_ENABLED` / the existing ads gates; real money behind
  `ADS_BILLING_STRIPE_ENABLED` (accrue-only until on).
- **Verification per phase:** backend `npm run build` (exit 0) + tsc 0; frontend tsc 0-net-new (297 baseline);
  unit tests for pure logic (capacity, proration, dunning); extend `qa-ads-enrollment.ts` (now `qa-ads-lifecycle`)
  for the new flows on staging.
- **Data migration:** brief rows move `ad_enrollment_requests` → `ad_campaign_requests` (Phase 3). No prod
  rows today (staging-only/flag-gated), so low risk.

## 3. Effort
≈ **9–13 days** total across Phases 1–5. Phase 4 is the heaviest (self-serve money core). Each phase is
independently shippable behind the flag.

## 4. Still gated / out of scope (unchanged)
Live Meta/Google OAuth + ad-set modeling (Stage 4), outbound lead transport, AI auto-booking. Per
[[project-ads-system-state]] and the lifecycle design §7.
