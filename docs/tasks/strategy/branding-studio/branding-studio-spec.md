# Spec — Branding Studio (Onboarding AI)

**Status:** Proposed (design only — not built)
**Source:** exec-requested onboarding AI; designs in `c:\dev\onboarding-ai` (6 "Branding Studio" mockups).

## 1. Problem / goal

New shops land in the dashboard with **no brand identity set up**, so the AI marketing /
image features can't produce on-brand output until the shop manually fills the Brand Kit in
settings (which most never find). The execs want a **guided, AI-first onboarding wizard** —
"FixFlow Branding Studio" — that, right after registration, takes the shop's logo, analyzes
it, and produces a reusable **brand profile** the AI uses for every future campaign/image.

**Goal:** a skippable, re-runnable onboarding wizard that POPULATES the existing Brand Kit
(plus a few new fields) using the vision + image machinery already built — not a new parallel
system.

## 2. The design (6 steps) → what already exists

| Step | Screen | Backed by (existing) / NEW |
| --- | --- | --- |
| 1 | **Welcome** ("Your AI-Powered Shop") · Skip/Next | NEW (wizard shell) |
| 2 | **Upload Shop Logo** (PNG/JPG/SVG) | logo upload flow + `shop_brand_kits.logo_url` (EXISTS) |
| 3 | **AI Brand Analysis** — colors, personality, industry, tone | `POST /api/ai/brand-kit/analyze-logo` → `BrandAssetVisionClient.extractBrandColors` returns colors + description (EXISTS); personality/industry/tone = NEW (extend the vision prompt) |
| 4 | **Choose Marketing Style** — Corporate / Modern-Tech / Friendly-Local / Premium-Luxury | NEW (a `marketing_style` enum) |
| 5 | **Generating Brand Kit…** — colors ✓, typography, poster/social templates, campaign style guide | colors EXIST; typography/templates/style-guide are ASPIRATIONAL (decide: build or trim) |
| 6 | **Store Profile Ready** — Primary Color, Style, Voice, Headline → Dashboard | colors/style EXIST or NEW; **voice + headline = NEW** (small fields + 1 generative call) |

**Reuse (already shipped, AI Image Gen Phases 3-4):**
- `shop_brand_kits` table: `logo_url, primary_color_hex, secondary_color_hex, tone_notes`.
- `GET/PUT /api/ai/brand-kit` (`BrandKitController` / `BrandKitService`), `POST /api/ai/brand-kit/analyze-logo`.
- `BrandAssetVisionClient.extractBrandColors(logoUrl)` → `{ primaryColorHex, secondaryColorHex, description }` (spend-capped).
- Frontend `aiBrandKit.ts` (`getBrandKit`, `updateBrandKit`, `analyzeLogo`) + `BrandKitSettings.tsx`.
- The image generator already injects the kit into every prompt (`BrandKitService.buildBrandedPrompt`).
- Existing onboarding system: `OnboardingGuide` / `OnboardingModal` / `OnboardingBanner` + `ShopDashboardClient` (shops land on `/shop?tab=profile`).

→ **~70% backend already exists.** The new work is the **wizard UI**, the **first-run placement**,
a **small `shop_brand_kits` extension**, and (optionally) the Step-5 generated assets.

## 3. Placement — where it goes (the core decision)

**A skippable post-registration first-run experience that writes the existing Brand Kit, with a
Settings re-entry. Do NOT build a parallel brand store.**

- **Trigger:** first dashboard load when `shop_brand_kits` is empty AND the studio hasn't been
  completed/skipped → open the Branding Studio (a dedicated `/shop/branding-studio` route or a
  full-screen takeover). The design's **Skip** confirms it must be optional.
- **Not in the registration form** — keep sign-up fast; this is a first-*session* step.
- **Timing:** trigger when the shop first reaches the working dashboard. (The kit itself needs no
  verification/subscription, but its payoff — campaigns/AI images — needs an active subscription +
  `ai_images_enabled`. Triggering at first real dashboard access lands the "Go to Dashboard"
  hand-off on something usable.)
- **Hook into the EXISTING onboarding**, not a new one: add a "Set up your brand with AI" task to
  `OnboardingGuide`/`OnboardingModal` that launches the wizard.
- **Settings re-entry:** a "Set up with AI / Re-run Branding Studio" button in `BrandKitSettings`.
- **Completion gate:** `shop_brand_kits.onboarding_completed_at` (or a dismissed flag) so it doesn't
  reappear every login.

**One data model, two entry points:** the Studio (guided populate) and Brand Kit settings (manual
edit) both read/write `shop_brand_kits`.

### 3a. Onboarding vs EDIT mode (where it lands)
Two surfaces over the same `shop_brand_kits`:

```
First run (after registration)        Later edits (any time)
┌─────────────────────────────┐       ┌──────────────────────────────┐
│  BRANDING STUDIO (wizard)   │       │  Settings → Brand Kit (form)  │
│  full-screen, guided, 6 steps│ ───►  │  compact, ALL fields, inline  │
│  ends: "Go to Dashboard"     │  same │  edit + Save                  │
│                              │  data │  [Re-run Branding Studio] ─────┼─► launches the
└─────────────────────────────┘       └───────────────────────────────┘   wizard PRE-FILLED
```

- **Onboarding (first time):** the full-screen Studio wizard. Ends with **"Go to Dashboard"** (the
  celebratory hand-off).
- **Editing afterward → Settings → Brand Kit.** This is the everyday edit surface — a normal form
  (logo, colors, marketing style, voice, headline, tone): change a field, **Save**. **No wizard.**
- **Guided AI re-do:** a **"Re-run Branding Studio"** button INSIDE the Brand Kit settings launches
  the same wizard **pre-filled** with the current kit. On finish it **returns to Settings** (not the
  dashboard — this time it's an edit, not onboarding).
- **Where it lands:** finishing *onboarding* → dashboard; *editing* in settings → stays in settings;
  *re-running* the Studio from settings → back to settings.

**Implication:** `BrandKitSettings.tsx` today only shows logo + colors + tone. For edit mode to be
complete, the settings form MUST also surface every NEW kit field (marketing style, voice, headline)
as it's added — otherwise a field set in the wizard can't be edited later. So **each phase that adds a
kit field adds it to BOTH the wizard step AND the settings form.** Target settings layout:

```
Settings → Brand Kit
  Logo            [▣ thumbnail]  [Change]
  Primary color   [#0057D9 ▣]   Secondary [#FF…  ▣]   [Suggest from logo (AI)]
  Marketing style [Modern & Tech ▾]
  Brand voice     [Professional but friendly         ]
  Headline        [Fast Repairs. Trusted Service.     ]
  Tone notes      [ …                                 ]
                                    [Re-run Branding Studio]   [Save]
```

## 4. Data model — extend `shop_brand_kits`

Additive (migration). Existing campaigns/image-gen unaffected.
- `marketing_style TEXT` — `corporate | modern_tech | friendly_local | premium_luxury` (Step 4)
- `brand_voice TEXT` — short voice descriptor (Step 6, e.g. "Professional but friendly")
- `headline TEXT` — generated tagline (Step 6, e.g. "Fast Repairs. Trusted Service.")
- `brand_personality TEXT` / `industry_style TEXT` — from the Step-3 analysis (optional, display)
- `onboarding_completed_at TIMESTAMPTZ` — first-run gate
- *(colors, tone_notes, logo_url already exist)*

`GET/PUT /api/ai/brand-kit` + `validateBrandKitUpdate` extend to accept these. `BrandKitService.buildBrandedPrompt`
can fold `marketing_style` + `brand_voice` into image/campaign prompts.

## 5. New / extended endpoints
- Extend `POST /brand-kit/analyze-logo` (or add `/brand-kit/analyze-brand`) so the vision returns
  **personality + industry + suggested tone** alongside colors (extend `BrandAssetVisionClient`'s
  prompt). Spend-capped (reuse `SpendCapEnforcer`).
- (Optional) `POST /brand-kit/generate-headline` — one cheap Claude/Haiku call → a tagline from
  {shop name, industry, marketing_style, tone}. Or fold into the analyze response.
- Existing `PUT /brand-kit` persists the final profile.

## 6. Scope decisions to lock first
1. **Step 5 checklist — build or trim.** "Typography pairings / poster & social templates /
   campaign style guide" are NOT in the current kit. Recommend: **ship colors + style + voice +
   headline first** (all small extensions), show Step 5 as the real generation of *those*, and add
   templates later. Don't promise assets that don't generate.
2. **Logo upload** — confirm/reuse the existing image-upload-to-DO-Spaces flow (logos store under
   `/shops/{shopId}/`); the kit stores the URL (the controller comment confirms this pattern).
3. **Skippable + resumable + idempotent** — Skip leaves the kit empty; finishable later from
   settings; re-running overwrites with a confirm.
4. **Branch** — builds on the brand kit, which lives on the AI-image / `deo/campaign-rewards`
   superset branch. Build there (or a branch off it), NOT off `main` (you'd lose the brand-kit base).

## 7. Phasing (each independently shippable)
- **Phase 1 — Wizard MVP:** steps 1/2/3/6 reusing existing (welcome → logo → analyze→colors →
  profile-ready). Writes colors+logo to `shop_brand_kits`; skippable; triggered first-run via the
  existing onboarding; settings re-entry. Minimal new backend (reuses analyze-logo + GET/PUT).
- **Phase 2 — Marketing style (Step 4) + extend kit** (`marketing_style`, `brand_voice`) folded into
  image/campaign prompts.
- **Phase 3 — Vision personality/tone + generated headline** (Step 3 full + Step 6 profile).
- **Phase 4 (optional) — Step-5 generated assets** (typography, poster/social templates, campaign
  style guide) — the heavier items; descope-able.

## 8. Out of scope (v1)
- Full template generation (Phase 4 / later).
- Editing brand assets beyond the kit fields.
- Multi-logo / multi-brand per shop.

## 9. Effort
- Phase 1 (MVP): **M** — mostly a frontend wizard over existing endpoints + the first-run trigger.
- Phase 2: **S** — one enum + prompt wiring.
- Phase 3: **S-M** — extend the vision prompt + one headline call.
- Phase 4: **L** — genuine new generation; defer.
