# Exec Decision Memo — Honoring the $199–$999 "AI Ads Management" Tier

**Date:** 2026-06-15
**Status:** Decision requested — no code written. Standing rule: do not commit/build until exec signs off.
**Companion docs:** `pricing-sheet-vs-code-gap-analysis.md`, `../ads-system/ads-system-implementation-plan.md`.

> **✅ DECIDED 2026-06-15:**
> - **Spend funding (#1/#2):** the SHOP pays ad-spend DIRECTLY, on their OWN ad account, across ALL tiers.
>   FixFlow never fronts, holds, or passes through ad money (Option 1 below) — it just manages the campaigns
>   on the shop's account. FixFlow's only ad-related revenue is the flat management fee.
> - **Tier amounts (#3):** $199 / $499 / $999 with the §6 inclusions.
> - **Pricing model (#4):** FLAT-ONLY — the three tiers replace the old Plan A/B/C entirely (no $299 flat,
>   no 20% markup, no pay-per-result). See §5 Decision #4.

---

## 1. The simple picture — what FixFlow earns per shop, per month

**The one rule that makes this simple: the ad-spend money is NOT FixFlow's.** The shop pays Facebook/Google
**directly, on their own ad account** — the money never touches FixFlow's books, so it can't be FixFlow
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

FixFlow's profit is clean and predictable **only if the shop funds the ad spend.** Three ways to handle spend
were on the table:

1. **Shop pays Facebook directly** (their own ad account) — ✅ **DECIDED.** Safest; FixFlow never touches ad
   money. The shop's own card is on file with Meta/Google; FixFlow gets management (agency) access to run the
   campaigns. Applies to **every tier**.
2. ~~FixFlow fronts spend, bills it back at cost~~ — not chosen (would need cash-flow float + pass-through
   billing).
3. ~~Spend bundled into the fee~~ — ❌ never (a competitive budget is 5–6× the fee → FixFlow loses
   $800–$5,000/shop; see Appendix A).

**Result:** every tier = **"fixed management fee + shop pays its own ad spend directly."** FixFlow carries zero
ad-spend risk and never needs to invoice spend — only the flat fee. This is exactly the Section 1 table.

---

## 3. Whose ad account (DECIDED: the shop's own, every tier)

- **All tiers ($199 → $999):** the shop keeps **their own** Meta/Google ad account and pays the platform
  **directly**. FixFlow takes **management (agency) access** to build and run the campaigns on the shop's
  account — it does not run ads on a FixFlow account, and never holds the shop's ad money.
- Tiers differ by **what FixFlow manages** on that account — channels, number of campaigns, AI lead
  auto-answer — **not** by whose account it is (see §6).

(Creative review still applies — it protects the **shop's own** ad account + brand quality, and keeps FixFlow
in good standing as the managing agency on Meta/Google.)

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

1. ~~**Spend funding**~~ — ✅ **DECIDED 2026-06-15:** shop pays ad-spend directly (Option 1), all tiers.
2. ~~**Account per tier**~~ — ✅ **DECIDED:** shop's own ad account on every tier (FixFlow manages it).
3. ~~**Tier definition**~~ — ✅ **DECIDED 2026-06-15:** $199 / $499 / $999 with the §6 inclusions.
4. ~~**Keep variable pricing too?**~~ — ✅ **DECIDED 2026-06-15: FLAT-ONLY. Drop Plan A/B/C.** The three
   flat tiers ($199/$499/$999) are the *only* ads-billing model. This is the consistent endpoint of Decisions
   #1/#2: shop-pays-directly already retired Plan B (markup on managed spend) and Plan C (FixFlow-funded
   per-result); Plan A's flat $299 is superseded by the 3 rungs. Appendix B is now historical context only.
5. **Launch safeguards (Section 4):** confirm which of #4 (test budget), #5 (creative iteration), #6 (ROI
   refund) to commit to before launch — the risk doc says these plus #1 are the minimum. Each adds build
   scope (#6 refund = ~2–3 days; #4 test budget = small; #5 = contract + light tooling).
6. **Refund parameters (if #6 is in):** ROI threshold (1× recommended), window (60 days), and whether the
   ROI denominator includes the fee (more shop-favorable) or ad spend only.

Once 1–6 are answered, engineering adds a small `flat_tier` billing option (reuses the existing monthly-fee
billing path — low effort) plus the agreed safeguards.

---

## 6. Decision #3 — what each tier includes (✅ CONFIRMED 2026-06-15)

**Status: ✅ CONFIRMED.** Prices and inclusions below are agreed. (Swapping any number later is still a
one-line config change, not a rebuild.)

| What the shop gets            | **Starter $199**              | **Growth $499** ⭐   | **Business $999**             |
| ----------------------------- | ----------------------------- | -------------------- | ----------------------------- |
| Ad channels                   | Facebook only                 | Facebook + Instagram | FB + Instagram + Google       |
| Active campaigns              | 1                             | up to 3              | up to 10                      |
| Ad account                    | shop's own (pays directly)    | shop's own (pays directly) | shop's own (pays directly) |
| Managed spend ceiling         | ~$1,000/mo                    | ~$3,000/mo           | ~$6,000+/mo                   |
| AI lead auto-answer           | — (manual reply)              | ✅ full              | ✅ full                       |
| Lead pipeline + ROI dashboard | ✅                            | ✅                   | ✅                            |
| A/B creative experiments      | —                             | ✅                   | ✅                            |
| Free creative iteration       | —                             | ✅ 7-day swap        | ✅ priority                   |
| First-response SLA tracking   | —                             | ✅                   | ✅                            |
| Test-budget on-ramp           | —                             | ✅                   | ✅                            |
| Reporting                     | monthly summary               | detailed + trends    | industry analytics + priority |

**The three real differentiators** (everything else follows): (1) **channels + spend ceiling** — every tier is
on the shop's own account (DECIDED §3); higher tiers add channels (FB → +IG → +Google) and a higher managed
spend ceiling; (2) **campaign count** (1 / 3 / 10); (3) **AI lead auto-answer** off at Starter, on at Growth+.
These are all built today.

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

# Appendix B — Flat fee vs. the built "20% markup" model (HISTORICAL — markup retired)

> **Note:** Decision #4 retired the 20% markup (and all of Plan A/B/C). This appendix is kept only to record
> *why* — the trade-off below is the reasoning, not a live option.

The Ads System originally supported charging a **20% markup on managed ad spend** instead of a flat fee. Which
earns more depends only on how much the shop spends:

- A flat fee earns the same as the 20% markup when the shop spends **5× the fee**:
  - $199 tier ≈ $995/mo spend · $499 tier ≈ $2,495/mo spend · $999 tier ≈ $4,995/mo spend
- Shop spends **less** than that → **the flat fee earns FixFlow more** (and is safer).
- Shop spends **more** than that → the 20% markup earns more (flat fee leaves money on the table).

**Takeaway:** flat tiers are simpler and de-risk low-spend shops; the markup model squeezes more from
high-spend shops. Offering both (Decision #4) lets FixFlow pick the better one per shop.
