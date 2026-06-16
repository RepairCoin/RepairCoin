# FixFlow Ads — End-to-End Narrative Walkthrough

**Created:** 2026-04-27 · **Updated:** 2026-06-16 (flat-tier billing; shop pays ad spend directly)
**Audience:** Non-technical readers (executives, sales, partner shops)
**Purpose:** Walk through the entire ads system as a story so non-engineers understand the workflow, who does what, and how money flows.
**Related:**
- [`../pricing-alignment/ads-flat-tier-user-story.md`](../pricing-alignment/ads-flat-tier-user-story.md) — the plain-English flat-tier money story
- [`../pricing-alignment/ads-flat-tier-decision-memo.md`](../pricing-alignment/ads-flat-tier-decision-memo.md) — the locked pricing decisions
- [`review-fixflow-ads-system-spec.md`](./review-fixflow-ads-system-spec.md) — engineering review of the exec spec

> **Billing model (locked 2026-06-15).** Ads is sold as a **flat monthly tier** — **Starter $199 / Growth $499 /
> Business $999** — on top of the monthly **subscription plan** (*target pricing:* Starter $99 / Growth $299 /
> Business $599 — the code still bills a flat $500/mo today). **The shop pays its own ad spend directly** (its own
> card on its own Meta/Google ad account); FixFlow takes agency access to *run* the campaigns. The flat fee is
> FixFlow's management fee — FixFlow never holds or marks up ad money. The old Plan A/B/C (dashboard fee / 20%
> markup / pay-per-result) are **retired**.

---

## The Cast

Three characters carry the story:

- **Sarah** — owns *Quick Fix Phone Repair* in Manila. Just signed up to FixFlow.
- **John** — works on FixFlow's ads team at HQ.
- **Emma** — random person scrolling Facebook on her lunch break, has a cracked iPhone.

---

## Chapter 1 — Sarah signs up

Sarah hears about FixFlow from a friend. She visits FixFlow.ai, signs up her shop, fills in her business info, hours, services, prices. She picks a **subscription plan** — *target pricing:* **Starter $99 / Growth $299 / Business $599** (the code still bills a flat $500/mo today). Sarah picks **Growth at $299/month**.

Now she has a FixFlow shop dashboard. She can manage bookings, message customers, and run her business through the app.

> 💰 **At this point: FixFlow earns $299/month from Sarah (Growth plan). No ads yet.**

---

## Chapter 2 — Sarah opts into ads

A few weeks in, a teaser appears on Sarah's dashboard: *"Want more customers? Let FixFlow run your ads."* She clicks **Explore ads →** and lands on her **Plans & Billing** hub. The **AI Ads Management** card offers three flat tiers:

| Tier | Monthly fee | What FixFlow runs for her |
|---|---|---|
| **Starter** | $199/mo | Facebook · 1 campaign · she replies to leads herself |
| **Growth** ⭐ | $499/mo | Facebook + Instagram · up to 3 campaigns · **AI answers every lead** |
| **Business** | $999/mo | + Google · up to 10 campaigns · priority |

Sarah picks the **Growth ads tier ($499/mo)** — she wants the AI handling leads. (This is the ads add-on,
separate from and on top of her $299/mo Growth subscription plan.) She also sets her **own ad budget** (say
$100/day) — **that money is hers and goes straight to Facebook/Google from her own ad account.** She clicks
**Request ads**; the card flips to *pending review*.

> 🔑 **Key:** the $499 is FixFlow's flat management fee. The ad budget is Sarah's own money, paid directly to the
> platforms — it never touches FixFlow's books, so FixFlow can't profit or lose on the spend itself.

> 💰 **At this point: once approved, FixFlow earns the $499/month Growth ads tier on top of Sarah's $299/month subscription.**

---

## Chapter 3 — John approves + creates the campaign

Over at FixFlow HQ, John opens the **Admin Ads Control Center**. He sees Sarah's request, clicks **Approve** (which sets her to the Growth tier), then builds the campaign on **Sarah's own connected ad account**:

1. Picks a service from Sarah's catalog: *iPhone Screen Repair — $80, 30 minutes*
2. Picks an ad template from FixFlow's library: *"Cracked screen? We fix it today."*
3. Confirms Sarah's budget: $100/day (charged to **Sarah's** card by Facebook)
4. Targets: people within 10 miles of Sarah's shop in Manila who searched for phone repair recently
5. Clicks **Launch**

The ad goes live on Facebook and Instagram, **paid for from Sarah's own ad account** — FixFlow just manages it for her. John does this exact same process for 50 other shops the same morning.

> 🔑 **Key insight:** Sarah never opens Facebook Ads Manager. Sarah doesn't write copy. Sarah doesn't even know what an AdSet is. **That's the whole point** — FixFlow runs it for her, she keeps ownership of the ad account.

---

## Chapter 4 — Emma sees the ad

Emma is on Facebook, lunch break, broken iPhone. She sees:

> 📱 *"Cracked iPhone screen? Quick Fix Phone Repair in Manila — same-day repair from $80. Tap to chat."*

She taps **Send Message**. Facebook opens Messenger, Emma writes: *"How much for an iPhone 13 screen?"*

This is the critical moment. Emma's message becomes a **lead** in FixFlow:

- A new lead in `ad_leads` — Emma's name, phone, the campaign she came from
- A conversation thread tied to that lead
- Emma's lead status: **"New"**

---

## Chapter 5 — AI assistant takes over

Within seconds (on Growth/Business, where AI auto-answer is on), the AI replies as Sarah's shop:

> *"Hi! Thanks for reaching out to Quick Fix Phone Repair. iPhone 13 screen repair is $85, takes about 30 minutes, and we can do it same-day. We're at 4416 Roxas Blvd, open until 7pm tonight. Want to book a slot?"*

Emma: *"Yes, can I come at 4pm?"*

AI: *"4pm works great — I'll get you set up and the team will confirm the time. See you then!"*

**Lead status:** New → Contacted → (Booked, once confirmed)

The AI answers in the shop's brand voice, 24/7, while Sarah works on another customer.

> ✅ **Where we are today vs. the vision:** the AI **converses and nudges toward booking** and is grounded in the
> shop's real brand/services. It does **not yet create the booking or take a deposit itself** — that handoff is
> separate future work. Outbound delivery is also currently **gated**: replies are *recorded* for the team to
> relay until a live SMS/WhatsApp/Messenger channel is wired. The booking + deposit flow below is the target end
> state (Stage 4+), shown so you can see where it's heading.

---

## Chapter 6 — Emma shows up

4pm. Emma walks into Sarah's shop. Sarah opens FixFlow on her tablet, sees the booking. She fixes Emma's screen in 25 minutes. Emma pays $85 at the counter.

Sarah taps **Mark Complete** in FixFlow.

**Lead status:** Booked → Completed ✓

---

## Chapter 7 — The money flow (this is the key part)

Take one ad day where Sarah's budget is $100. Every dollar tracked:

| Who paid | Who received | Amount | What for |
|---|---|---|---|
| Sarah (her own card) | Facebook/Google | $100 | Ad spend — **direct, never touches FixFlow** |
| Emma | Sarah (at the shop) | $85 | The repair |
| Sarah | FixFlow | $499/30 ≈ $16.63 | Daily share of the Growth ads tier |
| Sarah | FixFlow | $299/30 ≈ $9.97 | Daily share of the Growth subscription plan |

**On this single ad day, FixFlow's earnings from Sarah:**

- ≈ $16.63 (Growth ads tier, daily slice)
- ≈ $9.97 (Growth subscription plan, daily slice)
- minus a few cents of AI cost
- **≈ $26.60/day from Sarah — none of it from the ad spend**

**Emma's $85 all ends up with Sarah.** FixFlow takes no cut of Emma's transaction and no cut of the ad spend — its revenue is the flat fees Sarah pays.

> 💡 Why this is clean: because the ad budget is Sarah's own money on her own account, FixFlow carries **zero
> ad-spend risk**. Its income is the predictable flat fee, not a gamble on ad performance.

---

## Chapter 8 — The dashboards tell the story

### Sarah's view (Shop Dashboard, end of day)

> ### Quick Fix Phone Repair — Today
>
> | Metric | Value |
> |---|---|
> | 💰 Ad spend (her own budget) | $100 |
> | 📨 Leads | 14 |
> | 🛒 Bookings | 5 |
> | 💵 Revenue from ads | $510 (Emma's $85 + four others) |
> | ⚖️ ROI | **5.1× your money back** |
>
> *Lead pipeline: 14 new → 9 contacted → 5 booked → 4 paid → 3 completed → 2 lost (didn't reply)*

Sarah spent $100 on ads + her flat fee, got back $510. She's deeply in profit per ad day. **She's never going to cancel this service.**

### John's view (Admin Ads Control Center)

> ### FixFlow Ads — Today (across 50 shops)
>
> | Metric | Value |
> |---|---|
> | 💰 Total ad spend managed (shop-funded) | $5,000 |
> | 💵 FixFlow flat-tier revenue (run-rate) | 50 shops × their tier |
> | 📈 Top performing campaigns | shop #34 (iRepair Mission), shop #12 (Sarah) |
> | ⚠️ Underperforming | shop #21 (low CTR, needs new creative — swap it free) |

John pauses low-performers, doubles down on winners, swaps creative — keeping shops in positive ROI so they don't churn. (Auto-pause safeguards stop a campaign that burns budget with no bookings.)

---

## Chapter 9 — One month in, the math for FixFlow

If Sarah stays on Growth for the month:

| FixFlow revenue from Sarah, monthly | Amount |
|---|---|
| Subscription plan (Growth, target) | $299 |
| Growth ads tier | $499 |
| − AI cost (her leads) | ≈ −$8 |
| **Total from one shop, one month** | **≈ $790** |

(Her ad budget — say $3,000 that month — flows straight to Facebook/Google and is **not** FixFlow revenue.)

If FixFlow has **1,000 shops** averaging the Growth plan + Growth ads tier:

> **≈ $790,000 / month ≈ $9.5M / year**

That's the $499 ads tier + the $299 subscription — both **predictable flat revenue** that scales with the **number** of shops (and upsells to higher tiers on either line), not with how much anyone spends on ads.

---

## Chapter 10 — Why this is structurally smart

### 1. The shop becomes dependent (in a good way)

Sarah was paying $299/month for software. Now she's getting strong daily profit from FixFlow-run ads on her own account. **She's not going anywhere** — she'd have to rebuild the whole pipeline (and the AI) elsewhere.

### 2. Predictable, low-risk revenue

FixFlow earns a **flat fee**, not a cut of ad spend — so its income is steady and it never fronts or risks ad money. Growth comes from **adding shops and upselling tiers** (Starter → Growth → Business), not from gambling on campaigns. Incentives stay aligned through results + the money-back ROI safeguard (refund the fee if a campaign underperforms), not through marking up spend.

### 3. The AI is the moat

Sarah could hire a marketing agency. But no agency has an AI assistant answering leads in seconds, 24/7, that knows the shop's services, prices, and calendar — wired into the booking flow. **That combination is the moat.**

---

## Chapter 11 — How the rollout phases match this story

| Spec Phase | What's manual vs automated in the story |
|---|---|
| **Phase 1 — Manual Dashboard** | John manually enters "spent $100, 14 leads, 5 bookings, $510 revenue." ROI math works; Sarah sees her dashboard. |
| **Phase 2 — Lead Tracking** | Every lead auto-saved with status pipeline. Manual ad-spend entry continues. |
| **Phase 3/3.5 — AI Agent** | The AI conversation in Chapter 5 is real (converse + nudge; auto-answer on Growth/Business). Auto-booking is later. |
| **Phase 4 — Meta API** | Lead capture, ad spend, and performance pull automatically from Facebook (on the shop's account). No more manual entry. |
| **Phase 5 — Multi-Industry** | Same flow for gyms, salons, plumbers, lawyers. Same engine, different shop types. |

> 🔑 Sarah's experience barely changes between phases — what changes is how much manual work the FixFlow team does behind the scenes.

---

## Chapter 12 — TL;DR in one sentence

> **FixFlow runs ads on Facebook/Google for shops — on the shop's own ad account — captures every lead, has an AI
> answer them, and shows the shop a strong ROI; FixFlow earns a tiered subscription ($99–$599/mo, target) plus a
> flat $199–$999/mo ads tier, and never touches the shop's ad spend.**

---

## Quick reference — Where things happen

| Activity | Where it lives |
|---|---|
| The ad itself (image, headline) | Facebook, Instagram, Google (external) — on the **shop's** ad account |
| Ad spend | Shop's own card → the platform (direct) |
| Conversation with AI | **Inside FixFlow** |
| Lead capture, status tracking | **Inside FixFlow** |
| Booking creation | **Inside FixFlow** (shop/AI-assisted) |
| Deposit / final payment | In person or via Stripe (target state) |
| ROI calculation | **Inside FixFlow** |
| Sarah's dashboard + Plans & Billing | **Inside FixFlow** |
| Admin's Ads Control Center | **Inside FixFlow** |

**FixFlow is the command center. Facebook is the megaphone. The AI is the salesperson. The shop is the workshop — and owns its own ad account.**

---

## Where the revenue comes from (recap)

| Revenue stream | Charged to | When | How calculated |
|---|---|---|---|
| Subscription plan | Shop | Monthly | $99 / $299 / $599 (Starter/Growth/Business) — *target pricing* (flat $500 in code today) |
| AI Ads Management tier | Shop | Monthly | Flat $199 / $499 / $999 (Starter / Growth / Business) |

**FixFlow does not take a cut of the customer's transaction, and does not touch the ad spend** (the shop pays the platforms directly from its own account). FixFlow's ads revenue is entirely the flat management fee.

---

## Open questions / status

The big commercial choices are now **decided** (see `../pricing-alignment/ads-flat-tier-decision-memo.md`):

- ✅ Billing model — **flat tiers $199/$499/$999**; Plan A/B/C retired.
- ✅ Spend funding — **shop pays its own ad spend directly** on its own account, every tier.
- ✅ Tier inclusions — channels / campaign count / AI auto-answer per tier (Google + hard spend ceilings light up with the Meta/Google live work).
- ✅ Subscription stacking — the ads tier rides **on top of** the monthly subscription plan.

Still in flight (engineering / external, not commercial):

- **Tiered subscription ($99/$299/$599) is target pricing — not built yet** (code is still a flat $500/mo; the
  ads add-on flat tiers ARE built). Implementing the subscription tiers is the P0 pricing-alignment work.
- Live Meta/Google connection (OAuth onto the shop's account) + outbound lead transport (SMS/WhatsApp/Messenger).
- AI auto-booking from chat (today it converses + nudges; the shop/team confirms).
- The money-back **ROI-refund** safeguard (scoped, not yet built).
- Refund retroactively updating reported ROI (ROI is computed-at-read, so it already self-corrects).
