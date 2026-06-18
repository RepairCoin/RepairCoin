# Scope — Meta Marketing API push (fully automated campaigns, no manual inputs)

**Date:** 2026-06-17
**Status:** Scope (no code; standing rule — don't build/commit until told).
**Goal:** when the admin **Builds** an approved campaign request, FixFlow **programmatically creates the real
campaign on the shop's connected Meta ad account** (Campaign → Ad Set → Ad + Creative + Lead form), and **auto-imports
spend/insights** — so there are **no manual steps**: no hand-building in Ads Manager, no manual daily-metric entry.
**Builds on:** the Connect-Meta flow (shop's token + `meta_ad_account_id` + `meta_page_id`/`meta_page_token` are stored)
and the lifecycle build flow. This is the **Stage-4 "push" slice** the connect scope explicitly deferred.
See `ads-connect-meta-shop-flow-*.md`, lifecycle design §7, [[project-ads-system-state]].

---

## 1. What "no manual inputs" requires (the hard part)
A Meta campaign needs concrete objects FixFlow must **derive automatically** from data it already has:

| Meta object | Field | Auto-derived from |
|---|---|---|
| **Campaign** | objective | the request `goal` → map (more_bookings/leads → `OUTCOME_LEADS`; awareness → `OUTCOME_AWARENESS`; traffic → `OUTCOME_TRAFFIC`); **default when unset/ambiguous = `OUTCOME_LEADS`** (locked — the lead pipeline is the only one with measurable ROI) |
| **Ad Set** | daily_budget | `monthlyBudgetCents / 30` (the brief) |
| | geo targeting | shop `location_lat`/`location_lng` + `targetRadiusMiles` (Meta `custom_locations` radius) — already on `shops` |
| | audience | broad + age 18-65 + industry interests (from `industryTaxonomies`) |
| | optimization/billing | `LEAD_GENERATION` / `IMPRESSIONS` per objective |
| | promoted_object | `meta_page_id` (lead ads) |
| **Ad Creative** | image | **both (locked):** AI-generated (gpt-image-1, brand-kit) **and** the shop's service photos — default to the AI image, offer the shop photos as swap options in the review state (§3a) |
| | primary text / headline | **AI-generated** from `offer` + shop/brand voice (BrandKit) |
| | link / CTA | shop profile / landing page + CTA from goal |
| **Lead form** | instant form | a default leadgen form on the Page (name/phone/email) → leads delivered via the **existing webhook** |

> The two genuinely-generative pieces are **creative image + copy**. Reuse the AI image infra
> (`deo/ai-image-generation`, gpt-image-1) + BrandKit voice + an LLM copy prompt. This is the main net-new work and
> the main quality risk (see §8).

---

## 2. What already exists (reuse)
- **Connection:** `shops.meta_oauth_token` (user token, encrypted), `meta_ad_account_id` (`act_…`), `meta_page_id`,
  `meta_page_token` (encrypted) — from the connect flow.
- **`ad_campaigns.meta_campaign_id`** (migration 148) — the link from our campaign → the Meta campaign.
- **Lead delivery:** `/ads/webhooks/meta/leads` receiver + `parseLeadEvents` + attribution → `ad_leads` (built/tested).
  So leads are automated once the campaign is a Lead Ad with a form on the Page.
- **Pipeline rollup:** `PerformanceRepository.rollUpFromPipeline` fills bookings/revenue from `service_orders`↔`ad_leads`
  (already automated). So once spend/impressions come from Meta, **ROI is fully automated**.
- **Safeguard auto-pause:** `SafeguardEvaluator`/`SafeguardScheduler` pauses burning campaigns (needs to also push the
  pause to Meta — §6).
- **AI image generation** (separate branch) + **BrandKitService** — for creative.
- `MetaService.syncInsights` / `fetchLeadFields` — **stubs to implement** here.

---

## 3. The build flow (replaces manual create)
`CampaignRequestController.buildCampaignFromRequest` today creates a DB row + sets `active`. New steps:
1. **Preconditions** (fail fast, post to thread): token valid, `meta_ad_account_id` + `meta_page_id` set, **ad account
   has a funding source** (GET `act_…?fields=funding_source_details,account_status` — Meta won't run ads without the
   shop's payment method) → if missing, block with "add a payment method in Meta" (shop-facing message).
2. **Generate creative**: AI image (brand-kit) + AI copy from `offer`/goal → upload image to the ad account
   (`/act_…/adimages`) → create `AdCreative` (`/act_…/adcreatives`) with Page + link + lead form.
3. **Create objects** via Marketing API (with the decrypted token):
   - `POST /act_…/campaigns` (objective, status) → `meta_campaign_id`
   - `POST /act_…/adsets` (budget, geo, audience, optimization, promoted_object, schedule) → `meta_adset_id`
   - `POST /act_…/ads` (creative + adset) → `meta_ad_id`
   - (lead ads) ensure a Page **leadgen form** exists → `meta_lead_form_id`
4. **Persist** the Meta ids on our rows; set our `ad_campaigns.status` to mirror Meta (active/paused).
5. **Create PAUSED → review state** (Option B, locked): objects are created `PAUSED`; the request enters a `ready`
   state. The admin reviews the auto-generated draft, optionally edits (§3a), then clicks **Go live** → set Meta objects
   `ACTIVE` → billing starts (§9.2) + thread event. (Auto-activate is a later config toggle.)
6. **Rollback on partial failure**: if a later step fails, delete/pause the created Meta objects so no orphan spend.

### 3a. Review & edit state (locked: Level 2 + 3)
Auto-generation fills everything, so the default path is zero-input. In the `ready` (paused) state the admin can:
- **In-app edit of key fields (Level 2):** caption/headline (text or "regenerate"), image/video (regenerate via AI /
  swap to a shop service photo / upload), daily budget, objective, and targeting basics (radius, age). Saving pushes the
  change to the paused Meta objects (`setObjectStatus`-style updates: update adset budget/targeting, replace creative).
- **Meta Ads Manager for the rest (Level 3):** deep targeting, placements, schedule, native A/B — the admin edits the
  paused campaign directly in Ads Manager (they already have access via the connection); **no extra build**. After
  editing there, they click **Go live** in FixFlow (or activate in Ads Manager and we sync status — §5).
`MetaService` therefore also needs **update** methods: `updateAdSet` (budget/targeting), `replaceAdCreative`,
`updateCampaign` (objective/name). Deep edits are intentionally delegated to Ads Manager (no in-app parity).

`MetaService` gains: `createCampaign`, `createAdSet`, `createAd`, `uploadAdImage`, `createAdCreative`,
`ensureLeadForm`, `getAccountStatus`, `setObjectStatus`.

---

## 4. Insights import (kills manual metrics)
- Implement `MetaService.syncInsights(campaign)`: `GET /{meta_campaign_id}/insights?fields=spend,impressions,clicks,
  actions&time_increment=1&date_preset=last_7d` → map to `ad_performance_daily` via `PerformanceRepository.upsertDaily`
  (spend_cents, impressions, clicks, leads_captured from `actions` lead type).
- Run **nightly** in `SafeguardScheduler.tick` for every campaign with a `meta_campaign_id`.
- **Deprecate** manual `enterDailyMetrics` (keep as an admin override / backfill only).
- Bookings/revenue keep coming from `rollUpFromPipeline` → ROI is now end-to-end automated.

---

## 5. Status sync (two-way)
- FixFlow pause/activate (admin or shop) → `setObjectStatus` pushes to Meta.
- **Safeguard auto-pause** (over budget / no leads) → also push `PAUSED` to Meta so spend actually stops (today it only
  flips our DB row).
- Disconnect / token-refresh failure (§9.6) → pause the shop's live Meta campaigns (can't manage them anymore).

---

## 6. Money (unchanged — important)
- **Ad spend is billed by Meta directly to the shop's funding source on `act_…`.** FixFlow never touches it; automation
  doesn't change this. Precondition §3.1 verifies the funding source exists or the campaign can't go live.
- **FixFlow's flat management fee** (Stripe) is the only thing FixFlow collects — unchanged, still gated by
  `ADS_BILLING_STRIPE_ENABLED`, starts at first live campaign.

---

## 7. New data (migration — verify next-free vs live `schema_migrations`; 162 is the last ads one)
On `ad_campaigns` (or a new `ad_meta_objects` table): `meta_adset_id`, `meta_ad_id`, `meta_creative_id`,
`meta_lead_form_id`, `meta_status`, `meta_last_synced_at`. (`meta_campaign_id` already exists.)

---

## 8. Risks & the automation-vs-safety tension
- **Q8 conflict (RESOLVED):** activation gate = **Option B — create PAUSED → one-click "Go live"** (locked 2026-06-17).
  Reconciles "no manual inputs" (nothing is *typed* — everything auto-generated) with a final human check before real
  spend. Auto-activate (A) can be a later config toggle once auto-creative is trusted. Safeguard auto-pause stays the net.
- **Creative quality:** AI image/copy may be off-brand or weak → wasted spend. Mitigate with brand-kit grounding +
  the pre-flight quality gate (review score/photos) + safeguard auto-pause.
- **Spend safety:** a bad auto-config can burn the shop's money fast. Keep the **daily budget cap** from the plan + the
  $400/$800 safeguard thresholds, and push pauses to Meta (§5).
- **Targeting accuracy:** needs `location_lat/lng` populated; fall back to city/zip if missing.
- **API churn:** Marketing API versioning + rate limits + async ad review by Meta (ads enter `PENDING_REVIEW`).

---

## 9. Hard external dependencies (gating go-live, not the build)
- **App Review for write scopes:** `ads_management`, `pages_manage_ads`, `leads_retrieval` (the exact scopes we trimmed
  from the connect test). Push **cannot run for real shops** until these have Advanced Access. Buildable/testable now in
  **dev mode** against your own dev app + your own ad account (real objects, real—but-your—spend, or a test ad account).
- **Meta test ad account** recommended for dev so no real money moves during testing.
- AI image infra must be merged/available on this branch (currently a separate branch).

---

## 10. Phasing & effort
- **P1 — create campaign objects** (campaign/adset/ad, static placeholder creative, geo+budget from brief) + store ids +
  status mirror + rollback. ~3–4d.
- **P2 — auto-creative** (AI image + copy from brief/brand kit, image upload, creative object). ~3–4d (depends on AI infra).
- **P3 — insights import** (`syncInsights` nightly → ad_performance_daily; deprecate manual entry). ~2d.
- **P4 — status sync + safeguard push + lead form automation**. ~2–3d.
- **P5 — review/edit state (Option B, Level 2):** `ready` status + admin review screen + in-app edit of key fields +
  `updateAdSet`/`replaceAdCreative`/`updateCampaign` push + the **Go live** action. ~2–3d. (Level 3 = Ads Manager, no build.)
≈ **12–16 dev-days**. P1+P3 alone already remove most manual work (objects + metrics); P2 removes the last manual input
(creative); P5 adds the human go-live gate + optional calibration. All behind a flag (`ADS_META_PUSH_ENABLED`, default
OFF); until on, **Build stays record-only / concierge**.

## 11. Out of scope
Google Ads push; CAPI/Conversions upload; advanced audiences (lookalikes/custom); A/B via Meta's native experiments
(we have our own). The **App Review** itself (ops checklist).

## 12. Decisions
1. ✅ **Activation gate (LOCKED 2026-06-17):** Option **B — create PAUSED → one-click "Go live"**, with a **review/edit
   state**: in-app edit of key fields (caption, image/video, budget, objective, radius/age) **+ Meta Ads Manager** for
   deep targeting/placements. Auto-activate (A) deferred as a later toggle. (See §3a, §8, P5.)
2. ✅ **Creative source (LOCKED 2026-06-17): both** — AI image (gpt-image-1) is the default; the shop's service photos
   are offered as swap options in the review state. (P2 generates the AI image + surfaces shop photos.)
3. ✅ **Objective default (LOCKED 2026-06-17): `OUTCOME_LEADS`** — map goals as above; anything unset/ambiguous → leads,
   since the lead pipeline is the only path with measurable ROI.
4. ✅ **Dev testing (LOCKED 2026-06-17): Meta test ad account** for P1/P2/P4/P5 (create/edit/status — no real spend).
   **P3 insights** is only structurally testable on a test account (no delivery → empty insights) → validate real spend
   numbers later against a real account with a tiny budget before go-live.
