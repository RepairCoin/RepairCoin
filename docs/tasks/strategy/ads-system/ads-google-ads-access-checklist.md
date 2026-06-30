# Google Ads — Access Request Checklist (what to get from management)

**Date:** 2026-06-30
**Status:** Ops checklist (no code). Sibling to `ads-meta-app-review-checklist.md`.
**Why:** the Google Ads code is buildable now, but it needs a few accounts/credentials from whoever owns FixFlow's
Google org, plus two slow Google-reviewed approvals that gate real-shop go-live. This is the request list + tracker.
**See:** `ads-google-ads-implementation-plan.md` (Prerequisites box + `BE-0`), `ads-google-ads-scope.md` §3.

---

## TL;DR — one-line ask to send management
> "Please invite me to the Google Ads MCC (Admin/Standard) and the Google Cloud project, and send me the developer
> token + OAuth client ID/secret. Separately, can we kick off the Standard developer-token access request and OAuth app
> verification under `fixflow.ai` — those take a few weeks and gate going live."

---

## 1. Invites / access — so I can BUILD (self-serve, hours–days, no Google review)
- [ ] **Google Ads Manager account (MCC)** — invite my email with **Admin or Standard** access.
      *(Needed to open API Center for the developer token + create/link test accounts.)*
- [ ] **Google Cloud project** — either add me with a role that can create an **OAuth 2.0 Client** + edit the **OAuth
      consent screen** (Editor or scoped), **or** they create the OAuth client and hand me the credentials (§2).

## 2. Values to hand me
- [ ] **Developer token** (MCC → API Center) — the token string **+ confirm access level** (Test is fine to start;
      Standard is the go-live gate).
- [ ] **OAuth Client ID + Client Secret** — for the `https://www.googleapis.com/auth/adwords` scope.
- [ ] **MCC customer ID** (manager / login-customer-id) — needed if we operate via manager links (route B).
- [ ] **Redirect URI whitelisted** on the OAuth client (give them this to add — same gotcha as the Meta redirect URI):
      - staging: `https://api-staging.repaircoin.ai/api/ads/google/oauth/callback`
      - prod (later): `https://api.fixflow.ai/api/ads/google/oauth/callback`

→ With §1 + §2, **all six build slices are testable on a Google test account** (real API, no real spend).

## 3. Management must OWN — gates GO-LIVE (Google-reviewed, ~weeks, start now)
- [ ] **Developer token: Basic → Standard access** application — required to call **real** shop accounts.
- [ ] **OAuth consent-screen verification** — the `adwords` scope is sensitive → needs a **verified domain**, **privacy
      policy**, and **brand ownership** (i.e., `fixflow.ai`).
- [ ] **Business identity / billing** on the Google Cloud project + Ads account.
- [ ] Owner assigned for each of the above (these need a business owner, not the dev).

---

## Tracker
| Item | Owner | Status | Notes |
|---|---|---|---|
| MCC invite (Admin/Standard) | mgmt | ☐ pending | |
| Google Cloud project access | mgmt | ☐ pending | OR they create the OAuth client |
| Developer token (Test) | mgmt | ☐ pending | confirm access level |
| OAuth client ID + secret | mgmt | ☐ pending | `adwords` scope |
| Redirect URI whitelisted | mgmt/dev | ☐ pending | staging callback URL above |
| Test manager + test client | dev | ☐ pending | I can create once MCC access lands |
| Standard access application | mgmt | ☐ pending | long pole — start day one |
| OAuth consent verification | mgmt | ☐ pending | needs fixflow.ai domain + policy |

---

## Notes
- **Test account is enough to build/verify everything** in the plan — don't wait on §3 to start coding.
- Keep Google **dark** (`NEXT_PUBLIC_ADS_GOOGLE_ENABLED=off`, `ADS_GOOGLE_*=off`) until §3 clears; only then enable for real shops.
- The two §3 reviews can be **rejected/iterated** — start them at day one (parallel with the build) to avoid them becoming the critical path.
