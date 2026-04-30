# Proposal: AI Sales Assistant — Pricing Model

**For:** Executive review
**Created:** 2026-04-27
**Decision needed:** Approve pricing model so engineering can build the billing
**Detail reference:** [`ai-sales-agent-integration-strategy.md`](./ai-sales-agent-integration-strategy.md)

---

## Summary

FixFlow's AI Sales Assistant chats with customers 24/7 on behalf of shops — answering questions and booking appointments in seconds. This proposal recommends **bundling the feature free into the existing $500/month subscription for normal usage**, with a small overage fee only for shops with unusually high message volume.

For about 95% of shops, the AI is effectively free. Only power users with heavy traffic pay anything extra.

---

## The technology

We're using **Claude AI**, made by **Anthropic** — the same company that powers the development tools our team already uses. Two specific products are used together, picked automatically per message:

| Product name | Used for | Anthropic's price | What it means per conversation |
|---|---|---|---|
| **Claude Sonnet 4.6** (Premium speed) | Sales conversations, booking flows, upselling | $3 per million words read · $15 per million words written | **About 2 cents per conversation** |
| **Claude Haiku 4.5** (Fast speed) | Simple questions like *"What time do you open?"* | $1 per million words read · $5 per million words written | **Less than half a cent per conversation** |

Premium speed is only used when the question genuinely needs it. The system picks the cheaper Fast speed for simple lookups, keeping quality high and cost low.

### Other APIs and services needed

For the AI Sales Assistant MVP, the **only new external service we need to sign up for is Anthropic's Claude API**. Every other piece is already in our stack:

| Service | Purpose | Status |
|---|---|---|
| **Anthropic Claude API** | The AI itself | **🆕 NEW — needs sign-up** |
| Stripe | Existing billing — handles any AI overage charges as line items on the existing invoice | ✅ Already integrated |
| PostgreSQL database | Stores conversations, services, and customer info that the AI reads | ✅ Already in use |
| Push notifications (Expo + Web Push) | Notifies shops when AI escalates a tricky lead | ✅ Already in use |
| Email service | Booking confirmations and other transactional emails | ✅ Already in use |

Future phases (NOT in this proposal) may add voice transcription or photo-analysis APIs — for example, letting customers send a photo of a broken phone to get an instant repair quote. Those would be separate decisions later.

---

## How it works — context injection (not training)

> **Important clarification, since this came up:**
> The AI is **not trained** on FixFlow's data. We use a simpler approach called **context injection**.

| Training | Context injection (what we're doing) |
|---|---|
| Months of teaching the AI on huge piles of shop data | Each time a customer messages, we hand the AI a one-page briefing |
| AI's underlying model is permanently changed | AI's underlying model is **never modified** |
| Customer/shop data lives inside the AI model | Data stays in our database; only sent fresh for each reply |
| Updates require retraining (slow, expensive) | Updates work instantly — change a price, AI uses the new price on the next message |
| Risk of data leakage between customers/shops | Each conversation is isolated by design |

The AI does have full memory **within a single chat thread** (we re-send the last ~20 messages with each request) — it just doesn't carry memory across to *other* customers' conversations.

**For MVP, we use context injection.** Faster to launch, safer for privacy, easier to maintain, and updates immediately when a shop changes anything.

**Training (fine-tuning) becomes worth evaluating later** — only when we have 100K+ rated conversations *and* measured evidence that prompts have hit a quality ceiling. Realistically, year 3+ at the earliest. Until then, context injection is the right tool.

---

## What it costs FixFlow

Per customer conversation (5 messages back and forth, typical):

| Speed used | Cost per conversation |
|---|---|
| Premium speed | About **2 cents** |
| Fast speed | Less than **half a cent** |

A typical mix lands around **1-2 cents per conversation** in real usage.

### Realistic monthly cost as we grow

These numbers assume each active shop has ~100 customer conversations per month (industry average for service businesses with ads):

| Business stage | Shops using AI | Conversations / month | FixFlow's AI bill / month |
|---|---|---|---|
| **Pilot** (first 6 months) | 20 | ~2,000 | **~$30** |
| **Early growth** (year 1) | 50 | ~5,000 | **~$70** |
| **Established** (year 2) | 250 | ~25,000 | **~$350** |

Reference: at 50 shops, FixFlow earns roughly $25,000/month in subscriptions. AI cost (~$70) is about **0.3% of revenue**. At every stage above, the cost stays under 0.5% of revenue.

---

## What we propose to charge shops

Three tiers. Defaults make AI completely free for the vast majority:

| Tier | What shop pays | What it covers |
|---|---|---|
| **Default — AI off** | $0 (just the existing $500/mo subscription) | AI is opt-in. Disabled until the shop turns it on. |
| **Standard — AI on** | $0 extra (bundled in subscription) | About **500 customer conversations per month** included free |
| **Heavy use** | About **2 cents per conversation** above the bundle | Auto-charged with shop-set monthly cap to prevent surprise bills |

### What 500 free conversations covers in real terms

| Shop activity | Conversations / month | Bundle covers? | Extra charge |
|---|---|---|---|
| Small shop, low ad spend | ~50 | ✅ Yes | $0 |
| Average active shop | ~100 | ✅ Yes | $0 |
| Active shop with steady ads | ~300 | ✅ Yes | $0 |
| Busy shop running heavy ads | ~700 | ❌ Slightly over | **~$4 extra** |
| Multi-location chain (heavy power user) | ~2,000 | ❌ Well over | **~$30 extra** |

> **In short: ~95% of shops will never pay anything extra. The AI is essentially free with their existing subscription.**

For shops who do exceed the bundle, they're already making real money from those conversations — paying $4-30/month in AI fees is a rounding error against the bookings they're getting.

---

## Why charge anything at all

We could just give it away free for everyone. We recommend the bundled-with-cap model because:

1. **Prevents waste.** A shop could enable AI on services that don't generate any bookings, racking up cost for no benefit. The cap discourages this.
2. **Aligns price with value.** Heavy users get more out of it; charging proportionally is fair.
3. **Hardly anyone pays it.** Only ~5% of shops project to exceed the bundle. The remaining 95% see "free."

### Alternative — fully free for all shops

If the exec team prefers maximum adoption over per-feature margin, we could absorb 100% of the cost. At early stage (50 shops), that's only ~$70/month for FixFlow. Pros: simpler pitch, faster adoption, cleaner marketing. Cons: trains shops to expect free AI forever.

**Engineering recommendation: bundle-with-cap.** But fully-free is a perfectly viable alternative if simplicity wins.

---

## Decision needed from executives

Four yes/no questions:

1. **Approve the bundle-with-cap model?** (Or prefer fully free for everyone?)
2. **Confirm 500 conversations/month** as the right free bundle size? (Could be tuned higher or lower.)
3. **Confirm 2 cents per overage conversation** as the rate? (Passthrough cost + ~10% margin.)
4. **Confirm AI is disabled by default** until a shop opts in? (Yes recommended — prevents surprises.)

Once approved, engineering builds the billing logic in 2-3 days as part of the AI feature rollout.

---

## Bottom line

- **For 95%+ of shops, the AI is completely free** with their $500/month subscription
- **The AI is NOT trained** on shop or customer data — but it does have full memory within each chat thread (it reads the recent message history every time it replies, so customers experience a normal continuous conversation)
- **At early stage (50 shops), the feature costs FixFlow about $70/month** — less than 0.5% of revenue
- **The AI is the moat** that makes shops dependent on FixFlow — they won't churn once they see the conversion lift

**Approve to ship.**
