# Risk Analysis: Plan B Worst Case — Zero Leads, Zero Bookings

**Created:** 2026-04-27
**Status:** Risk register / decision input (pre-implementation)
**Audience:** Executives, commercial team, product
**Related:**
- [`../ai-sales-agent-integration-strategy.md`](../ai-sales-agent-integration-strategy.md)
- [`./review-fixflow-ads-system-spec.md`](./review-fixflow-ads-system-spec.md)
- [`./ads-system-narrative-walkthrough.md`](./ads-system-narrative-walkthrough.md)

---

## TL;DR

**The current spec describes the happy path for Plan B (Sarah pays $120/day, gets $510/day in revenue, ROI 5×). It does not describe what happens when ROI is 0×. That gap is the largest unaddressed business risk in the entire ads system, and it must be resolved before any code ships.**

Without safeguards:
- A failing Plan B campaign costs the shop **$3,600/month in pure loss**
- FixFlow keeps **$600/month margin** from a customer who got nothing in return
- Outcome: customer churn, reputation damage, possible refund disputes

The fix is industry-standard contract structure (auto-pause + test budget + creative iteration + refund trigger). Pick at least 4 of the 7 safeguards below before shipping.

---

## 1. The scenario, in concrete numbers

Sarah signs up to Plan B. 30-day month, $120/day to FixFlow.

| Item | Amount |
|---|---|
| Sarah pays FixFlow | $120/day × 30 = **$3,600** |
| FixFlow pays Facebook | $100/day × 30 = $3,000 |
| FixFlow keeps margin | $20/day × 30 = **$600** |
| Leads generated | 0 |
| Bookings | 0 |
| Revenue from ads | $0 |
| Sarah's ROI | **−100%** |

Sarah just paid FixFlow $3,600 to lose money. FixFlow earned $600 doing nothing useful for her. **This is the exact nightmare scenario for the business model.**

## 2. What likely happens next (without safeguards)

| Day | Event |
|---|---|
| 1-7 | Sarah notices low/zero bookings from ads. Marcus reassures her: "give it more time." |
| 8-14 | Still zero. Sarah is now angry. Demands to talk to someone senior. |
| 15-21 | Marcus tries new creative. Still nothing. Sarah threatens cancellation. |
| 22-30 | Sarah cancels Plan B. **Also cancels her $500/month software subscription out of frustration.** FixFlow lost a paying customer. |
| 31+ | Sarah tells every shop owner she knows. Posts a Facebook review: *"FixFlow took $3,600 and I got nothing. Avoid."* Industry word-of-mouth in Manila is small. Reputation cascade begins. |
| Worst case | Chargeback dispute through Sarah's bank, possibly small-claims court, definitely a PR problem. |

## 3. Why the spec is silent

The spec describes the happy path beautifully — Sarah spends $100/day, makes $510/day, ROI is 5×. But it does not address:

- What "underperforming" means quantitatively (CPL > $X? CPB > $Y? ROI < 1×?)
- Who decides to pause a failing campaign (admin? automated trigger? shop?)
- What happens to budget already spent before the pause
- Whether shops get refunds, credits, or nothing
- How long a campaign is given to "warm up" before being judged a failure
- Whether FixFlow guarantees anything

This is a **major gap**. Every marketing agency in the world has had to figure this out, and the answers shape the contract terms shops sign.

## 4. Whose fault is the failure?

Realistically, it's **partial fault**, not pure FixFlow or pure shop. Below is a typical breakdown:

| Cause of zero leads | Whose fault? |
|---|---|
| FixFlow's ad copy is weak / doesn't resonate | FixFlow |
| FixFlow's targeting was wrong (wrong city, age, interests) | FixFlow |
| FixFlow's service price was set too high in the ad | Shared (shop set the price; FixFlow chose to advertise it) |
| Sarah's neighborhood has 5 competitors with cheaper prices | Sarah's market reality |
| Sarah's shop has bad Google reviews (people don't trust the brand) | Sarah |
| Seasonal slump (e.g., summer in a school district) | Nobody, just timing |
| FixFlow's AI was rude / off-brand | FixFlow |
| Shop has a typoed phone number that scared people off | Sarah |
| Shop never responded to leads the AI escalated | Sarah |

**This matters for contract design.** If we say "we guarantee X leads or your money back," we have to account for all the ways the shop's own decisions could undermine that guarantee. Otherwise we're writing checks our system can't cash.

## 5. Industry-standard safeguards (the 7 options)

How marketing agencies handle this. FixFlow needs at least 4 of these to launch Plan B safely.

### 5.1 Auto-pause underperforming campaigns

After N days with CPL > $X or 0 leads → automatically pause and alert admin. **Prevents bleeding.**

Suggested triggers:
- $400 spent with 0 leads → soft-pause, email shop, await reply
- $800 spent with 0 bookings → hard-pause, admin must manually re-enable

### 5.2 Performance floor guarantees with conditions

> *"If you don't get at least 5 leads in the first 30 days, we'll refund 50% of the management fee."*

Conditions:
- Shop must respond to leads within 24h
- Shop must keep their service prices, photos, and Google reviews stable during the trial
- Shop must not edit ad creative without FixFlow's approval

### 5.3 Free creative iteration

If a campaign isn't performing, FixFlow's team is **obligated** to swap creative within 7 days. No extra charge. Builds trust by removing the "you didn't try hard enough" complaint.

### 5.4 Spend caps tied to milestones

Don't let a shop spend $3,600 before any feedback loop. Structure: $400 first 4 days → review performance → continue or pause. **Limits damage at the budgetary level.**

### 5.5 "Test budget" entry tier

First month: $50/day instead of $120/day. Smaller stakes for proving the system works. Once shop sees ROI, upgrade. **Reduces buyer's-remorse risk.** Standard agency practice.

### 5.6 Diagnostic transparency

When a campaign fails, FixFlow shares the diagnostic openly:

> *"Your ad got 12,000 impressions, 50 clicks, 0 messages. The problem is the offer or landing page, not the audience. Here's what we recommend changing."*

**Honesty builds long-term trust even when results suck.** Turns a fight into a problem to solve together.

### 5.7 Money-back trigger conditions

> *"If we don't deliver 1× ROI in the first 60 days, we refund the management margin (the $20/day part)."*

FixFlow eats their own cost but **does not** refund Facebook spend. Aligns incentives without exposing FixFlow to unbounded liability.

## 6. Recommendations for FixFlow specifically

Given the brand promise is *"FixFlow brings you paying customers,"* the safeguards must be visible and meaningful. My ranking:

| Priority | Safeguard | Why |
|---|---|---|
| **Must-have** | Auto-pause after N days with $0 revenue (e.g., $400 spent → 0 bookings → pause + alert) | Prevents a $3,600 bleed; preserves the relationship |
| **Must-have** | "Test budget" first month at lower daily rate | Lowers entry risk; shop can prove the system before going big |
| **Must-have** | Free creative iteration within 7 days of underperformance | Removes the "bad creative" excuse + the friction of asking |
| **Strongly recommended** | Money-back trigger on the *margin* (not ad spend) for sub-1× ROI | Aligns FixFlow's incentive with the shop's; creates trust |
| **Recommended** | Transparent diagnostic dashboard | Shows the shop why it's failing; turns blame into collaboration |
| **Recommended** | Pre-flight quality check before launch (shop's reviews, photos, Google profile) | If the shop has 2-star reviews, no amount of ads will save them; flag it before spending money |
| **Nice-to-have** | Performance floor with conditions | Marketing best practice; fine to add in v2 |

## 7. Proposed contract terms for Plan B

The current spec describes Plan B as *"$120/day, FixFlow keeps $20 margin."* That's a price tag, not a contract. A real Plan B agreement should include:

> ### Plan B — Standard Terms (proposed)
>
> 1. **Test month at $50/day.** Auto-upgrade to full $120/day after 30 days of confirmed positive ROI.
> 2. **Auto-pause triggers:**
>    - No leads after $400 spent → soft-pause, email shop
>    - No bookings after $800 spent → hard-pause, admin re-enables
> 3. **Creative iteration commitment.** FixFlow swaps creative within 7 business days when CPL > 2× target. No extra charge.
> 4. **ROI refund trigger.** If 60-day cumulative ROI < 1×, FixFlow refunds the management margin ($20/day × days run). Ad spend (the $100/day to Facebook) is non-refundable.
> 5. **Shop responsiveness requirement.** Shop must respond to AI-escalated leads within 24h. Lead loss due to shop unresponsiveness disqualifies refund eligibility.
> 6. **Brand reputation requirement.** Shop's Google/Facebook reviews must remain ≥3.5 stars. Brand reputation issues outside FixFlow's control void the performance commitment.
> 7. **Mutual cancellation right.** Either party can cancel Plan B with 7 days' notice without penalty. Existing campaigns wind down naturally.

That's roughly the contract a sane marketing agency offers. **Without something like this, Plan B is a trap waiting to spring.**

## 8. Comparison across the three plans (worst case)

| Plan | Worst case for shop | Worst case for FixFlow |
|---|---|---|
| **A (shop self-pays)** | Shop wastes $3,000 on Facebook directly + $299 dashboard fee. **Total loss: $3,299.** | FixFlow loses $299 in revenue + reputation damage. |
| **B (FixFlow margin)** | Shop pays FixFlow $3,600. Gets 0. **Total loss: $3,600.** | FixFlow keeps $600 margin from a customer who churns + warns others. **Worst optics for FixFlow.** |
| **C (performance fee)** | Shop pays $0 if 0 bookings. **No loss.** | FixFlow ate $3,000 in ad spend with 0 revenue back. **Direct dollar loss to FixFlow.** |

**Plan B is uniquely bad** — it's the worst case for the shop's pocketbook AND for FixFlow's reputation simultaneously. Plan A limits FixFlow's downside but doesn't include AI conversion. Plan C protects shops from the cost but transfers all risk to FixFlow.

This asymmetry is why **Plan B is the plan that needs the most safeguards**, even though it's marketed as "simple flat-fee for shops."

## 9. Open questions for the executive team

Cross-references to the existing review doc's Q1-Q11. These are new:

- **Q12 — Plan B underperformance handling.** What's the auto-pause threshold? What refund mechanism? What's our public commitment? Pick 4+ safeguards from §5.
- **Q13 — Plan C exposure ceiling.** Plan C transfers ad-spend risk entirely to FixFlow. If 20% of Plan C campaigns fail, what's the acceptable monthly loss? Cap per campaign? Cap per shop? Or accept unbounded exposure and price the per-booking fee accordingly?
- **Q14 — Performance commitment legal language.** "We bring you customers" and "5× ROI guaranteed" can be construed as guarantees under some jurisdictions. Need legal review of the marketing copy and contract terms before they're written.
- **Q15 — Test-budget tier as the default.** Is the $50/day test budget Plan B's *default* entry point, or only available on request? Defaulting to it limits exposure but reduces revenue per shop.

## 10. Risk register entry

Adding to the spec review doc's §8 risk register:

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Plan B campaign fails to generate any ROI for a shop, leading to refund dispute and reputation damage** | High (statistically inevitable across 1,000 shops) | Very High — jeopardizes business model + brand | Implement §5 safeguards (minimum 4 of 7) before Plan B launches; legal review of contract terms; pre-flight shop quality check |
| **Plan C scaled losses if many performance-fee campaigns underperform** | Medium | High — direct dollar loss to FixFlow | Cap ad spend per Plan C campaign; require shop quality bar; price per-booking fee high enough to cover statistical losers |

## 11. Bottom line

**This is not a "build it and figure it out" item.** Plan B's failure mode is statistically inevitable at any meaningful scale — 1 in 5 paid ad campaigns underperform across the industry. If FixFlow rolls Plan B out without a defined safety net:

- Some shops will lose $3,600+ each
- Some of them will be vocal about it
- Word of mouth in tight-knit industries (repair shops, gyms, salons) travels fast
- FixFlow's whole acquisition pitch (*"we bring you paying customers"*) collapses if it produces visible failures without recourse

Resolving §5's safeguards before launch is a few days of contract design and engineering — but it shapes whether the entire revenue stream survives its first 100 customers.

**Strong recommendation: do not ship Plan B without minimum safeguards 5.1, 5.3, 5.5, and 5.7.** All other commercial details can be tuned post-launch; this one cannot.
