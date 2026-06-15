# Engineering Scope — `flat_tier` plan type in `AdBillingService`

**Date:** 2026-06-15
**Status:** Scope only — no code written. Standing rule: do not build/commit until exec signs off Section 5
of `ads-flat-tier-decision-memo.md`.
**Grounded in:** `backend/src/domains/AdsDomain/services/AdBillingService.ts`,
`repositories/BillingPlanRepository.ts`, `repositories/BillingChargeRepository.ts`,
`backend/migrations/151_create_ad_billing.sql`.

---

## 1. Key finding — a flat tier ≈ Plan A mechanically

The existing **Plan A** is already "a flat monthly fee per shop, no per-campaign accrual" (`accrueMonthlyDashboard`
upserts one `plan_a_dashboard` charge per shop per month from `dashboard_fee_cents`). The $199–$999 flat tier is
the **same machinery** with two differences:

1. The fee is **selectable** ($199 / $499 / $999), not hardcoded to Plan A's $299.
2. On the **managed rungs** (FixFlow fronts the ad spend), FixFlow must **recoup the spend at cost** — Plan A
   never does this because Plan A shops pay Facebook directly.

So ~80% of this is "make Plan A's fee configurable + label it." The genuinely new piece is the **at-cost spend
pass-through** for managed rungs.

---

## 2. The one design decision that drives everything: who funds spend?

This maps directly to exec Decision #2 in the memo (account per tier). Two flat-tier shapes:

- **Shop-funded flat tier** (low rung, ~$199): shop pays Facebook directly. **Billing = flat fee only.**
  Identical to Plan A. No spend charge.
- **Managed flat tier** (high rungs, up to $999): FixFlow fronts spend on its own account. **Billing = flat fee
  + spend recouped at cost (zero margin).** Needs a new pass-through charge so FixFlow isn't out-of-pocket.

Recommendation: one plan type `flat`, with a boolean `fronts_spend` that selects between the two shapes. The
flat fee is FixFlow's profit; the pass-through (when `fronts_spend`) is cost-recovery, not profit.

---

## 3. Schema changes (new migration — next free number, verify across branches/bundles)

`ad_billing_plans` — add columns:
```sql
ALTER TABLE ad_billing_plans
  ADD COLUMN flat_fee_cents  INTEGER NOT NULL DEFAULT 0  CHECK (flat_fee_cents >= 0),
  ADD COLUMN flat_tier_name  TEXT,            -- 'starter' | 'growth' | 'business' (reporting/UX only)
  ADD COLUMN fronts_spend    BOOLEAN NOT NULL DEFAULT false;
-- widen the plan_type check:
ALTER TABLE ad_billing_plans DROP CONSTRAINT ad_billing_plans_plan_type_check;
ALTER TABLE ad_billing_plans ADD  CONSTRAINT ad_billing_plans_plan_type_check
  CHECK (plan_type IN ('a','b','c','flat'));
```

`ad_billing_charges` — widen the charge_type check for two new types:
```sql
ALTER TABLE ad_billing_charges DROP CONSTRAINT ad_billing_charges_charge_type_check;
ALTER TABLE ad_billing_charges ADD  CONSTRAINT ad_billing_charges_charge_type_check
  CHECK (charge_type IN ('plan_a_dashboard','plan_b_margin','plan_c_booking',
                         'plan_c_revenue_share','flat_tier_fee','flat_tier_spend_passthrough'));
```
- `flat_tier_fee` — per-shop-per-month (campaign_id NULL → reuses the existing `uq_ad_billing_charge_shop`
  partial index, exactly like `plan_a_dashboard`).
- `flat_tier_spend_passthrough` — per-campaign-per-day (campaign_id set → reuses `uq_ad_billing_charge_campaign`).
  No new indexes needed.

> Per [[feedback-check-migration-number-before-building]]: find next-free NNN across all branches + remotes +
> bundles before assigning. Apply to staging via run-single-migration; the runner records it on deploy.

---

## 4. Code changes

### 4.1 `BillingPlanRepository.ts`
- `AdPlanType` → add `'flat'`.
- `AdBillingPlan` interface → add `flatFeeCents: number`, `flatTierName: string | null`, `frontsSpend: boolean`.
- `DEFAULT_PLAN` unchanged (Plan B stays the implicit default).
- `upsertPlan` INSERT/UPDATE + param list → add the 3 columns.
- `listActiveShopPlans` SELECT + `mapRow` → add the 3 columns.

### 4.2 `BillingChargeRepository.ts`
- `ChargeType` union → add `'flat_tier_fee' | 'flat_tier_spend_passthrough'`. No query changes — `upsert`,
  totals, and `markStatus` are charge-type-agnostic. (Refund path for the ROI-refund safeguard would add a
  `markStatus(..., 'void')` call — separate scope.)

### 4.3 `AdBillingService.ts` — the core
- **`computeCampaignDayCharge`** — add a `flat` branch BEFORE the `return null`:
  ```ts
  if (plan.planType === 'flat') {
    if (!plan.frontsSpend) return null;                 // shop-funded → no per-campaign charge
    if (day.spendCents <= 0) return null;
    return { chargeType: 'flat_tier_spend_passthrough', // recoup at cost, zero margin
             basisCents: day.spendCents, amountCents: day.spendCents };
  }
  ```
- **Monthly flat fee** — generalize `accrueMonthlyDashboard` (or add a sibling `accrueMonthlyFlatTier`) so it
  also emits a `flat_tier_fee` charge for `plan_type='flat'` shops using `flat_fee_cents`. Cleanest: rename the
  loop to `accrueMonthlyFees(monthStart)` handling BOTH `'a'` (→ `plan_a_dashboard`, `dashboardFeeCents`) and
  `'flat'` (→ `flat_tier_fee`, `flatFeeCents`), keyed off plan_type. `runNightly` calls it unchanged.
- The `accrue(windowDays)` loop already skips `plan.planType === 'a'`; change that guard so `'flat'` is NOT
  skipped (managed flat campaigns need the per-day pass-through). Shop-funded flat returns null from
  `computeCampaignDayCharge` anyway, so it's safe to let them through.

### 4.4 `BillingController.ts` + routes
- `PUT /ads/shops/:shopId/billing-plan` validation → accept `planType: 'flat'` + require `flatFeeCents` (or a
  `flatTierName` that maps to a fee) + `frontsSpend`. Mirror the existing `'a'|'b'|'c'` guard.

### 4.5 Frontend `BillingPanel.tsx` + `ads.ts`
- Plan selector gains a **Flat tier** option → tier dropdown (Starter $199 / Growth $499 / Business $999) +
  a "FixFlow manages spend" toggle (`frontsSpend`). Types in `ads.ts` add the 3 fields. Admin-only, unchanged
  placement (campaign detail).

---

## 5. Tier → fee + inclusions mapping (config, not schema)

Proposed defaults (memo §6, Decision #3 — pending exec confirmation). Only `flat_fee_cents` + `fronts_spend`
touch the **billing** path; the rest are feature-gating config consumed elsewhere (campaign-create limits,
channel options, AI auto-answer toggle) — listed here so the full tier shape lives in one place.

| Tier name | `flat_fee_cents` | `fronts_spend` | Account model | Campaigns | Channels | Spend ceiling | AI auto-answer |
|---|---|---|---|---|---|---|---|
| `starter` | 19900 ($199) | false | shop's own | 1 | Facebook | ~$1,000/mo | off |
| `growth` | 49900 ($499) | true | FixFlow managed | 3 | FB + Instagram | ~$3,000/mo | on |
| `business` | 99900 ($999) | true | FixFlow managed | 10 | FB + IG + Google | ~$6,000+/mo | on |

- **Billing-relevant only:** `flat_fee_cents` (the monthly fee accrued as `flat_tier_fee`) and `fronts_spend`
  (whether the at-cost `flat_tier_spend_passthrough` charge applies). Both are admin-overridable per shop.
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

- **Effort:** ~1 day for the flat-tier billing itself (migration + repo fields + the two service branches +
  controller/FE). It rides entirely on the existing accrual + idempotent-upsert + Stripe-bundling machinery.
- **Tests** (extend `tests/services/AdsSafeguardRoi.test.ts` or a new billing spec — `computeCampaignDayCharge`
  is already PURE and unit-tested):
  1. `flat` + `frontsSpend=false` → `computeCampaignDayCharge` returns null (shop-funded).
  2. `flat` + `frontsSpend=true` → returns `flat_tier_spend_passthrough` with `amountCents === spendCents`
     (zero margin — assert FixFlow profit on spend is 0).
  3. Monthly accrual emits one `flat_tier_fee` of `flatFeeCents` per flat shop, idempotent on re-run.
  4. A flat shop's `getShopTotals` = monthly fee + summed pass-through (managed) / = monthly fee only (funded).

---

## 8. Open decisions (block the build)

1. Exec memo Decisions #1–#3 (spend funding, account per tier, tier fee amounts) — these set the table in §5.
2. Confirm `flat` as a 4th plan type vs. overloading Plan A. **Recommend a distinct `flat` type** so reporting
   cleanly separates managed-flat revenue from Plan A dashboard revenue and from Plan B margin.
3. Keep A/B/C available alongside flat (memo Decision #4)? If yes, no removal; flat is purely additive — which
   is the low-risk path and what this scope assumes.
