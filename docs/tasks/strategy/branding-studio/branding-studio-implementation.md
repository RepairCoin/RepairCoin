# Implementation Plan — Branding Studio (Onboarding AI)

Companion to `branding-studio-spec.md`. File-level, phased tasks. Phase 1 is the shippable MVP
(reuses the existing Brand Kit + vision); 2-4 layer on. Builds on the brand-kit base on the
`deo/campaign-rewards` (AI-image superset) branch — NOT off main.

Legend: ➕ new · ✏️ edit · 🗄️ migration · 🧪 tests.

---

## Phase 1 — Wizard MVP (welcome → logo → analyze→colors → profile-ready)

Delivers the core onboarding: first-run, skippable, AI analyzes the logo → colors saved to the
Brand Kit. Minimal new backend (reuses `analyze-logo` + `GET/PUT /brand-kit`).

### 1.1 First-run gate (migration)
- 🗄️ `migrations/1XX_brand_onboarding.sql` — `ALTER TABLE shop_brand_kits ADD COLUMN IF NOT EXISTS
  onboarding_completed_at TIMESTAMPTZ;` (additive).
- ✏️ `BrandKitController.getOwn` + `BrandKitService.getBrandKit` — include `onboardingCompletedAt`
  in the response so the frontend can decide whether to auto-open the studio.
- ✏️ `validateBrandKitUpdate` + `upsertBrandKit` — accept/set `onboardingCompletedAt` (stamped when
  the wizard finishes or is skipped).

### 1.2 Wizard UI (frontend)
- ➕ `frontend/src/components/shop/branding-studio/BrandingStudio.tsx` — the multi-step shell
  (Welcome → Logo → Analysis → Profile-Ready), Skip/Previous/Next, step indicator. Dark theme +
  yellow accents per the mockups; honor the readability floor (no <12px text).
- ➕ sub-steps: `StepWelcome`, `StepLogo` (drag-drop → upload), `StepAnalysis` (calls analyze-logo,
  shows colors + description), `StepProfile` (summary → Go to Dashboard).
- Reuse `aiBrandKit.ts`: `analyzeLogo()` for Step 3, `updateBrandKit()` on finish.
- ➕ route `frontend/src/app/(authenticated)/shop/branding-studio/page.tsx` OR render as a
  full-screen overlay from `ShopDashboardClient` — pick one (route is cleaner for deep-linking).

### 1.3 Logo upload in the wizard
- Reuse the existing image-upload-to-DO-Spaces flow (logos store under `/shops/{shopId}/`); on drop,
  upload → get the URL → pass to `analyzeLogo({ logoUrl })` and persist via `updateBrandKit`.
- Confirm the upload endpoint (the brand-kit controller comment: "logo bytes uploaded via the
  existing image-upload flow"); if there isn't a reusable one, add a thin `POST /brand-kit/upload-logo`.

### 1.4 First-run trigger + onboarding hook
- ✏️ `ShopDashboardClient.tsx` — on load, if `brandKit.onboardingCompletedAt` is null AND kit has no
  colors → open the Branding Studio (route push or overlay). Once per shop (the timestamp gates it).
- ✏️ `OnboardingGuide` / `OnboardingModal` — add a "Set up your brand with AI" task that launches
  the studio and shows `completed` when `onboardingCompletedAt` is set.

### 1.5 Settings = the EDIT surface (+ re-entry)
`BrandKitSettings.tsx` is the everyday edit mode (the wizard is onboarding-only). For Phase 1 it
already edits logo + colors + tone — keep that as the inline edit form (change a field → Save, no
wizard).
- ✏️ `BrandKitSettings.tsx` — add a **"Re-run Branding Studio"** button that launches the wizard
  PRE-FILLED with the current kit, and on finish **returns to Settings** (pass a `returnTo=settings`
  flag / origin so Step 6's CTA reads "Done" → back to settings, NOT "Go to Dashboard").
- The wizard's finish handler branches on origin: onboarding → `/shop` dashboard; settings → back to
  the Brand Kit settings.
- (Phases 2-3: as new kit fields are added, ADD THEM TO THIS FORM TOO — see cross-cutting rule.)

### 1.6 🧪 Tests
- Unit: `validateBrandKitUpdate` accepts `onboardingCompletedAt`; getOwn returns it.
- Frontend: wizard step navigation + skip stamps completion; finish persists the kit.

**DoD Phase 1:** a new shop is offered the studio on first load; uploading a logo analyzes it and
saves colors to the Brand Kit; Skip/finish both stamp completion so it doesn't reappear; reachable
again from settings.

---

## Phase 2 — Marketing style (Step 4) + extended kit

- 🗄️ `ALTER TABLE shop_brand_kits ADD COLUMN IF NOT EXISTS marketing_style TEXT, ADD COLUMN IF NOT
  EXISTS brand_voice TEXT;`
- ✏️ `BrandKitService` (`getBrandKit` map + `upsertBrandKit`) + `validateBrandKitUpdate` — accept
  `marketingStyle` (enum: corporate|modern_tech|friendly_local|premium_luxury), `brandVoice`.
- ✏️ `aiBrandKit.ts` (`BrandKit` / `BrandKitUpdate` types) — add the fields.
- ➕ `StepMarketingStyle` (the 4-card picker) in the wizard, between Analysis and Profile.
- ✏️ `BrandKitService.buildBrandedPrompt` — fold `marketingStyle` + `brandVoice` into the image/
  campaign prompt so generated output reflects the chosen style.
- 🧪 style persisted + reflected in the branded prompt.

**DoD Phase 2:** the shop picks a marketing style; it's saved and shapes AI image/campaign tone.

---

## Phase 3 — Vision personality/tone + generated headline (Step 3 full + Step 6 profile)

- ✏️ `BrandAssetVisionClient` — extend the prompt so `extractBrandColors` (or a new
  `analyzeBrand`) also returns `personality`, `industryStyle`, `suggestedTone`. Same single
  spend-capped vision call.
- ✏️ `analyze-logo` endpoint + `aiBrandKit.analyzeLogo` types — surface the new fields; Step 3 renders
  them (the mockup's 4 cards: Personality, Detected Colors, Industry Style, Recommended Tone).
- ➕ `POST /api/ai/brand-kit/generate-headline` (or fold into analyze) — one cheap Haiku call →
  tagline from {shop name, industry, marketing_style, tone}. Persist `headline`.
- 🗄️ `ADD COLUMN IF NOT EXISTS headline TEXT, brand_personality TEXT, industry_style TEXT;`
- ✏️ `StepProfile` renders the full "Store Profile" (Primary Color, Style, Voice, Headline).
- 🧪 vision returns the new fields; headline generation; profile persists.

**DoD Phase 3:** Step 3 shows the full analysis; Step 6 shows a complete generated brand profile.

---

## Phase 4 (optional / later) — Step-5 generated assets

Typography pairings, poster/social templates, AI campaign style guide. Genuine new generation
(image-gen + layout). **Recommend deferring**; in Phase 1-3 show Step 5 as the generation of the
*real* outputs (colors/style/voice/headline), not template assets that don't exist yet — no
over-promising in the progress checklist.

---

## Cross-cutting
- **One data model:** everything writes `shop_brand_kits`; the wizard and `BrandKitSettings` are two
  entry points to the same kit. No parallel store.
- **Every kit field lives in BOTH surfaces:** the wizard step (onboarding) AND the `BrandKitSettings`
  form (edit mode). Adding a field in one phase = add it to both. Edit mode is the settings form (no
  wizard); the wizard is for first-run + the optional guided "Re-run".
- **Where finish lands:** onboarding origin → `/shop` dashboard ("Go to Dashboard"); settings origin
  (re-run) → back to Brand Kit settings ("Done"). The wizard takes an `origin`/`returnTo` prop.
- **Skippable + idempotent:** Skip stamps `onboarding_completed_at` with empty kit; re-run overwrites
  with a confirm; the first-run trigger checks the timestamp.
- **Spend-capped:** every vision/Claude call goes through `SpendCapEnforcer` (already wired in the
  brand-kit + image paths).
- **Shop-scoped:** `shopId` from the JWT only (the brand-kit endpoints already enforce this).
- **Readability + theme:** dark UI + yellow accents per mockups; respect the no-<12px text floor and
  hardcoded-contrast lesson used elsewhere.

## Sequencing & effort
1. **Phase 1** (M) — the MVP; ships the onboarding value on existing endpoints.
2. **Phase 2** (S) — marketing style.
3. **Phase 3** (S-M) — personality/tone + headline.
4. **Phase 4** (L) — templates; defer.

Ship **Phase 1** first (real onboarding with logo→colors), then 2-3 as quick follow-ups.

## Rollout checklist (per phase)
- Migration additive + recorded/applied per the team's process.
- `npm ci && npm run build` (backend) + frontend typecheck clean (verify REAL exit code — don't pipe).
- Tested on a staging test shop (new-shop first-run path + settings re-entry).
