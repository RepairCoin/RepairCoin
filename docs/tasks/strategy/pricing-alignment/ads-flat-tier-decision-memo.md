# Exec Decision Memo — Honoring the $199–$999 "AI Ads Management" Tier

**Date:** 2026-06-15
**Status:** Decision requested — no code written. Standing rule: do not commit/build until exec signs off.
**Companion docs:** `pricing-sheet-vs-code-gap-analysis.md`, `../ads-system/ads-system-implementation-plan.md`.

---

## 1. The simple picture — what FixFlow earns per shop, per month

**The one rule that makes this simple: the ad-spend money is NOT FixFlow's.** The shop pays Facebook/Google
for the ads (directly, or reimburses FixFlow at cost). That money passes through — it never counts as FixFlow
revenue _or_ cost. So FixFlow's profit is just **the fees it charges, minus the tiny AI cost.**

Here is the entire money picture for one shop on the ads add-on:

| Line                                        | $199 tier | $499 tier | $999 tier  |
| ------------------------------------------- | --------- | --------- | ---------- |
| Ads management fee (FixFlow collects)       | **$199**  | **$499**  | **$999**   |
| − FixFlow's only ads cost (AI usage)        | −$3       | −$8       | −$15       |
| **= Net profit from ads add-on**            | **$196**  | **$491**  | **$984**   |
| + Base subscription (already paid)          | +$500     | +$500     | +$500      |
| **= Total FixFlow profit per shop / month** | **$696**  | **$991**  | **$1,484** |

> The ad spend itself ($1,000–$6,000/mo) flows **shop → Facebook**. It is never on FixFlow's books, so it
> cannot create a profit or a loss for FixFlow. That is the whole point of charging a flat fee.

**At scale (example):** 50 shops, average on the $499 tier → **~$49,550/mo profit** ($991 × 50), of which
~$24,950 is the ads add-on and ~$25,000 is the base subscription.

---

## 2. The decision that makes the table above true

FixFlow's profit is clean and predictable **only if the shop funds the ad spend.** There are three ways to
handle spend; only the first two are safe:

1. **Shop pays Facebook directly** (their own ad account) — ✅ safest. FixFlow never touches ad money.
2. **FixFlow fronts spend, bills it back at cost** (FixFlow's managed account) — ✅ same profit, just a
   cash-flow timing gap. Recommended for the managed/higher tiers.
3. **Spend bundled into the fee** (FixFlow pays for ads out of the $199–$999) — ❌ **do not do this.** A
   competitive ad budget is 5–6× the fee, so FixFlow would _lose_ $800–$5,000 per shop. See Appendix A.

**Recommendation:** offer the flat tiers, and define every tier as **"fixed fee + shop-funded (or at-cost
pass-through) ad spend."** Never bundle spend. This is exactly the table in Section 1.

---

## 3. Whose ad account per tier

- **Lower rung (~$199):** shop keeps **their own** Meta/Google account and pays the platform directly.
  FixFlow just provides the dashboard + AI automation. (This is the already-built "Plan A" at $299.)
- **Higher rungs (up to $999):** ads run on **FixFlow's managed account**; spend passed through at cost.
  Tier scales by how much spend / how many channels / how many campaigns FixFlow manages.

(Running many shops on FixFlow's shared account is why every creative is reviewed before it goes live — one
bad ad can get the whole shared account flagged.)

---

## 4. Shop-protection safeguards — what happens when ads underperform

~1 in 5 ad campaigns underperform industry-wide, so the shop's downside protection is part of the product, not
an afterthought. Status today:

| #   | Safeguard                           | What it does for the shop                                                                                     | Status                                                                  |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | **Auto-pause**                      | Campaign auto-pauses at $800 spent / 0 bookings ($400 / 0 leads → alert). Stops the bleed.                    | ✅ **Built** (`SafeguardEvaluator`, nightly)                            |
| 2   | **Pre-flight quality check**        | Warns before spending if rating < 3.5★ or < 5 photos.                                                         | ✅ **Built** (`ShopAdsTab` banner)                                      |
| 3   | **ROI dashboard**                   | Shop sees leads / bookings / CPL / CPB / ROI in real time.                                                    | ✅ **Built**                                                            |
| 4   | **Test budget entry tier**          | First month at a lower daily spend to prove it works before scaling.                                          | ❌ **Not built**                                                        |
| 5   | **Free creative iteration**         | FixFlow swaps the ad within 7 days if it underperforms, no extra charge.                                      | ❌ **Not built** (process/contract, not code)                           |
| 6   | **Money-back / ROI refund trigger** | If 60-day ROI < 1×, refund the **management fee** (not the ad spend), subject to shop-eligibility conditions. | ❌ **Not built** (no refund mechanism in billing code)                  |
| 7   | **Diagnostic transparency**         | Auto-generated plain-English "here's why it failed and what to change."                                       | ⚠️ **Partial** (raw numbers exist; plain-English explanation not built) |

**Money-back refund — scope (important):** only **FixFlow's fee** is refundable. **Ad spend is never refundable**
— it already went to Facebook/Google and (in the flat-tier model) it was the shop's own money. Refund eligibility
requires the shop to have responded to leads within 24h, kept reviews ≥ 3.5★, and not edited creative without
approval — so FixFlow doesn't refund failures caused by the shop. The 60-day ROI is already computed
(`RoiCalculator`); the refund **action** (void/refund charge + Stripe refund) is the missing piece.

**Risk doc recommendation:** do not launch without minimum safeguards **#1, #4, #5, #6**. Only #1 is built today.

---

## 5. Decisions requested from exec

1. **Spend funding:** confirm shops fund their own ad spend (Option 1 or 2 above), not bundled (Option 3)? ✅ recommended
2. **Account per tier:** low tier = shop's own account; high tiers = FixFlow's managed account?
3. **Tier definition:** what spend ceiling / channels / campaign count defines $199 vs. mid vs. $999?
4. **Keep variable pricing too?** We can also offer the existing "20% markup on spend" model to very
   high-spend shops, where it earns more than a flat fee (see Appendix B). Flat-only is simpler; offering
   both captures more. Your call.
5. **Launch safeguards (Section 4):** confirm which of #4 (test budget), #5 (creative iteration), #6 (ROI
   refund) to commit to before launch — the risk doc says these plus #1 are the minimum. Each adds build
   scope (#6 refund = ~2–3 days; #4 test budget = small; #5 = contract + light tooling).
6. **Refund parameters (if #6 is in):** ROI threshold (1× recommended), window (60 days), and whether the
   ROI denominator includes the fee (more shop-favorable) or ad spend only.

Once 1–6 are answered, engineering adds a small `flat_tier` billing option (reuses the existing monthly-fee
billing path — low effort) plus the agreed safeguards.

---

## 6. Proposed answer to Decision #3 — what each tier includes

**Status: PROPOSED, pending exec confirmation.** The pricing sheet names the prices ($199–$999) but never
defined what each rung includes. Below is a sensible breakdown built around what the system can deliver today.
Final numbers/inclusions are a commercial call; swapping them later is a one-line config change, not a rebuild.

| What the shop gets            | **Starter $199**              | **Growth $499** ⭐   | **Business $999**             |
| ----------------------------- | ----------------------------- | -------------------- | ----------------------------- |
| Ad channels                   | Facebook only                 | Facebook + Instagram | FB + Instagram + Google       |
| Active campaigns              | 1                             | up to 3              | up to 10                      |
| Ad account                    | shop's own (pays FB directly) | FixFlow managed      | FixFlow managed               |
| Managed spend ceiling         | ~$1,000/mo                    | ~$3,000/mo           | ~$6,000+/mo                   |
| AI lead auto-answer           | — (manual reply)              | ✅ full              | ✅ full                       |
| Lead pipeline + ROI dashboard | ✅                            | ✅                   | ✅                            |
| A/B creative experiments      | —                             | ✅                   | ✅                            |
| Free creative iteration       | —                             | ✅ 7-day swap        | ✅ priority                   |
| First-response SLA tracking   | —                             | ✅                   | ✅                            |
| Test-budget on-ramp           | —                             | ✅                   | ✅                            |
| Reporting                     | monthly summary               | detailed + trends    | industry analytics + priority |

**The three real differentiators** (everything else follows): (1) **account model + spend ceiling** — Starter
on the shop's own account/small budget, Growth/Business on FixFlow's managed account; (2) **campaign count**
(1 / 3 / 10); (3) **AI lead auto-answer** off at Starter, on at Growth+. These are all built today.

**Reality check:** campaign count, managed-vs-own account, AI auto-answer, lead Kanban, ROI dashboard, and A/B
experiments are **built**. The **Google channel** is **not built** (Meta scaffold only) and **live spend
enforcement** isn't wired (spend is entered manually until the Meta App goes live) — so the Google line and the
spend ceilings are Business-tier promises that fully light up when the Meta+Google live work ships. Tiers
should anchor on the real levers; Google is forward-looking.

---

---

# Appendix A — Why we must NOT bundle ad spend into the fee

If FixFlow paid for the ads out of the flat fee, the spend (what shops actually need to compete) is far
bigger than the fee, so FixFlow loses money on every shop:

| Tier (fee) | Ad spend a shop needs | FixFlow result if spend is bundled |
| ---------- | --------------------- | ---------------------------------- |
| $199       | $1,000                | **−$804 loss**                     |
| $499       | $3,000                | **−$2,509 loss**                   |
| $999       | $6,000                | **−$5,016 loss**                   |

This is why Section 2 insists the shop funds the spend. Bundling is the one way to turn a profitable product
into a guaranteed loss.

---

# Appendix B — Flat fee vs. the built "20% markup" model (optional reading)

The Ads System already supports charging a **20% markup on managed ad spend** instead of a flat fee. Which
earns more depends only on how much the shop spends:

- A flat fee earns the same as the 20% markup when the shop spends **5× the fee**:
  - $199 tier ≈ $995/mo spend · $499 tier ≈ $2,495/mo spend · $999 tier ≈ $4,995/mo spend
- Shop spends **less** than that → **the flat fee earns FixFlow more** (and is safer).
- Shop spends **more** than that → the 20% markup earns more (flat fee leaves money on the table).

**Takeaway:** flat tiers are simpler and de-risk low-spend shops; the markup model squeezes more from
high-spend shops. Offering both (Decision #4) lets FixFlow pick the better one per shop.
