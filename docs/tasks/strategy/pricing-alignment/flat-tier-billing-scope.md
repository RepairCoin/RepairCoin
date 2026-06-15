# Engineering Scope — `flat_tier` plan type in `AdBillingService`

**Date:** 2026-06-15
**Status:** Scope only — no code written. **All exec decisions locked (memo #1–#4); build is unblocked.**
Standing rule: do not build/commit until the user says so.
**Grounded in:** `backend/src/domains/AdsDomain/services/AdBillingService.ts`,
`repositories/BillingPlanRepository.ts`, `repositories/BillingChargeRepository.ts`,
`backend/migrations/151_create_ad_billing.sql`.

---

## 1. Key finding — a flat tier ≈ Plan A mechanically

The existing **Plan A** is already "a flat monthly fee per shop, no per-campaign accrual" (`accrueMonthlyDashboard`
upserts one `plan_a_dashboard` charge per shop per month from `dashboard_fee_cents`). The $199–$999 flat tier is
the **same machinery** with one difference: the fee is **selectable** ($199 / $499 / $999), not hardcoded to
Plan A's $299.

That's essentially it — "make Plan A's flat fee configurable + label it." **Billing = flat fee only**, because
the shop pays ad-spend directly (DECIDED §2), so there's no spend pass-through to bill.

---

## 2. Spend funding — DECIDED, and it simplifies this

> **✅ DECIDED 2026-06-15 (memo §2/§3): the shop pays ad-spend DIRECTLY on its OWN ad account, every tier.**

FixFlow never fronts, holds, or recoups ad spend on any rung — so there is **no spend pass-through** and **no
`fronts_spend` flag** needed. Billing is purely the **flat monthly fee** (like Plan A's dashboard fee, just
configurable). This removes the only non-trivial branch the earlier draft worried about; the `flat` plan type
is now a near-clone of Plan A's monthly-fee accrual.

(If FixFlow ever offers a managed-account/front-the-spend variant later, a `fronts_spend` boolean +
`flat_tier_spend_passthrough` charge can be added then — explicitly out of scope for v1.)

---

## 3. Schema changes (migration **155** — verified against the live DB)

> **Migration number = 155.** Verified 2026-06-15 against `schema_migrations` on the staging DB: 154 is
> already taken (`add_device_id_to_refresh_tokens`, a teammate's migration NOT visible in local git — the
> local file scan wrongly suggested 154). The 1000+ versions are a separate baseline series, not the active
> sequence. **Always re-check `SELECT version,name FROM schema_migrations ORDER BY version DESC` right before
> creating the file — a teammate may have taken 155 by then.**

`ad_billing_plans` — add columns (no `fronts_spend` — shop always pays directly, DECIDED §2):
```sql
ALTER TABLE ad_billing_plans
  ADD COLUMN flat_fee_cents  INTEGER NOT NULL DEFAULT 0  CHECK (flat_fee_cents >= 0),
  ADD COLUMN flat_tier_name  TEXT;            -- 'starter' | 'growth' | 'business' (reporting/UX only)
-- widen the plan_type check:
ALTER TABLE ad_billing_plans DROP CONSTRAINT ad_billing_plans_plan_type_check;
ALTER TABLE ad_billing_plans ADD  CONSTRAINT ad_billing_plans_plan_type_check
  CHECK (plan_type IN ('a','b','c','flat'));
```

`ad_billing_charges` — widen the charge_type check for ONE new type (no pass-through — shop funds spend):
```sql
ALTER TABLE ad_billing_charges DROP CONSTRAINT ad_billing_charges_charge_type_check;
ALTER TABLE ad_billing_charges ADD  CONSTRAINT ad_billing_charges_charge_type_check
  CHECK (charge_type IN ('plan_a_dashboard','plan_b_margin','plan_c_booking',
                         'plan_c_revenue_share','flat_tier_fee'));
```
- `flat_tier_fee` — per-shop-per-month (campaign_id NULL → reuses the existing `uq_ad_billing_charge_shop`
  partial index, exactly like `plan_a_dashboard`). No new indexes needed.

> Per [[feedback-check-migration-number-before-building]]: find next-free NNN across all branches + remotes +
> bundles before assigning. Apply to staging via run-single-migration; the runner records it on deploy.

---

## 4. Code changes

### 4.1 `BillingPlanRepository.ts`
- `AdPlanType` → add `'flat'`.
- `AdBillingPlan` interface → add `flatFeeCents: number`, `flatTierName: string | null`.
- `DEFAULT_PLAN` → flip from Plan B to **flat (Growth/$499)** (Decision #4 — flat is the only offered model; see §9).
- `upsertPlan` INSERT/UPDATE + param list → add the 2 columns.
- `listActiveShopPlans` SELECT + `mapRow` → add the 2 columns.

### 4.2 `BillingChargeRepository.ts`
- `ChargeType` union → add `'flat_tier_fee'`. No query changes — `upsert`, totals, and `markStatus` are
  charge-type-agnostic. (Refund path for the ROI-refund safeguard would add a `markStatus(..., 'void')` call —
  separate scope.)

### 4.3 `AdBillingService.ts` — the core
- **`computeCampaignDayCharge`** — a `flat` plan accrues **nothing per campaign-day** (shop pays spend
  directly; no margin, no pass-through). It returns `null` like Plan A — so no code change is even required
  here beyond letting `'flat'` fall through to the existing `return null`.
- **Monthly flat fee** — generalize `accrueMonthlyDashboard` (or add a sibling `accrueMonthlyFlatTier`) so it
  also emits a `flat_tier_fee` charge for `plan_type='flat'` shops using `flat_fee_cents`. Cleanest: rename the
  loop to `accrueMonthlyFees(monthStart)` handling BOTH `'a'` (→ `plan_a_dashboard`, `dashboardFeeCents`) and
  `'flat'` (→ `flat_tier_fee`, `flatFeeCents`), keyed off plan_type. `runNightly` calls it unchanged.
- The `accrue(windowDays)` loop already skips `plan.planType === 'a'`; **also skip `'flat'`** (flat tiers accrue
  monthly, not per-campaign-day) — a one-token guard change.

### 4.4 `BillingController.ts` + routes
- `PUT /ads/shops/:shopId/billing-plan` validation → accept `planType: 'flat'` + require `flatFeeCents` (or a
  `flatTierName` that maps to a fee). Mirror the existing `'a'|'b'|'c'` guard.

### 4.5 Frontend `BillingPanel.tsx` + `ads.ts`
- Plan selector gains a **Flat tier** option → tier dropdown (Starter $199 / Growth $499 / Business $999).
  Types in `ads.ts` add the 2 fields. Admin-only, unchanged placement (campaign detail).

---

## 5. Tier → fee + inclusions mapping (config, not schema)

✅ CONFIRMED (memo §6, Decision #3). Only `flat_fee_cents` touches the **billing** path; the rest are
feature-gating config consumed elsewhere (campaign-create limits, channel options, AI auto-answer toggle) —
listed here so the full tier shape lives in one place.

Account model is the **shop's own ad account on every tier** (DECIDED §2) — shop pays spend directly.

| Tier name | `flat_fee_cents` | Campaigns | Channels | Spend ceiling | AI auto-answer |
|---|---|---|---|---|---|
| `starter` | 19900 ($199) | 1 | Facebook | ~$1,000/mo | off |
| `growth` | 49900 ($499) | 3 | FB + Instagram | ~$3,000/mo | on |
| `business` | 99900 ($999) | 10 | FB + IG + Google | ~$6,000+/mo | on |

- **Billing-relevant only:** `flat_fee_cents` (the monthly fee accrued as `flat_tier_fee`). Admin-overridable
  per shop. No spend pass-through — shop pays Facebook/Google directly.
- **Feature-gating (separate from billing):** campaign count, channels, spend ceiling, AI auto-answer. These
  enforce via campaign-create validation + the existing channel/AI toggles, not `AdBillingService`. A
  plan→feature matrix (memo P0 gating work) is the natural home; for v1 they can live as constants keyed by
  `flat_tier_name`.
- **Not built yet:** Google channel (Meta scaffold only) + live spend-ceiling enforcement (manual spend entry
  until Meta App is live). Google + hard ceilings light up with the Meta/Google live work; until then the
  Business channel list and ceilings are admin-honored, not auto-enforced.

---

## 6. What this scope does NOT include (separate work)

- **Stripe collection of flat-tier charges** — `AdBillingStripeService.invoiceShopPending` already bundles ALL
  pending charges by type into invoice lines, so flat-tier charges flow through it for free once the charge
  types exist. No change needed there beyond the master switch `ADS_BILLING_STRIPE_ENABLED`.
- **ROI-refund safeguard** (memo Decision #5/#6) — its own scope: a 60-day evaluator + `markStatus(ids,'void')`
  + a `StripeService.refundInvoice` (doesn't exist yet). ~2–3 days.
- **Test-budget tier / creative-iteration** — operational/UX, not billing.

---

## 7. Effort & tests

- **Effort:** ~0.5–1 day (smaller now that spend pass-through is out): migration (2 cols + 1 charge type) +
  repo fields + the monthly-fee accrual generalization + controller/FE. Rides entirely on the existing accrual
  + idempotent-upsert + Stripe-bundling machinery; no per-campaign-day charge.
- **Tests** (extend `tests/services/AdsSafeguardRoi.test.ts` or a new billing spec — `computeCampaignDayCharge`
  is already PURE and unit-tested):
  1. `flat` plan → `computeCampaignDayCharge` returns null (shop pays spend directly; nothing per campaign-day).
  2. Monthly accrual emits one `flat_tier_fee` of `flatFeeCents` per flat shop, idempotent on re-run.
  3. A flat shop's `getShopTotals` = monthly fee only (no spend on FixFlow's books).

---

## 8. Open decisions (block the build)

1. ~~Spend funding / account per tier~~ — ✅ DECIDED (memo §2/§3): shop pays directly, own account, all tiers.
2. ~~Tier fee amounts~~ — ✅ DECIDED (memo §6): $199 / $499 / $999. The §5 table is final.
3. Confirm `flat` as a distinct plan type vs. overloading Plan A. **Recommend a distinct `flat` type** so
   reporting stays clean and the migration is non-destructive. (engineering call)
4. ~~Keep A/B/C alongside flat?~~ — ✅ **DECIDED (memo #4): FLAT-ONLY, A/B/C retired.** See §9.

---

## 9. Retiring Plan A/B/C (Decision #4)

Flat is now the **only** ads-billing model offered. A/B/C are deprecated — but the code is built, tested, and
committed, so **do NOT rip it out** (risky, no upside). Instead:

- **Keep the A/B/C code dormant.** `computeCampaignDayCharge`'s B/C branches stay; they simply never fire
  because no shop is on plan b/c anymore. `DEFAULT_PLAN` flips from Plan B to **flat (Growth/$499)** as the
  implicit default — or require an explicit tier at enrollment.
- **Switch the two shop-facing touchpoints to flat tiers:**
  1. **Enrollment** (`EnrollmentController` / `requestedPlan`) — offer Starter/Growth/Business instead of a/b/c.
  2. **Admin `BillingPanel`** — the plan selector offers the flat tiers; hide A/B/C (or show them read-only
     for any legacy rows).
- **No data migration needed** — there are no production A/B/C rows (ads billing is staging-only/flag-gated).
  If any exist later, leave them as legacy; new enrollments are flat.
