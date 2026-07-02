# Google Ads Conversion-Optimization Bidding — Scope

**Date:** 2026-07-02
**Status:** Scoping (no code yet)
**Analog of:** Meta pixel-"Lead" optimization (`ADS_OPTIMIZE_FOR_LEAD`) — see `metaTargeting.ts` / `MetaPushService.ts`.
**Related:** `GoogleAdsService.createSearchCampaign` (bidding), `GoogleAdsService.getGoLivePreconditions` (conversion-action gate), `AdAttributionService` / `adsEventListeners` (lead→order conversion), landing page `/l/[campaignId]`.

---

## Goal

Let Google **bid toward leads/bookings** instead of raw clicks — the direct analog of Meta's opt-in pixel-Lead optimization. Today Google campaigns bid **manual CPC** (pay per click, no conversion optimization); Meta can switch to `OFFSITE_CONVERSIONS` optimizing for the pixel `Lead` event. This scope brings Google to parity.

## The crux: Google has no conversion signal today

For Google to optimize toward conversions, it must **know which clicks converted**. Meta gets this from the **Meta Pixel** firing `Lead` on the landing page (`LandingView.initMetaPixel`). Google currently gets **nothing back** — the landing page fires only the Meta pixel, no `gclid` is captured, and no conversion is reported to Google. So the real work is **building the Google conversion feedback loop**, not just flipping a bidding flag.

### Current state (verified)
- `createSearchCampaign` → `manualCpc: {}` (clicks only).
- `getGoLivePreconditions` already **requires a conversion action to exist** on the account — but nothing feeds it, and the campaign isn't tied to it for bidding.
- `ad_leads` has `meta_lead_id` but **no `gclid`**.
- Landing page captures no `gclid` and reports no Google conversion.

---

## Recommended approach — server-side offline conversion import (keyed by gclid)

Fits FixFlow's existing **server-side** attribution (contact-match of paid orders → leads in `AdAttributionService`), works for phone/offline bookings, and needs no client-side conversion tag on the landing page. Google's auto-tagging appends `?gclid=…` to the landing URL on an ad click; we persist it, and when the lead converts we upload the conversion to Google against a FixFlow conversion action.

Phased, tracking-first (mirrors Meta's "ship tracking, flip optimization later" note in `MetaPushService`):

### Phase 1 — Capture the signal (passive, zero risk, ship first)
- **Migration 198**: `ad_leads.gclid TEXT`.
- **Landing page** (`/l/[campaignId]` → `AdLeadForm`): read `gclid` from the URL query and submit it with the lead.
- **LeadRepository.create** + the landing lead-capture path: persist `gclid` (like `metaLeadId`).
- No Google API calls yet — just start banking gclids so there's history before optimization turns on.
- Effort: ~0.5–1d.

### Phase 2 — Report conversions to Google (server-side upload)
- **Conversion action**: ensure a FixFlow "Lead" conversion action exists on the shop's Google account (create via `ConversionAction.mutate` if missing, store its resource name per shop — analog of the auto-provisioned Meta pixel at connect). Reuse the one the go-live gate already checks for.
- **`GoogleAdsService.uploadClickConversion(customerId, refreshToken, { gclid, conversionActionResourceName, conversionDateTime, value? }, loginCustomerId?)`** → `customers/{cid}:uploadClickConversions` (offline conversion import).
- **Hook**: in the existing lead→order conversion path (`AdAttributionService` / `adsEventListeners`), when a Google campaign's lead (has `gclid`) is matched to a paid order, upload the conversion. Idempotent (don't double-upload; guard on an `uploaded_at` marker).
- Gated by `ADS_GOOGLE_OPTIMIZE_FOR_LEAD` **being off is fine** — uploading conversions is safe/beneficial regardless; it just populates history.
- Effort: ~2–3d.

### Phase 3 — Switch bidding to conversions (behind the flag)
- **`ADS_GOOGLE_OPTIMIZE_FOR_LEAD`** (default off, mirrors `ADS_OPTIMIZE_FOR_LEAD`). When on, `createSearchCampaign` (and a status-safe update path for live campaigns) sets **`maximizeConversions: {}`** instead of `manualCpc`, tied to the conversion action. Optionally `targetCpa` later.
- **Sequencing:** keep it OFF until each account's conversion action has accrued conversions (Google under-delivers / cold-starts poorly on a brand-new conversion bidding strategy, exactly like Meta before the pixel has Lead events). Ops flips it on per the same judgment call Meta uses.
- Switching a **live** campaign's bidding resets its learning phase — so prefer setting it at build for new campaigns; document that a mid-flight switch restarts learning.
- Effort: ~1–2d.

---

## Alternative — client-side gtag conversion tag
Load Google's gtag on the landing page with the conversion ID/label and fire on form submit (parallel to `initMetaPixel`). Simpler *conceptually* but: needs the account's conversion tag id/label surfaced to the frontend, only captures **online** form submits (misses phone/offline bookings that the server-side path catches), and duplicates the Meta-pixel client pattern. **Not recommended** — the server-side import reuses FixFlow's real attribution and is more complete. (Could be added later as a supplement for faster signal.)

---

## Flag & config
- `ADS_GOOGLE_OPTIMIZE_FOR_LEAD` (default off) — the bidding switch (Phase 3).
- Phases 1–2 are not flag-gated (capturing gclid + uploading conversions is always safe and only helps).
- **Auto-tagging** must be enabled on the shop's Google Ads account (default on for API-linked accounts) so `gclid` reaches the landing URL — add to the go-live/connect checklist.

## Caveats / risk
- **Prod-only to truly validate:** test accounts can't serve, so no real gclids/conversions accrue there — Phases 1–2 are unit/integration-testable, but end-to-end optimization is verifiable only on a funded, serving account.
- **Cold start:** conversion bidding needs history; premature flip → under-delivery. The flag + "tracking first" sequencing is the mitigation.
- **Conversion window / idempotency:** upload once per lead→order; store an upload marker. Late-cancelled orders → out of scope for retraction v1 (Google handles adjustments separately).

## Non-goals (v1)
- tCPA/tROAS target tuning (start with MaximizeConversions).
- Conversion value optimization beyond a flat/optional value.
- Retracting/adjusting uploaded conversions on refund/cancel.
- Client-side gtag (see Alternative).

## Verification
- Phase 1: submit a lead with `?gclid=TEST` → row has the gclid.
- Phase 2: deterministic test of `uploadClickConversion` (monkeypatched Google service + fake attribution), like the existing Meta write-path tests; live upload externally gated.
- Phase 3: build a campaign with the flag on → `maximizeConversions` set + tied to the conversion action (verified via the config read / GAQL).

## Effort summary
Phase 1 ~0.5–1d · Phase 2 ~2–3d · Phase 3 ~1–2d. Recommend Phase 1 now (harmless, starts banking signal), Phase 2 next, Phase 3 only once a real account is serving and has conversion history.
