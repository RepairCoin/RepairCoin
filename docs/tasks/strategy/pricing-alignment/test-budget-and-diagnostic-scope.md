# Engineering Scope — Test-Budget Tier + Plain-English Diagnostic

**Date:** 2026-06-15
**Status:** Scope only — no code written. Standing rule: do not build/commit until exec signs off.
**Grounded in:** `migrations/146_create_ads_tables.sql` (`ad_campaigns.daily_budget_cents`,
`ad_performance_daily` funnel cols), `repositories/PerformanceRepository.ts`, `services/RoiCalculator.ts`,
`services/SafeguardScheduler.ts`, `services/LeadAIService.ts` (AI pattern).

These are the two remaining unbuilt launch safeguards from the risk doc (the others — auto-pause is built,
ROI-refund and flat-tier billing are scoped separately). Both are **small** and both ride on the existing
nightly scheduler + performance data.

---

# PART A — Test-Budget Tier (risks-doc §5.5)

**Promise:** *the first month runs at a lower daily spend to prove the system works; once it shows positive
ROI, it graduates to the full budget.* Lowers the shop's entry risk.

## A1. What already exists
- `ad_campaigns.daily_budget_cents` (INT) — the per-campaign daily budget. This is the value Marcus mirrors in
  Meta; it's the natural anchor.
- `RoiCalculator` (ROAS) + `SafeguardScheduler.tick` nightly hook + `started_at` clock — same inputs the
  ROI-refund scope uses.

> Reality note: Meta isn't live yet, so spend is entered manually (`daily_budget_cents` is advisory, not
> enforced against Facebook). The test-budget tier is therefore a **phase + graduation** mechanism, not a live
> spend-throttle. When Meta goes live (gated work), the same `daily_budget_cents` becomes the value pushed to
> the ad set — no rework.

## A2. Schema (new migration — verify next-free NNN per [[feedback-check-migration-number-before-building]])
```sql
ALTER TABLE ad_campaigns
  ADD COLUMN budget_phase      TEXT NOT NULL DEFAULT 'full'
    CHECK (budget_phase IN ('test','full')),
  ADD COLUMN full_budget_cents INTEGER NOT NULL DEFAULT 0 CHECK (full_budget_cents >= 0),
  ADD COLUMN test_started_at   TIMESTAMPTZ,
  ADD COLUMN graduated_at      TIMESTAMPTZ;
```
- During test: `daily_budget_cents` holds the LOW test budget; `full_budget_cents` holds the target to switch
  to on graduation. `budget_phase='test'`, `test_started_at` set at launch.
- Default `'full'` so existing campaigns are unaffected (backward compatible).

## A3. Logic — `BudgetGraduationEvaluator.ts` (mirror SafeguardEvaluator shape)
- **PURE `decide(phase, testStartedAt, asOf, roas, minDays, threshold)` → `'graduate' | 'extend' | 'none'`**
  (unit-testable):
  - `none` if `phase !== 'test'` or `< minDays` (default 30) elapsed.
  - `graduate` if `roas >= threshold` (default 1.0) after `minDays`.
  - `extend` if window elapsed but still under threshold (keep testing or hand to ROI-refund/pause path).
- **`runNightly(asOfDate)`**: list `budget_phase='test'` active campaigns → for each, `getTotals` → ROAS →
  `decide`. On `graduate`: mark **eligible** (`budget_phase` stays test) and notify admin — recommend, don't
  auto-scale. On `extend`: notify admin it's still proving out.
- **Admin graduation action** (`POST /ads/campaigns/:id/graduate`): sets `daily_budget_cents =
  full_budget_cents`, `budget_phase='full'`, `graduated_at`. Admin-confirmed because graduation *raises the
  shop's spend* — same human-gate philosophy as the refund.
- Wire `budgetGraduation.runNightly()` into `SafeguardScheduler.tick` after the safeguard sweep.

## A4. Frontend
- **Create campaign** (AdminAdsTab): a "Start as test budget" toggle → two budget inputs (test daily + full
  daily) + uses `minDays` default. Without the toggle, behaves exactly as today.
- **Campaign detail:** a "Test phase — day X / 30, ROAS Y×" chip + an **"Graduate to full budget"** button
  when eligible. Shop side (`ShopAdsTab`): a read-only "Test phase" badge so the shop understands the smaller
  early budget is intentional.

## A5. Effort & tests
- **Effort:** ~0.5–1 day (schema + pure evaluator + one admin action + UI chip).
- **Tests** (`decide` is PURE): (1) day 12 → `none`; (2) day 31, ROAS 1.4 → `graduate`; (3) day 31, ROAS 0.6
  → `extend`; (4) phase already `full` → `none`.

---

# PART B — Plain-English Diagnostic (risks-doc §5.6)

**Promise:** *when a campaign struggles, the shop gets a clear "here's WHY and what to change," not a wall of
numbers.* Turns blame into a fix-it-together moment.

## B1. What already exists — the full funnel is captured
`ad_performance_daily` already stores **impressions, clicks, leads_captured, bookings_created, spend_cents,
revenue_cents**. The diagnostic is funnel analysis over these — find the weakest stage and explain it.

⚠️ **Gap:** `PerformanceRepository.getTotals` currently sums only spend/revenue/leads/bookings — **not
impressions/clicks**. Fix: extend `CampaignTotals` + the `getTotals` SELECT to include `impressions` and
`clicks` (columns exist; one-line additions). The daily-rows path already returns them.

## B2. Logic — `CampaignDiagnostic.ts`, rule-based core (PURE, deterministic, free)
Walk the funnel top-down and report the **first stage that breaks**, with a cause + recommendation:

| Stage check | Symptom | Plain-English diagnosis + fix |
|---|---|---|
| Impressions very low for spend | ad isn't being shown | "Budget or targeting is too narrow — widen the audience or raise the daily budget." |
| Impressions OK, **CTR low** (clicks/impr) | nobody clicks | "People see the ad but don't click — the image or headline isn't compelling. We'll test new creative." |
| Clicks OK, **lead rate low** (leads/clicks) | clicks don't convert | "People click but don't message — the offer or price is the issue, or the landing page. Try a stronger offer." |
| Leads OK, **booking rate low** (bookings/leads) | leads don't book | "You're getting leads but few book — check response speed and pricing; faster replies convert more." |
| All stages healthy but **ROAS < 1** | math doesn't work | "Conversions are fine but the economics don't — the job value is low vs. ad cost. Advertise a higher-value service." |

- **PURE `diagnose(totals, thresholds)` → { stage, severity, message, recommendation }** — unit-testable, no
  DB, no AI. Thresholds (target CTR, lead rate, booking rate) are constants, tunable later.
- Compose with the existing **booking-rate / responsiveness** signal (`LeadRepository.responsivenessStats`
  from the ROI-refund scope) to strengthen the "leads don't book → respond faster" branch.

## B3. Optional AI polish (v2, behind the spend cap)
- A thin `LeadAIService`-style call (AnthropicClient/Haiku, `SpendCapEnforcer.canSpend`) can turn the
  rule-based facts into a warmer, brand-voiced paragraph. **Not required** — the rule-based output already
  ships a clear message. Keep AI optional so the diagnostic works free + offline and never blocks on budget.

## B4. Surfacing
- **Endpoint:** `GET /ads/campaigns/:id/diagnostic` (admin + shop-own) → returns the diagnose() result.
- **Frontend:** a "Why isn't this working?" card on the campaign perf view (both AdminAdsTab + ShopAdsTab),
  shown when ROAS < 1 or a stage is flagged. Shows the message + recommendation in the readability text floor
  ([[feedback-readability-text-floor]]). This is the §5.6 "diagnostic transparency" the user story promises.

## B5. Effort & tests
- **Effort:** ~1 day rule-based (incl. the getTotals impressions/clicks fix + endpoint + card); +0.5 day if
  the optional AI polish is wanted.
- **Tests** (`diagnose` is PURE): one case per funnel branch in the table above + the "all healthy but ROAS<1"
  case + a "healthy campaign → no diagnostic" case.

---

# Combined summary

| Safeguard | Status | Effort | Key reuse |
|---|---|---|---|
| Test-budget tier | scoped here | ~0.5–1 day | `daily_budget_cents`, nightly scheduler, ROAS |
| Plain-English diagnostic | scoped here | ~1 day (+0.5 AI) | full funnel in `ad_performance_daily` |

Neither moves money or needs an external platform, so both are buildable now (unlike Meta-live transport).
Both follow the established patterns: a PURE decide/diagnose function (unit-tested) + a nightly-or-on-read
evaluator + an admin/shop UI surface. Combined with the auto-pause (built), flat-tier billing, and ROI-refund
scopes, this completes the risk-doc's recommended launch safeguard set. All scope/analysis only — nothing built.
