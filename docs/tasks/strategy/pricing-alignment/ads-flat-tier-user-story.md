# User Story — The $199–$999 AI Ads Management Tier (plain-English walkthrough)

**Date:** 2026-06-15
**Purpose:** Explain, in a simple story, how the flat ads tier works and exactly where FixFlow makes money.
**Companion:** `ads-flat-tier-decision-memo.md` (the numbers + the decision).

---

## The cast

- **Sarah** — owns "Sarah's Phone Repair." A FixFlow shop. Already pays **$500/mo** for FixFlow.
- **Marcus** — FixFlow's ads admin. Runs ad campaigns for many shops from one dashboard.
- **FixFlow** — the platform that makes money in this story.

---

## Story 1 — Sarah signs up for ads (the $499 "Growth Ads" tier)

> Sarah's been on FixFlow for a year. Business is fine, but she wants more customers walking in.
> In her dashboard she sees a card: **"Want more customers? Let FixFlow run your ads."**

She clicks it and picks a tier. Here's what each one gets her:

- **Starter — $199/mo:** runs ads on **Facebook** for **1 campaign**, on **her own ad account** (she pays
  Facebook directly), up to about **$1,000/mo** of ad budget. She replies to leads herself. Good for testing
  the waters.
- **Growth — $499/mo ⭐ (most popular):** **FixFlow runs everything** on its managed account — **Facebook +
  Instagram**, up to **3 campaigns**, up to about **$3,000/mo** budget. The big upgrade: **AI texts every
  lead back automatically**, plus A/B ad testing, free ad swaps if one underperforms, and a test-budget
  on-ramp.
- **Business — $999/mo:** everything in Growth, scaled up — **Facebook + Instagram + Google**, up to **10
  campaigns**, **$6,000+/mo** budget, plus deeper reporting and priority support.

> The three things that really change as you go up: **who runs it & how much you can spend**, **how many
> campaigns**, and **whether AI answers your leads for you**.

Sarah picks **Growth ($499/mo)** — she wants the AI answering leads for her. She also sets her **ad budget at
$3,000/mo** — the money that actually buys the ads.

**The key thing she understands up front:**

- The **$499** is FixFlow's fee for _running_ the ads.
- The **$3,000** is _her own ad money_ — it goes straight to Facebook to buy the ads. FixFlow doesn't keep it.

---

## Story 2 — Marcus runs the campaign

> The next morning, Marcus opens the FixFlow admin dashboard. He sees Sarah's new ads request,
> approves it, and builds her campaign — "iPhone screen repair, $49, Springfield area."

He writes the ad, the system reviews it (so a bad ad can't get FixFlow's ad account banned), and it goes live
on Facebook and Instagram. Marcus does the same for 49 other shops that morning — **one admin, fifty shops.**

Over the month, Sarah's ads spend her **$3,000** budget on Facebook. **120 people** click and leave their
phone number. FixFlow's AI texts each one back within minutes, answers their questions, and nudges them to
book. **30 of them book a repair.**

---

## Story 3 — Follow the money (the important part)

At the end of the month, here's every dollar that moved:

| Money                  | Who pays it | Who receives it | Is it FixFlow's profit?                        |
| ---------------------- | ----------- | --------------- | ---------------------------------------------- |
| $3,000 ad budget       | Sarah       | Facebook        | ❌ No — passes through, FixFlow never keeps it |
| $499 ads fee           | Sarah       | **FixFlow**     | ✅ Yes                                         |
| $500 base subscription | Sarah       | **FixFlow**     | ✅ Yes                                         |
| ~$8 AI texting cost    | FixFlow     | Anthropic (AI)  | ➖ Small cost FixFlow pays                     |

So for Sarah this month:

- **FixFlow collected:** $499 (ads) + $500 (base) = **$999**
- **FixFlow's cost:** ~$8 (the AI that texted her leads)
- **FixFlow's profit from Sarah: ~$991**

And Sarah is happy: she spent $3,000 + $499 = $3,499 to get **30 new repair customers**.

> **The mental model:** Sarah's $3,000 is like gas money — it goes into the car (Facebook) to make the trip.
> FixFlow is the driver, and charges $499 to drive. FixFlow never keeps the gas money, so it can never
> lose money on gas. It just earns its driving fee.

---

## Story 4 — Why FixFlow does NOT pay for the ads

> Imagine FixFlow had instead said "the $499 includes your ads, don't worry about a budget."

Sarah would still need ~$3,000 of ads to get 30 customers. But now **FixFlow** pays Facebook the $3,000 out
of the $499 it collected. That's a **$2,500+ loss** on Sarah alone — every month, on every shop. The business
would collapse.

That's why the rule is simple and firm: **the shop always funds its own ad budget.** FixFlow only ever charges
its management fee.

---

## Story 5 — Zoom out: FixFlow's month

Across 50 shops averaging the $499 tier:

- **Profit per shop:** ~$991 (≈$491 ads fee after AI cost + $500 base)
- **× 50 shops = ~$49,550/mo profit**

…and the millions of dollars of ad spend those shops run? None of it touches FixFlow's books — it all flows
straight to Facebook. FixFlow's income is steady and predictable: **fees, not gambling on ad results.**

---

## Story 6 — What if Sarah's ads DON'T work?

> Not every campaign wins. About 1 in 5 ad campaigns underperform across the whole industry. So what
> protects Sarah when her ads flop? FixFlow's promise is built around four safeguards.

**⚠️ Status note:** of the four below, only the auto-pause safeguard (covered earlier — campaign auto-pauses
at $800 spent with 0 bookings) is **built today**. The four in this story are **planned, not yet built** —
they need exec sign-off and engineering work before launch. They're written here as the _intended_ shop
experience.

### Safeguard 1 — Test budget (start small, prove it works)

> Before Sarah commits to a big budget, her first month runs at a **lower daily spend** — say $50/day
> instead of $120/day. Small stakes. If the ads work, she scales up with confidence. If they don't, she's
> only risked a little.

It's like a test drive before buying the car. **(Not built yet.)**

### Safeguard 2 — Free creative iteration (we'll fix the ad, free)

> Two weeks in, Sarah's ad is getting clicks but no bookings. She doesn't have to argue or pay extra.
> FixFlow's team **commits to swapping in a new ad within 7 days** — new wording, new image, new offer —
> at no extra charge.

This removes the "you didn't try hard enough" fight. If it's not working, FixFlow keeps trying until it does.
**(This is a process/contract commitment, not software.)**

### Safeguard 3 — Money-back trigger (if it lost money, we refund our fee)

> After 60 days, FixFlow checks: did the ads at least pay for themselves? If the **ROI is under 1×** — meaning
> Sarah got back _less_ than she spent — FixFlow **refunds its management fee** (the $199–$999 it charged).

What's refundable and what isn't:

- ✅ **FixFlow's fee** — refunded. FixFlow won't profit from a campaign that failed.
- ❌ **The ad spend** — not refundable. That money already went to Facebook; it's gone, and it was Sarah's
  own ad budget.

Sarah qualifies only if she held up her end: she **replied to leads within 24 hours**, kept her **reviews at
3.5 stars or better**, and didn't change the ad herself. (A shop that ignores its leads can't blame the ads.)
**(Not built yet — there's no refund mechanism in the billing code today.)**

### Safeguard 4 — Plain-English diagnosis (here's WHY it failed)

> When a campaign struggles, Sarah doesn't just get a wall of numbers. She gets a clear explanation:
>
> _"Your ad reached 12,000 people and 50 clicked — but no one messaged. That points to the offer or the
> price, not the audience. We recommend lowering the advertised price or changing the headline."_

Honest diagnosis turns "your ads suck" into "here's the problem, let's fix it together." **(Partial today —
the raw numbers exist in the dashboard, but the plain-English explanation isn't built yet.)**

### Sarah's bottom line when ads fail

- She never bleeds money unchecked — the campaign **auto-pauses** if it spends with nothing to show.
- She starts **small** and scales only once it works.
- FixFlow **keeps trying** (free new ads) and **doesn't profit** if it ultimately fails (fee refunded).
- She always knows **why** — and what to change next.

> The worst case is honest and bounded: Sarah loses only her ad budget (capped by auto-pause), FixFlow earns
> nothing from the failure, and the relationship survives.

---

## One-line summary

> **Shops pay for their own ads. FixFlow charges $199–$999/mo to run them with AI. FixFlow keeps that fee
> (minus a few dollars of AI cost) as profit — plus the $500/mo base. Ad budgets pass straight through to
> Facebook and never put FixFlow's money at risk.**
