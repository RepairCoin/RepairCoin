# AI Image Generation — Strategy (Scope)

**Status:** Strategy draft — not yet planned-out into implementation.
**Created:** 2026-05-28.
**Updated:** 2026-06-04 — added §3.4 + Phases 7–8 for shop's own / storefront
photos (reuse existing shop photos, treating `banner_url` as the storefront, plus
in-chat image upload). Also noted the edit-vendor switch to gpt-image-1 in §3.3.
**Owner:** Deo.
**Trigger:** exec message — *"To be able to generate images for the ads and marketing... can the model see the image and make designs...? Just extra token fees... we want the businesses to use the ai as much as possible to make more revenue."*

---

## 1. Goal

Enable shops to use AI for **three image-related capabilities** that span multiple platform products (AI Marketing, Ads System, and future surfaces):

1. **Generate** — text-to-image. *"Make me a Black Friday banner with 20% off in our brand colors"* → AI outputs a PNG ready to embed in an email or upload to Meta/TikTok.
2. **See** — image-as-input (vision / multimodal). Shop uploads their logo, storefront photo, or competitor's ad → AI extracts colors, describes layout, or critiques composition.
3. **Edit** — image-to-image. Take an existing image + a prompt → modified image (replace background, change colors, add text overlay).

The exec framing is enable-not-limit: *"extra token fees... we want businesses to use AI more for revenue."* Cost is acceptable if it drives revenue.

---

## 2. Why a separate doc (not inside ads-system/ or ai-marketing-campaigns/)

Image capabilities are **shared infrastructure**, not product-specific. Both AI Marketing (email banners, promo graphics) and the Ads System (Meta/TikTok/Google ad creative) want them. Possibly other surfaces too — Insights chart exports, customer-facing service photos, future product expansions.

Filing this under one product would force the other to reach across folders for vendor decisions, costs, and governance. Cleaner to scope it once as a platform capability, then cross-reference from the consumer products.

**Cross-references** (update these docs when this strategy lands):
- `docs/tasks/strategy/ai-marketing-campaigns/scope.md` §6 currently lists *"AI-generated images / brand visuals — text-only for v1"* in out-of-scope → swap to *"defer to ai-image-generation/scope.md"*
- `docs/tasks/strategy/ads-system/review-fixflow-ads-system-spec.md` line 201 mentions *"Phased rollout (text-first MVP → tool-use → multimodal)"* → expand multimodal portion to reference this doc
- `docs/tasks/strategy/ai-cost-summary.md` needs an image generation vendor row + revised per-shop monthly tiers

---

## 3. The three capabilities — what they actually do

### 3.1 Generate (text-to-image)

**Use cases:**
- Marketing email banner — *"Create a 600×300 banner for our Black Friday email — modern, energetic, with subtle nods to repair work"*
- Ad creative — *"Make 5 variants of a Meta carousel ad: 1080×1080, each highlighting a different repair service"*
- Promo graphics — *"Generate a coupon-style image with '20% off this weekend'"*

**Vendor options (commercial-use APIs only):**

| Vendor | Cost per image (1024×1024 HD) | Quality | Speed | Commercial terms | Notes |
|---|---|---|---|---|---|
| **OpenAI DALL-E 3** | $0.040 (HD square) / $0.080 (HD wide/tall) | Excellent for marketing-style art, struggles with text inside images | ~5-10s | Clean: commercial use allowed, image rights to creator | Recommended default — official API, well-understood, no surprises |
| **Google Imagen 3** (Vertex AI) | ~$0.040 | Excellent, especially with text-in-image | ~5-10s | Commercial use allowed, terms vary by Google Cloud product | Strong alternative; requires GCP account + Vertex setup |
| **Stability AI** (Stable Diffusion 3.5) | ~$0.0025-$0.010 | Variable; needs prompt expertise | ~3-5s | Open licensing including commercial use | Cheapest, but quality consistency suffers |
| **Midjourney** | ~$0.02-$0.04 | Best aesthetic quality, "designer-grade" | ~10-20s | No official API (Discord-based); third-party APIs are TOS gray area | Skip for v1 — no clean commercial-API path |

**Recommendation: DALL-E 3 for v1.** Clean terms, reliable API, decent quality, well-known cost. Evaluate Imagen 3 in v1.5 if specific use cases (heavy text-in-image, like coupon graphics) need it.

> **Implementation note (2026-06-03):** `dall-e-3` is not available on the OpenAI account, so Phase 1 uses OpenAI's current **`gpt-image-1`** — it supersedes DALL-E 3 (newer/better, ~$0.042/image at `medium`, matching the cost projections). Verified live on staging. See `implementation.md` §5.

### 3.2 See (image-as-input / vision)

**Use cases:**
- Shop uploads their **logo** → AI extracts dominant colors + style notes for brand-consistent generations downstream
- Shop uploads **storefront photo** → AI suggests campaign themes ("warm, neighborhood-feel — let's lean into community in the email body")
- Shop uploads **competitor's ad** → AI critiques + suggests how to differentiate
- Shop uploads **a draft email banner they made manually** → AI suggests improvements

**Vendor: Anthropic Claude Sonnet 4.6 (already integrated).** Vision is included in Sonnet's standard pricing — images count as ~1,500 tokens each at the standard $3/1M input rate (~$0.005 per image as vision input). No new procurement needed.

Alternative: OpenAI GPT-4o ($0.005-$0.01 per image vision input). Comparable quality. Skip unless we hit a specific Claude limitation.

> **The shop's own photo (esp. the storefront) is the headline "See"/"Edit" input.** How a shop actually gets that photo into the AI flow — reuse an already-uploaded shop photo vs. upload one in the chat — is specified in **§3.4** and phased in §7 (Phases 7–8). v1 only wired logo→colors vision; the storefront paths are the next expansion.

### 3.3 Edit (image-to-image)

**Use cases:**
- Take an AI-generated banner, ask AI to *"replace the background with our shop's storefront photo"*
- Iterate on ad creative: *"version A but with the headline larger"*
- Brand-fixup: *"this image is great but the colors don't match our brand — make it warmer with our hex #FFCC00 yellow"*

**Vendor options:**
**Vendor: Stability AI — Stable Diffusion 3.5 + inpainting.** Promoted to v1 capability on 2026-05-28 per exec requirement.

- **Stability AI** (Stable Diffusion 3.5 + img2img + inpainting) — $0.03-$0.06 per edit. Clean commercial-use API. Best-in-class quality for marketing/ad creative editing. Adds a 3rd vendor relationship (Anthropic + OpenAI + Stability).
- ~~DALL-E 2 edits~~ — rejected. ~$0.018/edit, would avoid the 3rd vendor, but quality is ~2 years behind Stable Diffusion 3.5. For marketing/ad work, output looks dated. OpenAI also keeps deprecating older DALL-E endpoints.
- ~~DALL-E 3 edits~~ — does not exist. OpenAI removed edit endpoints when DALL-E 3 launched.

**Recommendation: Stability AI in v1.** Image editing is the "designs" capability the exec specifically asked for; quality matters more than procurement simplicity. One additional vendor is a small cost relative to the user-visible quality jump.

> **Implementation note (2026-06-04):** editing **switched from Stability to OpenAI `gpt-image-1`** (`/v1/images/edits`). Stability SD3.5 img2img was found to ignore the edit instruction — at every strength (0.2–0.99), every model variant, and prompts as drastic as "blue underwater," it returned the source image essentially unchanged, while Stability text-to-image worked fine. gpt-image-1's edit endpoint applies the change reliably and preserves text/layout (verified live on `peanut`: "make it warmer" → real warm-sunset edit with text + logo intact), reuses the existing `OPENAI_API_KEY` (no 3rd vendor), and costs ~$0.04–0.07/edit. `StabilityClient` is retired from the edit path but kept in the tree, and **`STABILITY_API_KEY` is now unused** — no Stability dependency remains. If region-level inpainting is ever wanted, add a `mask` to `OpenAIImageClient.edit()` (gpt-image-1 supports masks) rather than reviving Stability. See `implementation.md`.

---

### 3.4 Bring your own photo (storefront & existing shop assets)

§3.2–3.3 assume the source image is either AI-generated or the brand-kit logo.
But the most-requested real-world input is the shop's **own** photo — above all
their **storefront photo**: *"put our storefront in the banner"*, *"add a Black
Friday overlay to this photo of our shop"*, *"look at our storefront and suggest
a campaign theme."* As of v1 there is **no way to feed an arbitrary shop photo to
the AI** (chat is text/voice only; the only vision path is logo→colors; the edit
tool falls back to the last AI-generated image). This section closes that gap.

Two complementary mechanisms — both planned, they coexist:

**A. Reuse existing shop photos (primary — no new upload).** Shops already upload
photos that live in DigitalOcean Spaces and are shop-owned:

- **`shops.banner_url` — treated as the shop's STOREFRONT photo** (the 1200×300
  shop banner is, in practice, the storefront/hero image). This is the default
  "your storefront photo" the AI resolves to.
- `shop_gallery_photos` — up to 20 photos with captions.
- `shop_services.image_url` — per-service photos.

The AI references these directly — no re-upload. The edit tool already accepts
any `/shops/{shopId}/` URL, so *"add a Black Friday overlay to our storefront
photo"* resolves `banner_url` → edits it. A small `list_shop_photos` /
`get_shop_photo` tool exposes the catalogue (URLs + type/caption) so the
assistant can pick the right one and disambiguate ("storefront" = banner). This
matches the brand-kit/logo **single-source-of-truth** decision (2026-06-04):
don't make the shop re-upload what they already have.

**B. In-chat image upload (UX layer — better for ad-hoc photos).** For a photo
that isn't already in the system (a fresh shot of the storefront, a competitor's
ad, a draft banner), add an **attach/paperclip affordance to the assistant input
panel**. The uploaded image → DO Spaces → its URL is plumbed into the orchestrate
request → available to both the vision tool (*"what theme fits this?"*) and the
edit tool (*"add our logo + 20% off to this"*). This is the lowest-friction,
most general path and the better long-term UX. A handles "what I already have";
B handles "something new" — ship A first, B right after.

---

## 4. Consumers (which products use what)

| Product | Generate | See | Edit |
|---|---|---|---|
| **AI Marketing campaigns** (existing, just shipped) | **✅ embed banner images in email bodies — BUILT 2026-06-04** (image card "Use in campaign" → banner block at top of email + **visual preview before send**) | v2 — analyze uploaded shop logo for brand consistency | **v1 — edit existing email banners with prompts** |
| **Ads System** (planned per `ads-system/`) | v1 of ads — generate ad creative for Meta/TikTok upload | v1 — analyze shop assets for brand consistency | **v1 — iterate on creative variants** (was v2; promoted) |
| **Insights** | Probably never (data charts are SVG, not AI-generated) | v3 maybe — *"here's a screenshot of my POS report, parse the numbers"* | Never |
| **Help Assistant** | Never | Never | Never |
| **AI Sales Agent** (customer-facing) | v3 maybe — generate visual confirmation cards | Could already do — customer uploads device photo, AI identifies repair needed | Never |

**v1 image rollout = Marketing email banners + ad creative + image editing.** Other surfaces defer.

---

## 5. Cost projection

Based on DALL-E 3 ($0.04 per HD image) + Stability AI ($0.045 average per edit) and realistic per-shop volume assumptions:

| Usage tier | Banners/mo | Ad variants/mo | Edits/mo | Total cost/mo |
|---|---|---|---|---|
| **Light** (occasional campaigns, no ads) | 2 | 0 | 1 | ~$0.13 |
| **Moderate** (weekly campaigns + light ads testing) | 4 | 10 | 5 | ~$0.79 |
| **Heavy** (frequent campaigns + active ads testing) | 10 | 50 | 20 | ~$3.30 |
| **Power user** (heavy A/B testing) | 20 | 200 | 60 | ~$11.50 |

**Vision input cost** (shop uploads logo etc. for AI to analyze): negligible (~$0.005 per image, used a few times per month). Folds into existing Claude Sonnet spend.

**Total platform-level cost at 100 active shops** with mixed adoption: roughly **$80-300/month for image generation + editing combined** — modest given the per-shop spend cap headroom.

**The cost driver shifts only for power users.** A shop running 200 ad variants/month with 60 edits is unusual; that profile pushes their AI spend from ~$33/mo (text-only heavy) to ~$45/mo (with images + editing) — still inside a reasonable $50/mo per-shop cap for non-ads shops, and a rounding error inside the $250/mo Plan B cap.

---

## 6. Open questions (need decisions before implementation)

1. **Q1 — Image generation vendor for v1?** ✅ LOCKED 2026-05-28
   - **OpenAI DALL-E 3 for generation** — clean commercial terms, official API, ~$0.04/image
   - **Stability AI Stable Diffusion 3.5 for editing** — best commercial-API quality for img2img / inpainting; ~$0.045/edit. Adds 3rd vendor.
   - Imagen 3 and Midjourney both evaluated and skipped — Imagen requires GCP setup overhead; Midjourney has no official commercial API.

2. **Q2 — Brand consistency mechanism?** Shops want their generated images to look ON-BRAND, not generic AI art. How do we enforce this?
   - Option A: **Brand kit setting per shop** — store logo URL, primary colors (hex), tone notes. Inject into every generation prompt as guardrails.
   - Option B: **Style reference upload** — shop uploads 3-5 example images, AI uses them as visual style reference. Best with Midjourney, weakest with DALL-E 3.
   - Option C: **Generate-then-edit pipeline** — generate base image, then overlay logo + brand colors via deterministic image processing (not AI). Hybrid; more code complexity.
   - Recommendation: A in v1, evaluate B in v1.5 if A produces too-generic results.

3. **Q3 — Compliance review for AI-generated ads?**
   - Meta and TikTok require disclosure of AI-generated political/social ads in some jurisdictions
   - For commercial ads, less regulation but their content policies still apply (no copyrighted character imagery, no medical claims, etc.)
   - Should we auto-route AI-generated ads through a Meta/TikTok preview API before posting? Or trust the shop owner to review?
   - Recommendation: shop-owner reviews + signs off in a `CampaignReviewModal`-style UX before publishing. Same destructive-confirm pattern as the AI Marketing send flow.

4. **Q4 — Who owns the generated image?**
   - DALL-E 3 terms: the user creating the image owns it. Shop owns images they generate.
   - But who's the "user" — the shop or the platform? Platform pays OpenAI; shop initiates. Recommend: platform's terms-of-service explicitly assign image ownership to the shop.
   - Worth getting legal review before launch.

5. **Q5 — Storage and CDN?**
   - DALL-E 3 returns a URL valid for 60 minutes. We need to download + store in our own bucket (DigitalOcean Spaces) immediately.
   - Storage cost: $0.02/GB/month + bandwidth. Cheap, but adds infrastructure.
   - Recommend: download + persist to DO Spaces on generation; serve via signed URLs.

6. **Q6 — Where does image generation get triggered in the AI Marketing flow?**
   - Option A: AI proactively adds an image when drafting a campaign ("here's a draft + banner I generated")
   - Option B: Shop explicitly asks ("add an image to that draft")
   - Option C: New tool `propose_campaign_image` in the marketing tool set; AI calls it when shop asks
   - Recommend: C — explicit tool means the shop sees the image proposal in a card before it lands in the email; preserves the propose-then-tap pattern.

7. **Q7 — Spend cap implications?**
   - Current per-shop cap: $30/month (recommended in `ai-cost-summary.md`)
   - Heavy image-gen user might push spend to $40-45/month
   - Recommend raising cap to **$50/month** at v1 image gen launch — gives breathing room for power users without runaway spend.

---

## 7. Phasing plan

Five phases. Could land in ~3-4 weeks of focused work, but each phase is independently shippable.

### Phase 1 — Image generation backend (3-5 days)

- New endpoint `POST /api/ai/images/generate` — accepts `{ prompt, shopId, dimensions, useCase: "marketing" | "ad" }`
- OpenAI DALL-E 3 integration; spend-cap enforced same as other AI surfaces
- Downloads generated image, persists to DigitalOcean Spaces, returns signed URL
- Audit log: `ai_image_generations` table (prompt, image_url, cost, latency)
- Brand-kit injection: read shop's stored brand settings (Q2 Option A), prepend to prompt

Acceptance: cURL POST with prompt → URL of stored PNG with brand colors visibly applied.

### Phase 2 — Marketing AI tool integration (2-3 days)

- New `propose_campaign_image` tool added to `services/marketing/registry.ts`
- Claude calls the tool when shop asks for an image
- Tool emits a `campaign_image_proposal` display payload (URL + alt text + regenerate button)
- `MarketingToolCallCard.tsx` renders the image preview with approve/reject/regenerate
- Approved images get embedded in the email's `designContent.blocks[].image` block (existing rendering supports this)

Acceptance: shop types *"add a Black Friday banner to that campaign"* → image proposal card renders → tap approve → image lives in the next preview modal.

### Phase 3 — Brand kit settings (1-2 days)

- New `shop_brand_kits` table: shop_id, logo_url, primary_color_hex, secondary_color_hex, tone_notes
- Shop dashboard → Settings → Brand Kit tab — upload logo, pick colors, write 1-2 sentence brand voice notes
- Phase 1's brand-kit injection reads from this table

Acceptance: shop fills out brand kit → next AI image generation visibly uses those colors.

### Phase 4 — Vision input (1-2 days)

- New `analyze_brand_assets` tool for AI Marketing — accepts uploaded image URL, returns description + extracted colors
- Optional helper at brand-kit setup: shop uploads logo → AI auto-fills suggested primary/secondary colors

Acceptance: shop uploads logo → "extracted dominant colors: #FFCC00, #1A1A1A" suggestion in brand kit form.

### Phase 5 — Ads creative pipeline (5-7 days, separate workstream)

- This is the ads-system v1 image work, not the marketing extension
- Generates ad creative variants (Meta sizes: 1080×1080, 1080×1350, 1080×1920 for stories/reels)
- A/B variant generation (5 ads from one prompt)
- Integrates with `ads-system/` ad creative upload flow
- Cross-references: `ads-system/review-fixflow-ads-system-spec.md`

Acceptance: shop creates ad campaign → asks for 5 creative variants → 5 images generated + previewed → shop picks 2 → those 2 push to Meta Ads as creative assets.

### Phase 6 — Image editing via Stability AI (2-3 days) ← PROMOTED TO V1 ON 2026-05-28

Per exec requirement: shops need to edit existing images with prompts (*"take this storefront photo and add a Black Friday overlay"* / *"replace the background"* / *"brighten the lighting"*).

- New endpoint `POST /api/ai/images/edit` — accepts `{ source_image_url, prompt, mask?, shopId }`
- Stability AI integration (Stable Diffusion 3.5 + inpainting endpoint when mask supplied, img2img endpoint when full-image transform)
- New env var: `STABILITY_API_KEY` (3rd vendor relationship — separate procurement from OpenAI)
- Spend-cap enforced same as other AI surfaces; edits count toward `current_month_spend_usd`
- Reuses the Phase 1 image storage layer (DigitalOcean Spaces) — edited outputs persist alongside generated ones
- New tool `propose_image_edit` added to AI Marketing tool set so Claude can suggest edits (*"want me to swap the background?"*)
- Audit log: extends `ai_image_generations` table with `operation_type` column (`generate | edit`)

Acceptance: shop picks an existing email banner → asks AI *"replace the background with our storefront photo"* → AI calls `propose_image_edit` → returns edited image preview → shop approves → edit lands in the campaign.

> **Phase-number note:** `implementation.md` already used "Phase 7" for the
> deterministic logo overlay (built in v1). The two phases below are *new* scope
> items (the storefront / own-photo capability) — titled rather than relied on by
> number to avoid collision.

### Phase 7 (new) — Storefront / shop-photo reuse (1-2 days) — see §3.4-A — ✅ BUILT 2026-06-04 (impl doc's "Phase 8"; uncommitted)

Let the assistant use the shop's **already-uploaded** photos, with `banner_url`
treated as the storefront. No new upload UX.

- ✅ New `list_shop_photos` tool (returns the shop's `banner_url`, gallery photos,
  and service images with type + caption) so the assistant can reference and
  disambiguate "your storefront photo" → `banner_url`. Verified live (peanut).
- ✅ **Default banner = ONE-TAP SUGGESTION (exec ask 2026-06-04), not auto.**
  Text-only stays the default — never auto-generate (cost + latency). A
  bannerless draft card shows "Add a banner?" → **Use storefront** (reuse
  `banner_url`) or **Design one** (`propose_campaign_image` from subject+body).
- `propose_image_edit` accepts these shop-owned URLs (already supported — it
  takes any `/shops/{shopId}/` URL); a vision read of the same photos for
  "suggest a theme from our storefront" awaits `analyze_brand_assets` (Phase 4).
- No schema changes, no new storage — pure tool + resolution logic.

Acceptance: shop says *"add a Black Friday overlay to our storefront"* → AI
resolves `banner_url` → edits it → proposal card. And *"look at our storefront
and suggest a campaign theme"* → AI reads `banner_url` via vision → theme ideas.

### Phase 8 (new) — In-chat image upload (2-3 days) — see §3.4-B — ✅ BUILT 2026-06-04 (impl doc's "Phase 9"; uncommitted)

Let the shop drop ANY photo into the assistant for vision or editing.

- ✅ Attach/paperclip affordance in the unified-assistant input + a generic
  upload (`POST /api/upload/ai-source` → `shops/{shopId}/ai-uploads`). Built a
  compact inline paperclip (the block `ImageUploader` is for settings forms).
- ✅ Uploaded URL plumbed into `/api/ai/orchestrate` (+ `/marketing-chat`) as
  `attachedImageUrl`, validated shop-owned, exposed to tools for that turn via a
  per-turn system note + tool context.
- ✅ NEW `analyze_brand_assets` vision tool — describe an attached image (themes
  / critique / colors), defaulting to the attached image. `propose_image_edit`
  prefers the attached image as its edit source. Both verified (analyze live;
  edit logic by inspection). Full LLM loop not yet browser-tested.

Acceptance: shop attaches a fresh storefront photo → *"what campaign theme fits
this?"* (vision) and *"add our logo + '20% off' to this"* (edit) both work end to
end, with the result rendered as a proposal card.

### Out of scope for v1

- **Video generation** (e.g., Sora, Runway) — separate scope, separate vendors, much more expensive
- **AI-generated product photos** of actual repair services — too risky (may misrepresent the shop's actual work)
- **Customer-facing image generation** — only shop owners can generate; customers can't trigger
- **Bulk batch generation** — one image at a time in v1; batch APIs come later if needed
- **Multi-image composition / collage layouts** — defer to v2; Stability AI supports it but adds UX complexity

---

## 8. Risk checklist

| Risk | Likelihood | Mitigation |
|---|---|---|
| AI generates images that misrepresent the shop's actual services | Medium | Brand-kit guardrails; shop reviews in modal before send/publish; compliance copy "AI-generated illustration; actual results vary" |
| Meta/TikTok rejects AI-generated ad creative for policy violation | Low-Medium | Phase 5 includes their preview API check before posting |
| Generated image contains accidental copyright content (recognizable celebrity, character) | Low | DALL-E 3 has guardrails against this server-side; secondary review in shop-owner approval step |
| Spend cap exhaustion for power users | Medium | Q7 raises cap to $50/month; daily image gen rate limit (50 images/day per shop) |
| OpenAI DALL-E 3 service outage | Low | Audit log captures failures; UX shows "image generation unavailable, try later" — non-blocking for text-only campaigns |
| Brand-inconsistent output ("doesn't look like our shop") | High | Q2 brand kit + iteration via regenerate button. Accept that AI image quality won't match a professional designer 100%. |
| Shop generates inappropriate imagery deliberately | Medium | Reuse OpenAI's content moderation API on prompts; audit log captures rejected prompts; shop ToS clause |

---

## 9. Cost-and-revenue framing for the exec

The exec's note — *"extra token fees... we want businesses to use AI more for revenue"* — is the right framing. Image generation should drive shop revenue, not be cost-optimized to the floor.

**Per-shop revenue lift hypothesis** (testable post-launch):
- Marketing campaigns WITH images have 2-3× higher click-through than text-only (industry benchmark)
- Ads with multiple creative variants outperform single-creative campaigns by 30-50% (Meta's own data)
- A shop that runs 4 campaigns/month with AI images instead of text-only could plausibly see +$200-500/month in attributable revenue

**Cost: ~$2-8/shop/month for active image gen users (per §5 table)**
**Plausible revenue lift: $200-500/month**
**ROI to shop: 25-100×**

This is the strongest "AI bundled in subscription" argument the platform can make. If shops actually see this lift, they'll happily stay on a $200+ subscription that includes image gen. The exec framing is correct.

**One caveat to surface:** image generation cost shifts the heavy-shop AI spend from ~$30 to ~$40, which pushes the bundle-vs-add-on breakeven slightly (see updated `ai-cost-summary.md`). But it's still bundleable at $200+ subscription tiers.

---

## 10. Next step

If decisions in §6 land roughly where recommendations point:

1. Procure OpenAI DALL-E 3 access (already part of OpenAI account from `voice-ai-dispatcher` scope — same account covers Whisper + DALL-E 3)
2. ~~**Procure Stability AI account** (NEW — required for Phase 6 image editing).~~ ✅ **DONE** — `STABILITY_API_KEY` is already set in `.env` (2026-06-02). Phase 6 is unblocked.
3. Lock the 7 decisions in §6
4. Write `ai-image-generation-implementation.md` mirroring AI Marketing + Voice doc patterns
5. Phase 1 first — backend endpoint, no UI changes, smallest blast radius
6. Update `ai-cost-summary.md` (done in companion update — see commit history)
7. Update `ai-marketing-campaigns/scope.md` §6 out-of-scope to defer to this doc
8. Update `ads-system/review-fixflow-ads-system-spec.md` multimodal mention to cross-reference this doc

No code work until decisions land + product alignment on Q2 (brand consistency) + Q3 (compliance) lands.
