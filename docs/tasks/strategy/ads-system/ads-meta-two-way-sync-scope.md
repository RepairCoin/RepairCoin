# Ads System — Two-Way Meta ⇄ App Config Sync (scope)

**Date:** 2026-06-23
**Branch:** `deo/ads-system`
**Status:** 🔵 Scoped, not built. Standing rule: do not commit unless told.
**Companion:** `ads-v1-gaps-and-next-steps.md` (this expands the "no config read-back from Meta" gap).

---

## 1. Problem

Today config flows **one way: app → Meta**. We WRITE campaign config to Meta
(`createCampaign`/`createAdSet`/`createAdCreative`, `updateAdSet`/`updateAdCreative`,
`setObjectStatus`), but we never READ it back. The only thing we pull from Meta is **performance**
(`MetaInsightsService` → spend/impressions/clicks).

Consequence — if an admin edits a campaign **directly in Meta Ads Manager** (budget, creative,
targeting, status, schedule), the app **does not reflect it**:
- The stored config (`ad_campaigns.dailyBudgetCents`, `ad_creatives.*`, `targetRadiusMiles`,
  `objective`, `metaStatus`) goes **stale** — the dashboard shows the old values.
- **Spend/ROI stay correct** (insights are pulled by id from Meta), so only *config display* is wrong.
- **Worst case — silent clobber:** a later in-app action (Safeguard-4 "Scale to full budget",
  `updateDraft`) pushes the app's **stale** value and **overwrites** the Ads-Manager change.
- A **creative swapped in Ads Manager bypasses our review gate** (the safeguard protecting the shared
  ad account) and the app never knows.

## 2. Goal

Make config **two-way**: pull the live state of each pushed campaign's Meta objects back into the app
and reconcile, so the dashboard always reflects reality and in-app actions never clobber a manual
Ads-Manager change. Runs nightly + on demand. Read-only mirror for fields we can't safely round-trip.

**Non-goals:** changing the push/write paths (they already work); building a real-time webhook (Meta
has no general "ad set changed" webhook — this is poll-based); reconciling performance (already synced).

---

## 3. Fields in scope (Meta object → app field)

Per pushed campaign (`metaCampaignId`/`metaAdSetId`/`metaAdId`/`metaCreativeId` already stored):

- **Campaign** `GET /<campaign_id>?fields=objective,status,effective_status,name`
  - `objective` → `ad_campaigns.objective`
  - `effective_status` (ACTIVE/PAUSED/ARCHIVED/…) → `ad_campaigns.metaStatus` (+ map to `status`)
- **Ad set** `GET /<adset_id>?fields=daily_budget,optimization_goal,billing_event,targeting,status,promoted_object,start_time,end_time`
  - `daily_budget` → `ad_campaigns.dailyBudgetCents` (account minor units — already our unit)
  - `targeting` (geo custom_location radius km, age) → `ad_campaigns.targetRadiusMiles` (km→mi; **lossy**)
  - `status` → reconcile with campaign status
  - `promoted_object` / `optimization_goal` → informational (pixel-Lead vs clicks)
- **Ad** `GET /<ad_id>?fields=status,creative{id}` — detect a creative swap (creative.id ≠ our `metaCreativeId`)
- **Creative** `getCreativeSpec(creativeId)` (ALREADY EXISTS) → `object_story_spec.link_data`
  - `name` → `ad_creatives.headline`, `message` → `ad_creatives.body`, `picture` → `ad_creatives.imageUrl`,
    `link` → landing url, `call_to_action.type` → CTA

**Reads to add to `MetaService`:** `getCampaign()`, `getAdSet()`, `getAd()` (thin GETs; `getCreativeSpec`
+ `getAccountStatus` already exist).

---

## 4. Design decisions (recommended defaults — confirm/override)

- **D1 — Conflict policy. → Recommended: Meta is source-of-truth for LIVE campaigns; app for pre-push drafts.**
  Once a campaign is pushed/live, a pull from Meta WINS (overwrites the app's stored config) — because the
  human's most recent action may have been in Ads Manager, and it stops the clobber loop. Pre-push (no Meta
  objects yet) the app is the only truth. *(Rationale: simplest correct rule; "the live ad is whatever Meta
  says it is." After every in-app push the two already agree, so pull-wins only changes things when someone
  edited on Meta.)*

- **D2 — Cadence. → Recommended: nightly pull + an on-demand "Refresh from Meta" button.**
  Piggyback the nightly reconcile on the existing Meta sync tick (where `MetaInsightsService.syncAll` runs).
  Add `POST /ads/campaigns/:id/sync-from-meta` behind a "Refresh from Meta" button in the live campaign view
  for immediate reconcile. *(Rationale: nightly keeps it fresh cheaply; on-demand covers "I just changed it.")*

- **D3 — Creative changed in Ads Manager. → Recommended: reflect it + FLAG it (don't silently trust).**
  When the live ad's creative id ≠ our stored `metaCreativeId`, pull the new spec into `ad_creatives` BUT set
  a marker (`review_status='changed_externally'` or a new `externally_edited` bool) so the UI shows an
  **"Edited in Ads Manager — not reviewed by FixFlow"** badge. Never auto-flip it to `approved`. *(Rationale:
  the review gate exists to protect the shared account; a bypass must be surfaced, not hidden.)*

- **D4 — Field scope / phasing. → Recommended: budget + status first, creative reflect next, targeting last.**
  Budget + status are high-value and lossless (direct fields). Creative is reflect-only (+ flag). Targeting
  is **lossy** to round-trip (custom_locations km, age, interests) — store Meta's raw targeting JSON for
  fidelity + best-effort `targetRadiusMiles`, and don't let the app re-push a reverse-mapped targeting that
  could degrade it. *(Rationale: ship the safe, valuable fields first; treat lossy ones carefully.)*

- **D5 — Object deleted/archived on Meta. → Recommended: reflect, don't recreate.**
  If a Meta object is gone/archived (deleted in Ads Manager), mark the app campaign accordingly
  (status→archived/ended) and stop in-app actions on it — never silently recreate. *(Rationale: respect the
  human's deletion; avoid surprise re-spend.)*

- **D6 — Clobber guard.** Regardless of cadence, before any in-app write that pushes config (Scale-to-full,
  updateDraft), do a **just-in-time pull** of that field so we never push a value older than Meta's. *(Belt
  and suspenders on D1.)*

---

## 5. Architecture

- **`MetaConfigSyncService`** (new): `reconcile(campaignId)` — pulls campaign+adset+ad(+creative) for a
  pushed campaign, diffs against the DB, applies D1/D3/D5, writes back, stamps `meta_synced_config_at`.
  `reconcileAll()` — loops connected shops' live campaigns (mirrors `MetaInsightsService.syncAll`).
- **Scheduler:** call `reconcileAll()` in the same nightly tick as insights sync (already wired), behind a
  flag `ADS_META_CONFIG_SYNC` (default OFF → no behavior change until enabled).
- **On-demand:** `POST /ads/campaigns/:id/sync-from-meta` (admin) → `reconcile(id)`; FE "Refresh from Meta"
  button + an "Edited in Ads Manager" badge in the live view (`AdminAdsTab` operating state) + a
  `lastSyncedFromMeta` timestamp.
- **MetaService:** add `getCampaign`/`getAdSet`/`getAd` thin reads (reuse the existing `request` helper +
  `fbError` surfacing); `getCreativeSpec`/`getAccountStatus` already exist.

**Migration (NNN — verify next-free, currently next = 176; see [[feedback-check-migration-number-before-building]]):**
`ad_campaigns` add `meta_synced_config_at TIMESTAMPTZ`, `meta_targeting_raw JSONB` (fidelity), and either
`ad_creatives.externally_edited BOOLEAN` or reuse `review_status='changed_externally'`.

---

## 6. Phases

- **Phase 1 — budget + status (~1–1.5d):** `getAdSet`/`getCampaign` reads + reconcile `dailyBudgetCents` +
  `metaStatus`/`status`; nightly + on-demand; D6 clobber guard on Scale-to-full/updateDraft; flag `ADS_META_CONFIG_SYNC`.
- **Phase 2 — creative reflect + flag (~1d):** diff ad.creative id; pull `getCreativeSpec` into `ad_creatives`;
  set the `externally_edited` marker + "Edited in Ads Manager" badge (D3).
- **Phase 3 — targeting + objective (~1d):** store `meta_targeting_raw`; best-effort `targetRadiusMiles`
  (km→mi); reflect `objective`. Mark targeting reverse-push as not-allowed (read-only fidelity).
- **Phase 4 — deletion/divergence handling (~0.5d):** archived/missing objects → reflect status, halt in-app actions (D5).

**v1 = Phase 1 (~1–1.5d).** Total ~3.5–4d.

---

## 7. Edge cases & risks

- **Targeting round-trip is lossy** — store raw JSON; don't let a reverse-mapped targeting re-push and degrade
  the real one (D4). This is the main correctness trap.
- **Rate limits** — one extra Graph GET per object per campaign nightly; batch with `?fields=` to minimize
  calls. Fine at current scale.
- **Currency** — `daily_budget` is already in account minor units (= our `dailyBudgetCents`); the currency
  sweep (mig 174) already handles display. No conversion needed here.
- **Review-gate bypass** — D3 surfaces it rather than hiding; consider an admin "re-approve" action to clear
  the flag.
- **Token/permission** — reconcile uses the shop's stored user token (same as push); a revoked/expired token
  → skip + log (don't error the batch), mirroring the insights sync's failure tolerance.

## 8. Verification

- Unit: pure diff/reconcile decision (Meta value vs DB value → write? flag?) per D1/D3/D5.
- Live (peanut): push a campaign → change its budget in Ads Manager → run `reconcile` → app shows the new
  budget; confirm a subsequent Scale-to-full does NOT clobber it (D6). Swap creative in Ads Manager →
  app reflects it with the "Edited in Ads Manager" badge, review NOT auto-approved.
- Flag OFF = zero behavior change (one-way as today).
