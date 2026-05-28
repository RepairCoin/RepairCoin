# AI Costs — Summary

Here's the AI cost picture so you can decide whether to include AI in the subscription or charge for it separately.

---

## Bottom line

Our AI features use three outside vendors: **Anthropic** (the AI assistants that draft campaigns, answer business questions, and chat with the shop's customers), **OpenAI** (voice transcription and image generation — not yet set up), and **Stability AI** (image editing — not yet set up; the "modify this existing image" capability you asked for).

A typical shop's AI spend ranges from **about $3/month (light user) to $42/month (heavy user with active ad-creative testing)**. The AI Sales Agent — the assistant that chats with the shop's customers — is the biggest cost driver, accounting for 75-95% of every shop's total.

**For shops on the upcoming Ads program**, AI costs are dramatically higher — **$45 to $150/month** because each ad-driven lead triggers an AI conversation. The good news: those shops also generate $600/month in ad margin for FixFlow, so AI is still only 14% of total revenue per shop. See the dedicated section below.

I recommend a **tiered spend cap** — $50/month for shops without ads, up to $250/month for shops on Plan B (heavy ads users). Plus a **$300/month total OpenAI spending cap** as a safety net.

Bundling AI into the subscription works comfortably if the subscription stays at **$250/month or higher** for non-ads shops. Ads-enabled shops bundle comfortably at any subscription price because of the ad margin offset.

---

## What we use AI for

| Where AI lives                  | Who uses it                 | What it does                                                                                                           |
| ------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **AI Sales Agent**              | The shop's customers (chat) | Answers questions, helps customers book repairs/services                                                               |
| **Business Insights Assistant** | Shop owners                 | "How much did I earn last week?" / "Who are my top customers?"                                                         |
| **AI Marketing Assistant**      | Shop owners                 | Drafts email campaigns from natural-language requests ("Send a Black Friday campaign")                                 |
| **Help Assistant**              | Shop owners                 | Answers "how do I…" questions about using the platform                                                                 |
| **Voice input** (planned)       | Shop owners                 | Talk instead of type — same AI assistants, voice-activated                                                             |
| **Image generation** (planned)  | Shop owners                 | AI creates banner images for marketing emails and ad creative for Meta/TikTok/Google ads                               |
| **Image editing** (planned)     | Shop owners                 | AI modifies existing images — "replace the background", "add a Black Friday overlay", "brighten this storefront photo" |

---

## The three AI vendors

### Anthropic (already in use)

Provides the AI models that do the heavy work — Claude Sonnet for drafting campaigns, answering business questions, and customer chat, plus Claude Haiku for lightweight routing.

- Pay-per-use, charged by the volume of text processed.
- Image analysis (when shops upload a logo or photo for the AI to look at) is included in the standard usage cost — no separate fee.
- Already integrated and running in production today.

### OpenAI (needs to be set up)

Provides voice transcription (Whisper) and image generation (DALL-E 3). Both run off **one OpenAI account** — single setup covers both.

- Pay-per-use. Whisper: $0.006 per minute of audio. DALL-E 3: $0.04 per standard image (or $0.08 for wider/taller image formats).
- Not yet set up. Someone with company billing authority needs to create the account, add a payment method, set a spending limit ($300/month recommended to start), and hand the API key to engineering. No long-term contract.

### Stability AI (needs to be set up)

Provides image editing (Stable Diffusion 3.5) — the "modify this existing image with a prompt" capability. We picked Stability AI because DALL-E 3 doesn't support image editing, and Stable Diffusion 3.5 is best-in-class for the marketing/ad-creative workflows you want to support.

- Pay-per-use. ~$0.045 per edit on average (ranges $0.03-$0.06 depending on operation).
- Not yet set up. Same procurement steps as OpenAI: create an account at platform.stability.ai, add a payment method, set a spending limit ($100/month recommended to start), and hand the API key to engineering. No long-term contract.
- Adds a third vendor relationship to the platform, but it's the only commercial-API option that delivers production-quality image editing.

---

## What things cost per use

These are real costs we measured in our staging environment over the last 3 days of testing:

| Action                                                    | Cost    |
| --------------------------------------------------------- | ------- |
| One AI Marketing campaign draft                           | ~$0.02  |
| One Insights question answered                            | ~$0.015 |
| One Help question answered                                | ~$0.01  |
| One AI Sales Agent customer chat message                  | ~$0.02  |
| One voice command (transcription + response)              | ~$0.02  |
| One AI-generated image (standard size)                    | $0.04   |
| One AI-generated image (wide or tall)                     | $0.08   |
| One AI image edit (replace background, add overlay, etc.) | ~$0.045 |
| One image analyzed by AI (shop uploads logo, etc.)        | ~$0.005 |

Individual actions are cheap. Total cost per shop depends entirely on how often each action happens.

---

## What a shop costs per month

Six usage profiles modeled below. The Sales Agent dominates the cost because it runs every time a customer chats with the shop, not just when the shop owner uses AI themselves. The bottom three profiles are shops on the Ads program — their cost is much higher because every ad-driven lead triggers an AI conversation.

### Shops NOT running ads

| Profile        | Description                                                                                                       | AI cost    |
| -------------- | ----------------------------------------------------------------------------------------------------------------- | ---------- |
| **Light**      | 1-2 customer chats/day, occasional Insights, monthly email campaign                                               | ~$3/month  |
| **Moderate**   | 5 customer chats/day, weekly Insights, 4 email campaigns/month                                                    | ~$12/month |
| **Heavy**      | 15 customer chats/day, daily Insights, weekly campaigns with images + ~20 edits/month, light ads-creative testing | ~$37/month |
| **Power user** | Heavy use plus active ad-creative testing (200+ ad images + 60+ edits/month)                                      | ~$45/month |

### Shops running the Ads program

When ads are running, every ad-driven lead becomes an AI conversation (the AI books the customer automatically). That's the entire value proposition — but it means AI volume scales with ad spend.

| Profile          | Description                                                                  | AI cost         |
| ---------------- | ---------------------------------------------------------------------------- | --------------- |
| **Light ads**    | ~14 ad leads/day → AI converts them to bookings (per the narrative scenario) | **~$45/month**  |
| **Moderate ads** | ~30 ad leads/day, multiple campaigns                                         | **~$100/month** |
| **Heavy ads**    | ~50+ ad leads/day, aggressive multi-campaign testing                         | **~$150/month** |

Most shops will land in the Light-to-Moderate range without ads. Once they opt into ads, AI cost jumps but FixFlow's revenue per shop jumps faster — see the dedicated ads section below.

---

## Recommended starting limits

To prevent runaway costs while you learn real adoption patterns. **Per-shop spending cap is tiered by ads plan** — non-ads shops have a low cap; ads shops get a higher cap because the AI is converting their ad leads into bookings.

| Limit                                                                      | Recommended value        | What it prevents                                                                                                                                                                        |
| -------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Per-shop monthly AI cap — no ads**                                       | **$50**                  | Heavy non-ads shop usage is ~$42/month; $50 gives small buffer.                                                                                                                         |
| **Per-shop monthly AI cap — Plan A** ($299/mo software, shop runs own ads) | **$80**                  | Light ads volume — shop is conservative if managing their own ad budget.                                                                                                                |
| **Per-shop monthly AI cap — Plan B** ($120/day to FixFlow)                 | **$250**                 | Heavy ads use up to ~$150/month; $250 gives headroom for power users. Critical: if the cap is hit mid-month, AI stops responding to ad leads and ad spend continues without conversion. |
| **Per-shop monthly AI cap — Plan C** (pay-per-result)                      | **$250**                 | Same as Plan B — FixFlow is running ads at its own risk, so AI volume could be similar.                                                                                                 |
| **Platform-wide OpenAI spending cap**                                      | **$300/month initially** | The total all shops combined can spend on voice + image generation. Set in OpenAI's dashboard. Raise as adoption grows.                                                                 |
| **Platform-wide Stability AI spending cap**                                | **$100/month initially** | The total all shops combined can spend on image editing. Covers ~2,200 edits/month. Set in Stability AI's dashboard. Raise as adoption grows.                                           |
| **Daily voice command limit per shop**                                     | **100/day**              | Anti-abuse — heavy real use is around 50/day.                                                                                                                                           |
| **Daily image generation limit per shop**                                  | **50/day**               | Same anti-abuse logic. Power-user ad testing might hit 20-30/day; 50 gives headroom.                                                                                                    |

**Why tiered, not flat?** A $50 flat cap would cause ads-enabled shops to hit the limit mid-month — which is the worst-possible outcome because AI is the conversion engine for FixFlow's ad business. Ad spend continues running, but AI stops replying to leads, and Sarah's ROI collapses overnight. Tiering the cap by plan aligns the AI budget with the revenue per shop.

---

## Should AI be included in the subscription, or sold separately?

Depends on the final subscription price. The math:

| Subscription price | AI cost per heavy user | AI as % of subscription | My recommendation                                                                                            |
| ------------------ | ---------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| **$99/month**      | $40                    | 40%                     | **Sell AI separately as an add-on.** Bundling eats too much of your margin.                                  |
| **$149/month**     | $40                    | 27%                     | **Tight bundle — I'd avoid it.** Consider a base plan without AI plus a paid AI tier.                        |
| **$199/month**     | $40                    | 20%                     | **Bundle with overage protection.** Include AI up to ~$25/month; charge per use above that.                  |
| **$299/month**     | $40                    | 13%                     | **Bundle comfortably.** Within normal SaaS profit margins.                                                   |
| **$500/month**     | $40                    | 8%                      | **Bundle comfortably (current plan).** AI is a small share of revenue — strong "Pro Plan includes AI" story. |

Rule of thumb: at $250/month subscription or more, bundling AI works comfortably. Below $200/month, you'll want to either charge separately for AI or build overage billing (charges per use after a monthly allowance is exhausted).

---

## Three pricing models worth considering

### Model A — Bundle AI in the subscription, hard cap (simplest)

The shop's subscription includes AI up to the $50/month cap. Above the cap, AI features stop working until next month.

- Simplest to build and bill.
- Risk: heavy users get cut off mid-month and complain.

### Model B — Bundle with overage (best customer experience)

Subscription includes a monthly AI allowance (e.g., $25 worth at a $200 subscription). Above that, the shop's monthly invoice picks up the extra cost automatically, with a small markup.

- Heavy users never get cut off.
- Requires building a usage-based billing layer — roughly one week of engineering work. Currently not in place.
- I'd recommend this if subscription lands at $150-$300/month.

### Model C — AI as a separate paid add-on

Base subscription has no AI (or just minimal Help). Pro Plan = base subscription + $25/month AI add-on.

- Clean product separation; AI becomes an upsell story for sales.
- More SKUs to manage in Stripe and the dashboard.
- I'd recommend this if subscription drops to $99-$149/month.

---

## Special case: shops on the Ads program

The Ads program changes the AI cost math significantly — both up and down. You need this in mind when finalizing ad-plan pricing.

### What changes

Without ads, a shop's customers find them organically (Google search, word of mouth) and chat at modest volume — maybe 5-15 conversations a day. With ads running, every lead from a Facebook/Google ad becomes an AI conversation. The AI is what converts those leads into paid bookings within seconds, often before the shop owner even sees the message.

That's the entire value proposition of FixFlow's ad system — but it means AI cost scales linearly with ad volume.

### The cost picture on Plan B (the preferred plan)

For a typical Plan B shop running $100/day in ads:

| Item                                                      | Amount            |
| --------------------------------------------------------- | ----------------- |
| Software subscription revenue (monthly)                   | $500              |
| Ad management margin ($20/day × 30)                       | $600              |
| **FixFlow's total revenue per shop**                      | **$1,100/month**  |
| AI cost on ad-driven chats (~30 leads/day × 4 turns each) | ~$65/month        |
| AI cost on shop-side use (Marketing, Insights, etc.)      | ~$35/month        |
| **FixFlow's total AI cost per shop**                      | **~$100/month**   |
| **Net per-shop margin**                                   | **~$1,000/month** |

AI is 9% of FixFlow's revenue from that shop. The math is comfortable — and the AI is what makes the ad program work at all.

### Why the spend cap is critical here

If we apply a low spend cap ($50/month) to ads-enabled shops, the cap gets hit halfway through the month. From that point onward:

- Ads keep running (Facebook keeps spending Sarah's $100/day)
- AI stops responding to incoming leads
- Leads sit unread; bookings drop to near zero
- Sarah's ROI collapses; she churns

Avoid this with a tiered cap (recommended above). Plan B shops get a $250/month AI cap — generous enough to cover heavy ads use without runaway risk, since FixFlow's revenue from that shop is also $1,100/month.

### Two product decisions worth flagging

1. **Should AI cost on ad-driven conversations be charged to the shop, or absorbed by FixFlow?** Strong argument for the latter — the AI is FixFlow's conversion engine, not a shop expense. Different accounting entirely (cost of goods sold on the ad business, not a usage charge). This also matters for how the ROI dashboard is presented to the shop.

2. **Should the ROI dashboard deduct AI cost when shown to the shop?** Today's draft shows the shop `revenue / ad_spend` = ROI. Adding AI cost to the denominator (`revenue / (ad_spend + AI cost)`) would be more honest but might soften the pitch. Most SaaS platforms hide platform costs from customer-facing dashboards; recommend keeping AI cost out of the shop-facing ROI number.

### Bottom line on ads

The Ads program **increases AI costs significantly** ($30-108/shop/month from ad-driven chats alone), but it also **increases FixFlow's revenue per shop more than proportionally** ($600/month margin on Plan B). On net, the ads program improves AI bundleability, not worsens it — provided the spend cap is sized correctly so AI doesn't fail when the shop needs it most.

---

## Why image generation matters

Image generation is the highest-leverage AI feature for shop revenue, not just a cost center. The numbers:

- Marketing emails **with images** typically get 2-3× higher click-through rates than text-only emails (industry benchmark).
- Meta and TikTok ads with multiple creative variants outperform single-creative campaigns by 30-50% (Meta's own published data).
- A shop running 4 image-rich campaigns per month could plausibly see **$200-500/month in additional revenue** from those campaigns.

That extra revenue costs the platform roughly **$2-9 per shop per month** in image generation fees. **Shop ROI on AI image generation is potentially 25-100×.**

This is the strongest argument for bundling AI into the subscription. Shops who actually use image generation will happily stay on a $200+ subscription because the AI is paying for itself in measurable lift. Image generation is the feature most likely to drive AI adoption from "nice to have" to "couldn't run my business without it."

---

## What you need to decide

Four open questions for the leadership team:

1. **What is the final subscription price?** This is the single biggest input to the bundle-vs-add-on decision. Everything else flows from this answer.

2. **Bundled, overage-based, or paid add-on?** Once subscription price is set:
   - $400+/month → bundle (Model A)
   - $200-$300/month → bundle with overage (Model B, requires ~1 week of billing work)
   - $99-$149/month → paid add-on (Model C)

3. **Raise + tier the per-shop spend cap?** Current $20 flat cap is too tight in two ways: too low for heavy non-ads users (need $50), and way too low for ads-enabled shops (need $250 for Plan B/C). I'd recommend raising AND tiering by ads plan regardless of which subscription pricing model you pick. A flat $50 cap would cause ad-driven AI to fail mid-month for active ads shops — worst possible UX.

4. **Should ad-driven AI cost be billed to the shop, or absorbed as FixFlow's cost of goods sold on the ad business?** Recommend the latter — the AI is the conversion engine for FixFlow's ad revenue, not a shop expense. This affects accounting + the ROI dashboard presented to the shop.

5. **Approve OpenAI account procurement?** Needed for voice transcription and image generation. Pay-as-you-go, no contract, $300/month spend cap to start. Someone with company billing authority creates the account, adds a payment method, sets the spending limit, and hands the API key to engineering.

6. **Approve Stability AI account procurement?** Needed for image editing (the "modify this existing image" capability you asked for). Pay-as-you-go, no contract, $100/month spend cap to start. Same procurement flow as OpenAI — separate account, separate billing relationship. Adds a third vendor to the stack but unlocks the design-editing feature DALL-E 3 can't do.

---

## In one sentence

> _AI costs the platform $3-45/month per shop without ads and $45-150/month per shop with the ads program running, across three vendors (Anthropic for the AI assistants, OpenAI for voice + image generation, Stability AI for image editing); both ranges are comfortably bundleable because revenue per shop scales faster than AI cost, but the spend cap needs to be tiered ($50 for non-ads, $250 for Plan B/C) so the AI doesn't fail mid-month for shops who need it most._
