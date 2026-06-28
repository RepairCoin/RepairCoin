# Two-Way Meta ⇄ App Config Sync — QA Guide (Phases 1–4)

**Date:** 2026-06-24
**Branch:** `deo/ads-system`
**Feature flag:** `ADS_META_CONFIG_SYNC` (default **off**)
**Scope/plan:** `ads-meta-two-way-sync-scope.md` · `ads-meta-two-way-sync-implementation-plan.md`

This guide verifies the four phases end-to-end against a **real** Meta ad account. The automated
suite (`tests/services/AdsMetaConfigSync.test.ts`, 22/22) already proves the decision logic with a
mocked Meta — this guide proves the live Graph round-trip, the flag/env wiring, and the UI.

---

## 0. Prerequisites

- **Flag on:** `ADS_META_CONFIG_SYNC=true` in the backend env (staging). Restart the backend
  (PORT=3002). With the flag off, every reconcile returns `status:'disabled'` and does nothing.
- **Meta app configured:** `META_APP_ID` + `META_APP_SECRET` set (this is what `metaService.isConfigured()`
  checks; `isConfigSyncEnabled()` requires both the flag AND this).
- **A live campaign to test:** a campaign **pushed and live** on a **connected shop**.
  - Use the **peanut** shop. ⚠️ `dc_shopu`'s ad account is under a **Meta security hold (code 31)** —
    its writes/reads will fail; do not test there.
  - "Pushed" means `ad_campaigns.meta_campaign_id` + `meta_adset_id` are non-null. A pre-push draft is
    intentionally **skipped** (`status:'skipped', reason:'not_pushed'`) — the app is source-of-truth before push.
- **DB:** the `.env` DB points at **DigitalOcean staging** (not local, not prod).
- **Access to Ads Manager** for that ad account (to make the external changes).

### How to trigger a reconcile
- **UI (preferred):** Admin → Ads tab → select the campaign → **"Refresh from Meta"** button
  (only shows when the campaign is on Meta and the flag is on). Toasts report the outcome.
- **API:** `POST /ads/campaigns/:id/sync-from-meta`.
- **Nightly:** `SafeguardScheduler.tick` calls `reconcileAll()` automatically.

### Reading the result
Each reconcile returns a `ReconcileResult.status`:
- `synced` — fields changed (the changed keys are in `changes`)
- `in_sync` — Meta already matched us (no change)
- `diverged` — the Meta objects are archived/deleted (Phase 4)
- `skipped` — not pushed yet, or the shop's Meta token is missing
- `disabled` — flag off / Meta not configured
- `error` — a transient Meta read failure (we did NOT change anything)

### Check the DB (psql / TablePlus against staging)
```sql
SELECT id, status, daily_budget_cents, objective, target_radius_miles,
       meta_status, meta_synced_config_at, meta_targeting_raw IS NOT NULL AS has_targeting
  FROM ad_campaigns WHERE id = '<CAMPAIGN_ID>';

SELECT id, review_status, externally_edited, externally_edited_at,
       headline, left(body, 60) AS body, image_url, meta_creative_id
  FROM ad_creatives WHERE campaign_id = '<CAMPAIGN_ID>' AND image_url IS NOT NULL
  ORDER BY updated_at DESC LIMIT 1;
```

> Record a **baseline** (run both queries once before testing) so you can see what each step changed.

---

## Phase 1 — Budget + status

1. In **Ads Manager**, change the ad set's **daily budget** (e.g. $50 → $80) and/or **pause** the campaign.
2. Click **Refresh from Meta** (or wait for the nightly run).

**PASS when:**
- Toast: "Synced from Meta — updated N field(s)."
- `ad_campaigns.daily_budget_cents` matches the new Meta budget (account-currency minor units).
- `status` follows Meta: PAUSED→`paused`, ACTIVE→`active`. `meta_status` records Meta's raw status.
- `meta_synced_config_at` is updated.
- Running it again with no further Ads-Manager change → "Already in sync" (`in_sync`).

**Edge checks:** an unmapped Meta state (e.g. `WITH_ISSUES`) must **not** change our `status`, but should
still record `meta_status`. A null Meta budget must **not** zero our value.

---

## Phase 2 — Creative reflect + flag

1. In **Ads Manager**, edit the ad's **creative** (new headline / primary text / image) — this creates a
   new creative id bound to the ad.
2. Click **Refresh from Meta**.

**PASS when:**
- The latest `ad_creatives` row reflects the new **headline / body / image_url** from Meta.
- `externally_edited = true` and `externally_edited_at` is set.
- `review_status` is **unchanged** (an external edit must NOT auto-approve — D3).
- The campaign's `meta_creative_id` is re-stamped to the new creative id (so a second refresh is a no-op).
- **UI:** the live "Current ad" preview shows the amber **"Edited in Ads Manager — not reviewed by FixFlow"** badge.

**Clear-the-flag checks (each should set `externally_edited` back to false):**
- Edit the creative locally in the draft, **or** regenerate the image, **or** re-review (approve/reject) it.

**Spec-unreadable case:** if Meta can't return the creative spec, the row is still flagged
(`externally_edited=true`) but content is left as-is.

---

## Phase 3 — Objective + targeting reflect (read-only fidelity)

1. In **Ads Manager**, change the ad set's **radius** (e.g. 5 mi → 25 km) and/or the campaign **objective**.
2. Click **Refresh from Meta**.

**PASS when:**
- `ad_campaigns.objective` matches Meta's objective.
- `target_radius_miles` reflects the new radius, **converted to miles** if Meta reports kilometers
  (e.g. 16.09 km → 10 mi, rounded).
- `meta_targeting_raw` (JSONB) is populated with the full targeting spec verbatim.
- `changes` contains `objective` / `targetRadiusMiles` when they moved; targeting fidelity alone does NOT
  flip `in_sync`→`synced`.

**Do-NOT check (D4):** we never **reverse-push** the reverse-mapped targeting. `meta_targeting_raw` is
read-only fidelity for rich targeting (interests/demographics/audiences) we can't round-trip.

---

## Phase 4 — Deletion / divergence (halt, never recreate)

1. In **Ads Manager**, **archive** (or **delete**) the campaign.
2. Click **Refresh from Meta**.

**PASS when:**
- Result `status:'diverged'`, `reason:'meta_archived'` (archived) or `'meta_deleted'` (deleted / 404).
- `ad_campaigns.status = 'archived'`, `meta_status = 'ARCHIVED'`/`'DELETED'`.
- Toast warns it was archived/removed in Ads Manager.
- **In-app actions are halted:** attempting **Go Live**, **Scale to full**, or **Edit draft** on it now fails
  with `campaign_archived_on_meta`. The app must **not** recreate the deleted Meta objects.

**Critical negative check (don't wrongly archive on a blip):** a **transient** Meta error (rate limit,
expired token, network) must return `status:'error'` and change **nothing** — only a genuine 404
("does not exist" / subcode 33) or an `ARCHIVED`/`DELETED` effective status counts as divergence.

---

## Teardown
- Reset the test campaign's Ads-Manager state if you want to re-run.
- Set `ADS_META_CONFIG_SYNC=false` again if staging should stay flag-off after QA.
- No data seeding is required; this exercises a real campaign, so there's nothing to clean up in the DB.

## Known gate
The live Graph read is **externally gated** — it needs a real connected, non-held ad account. If Meta
returns auth/permission errors, that's an account/token issue, not a code defect (the mocked-Meta suite
covers the logic). Re-auth the shop's Meta connection and retry on **peanut**.
