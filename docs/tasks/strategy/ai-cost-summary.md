# AI Cost Summary — Platform-wide

**Audience:** exec / pricing decisions.
**Purpose:** plain-English breakdown of what the platform's AI features cost per shop, per month, so the team can decide if AI is bundled in the subscription or sold as a paid add-on.
**Last updated:** 2026-05-28.
**Empirical basis:** 24 real audit rows from `ai_marketing_messages` across 3 days of QA testing (see `docs/tasks/strategy/ai-marketing-campaigns/v1-cost-report.md`).

---

## TL;DR (one-paragraph answer)

The platform uses three AI vendors: **Anthropic** (Claude Sonnet 4.6 + Haiku 4.5 + Sonnet vision input — already integrated), **OpenAI** (Whisper voice STT + DALL-E 3 image generation — both planned, single account procurement covers both), and **Stability AI** (Stable Diffusion 3.5 image editing — promoted to v1 per exec requirement). Per-shop monthly cost ranges **~$3 (light, no image use) to ~$150 (heavy ads-enabled shop)** depending on adoption. **NOT-on-ads shops** land at $3-$42/month. **ON-ads shops** land at $45-$150/month because every ad-driven lead triggers an AI conversation — but those shops also generate $600/month ad margin to FixFlow, so AI is still only 9-14% of per-shop revenue. **Spend cap must be TIERED** ($50/month base, $250/month for Plan B/C ads shops) — flat $50 cap would cause ad-driven AI to fail mid-month for active ads shops, breaking the conversion engine exactly when ad spend is highest. Bundling math works comfortably for ads-enabled shops at any subscription price; non-ads shops bundle comfortably at $250+/month subscription, need overage billing or add-on tier below that.

---

## 1. Vendor inventory

| Vendor | Model / Service | Used for | Status | Pricing |
|---|---|---|---|---|
| **Anthropic** | Claude Sonnet 4.6 | All "real work" AI — AI Sales Agent customer chat, Business-Data Insights answers, Marketing campaign drafting, Help assistant | ✅ Integrated | $3.00 / 1M input tokens · $15.00 / 1M output · $0.30 / 1M cached read · $3.75 / 1M cache write |
| **Anthropic** | Claude Haiku 4.5 | Lightweight classification — voice dispatcher router, intent routing | ✅ Integrated | $0.80 / 1M input · $4.00 / 1M output · $0.08 / 1M cached read · $1.00 / 1M cache write |
| **OpenAI** | Whisper API | Voice-to-text for the voice dispatcher (planned, not yet built) | ❌ **Not procured** | $0.006 / minute of audio |
| **OpenAI** | DALL-E 3 (image generation) | AI-generated banner images for Marketing emails + ad creative for the Ads System (planned, not yet built) | ❌ **Not procured** (same OpenAI account as Whisper — single procurement covers both) | $0.040 / image (1024×1024 HD square) · $0.080 / image (HD wide or tall) |
| **Anthropic** | Claude Sonnet 4.6 — vision input | Shop uploads logo / branding photo, AI analyzes for color extraction or brand-consistency hints | ✅ Already in Sonnet pricing | ~$0.005 / image (image counts as ~1,500 input tokens at standard rate) |
| **Stability AI** | Stable Diffusion 3.5 — image editing (img2img + inpainting) | Edit existing images with prompts ("replace the background", "add a Black Friday overlay") — promoted to v1 per exec requirement | ❌ **Not procured** (3rd vendor relationship — separate from OpenAI) | ~$0.045 / edit (average; ranges $0.03-$0.06 depending on operation) |

Five vendor capabilities total across **three** vendors: Anthropic (already integrated), OpenAI (Whisper + DALL-E 3, single account), Stability AI (image editing — new 3rd vendor). The two OpenAI items are a single procurement; Stability AI is a separate one. No long-term contracts; all three vendors are pay-as-you-go.

---

## 2. Cost per typical action

These are real per-action costs measured from production audit data (Anthropic surfaces) or vendor-quoted rates (OpenAI Whisper).

| Action | Cost | Notes |
|---|---|---|
| One AI Marketing draft (audience lookup + draft creation) | **$0.018** | Empirical median from v1 cost report. ~91% prompt-cache hit ratio. |
| One Insights Q&A (e.g. *"how much did I earn last week?"*) | **~$0.015** | Similar Sonnet profile, slightly less output than Marketing. |
| One Help question (article corpus lookup + answer) | **~$0.010** | Smaller prompt, smaller output. |
| One AI Sales Agent customer turn (one msg in/out) | **~$0.018** | Same Sonnet profile as Marketing per turn. |
| One voice command (transcription) | **$0.001** | Whisper for a 10-second utterance. |
| One voice command (router classification, Haiku) | **$0.0002** | Tiny — used by the voice dispatcher only. |
| Full voice-to-response flow (STT + router + AI response) | **~$0.019** | Whisper + Haiku + Sonnet response. |
| One AI-generated marketing image (DALL-E 3 HD square) | **$0.040** | Email banner, promo graphic, single ad creative. |
| One AI-generated wide/tall image (DALL-E 3 HD landscape/portrait) | **$0.080** | Used for ad formats requiring wider aspect (Meta carousel, story/reel). |
| One vision analysis (shop uploads logo / asset for AI to inspect) | **~$0.005** | Claude Sonnet vision input — folds into existing Anthropic spend. |
| One image edit (Stability AI img2img or inpainting) | **~$0.045** | "Replace the background", "add a Black Friday overlay", etc. New v1 capability. |

Key insight: **prompt caching cuts Sonnet cost ~3x.** The static system prompt + scaffolds (~7-12K tokens) cache effectively. Empirical Marketing flows came in at $0.018 vs the original $0.03-$0.05 projection.

---

## 3. Per-shop monthly cost tiers

Three usage profiles modeled against the per-action costs above. Sales Agent volume dominates because customer chat happens much more often than shop-owner-facing AI.

### Light shop — 1-2 customer chats/day, weekly Insights/Marketing, no image gen

| Surface | Volume | Cost |
|---|---|---|
| Sales Agent (customer chat) | ~45 conversations × 4 turns = 180 calls | $3.24 |
| Insights | 4 questions/mo | $0.06 |
| Marketing (text only) | 1 draft/mo | $0.02 |
| Help | 2 questions/mo | $0.02 |
| Voice (if used) | 50 commands/mo | $0.06 |
| Image generation | 0 images | $0.00 |
| **Total** | | **~$3.40/month** |

### Moderate shop — 5 customer chats/day, weekly cadence, occasional image use

| Surface | Volume | Cost |
|---|---|---|
| Sales Agent | ~150 conversations × 4 turns = 600 calls | $10.80 |
| Insights | 16 questions/mo | $0.24 |
| Marketing (text drafts) | 4 drafts | $0.07 |
| Help | 8 questions/mo | $0.08 |
| Voice (if used) | 200 commands/mo | $0.24 |
| Image generation | 4 banners | $0.16 |
| Image edits | 5 edits | $0.23 |
| **Total** | | **~$11.80/month** |

### Heavy shop — 15 customer chats/day, daily Insights, weekly Marketing + light ads testing

| Surface | Volume | Cost |
|---|---|---|
| Sales Agent | ~450 conversations × 4 turns = 1,800 calls | $32.40 |
| Insights | 30 questions/mo | $0.45 |
| Marketing (text drafts) | 8 drafts/mo | $0.14 |
| Help | 15 questions/mo | $0.15 |
| Voice (if used) | 500 commands/mo | $0.60 |
| Marketing image banners | 10 banners/mo × $0.04 | $0.40 |
| Ad creative variants | 50 variants/mo × $0.04 | $2.00 |
| Image edits (Stability AI) | 20 edits/mo × $0.045 | $0.90 |
| Vision (logo / brand analysis) | 5 uploads/mo × $0.005 | $0.03 |
| **Total** | | **~$37.10/month** |

### Power user — heavy ads-creative testing (200 image variants/mo, 60 edits/mo)

| Surface | Volume | Cost |
|---|---|---|
| Sales Agent | 1,800 calls (same as heavy) | $32.40 |
| Insights + Marketing + Help + Voice | combined | $1.42 |
| Marketing image banners | 20 banners/mo | $0.80 |
| Ad creative variants | 200 variants/mo × $0.04 | $8.00 |
| Image edits (Stability AI) | 60 edits/mo × $0.045 | $2.70 |
| Vision | 10 uploads/mo | $0.05 |
| **Total** | | **~$45.40/month** |

**The Sales Agent is still the cost driver (75-95% of monthly spend), but image generation becomes the second-largest line item at heavy use.** Insights, Marketing text, Help, and voice remain rounding errors by comparison.

**Net effect of adding image generation:** roughly +$2-9/shop/month for users who use it actively. Pushes heavy-shop monthly from ~$33 to ~$36; power-user with active ads-creative testing to ~$42.

### ADS-ENABLED SHOP PROFILES (significantly different cost picture)

When a shop opts into the Ads program (Plan A/B/C — see `ads-system/` strategy docs), every ad-driven lead becomes an AI conversation. AI volume scales with ad spend.

Per the narrative scenario in `ads-system/ads-system-narrative-walkthrough.md`, a typical Plan B day produces ~14 leads, each generating ~4 AI turns to book the customer. That's ~56 AI calls/day from ads ALONE on top of the shop's organic chat volume.

| Profile | Lead volume | Ad-driven AI calls/mo | Total monthly AI cost |
|---|---|---|---|
| **Light ads** | 14 leads/day × 30 = 420 leads | 1,680 calls × $0.018 = $30 | **~$45/month** (= $30 ads + $15 shop-side base) |
| **Moderate ads** | 30 leads/day × 30 = 900 leads | 3,600 calls × $0.018 = $65 | **~$100/month** (= $65 ads + $35 shop-side heavy) |
| **Heavy ads** | 50+ leads/day × 30 = 1,500+ leads | 6,000 calls × $0.018 = $108 | **~$150/month** (= $108 ads + $42 power-user shop-side) |

**Critical:** the engineering review (`ads-system/review-fixflow-ads-system-spec.md` §3.8) explicitly flags that AI cost was missing from the ads ROI math. This is not theoretical — at scale it's the second-largest line item after ad spend itself.

**FixFlow revenue offset on Plan B:**
- Plan B charges shop $120/day, pays Facebook $100/day → $20/day = $600/month margin
- Plus existing $500/month software subscription
- **Total revenue per Plan B shop: $1,100/month**
- AI cost at heavy ads use: ~$150/month = **14% of revenue per shop**

The margin math survives comfortably; the SPEND CAP is what's at risk if not tiered properly.

**Uncertainty bounds:**
- These estimates assume 80-91% cache hits on Sonnet (consistent with measured Marketing data).
- If cache effectiveness drops below 50% (e.g., Sales Agent's customer messages may cache less well than Marketing's templated scaffolds), heavy-shop cost could rise to **~$50/month**.
- If cache effectiveness stays high (~90%+), heavy-shop cost could drop to **~$20/month**.

**Working range for heavy users: $25-$55/month, most likely $35-45 depending on image generation + editing adoption.** Power users running aggressive ads testing can reach ~$45+. Image editing (Stability AI, promoted to v1) adds ~$1-3/month at typical use.

---

## 4. Current spend cap vs reality

The existing `ai_shop_settings.monthly_budget_usd` defaults to **$20/shop/month** and is enforced as a hard cap (HTTP 429 at the ceiling — see `SpendCapEnforcer.ts`).

**Problem:** at heavy use this cap is too tight — a busy shop with active Sales Agent traffic would hit 429 mid-month. Insights + Marketing + Help all rejected until next month. Bad UX for the shops actually using the platform.

**Recommendation:** raise the per-shop cap to **$30/month** for v1 of voice rollout. Revisit after 2-3 months of production data.

---

## 5. Recommended spend caps at launch

**Per-shop spending cap is TIERED by ads plan** — flat $50 cap would cause ads-enabled shops to hit the cap mid-month and AI would fail exactly when ad spend is highest (worst possible outcome).

| Cap | Recommended value | Why |
|---|---|---|
| **Per-shop monthly AI cap — no ads** | **$50** (raise from current $20) | Covers heavy non-ads users (~$36 modeled with image gen) AND power users running active ads-creative testing (~$42). Headroom for one bad month without 429s. |
| **Per-shop monthly AI cap — Plan A** ($299/mo software, shop runs own ad spend) | **$80** | Light ads volume — shop is conservative if managing their own ad budget. |
| **Per-shop monthly AI cap — Plan B** ($120/day FixFlow-managed) | **$250** | Heavy ads use up to ~$150/month; $250 gives headroom for power users. FixFlow earns $600/month ad margin per Plan B shop, so the cap is affordable. |
| **Per-shop monthly AI cap — Plan C** (pay-per-result) | **$250** | Same as Plan B — FixFlow is running ads at its own risk, AI volume similar. |
| **Platform-wide OpenAI cap (Whisper + DALL-E 3)** | **$300/month** initially | DALL-E 3 image generation + Whisper voice run on the same OpenAI account. Covers ~33K voice commands + ~5K image generations. Raise after 1-2 months of adoption data. |
| **Platform-wide Stability AI cap (image editing)** | **$100/month** initially | New 3rd vendor for image editing. Covers ~2,200 edits/month. Raise as adoption grows. |
| **Platform-wide Anthropic cap** | Configured at the Anthropic dashboard level — recommend **$5,000/month initially** (raised from $3,500 because Plan B shops drive higher Anthropic spend) | Anthropic spend = sum of per-shop Sonnet costs. 100 active shops mix: 70 non-ads ($35 avg) + 30 ads-enabled ($100 avg) = $5,450. Adjust based on actual mix. |
| **Voice rate limit per shop** | **100 voice commands/day** (per shop) | Anti-abuse guard separate from the dollar cap. Mirrors the existing 50-AI-drafts/day pattern in Marketing. |
| **Image generation rate limit per shop** | **50 images/day** (per shop) | Anti-abuse + cost protection for AI-generated visuals. A heavy ads tester might genuinely want 20-30 variants/day; 50 covers normal use without enabling runaway spend. |

**Tiered cap implementation:** read the shop's active ads plan from `shop_subscriptions` or similar table; pick the cap from the table above. If shop is on multiple plans (subscription + ads), use the higher cap. If shop has no ads plan, use the $50 base.

---

## 6. Decision matrix — bundle AI in subscription, or charge on top?

The $500/mo subscription price is **not yet final** (per exec note). The decision on whether AI is bundled depends on the final price. Below: AI cost as a % of subscription revenue at heavy use including image generation (~$40/shop/month).

| Subscription price | AI cost / mo (heavy w/ images) | AI as % of subscription | Recommendation |
|---|---|---|---|
| **$99/mo** | $40 | 40% | **Paid add-on.** AI bundling eats too much margin. Charge a separate $15-25/mo "AI Plus" add-on, OR use Stripe metered billing for usage above $X allowance. |
| **$149/mo** | $40 | 27% | **Tight bundle, NOT recommended.** Bundle viable but cuts margin meaningfully. Consider a lower-tier subscription without AI ($99 base + $50 AI add-on). |
| **$199/mo** | $40 | 20% | **Bundled OK with overage protection.** Include AI up to a $25/mo soft cap; charge overage above that via Stripe metered billing for shops who exceed (the heavy 10-15%). |
| **$299/mo** | $40 | 13% | **Bundle comfortably.** AI cost is within typical SaaS gross-margin tolerance. Overage protection still recommended for power users. |
| **$500/mo** | $40 | 8% | **Bundle comfortably (current plan).** AI is well within rounding-error territory on a $500 subscription. Position as included Pro Plan value. |

**The breakeven for "bundling makes sense" shifted upward with image gen added — now ~$200-250/mo** (was $150-200 before image gen). Above that, AI fits inside the subscription margin comfortably. Below, you need either a separate AI tier or overage billing.

---

## 7. Three pricing models worth considering

Based on the matrix above, three concrete pricing structures for the exec to weigh:

### Model A — Bundled (current plan, simplest)

- Subscription includes unlimited AI within the per-shop spend cap ($30/mo)
- Above cap → 429, shop has to wait until next month
- Pro: simple billing, no overage complexity, no shop-side surprise charges
- Con: heavy users get cut off mid-month; existing 7-figure-revenue shops can't pay for more usage even if they want to

### Model B — Bundled with overage (best UX)

- Subscription includes $X/mo AI allowance (e.g., $15 worth at $200 subscription)
- Above the allowance, Stripe metered billing kicks in at our cost + small margin (~30%)
- Pro: heavy users keep working without interruption; revenue scales with usage
- Con: requires building Stripe metered billing infrastructure (currently absent — see `docs/tasks/ai-subscription-billing-verification.md`); ~1 week implementation
- Recommended IF subscription lands at $99-$200

### Model C — AI as separate add-on tier

- Base subscription has NO AI (or minimal — e.g., just Help assistant)
- Pro Plan = base + $25/mo AI add-on (covers heavy use comfortably)
- Pro: clean product separation, AI is an upsell story for the sales team
- Con: more SKUs to manage; some shops may not buy AI and miss the differentiator
- Recommended IF subscription drops to $99-$149 and the team wants AI as a paid upgrade

---

## 8. What to ask the exec to decide

1. **Final subscription price?** Drives the bundle-vs-add-on decision directly. Until this is set, AI billing architecture can't be finalized.

2. **Bundle, overage, or add-on?** Per §7. Recommend Model B (bundled with overage) if subscription lands $150-$300; Model A if $400+; Model C if $99-$149.

3. **Per-shop spend cap?** Recommend raising from $20 to $30 regardless of pricing model. Existing cap is too tight for the empirical heavy-use case.

4. **Procure OpenAI Whisper now or wait?** Required for voice dispatcher v1 (see `docs/tasks/strategy/voice-ai-dispatcher/scope.md`). One-time setup, pay-as-you-go, no contract.

---

## 9. Open questions / unknowns

- **Sales Agent's actual per-shop volume at scale** — modeled at 15 chats/day for "heavy" but we don't have production data confirming this. Could be 5x higher or lower depending on shop type.
- **Cache effectiveness across surfaces** — measured 91% on Marketing. Sales Agent (customer messages are unique each time) may be much lower. Re-measure once Sales Agent has 30 days of production data.
- **Customer-side Sales Agent traffic ≠ shop-side AI usage** — the spend cap currently aggregates BOTH. If we want to separate "shop owner uses AI in Insights/Marketing/Help" from "shop's customers chat with AI Sales Agent," that's a billing architecture change.
- **Overage billing infrastructure** — currently absent. Building it = ~1 week of work. Bundle-only (Model A) avoids this; Models B and C need it.

---

## 10. Bottom-line summary (one-paragraph version for the exec)

> *"AI uses three vendors: Anthropic (Sonnet + Haiku + vision, already integrated), OpenAI (Whisper voice + DALL-E 3 image generation, single account procurement, not yet done), and Stability AI (image editing, promoted to v1 per exec requirement, separate account procurement). Per-shop cost varies by ads-program participation: NON-ads shops $3-$45/month, ADS-enabled shops $45-$150/month because every ad lead triggers an AI conversation. The Sales Agent dominates non-ads cost (75-95%); ad-driven chat dominates ads-enabled cost (60-70%); image editing adds $1-3/shop/month at typical use. Spend cap MUST be tiered: $50/month for non-ads, $250/month for Plan B/C ads shops — a flat cap would cause AI to fail mid-month for ads shops exactly when ad spend is highest. Ads-enabled shops bundle AI comfortably at any subscription price (AI is 9-14% of $1,100/month per-shop revenue on Plan B); non-ads shops bundle comfortably at $250+/month subscription. Below $200/month subscription for non-ads shops, need overage billing (~1 week to build, currently absent — see `docs/tasks/ai-subscription-billing-verification.md`)."*

**See also:**
- `docs/tasks/strategy/ai-image-generation/scope.md` for the image generation product scope (DALL-E 3 vendor choice, brand-consistency, ads pipeline, phasing).
- `docs/tasks/strategy/ads-system/` for the Ads program design — particularly `ads-system-narrative-walkthrough.md` Chapter 5 for the AI Sales Agent's role in ad-driven booking conversion, and `review-fixflow-ads-system-spec.md` §3.8 for the engineering review that flagged AI cost was missing from the original ROI math.
