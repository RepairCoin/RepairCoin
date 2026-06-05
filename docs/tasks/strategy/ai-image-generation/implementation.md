# AI Image Generation — Implementation Plan

**Status:** Implementation plan — ready to build once gates (§2) clear.
**Created:** 2026-06-02.
**Updated:** 2026-06-04 — added **Phases 8–9** (shop's own / storefront photos:
reuse existing shop photos with `banner_url` as the storefront, then in-chat image
upload), mirroring `scope.md` §3.4 / scope Phases 7–8. Also recorded the
**edit-vendor switch Stability → gpt-image-1** (§1, Phase 6). *(scope's "Phase 7"
= this doc's Phase 8 and scope's "Phase 8" = this doc's Phase 9, because Phase 7
here was already the logo overlay — see the mapping note in §7.)*
**Owner:** Deo.
**Source of truth for scope/decisions:** [`scope.md`](./scope.md) (read first — this doc assumes its §6 decisions).
**Pattern mirrors:** `ai-marketing-campaigns/` (tool registry + propose-then-tap cards) and `voice-ai-dispatcher/` (thin OpenAI clients + spend cap + audit table + per-shop kill switch).

---

## 1. What we're building

Shared **image infrastructure** in `AIAgentDomain`, consumed first by **AI Marketing** (banners + editing) and later by the **Ads System** (creative variants — separate workstream):

- **Generate** (text→image) — OpenAI **`gpt-image-1`**
  > **Model note (2026-06-03):** "DALL·E 3" throughout this doc resolves in
  > practice to **`gpt-image-1`** — `dall-e-3` is *not available on the account*
  > and gpt-image-1 supersedes it (newer, better, ~same cost at `medium`). The
  > client is `OpenAIImageClient.ts`. Verified live on staging (Phase 1 PASS).
  > gpt-image-1 differs: sizes `1024x1024`/`1536x1024`/`1024x1536`, quality
  > `low`/`medium`/`high`, returns base64, and **rejects `response_format`**.
- **See** (image→analysis) — **Claude Sonnet 4.6 vision** (already integrated; no new vendor)
- **Edit** (image→image) — ~~Stability AI Stable Diffusion 3.5~~ → **OpenAI `gpt-image-1`** (`/v1/images/edits`)
  > **Edit-vendor switch (2026-06-04):** editing moved OFF Stability. SD3.5
  > img2img **ignored the edit instruction** — at every strength (0.2–0.99),
  > every model variant, and prompts as drastic as "blue underwater," it returned
  > the source image essentially unchanged, while Stability text-to-image worked
  > fine. gpt-image-1's `/v1/images/edits` applies the change reliably and
  > preserves text/layout (verified live on `peanut`: "make it warmer" → real
  > warm-sunset edit, text + logo intact), reuses `OPENAI_API_KEY` (no 3rd
  > vendor), ~$0.04–0.07/edit. `StabilityClient` is retired from the edit path
  > (file kept for reference). See Phase 6.

The shop's **own** photo — especially the **storefront** (`shops.banner_url`) — is the headline "See"/"Edit" input; how it gets into the flow is **Phases 8–9** (§7, mirroring scope §3.4).

Everything follows the established invariants: **shop-scoped from the JWT** (never from the model's args), **spend-cap enforced**, **audited every call**, **propose-then-tap** for anything that lands in a customer-facing artifact, **feature-flagged + per-shop kill switch from day 1**.

---

## 2. Gates — must clear before / during code

| Gate | Decision (scope §6) | Status | Blocks |
|---|---|---|---|
| **G1 — vendors** | DALL·E 3 (gen) + Stability (edit) | ✅ locked 2026-05-28 | — |
| **G2 — brand consistency** | Option A brand kit (colors+tone in prompt) **+ real logo overlaid deterministically — promoted to v1 (Deo 2026-06-02)** | ✅ confirmed (logo=v1; Option A) | Phase 3 + **Phase 7** |
| **G3 — compliance** | Shop owner reviews + signs off in a modal before send/publish (same destructive-confirm as Marketing send) | ✅ owner-approval for Marketing v1 (ads policy-check lives in ads workstream) | Phase 2 card UX |
| **G4 — image ownership** | ToS assigns generated-image ownership to the shop | 🟡 **exec OK that it gates public launch only; legal sign-off still required before broad rollout** | Public launch (not code) |
| **G5 — storage** | Download DALL·E URL immediately → persist to DO Spaces → serve public/signed URL | ✅ matches existing `ImageStorageService` | Phase 1 |
| **G6 — trigger** | New `propose_campaign_image` tool; AI proposes, shop taps | ✅ locked (Option C) | Phase 2 |
| **G7 — spend cap** | Raise per-shop cap to **$50/mo** at launch | ✅ **approved (exec 2026-06-03)** | Phase 1 ship |
| **Procurement** | DALL·E 3 via existing OpenAI account; `STABILITY_API_KEY` **already in `.env`** | ✅ done | — |

**All product gates cleared — code is fully unblocked.** Both vendor keys are configured (`OPENAI_API_KEY` covers DALL·E 3 + moderation + Claude vision; `STABILITY_API_KEY` for Phase 6 editing). Exec **approved the $50/mo cap (G7) and accepts that legal gates public launch only (2026-06-03)**. The single remaining pre-public-rollout item is **G4 legal sign-off** (ToS image-ownership line) — it does **not** block building/merging behind the flag; kick it off in parallel.

---

## 3. Architecture (where each piece lives)

Mirrors `backend/src/domains/AIAgentDomain` + `backend/src/services/openai/*`:

```
backend/src/services/openai/OpenAIImageClient.ts   ← NEW (gpt-image-1; mirror WhisperClient/OpenAITtsClient)
backend/src/services/openai/OpenAIModerationClient.ts ← NEW (prompt safety pre-check)
backend/src/services/stability/StabilityClient.ts  ← NEW (Phase 6; SD 3.5 img2img + inpaint)
backend/src/services/ImageStorageService.ts         ← EXTEND: add uploadBuffer()

backend/src/domains/AIAgentDomain/
  controllers/ImageGenerateController.ts             ← NEW  POST /api/ai/images/generate
  controllers/ImageEditController.ts                 ← NEW  POST /api/ai/images/edit (Phase 6)
  controllers/BrandKitController.ts                  ← NEW  GET/PUT /api/ai/brand-kit
  services/ImageGenerationAuditLogger.ts             ← NEW  (mirror VoiceAuditLogger)
  services/BrandKitService.ts                        ← NEW  read/write shop_brand_kits + prompt injection
  services/marketing/tools/proposeCampaignImage.ts   ← NEW  (Phase 2)
  services/marketing/tools/proposeImageEdit.ts       ← NEW  (Phase 6)
  services/marketing/tools/analyzeBrandAssets.ts     ← NEW  (Phase 4, vision; reused by Phase 9)
  services/marketing/tools/listShopPhotos.ts         ← NEW  (Phase 8 — shop's own photos; banner_url = storefront)
  services/marketing/types.ts                        ← EXTEND: + campaign_image_proposal display
  services/marketing/registry.ts                     ← EXTEND: register the new tools
  controllers/UnifiedAssistantController.ts          ← EXTEND: accept optional attachedImageUrl (Phase 9)
  routes.ts                                           ← EXTEND: mount the new routes

backend/src/routes/upload.ts                          ← EXTEND: generic ai-source upload → shops/{id}/ai-uploads (Phase 9)
backend/migrations/134_create_ai_image_generations.sql  ← NEW
backend/migrations/135_create_shop_brand_kits.sql        ← NEW

frontend/src/services/api/aiImages.ts                ← NEW (generate/edit clients; mostly chat-driven)
frontend/src/services/api/aiBrandKit.ts              ← NEW
frontend/src/components/shop/marketing-ai/MarketingToolCallCard.tsx ← EXTEND: render image proposal
frontend/src/components/shop/unified/OrchestrateToolCallCard.tsx    ← EXTEND: add image kind to MARKETING_KINDS
frontend/src/components/shop/unified/UnifiedAssistantPanel.tsx      ← EXTEND: image attach affordance (Phase 9)
frontend/src/components/shop/settings/BrandKitTab.tsx ← NEW (Phase 3)
```

**Reuse, don't rebuild:** the thin-client shape (read key at call time, Node `fetch`, no SDK, sanitized errors), `SpendCapEnforcer.canSpend/recordSpend`, the marketing tool registry + dispatcher, and `MarketingToolCallCard`'s display-kind branching. The unified orchestrator already merges `getMarketingTools()` — so the new tools light up in **both** the Marketing panel and the unified assistant for free.

---

## 4. Data model

### Migration 134 — `ai_image_generations` (audit, system of record)
```sql
CREATE TABLE IF NOT EXISTS ai_image_generations (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         VARCHAR(255) NOT NULL,
  operation_type  VARCHAR(16)  NOT NULL,         -- 'generate' | 'edit'
  vendor          VARCHAR(32)  NOT NULL,         -- 'openai' | 'stability'
  model           VARCHAR(64)  NOT NULL,         -- 'gpt-image-1' | 'sd3.5-large'
  prompt          TEXT         NOT NULL,
  source_image_url TEXT,                          -- edits only
  image_url       TEXT,                           -- persisted DO Spaces URL (null on failure)
  image_key       TEXT,                           -- DO Spaces key (for later delete)
  dimensions      VARCHAR(16),                    -- '1024x1024' etc.
  use_case        VARCHAR(32),                    -- 'marketing' | 'ad'
  cost_usd        NUMERIC(10,6) NOT NULL DEFAULT 0,
  latency_ms      INTEGER,
  moderation_flagged BOOLEAN  NOT NULL DEFAULT false,
  error_message   TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_image_gen_shop_created
  ON ai_image_generations (shop_id, created_at DESC);
```
The `operation_type` column satisfies scope §7 Phase 6's "extend the table" requirement up front (one table, gen + edit).

### Migration 135 — `shop_brand_kits` (G2 Option A)
```sql
CREATE TABLE IF NOT EXISTS shop_brand_kits (
  shop_id             VARCHAR(255) PRIMARY KEY,
  logo_url            TEXT,
  primary_color_hex   VARCHAR(7),                 -- '#FFCC00'
  secondary_color_hex VARCHAR(7),
  tone_notes          VARCHAR(500),               -- 1-2 sentence brand voice
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Kill switch
`ai_images_enabled BOOLEAN NOT NULL DEFAULT false` on `ai_shop_settings` — **created in migration 134** (alongside the audit table) so Phase 1 is self-contained (Phase 3's migration 135 = `shop_brand_kits` only). Default **false** → dark launch; flip per shop. Mirrors the `ai_global_enabled`/`ai_sales_enabled` gating the Sales Agent uses.

Both applied to staging via the existing `record-and-verify-migration` script flow.

---

## 5. Vendor clients

### Image generation (`OpenAIImageClient.ts`, gpt-image-1) — mirror `OpenAITtsClient`
- `POST https://api.openai.com/v1/images/generations`, body `{ model: "gpt-image-1", prompt, size, quality, n: 1 }` — **no `response_format`** (API rejects it; returns base64). Sizes `1024x1024`/`1536x1024`/`1024x1536`; quality `low`/`medium`/`high`.
- Sizes/pricing (scope §3.1): **HD square `1024x1024` = $0.040; HD wide/tall `1792x1024` / `1024x1792` = $0.080.** Map marketing banner → `1792x1024`, ad square → `1024x1024`.
- Returns a URL valid ~60 min → **caller must download immediately** (G5).
- Reads `OPENAI_API_KEY` at call time; never logs it; sanitized errors. Cost computed locally for the audit row.

### ~~Stability (`StabilityClient.ts`, Phase 6)~~ — **RETIRED 2026-06-04**
Editing now runs on **`OpenAIImageClient.edit()`** (`/v1/images/edits`, gpt-image-1) — see §1 + Phase 6. SD3.5 img2img ignored the edit instruction. `StabilityClient.ts` is kept in the tree for reference but is **not wired in**, and **`STABILITY_API_KEY` is now unused** (no Stability dependency remains). For region-level inpainting later, add a `mask` to `OpenAIImageClient.edit()` (gpt-image-1 supports it) rather than reviving this.

### Moderation (`OpenAIModerationClient.ts`) — risk mitigation (scope §8)
- `POST https://api.openai.com/v1/moderations` on the prompt **before** generating. If flagged → reject (400, audited with `moderation_flagged=true`), no image call. Cheap/free; closes the "deliberate inappropriate imagery" risk.

### Storage — extend `ImageStorageService`
Add a buffer-based method (current `uploadImage` only takes a `MulterFile`):
```ts
async uploadBuffer(buffer: Buffer, contentType: string, folder: string): Promise<UploadResult>
```
Flow per generation: fetch the vendor URL → `Buffer` → `uploadBuffer(buf, "image/png", `shops/${shopId}/ai-images`)` → store the returned public URL + key in `ai_image_generations`.

---

## 6. Brand kit + prompt injection (G2)

`BrandKitService.buildBrandedPrompt(rawPrompt, brandKit)` prepends deterministic guardrails before the vendor call:

> *"Brand guidance — primary color {primary_hex}, secondary {secondary_hex}; tone: {tone_notes}. Apply these to the image. ---  {rawPrompt}"*

Logo compositing is **not** done by the model — AI would distort a real logo. The shop's actual logo is stamped on **deterministically** (`jimp`), which is **promoted to v1 per Deo 2026-06-02** (was Q2 Option C / v1.5). See **Phase 7**. So a generated image gets brand **colors + tone** from the prompt (this section) **and** the real **logo overlaid** by Phase 7.

---

## 7. Phases (files · endpoint · acceptance · estimate)

> Phases 1–4 + 6 are the **shared-infra + Marketing** workstream (this doc). **Phase 5 (ads creative)** stays in `ads-system/` — cross-referenced, not built here.

### Phase 1 — Generation backend (3–5 days) · *no UI*
- `DallE3Client` + `OpenAIModerationClient` + `ImageStorageService.uploadBuffer`
- `ImageGenerateController` (factory + lazy singleton + `deps` for tests, mirroring `HelpAssistantController`): validate → kill-switch check → `SpendCapEnforcer.canSpend` (429 if exhausted) → daily rate-limit check (50/day/shop, count from `ai_image_generations`) → moderation → `buildBrandedPrompt` → DALL·E → download → `uploadBuffer` → audit row → `recordSpend` → return `{ imageUrl, imageKey, costUsd }`.
- Route `POST /api/ai/images/generate` (`authMiddleware`, `requireRole(['shop'])`), body `{ prompt, dimensions, useCase }`.
- Migration 134 + `ImageGenerationAuditLogger`.
- **Acceptance:** authed cURL with a prompt → URL of a stored PNG in DO Spaces with brand colors visibly applied; audit row written with cost/latency; over-cap returns 429; flagged prompt returns 400 with `moderation_flagged=true`.

### Phase 2 — Marketing tool integration (2–3 days) · depends on P1 (+P3 for brand colors)
- `proposeCampaignImage` tool (`MarketingTool`: `ClaudeTool` + `execute({shopId,pool})`) — calls the Phase 1 generation path, returns a new display:
  ```ts
  | { kind: "campaign_image_proposal"; imageUrl: string; imageKey: string;
      altText: string; prompt: string; operationType: "generate" | "edit";
      dimensions: string }
  ```
  Add this variant to `MarketingToolDisplay` (types.ts) and register the tool in `MARKETING_TOOLS` (registry.ts).
- `MarketingToolCallCard.tsx`: render the preview with **Approve / Reject / Regenerate**. Approve writes the image into the campaign's `designContent.blocks[].image` (existing email rendering supports it).
- `OrchestrateToolCallCard.tsx`: add `campaign_image_proposal` to `MARKETING_KINDS` so it renders in the unified assistant too.
- **Note (cost):** unlike send, **proposing generates** (the preview is a real ~$0.04 image); Regenerate spends again. Surface this in the card copy and count it in the cap. This is the deliberate cost-for-revenue tradeoff (scope §9).
- **Acceptance:** *"add a Black Friday banner to that campaign"* → image proposal card → Approve → image appears in the next CampaignReviewModal preview.

### Phase 2.5 — Campaign embed + visual preview (DONE 2026-06-04) · closes the loop P2 opened
Initial v1 left the image card at Copy-link + Regenerate (embed deferred). The banner now actually lands in the email and the shop sees it before send:
- **Image card → "Use in campaign"** (`CampaignImageProposalCard`, primary CTA) — resubmits a chat message carrying the image URL, so the model has it across the turn boundary (works around the text-only history gap).
- **`proposeCampaignDraft` gains optional `image_url`** — resolves a shop-owned URL (else falls back to the shop's most-recent generated image, mirroring `proposeImageEdit`) and **prepends an `{type:"image", src}` block above the headline** in `designContent.blocks` (the email renderer already draws image blocks). The `campaign_draft` display + result carry `imageUrl`.
- **`CampaignReviewModal` renders a visual email preview** (banner + subject + body, reflecting live edits) — the send-confirm modal now shows the actual banner. `CampaignDraftCard` also shows a banner thumbnail + "Banner attached".
- Works in both the Marketing panel and the unified assistant (routes through `OrchestrateToolCallCard`).
- **Verified:** headless `proposeCampaignDraft` with an image → persisted `design_content.blocks[0]` is the image block (banner above headline), `display.imageUrl` set, test draft cleaned up; backend + frontend typecheck clean.
- Files: `proposeCampaignDraft.ts`, `marketing/types.ts`, `aiMarketing.ts`, `MarketingToolCallCard.tsx`, `CampaignReviewModal.tsx`.

### Phase 3 — Brand kit settings (1–2 days) · unblocks P1's color injection
- Migration 135 (`shop_brand_kits` + `ai_images_enabled`).
- `BrandKitController` (`GET/PUT /api/ai/brand-kit`) + `BrandKitService`.
- `BrandKitTab.tsx` in shop Settings (shadcn form) — logo upload (reuse `ImageStorageService.uploadShopLogo`), color pickers, tone notes. `aiBrandKit.ts` client.
- **Acceptance:** shop fills brand kit → next generation visibly uses those colors.

### Phase 4 — Vision / "See" (1–2 days) · uses existing Claude vision
- `analyzeBrandAssets` tool — accepts an uploaded image URL, sends it to `AnthropicClient` as a vision input block (Sonnet, ~$0.005/image), returns `{ description, extractedColors: [...] }`.
- Brand-kit setup helper: "upload logo → auto-suggest primary/secondary hex."
- **Acceptance:** upload logo → *"extracted dominant colors: #FFCC00, #1A1A1A"* suggestion pre-fills the brand-kit form.

### Phase 6 — Editing (2–3 days) · ~~Stability~~ → **gpt-image-1** (DONE 2026-06-04)
- `ImageEditController` (`POST /api/ai/images/edit`, body `{ source_image_url, prompt, mask?, shopId(JWT) }`); reuses Phase 1 storage + audit (`operation_type='edit'`).
- **Vendor (updated 2026-06-04):** built on **`OpenAIImageClient.edit()`** (`/v1/images/edits`, `gpt-image-1`), **not** Stability — SD3.5 img2img ignored the edit instruction (see §1 callout). Output size auto-picked from the source PNG's aspect ratio (IHDR read) to keep framing; audit `vendor='openai'`, `model='gpt-image-1'`. `StabilityClient` retired from the path (file kept). `mask`/inpaint deferred (gpt-image-1 edit is full-image).
- `proposeImageEdit` marketing tool → same `campaign_image_proposal` display with `operationType:"edit"`. The tool resolves a missing/foreign `source_image_url` to the shop's most-recent image (cross-turn URL gap fix, 2026-06-03).
- **Acceptance:** pick an existing banner → *"make it warmer / replace the background"* → edited preview → Approve → lands in the campaign. *(Verified live on `peanut`.)*

### Phase 5 — Ads creative pipeline (5–7 days) · **separate workstream**
Lives in `ads-system/`. Reuses this doc's generation backend + storage + audit; adds Meta sizes (1080×1080 / 1080×1350 / 1080×1920), 5-variant batch, and the Meta preview/policy check (scope §8). Cross-reference only.

### Phase 7 — Logo overlay (deterministic compositing) — **V1** (2–3 days) · depends on P1 + P3
Per Deo 2026-06-02: **v1 must stamp the shop's actual logo on generated/edited images.** Not an AI call (AI distorts real logos) — pixel-exact compositing. **DONE + verified live 2026-06-03.** Built with **`jimp`** (not `sharp` as originally planned) — pure-JS, **no native bindings**, so zero cross-platform binary risk on the DigitalOcean `npm ci` deploy; logo compositing is low-volume so jimp's speed is a non-issue.
- `LogoOverlayService` — overlay `shop_brand_kits.logo_url` onto an image buffer at a configurable corner (default bottom-right) + safe margin + max-width ~18% of image width; preserve aspect ratio.
- Wired as a post-step on `/images/generate` + `/images/edit` (param `overlayLogo`, defaults true when a logo is set), applied **before** the DO Spaces upload so the stored PNG already has the logo baked in.
- Proposal card: logo on/off toggle + corner control — re-composite is **instant and free** (no new AI spend), unlike Regenerate.
- Brand-kit upload validates a **transparent-background PNG** for the logo (flag non-transparent so the overlay looks clean).
- Adds the `jimp` dependency (pure-JS, deploy-safe); ~zero marginal cost (local processing).
- **Acceptance:** generate a banner with a logo set → stored image has the real logo composited bottom-right with a clean margin; toggle off → no logo; non-transparent logo flagged at upload.

> **Sequencing note:** Phase 7 is small and depends only on P1 (an image to stamp) + P3 (the stored logo). Land it right after P3 so the very first proposal cards show the real logo — it's the most visible "this is *my* brand" moment.

> **Phase-number mapping (storefront work):** `scope.md` calls these "Phase 7
> (storefront reuse)" and "Phase 8 (in-chat upload)". Here they are **Phase 8**
> and **Phase 9** — Phase 7 in this doc was already the logo overlay. Same work,
> offset by one.

### Phase 8 (new) — Storefront / shop-photo reuse (1–2 days) · depends on P1 + P6 · scope §3.4-A — ✅ BUILT 2026-06-04 (integration branch, uncommitted)
Let the assistant use the shop's **already-uploaded** photos, with **`shops.banner_url` treated as the storefront** — no new upload UX, no schema change, no new storage.
- ✅ `listShopPhotos` tool (`list_shop_photos`, read-only, no args) — reads `shops.banner_url` (labeled **"storefront"**), `shop_gallery_photos` (photo_url + caption), and active `shop_services.image_url` (caption = service name); returns `{ photos:[{url,type,caption}], has_storefront, count }` so Claude resolves "your storefront photo" → `banner_url` and disambiguates which photo. shopId from the JWT only. Registered in `registry.ts` → auto-included in BOTH the orchestrate and marketing-chat tool sets. **Verified** against live DB (peanut: `has_storefront:true`, 11 photos; storefront URL carries the `/shops/{shopId}/` prefix `proposeCampaignDraft` accepts as a banner).
- ✅ `proposeCampaignDraft.image_url` already embeds any `/shops/{shopId}/` URL (resolveBannerImage), so the storefront banner "just works" once the tool surfaces it — description updated to name list_shop_photos as a source.
- ✅ Orchestrate + marketing system prompts updated: image tools enumerated, "storefront = banner_url", and the **default-banner = one-tap suggestion** rule (below).
- `proposeImageEdit` already accepts any `/shops/{shopId}/` URL (the shop-owned check added 2026-06-03), so an edit on `banner_url` "just works" too.
- **Default-banner decision (exec ask, 2026-06-04): ONE-TAP SUGGESTION, not auto.** Banners stay optional — text-only is the default (never auto-generate; it costs money + ~80s). A bannerless `campaign_draft` card shows an **"Add a banner?"** row with two chips — **Use storefront** (resubmits "Use our storefront photo as the banner…" → AI calls list_shop_photos → re-drafts with `banner_url`; if `has_storefront:false`, offers to design one) and **Design one** (resubmits "Design a banner…" → `propose_campaign_image` from the campaign's subject+body). Frontend: `CampaignDraftCard` in `MarketingToolCallCard.tsx` (renders in the Marketing panel AND the unified assistant via `OrchestrateToolCallCard`).
- Vision read of the same photos for "suggest a theme from our storefront" reuses `analyzeBrandAssets` (Phase 4, not yet built).
- **Acceptance:** *"add a Black Friday overlay to our storefront"* → AI calls `listShopPhotos`, picks `banner_url`, calls `proposeImageEdit` → edited proposal card. *"look at our storefront and suggest a campaign theme"* → AI reads `banner_url` via `analyzeBrandAssets` → theme ideas.

### Phase 9 (new) — In-chat image upload (2–3 days) · depends on P4 + P6 · scope §3.4-B — ✅ BUILT 2026-06-04 (integration branch, uncommitted)
Let the shop drop **any** photo into the assistant for vision or editing (the better UX; handles photos not already in the system).
- ✅ **Backend upload:** `ImageStorageService.uploadAiSource(file, shopId)` → `shops/{shopId}/ai-uploads`; `POST /api/upload/ai-source` (shop role, 5MB, image mimetypes) returns `{url,key}`.
- ✅ **Context threading:** `MarketingToolContext.attachedImageUrl` (optional). BOTH `POST /api/ai/orchestrate` and `/api/ai/marketing-chat` read `req.body.attachedImageUrl`, **validate it's a `/shops/{shopId}/` URL** (else ignored — can't point at another shop's image), pass it into the tool dispatch ctx, AND add a **per-turn non-cached system block** telling the assistant an image is attached + which tool to use. (Chose a system note over a vision content block in the loop — the vision happens inside `analyze_brand_assets`, keeping the orchestrate loop text-only/cache-friendly.)
- ✅ **Tooling:** NEW `analyze_brand_assets` (`analyzeBrandAssets.ts`, registered) — vision via `BrandAssetVisionClient.analyzeImage()` (new method): returns `{description, colors[], theme_ideas[]}`; defaults its source to `ctx.attachedImageUrl` (owner needn't paste a URL); ~$0.005, no spend-cap (mirrors brand-kit logo analysis). `proposeImageEdit` now **prefers `ctx.attachedImageUrl`** as the edit source when the model's URL isn't shop-owned, and its ownership check was broadened from `/ai-images/` to any `/shops/{shopId}/` path (so `ai-uploads` + existing photos count). **Verified live** (peanut storefront): analyze returned a description + 4 hex colors + 3 theme ideas for $0.0048; defaulted to the attached image with no `image_url` arg.
- ✅ **Frontend:** **Attach** (paperclip) button in `UnifiedAssistantPanel` action row → hidden file input → `POST /upload/ai-source` (cookie auth, mirrors `ImageUploader`); pending-attachment chip (thumbnail + name + remove) above the textarea; `askOrchestrate(sessionId, messages, attachedImageUrl?)` sends the URL with the next message then clears it; the sent user bubble shows the attached thumbnail (`Turn.imageUrl`). (Built a compact inline paperclip rather than reusing the block-style `ImageUploader`, which is sized for settings forms.)
- **Acceptance:** shop attaches a fresh storefront photo → *"what campaign theme fits this?"* (vision) **and** *"add our logo + '20% off' to this"* (edit) both render proposal cards end to end. ⚠️ Deterministic pieces verified headless; the full LLM tool-use loop (Claude picking analyze vs edit on an attached image) + the upload route over HTTP are **not yet browser-tested**.

---

## 8. Safety & cost controls (build into Phase 1)

- **Feature flag + per-shop kill switch** (`ai_images_enabled`, default off) — dark launch, flip per shop. Learning from voice v1's flagless big-bang.
- **Spend cap** — shared monthly `current_month_spend_usd` via `SpendCapEnforcer`; raise cap to **$50/mo** (G7).
- **Daily rate limit** — 50 images/day/shop (count from `ai_image_generations`), returns 429 with a clear message (scope §8 risk row).
- **Prompt moderation** — OpenAI moderation pre-check; flagged prompts never reach the image API and are audited.
- **Owner sign-off** — nothing publishes/sends without the shop tapping Approve (G3), reusing the Marketing destructive-confirm pattern.

---

## 9. Testing & QA

- **Unit (Jest, deps-injection):** controllers with mocked `DallE3Client`/`StabilityClient`/`SpendCapEnforcer`/storage — assert cap 429, rate-limit 429, moderation 400, audit-always (success + failure), brand-prompt prepend, shop-scoping (model-supplied shopId ignored).
- **Client unit:** `DallE3Client` cost math + sanitized errors; `buildBrandedPrompt` output; `extractKeyFromUrl` round-trip for cleanup.
- **Headless integration (staging):** `cURL`/script POST generate → assert a real PNG persists in DO Spaces + audit row (mirrors how the Voice `/speak` + orchestrate audit were verified). Guard the spend (1–2 images).
- **Browser:** image proposal card render + Approve/Regenerate; brand-kit form; vision color auto-fill.
- **QA fixtures doc:** `qa-test-guide.md` with parts per phase (mirror the unified-assistant guide).

---

## 10. Rollout

1. Land Phases **1 → 3 → 2 → 4** (3 before 2 so Phase 2 has brand colors; 1 can ship behind the flag before 3).
2. Ship behind `ai_images_enabled=false`; enable for **1–2 pilot shops**, watch `ai_image_generations` cost/latency/error + a few real generations.
3. Tune brand-prompt + moderation thresholds on real output.
4. Land **Phase 6** (`STABILITY_API_KEY` already configured).
5. Legal sign-off on **G4 (ownership ToS)** before broad enablement.
6. Broaden the flag.

---

## 11. Risks & cost

Inherit scope §8 (risk checklist) and §5 (cost: ~$0.13–$11.50/shop/mo by tier; ~$80–300/mo platform at 100 shops). Implementation-specific additions:
- **Propose=spend** — Regenerate loops can burn budget; the daily rate-limit + cap + visible "this generates a new image" copy mitigate.
- **DALL·E URL expiry (60 min)** — the download-immediately step is mandatory; a failed download must still write an audit row and surface a retry.
- **3rd vendor (Stability) outage** — edits degrade independently of generation; both are non-blocking for text-only campaigns.

---

## 12. Open items / companion-doc updates (scope §2 + §10)

- [x] `STABILITY_API_KEY` set in `.env`. — Still: confirm G2 / G3 / G7 (product); kick off **G4 legal**.
- [ ] `ai-marketing-campaigns/scope.md` §6 — swap "AI images out-of-scope" → "defer to ai-image-generation/".
- [ ] `ads-system/review-fixflow-ads-system-spec.md` ~line 201 — point the multimodal portion here.
- [ ] `ai-cost-summary.md` — add an image-vendor row + revised per-shop tiers (and the $30→$50 cap).

---

## 13. Build order (critical path)

```
Both vendor keys in .env ✓ (OpenAI + STABILITY_API_KEY) — no procurement gate
Confirm G2/G3/G7 ──┐
G4 legal ──────────┴─(gates LAUNCH, not code)
                   ▼
P1 generate → P3 brand kit → P7 logo overlay → P2 marketing tool → P4 vision → P6 edit → P8 storefront reuse → P9 chat upload → broaden flag
 (gpt-image-1+ (table+UI)     (jimp, V1,         (card+approve)      (Claude     (gpt-image-1  (listShopPhotos;       (attach UI +
  storage+                    real logo)                             vision)      /images/edits) banner_url=storefront)  ai-source upload)
  audit+cap+flag)
```
P8/P9 are the storefront / own-photo expansion (scope §3.4); P8 needs the edit path (P6) + gen (P1), P9 needs the vision tool (P4) + edit (P6).

**Smallest first shippable:** Phase 1 behind the flag (backend + audit, no UI) — the smallest blast radius, exactly as scope §10.5 recommends.
