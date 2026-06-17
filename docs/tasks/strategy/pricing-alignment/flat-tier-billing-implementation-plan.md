# Implementation Plan — Flat-Tier Ads Billing

**Date:** 2026-06-15
**Status:** Plan — no code written yet. Standing rule: do not build/commit until the user says go.
**Implements:** `flat-tier-billing-scope.md` (the "what"); this doc is the ordered "how."
**Decisions:** all locked — shop pays directly (#1/#2), tiers $199/$499/$999 (#3), flat-only / A/B/C retired (#4).

---

## 0. Scope boundary (what this delivers vs. not)

**Delivers:** the flat tiers become **billable** — a `flat` plan type, monthly `flat_tier_fee` accrual, and
A/B/C retired from the shop-facing UI.

**Does NOT deliver (separate work, not blocking):**
- Per-tier **feature enforcement** (1/3/10 campaigns, channel limits, AI-auto-answer on/off) — the
  plan→feature matrix.
- **Live spend-ceiling** enforcement (Meta isn't live; spend is manual entry).

So after this, a "Starter" shop is billed $199/mo correctly but isn't yet technically capped to 1 campaign.

---

## 1. Branch + pre-flight

1. **Build directly on `deo/ads-system`** — this is part of the ads system, not a separate workstream (no new
   branch).
2. **Re-verify the migration number against the live DB** (a teammate may have grabbed 155 since 2026-06-15):
   `SELECT version,name FROM schema_migrations ORDER BY version DESC LIMIT 5`. Expected next-free = **155**
   (154 = `add_device_id_to_refresh_tokens`, a teammate's). If 155 is taken, bump to the next free + update
   the filename. (Per [[feedback-check-migration-number-before-building]] — DB is authoritative, not git.)

---

## 2. Build order (each step compiles before the next)

### Step 1 — Migration `155_create_flat_tier_billing.sql`
- `ALTER TABLE ad_billing_plans ADD COLUMN flat_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (flat_fee_cents >= 0)`,
  `ADD COLUMN flat_tier_name TEXT`.
- Drop+re-add `ad_billing_plans_plan_type_check` → `CHECK (plan_type IN ('a','b','c','flat'))`.
- Drop+re-add `ad_billing_charges_charge_type_check` → add `'flat_tier_fee'`.
- Idempotent (`IF NOT EXISTS` / guarded) so re-runs are safe.
- **Do NOT apply yet** — apply to staging in Step 7 after the code compiles.

### Step 2 — `BillingPlanRepository.ts`
- `AdPlanType` → add `'flat'`.
- `AdBillingPlan` interface → `flatFeeCents: number`, `flatTierName: string | null`.
- `DEFAULT_PLAN` → flip to **flat / Growth** (`planType:'flat', flatFeeCents:49900, flatTierName:'growth'`)
  (Decision #4 — flat is the only offered model). Keep the A/B/C fields in the type for the dormant code.
- `upsertPlan` — add the 2 columns to INSERT/UPDATE + params.
- `listActiveShopPlans` SELECT + `mapRow` — include the 2 columns.

### Step 3 — `BillingChargeRepository.ts`
- `ChargeType` union → add `'flat_tier_fee'`. (No query changes — upsert/totals/markStatus are type-agnostic.)

### Step 4 — `AdBillingService.ts`
- `computeCampaignDayCharge` — `flat` accrues nothing per campaign-day → returns `null` (shop pays spend
  directly). Just let `'flat'` fall through to the existing `return null`.
- Rename/extend `accrueMonthlyDashboard` → `accrueMonthlyFees(monthStart)` handling both `'a'`
  (`plan_a_dashboard`, `dashboardFeeCents`) and `'flat'` (`flat_tier_fee`, `flatFeeCents`), keyed off
  plan_type. `runNightly` call unchanged.
- `accrue(windowDays)` loop — also skip `plan.planType === 'flat'` (one-token guard; flat accrues monthly).

### Step 5 — `BillingController.ts` + routes
- `PUT /ads/shops/:shopId/billing-plan` — accept `planType:'flat'` + require `flatFeeCents` (or `flatTierName`
  → fee map). Extend the existing `'a'|'b'|'c'` guard.

### Step 6 — A/B/C retirement (Decision #4) + frontend
- `EnrollmentController` / `requestedPlan` — offer **Starter/Growth/Business** instead of a/b/c.
- `frontend/src/services/api/ads.ts` — add `flatFeeCents`/`flatTierName` to the billing-plan type; tier helper
  (name → fee).
- `frontend/src/components/ads/BillingPanel.tsx` — plan selector offers the flat tiers; hide A/B/C (show
  read-only only for any legacy rows). Mirror the shop enrollment CTA (`AdEnrollmentCTA`) to the 3 tiers.
- Keep A/B/C code paths intact but unreachable from the UI (dormant, non-destructive).

### Step 7 — Verify
- `cd backend && npm run build` (exit 0) + `npm run lint:fix`.
- Apply migration 155 to staging via the project's run-single-migration (NOT recorded in schema_migrations
  until normal deploy — matches how 146–153 were handled).
- `cd frontend && npx tsc --noEmit` → confirm 0 net new vs the 297 baseline.

---

## 3. Tests (`computeCampaignDayCharge` + accrual are PURE)
Extend `backend/tests/services/AdsSafeguardRoi.test.ts` or a new `AdsFlatBilling.test.ts`:
1. `flat` plan → `computeCampaignDayCharge` returns null (nothing per campaign-day).
2. `accrueMonthlyFees` emits one `flat_tier_fee` of `flatFeeCents` per flat shop; idempotent on re-run.
3. A flat shop's `getShopTotals` = monthly fee only (no spend on FixFlow's books).
4. Plan A still emits `plan_a_dashboard` (no regression from the accrual rename).
5. Tier map: starter→19900, growth→49900, business→99900.

---

## 4. Rollout & flags
- Ads billing is already gated (`ADS_BILLING_STRIPE_ENABLED` for real collection; accrual is ledger-only).
  Flat-tier accrual rides the same nightly `SafeguardScheduler.tick` path — no new flag needed.
- Stripe collection needs **no change**: `AdBillingStripeService.invoiceShopPending` already bundles any
  pending charge type, so `flat_tier_fee` flows through once the type exists.

---

## 5. Risks & rollback
- **Migration collision** — mitigated by the Step 1 DB re-check. If a dup ships, fix forward (rename to next
  free), never rewrite shared history.
- **Accrual rename regression** — Test #4 guards Plan A; the rename is additive.
- **Rollback** — flat is additive; reverting = stop offering the `flat` plan (DEFAULT_PLAN back to B) + drop the
  unused columns later. No destructive data change (no prod A/B/C rows).

---

## 6. Estimate
~0.5–1 day (migration + 4 backend files + controller + 3 FE touchpoints + 5 tests). Rides the existing accrual,
idempotent-upsert, and Stripe-bundling machinery.

## 7. Done = 
- Admin can set a shop to Starter/Growth/Business; the nightly job accrues the right `flat_tier_fee`.
- Shop enrollment + hub AI-Ads card request a flat tier (not a/b/c).
- A/B/C no longer offered in any UI; dormant in code.
- Build clean, tests pass, migration 155 applied to staging.
