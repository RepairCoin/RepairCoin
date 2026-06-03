# MERGE-WATCH — AI Image Generation ↔ Unified Assistant

**Why this exists:** AI Image Generation and the Unified-Assistant consolidation
were built as **two separate, unmerged branches** (GitHub was suspended, so
neither could be pushed/merged to integrate). Each is complete on its own, but
the **unified-assistant image flow only goes live once both land on `main`** —
and there's one wiring seam + a handful of conflict files to handle at merge.
Read this before merging either branch.

**Created:** 2026-06-03.

---

## The two branches

| Branch | Base | What it is |
|---|---|---|
| `deo/ai-image-generation` | `main` | Image generate/brand-kit/vision/edit/logo (11 commits). Image tools are **marketing tools**; rendered via `MarketingToolCallCard`. |
| `deo/unified-assistant-phase-6-branding` | `main` (stacked, ~32 commits) | Consolidation: **removed the separate Marketing/Insights/Help launchers**; the **unified assistant is the only AI surface**. Renders tool cards via `OrchestrateToolCallCard`. |

`main` is the shared base but is **behind** (its tip reverted the voice-STT
merge). Both branches branched from it independently — they do **not** contain
each other's work until merged.

---

## The integration seam (already wired)

The unified orchestrator already merges `getMarketingTools()`, so it **calls**
`propose_campaign_image` / `propose_image_edit`. But the unified panel routes
tool cards by `OrchestrateToolCallCard`'s `MARKETING_KINDS` set — the image
display kind **`campaign_image_proposal`** must be in it, or the card silently
doesn't render (it falls through to the insights renderer).

- ✅ **Done on `deo/unified-assistant-phase-6-branding` (commit `5f838bfe`):**
  added `"campaign_image_proposal"` to `OrchestrateToolCallCard.MARKETING_KINDS`.
- The **display variant** (`aiMarketing.ts` `MarketingToolDisplay`) and the
  **renderer** (`CampaignImageProposalCard` in `MarketingToolCallCard.tsx`) come
  from `deo/ai-image-generation`.

→ Once both branches are on `main`, asking the **unified assistant** for an image
renders the proposal card. **Before merge, neither branch alone shows it in the
unified panel** (the ai-image branch still has the legacy Marketing panel; the
unified branch lacks the card renderer).

---

## What conflicts at merge — and what doesn't

A file only conflicts if **both** branches changed it. Here that's essentially
**one file**:

### ⚠️ Likely conflict (touched by both)
- **`backend/src/domains/AIAgentDomain/routes.ts`** — ai-image adds
  `/images/generate`, `/images/edit`, `/brand-kit*` (+ imports); the unified
  branch adds `/orchestrate` (+ import). Both insert near the `/insights` route,
  so the hunks may overlap. **Resolve by keeping all routes/imports from both
  sides.** Small + mechanical.

### ✅ Clean (changed on only one branch — listed so you can confirm the pieces line up)
- From **ai-image** (apply as-is): `services/marketing/registry.ts` (registers
  `proposeCampaignImage` + `proposeImageEdit`), `services/marketing/types.ts`
  (`campaign_image_proposal` display), `frontend services/api/aiMarketing.ts`
  (display variant), `frontend marketing-ai/MarketingToolCallCard.tsx` (the
  `CampaignImageProposalCard` renderer).
- From **unified** (apply as-is): `frontend unified/OrchestrateToolCallCard.tsx`
  (`campaign_image_proposal` in `MARKETING_KINDS`).

> The unified branch does **not** touch the marketing registry/types/card files,
> and the ai-image branch does **not** have `OrchestrateToolCallCard` — so those
> merge cleanly from whichever branch changed them. The seam works because the
> set entry (unified) and the renderer (ai-image) meet on `main`.

---

## Recommended merge procedure

1. Merge `deo/unified-assistant-phase-6-branding` → `main` first (it's the larger
   stack; the consolidation + voice work).
2. Merge `deo/ai-image-generation` → `main` next. Resolve the conflict files
   above by **keeping both additions**.
3. `cd backend && npm run build` and `cd frontend && npx tsc --noEmit` — expect
   clean (modulo `main`'s pre-existing admin-tab errors, which `next.config`
   ignores).
4. Apply migrations on the target DB if not already: `134_create_ai_image_generations`,
   `135_create_shop_brand_kits` (both already on staging).

## Post-merge verification

- **Unified assistant image flow:** enable a pilot shop (`ai_images_enabled=true`),
  ask the unified assistant "make a Black Friday banner" → the **image proposal
  card renders** under the reply (this is the bit that was impossible pre-merge).
- Run the **QA guide** (`qa-test-guide.md`) Part T against the unified assistant.

---

## See also
- `qa-test-guide.md` — Part T (tester walkthrough) + its "Integration / merge-watch" section.
- `implementation.md` / `scope.md` — the image feature.
- The unified-assistant work — `voice-ai-dispatcher/unified-assistant-vision.md`.
