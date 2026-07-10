# Ads Landing Page — Conversion Enhancement (P1 → P2) — Implementation Plan

**Date:** 2026-06-24
**Branch:** `deo/ads-system`
**Status:** plan — not started. Standing rule: do not commit unless told.
**Goal:** turn `/l/[campaignId]` from a plain info page into a lead magnet — make the visitor *want*
the offer, *trust* the shop, and *act now* — to lift lead-capture rate on ad traffic.

> Context: the page was refactored to **lead-form-only** (Book-online removed). The lead form is the
> single CTA and fires the Meta "Lead" pixel. This plan adds the magnet around it.

---

## Decisions to lock first

- **D1 — Magnet source: hybrid (auto-compose first, shop-override later).** P1 **auto-composes** the
  magnet from data we already have (rating, top review, offer, brand kit, campaign creative). P2 adds
  a **shop-controlled** override surface. Ships value fast; gets better long-term.
- **D2 — One public endpoint.** Extend the existing `GET /ads/landing/:campaignId` rather than adding
  new public routes (keeps the no-auth surface small). Public-safe fields only.
- **D3 — No new PII exposure.** Expose rating/reviews/testimonial/logo/colors/city (already public on
  the shop profile). Do **not** expose the shop owner's email; shop **phone** only if the shop opts in
  to a "Call now" secondary CTA (P2, default off).
- **D4 — Pixel unchanged.** "Lead" still fires on form submit; this is purely the page around it.

---

## Data sources (all already in the DB)

- **Brand** — `shop_brand_kits` (`logo_url`, `primary_color_hex`, `secondary_color_hex`).
- **Creative image** — `CreativeRepository.findAiByCampaign(campaignId).imageUrl` (the approved ad image).
- **Trust** — `service_reviews` aggregated by `shop_id`: `AVG(rating)`, `COUNT(*)`, plus one recent
  `comment` with `rating >= 4` as the testimonial.
- **Location** — `shops.location_city`, `shops.location_state`.
- **Offer / services** — existing: `ad_campaign_requests.offer` + `promoteServiceIds` → `shop_services`.

---

## Phase 1 — Extend the landing endpoint + redesign the page (the converting version) (~1.5–2d)

### 1a. Backend — extend `LandingController.getCampaignLanding`
Add to the `data` payload (all best-effort; null when missing — never fail the page):
- `logoUrl`, `primaryColor`, `secondaryColor` — from `shop_brand_kits` (one query by `shopId`).
- `heroImageUrl` — `CreativeRepository.findAiByCampaign(campaignId)?.imageUrl` (fallback: first promoted
  service image).
- `rating` (number|null), `reviewCount` (int), `testimonial` ({ quote, rating } | null) — one aggregate
  query on `service_reviews` by `shopId` (+ a second for a single ≥4★ comment).
- `city`, `state` — from `shops`.
- Keep existing `shopName`, `offer`, `goal`, `services`, `pixelId`. Drop `shopId` only if no longer
  needed (Book-online is gone) — or keep for analytics.
- Wrap each source in its own try/catch so a missing brand kit / zero reviews degrades gracefully.

### 1b. Frontend — redesign `LandingView.tsx` (mobile-first, branded)
New above-the-fold + structure:
- **Branded hero** — `heroImageUrl` as the hero, shop `logoUrl`, headline = the **offer** (fallback to
  a benefit line from `goal`), one-line subhead. Apply `primaryColor` to CTA/accents (fallback to the
  current `#FFCC00`).
- **Trust bar** — `4.8★ · 127 reviews` + `Serving {city}` chips. Render only when data exists.
- **Testimonial** — one short quote card under the offer (only if present).
- **Magnet form** (`AdLeadForm` tweaks):
  - **Phone-first** (phone primary; name required; email optional) — phone is also the collision-free
    account-claim key.
  - Button copy → **"Get my free quote"** (configurable later); risk-reversal line *"No obligation · we
    never share your details."*
  - **Confirmation state**: after submit show *"Got it! {shopName} will reach out shortly."*
- **Sticky mobile CTA** — pinned "Get my quote" button that scrolls to the form.
- Keep promoted-services section (informational), tightened visually.

**Files:** `LandingController.ts`; `frontend/src/components/ads/LandingView.tsx`,
`AdLeadForm.tsx`; small new presentational components (`Hero`, `TrustBar`, `Testimonial`, `StickyCta`)
co-located under `components/ads/landing/`.

---

## Phase 2 — Conversion boosters + shop control (P2) (~1.5–2d)

### 2a. Per-campaign landing settings (shop-controlled magnet — D1 override)
- **Migration NNN** (next free across branches — check first): `ad_landing_settings` keyed by
  `campaign_id` (or a JSONB column `landing_config` on `ad_campaign_requests`). Fields:
  - `headline` (override), `subhead`, `urgency_text` (e.g. "Offer ends Sunday"),
  - `benefit_bullets` (text[] — "Certified technicians", "Same-day service", "Warranty included"),
  - `featured_review_id` (pin a testimonial), `show_rating` (bool), `cta_label`,
  - `call_now_enabled` (bool, default false) + uses `shops.phone`.
- Endpoint merges overrides over the auto-composed defaults (overrides win).

### 2b. Booster UI elements on the page
- **Urgency / scarcity** banner (from `urgency_text`; optional countdown).
- **Benefit bullets** row (icons + text).
- **Trust badges** — "Verified FixFlow shop", years active, # served.
- **Location/hours** mini-block (+ optional map link) for local intent.
- **"Call now"** secondary CTA (only if `call_now_enabled`) — `tel:` link to `shops.phone`.

### 2c. Shop dashboard — "Landing Page" editor
- A panel (in the campaign DraftComposer or a dedicated tab) to edit the 2a fields, with a **live
  preview** link to `/l/:campaignId`. Use shadcn components (per repo convention).

**Files:** new migration; `LandingController.ts` (merge overrides);
`frontend/.../LandingView.tsx` (booster sections); a shop-side `LandingPageSettings` panel +
`services/api/ads.ts` getter/setter.

---

## Phase 3 — Measurement + QA (~0.5d)
- Confirm **"Lead" pixel** still fires once, on submit only (no double-count with the new layout).
- Confirm the **lead webform** still creates an `ad_lead` (attribution + Kanban unchanged).
- Conversion read: leads-per-view trend via existing performance roll-up; note this enables a future
  A/B of headline/offer.
- Backend `tsc` 0; FE `tsc` at the **290 baseline**; mobile responsive (360px) check; graceful
  degradation when brand kit / reviews / creative are missing.
- No PII leakage in the public payload (no owner email; phone only when `call_now_enabled`).

---

## Build order / effort
1. **Phase 1** (~1.5–2d) — endpoint extension + redesign = the meaningful conversion lift; ships on
   auto-composed data, no shop action required.
2. **Phase 2** (~1.5–2d) — shop control + boosters (urgency/bullets/badges/call-now).
3. **Phase 3** (~0.5d) — QA + measurement.

**Total ~3.5–4.5 days.** Phase 1 alone is the high-ROI slice and can ship independently.

## Rollout / flags
- Phase 1 redesign is public marketing — ship directly (no flag needed) once QA'd, or gate behind
  `ADS_LANDING_V2` if a staged rollout is wanted.
- Phase 2 settings are additive (defaults = auto-composed), so no flag needed; `call_now` is per-shop
  opt-in.
- Env: reuses `ADS_LANDING_BASE_URL` (already set for the public URL).

## Out of scope (revisit later)
- Guest online checkout (separate decision — currently parked in favor of lead-form + manual booking).
- A/B testing framework for landing variants (Phase 3 only *enables* measuring; the framework is later).
- Video hero / multi-step forms.
