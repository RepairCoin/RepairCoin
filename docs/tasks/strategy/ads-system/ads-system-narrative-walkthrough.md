# FixFlow Ads — End-to-End Narrative Walkthrough

**Created:** 2026-04-27
**Audience:** Non-technical readers (executives, sales, partner shops)
**Purpose:** Walk through the entire ads system as a story so non-engineers understand the workflow, who does what, and how money flows.
**Related:**
- [`ai-sales-agent-integration-strategy.md`](./ai-sales-agent-integration-strategy.md) — technical AI strategy
- [`review-fixflow-ads-system-spec.md`](./review-fixflow-ads-system-spec.md) — engineering review of the exec spec

---

## The Cast

Three characters carry the story:

- **Sarah** — owns *Quick Fix Phone Repair* in Manila. Just signed up to FixFlow.
- **Marcus** — works on FixFlow's ads team at HQ.
- **Emma** — random person scrolling Facebook on her lunch break, has a cracked iPhone.

--- 

## Chapter 1 — Sarah signs up

Sarah hears about FixFlow from a friend. She visits FixFlow.ai, signs up her shop, fills in her business info, hours, services, prices. **She pays $500/month** for the FixFlow software (this is the existing subscription).

Now she has a FixFlow shop dashboard. She can manage bookings, message customers, and run her business through the app.

> 💰 **At this point: FixFlow earns $500/month from Sarah. No ads yet.**

---

## Chapter 2 — Sarah opts into ads

A few weeks in, FixFlow shows Sarah an offer in her dashboard:

> *"Want more customers? Let FixFlow run ads for your shop. We'll handle Facebook, Instagram, and Google. You'll only pay when we bring you bookings."*

Sarah clicks **Yes**. She picks one of three plans:

| Plan | How it works |
|---|---|
| **A** | Sarah pays $100/day in ad spend directly to Facebook/Google. FixFlow charges $299/month for the dashboard service. |
| **B** | Sarah pays FixFlow $120/day flat. FixFlow uses $100 for ads, keeps $20 as their cut. *(FixFlow's preferred plan.)* |
| **C** | Pay-per-result. FixFlow runs ads at their own risk; Sarah pays $50 per confirmed booking (or 10% of revenue from those bookings). |

Sarah picks **Plan B** — $120/day to FixFlow. Simplest for her.

> 💰 **At this point: FixFlow earns $20/day margin from Sarah on top of the $500/month software fee.**

---

## Chapter 3 — Marcus creates the campaign

Over at FixFlow HQ, Marcus opens the **Admin Ads Control Center**. He sees Sarah's request and gets to work:

1. Picks a service from Sarah's catalog: *iPhone Screen Repair — $80, 30 minutes*
2. Picks an ad template from FixFlow's library: *"Cracked screen? We fix it today."*
3. Sets the budget: $100/day
4. Targets: people within 10 miles of Sarah's shop in Manila who searched for phone repair recently
5. Clicks **Launch**

The ad goes live on Facebook and Instagram, **paid for by FixFlow's ad account**. Marcus does this exact same process for 50 other shops the same morning.

> 🔑 **Key insight:** Sarah never opens Facebook Ads Manager. Sarah doesn't have to write copy. Sarah doesn't even know what AdSet means. **That's the whole point.**

---

## Chapter 4 — Emma sees the ad

Emma is on Facebook, lunch break, broken iPhone. She sees:

> 📱 *"Cracked iPhone screen? Quick Fix Phone Repair in Manila — same-day repair from $80. Tap to chat."*

She taps **Send Message**. Facebook opens Messenger, Emma writes: *"How much for an iPhone 13 screen?"*

This is the critical moment. Emma's message **does not go to Sarah's personal phone**. It goes through Facebook to **FixFlow's system**. FixFlow records:

- A new lead in `ad_leads` — Emma's name, phone, the campaign she came from
- A new conversation thread in FixFlow's messaging system
- Emma's lead status: **"New"**

---

## Chapter 5 — AI assistant takes over

Within 2 seconds, the AI assistant replies as if it were Sarah's shop:

> *"Hi! Thanks for reaching out to Quick Fix Phone Repair. iPhone 13 screen repair is $85, takes about 30 minutes, and we can do it same-day. We're at 4416 Roxas Blvd, open until 7pm tonight. Want to book a slot?"*

Emma: *"Yes, can I come at 4pm?"*

AI: *"4pm works. I'll need a $20 deposit to hold the slot — refundable if you cancel 2 hours ahead. Tap here to pay: [link]"*

Emma pays the $20 deposit through FixFlow's payment flow. The AI confirms:

> *"Booked! See you at 4pm. Your repair will be $85 total — $20 already paid, $65 due at the shop. Confirmation #: BK-9F2A12."*

**Lead status:** New → Contacted → Booked → Paid (deposit)

This entire conversation happened in **45 seconds** while Sarah was working on another customer. Sarah's only notification is a push: *"New booking from ad — Emma at 4pm — $85."*

---

## Chapter 6 — Emma shows up

4pm. Emma walks into Sarah's shop. Sarah opens FixFlow on her tablet, sees the booking, sees the $20 deposit already received. She fixes Emma's screen in 25 minutes. Emma pays the remaining $65 at the counter.

Sarah taps **Mark Complete** in FixFlow.

**Lead status:** Paid → Completed ✓

---

## Chapter 7 — The money flow (this is the key part)

Every dollar tracked:

| Who paid | Who received | Amount | What for |
|---|---|---|---|
| Emma | FixFlow (held in escrow) | $20 | Deposit |
| Emma | Sarah (cash at shop) | $65 | Remaining repair fee |
| FixFlow | Sarah | $20 | Released deposit (transferred to Sarah after job complete) |
| Sarah | FixFlow | $120 | Daily ads fee (Plan B) |
| FixFlow | Facebook | $100 | Ad spend |
| Sarah | FixFlow | $500/30 ≈ $16.67 | Daily share of monthly software subscription |

**On this single ad day, FixFlow's earnings from Sarah:**

- $20 margin from ads ($120 in - $100 to Facebook)
- $16.67 daily share of software subscription
- **Total: $36.67/day from Sarah**

**Emma paid $85 total ($20 deposit + $65 cash). All $85 ends up with Sarah.** FixFlow doesn't take a commission on Emma's transaction itself — they make money on Sarah, not on Emma.

---

## Chapter 8 — The dashboards tell the story

### Sarah's view (Shop Dashboard, end of day)

> ### Quick Fix Phone Repair — Today
>
> | Metric | Value |
> |---|---|
> | 💰 Spent on ads | $100 (paid to FixFlow $120, FixFlow keeps $20 margin) |
> | 📨 Leads | 14 |
> | 🛒 Bookings | 5 |
> | 💵 Revenue from ads | $510 (Emma's $85 + four others) |
> | ⚖️ ROI | **5.1× your money back** |
>
> *Lead pipeline: 14 new → 9 contacted → 5 booked → 4 paid → 3 completed → 2 lost (didn't reply)*

Sarah sees clearly: she paid FixFlow $120, got back $510. She's making $390 in profit per ad day. **She's never going to cancel this service.**

### Marcus's view (Admin Ads Control Center)

> ### FixFlow Ads — Today (across 50 shops)
>
> | Metric | Value |
> |---|---|
> | 💰 Total ad spend | $5,000 |
> | 💵 Total revenue charged to shops | $6,000 |
> | 🤝 FixFlow margin | $1,000 (Plan B shops only) |
> | 📈 Top performing campaigns | shop #34 (iRepair Mission), shop #12 (Sarah) |
> | ⚠️ Underperforming | shop #21 (low CTR, needs new creative) |

Marcus can pause low-performers, double down on winners, swap creative — making sure shops keep seeing positive ROI so they don't churn.

---

## Chapter 9 — One month in, the math for FixFlow

If Sarah runs ads for 30 days at $120/day:

| FixFlow revenue from Sarah, monthly | Amount |
|---|---|
| Software subscription | $500 |
| Ad margin (Plan B, $20/day × 30) | $600 |
| **Total from one shop, one month** | **$1,100** |

If FixFlow has **1,000 shops** with the same setup:

> **$1,100,000 / month ≈ $13.2M / year**

Of that:
- **$600K/month is ad margin** (scales with how much shops spend)
- **$500K/month is software subscriptions** (scales with how many shops)

**The ad margin is the new growth engine.** It can grow even without adding new shops — just by helping existing shops spend more profitably.

---

## Chapter 10 — Why this is structurally smart

Three reasons this is a great business model:

### 1. The shop becomes dependent (in a good way)

Sarah was paying $500/month for software (could potentially churn for a competitor). Now she's getting $390/day in profit from FixFlow's ads. **She's not going anywhere** — she'd have to rebuild the whole pipeline elsewhere.

### 2. FixFlow scales with the shop's success

Bigger shops spend more on ads → bigger margin for FixFlow. **We win when our customers win.** Aligned incentives.

### 3. The AI is the moat

Sarah could, in theory, hire a marketing agency. But no agency has:
- An AI assistant talking to leads in 2 seconds
- 24/7 availability
- Knowledge of the shop's services, prices, and calendar
- The booking + deposit + payment flow already wired up

The AI is what reliably turns *leads* into *bookings*. **No other competitor has this combination.**

---

## Chapter 11 — How the rollout phases match this story

| Spec Phase | What's manual vs automated in the story |
|---|---|
| **Phase 1 — Manual Dashboard** | Marcus manually types in "we spent $100 today, got 14 leads, 5 bookings, $510 revenue." ROI math works. Sarah sees her dashboard. |
| **Phase 2 — Lead Tracking** | Every lead automatically saved with status pipeline. Manual data entry for ad spend continues. |
| **Phase 3 — AI Agent** | The AI conversation in Chapter 5 becomes real. Replaces "shop manually replies to every lead." |
| **Phase 4 — Meta API** | Lead capture, ad spend, and performance numbers automatically pull from Facebook. No more manual entry. |
| **Phase 5 — Multi-Industry** | Same flow works for gyms, salons, plumbers, lawyers. Same engine, different shop types. |

> 🔑 **Key insight:** Sarah's experience **never really changes** between phases. What changes is how much manual work the FixFlow team does behind the scenes. Phase 1 — Marcus enters everything by hand. Phase 5 — the system runs itself.

---

## Chapter 12 — TL;DR in one sentence

> **FixFlow runs ads on Facebook/Google for shops, captures every customer who responds, has an AI assistant book them automatically, and shows the shop they got 5× their money back — and FixFlow earns from a $500/month software fee plus a margin on the ad spend they manage.**

---

## Quick reference — Where things happen

| Activity | Where it lives |
|---|---|
| The ad itself (image, headline) | Facebook, Instagram, Google, TikTok (external) |
| Where customer first sees the ad | Their social feed (external) |
| The click | External, then redirects |
| Conversation with AI | **Inside FixFlow** |
| Lead capture, status tracking | **Inside FixFlow** |
| Booking creation | **Inside FixFlow** |
| Deposit payment | **Inside FixFlow** (via Stripe) |
| Final payment in store | Cash/card, in person |
| ROI calculation | **Inside FixFlow** |
| Sarah's dashboard | **Inside FixFlow** |
| Admin's Ads Control Center | **Inside FixFlow** |

**FixFlow is the command center. Facebook is the megaphone. The AI is the salesperson. The shop is the workshop.**

---

## Where the revenue comes from (recap)

| Revenue stream | Charged to | When | How calculated |
|---|---|---|---|
| Software subscription | Shop | Monthly | Flat $500 |
| Ad margin (Plan B) | Shop | Daily | Charged amount minus actual ad spend |
| Performance fee (Plan C) | Shop | Per booking | $50/booking OR % of revenue |
| Ad spend pass-through (Plan A) | Shop | Daily | None — shop pays Facebook directly, FixFlow charges $299/mo for the dashboard |

**FixFlow does not take a cut of the customer's transaction.** Emma pays Sarah $85; all of it ends up with Sarah. FixFlow's revenue comes entirely from the shop side.

---

## Open questions still being decided

(Cross-reference: see [`review-fixflow-ads-system-spec.md`](./review-fixflow-ads-system-spec.md) §6 for the full list)

The story above assumes some choices that still need exec sign-off:

- Which billing model is the **default pitch** to new shops? (B is shown in this story, but A and C are still on the table.)
- How does the existing $500/month subscription mesh with Plan A's $299/month? (Are they additive, replacement, or tier upgrade?)
- When a booking gets refunded, does the day's reported ROI update retroactively?
- Who reviews ad creative for compliance — FixFlow or auto-approve?

Once those are decided, the numbers and policies in this narrative become product reality.
