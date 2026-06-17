# Scope — Shop-side "Connect Meta" flow

**Date:** 2026-06-16
**Status:** Scope (no code; standing rule — don't build/commit until told).
**Why:** lifecycle §9.6 requires a campaign's shop to have its **ad account connected** before going live. Today
that's an **admin-flipped boolean** (`shops.ads_account_connected`) — a stopgap. This scopes the **real shop-side
self-serve connection**: the shop authorizes FixFlow to run ads on **its own Meta ad account** (Model A — shop pays
its own spend; FixFlow operates + charges the flat fee). Closes audit gap #5 (no shop-side connect affordance).
**Relationship:** this is the *connect/authorize/token-store* slice of **Stage 4**. It deliberately stops short of
**pushing campaigns** to Meta and **importing insights** (separate Stage-4 builds). See
`ads-relationship-lifecycle-design.md` §9.6 + §7, and [[project-ads-system-state]].

---

## 1. Operating model (recap — frames the whole flow)
- The campaign runs on the **shop's own Meta ad account**, funded by the **shop's own card on Meta**. FixFlow never
  touches ad-spend money; it **operates** the account on the shop's behalf and bills only the flat management fee.
- So "connect" = the shop **grants FixFlow permission** to manage their ad account + Page. Two real mechanisms:
  - **(A) Facebook Login OAuth (in-app)** — shop clicks Connect → Facebook consent dialog → we receive a token and
    operate via the Marketing/Graph API. *Recommended* (self-serve, revocable, fits the dashboard).
  - **(B) Business Manager partner access (manual)** — shop adds FixFlow's Business as a partner and assigns the ad
    account + Page. No token; we operate from our own Business. Good as a fallback / enterprise path.
- **This scope builds (A)**, with (B) as a documented manual fallback the admin-flip already supports.

---

## 2. What already exists (don't rebuild)
- `MetaService.isConfigured()` + `getAuthorizationUrl(redirectUri, state)` — **real** (build the OAuth dialog URL).
  `exchangeCodeForToken` / `refreshToken` / `fetchLeadFields` / `syncInsights` — **stubs that throw** until a Meta App exists.
- Migration **148**: `shops.meta_oauth_token / meta_oauth_refresh_token / meta_oauth_expires_at` (TEXT/timestamptz).
- Migration **161**: `shops.ads_account_connected BOOLEAN` + `BillingPlanRepository.isAdsAccountConnected` /
  `setAdsAccountConnected`; **§9.6 gate** in `buildCampaignFromRequest` already blocks build when false.
- Admin override: `POST /ads/shops/:shopId/ads-account {connected}` (the manual flag + thread event).
- `getMySubscription` already returns `adsAccountConnected`; `SubscriptionPanel` shows a passive "not connected" note.
- Meta **webhook receiver** (`/ads/webhooks/meta/leads`) + signature verify — built/tested (lead delivery, not connect).

---

## 3. Hard external dependency (state it up front)
OAuth with `ads_*` / `pages_*` / `leads_retrieval` scopes **only works for non-dev users after Meta App Review +
Business verification**. So:
- **Buildable + testable now** against a **dev-mode Meta App** with **test users / app admins** (real end-to-end flow).
- **Go-live for real shops** is gated on **App Review** (the long pole). The flow ships behind a flag and degrades to
  the **admin-flip** until the app is approved. Build the App-Review checklist in parallel (separate doc).

---

## 4. Connection flow (the handshake)
1. **Start** — shop clicks **Connect Meta** in the Ads tab → `GET /ads/shop/meta/connect` returns the auth URL
   (`getAuthorizationUrl`) with a **signed `state`** = `{shopId, nonce}` (HMAC; CSRF + binds callback to the shop).
2. **Consent** — shop authorizes on Facebook → redirected to our **callback** with `code` + `state`.
3. **Callback** — `GET /ads/meta/oauth/callback`: verify `state` (reject mismatch/expired), `exchangeCodeForToken`
   → **long-lived user token**; store `meta_oauth_token` (+ refresh/expiry) **encrypted at rest** (app-layer; columns
   are TEXT). Do **not** yet set connected — we still need an ad account + Page (step 4).
4. **Select account + Page** — fetch the user's **ad accounts** (`/me/adaccounts`) + **Pages** (`/me/accounts`); shop
   picks **one ad account + one Page** to run ads through. Store the selections; capture the **Page access token**.
   **Only now** set `ads_account_connected = true` + post a thread event ("Ad account connected").
5. **Disconnect** — `POST /ads/shop/meta/disconnect`: clear tokens/selection, set `ads_account_connected = false`,
   thread event. (Also handle Meta's **deauthorize / data-deletion** callback to clear server-side.)

---

## 5. Data model
New columns on `shops` (migration **next-free — verify live `schema_migrations`; 161 was the last ads one**):
- `meta_ad_account_id TEXT` — the selected `act_<id>` to create campaigns under.
- `meta_page_id TEXT` + `meta_page_token TEXT` (encrypted) — the Page for lead ads / messaging.
- `meta_business_id TEXT` (optional — for partner-access bookkeeping).
- *(Reuse 148's `meta_oauth_*` for the user token; reuse 161's `ads_account_connected` as the derived gate flag.)*

Token handling: **encrypt** `meta_oauth_token` / `meta_page_token` (app-layer, e.g. the existing crypto util / a
`Encryptor`); store least-privilege only. Prefer a **Business system-user token** (non-expiring) over a 60-day user
token if we go the Business route — note as an option in §8.

---

## 6. Backend endpoints (all shop = JWT shopId, except the public callback)
- `GET  /ads/shop/meta/connect` → `{ authUrl }` (signed state).
- `GET  /ads/meta/oauth/callback` → verify state → exchange → store token → redirect back to the Ads tab (account picker).
- `GET  /ads/shop/meta/accounts` → `{ adAccounts[], pages[] }` (post-token, for the picker).
- `POST /ads/shop/meta/select { adAccountId, pageId }` → store + set `ads_account_connected=true` + thread event.
- `POST /ads/shop/meta/disconnect` → clear + set false + thread event.
- `POST /ads/webhooks/meta/deauthorize` (public, signed) → handle user-initiated revoke.
Implement the real bodies of `MetaService.exchangeCodeForToken` / `refreshToken` + a `listAdAccounts` / `listPages`.

---

## 7. Frontend (shop)
- Replace the passive note in `SubscriptionPanel` (or a dedicated card in `ShopAdsTab`) with a **Connect Meta** state:
  - **Not connected:** "Connect Meta" button (→ `/connect` URL) + one line on why (campaigns can't go live until connected).
  - **Token but no selection:** **account + Page picker** (modal/inline) after the callback redirect.
  - **Connected:** show the connected **ad account + Page**, a **Disconnect** button, and a green check.
- Use shadcn components (dialog/select/button) per the repo UI rule.
- Admin side: the existing manual **Connect** button stays as override/fallback; admin can also see connection status.

---

## 8. Security & lifecycle wiring
- **CSRF:** signed, short-TTL `state`; verify shop match on callback. **Scopes:** least-privilege
  (`ads_management`/`pages_manage_ads`, `ads_read`, `pages_show_list`, `pages_read_engagement`, `leads_retrieval`,
  `business_management`). **At rest:** encrypt tokens.
- **Token refresh:** nightly in `SafeguardScheduler.tick` — refresh tokens nearing `meta_oauth_expires_at`
  (`MetaService.refreshToken`); on hard failure → set `ads_account_connected=false` + notify + thread event (a
  disconnected account can't keep a campaign live; ties to §9.6 + dunning-adjacent handling).
- **§9.6:** OAuth success (step 4) **drives** `ads_account_connected` — the gate becomes real, the admin-flip becomes
  a fallback. No change to the build-time gate logic itself.

---

## 9. Out of scope (explicitly)
- **Pushing campaigns** to Meta (Marketing API create Campaign→AdSet→Ads) and **insights import** (`syncInsights`)
  — separate Stage-4 builds; this scope only makes the *connection* real so those can run later.
- **Google "Connect"** (Google Ads API + OAuth + MCC link) — same shape, separate channel (Business tier), later.
- **CAPI / Conversions** (148 reserved columns) — design-only.
- The **Meta App registration + App Review** itself — external, parallel checklist (separate doc).

---

## 10. Effort & phasing
- **Phase 1 — backend connect:** state/connect/callback/select/disconnect endpoints + real `exchangeCodeForToken` +
  `listAdAccounts`/`listPages` + token storage/encryption + migration. ~2–3d (dev-app testable).
- **Phase 2 — shop UI:** Connect button + account/Page picker + connected/disconnect states. ~1–1.5d.
- **Phase 3 — refresh + revoke:** nightly refresh + deauthorize webhook + failure→disconnect. ~1d.
- **Gate to go-live:** Meta **App Review + Business verification** (external; weeks). Until then, flag-off → admin-flip.

**Verification:** backend tsc 0 / FE tsc 0-net-new (297 baseline); unit-test the pure bits (state sign/verify,
scope string, account-pick validation); manual end-to-end with a **dev Meta App + test user** on staging.

---

## 11. Decisions needed before building
1. **Mechanism:** Facebook Login OAuth in-app (A, recommended) vs manual Business-Manager partner access (B)?
2. **Token type:** 60-day **user token + refresh**, or pursue a **Business system-user token** (non-expiring, needs
   the shop in / partnered to a Business)?
3. **Account/Page selection in-app** (recommended) vs assume one ad account + one Page per shop?
4. **Encryption util** to standardize on for tokens at rest.
