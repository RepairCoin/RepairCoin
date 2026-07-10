# Google Composer — Read / Reflect Leg (making the composer whole)

**Date:** 2026-07-03
**Status:** Scoping → building
**Why:** The composer (`b158300a9`) is write-only — it edits + pushes + stores locally, but never *reads* from Google. So campaigns built before the store-at-build code (and any edited directly in Google Ads) show an **empty** composer even though the AI copy/keywords exist on Google. Meta's composer pre-populates because it stores at build AND its config-sync reflects external creative edits (D3). This adds the missing READ direction to Google — populate + reflect.
**Connected feature upgraded:** `GoogleConfigSyncService` (Slice 5) — today it reconciles budget + status only; it gains copy/keyword reflect (the Google analog of Meta D3).

## Two directions, one reader
- **Populate (backfill):** when the composer opens and `google_ad_content` is empty (pre-composer build, or first open), read the current RSA copy + keywords from Google and store them → the composer shows the real AI-generated content. Gated `ADS_GOOGLE_PUSH_ENABLED` (composer needs push anyway).
- **Reflect (external edits):** config-sync also pulls copy/keywords into `google_ad_content`, so edits made directly in Google Ads flow back (no silent drift). Gated `ADS_GOOGLE_CONFIG_SYNC`. Direction rule (same as budget/status): pushed campaign → Google is source; unsaved local FE edits aren't persisted so they're never clobbered.

## Build
- **`GoogleAdsService.fetchAdContent(customerId, token, adGroupId, login?)`** — GAQL over `ad_group_ad` (RSA headlines/descriptions + final_urls + ad resource) and `ad_group_criterion` (keyword text). Pure `mapAdContentRows(adRows, kwRows)` for the shape mapping (unit-tested).
- **`GoogleComposerService.getDraftContent(campaignId, { forceRefresh })`** — returns the campaign; if `google_ad_content` is empty (or forceRefresh), fetch from Google, store `google_ad_content` + `google_ad_id`, return fresh. No-op returns the campaign as-is when disabled / not-google / disconnected.
- **`GoogleConfigSyncService.reconcile`** — after budget/status, fetch ad content; if it differs from stored, update `google_ad_content` and include in `changes` (reflect).
- **Endpoint:** `GET /ads/campaigns/:id/google-draft` → `getDraftContent` (composer calls on mount when content is empty; `?refresh=1` forces a re-read).
- **FE:** `GoogleDraftPanel` fetches content on mount when `campaign.googleAdContent` is empty (with a small "loading from Google…" state) + a "Refresh from Google" action to force a re-pull. `ads.ts` `getGoogleDraftContent(id, refresh?)`.

## Non-goals / notes
- No migration (columns exist from 201).
- Reflect adds 2 GAQL reads per campaign per reconcile — acceptable (nightly + on-demand).
- Live read is prod/creds-gated; mapping + decision logic are unit-tested.

## Tests
- `mapAdContentRows` (pure): RSA headlines/descriptions/keywords/finalUrl/adId extraction, tolerant of missing fields.
- `getDraftContent`: backfills when empty, skips when present, no-op when disabled/not-google.
- config-sync reflect: updates `google_ad_content` when Google differs, no-op when in sync.
