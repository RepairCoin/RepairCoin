# Ads Safeguards 4–6 — Scope & Decision Memo

_Created: 2026-06-22_

The remaining 3 of the 7 ad-program safeguards (1–3 are built: auto-pause, pre-flight quality
check, ROI dashboard). These are **commercial-trust** safeguards — they depend on **live delivery
data**, **Stripe collection being live**, and **commercial/legal decisions**, so this is a scoped
plan to build them *when those prerequisites land*, not a now-build.

> **⚠️ Restated for FLAT tiers.** The original `risks-plan-b-zero-roi-and-safeguards.md` is written
> for the **retired Plan B** ($120/day, "$20/day margin"). Under the current model
> ([[project-pricing-alignment-state]]) FixFlow charges a **flat monthly management fee**
> ($199 / $499 / $999) and **never touches ad spend**. So every money figure below is the **flat
> fee**, not a per-day margin.

---

## Safeguard 5 — Free creative iteration (§5.3) — MOSTLY DONE

**Promise:** if a campaign underperforms, FixFlow swaps the creative within 7 days, no charge.

- ✅ **Mechanism already built** — admin can **Regenerate** (AI) or **Upload** a designer image at
  no charge anytime → re-review → re-push (`DraftComposer`, `updateDraft`, `manualImageUrl`). Free
  creative swaps are fully supported today.
- ⏳ **Remaining = the trigger** (the *obligation*): detect underperformance and prompt the swap.
  - **Rule (decide):** e.g. `CPL > 2× target` OR `0 leads after $X spend` over N days.
  - **Build:** nightly check (fold into `SafeguardScheduler.tick`) sets a `needs_creative_refresh`
    flag on the campaign → surfaced as an admin nudge ("swap the creative — free"). The swap itself
    reuses the existing regenerate/upload.
  - **Dependency:** live performance data (spend/leads) → needs go-live + delivery.
- **Effort:** ~0.5d once there's delivery data. **No new money/Stripe dependency.**

---

## Safeguard 4 — Test-budget tier (§5.5)

**Promise:** first month at a lower daily budget; auto-upgrade after 30 days of positive ROI.

- **Buildable now (setup):** opt-in `is_test_budget` + `test_budget_until` (date) + a UI badge
  ("Test month — scales to full after 30 days of positive ROI"). Budgets are already editable, so
  starting low is possible today; this just formalizes + surfaces it.
- ⏳ **Auto-upgrade** needs live ROI data + rules.
- **Decisions needed:**
  - Test daily budget — fixed (e.g. ₱/$X) or a % of the requested budget?
  - Test window length (30 days?) and what "positive ROI" means (≥1×? ≥ some lead count?).
  - Auto-upgrade vs. prompt-admin-to-upgrade (recommend **prompt**, not silent auto-scale).
- **Build (when decided + data):** nightly evaluation → at window end, if ROI ≥ threshold, prompt to
  raise the ad-set daily budget to the full amount (reuses `updateDraft`/`updateAdSet`).
- **Effort:** setup ~0.5d; auto-scale ~0.5d + decisions + data.

---

## Safeguard 6 — Money-back / ROI refund (§5.7) — MOST GATED

**Promise (restated for flat tiers):** if 60-day cumulative ROI < 1×, FixFlow refunds the **flat
management fee** for the period. **Ad spend is never refunded** (the shop pays the platforms directly;
FixFlow never holds it).

- **Hard dependencies (all required):**
  1. **Stripe collection LIVE** — `ADS_BILLING_STRIPE_ENABLED=true` + a refund path. Today it's OFF
     and there's no refund method (only `invoiceShopPending`). No refund possible until this is on.
  2. **60-day ROI data** — needs sustained live delivery.
  3. **Locked commercial threshold + conditions** (below).
  4. **Legal review (Q14)** — "we refund if ROI < 1×" can be a binding guarantee in some
     jurisdictions; the public wording + contract terms need legal sign-off before shipping.
- **Conditions to qualify (decide + enforce):** shop responds to leads within 24h; reviews stay
  ≥ 3.5★; shop didn't edit the creative without approval; passed the pre-flight quality check.
  Lead loss due to shop unresponsiveness disqualifies the refund.
- **Build (when unblocked):** extend `SafeguardEvaluator` nightly → compute 60-day cumulative ROI per
  campaign → if `< 1×` AND conditions met → mark `refund_eligible` + notify admin. **Refund stays a
  gated admin action** (`AdBillingStripeService.refund…`, behind `ADS_BILLING_STRIPE_ENABLED`) — never
  auto-refund. Reconcile the refunded charge in `ad_billing_charges`.
- **Effort:** detection ~1d (needs data); refund path ~1d (needs Stripe live); + the legal/commercial
  decision is the real gate.

---

## Decisions needed (owner: exec/commercial + legal)

| # | Decision | Needed for |
|---|----------|-----------|
| D1 | Underperformance rule (CPL > 2× target? 0 leads after $X?) | Safeguard 5 trigger, 4 eval |
| D2 | Test-budget amount + window + "positive ROI" definition; auto-scale vs prompt | Safeguard 4 |
| D3 | Money-back threshold (1× / 60-day?) + qualifying conditions | Safeguard 6 |
| D4 | Legal review of the money-back wording/contract (Q14) | Safeguard 6 (blocker) |
| D5 | Refund amount basis = flat fee for the period (confirm; Plan B "$20/day" is retired) | Safeguard 6 |

## Suggested sequencing
1. **Now:** nothing to build safely (5's mechanism is already done). Get **D1–D5 decided**.
2. **When a campaign is live + delivering:** build Safeguard 5 trigger + Safeguard 4 setup/eval.
3. **When Stripe collection is live + D3/D4 locked:** build Safeguard 6 detection + gated refund.

## Already shipped (related)
- Safeguard 1 (auto-pause $400/$800), 2 (pre-flight quality banner), 3 (computed-at-read ROI) — built.
- Free creative swap (regenerate/upload) — the mechanism half of Safeguard 5.
- ROI/True-Margin per campaign — the measurement these safeguards read from.
