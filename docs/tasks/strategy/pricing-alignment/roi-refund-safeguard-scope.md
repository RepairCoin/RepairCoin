# Engineering Scope — ROI Money-Back Refund Safeguard

**Date:** 2026-06-15
**Status:** Scope only — no code written. Standing rule: do not build/commit until exec signs off memo
Decisions #5/#6.
**Grounded in:** `SafeguardEvaluator.ts`, `SafeguardScheduler.ts`, `RoiCalculator.ts`,
`repositories/SafeguardRepository.ts`, `repositories/BillingChargeRepository.ts`, `repositories/LeadRepository.ts`,
`repositories/CampaignRepository.ts`, `services/StripeService.ts`.

**The promise (risks-doc §5.7 / §7.4):** *if a campaign's 60-day ROI is under 1× (got back less than it cost),
FixFlow refunds its own management fee — never the ad spend — provided the shop met its responsibilities.*

---

## 1. What already exists (good news — most inputs are here)

- **ROI math:** `RoiCalculator.fromTotals` returns `roas = revenue/spend` and `roi = (revenue−spend)/spend`,
  PURE + unit-tested. Fed by `PerformanceRepository.getTotals(campaignId)`.
- **The nightly hook:** `SafeguardScheduler.tick` (03:00) already rolls up the pipeline THEN runs evaluators.
  The refund evaluator slots in right after `evaluator.runNightly()`.
- **Campaign age:** `ad_campaigns.started_at` (set when status first → 'active') = the 60-day clock start.
- **Responsiveness data:** `ad_leads.first_response_at` + `created_at` already tracked (`LeadRepository`,
  `listAwaiting` already uses them). So the "responded within 24h" condition is computable.
- **Per-fee charges:** `ad_billing_charges` holds every FixFlow fee/margin row by `charge_type`; `markStatus`
  can flip them. The 60-day fee total is a sum query.
- **Stripe refunds:** `StripeService.refundPayment(paymentIntentId)` exists (wraps `stripe.refunds.create`).

## 2. What's missing (the actual build)

1. A **trigger definition** locked by exec (threshold + denominator).
2. An **eligibility evaluator** (responsiveness, rating, creative-tamper).
3. A **refund action** — void pending fee charges + Stripe-refund collected ones + audit trail.
4. A **`StripeService.refundInvoice(invoiceId)`** — `refundPayment` needs a *PaymentIntent*; ad fees were
   collected via `createImmediateInvoice` (returns an invoice), so we must resolve invoice → payment_intent
   first (or store the PI id on the charge at collection time).
5. **Human-in-the-loop gate** for money leaving the building.

---

## 3. Trigger definition (locks memo Decision #6)

- **Window:** `now >= started_at + 60 days` AND not yet evaluated (one-shot per campaign).
- **Metric:** **ROAS < 1.0** (`revenue / cost < 1` — "got back less than spent"). This is the colloquial
  "ROI under 1×". Configurable threshold (default 1.0).
- **Denominator (Decision #6):** ad spend only (matches `RoiCalculator`, simpler) **or** spend + fee
  (more shop-favorable — a campaign that barely beat ad spend but not the fee still triggers). Recommend
  **spend only** for v1 (the fee is what we're refunding; don't also put it in the bar to clear).

## 4. Eligibility conditions (risks-doc §5.7) — auto vs. manual

| Condition | Source | Auto-checkable? |
|---|---|---|
| Responded to leads within 24h | `ad_leads.first_response_at − created_at` | ✅ Yes — new `LeadRepository.responsivenessStats(campaignId)`: count leads where `first_response_at IS NULL OR (first_response_at − created_at) > 24h`. Disqualify if any (or > tolerance). |
| Reviews stayed ≥ 3.5★ | shop rating (same source the pre-flight `ShopAdsTab` banner uses) | ✅ Yes — read current rating; v1 uses current value (historical snapshotting is a later refinement). |
| Creative not edited without approval | `ad_creatives.review_status` | ⚠️ Partial — can detect creatives not in `approved`, but "shop edited it" intent is fuzzy. **Treat as a manual admin check.** |

**Recommendation:** the job auto-computes ROI + responsiveness + rating and marks the campaign
`refund_eligible` (or `refund_disqualified` with a reason). It does **NOT** auto-move money — an **admin
approves** each refund (reviews creative-tamper + confirms), then the system executes it. Money-out always has
a human gate.

## 5. What gets refunded — the firm rule

Refund **FixFlow-margin charge types only**, never spend:

- ✅ `flat_tier_fee`, `plan_a_dashboard`, `plan_b_margin`, `plan_c_booking`, `plan_c_revenue_share`
- ❌ **NEVER** `flat_tier_spend_passthrough` (that's recovered ad cost, not profit) and **never the ad spend
  itself** (it's gone to Facebook; in the flat model it was the shop's own money).

Refund amount = `SUM(amount_cents)` of those types for the campaign within the 60-day window.

---

## 6. Schema changes (new migration — verify next-free NNN across branches/bundles)

**Reuse `ad_safeguards_state`** (already one row per campaign) for the refund state — no new table needed:
```sql
ALTER TABLE ad_safeguards_state
  ADD COLUMN roi_refund_status      TEXT NOT NULL DEFAULT 'none'
    CHECK (roi_refund_status IN ('none','eligible','disqualified','approved','refunded')),
  ADD COLUMN roi_refund_evaluated_at TIMESTAMPTZ,
  ADD COLUMN roi_refund_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (roi_refund_amount_cents >= 0),
  ADD COLUMN roi_refund_reason       TEXT,        -- disqualify reason or audit note
  ADD COLUMN roi_refund_executed_at  TIMESTAMPTZ;
```
**`ad_billing_charges`** — add `'refunded'` to the status CHECK (drop/re-add constraint), so refunded fee rows
are auditable and excluded from future totals. Optionally store the refund id:
```sql
ALTER TABLE ad_billing_charges ADD COLUMN stripe_refund_id TEXT;  -- nullable
```
> Per [[feedback-check-migration-number-before-building]]: scan all branches + remotes + bundles for the next
> free integer before assigning. Apply to staging via run-single-migration; runner records on deploy.

---

## 7. Code changes

### 7.1 New `RoiRefundEvaluator.ts` (mirror `SafeguardEvaluator`'s shape)
- **PURE `decide(roas, threshold, eligibility)` → `'eligible' | 'disqualified' | 'none'`** (unit-testable):
  - `none` if window not elapsed / already evaluated.
  - `disqualified` (with reason) if any eligibility condition fails.
  - `eligible` if `roas < threshold` and all auto-conditions pass.
- **`runNightly(asOfDate)`**: list active+recently-ended campaigns past 60d & unevaluated → for each, gather
  `getTotals` (ROAS), `LeadRepository.responsivenessStats`, shop rating → `decide` → write
  `roi_refund_status` + amount (sum of fee charges) + reason; notify admin on `eligible`; notify shop on
  `disqualified` is optional. **No money moves here.**

### 7.2 `RoiRefundService.executeRefund(campaignId, adminAddr)` (the money step, admin-triggered)
- Guard: status must be `approved` (admin set it via the controller after reviewing creative-tamper).
- Pull the campaign's fee charges within the window:
  - `pending`/`invoiced` (not collected) → `BillingChargeRepository.markStatus(ids, 'void')`.
  - `paid` (collected) → `StripeService.refundInvoice(stripeInvoiceId)` per invoice, then `markStatus(ids,
    'refunded', /*stripeRefundId*/)`.
- Stamp `roi_refund_status='refunded'`, `roi_refund_executed_at`, `roi_refund_amount_cents`.
- Notify shop ("we refunded your $X management fee"). Best-effort try/catch like existing notify paths.

### 7.3 `StripeService.refundInvoice(invoiceId)` — NEW
- Retrieve invoice → get `payment_intent` (or `charge`) → `stripe.refunds.create({ payment_intent })`.
- Reuses the existing `refundPayment` plumbing; soft-fail + log like `createImmediateInvoice`.
- Master switch: only executes when `ADS_BILLING_STRIPE_ENABLED` (same flag as collection). If off → mark
  charges `void`/`refunded` in-ledger only (no live money), so staging works without Stripe.

### 7.4 `LeadRepository.responsivenessStats(campaignId)` — NEW
- One query: total leads vs. leads responded within 24h (`first_response_at - created_at <= interval '24h'`).
  Returns `{ total, respondedWithin24h, unresponsive }`.

### 7.5 `BillingChargeRepository` — minor
- `ChargeStatus` union → add `'refunded'`. `markStatus` already generic. Add a
  `sumFeeChargesForCampaign(campaignId, since)` helper (excludes pass-through + spend types).

### 7.6 Scheduler wiring
- In `SafeguardScheduler.tick`, after `evaluator.runNightly()`, add
  `await this.roiRefund.runNightly(asOfDateString)`. (Pass the date in — no `Date.now` in pure paths.)

### 7.7 Controller + routes (admin only)
- `GET /ads/refunds/eligible` — list campaigns with `roi_refund_status='eligible'`.
- `POST /ads/campaigns/:id/refund/approve` — admin confirms (sets `approved`).
- `POST /ads/campaigns/:id/refund/execute` — runs `RoiRefundService.executeRefund`.
- (Or fold approve+execute into one "Approve & refund" action.)

### 7.8 Frontend
- `MarginPanel`/`BillingPanel` (admin) gains an **"ROI refund eligible"** flag + an **Approve & Refund**
  button showing the computed refund amount + the disqualify reason when applicable. Admin-only; shops never
  see the mechanism, only the resulting refund notification + a reversed charge in their history.

---

## 8. Effort & tests

- **Effort:** ~2–3 days. The ROI input and nightly hook exist; the work is the evaluator, the eligibility
  query, the refund executor, `refundInvoice`, the admin gate, and the schema.
- **Tests** (new `tests/services/AdsRoiRefund.test.ts`; `decide` is PURE):
  1. `roas = 0.29`, window elapsed, all conditions pass → `eligible`, amount = summed fees.
  2. `roas = 1.2` → `none` (performed; no refund).
  3. `roas = 0.5` but a lead went unanswered > 24h → `disqualified` (reason set).
  4. `roas = 0.5`, rating 3.2★ → `disqualified`.
  5. Refund executor: pending fee charges → `void`; paid → `refunded` + refund id; pass-through + spend rows
     UNTOUCHED (assert FixFlow never refunds ad cost).
  6. Idempotency: re-running the nightly job on an already-`refunded` campaign is a no-op.

---

## 9. Open decisions & risks

1. **Memo Decision #5** — is this safeguard in scope for launch? (Risks doc says yes, it's a must-have.)
2. **Memo Decision #6** — threshold (1.0?) + denominator (spend-only recommended).
3. **Responsiveness tolerance** — disqualify on *any* unanswered-in-24h lead, or allow a small % slack?
4. **Rating snapshot** — v1 uses current rating; do we need to snapshot rating at campaign start for fairness?
   (Refinement, not a blocker.)
5. **Auto vs. manual money-out** — recommend **manual admin approval** before any refund executes (creative-
   tamper isn't reliably auto-detectable, and money-out should have a human gate). Confirm.
6. **Window source** — `started_at` (first activation). Re-activated/paused campaigns: 60 calendar days from
   first start, or 60 active-days? Recommend calendar days from first `started_at` for simplicity.
7. **Plan C note** — Plan C shops pay ~$0 when bookings are 0, so a refund is usually moot, but the same
   margin-only refund rule applies for consistency.
