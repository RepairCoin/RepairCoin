# AI Image Generation — QA Test Guide

**Status:** v1 built + verified **headless** on staging 2026-06-03. This guide
covers the **browser/manual QA pass** (not yet done) plus the headless repro.
**Backend:** behind the `ai_images_enabled` per-shop flag (default OFF).

**Branch — test on `deo/integration-unified-ai-image`.** As of 2026-06-03 the
AI-image branch was merged locally with the unified-assistant branch onto this
integration branch (merge commit `25676ce3`), so the **unified assistant renders
the image card** — test the full flow there. (The standalone `deo/ai-image-
generation` branch still works too, but predates the consolidation and only has
the legacy Marketing panel.) See "Integration / merge status" at the bottom.

Capabilities to test: **generate** (gpt-image-1), **brand kit** (colors/tone/
logo), **vision** (logo→colors), **edit** (Stability img2img), **logo overlay**
(jimp), and the **marketing tool + card**.

---

> **Two audiences:** **Part T (below)** is a plain-language, **browser-only**
> walkthrough for a manual **QA tester** — no SQL, no cURL. **Parts A–I** are
> **developer** smoke/data checks (cURL + SQL + headless scripts) for deeper
> verification. A QA tester only needs Part T.

---

## Part T — QA Tester walkthrough (browser only, no code)

**Before you start (a developer does this once):** enable AI images for your
test shop and give it budget, and make sure the test shop has a logo. Ask a dev
to "turn on `ai_images_enabled` for shop `<X>` and set its monthly AI budget to
$50." Then log in to the dashboard as that shop. That's all you need — the rest
is clicking.

**⚠️ Which AI surface do I use?** There is now **ONE assistant** — the **✨
"Ask AI Anything" pill** (or the **purple mic**). The old separate **Marketing /
Insights / Help panels were removed** in the unified-assistant consolidation, so
**use the unified assistant** for T3–T5 (ask it in plain English; it figures out
it needs an image).
> **Build note:** on the **`deo/integration-unified-ai-image`** branch (the
> recommended test target) the unified assistant renders the image card — the
> orchestrator wiring (`campaign_image_proposal` in `OrchestrateToolCallCard`'s
> `MARKETING_KINDS`) and the card renderer are both present. Only if you test the
> **standalone `deo/ai-image-generation`** branch (pre-consolidation) do you use
> its **legacy Marketing panel** for T3–T5 instead.

Mark each step **PASS / FAIL**. If something looks wrong, screenshot it + note
the step number.

### T1 — Brand Kit: set your colors, tone, and logo
1. Go to **Settings → Brand Kit** (the 🎨 *Palette* item in the left list under
   *Access*).
2. Set a **Primary color** (e.g. yellow), a **Secondary color** (e.g. near-black),
   type a one-line **Brand tone** (e.g. "Warm, friendly neighborhood repair shop").
3. Under **Logo**, upload an image (ideally a transparent-background PNG).
4. Click **Save brand kit**.
   - ✅ **PASS if:** you see a "Brand kit saved" confirmation, and if you leave
     the tab and come back the values are still there.

### T2 — Suggest colors from the logo (AI vision)
1. Still in **Brand Kit**, with a logo uploaded, click **"✨ Suggest colors
   from logo."**
2. Wait a few seconds.
   - ✅ **PASS if:** the Primary/Secondary color boxes **change to colors that
     match your logo**, and a short message describes your brand's look. Click
     **Save brand kit** to keep them.

### T3 — Ask the AI to make a marketing image
1. Open the **unified assistant** (the ✨ "Ask AI Anything" pill or the purple
   mic). *(Only on the standalone `deo/ai-image-generation` branch: use the
   legacy Marketing panel.)*
2. Type something like: *"Make a Black Friday banner — 20% off screen repairs."*
3. Wait for it to reply (image generation takes a few seconds).
   - ✅ **PASS if:** an **image card appears** under the reply showing a real
     generated banner, with the text *"Brand colors + logo applied,"* plus
     **Copy link** and **Regenerate** buttons.
   - ✅ The image should use **your brand colors**, and (if you set a logo) show
     **your logo in the bottom-right corner**.

### T4 — Review actions on the image card
1. **Click the image preview** → it should open the full-size image in a new tab.
2. Click **Copy link** → it should briefly say **"Copied."**
3. Click **Regenerate** → the assistant should produce a **new image card** (a
   different take on the same idea).
   - ✅ **PASS if:** all three behave as described.

### T5 — Edit an existing image
1. In the same **unified assistant** chat, after an image exists, ask: *"Take
   that image and make it warmer with a sunset glow"* (or *"replace the
   background with a storefront"*).
2. Wait for the reply.
   - ✅ **PASS if:** a new card appears labeled **"Edited image"** and the result
     **visibly differs** from the original (warmer / new background), still on-brand.

### T6 — Logo on / off
1. In **Brand Kit**, remove the logo and **Save**. Generate another image (T3).
   - ✅ **PASS if:** the new image has **no logo**.
2. Re-add the logo and **Save**. Generate again.
   - ✅ **PASS if:** the logo is **back, bottom-right**.

### T7 — When images are turned OFF (graceful)
1. Ask a dev to **turn `ai_images_enabled` OFF** for your shop.
2. In the unified assistant, ask for an image (T3).
   - ✅ **PASS if:** the assistant replies that **image generation isn't enabled
     yet** (a friendly message) — it must **not** crash or show a raw error.
3. Ask the dev to turn it back ON to continue.

---

> **⚠️ STOP-BEFORE-SEND for T8–T10.** The final **Send** button emails your REAL
> customers and can't be recalled. For QA, **stop at the preview** — do NOT tap
> Send unless a dev has set your test shop's audience to a single test address
> (yours). The new feature being tested is the **banner embed + preview**, not
> the send itself.

### T8 — "Use in campaign" puts the banner into a draft (embed)
1. Generate a banner (T3) so an image card is showing.
2. On the image card, tap **"Use in campaign"** (the yellow primary button).
3. The assistant will ask who to send to / for the wording — answer it
   (e.g. *"send to all customers, subject 'Black Friday', short friendly body"*).
   - ✅ **PASS if:** a **Campaign draft card** appears showing a small **banner
     thumbnail** and a **"Banner attached"** label (plus subject + recipient count).

### T9 — Preview before send shows the banner
1. On the draft card from T8, tap it ("Tap to preview").
2. The **Review modal** opens.
   - ✅ **PASS if:** the **Preview panel shows your actual banner image** at the
     top, with the subject as a headline and the body below it — i.e. the email
     you'd send, banner included. (Editing subject/body updates the preview.)
   - ✅ Do **not** tap Send (see the stop-before-send note).

### T10 — Text-only campaign still works (no banner)
1. Start fresh: ask the assistant for a campaign **without** any image
   (e.g. *"draft a win-back email to lapsed customers"*).
2. Open its draft → preview.
   - ✅ **PASS if:** the draft card has **no thumbnail**, and the preview shows
     **subject + body only, no banner** — confirming the image is optional.

### T11 — Change the image shape/ratio with one tap
1. Generate an image (T3). On the card, find the **Shape** row — three buttons
   each showing a **little proportional rectangle** (wide = Banner, square =
   Square, tall = Story) **with its label underneath**, so you can see the shape
   without knowing the term. The **current shape is highlighted** yellow (a
   campaign banner defaults to **Banner**).
2. Tap a different shape — e.g. **Square**.
   - ✅ **PASS if:** the assistant generates a **new image card in that ratio**
     (Square ≈ 1:1, Banner ≈ wide 3:2, Story ≈ tall), with the new shape now
     highlighted. The subject/idea stays the same; only the shape changes.
3. Tap **Story** → a taller image; tap **Banner** → back to wide.
   - ✅ Each tap re-renders in the chosen ratio. *(Note: each is a fresh image —
     it counts toward the AI budget, same as Regenerate.)*

### Tester pass/fail summary
| # | Test | PASS / FAIL |
|---|------|-------------|
| T1 | Brand kit saves + persists | |
| T2 | Suggest colors from logo | |
| T3 | Generate marketing image (on-brand + logo) | |
| T4 | Preview / Copy link / Regenerate | |
| T5 | Edit an image | |
| T6 | Logo on/off | |
| T7 | Disabled shows a friendly message | |
| T8 | "Use in campaign" → draft has banner attached | |
| T9 | Review modal preview shows the banner | |
| T10 | Text-only campaign has no banner | |
| T11 | Shape pills re-render in Banner/Square/Story | |

> **What a tester can't check (developer does it, Parts G–H):** the spend-cap
> and daily-limit cutoffs, the content-safety block, and the database audit
> rows. Flag these to a developer rather than testing them in the UI.

---

## 0. Developer setup (for Parts A–I)

1. **Migrations applied** (already on staging): `134_create_ai_image_generations`
   (audit table + `ai_images_enabled` flag) and `135_create_shop_brand_kits`.
   Verify: `SELECT to_regclass('public.ai_image_generations'), to_regclass('public.shop_brand_kits');`
2. **Env keys present** in `backend/.env`: `OPENAI_API_KEY` (gpt-image-1 +
   moderation + Whisper), `STABILITY_API_KEY` (edit), `ANTHROPIC_API_KEY`
   (vision), and `DO_SPACES_*` (storage). All confirmed present.
3. **Pick a pilot shop** and **enable + fund** it. On staging, **`peanut`** is
   already enabled (`ai_images_enabled=true`, `$20/mo` budget, brand kit set,
   wallet `0xb3afc20c0f66e9ec902bd7df2313b57ae8fb1d81`) — log in with that wallet
   to use it. To enable a different shop:
   ```sql
   UPDATE ai_shop_settings
      SET ai_images_enabled = true,
          monthly_budget_usd = GREATEST(monthly_budget_usd, 50)
    WHERE shop_id = '<SHOP_ID>';
   -- check there's headroom:
   SELECT ai_images_enabled, monthly_budget_usd, current_month_spend_usd
     FROM ai_shop_settings WHERE shop_id = '<SHOP_ID>';
   ```
4. **Get a shop JWT** for cURL: log in to the dashboard as that shop, open
   DevTools → Network → any `/api/ai/*` call → copy the `Authorization: Bearer …`
   header. (Browser tests don't need this — the cookie/JWT is automatic.)
5. **Run servers:** `npm run server` (backend :4000) + `npm run client`
   (frontend :3001). Image gen is backend-only; the UI pieces are the Brand Kit
   tab + the Marketing AI panel card.

> **Cost note:** each generate ≈ $0.042 (square) / $0.063 (landscape), each edit
> ≈ $0.065, vision ≈ $0.0015. A full QA pass spends well under $1. Daily limit
> is 50 images/shop.

---

## Part A — Generate (API smoke test)

```bash
curl -s -X POST http://localhost:4000/api/ai/images/generate \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"prompt":"A clean Black Friday banner for a phone repair shop, 20% off","dimensions":"1024x1024","useCase":"marketing"}' | jq
```
**Expect:** `{"success":true,"data":{"imageUrl":"https://…/shops/<id>/ai-images/…png","imageKey":…,"dimensions":"1024x1024","costUsd":0.042,…}}`

**Verify:**
- Open `imageUrl` in a browser → a real generated image renders.
- `SELECT operation_type, vendor, model, cost_usd, image_url, error_message
   FROM ai_image_generations WHERE shop_id='<id>' ORDER BY id DESC LIMIT 1;`
   → one row, `operation_type='generate'`, `vendor='openai'`, `model='gpt-image-1'`,
   `cost_usd=0.042`, `image_url` populated, `error_message` NULL.
- `current_month_spend_usd` increased by ~0.042.

Try `"dimensions":"1536x1024"` → landscape image, `costUsd` 0.063.

---

## Part B — Brand Kit tab (browser)

1. Dashboard → **Settings → Brand Kit** (Palette icon, under *Access*).
2. Set **Primary** `#FFCC00`, **Secondary** `#1A1A1A`, **Tone** "Warm,
   neighborhood repair shop"; **upload a logo** (transparent PNG). Click
   **Save brand kit** → toast "Brand kit saved."
3. Reload the tab → values persist.
4. **Verify injection:** re-run Part A's generate → the audit row's `prompt`
   should start with `Brand guidance — primary color #FFCC00; secondary color
   #1A1A1A; tone: …`. (`SELECT prompt FROM ai_image_generations … LIMIT 1;`)
5. **Verify DB:** `SELECT * FROM shop_brand_kits WHERE shop_id='<id>';`

---

## Part C — Vision: suggest colors from logo (browser)

1. In the Brand Kit tab, with a logo uploaded, click **"✨ Suggest colors from
   logo"**.
2. **Expect:** within a few seconds the **Primary/Secondary hex fields update**
   to the logo's dominant colors, and a toast shows the AI's one-line read of
   the brand. (For a yellow+black logo → roughly `#FFC107` / `#1E1E1E`.)
3. API form: `POST /api/ai/brand-kit/analyze-logo {"logoUrl":"<png url>"}` →
   `{"success":true,"data":{"primaryColorHex":"#…","secondaryColorHex":"#…","description":"…"}}`.
4. **Verify:** `current_month_spend_usd` +≈$0.0015. Save the kit to keep the
   suggested colors.

---

## Part D — Marketing image proposal (browser, the headline flow)

1. Open the **unified assistant** (post-consolidation there is no separate
   Marketing panel; on the integration branch it renders the image card. Only on
   the standalone `deo/ai-image-generation` branch use the legacy Marketing
   panel — see "Integration / merge status").
2. Type: *"Add a Black Friday banner to that campaign — 20% off screen repairs."*
3. **Expect:** the assistant calls `propose_campaign_image`; after a moment an
   **image proposal card** renders under its reply: a preview, the prompt
   caption, "Brand colors + logo applied," a **Shape** row (proportional
   rectangle glyphs + labels: Banner/Square/Story, current highlighted — maps to
   the tool's `orientation` param), and
   **Use in campaign** + **Copy link** + **Regenerate**.
4. Click the **preview** → opens full size in a new tab; image shows the brand
   colors and (if a logo is set) the logo stamped bottom-right.
5. Click **Copy link** → "Copied"; **Regenerate** → assistant generates a fresh
   variant card. (**Use in campaign** is exercised in Part D2.)
6. **Verify:** a new `ai_image_generations` row per generation/regenerate.

---

## Part D2 — Campaign embed + preview (the closed loop)

Confirms an approved banner actually lands in the campaign email and is visible
before send. (Tester version: T8–T10.)

1. With an image card showing (Part D), click **Use in campaign**; answer the
   assistant's audience/copy prompts → a **campaign draft card** appears with a
   **banner thumbnail + "Banner attached"**.
2. Tap the draft → the **review modal** shows the **banner in the preview** above
   the subject/body. *(Do NOT Send unless the audience is a single test address.)*
3. **Verify the embed in the DB** — the persisted draft has the image as the
   FIRST block:
   ```sql
   SELECT design_content->'blocks'->0 AS first_block
     FROM marketing_campaigns
    WHERE shop_id = '<SHOP_ID>' AND created_by_source = 'ai_agent'
    ORDER BY created_at DESC LIMIT 1;
   -- first_block.type = 'image', first_block.src = the banner URL
   ```
4. **Fallback check:** generate a banner, then say *"draft a campaign with that
   banner"* **without** re-stating the URL → still embeds (resolves to the shop's
   most-recent `ai_image_generations` image).
5. **Text-only check:** draft a campaign with no image → `blocks[0].type='headline'`
   (no image block); modal preview shows no banner.

---

## Part E — Edit an existing image (gpt-image-1)

API:
```bash
curl -s -X POST http://localhost:4000/api/ai/images/edit \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"sourceImageUrl":"<an existing image URL>","prompt":"make it warmer with a soft golden sunset glow"}' | jq
```
**Expect:** `{"success":true,"data":{"imageUrl":"…","costUsd":0.063}}` and the
edited image visibly differs from the source (warmer). *(Editing moved off
Stability — SD3.5 img2img ignored the instruction; it now runs on gpt-image-1's
`/v1/images/edits`.)*

Browser: in the unified assistant, after an image exists, say *"take that
image and make it warmer with a sunset glow"* → the assistant calls
`propose_image_edit` → an **"Edited image"** proposal card renders (then can be
embedded via **Use in campaign**, Part D2).

**Verify:** audit row `operation_type='edit'`, `vendor='openai'`,
`model='gpt-image-1'`, `source_image_url` set, `cost_usd≈0.063`.

---

## Part F — Logo overlay (visual)

1. Ensure the brand kit has a **transparent-PNG logo**.
2. Generate an image (Part A or D).
3. **Expect:** the stored image has the **real logo composited bottom-right**
   with a clean margin. Generate again with `{"overlayLogo": false}` → no logo.
4. Clear the brand-kit logo → generations have no logo overlay (the Phase-1
   defensive read logs nothing and continues).

---

## Part G — Gates / negative tests (no/low cost)

| Test | How | Expect |
|---|---|---|
| **Kill switch** | `UPDATE ai_shop_settings SET ai_images_enabled=false …` then generate | **403** "isn't enabled for this shop yet" |
| **Spend cap** | set `monthly_budget_usd` below `current_month_spend_usd`, then generate | **429** "budget … exhausted" |
| **Daily rate limit** | (optional) 50 generations in a day | **429** "Daily image limit reached (50/day)" |
| **Moderation** | generate with a clearly disallowed prompt | **400** "blocked by our content safety check"; audit row `moderation_flagged=true`, `cost_usd=0` |
| **Bad input** | generate with empty `prompt` | **400** "`prompt` is required" |
| **Edit missing source** | edit with no `sourceImageUrl` | **400** "`sourceImageUrl` is required" |
| **Wrong role** | call any endpoint with a customer/admin JWT | **403** (requireRole shop) |

> Re-enable the shop (`ai_images_enabled=true`, budget ≥ spend) after the gate
> tests.

---

## Part H — Backend / data verification

- **Audit completeness:** every attempt (success AND failure) writes one
  `ai_image_generations` row. Failures have `image_url=NULL` + `error_message`.
- **Spend accounting:** `current_month_spend_usd` only increases on **success**
  (failed calls record `cost_usd=0`).
- **Storage:** generated/edited PNGs live under `shops/<shopId>/ai-images/` in
  DO Spaces; `image_key` matches.
- **Shop scoping:** `shopId` always comes from the JWT — passing a different
  `shopId` in a body/arg must have no effect (a shop can only touch its own).

---

## Part I — Headless repro (no browser / no JWT)

The staging verification used one-off `ts-node` scripts that call the services
directly (snapshot + restore the shop's flag). To re-verify a capability
quickly, write a throwaway `backend/scripts/_test-*.ts` that:
- generate: `new ImageGenerationService({pool}).generate(shopId, {prompt, dimensions})`
- edit: `…generate? no →` `.edit(shopId, {sourceImageUrl, prompt})`
- brand kit: `new BrandKitService().upsertBrandKit / getBrandKit / buildBrandedPrompt`
- vision: `brandAssetVisionClient.extractBrandColors(logoUrl)`
- logo overlay: `logoOverlayService.overlay(imageBuffer, logoUrl)`

Run with `npx ts-node scripts/_test-x.ts` (loads `.env`; connects to the
staging DB). Delete the script after. (This is how P1/P3/P4/P6/P7 were proven.)

---

## Pass criteria checklist

- [ ] Generate returns a stored image; audit row + spend correct (Part A)
- [ ] Brand kit saves/loads; colors inject into the prompt (Part B)
- [ ] "Suggest colors from logo" pre-fills plausible hex (Part C)
- [ ] Unified assistant produces an image proposal card; Use-in-campaign/Copy/Regenerate work (Part D)
- [ ] **Use in campaign** embeds the banner as the first email block; review modal previews it (full banner, not cropped); text-only has no banner (Part D2 / T8–T10)
- [ ] **Shape pills** (Banner/Square/Story) re-render the image in the chosen ratio (T11)
- [ ] Edit returns a visibly modified image; audit `operation_type='edit'`, `vendor='openai'` (Part E)
- [ ] Logo is composited bottom-right; `overlayLogo:false` suppresses it (Part F)
- [ ] All gates return the right status codes (Part G)
- [ ] Audit always-writes; spend only on success; storage paths correct (Part H)

---

## Known limitations / notes (v1)

- **Model:** generation **and editing** are **`gpt-image-1`** (not dall-e-3 —
  unavailable on the account). **Editing moved off Stability** (2026-06-04) — SD3.5
  img2img ignored the instruction; it now uses gpt-image-1 `/v1/images/edits`,
  `STABILITY_API_KEY` is unused. Logo overlay is local **`jimp`**.
- **Brand logo on edits:** edits re-stamp the logo but do NOT re-inject brand
  colors into the edit prompt (the source defines the look).
- **Campaign embed + preview is BUILT** (2026-06-04): the image card's **Use in
  campaign** embeds the banner as the first email block and the review modal
  previews it (Part D2 / T8–T10). The card also keeps Copy link + Regenerate.
- **`analyze_brand_assets` chat tool** (broad "critique this image") is deferred
  — needs marketing-chat image-upload UX (scope §3.4-B / impl Phase 9).
- **Inpaint (mask) path:** not wired (no region-select UI). If needed, add a
  `mask` to `OpenAIImageClient.edit()` — gpt-image-1 supports it.
- Daily limit 50/shop; per-shop `$50` base cap (tiered higher for ads shops —
  see `ai-cost-summary.md`).

---

## Integration / merge status (unified assistant ↔ image cards)

The consolidation made the **unified assistant the only AI surface** (the
separate Marketing/Insights/Help launchers were removed) — that work is on
`deo/unified-assistant-phase-6-branding`. AI Image Generation is on
`deo/ai-image-generation` (off `main`).

**✅ MERGED LOCALLY (2026-06-03) → `deo/integration-unified-ai-image`** (merge
commit `25676ce3`), so the unified-assistant image flow is **live and testable
now** on that branch — that's the recommended QA target. How it fits together:

- The image tools are **marketing tools**; the unified orchestrator merges
  `getMarketingTools()`, so it **calls** `propose_campaign_image` /
  `propose_image_edit`.
- The unified panel renders cards via `OrchestrateToolCallCard`, which routes by
  `MARKETING_KINDS` — **`campaign_image_proposal` is in that set** (from the
  unified branch), and the display-type + card renderer (`aiMarketing.ts`,
  `MarketingToolCallCard`) come from the AI-image branch. Both now coexist on the
  integration branch.

**Still TODO — the real merge to `main` (when GitHub is reinstated):** push the
two feature branches, then merge them to `main` (or merge the integration branch).
The local merge was clean except **one** conflict, `AIAgentDomain/routes.ts`
(resolved by keeping both the `/orchestrate` route and the `/images/*` +
`/brand-kit*` routes); `backend/package.json` auto-merged both dep sets. The
other files MERGE-WATCH flagged (`marketing/registry.ts`, `marketing/types.ts`,
frontend `aiMarketing.ts`, `MarketingToolCallCard.tsx`, `OrchestrateToolCallCard.tsx`)
were each changed on only one branch and merged cleanly. Full plan:
`MERGE-WATCH.md` in this folder.
