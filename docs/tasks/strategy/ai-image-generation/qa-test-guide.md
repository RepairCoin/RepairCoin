# AI Image Generation — QA Test Guide

**Status:** v1 built + verified **headless** on staging 2026-06-03. This guide
covers the **browser/manual QA pass** (not yet done) plus the headless repro.
**Branch:** `deo/ai-image-generation` (off `main`). **Backend:** behind the
`ai_images_enabled` per-shop flag (default OFF).

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
> **Build note for whoever sets up the test env:** the unified assistant renders
> the image card only on a build that has **both** the unified-assistant work
> **and** the AI-image work, **and** the orchestrator wiring (`campaign_image_
> proposal` in `OrchestrateToolCallCard`'s `MARKETING_KINDS`). If you're testing
> the AI-image branch **standalone** (before it's merged with the unified
> branch), that branch still has the **legacy Marketing panel** — use that
> instead for T3–T5. See "Integration / merge-watch" at the bottom.

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
   mic). *(Standalone AI-image branch only: use the legacy Marketing panel.)*
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
2. In the Marketing assistant, ask for an image (T3).
   - ✅ **PASS if:** the assistant replies that **image generation isn't enabled
     yet** (a friendly message) — it must **not** crash or show a raw error.
3. Ask the dev to turn it back ON to continue.

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
3. **Pick a pilot shop** (e.g. `peanut` on staging) and **enable + fund** it:
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
   Marketing panel; on the standalone AI-image branch, use the legacy Marketing
   panel — see "Integration / merge-watch").
2. Type: *"Add a Black Friday banner to that campaign — 20% off screen repairs."*
3. **Expect:** the assistant calls `propose_campaign_image`; after a moment an
   **image proposal card** renders under its reply: a preview, the prompt
   caption, "Brand colors + logo applied," and **Copy link** + **Regenerate**.
4. Click the **preview** → opens full size in a new tab; image shows the brand
   colors and (if a logo is set) the logo stamped bottom-right.
5. Click **Copy link** → "Copied"; **Regenerate** → assistant generates a fresh
   variant card.
6. **Verify:** a new `ai_image_generations` row per generation/regenerate.

---

## Part E — Edit an existing image (Stability)

API:
```bash
curl -s -X POST http://localhost:4000/api/ai/images/edit \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"sourceImageUrl":"<an existing image URL>","prompt":"make it warmer with a soft golden sunset glow"}' | jq
```
**Expect:** `{"success":true,"data":{"imageUrl":"…","costUsd":0.065}}` and the
edited image visibly differs from the source.

Browser: in the Marketing assistant, after an image exists, say *"take that
image and replace the background with a storefront"* → the assistant calls
`propose_image_edit` → an **"Edited image"** proposal card renders.

**Verify:** audit row `operation_type='edit'`, `vendor='stability'`,
`model='sd3.5-large'`, `source_image_url` set, `cost_usd=0.065`.

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
- [ ] Marketing assistant produces an image proposal card; Copy/Regenerate work (Part D)
- [ ] Edit returns a visibly modified image; audit `operation_type='edit'` (Part E)
- [ ] Logo is composited bottom-right; `overlayLogo:false` suppresses it (Part F)
- [ ] All gates return the right status codes (Part G)
- [ ] Audit always-writes; spend only on success; storage paths correct (Part H)

---

## Known limitations / notes (v1)

- **Model:** generation is **`gpt-image-1`** (not dall-e-3 — unavailable on the
  account). Editing is **Stability SD3.5**. Logo overlay is local **`jimp`**.
- **Brand logo on edits:** edits re-stamp the logo but do NOT re-inject brand
  colors into the edit prompt (the source defines the look).
- **Card actions are Copy link + Regenerate** — "embed straight into a campaign
  email" is a deferred follow-up.
- **`analyze_brand_assets` chat tool** (broad "critique this image") is deferred
  — needs marketing-chat image-upload UX.
- **Inpaint (mask) path** exists in `StabilityClient` but has no UI yet.
- Daily limit 50/shop; per-shop `$50` base cap (tiered higher for ads shops —
  see `ai-cost-summary.md`).

---

## Integration / merge-watch (unified assistant ↔ image cards)

Yesterday's consolidation made the **unified assistant the only AI surface**
(the separate Marketing/Insights/Help launchers were removed) — that work is on
`deo/unified-assistant-phase-6-branding`. AI Image Generation is on
`deo/ai-image-generation` (off `main`). The two are **separate, unmerged
branches** (GitHub suspended). Consequences for testing the IMAGE flow in the
UNIFIED assistant:

- The image tools are **marketing tools**; the unified orchestrator already
  merges `getMarketingTools()`, so it **will call** `propose_campaign_image` /
  `propose_image_edit`.
- BUT the unified panel renders cards via `OrchestrateToolCallCard`, which routes
  by `MARKETING_KINDS`. The image display kind **`campaign_image_proposal` must
  be in that set**, or the card won't render in the unified assistant.
  - ✅ Added on the unified branch (`OrchestrateToolCallCard` `MARKETING_KINDS +=
    "campaign_image_proposal"`) so it's ready at merge.
  - The display-type + card renderer (`aiMarketing.ts`, `MarketingToolCallCard`)
    come from the **AI-image branch** — they land at merge.

**Net:** the unified-assistant image flow is **fully live only after the two
branches merge to `main`**. Before that:
- Test the AI-image tools standalone via the **legacy Marketing panel** on the
  AI-image branch, OR
- Test the unified flow on a build that has **both** branches merged.

**Merge-watch files** (touched by both branches — expect small conflicts):
`AIAgentDomain/routes.ts`, `marketing/registry.ts`, `marketing/types.ts`,
frontend `aiMarketing.ts` + `MarketingToolCallCard.tsx`, and
`OrchestrateToolCallCard.tsx` (`MARKETING_KINDS`).
