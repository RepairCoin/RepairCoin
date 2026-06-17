# Implementation Plan — Meta Marketing API push (automated campaigns)

**Date:** 2026-06-17
**Status:** Plan — no code until told. Standing rule: don't build/commit until told.
**Implements:** `ads-marketing-api-push-scope.md` (all 4 §12 decisions LOCKED).
**Locked decisions:** (1) Option **B** — create PAUSED → one-click **Go live**, with review/edit **Level 2+3** (in-app
key fields + Ads Manager). (2) Creative = **both** (AI gpt-image-1 default + shop service photos as swaps). (3) Default
objective = **`OUTCOME_LEADS`**. (4) Dev = **Meta test ad account** (P3 insights validated later on a real account).
**Builds on (Connect-Meta, built+live-verified):** `shops.meta_oauth_token`/`meta_ad_account_id`/`meta_page_id`/
`meta_page_token` (decrypt via `tokenCrypto`), `MetaService` (axios Graph client), `MetaConnectionRepository`.
**Grounded in built code:** `CampaignRequestController.buildCampaignFromRequest`, `CampaignRepository`,
`ad_campaigns.meta_campaign_id` (mig 148), `PerformanceRepository.upsertDaily`/`rollUpFromPipeline`,
`SafeguardScheduler.tick` (nightly), `SafeguardEvaluator` (auto-pause), `MetaWebhookController` (lead receiver),
`BrandKitService` + AI image infra (gpt-image-1 — currently on `deo/ai-image-generation`).

> Migration number: expected **163**, but **verify live `schema_migrations` first** (162 is the last ads one;
> DB authoritative — [[feedback-check-migration-number-before-building]]).

---

## Buildable now vs. gated
- **Buildable + testable now** against a **dev app + Meta test ad account**: P1 (create objects), P2 (creative),
  P4 (status/leadform), P5 (review/edit/go-live). Real ad delivery doesn't happen on a test account, so **P3 insights**
  is only structurally testable there.
- **Gated for real shops:** App Review of the **write scopes** (`ads_management`, `pages_manage_ads`, `leads_retrieval`)
  — add them back to `META_OAUTH_SCOPES` (we trimmed them for the connect test). All behind `ADS_META_PUSH_ENABLED`
  (default OFF) → until on, **Build stays record-only / concierge** (no regression).

## Reuse / refactor map
| Built today | Under push |
|---|---|
| `buildCampaignFromRequest` (DB record + active) | **Refactor** → create PAUSED Meta objects, store ids, request→`building`, campaign `paused` |
| `enterDailyMetrics` (manual) | **Demote** to admin override/backfill; nightly `syncInsights` becomes the source |
| `SafeguardEvaluator` pause (DB only) | **Extend** → also push `PAUSED` to Meta |
| `MetaService` (connect methods) | **Extend** with create/update/insights methods |
| `MetaWebhookController` lead receiver | **Reuse** — leadform leads already attribute to `ad_leads` |

---

## Phase 1 — Create campaign objects (PAUSED)  ~3–4d
- **Migration 163** (verify #): add to `ad_campaigns` — `meta_adset_id`, `meta_ad_id`, `meta_creative_id`,
  `meta_lead_form_id`, `meta_status` (PAUSED|ACTIVE|…), `meta_last_synced_at`. (`meta_campaign_id` already exists.)
- **`MetaService`** new methods (Graph v19, decrypted token, `act_…`):
  `getAccountStatus(adAccountId)` (funding_source + account_status), `createCampaign(objective,status)`,
  `createAdSet({budgetCents, geo, audience, optimizationGoal, promotedPageId, status})`, `createAd(adsetId, creativeId)`,
  with a `fbError()`-wrapped try/catch + a `rollback(ids)` helper (delete created objects on partial failure).
- **Targeting builder** (pure, unit-tested): brief + `shops.location_lat/lng` + `targetRadiusMiles` → Meta
  `geo_locations.custom_locations` (radius/mi→km), age/audience defaults, industry interests from `industryTaxonomies`.
  Objective map (default `OUTCOME_LEADS`).
- **Refactor `buildCampaignFromRequest`** (push path, behind `ADS_META_PUSH_ENABLED`):
  preconditions (token + page + **funding source** via `getAccountStatus`, else block w/ shop-facing message) →
  create campaign/adset/ad **PAUSED** (placeholder creative until P2) → persist ids + `meta_status=PAUSED` →
  request `building`, campaign `paused` → thread event "Campaign drafted — review & go live." Rollback on failure.
- Tests: targeting builder (radius/geo/objective/budget math); precondition gating (no funding source → blocked).

## Phase 2 — Auto-creative (AI image + shop photos)  ~3–4d
- **AI image**: reuse the gpt-image-1 service (dependency: make it importable on this branch — cross-domain import or
  cherry-pick) → generate a brand-kit-grounded image from the brief; **AI copy** (headline/primary text) via
  `AnthropicClient` from `offer` + BrandKit voice (mirror `LeadAIService.draftOutreach`; spend-capped + AiCost ledger).
- **Shop photos**: surface the shop's service images as alternatives.
- **`MetaService.uploadAdImage(adAccountId, imageBytes)`** (`/act_…/adimages`) → `createAdCreative({pageId, link, message,
  imageHash, leadFormId, cta})` → attach to the ad (replace the P1 placeholder). Store `meta_creative_id`.
- Tests: copy/creative assembly (pure parts); image upload mocked.

## Phase 3 — Insights import (kills manual metrics)  ~2d
- **`MetaService.syncInsights(metaCampaignId)`**: `GET /{id}/insights?fields=spend,impressions,clicks,actions&
  time_increment=1&date_preset=last_7d` → map (incl. lead `actions`) → `PerformanceRepository.upsertDaily`.
- Nightly in `SafeguardScheduler.tick` for every campaign with `meta_campaign_id`; set `meta_last_synced_at`.
- **Demote `enterDailyMetrics`** to override-only. Bookings/revenue keep flowing via `rollUpFromPipeline` → ROI fully auto.
- Tests: insights→daily mapping (actions→leads, spend cents).

## Phase 4 — Status sync + safeguard push + lead form  ~2–3d
- **`MetaService.setObjectStatus(id, ACTIVE|PAUSED)`**; wire pause/activate (admin/shop) → push to Meta.
- **Safeguard auto-pause** (`SafeguardEvaluator`) → also push `PAUSED`; disconnect/refresh-fail (§9.6) → pause live campaigns.
- **`MetaService.ensureLeadForm(pageId, pageToken)`** → create/reuse a default leadgen instant form (name/phone/email);
  store `meta_lead_form_id`; the existing webhook receiver handles delivery.
- Tests: status mapping; safeguard→Meta pause path (mocked).

## Phase 5 — Review & edit state + Go live (Option B)  ~2–3d
- **Request `building` = "drafted, paused"**; admin **review screen** (in `AdminAdsTab` campaign detail) shows the
  auto-draft. **Edit key fields (Level 2):** caption/headline, image (regenerate AI / pick shop photo / upload), budget,
  objective, radius/age → save pushes via **`updateCampaign`/`updateAdSet`/`replaceAdCreative`**.
- **Go live** action → `setObjectStatus(ACTIVE)` for campaign/adset/ad → campaign `active`, `meta_status=ACTIVE`,
  request `live` → billing starts (§9.2) + thread event. **Level 3**: link out to Ads Manager for deep edits.
- FE: `ads.ts` (`getCampaignDraft`, `updateCampaignDraft`, `regenerateCreative`, `goLiveCampaign`) + the review/edit panel.
- Tests: go-live transition; edit→update push (mocked).

**Order:** 1 → 2 → 3 → 4 → 5. P1+P3 remove most manual work; P2 the last input; P5 the human go-live gate.

---

## Cross-cutting
- **Flag:** `ADS_META_PUSH_ENABLED` (default OFF). **Scopes:** add `ads_management,pages_manage_ads,leads_retrieval` back
  to `META_OAUTH_SCOPES` (needs the use-cases enabled + App Review for production; works for app testers in dev).
- **Money unchanged:** ad spend → Meta on the shop's funding source (precondition-checked); FixFlow only the flat fee.
- **Security:** decrypt token per-call (never log); validate edits server-side; rollback created objects on failure.
- **Verification per phase:** backend `npm run build` exit 0 + tsc 0; FE tsc 0-net-new (297); pure unit tests
  (targeting/objective/insights mapping); manual end-to-end on a **Meta test ad account** (create→edit→go-live→status);
  P3 real-number validation on a real account + tiny budget pre-go-live.

## Effort
≈ **12–16 dev-days** (P1 3–4, P2 3–4, P3 2, P4 2–3, P5 2–3). Each phase ships behind the flag.

## Dependencies / gating (external)
- **Meta test ad account** under the dev app (before P1).
- **AI image infra** importable on `deo/ads-system` (P2) — currently on `deo/ai-image-generation`.
- **App Review** of the write scopes for real-shop go-live (parallel ops track — `ads-meta-app-review-checklist.md`).

## Out of scope
Google Ads push; CAPI/Conversions; lookalike/custom audiences; Meta-native A/B (we have our own); auto-activate (A) —
a later toggle once auto-creative is trusted.
