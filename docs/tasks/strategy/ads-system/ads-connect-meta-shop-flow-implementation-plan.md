# Implementation Plan — Shop-side "Connect Meta" flow

**Date:** 2026-06-17
**Status:** Plan — no code until told. Standing rule: don't build/commit until told.
**Implements:** `ads-connect-meta-shop-flow-scope.md`. **Go-live track:** `ads-meta-app-review-checklist.md`.
**Decisions LOCKED (user-confirmed 2026-06-16):**
1. **Mechanism = A** — Facebook Login OAuth, in-app (self-serve, revocable).
2. **Token = 60-day user token + nightly refresh** (revisit Business system-user later).
3. **In-app account/Page picker = yes** (shops often have >1 ad account/Page).
4. **Encryption = reuse the existing `crypto-js` token pattern** (as in `GoogleCalendarService.encryptToken` /
   `GmailService`), keyed off a dedicated `META_TOKEN_ENCRYPTION_KEY` env — extracted into a small shared util.

**Grounded in built code:**
- `MetaService` — `isConfigured()` + `getAuthorizationUrl()` real; `exchangeCodeForToken`/`refreshToken`/
  `fetchLeadFields`/`syncInsights` are stubs to implement (this plan implements the first two + adds account listing).
- Migration **148** — `shops.meta_oauth_token / meta_oauth_refresh_token / meta_oauth_expires_at`.
- Migration **161** — `shops.ads_account_connected` + `BillingPlanRepository.isAdsAccountConnected/setAdsAccountConnected`;
  §9.6 build gate in `buildCampaignFromRequest` (already blocks build when false).
- **OAuth precedent to mirror:** `GoogleCalendarService` (connect → exchange → `encryptToken` (crypto-js) → store →
  refresh) + `CalendarRepository`. Same shape; copy the proven structure.
- `getMySubscription` already returns `adsAccountConnected`; `SubscriptionPanel` shows a passive connection note.
- `SafeguardScheduler.tick` (nightly 03:00) — host the token-refresh job.
- Meta **webhook receiver** (`/ads/webhooks/meta/leads`) — built; this plan adds a **deauthorize** webhook.

> **Migration number:** expected **162**, but **verify against the live `schema_migrations` first** (DB authoritative,
> teammate added 154 out-of-band) — see [[feedback-check-migration-number-before-building]].

---

## What's buildable now vs. needs the dev Meta App
- **Buildable + unit-testable WITHOUT credentials (Phase 1 minus live calls, Phase 2):** migration, signed-`state`
  sign/verify, endpoints/routes (Graph calls behind `MetaService.isConfigured()`), token encrypt/store plumbing,
  the full shop UI.
- **Needs a dev Meta App (App ID/Secret) to RUN/verify:** `exchangeCodeForToken`, `listAdAccounts`, `listPages`,
  `refreshToken`. Code them now; verify end-to-end once `META_APP_ID`/`META_APP_SECRET` are set on staging.
- Everything ships behind a flag (`ADS_META_CONNECT_ENABLED`, default OFF) → until on, the §9.6 **admin-flip stays**
  the connection path. No regression.

---

## Phase 1 — Backend connect flow  (~2–3d; dev-app testable)

**1a. Migration (verify number).** `ALTER TABLE shops ADD COLUMN IF NOT EXISTS`:
`meta_ad_account_id TEXT`, `meta_page_id TEXT`, `meta_page_token TEXT` (encrypted), `meta_business_id TEXT` (optional).
Reuse 148's `meta_oauth_*` for the user token; reuse 161's `ads_account_connected` as the derived gate flag.

**1b. Token crypto util.** Extract the `crypto-js` AES pattern into `src/utils/tokenCrypto.ts`
(`encryptToken(plain)` / `decryptToken(cipher)`), keyed off `META_TOKEN_ENCRYPTION_KEY`. (Mirror
`GoogleCalendarService.encryptToken`; optionally refactor Calendar/Gmail onto it later — out of scope here.)

**1c. Signed `state`.** `signState({shopId, nonce, ts})` / `verifyState(s)` — HMAC-SHA256 (crypto) keyed off
`META_OAUTH_STATE_SECRET` (fallback `JWT_SECRET`), short TTL (~10 min), single-use nonce. CSRF + binds callback to shop.

**1d. `MetaService` — implement the real methods** (Graph v19.0; gated by `isConfigured()`):
- `exchangeCodeForToken(code, redirectUri)` → `GET /oauth/access_token` (short-lived) → `GET /oauth/access_token?
  grant_type=fb_exchange_token` (long-lived ~60d) → `{ token, expiresAt }`.
- `listAdAccounts(userToken)` → `GET /me/adaccounts?fields=account_id,name,account_status`.
- `listPages(userToken)` → `GET /me/accounts?fields=id,name,access_token` (Page tokens for lead ads).
- `refreshToken(longLivedToken)` → re-extend via `fb_exchange_token` (used by the nightly job).
Use the platform `fetch`/existing http util; never log tokens.

**1e. `MetaConnectionRepository`** (AdsDomain) — read/write the `shops` meta_* columns + `ads_account_connected`
(reuse `BillingPlanRepository.setAdsAccountConnected` or fold in): `saveUserToken`, `saveSelection`, `getConnection`,
`clearConnection`, `listExpiring(beforeTs)` (for refresh).

**1f. `MetaConnectController` + routes** (shop = JWT shopId; callback/deauthorize public):
| Method/Path | Does |
|---|---|
| `GET /ads/shop/meta/connect` | build `getAuthorizationUrl(redirectUri, signState(...))` → `{ authUrl }` |
| `GET /ads/meta/oauth/callback` | verify `state` → `exchangeCodeForToken` → `encryptToken` → store → redirect to Ads tab (picker) |
| `GET /ads/shop/meta/accounts` | `listAdAccounts` + `listPages` (decrypt user token) → `{ adAccounts[], pages[] }` |
| `POST /ads/shop/meta/select` | `{adAccountId,pageId}` → store (+ encrypt page token) → `setAdsAccountConnected(true)` → thread event |
| `POST /ads/shop/meta/disconnect` | clear tokens/selection → `setAdsAccountConnected(false)` → thread event |
| `POST /ads/webhooks/meta/deauthorize` | signed → resolve user → clear connection + flag |
Auto-post lifecycle `event` rows to `ad_messages` on connect/disconnect (reuse `AdMessageRepository.postEvent`).

**1g. Tests (pure):** `signState`/`verifyState` (tamper/expiry/nonce), `tokenCrypto` round-trip, account-pick
validation. Graph calls verified manually with the dev app.

---

## Phase 2 — Shop UI  (~1–1.5d; shadcn)
- New `MetaConnectCard` (in `ShopAdsTab`, near/inside `SubscriptionPanel`), replacing the passive note:
  - **Not connected:** "Connect Meta" button → `getMetaConnectUrl()` → redirect; one line on why (campaigns can't go
    live until connected).
  - **Token, no selection** (post-callback redirect): **account + Page picker** (shadcn dialog/select) →
    `selectMetaAccount`.
  - **Connected:** show ad account + Page + green check + **Disconnect**.
- `ads.ts`: `getMetaConnectUrl`, `getMetaAccounts`, `selectMetaAccount`, `disconnectMeta`; extend the subscription
  payload (or a new `getMetaConnection`) with `{ adAccountId, pageId, connected }`.
- Admin: keep the manual **Connect** button as override/fallback; surface connection detail.

---

## Phase 3 — Refresh + revoke  (~1d)
- **Nightly refresh** in `SafeguardScheduler.tick`: `MetaConnectionRepository.listExpiring(now+7d)` →
  `MetaService.refreshToken` → re-`encryptToken` + store new expiry. On hard failure → `setAdsAccountConnected(false)`
  + notify + thread event (an expired connection can't keep a campaign live; ties to §9.6).
- **Deauthorize webhook** (1f) finalized + signature-verified (reuse `MetaWebhookService` HMAC helper).
- Data-deletion request handling (checklist §5) — clear stored Meta data on request.

---

## Cross-cutting
- **Flag:** `ADS_META_CONNECT_ENABLED` (default OFF). **Env:** `META_APP_ID`, `META_APP_SECRET`,
  `META_TOKEN_ENCRYPTION_KEY`, `META_OAUTH_STATE_SECRET`, `META_OAUTH_REDIRECT_URI` (+ existing
  `META_WEBHOOK_VERIFY_TOKEN`). Document in env.example.
- **Security:** least-privilege scopes (`ads_management`/`pages_manage_ads`, `ads_read`, `pages_show_list`,
  `pages_read_engagement`, `leads_retrieval`, `business_management`); encrypt tokens at rest; never log them;
  signed single-use `state`; HTTPS redirect URIs exact-match.
- **§9.6 wiring:** OAuth success (select step) DRIVES `ads_account_connected`; admin-flip becomes the fallback. The
  build-time gate logic is unchanged.
- **Verification per phase:** backend `npm run build` exit 0; FE `tsc --noEmit` 0-net-new (297 baseline); pure unit
  tests (1g); manual end-to-end with a **dev Meta App + test user** on staging.

## Effort
≈ **4–5.5 dev-days** (P1 ~2–3, P2 ~1–1.5, P3 ~1). Independent of the App-Review calendar time (external).

## Out of scope (separate Stage-4 builds)
Marketing-API **campaign push** (create Campaign→AdSet→Ads on the connected account) + **insights import**
(`syncInsights`); **Google** connect; **CAPI**; the **Meta App registration + App Review** itself (ops checklist).

## Parallel critical path (reminder)
**Create the dev Meta App + start Business verification NOW** (checklist §1–§2). The dev app unblocks Phase-1
verification; Business verification + App Review (weeks, external) gate the real-shop go-live, not the build.
