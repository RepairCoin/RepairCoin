# Implementation Plan — Google Ads channel (vertical slices, real flow)

**Date:** 2026-06-30 (updated 2026-06-30)
**Status:** Plan — **partially built.** The Google-credential-free pieces are SHIPPED while waiting on the
Google invite; the rest is gated on the MCC + developer token + OAuth (access checklist §1–2).

### Built so far (no Google credentials needed) — on `deo/ads-system`, merged to `main`
- ✅ **Slice 2 — channel picker + eligibility** (`a687b5497`): `GET /ads/shop/ad-channels` (tier from
  `BillingPlanRepository.limitsForTier().channels` — only `business` includes `google` — + Meta connection);
  Channel segmented control in `CampaignBriefFields`, gated by `NEXT_PUBLIC_ADS_GOOGLE_ENABLED` (ON in Vercel),
  hidden when one channel eligible. No migration.
- ✅ **Slice 2 completion + Slice 6 tier gate** (`150f15327`, **migration 191** `ad_campaign_requests.channel`):
  brief `channel` validated (`parseBrief`) → persisted on the request → `ad_campaigns.platform`; `buildCampaignFromRequest`
  enforces it server-side — google + non-Business → `403 google_requires_business_tier`; google (any tier) →
  `409 google_not_available_yet` (connect/push not built → no orphan campaign).
- ⏳ **Everything else is credential-gated** (Slices 1/3/4/5 + the API parts of 6) — see BE-0 / the access checklist.

**Standing rule — don't build/commit until told.**
**Pairs with:** `ads-google-ads-scope.md` (the what/why + decisions). This is the **how/order**.
**Sequencing (revised — risk-free real flow):** build in **thin vertical slices**. For each feature a **real** (thin)
backend endpoint lands first, then its **frontend** is built immediately against the live response — no mocks, no
stubs. This removes the two risks of pure FE-first-on-mocks (**contract drift** and **mock divergence**) because every
piece of UI is wired to a real endpoint from the moment it's written. The FE for each capability still ships right
behind its (small) backend, so frontend work stays front-and-centre per slice — it's just never ahead of a fake.
**Flags:** `NEXT_PUBLIC_ADS_GOOGLE_ENABLED` (FE surface), `ADS_GOOGLE_PUSH_ENABLED` (BE create/push),
`ADS_GOOGLE_CONFIG_SYNC` (BE two-way sync). All default **OFF**; Google UI invisible until the FE flag is on, and even
then tier-gated (Business).

---

## Prerequisites — to START building vs. to GO LIVE
The code is **buildable now**; the only blocker is external and gates *real-shop go-live*, not the build/test.

**To START building (self-serve, hours–days, NO Google review):**
- Google Ads **manager account (MCC)**.
- **Developer token** at **Test access** level (issued in the MCC; near-instant — Test access calls *test* accounts only).
- **Google Cloud project + OAuth client** with the `adwords` scope.
- A **test manager + test client** account.
- *(Internal deps already satisfied: platform-agnostic spine — `platform` column, `gclid` attribution, lead pipeline,
  ROI rollup, two-way-sync pattern — is merged/live; AI image + BrandKit infra for creative is on the ads branch.)*
→ With these, **Slices 1–6 are fully buildable + verifiable on a test account** (real API objects, no real spend).

**To GO LIVE for real shops (Google-reviewed, ~weeks, can be iterated/rejected):**
- Developer token **Basic → Standard access** (required to call real shop accounts).
- **OAuth consent-screen verification** (the `adwords` scope is sensitive → required for non-test users).
→ This is **`BE-0`**. It blocks turning Google on for actual shops — **not** the build/test. **Start it day one, in
parallel**, since it's the long pole; keep Google dark (`NEXT_PUBLIC_ADS_GOOGLE_ENABLED=off`) until it clears.

---

## 0. Guiding principle — real flow, sliced
- **No mocks.** Each slice's backend is real (against a Google **test manager + test client** account — real API, no real
  spend), so the FE consumes real shapes. Nothing is built against a fixture that could drift.
- **Backend-thin-first, frontend-immediately-after, per slice.** A slice isn't "done" until its FE consumes its live
  endpoint end-to-end. Slices are small enough that FE follows the same day/next.
- **Dependency order = the real order.** Connect must exist before the channel picker can report "connected"; the picker
  before push; push before insights/sync. We follow that natural order — which is exactly what makes it risk-free.
- **Reuse, don't fork.** Connect mirrors `MetaConnectController`/`MetaConnectCard`; sync mirrors `MetaConfigSyncService`;
  the lead pipeline / ROI / Kanban UI is already channel-agnostic and needs **no change**.
- **Prereq:** `BE-0` access groundwork starts **now, in parallel** (weeks of calendar time) so test-account API access is
  ready when Slice 1 code begins.

---

## BE-0 — Access groundwork (external, start immediately, in parallel)
MCC + developer-token application (Test→Basic→Standard), OAuth client + consent-screen verification, **test manager +
test client accounts**. No code; weeks of calendar time, but the test account is enough to build/verify every slice
below for real. Real-shop go-live is gated on Basic/Standard token access + OAuth verification (scope §3).

---

## Slice 1 — Connect Google (BE → FE)
**BE-1 (~2–3d):**
- `GoogleAdsService` (mirrors `MetaService`): `isConfigured`, `getAuthorizationUrl`, `exchangeCodeForToken`,
  `refreshToken`, `listAccessibleCustomers`.
- `GoogleConnectController` (mirror `MetaConnectController`): `GET /ads/shop/google/connect` (signed state — reuse the
  Meta state util), `GET /ads/google/oauth/callback`, `GET /ads/shop/google/accounts`,
  `POST /ads/shop/google/select`, `POST /ads/shop/google/disconnect`.
- Migration: `shops.google_ads_refresh_token` (encrypted), `google_ads_customer_id`, `google_ads_manager_id?`.
- Verify on the **test account**: connect → callback → list accounts → select → disconnect, real tokens.

**FE-1 (~1–1.5d, immediately after BE-1):**
- `GoogleConnectCard.tsx` (mirror `MetaConnectCard`): Not connected → **Connect** (real `authUrl`); token-but-no-selection
  → **account picker** (shadcn select, real `listGoogleAccounts`); Connected → account name + **Disconnect** + green check.
- Surface in `ShopAdsTab` (+ admin connection view), gated by `NEXT_PUBLIC_ADS_GOOGLE_ENABLED`. Reuse the post-callback
  Ads-tab auto-nav already built for Meta.
- **Slice done** = a shop connects a real test Google account through the UI.

---

## Slice 2 — Channel picker in the brief (BE → FE) — ✅ DONE (`a687b5497` + `150f15327`)
**BE-2 (~0.5–1d):**
- `GET /ads/shop/ad-channels` — eligibility: `{ meta:{eligible,connected}, google:{eligible,connected,reason:
  'ok'|'tier_locked'|'not_connected'} }`, computed from the shop's **tier** (Business unlocks Google) + connection state.

**FE-2 (~1–1.5d):**
- `CampaignBriefFields.tsx`: add the **Channel** segmented control at the top (mockup in scope §13a), driven by real
  `/ad-channels`. Extend `BriefValue`+`briefToApi` with `channel` → `ad_campaigns.platform`.
- Hide the control when only one channel is eligible (Standard shop = unchanged). Google disabled states: "Business plan"
  badge → upgrade hub; "Connect Google first" → Slice-1 connect flow. Currency label follows the selected channel.
- **Slice done** = a Business shop (real, connected) submits a `channel:'google'` brief; a Standard shop sees no change.

---

## Slice 3 — Push / build + go-live (BE → FE)
**BE-3a — create objects (~4–5d):** `GoogleAdsService.createCampaignBudget/createCampaign/createAdGroup/createAd/
setObjectStatus`; branch `buildCampaignFromRequest` on `platform==='google'` → derive budget(micros)/geo/objective
(scope §7), create **PAUSED**, store `google_*` ids (migration), mirror status, rollback on partial failure, billing
precondition. Default campaign type per scope §13.1.
**BE-3b — auto-creative (~3–4d):** reuse AI image (gpt-image-1) + BrandKit copy, producing a **set** (RSA
headlines/descriptions, PMax image sizes/logo); upload assets; build the ad/asset group.

**FE-3 (~1d, after BE-3a):**
- `DraftComposer.tsx` channel-aware: Google goal/status semantics (`ENABLED/PAUSED/REMOVED`, Leads/Traffic) when
  `platform==='google'`; review/edit + **Go live** wired to the real Google go-live endpoint.
- **Slice done** = admin builds a Google draft (PAUSED) on the test account, reviews, clicks Go live → ENABLED.

---

## Slice 4 — Insights import (BE only; dashboard already channel-agnostic)
**BE-4 (~2d):** `GoogleAdsService.getInsights` via GAQL → `PerformanceRepository.upsertDaily`
(**`cost_micros / 10,000` → cents**), nightly in `SafeguardScheduler.tick` for campaigns with `google_campaign_id`.
No FE work — the ROI dashboard + `rollUpFromPipeline` are already channel-agnostic, so Google numbers appear automatically.

---

## Slice 5 — Two-way sync + safeguard push (BE → small FE)
**BE-5 (~2–3d):** `GoogleConfigSyncService` mirroring `MetaConfigSyncService`: reconcile budget/status, **D5 divergence**
(`REMOVED`/not-found → archive, never recreate), `setObjectStatus` for pause/activate + safeguard auto-pause push.
Flag `ADS_GOOGLE_CONFIG_SYNC`. Endpoint `POST /ads/campaigns/:id/sync-from-google`.
**FE-5 (~0.5d):** point the channel-aware **"Sync from {channel}"** button (added in FE-3) at the Google sync endpoint.

---

## Slice 6 — Go-live billing + server-side tier gate (BE)
**BE-6 (~1–2d):** channel-aware go-live billing (flat tier already exists); enforce the **Business-tier gate
server-side** on Google campaign build (defense-in-depth behind the FE gate).
- ✅ **Server-side tier gate DONE** (`150f15327`) — `buildCampaignFromRequest` rejects google for non-Business
  (`403`) and blocks google launch entirely (`409 google_not_available_yet`) until connect/push ship.
- ⏳ Channel-aware go-live billing (real google go-live) — lands with Slice 3 (needs the Google integration).

---

## Cutover / enablement order
1. Build slices **1 → 6 in order**, each merged behind flags (`NEXT_PUBLIC_ADS_GOOGLE_ENABLED` off; `ADS_GOOGLE_*` off).
   Each slice is real and verifiable on the **test account** the moment it lands — nothing waits on a mock.
2. Turn on `NEXT_PUBLIC_ADS_GOOGLE_ENABLED` on **staging** after Slices 1–3 (connect + picker + push) verify on the test account.
3. **Real-shop go-live** gated on `BE-0` access approvals (developer-token Standard + OAuth verification).

---

## Effort
- **BE-0** access track — external, weeks of calendar, **start now**.
- Slice 1: BE 2–3 + FE 1–1.5 · Slice 2: BE 0.5–1 + FE 1–1.5 · Slice 3: BE 7–9 + FE 1 · Slice 4: BE 2 · Slice 5: BE 2–3 +
  FE 0.5 · Slice 6: BE 1–2.
- ≈ **18–24 dev-days** of code total (FE ≈ 4–5 of those, interleaved). Same scope as before — just ordered to be risk-free.

---

## Verification
- **Per slice:** the slice's FE drives its **live** endpoint on the test account end-to-end (no fixtures). Standard-tier
  shop shows no change at every step.
- **BE:** tsc 0; unit-test pure bits (state sign/verify, status map, **micros↔cents**, GAQL builder, reconcile fn,
  eligibility→picker state). **FE:** tsc 0-net-new vs baseline.
- **Full path on test account:** connect → build (PAUSED) → review → go-live (ENABLED) → landing-page lead → `ad_leads`
  with `gclid` → insights import → two-way `REMOVED`→archived. Cross-channel: a Business shop runs Meta + Google; both
  leads land in one Kanban, one ROI dashboard.

---

## Residual risk (after removing mock/contract risk)
- **The only real risk is external:** Google's developer-token Basic→Standard access + OAuth consent-screen verification
  (weeks, can be rejected/iterated). It blocks **real-shop go-live**, not the build/test — everything above is fully
  buildable and verifiable on a test account first. Mitigate by starting `BE-0` at day one and keeping Google dark
  (`NEXT_PUBLIC_ADS_GOOGLE_ENABLED=off`) until access is granted.
- No contract-drift / mock-divergence risk: by construction, every FE slice is built against a live backend endpoint.
