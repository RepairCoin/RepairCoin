# Google Search Composer — Scope

**Date:** 2026-07-03
**Status:** Scoping → building
**Why:** The Google draft view is a read-only *receipt* — the AI-generated headlines/descriptions/keywords are pushed to Google blind, and budget can't be edited in-dashboard. Meta's `DraftComposer` lets you edit copy + budget before push; Google has no parity. This adds in-dashboard authoring for Google Search, synced to the platform.
**Related:** `GoogleDraftPanel`, `GoogleAdsService`, `GoogleAdsCreativeService.generateRsaCopy`, `buildCampaignFromRequest` (Google branch), `MetaPushService.updateDraft` (the Meta analog).

## Gap today
- RSA copy + keywords live ONLY on Google (not stored locally) → dashboard can't show or edit them.
- Daily budget is display-only in `GoogleDraftPanel`.
- No regenerate / keyword management from the dashboard.

## What Google Search needs (target surface)
- **Headlines** — 3–15, ≤30 chars each (editable list, char counters, min-3 validation).
- **Descriptions** — 2–4, ≤90 chars each (editable list, min-2 validation).
- **Keywords** — editable list (broad match v1; match-type + negatives are follow-ups).
- **Daily budget** — editable.
- **Final URL** — the landing page (shown; editable is a follow-up).
- **Regenerate copy** — reuse `generateRsaCopy`.

## Design
Store the generated copy locally so the composer has a source of truth; push edits to Google on save. Mirrors Meta (local creative → push).

- **Storage (migration 201):** `ad_campaigns.google_ad_content JSONB` = `{ headlines[], descriptions[], keywords[], finalUrl }`; `ad_campaigns.google_ad_id TEXT` (the RSA ad resource — needed because RSA ads are **immutable**, so a copy edit = create-new + remove-old).
- **Persist at build:** `buildCampaignFromRequest` writes the generated copy + ad id after the push.
- **`GoogleAdsService`:**
  - `updateCampaignBudget(budgetResourceName, micros)` — mutate campaign budget `amount_micros`.
  - `replaceResponsiveSearchAd(adGroupRes, oldAdRes, {headlines, descriptions, finalUrl})` — create new RSA + remove old (immutable), returns new ad resource.
  - `reconcileKeywords(adGroupRes, desired[])` — query current criteria, add missing, remove extra (partial-failure so policy-flagged terms skip).
- **`GoogleComposerService.updateDraft(campaignId, edits)`** — persist `google_ad_content`; push only the parts that changed (budget / copy / keywords). Gated `ADS_GOOGLE_PUSH_ENABLED`, non-throwing per part, validates RSA minima. Regenerate = `generateRsaCopy` → same save path.
- **Endpoint:** `PATCH /ads/campaigns/:id/google-draft`.
- **FE:** `GoogleDraftPanel` gains editable headlines/descriptions/keywords + budget + Save + Regenerate (RSA min/max validation client-side). Keeps the objects summary + "Review in Google Ads" + Go Live.

## Phases
1. **Budget edit** — smallest, highest-value (closes "why can't budget be edited"): `updateCampaignBudget` + editable field.
2. **Copy + keywords** — store at build, surface editable, push on save (RSA replace + keyword reconcile) + Regenerate.

## Constraints / notes
- **RSA immutability:** editing copy creates a new ad and removes the old (store `google_ad_id`).
- **Keyword match types + negatives:** v1 = broad only (as today); match-type UI + negatives are follow-ups.
- **Prod-gated for live push:** test account accepts the mutations (paused, no spend); real serving is prod.
- Validation: enforce ≥3 headlines ≤30 and ≥2 descriptions ≤90 before pushing (Google rejects otherwise).

## Tests
- `updateCampaignBudget` cents→micros; RSA min/max validation (pure); `GoogleComposerService.updateDraft` decision logic (only-changed-parts pushed, flag-off no-op, validation reject) with mocked service + repos.
