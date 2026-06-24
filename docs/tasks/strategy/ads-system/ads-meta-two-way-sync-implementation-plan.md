# Ads System — Two-Way Meta ⇄ App Config Sync — Implementation Plan

**Date:** 2026-06-23
**Branch:** `deo/ads-system`
**Scope doc:** `ads-meta-two-way-sync-scope.md` (read first — problem, fields, decisions D1–D6).
**Status:** Phase 1 (budget+status) DONE + committed (`5bed8bcad`). **Phases 2 (creative reflect+flag), 3
(objective+targeting reflect) and 4 (deletion/divergence) BUILT (uncommitted) — feature now COMPLETE.**
Verified: backend tsc 0, FE tsc 290 baseline, **22/22 sync tests pass**. Standing rule: do not commit unless told.

> **Decisions LOCKED for this build** (the scope's recommended defaults):
> - **D1** — Meta is **source-of-truth for LIVE campaigns** (a pull overwrites our stored config); the app is
>   truth for pre-push drafts.
> - **D4** — phase order: **budget + status first** (lossless), creative reflect + flag next, targeting last
>   (lossy → store raw JSON, never reverse-push).
> Other decisions (D2 cadence, D3 creative-flag, D5 deletion, D6 clobber-guard) as recommended in the scope.

**No external blocker for building.** Live round-trip is testable — 4 of 8 campaigns are pushed
(`meta_adset_id` set). Live verification needs a valid stored token + a readable account (peanut clean;
dc_shopu under the code-31 security hold). Reconcile logic is unit/dry-run provable regardless.

---

## Integration surface (verified in code)

- **`MetaService`** — has a private `request`/`create` HTTP helper, `fbError` surfacing, env `GRAPH_VERSION`,
  and reads `getAccountStatus` + `getCreativeSpec`. Add thin GETs: `getCampaign`, `getAdSet`, `getAd`.
- **`MetaConnectionRepository.getConnection(shopId)`** → `{ userTokenEnc, adAccountId, … }`; `decryptToken`
  (tokenCrypto) to use the token. (Same path the push + insights sync use.)
- **`CampaignRepository`** — `findById`, `update({ dailyBudgetCents, status, … })`, `setMetaObjects`, and a
  pushed-campaign lister (the `SELECT id, shop_id, meta_campaign_id … WHERE meta_campaign_id IS NOT NULL`
  used by insights sync). `AdCampaign` already carries `dailyBudgetCents`, `status`, `metaStatus`,
  `metaCampaignId/AdSetId/AdId/CreativeId`, `objective`, `targetRadiusMiles`.
- **`MetaInsightsService.syncAll`** (nightly in `SafeguardScheduler.tick`) — the pattern to mirror for
  `reconcileAll()`, and the place to hook the nightly reconcile.
- **`MetaPushService.scaleToFull` / `updateDraft`** — the in-app config WRITES that need the D6 clobber guard.

---

## Phase 1 — Budget + status two-way sync (v1, ~1–1.5d)

**1.1 Migration** (`backend/migrations/NNN_add_meta_config_sync.sql` — verify next-free, currently **177**;
see [[feedback-check-migration-number-before-building]]): `ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS
meta_synced_config_at TIMESTAMPTZ;` Apply to staging.

**1.2 MetaService reads** — add:
- `getCampaign(campaignId, userToken)` → `GET /<id>?fields=objective,status,effective_status,name`
- `getAdSet(adsetId, userToken)` → `GET /<id>?fields=daily_budget,optimization_goal,billing_event,status,promoted_object`
- (defer `getAd` to Phase 2). All via the existing `request` helper; map Meta's `daily_budget` (string, account
  minor units) → number; handle the 200-with-error-body case `create()` already guards.

**1.3 `MetaConfigSyncService`** (`backend/src/domains/AdsDomain/services/MetaConfigSyncService.ts`):
- `isEnabled()` = `ADS_META_CONFIG_SYNC === 'true'`.
- `reconcile(campaignId)`:
  - no-op when disabled. Load campaign; **skip if not pushed** (`metaAdSetId` null → app is truth, D1).
  - load connection + token; if missing/invalid → log + skip (fail-open, like insights sync).
  - `getAdSet` + `getCampaign`; compute changes via a **pure** `reconcileFields(db, meta)`:
    - `daily_budget` ≠ `dailyBudgetCents` → set budget (Meta wins, D1).
    - `effective_status` → map `ACTIVE→'active' | PAUSED→'paused' | ARCHIVED/DELETED→'archived'` → update
      `status` + `metaStatus` if changed.
  - apply via `CampaignRepository.update` + `setMetaObjects`; stamp `meta_synced_config_at`.
  - return a small diff summary (what changed) for logging/response.
- `reconcileAll()` — loop pushed campaigns for connected shops (mirror `MetaInsightsService.syncAll`),
  `reconcile` each, non-throwing per campaign.

**1.4 D6 clobber-guard** — in `MetaPushService.scaleToFull` (and `updateDraft` budget path), when
`ADS_META_CONFIG_SYNC` is on, call `reconcile(campaignId)` first so we never push a budget older than Meta's.

**1.5 Nightly hook** — call `reconcileAll()` in the existing nightly Meta tick (next to `syncAll`), flag-gated.

**1.6 On-demand** — `POST /ads/campaigns/:id/sync-from-meta` (admin) → `reconcile(id)`, returns the diff.
Route in `AdsDomain/routes.ts`; controller method alongside the other campaign admin handlers.

**1.7 Frontend** — `syncCampaignFromMeta(id)` in `services/api/ads.ts`; a **"Refresh from Meta"** button in the
admin live/operating view (`AdminAdsTab`) + show `lastSyncedFromMeta` (from `meta_synced_config_at`).

**1.8 Tests** — pure `reconcileFields` unit tests (budget-changed, status-changed, no-change, draft-skip);
flag-off no-op; **live round-trip** on a pushed peanut campaign (read back budget/status, confirm DB matches
Meta, confirm Scale-to-full no longer clobbers).

**Phase-1 gate:** backend tsc 0; tests green; flag OFF = no behavior change.

---

## Phase 2 — Creative reflect + flag (~1d) — ✅ DONE (uncommitted)

- ✅ `MetaService.getAd(adId, token)` → `{status, creativeId}` (`fields=status,creative{id}`).
- ✅ `MetaConfigSyncService.reconcile` extended: when `c.metaAdId`+`c.metaCreativeId` exist and the live
  ad's `creative.id` ≠ stored `metaCreativeId`, pull `getCreativeSpec` → `CreativeRepository.reflectExternalCreative`
  (headline/body/image, non-empty only; **never touches `review_status`** — D3) and re-stamp `metaCreativeId` so
  it isn't re-detected. Spec unreadable → `flagExternallyEdited` (flag without content). Adds
  `changes.creativeExternallyEdited` to the reconcile result.
- ✅ Migration **179** `ad_creatives.externally_edited BOOLEAN` + `externally_edited_at TIMESTAMPTZ`. Flag is
  cleared by a local edit (`update`), regenerate (`upsertAi`), or re-review (`review`) — re-arms the review gate.
- ✅ FE: **"Edited in Ads Manager — not reviewed by FixFlow"** amber badge in `CreativePreview` (live view).
  `AdCreative.externallyEdited?` added to the FE type. Clearing it = edit the draft (re-review). No separate
  admin "re-approve" button (re-reviewing already clears it).
- ✅ Tests: 3 new cases (reflect+restamp, spec-unreadable→flag-only, no-op when ids match) — 11/11 pass.

## Phase 3 — Targeting + objective (~1d)

- Pull `targeting` + `objective`; migration adds `ad_campaigns.meta_targeting_raw JSONB` (fidelity).
- Best-effort map custom_location radius (km→mi) → `targetRadiusMiles`; reflect `objective`.
- **Do NOT reverse-push** a reverse-mapped targeting (D4 — lossy); the raw JSON is read-only fidelity.

## Phase 4 — Deletion / divergence (~0.5d) — ✅ DONE (uncommitted)

- ✅ Pure `isMetaObjectGone(message)` — distinguishes a deleted-object Graph error ("does not exist" /
  "Unsupported get request" / subcode 33) from a transient/permission error (so we never wrongly archive).
- ✅ `reconcile`: a 404 on the adset/campaign GET → `markDiverged`; an `effective_status` of `ARCHIVED`/`DELETED`
  → `markDiverged`. `markDiverged` reflects the campaign as `archived`, stamps `metaStatus` (`DELETED`/`ARCHIVED`),
  and returns a new `diverged` status (+ `reason: meta_deleted|meta_archived`). Idempotent. Never recreates.
- ✅ **Halt in-app actions** (D5): `MetaPushService.goLive` / `scaleToFull` / `updateDraft` now refuse a campaign
  whose status is `archived`, and `scaleToFull`/`updateDraft` also bail when their D6-guard reconcile returns
  `diverged` — so we never push to dead Meta ids.
- ✅ FE: the "Refresh from Meta" action surfaces a `diverged` toast (deleted vs archived) and reloads.
- ✅ Tests: +6 cases (pure `isMetaObjectGone` ×2, 404→diverged, ARCHIVED→diverged, transient→error-not-archived).

---

## Env summary
- `ADS_META_CONFIG_SYNC` (default false) — master flag.
- (reuses existing `META_GRAPH_VERSION`, Meta app creds, per-shop stored token.)

## Build order / effort
Phase 1 (budget+status, ~1–1.5d) = the meaningful v1 (dashboard reflects manual Ads-Manager budget/status
changes + no clobber). Phases 2–4 incremental. Total ~3.5–4d.

## Verification (every phase)
- Backend `tsc --noEmit` 0; pure reconcile unit tests; flag OFF = no behavior change.
- Live (peanut, pushed campaign): change budget in Ads Manager → `reconcile` → app shows the new budget;
  Scale-to-full afterwards does NOT revert it (D6). Creative swap (Phase 2) → app reflects + "Edited in Ads
  Manager" badge, review not auto-approved.
