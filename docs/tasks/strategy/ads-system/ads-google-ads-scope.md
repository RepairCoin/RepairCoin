# Scope — Google Ads channel (connect + push + insights)

**Date:** 2026-06-30
**Status:** Scope (no code; standing rule — don't build/commit until told).
**Goal:** add **Google Ads** as a second ad channel alongside Meta — same operating model (shop's own Google Ads
account, shop's own spend, FixFlow operates + charges the flat fee), same lead pipeline, same ROI rollup. A shop on the
**Business tier** can run Google campaigns (Search / Performance Max) that capture leads into the existing `ad_leads`
pipeline, with spend/insights auto-imported.
**Builds on:** the Meta connect + push + two-way-sync work — this deliberately **reuses the platform-agnostic spine**
(lead pipeline, attribution, performance rollup, billing, lifecycle, landing page) and only adds the Google-specific
edges. See `ads-connect-meta-shop-flow-scope.md`, `ads-marketing-api-push-scope.md`,
`ads-meta-two-way-sync-scope.md`, lifecycle design §7/§9, and [[project-ads-system-state]].

> **Why this doc exists:** the architecture already anticipates Google (`ad_campaigns.platform` defaults `'meta'` but
> allows `'google'`; attribution already handles `gclid`; the Business tier lists `channels: ['facebook','instagram',
> 'google']`), but there is **no implementation/scope doc** for it. This is that doc — plan only.

---

## 1. Operating model (same as Meta — frames everything)
- Campaign runs on the **shop's own Google Ads account**, funded by the **shop's own payment method on Google**.
  FixFlow never touches ad spend; it **operates** the account and bills only the flat management fee (Stripe).
- "Connect" = the shop **grants FixFlow permission** to manage their Google Ads account. Two real mechanisms (mirror Meta A/B):
  - **(A) Google OAuth (in-app)** — shop clicks Connect → Google consent → we receive a refresh token and operate via
    the Google Ads API with the shop's **customer ID**. *Recommended* (self-serve, revocable, fits the dashboard).
  - **(B) Manager account (MCC) link** — FixFlow's **manager account** sends a link invitation; the shop accepts in
    their Google Ads UI; we operate the linked customer from our MCC. Good as fallback / enterprise; no per-shop token.
- **This scope builds (A)**, with (B) as a documented manual fallback (and the likely long-term path for scale).

---

## 2. What already exists (reuse — do NOT rebuild)
The platform-agnostic spine is already there; Google rides on it:
- **`ad_campaigns.platform`** column (`DEFAULT 'meta'`, allows `'google'`) — already in the schema (stage-0). The whole
  campaign/request/lifecycle model is platform-tagged.
- **Attribution already handles Google:** `LeadAttributionService` + the landing/webform path accept **`gclid`** (Google
  click id) alongside `fclid`. A Google click → FixFlow landing page → `ad_leads` row already works conceptually.
- **Lead pipeline:** `ad_leads`, the Kanban, lead follow-up (timeline/email/call), conversion attribution
  (`service_orders.ad_lead_id`) — **100% channel-agnostic**. A Google lead is just an `ad_leads` row.
- **ROI rollup:** `PerformanceRepository.rollUpFromPipeline` (bookings/revenue from `service_orders`↔`ad_leads`) and
  `ad_performance_daily` (spend/impr/clicks/leads) — channel-agnostic. Once Google spend lands in `ad_performance_daily`,
  ROI is automated exactly like Meta.
- **Landing page** `/l/[campaignId]` (dual CTA book/lead-form) — **reusable as the Google lead destination** (see §8,
  the recommended lead path), preserving `gclid`.
- **Lifecycle + billing:** campaign request → build → review → go-live → flat-tier billing (`ADS_BILLING_*`), safeguards,
  two-way sync **pattern** (`MetaConfigSyncService` is the template for a `GoogleConfigSyncService`).
- **Two-way sync template:** the D1–D6 decisions + reconcile/markDiverged logic transfer directly (Google `REMOVED` ≙
  Meta `DELETED`).

**Net:** the genuinely net-new work is a **`GoogleAdsService`** (OAuth + create + insights), a small amount of
Google-specific data, and channel-aware FE — *not* a second ads system.

---

## 3. Hard external dependencies (state up front — these gate go-live, not the build)
Google's review gates are **stricter and slower than Meta's** — call this out to execs early:
1. **Developer token** — applied for in a Google Ads **manager (MCC)** account. Starts at **Test access** (can only call
   *test* accounts). Calling **real** shop accounts requires **Basic access** then **Standard access**, each Google-approved
   (application + compliance review). **This is the long pole** (the Google analog to Meta App Review).
2. **OAuth client + consent-screen verification** — a Google Cloud project with an OAuth client using the **sensitive**
   `https://www.googleapis.com/auth/adwords` scope. External users require **Google OAuth app verification** (another review).
3. **Test access is buildable NOW:** full end-to-end against a **Google Ads test manager account + test client accounts**
   (real API objects, no real spend). Ship behind a flag; go-live for real shops gated on the token-access approvals.
- Build a **"Google Ads API access checklist"** in parallel (sibling to `ads-meta-app-review-checklist.md`).

---

## 4. Connection flow (the handshake — mirror Meta §4)
1. **Start** — shop clicks **Connect Google** in the Ads tab → `GET /ads/shop/google/connect` → Google OAuth URL with a
   **signed `state`** = `{shopId, nonce}` (reuse the Meta state-sign/verify util; CSRF + binds callback to shop).
2. **Consent** — shop authorizes the `adwords` scope on Google → redirected to our **callback** with `code` + `state`.
3. **Callback** — `GET /ads/google/oauth/callback`: verify state → exchange `code` → **refresh token** (Google's long-lived
   credential); store **encrypted at rest** (reuse the Meta token-crypto util). Do **not** set connected yet.
4. **Select customer account** — list the user's accessible Google Ads accounts
   (`CustomerService.listAccessibleCustomers` → resolve each customer's descriptive name); shop picks **one customer ID**
   to run ads under. Store it. **Only now** set `ads_account_connected = true` (reuse the existing per-shop gate) + thread event.
   - *(If using MCC route (B): instead send a manager-link invitation to the chosen customer and mark connected when accepted.)*
5. **Disconnect** — `POST /ads/shop/google/disconnect`: revoke + clear token/customer id, set `ads_account_connected=false`,
   thread event.

---

## 5. Data model (migration — verify next-free vs live `schema_migrations` at build time)
New columns on `shops` (Google equivalents of the Meta connect columns):
- `google_ads_refresh_token TEXT` (encrypted) — the shop's OAuth refresh token.
- `google_ads_customer_id TEXT` — the selected client customer (no dashes).
- `google_ads_manager_id TEXT` (optional) — login-customer-id / MCC if operating via manager link (route B).

On `ad_campaigns` (Google object ids — analogous to the `meta_*` ids; consider a generic `ad_platform_objects` table if
we don't want platform-prefixed columns proliferating):
- `google_campaign_id`, `google_ad_group_id`, `google_ad_id`, `google_budget_id`, `google_lead_form_id` (if lead-form assets),
  `google_status`, `google_last_synced_at`.
- *(Reuse `platform` to disambiguate; a campaign row is one platform.)*

Tokens: **encrypt** `google_ads_refresh_token` at rest (same util as Meta). Store least-privilege.

---

## 6. Backend endpoints (shop = JWT shopId; callback public)
- `GET  /ads/shop/google/connect` → `{ authUrl }` (signed state).
- `GET  /ads/google/oauth/callback` → verify state → exchange → store refresh token → redirect to the account picker.
- `GET  /ads/shop/google/accounts` → `{ accounts[] }` (accessible customers, for the picker).
- `POST /ads/shop/google/select { customerId }` → store + set connected + thread event.
- `POST /ads/shop/google/disconnect` → revoke + clear + thread event.
New **`GoogleAdsService`** (the Google analog of `MetaService`): `getAuthorizationUrl`, `exchangeCodeForToken`,
`refreshToken`, `listAccessibleCustomers`, `createCampaignBudget`, `createCampaign`, `createAdGroup`, `createAd`,
`createLeadFormAsset` (or rely on landing-page path), `setObjectStatus`, `getInsights` (GAQL). Mirrors the `MetaService` surface.

---

## 7. Push flow (mirror the Meta push §3 — derive everything, no manual inputs)
`buildCampaignFromRequest` already routes by need; add a Google branch behind the flag.

| Google object | Field | Auto-derived from |
|---|---|---|
| **Campaign budget** | amount_micros (daily) | `monthlyBudgetCents / 30` → micros (×10,000; Google money is **micros**) |
| **Campaign** | type + bidding | **decision §13.1** — default **Performance Max** (most automated, goal-driven) or **Search** (more control) |
| | objective/goal | request `goal` → conversion goal = **Leads** (parity with Meta's `OUTCOME_LEADS` default) |
| **Ad Group** *(Search)* | keywords | derived from shop industry/service + city (Search only; PMax uses asset groups, no keywords) |
| | geo targeting | shop `location_lat/lng` + `targetRadiusMiles` → Google proximity / location targeting |
| **Ad / Asset group** | headlines + descriptions | **AI-generated** (reuse BrandKit voice + LLM copy prompt — same as Meta) — RSA needs N headlines / M descriptions |
| | images / logo | **AI-generated** (gpt-image-1, brand kit) + shop service photos (PMax asset group needs multiple sizes + logo) |
| | final URL | the **FixFlow landing page** `/l/[campaignId]` (preserves `gclid`) or shop profile |
| **Lead capture** | lead form asset OR landing page | **decision §13.2** — recommend **landing page** (reuses existing lead capture + attribution; no Google lead-form webhook to build) |

- **Create PAUSED → review → Go live** (same Option-B gate as Meta, locked): objects created `PAUSED`, request → `ready`,
  admin reviews/edits, **Go live** flips to `ENABLED`, billing starts.
- **Preconditions:** valid token, `google_ads_customer_id` set, **billing set up on the Google account** (Google won't
  serve without the shop's payment method) — analog to Meta's funding-source check.
- **Rollback on partial failure:** remove/pause created Google objects so no orphan spend.

> The two genuinely-generative pieces are the **creative (copy + image)** — identical reuse of the AI image + BrandKit
> infra as Meta. Google RSA/PMax just need **more** assets (multiple headlines/descriptions/image sizes) than a Meta ad.

---

## 8. Lead capture — the key Google-vs-Meta difference
Meta lead ads deliver via the **lead webhook** we already built. Google has two options; **recommend the landing page**:
- **(Recommended) Landing-page conversion:** Google ad → `/l/[campaignId]?gclid=…` → existing **webform** captures the
  lead into `ad_leads` (attribution via `gclid`, already supported). **Zero new lead-transport code**, works for Search +
  PMax + Display uniformly, and we control the page/CTA. Conversion fires on form submit.
- **(Later) Google Lead Form assets:** native in-Google form; delivery via a **configured webhook** (URL + key on the
  asset) — analogous to the Meta lead webhook but a separate receiver + payload format. More friction, Google-specific.
  Defer to a later phase; landing page covers v1.

---

## 9. Insights import (kills manual metrics — mirror Meta §4)
- `GoogleAdsService.getInsights(campaign)` via **GAQL** (`SELECT metrics.cost_micros, metrics.impressions,
  metrics.clicks, metrics.conversions FROM campaign WHERE segments.date DURING LAST_7_DAYS`) → map to `ad_performance_daily`
  via `PerformanceRepository.upsertDaily`. **Watch the units:** `cost_micros` → `spend_cents` = `cost_micros / 10,000`.
- Run **nightly** in `SafeguardScheduler.tick` for every campaign with a `google_campaign_id` (the loop already exists for Meta).
- Bookings/revenue keep coming from `rollUpFromPipeline` → ROI end-to-end automated, no manual entry.

---

## 10. Status sync (two-way — reuse the Meta sync pattern)
- A **`GoogleConfigSyncService`** mirroring `MetaConfigSyncService`: pull budget/status from Google, reconcile (Google
  wins for live), and apply the **same D5 divergence handling** — a campaign set `REMOVED` in the Google UI (or a "not
  found" GAQL result) → mark our campaign `archived` + `google_status = REMOVED`, **never recreate**, halt in-app actions.
- Status map: Google `ENABLED→active`, `PAUSED→paused`, `REMOVED→archived` (Google `REMOVED` is irreversible ≙ Meta `DELETED`).
- FixFlow pause/activate + safeguard auto-pause → `setObjectStatus` pushes to Google (so spend actually stops).
- Gated by a **`ADS_GOOGLE_CONFIG_SYNC`** flag (mirror `ADS_META_CONFIG_SYNC`).

---

## 11. Money (unchanged — important)
- **Ad spend is billed by Google directly to the shop's payment method.** FixFlow never touches it. Precondition (§7)
  verifies billing is set up or the campaign can't go live.
- **FixFlow's flat management fee** (Stripe) is unchanged — Google is included in the **Business tier** ($999/mo per the
  narrative). Tier gating already exists (`channels: ['…','google']`); enforce it before allowing a Google campaign.

---

## 12. Risks
- **Access approval is the long pole** (developer token Basic→Standard + OAuth verification) — weeks, and stricter than
  Meta. De-risk by building/testing on a **test manager account** and queuing the access applications early.
- **Creative volume:** RSA/PMax need many assets (headlines/descriptions/multiple image sizes + logo). The AI copy/image
  infra must produce a *set*, not one ad — more generation + the main quality risk (same mitigations: brand-kit grounding,
  review gate, safeguard auto-pause).
- **PMax is a black box:** great automation, little control/visibility (no keyword/placement transparency) — good for
  "no manual inputs," but harder to diagnose poor ROI. Search gives control at the cost of keyword derivation. (§13.1.)
- **Units & API shape:** money in **micros**, GAQL query language, resource-name addressing, and aggressive **API
  versioning** (Google deprecates versions ~yearly) — more churn than Meta.
- **Conversion signal back to Google:** for smart bidding to work well, Google wants conversions imported (Enhanced
  Conversions for Leads via `gclid`, or offline conversion import) — analog to Meta CAPI; **design-only/later** (§14).

---

## 13. Phasing & effort (mirror the Meta push phasing; all behind `ADS_GOOGLE_PUSH_ENABLED`, default OFF)
- **P0 — access groundwork (external, parallel):** create MCC, apply for developer token, set up OAuth client +
  consent-screen verification, spin up a **test manager + test client**. (Calendar weeks; no code.)
- **P1 — connect:** OAuth connect/callback/select/disconnect endpoints + `GoogleAdsService` auth methods + token storage +
  migration. ~2–3d (test-account testable).
- **P2 — push (create objects):** budget/campaign/ad-group/ad creation (start with **Search** or **PMax** per §13.1) +
  geo/budget from brief + status mirror + rollback. ~4–5d (Google object graph is chunkier than Meta).
- **P3 — auto-creative:** AI copy *set* (RSA headlines/descriptions) + AI images (multiple sizes) + asset upload. ~3–4d.
- **P4 — insights import:** GAQL nightly → `ad_performance_daily` (micros→cents). ~2d.
- **P5 — status sync + safeguard push + two-way reconcile** (`GoogleConfigSyncService`). ~2–3d.
- **P6 — review/edit state + Go live** (reuse the Meta Option-B review UI, channel-aware). ~2–3d.
≈ **15–20 dev-days** of code + the external access track in parallel. P1+P2+P4 already remove most manual work.

---

## 13a. UI — channel selection in the campaign brief
Today the shop never picks a channel: the shared brief form **`CampaignBriefFields.tsx`** (reused by the opt-in form
`AdEnrollmentCTA` **and** the recurring campaign-request rail in `ShopAdsTab`) has services · budget · radius · offer ·
goal, and campaigns are implicitly Meta. Google adds a **Channel** picker at the top of that same form — one component,
one place.

```
Tell us what to advertise
┌─────────────────────────────────────────────┐
│ Channel:  [ Facebook/Instagram ]  [ Google ] │ ← new (segmented control)
│ Which services?  ( ) Screen repair ...        │
│ Monthly budget (CUR)    Target radius (mi)     │
│ Special offer ...                             │
│ Goal:  [More bookings] [Awareness] ...         │
└─────────────────────────────────────────────┘
```

**Eligibility-gated (not shown blindly):**
- **Facebook/Instagram** — always available (any tier, once Meta is connected) = today's behaviour.
- **Google** — enabled only when the shop is **Business tier AND Google-connected**. Otherwise shown but disabled:
  - Not Business tier → "Google · Business plan" badge → deep-links to the upgrade hub (the $999 upsell surface).
  - Business but not connected → "Connect Google first" → opens the §4 connect flow.
- If only **one** channel is eligible, default-select it and **hide the picker** — a Standard-tier shop sees no change
  (Meta only), zero added clutter.

**One channel per request (locked recommendation — §15.4 adjacent):** the data model is **one `platform` per campaign
row**, so the brief picks **one channel → one campaign**. Running both Meta + Google = two briefs (or a later "Run on
both" convenience that spawns two campaign rows). Ship one-per-request first — matches the schema, keeps per-channel
budget/creative clean.

**Component-level ripples (small, contained):**
- Add `channel: 'meta' | 'google'` to `BriefValue` + `briefToApi` → maps to the campaign's `platform`.
- The currency readout (today `getMetaConnection().currency`) follows the **selected** channel's connected-account
  currency (Meta vs Google account currency) — the budget label already renders in the account currency.
- Eligibility data: tier (from the subscription/tier source already used by the add-on hub) + connection status
  (`getMetaConnection` + a new `getGoogleConnection`).
- Admin side (`DraftComposer`): the objective/labels are currently Meta-specific (`OUTCOME_*`); make them channel-aware
  so a Google draft shows Google goal/status semantics.

**Where it does NOT change:** once a channel is chosen, the rest of the flow (build → review → go-live → lead pipeline →
ROI) is the **same UI** — leads from both channels land in one Kanban, one dashboard. The picker is the only net-new
shop-facing control.

---

## 14. Out of scope (this doc)
- **Local Services Ads (LSA)** — pay-per-lead Google program with license/insurance verification; separate API + onboarding.
  Potentially high-value for service shops, but its own scope.
- **Google Lead Form asset webhook** (use the landing page in v1 — §8).
- **Offline-conversion / Enhanced-Conversions upload back to Google** (CAPI analog) — design-only/later (§12).
- **YouTube/Display-specific** creative tooling beyond what PMax auto-handles.
- The **developer-token access + OAuth verification** processes themselves (external checklist, like the Meta App Review doc).

---

## 15. Decisions needed before building
1. **§13.1 — Default Google campaign type: Performance Max (most automated, goal-driven, least control) vs Search
   (keyword control, needs keyword derivation)?** Recommend **PMax** for the "no manual inputs" goal, with Search as a later option.
2. **§8 — Lead capture: landing page (recommended, reuses existing capture + `gclid`) vs native Google Lead Form assets (later)?**
3. **§1/§4 — Connect mechanism: OAuth in-app (A, recommended) vs MCC manager-link (B)?** (B scales better but is less self-serve.)
4. **§5 — Data model: platform-prefixed `google_*` columns on `ad_campaigns` vs a generic `ad_platform_objects` table** (cleaner if a 3rd channel is ever likely)?
5. **Tier gating — confirm Google stays Business-tier only** ($999/mo), per the narrative.
6. **Sequencing — start the developer-token + OAuth-verification applications now (long lead time), or wait until Meta is fully proven in production?**

---

## 16. Verification (when built)
- Backend tsc 0; FE tsc 0-net-new vs baseline; unit-test the pure bits (state sign/verify, status map, micros↔cents,
  GAQL builder, reconcile decision fn).
- Manual end-to-end on a **Google Ads test manager + test client** on staging: connect → build (PAUSED) → review →
  go-live (ENABLED) → landing-page lead → `ad_leads` row with `gclid` attribution → insights import (structural; real
  spend numbers validated later on a real account with a tiny budget).
- Two-way sync: set a test campaign `REMOVED` in the Google UI → "Sync from Google" → reflects as archived (parity with Meta D5).
