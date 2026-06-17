# Checklist — Meta App registration & App Review (Ads System go-live)

**Date:** 2026-06-16
**Status:** Ops/external checklist — runs **in parallel** with the build. Not code.
**Why:** the shop-side "Connect Meta" flow (`ads-connect-meta-shop-flow-scope.md`) is buildable now against a
**dev-mode** Meta App, but real shops can only connect after **Business verification + App Review** of the ad/page
scopes. This is the long pole. Track it here so the external dependency starts early.
**Owner:** needs a business owner (Meta Business assets + verification + legal pages) + an engineer (app config,
callbacks, screencast). See [[project-ads-system-state]].

---

## 0. The dependency in one line
Engineering can build & test the whole connect flow with **app admins / test users** while the app is in **dev mode**.
**No real shop can connect until the app is Live AND the requested permissions have Advanced Access (App Review).**
Until then the lifecycle degrades to the **admin-flip** (`ads_account_connected`), so nothing is blocked — just not self-serve.

---

## 1. Prerequisites (business assets — gather first)
- [ ] A **Meta Business Account** (business.facebook.com) for FixFlow/RepairCoin.
- [ ] A **Facebook Page** for the brand (App Review reviewers check the business is real).
- [ ] **Business verification** documents ready: legal business name, address, phone, and a verification doc
      (incorporation / utility / tax) + a domain you control. *(Verification can take days–weeks — start NOW.)*
- [ ] A **verified domain** (DNS/meta-tag) for the app.
- [ ] Legal pages **publicly live** (see §5): Privacy Policy URL + Terms URL.

---

## 2. Create & configure the app (developers.facebook.com)
- [ ] Create app → type **Business**. Attach it to the FixFlow **Business Account**.
- [ ] Note **App ID** + **App Secret** → set as `META_APP_ID` / `META_APP_SECRET` (the build reads these via
      `MetaService.isConfigured`). Keep the secret out of git.
- [ ] Add products: **Facebook Login for Business**, **Marketing API**, **Webhooks**, (**Lead Ads** via Webhooks).
- [ ] **Facebook Login settings:**
  - [ ] **Valid OAuth Redirect URIs** = our callback(s): staging + prod (`…/api/ads/meta/oauth/callback`).
  - [ ] Client OAuth Login + Web OAuth Login ON; enforce HTTPS.
- [ ] **App Domains** = our domains; set the Privacy Policy / Terms / data-deletion URLs (§5).
- [ ] Configure a **Facebook Login for Business configuration** with the exact scope set (§3) → reference its
      `config_id` from the auth URL.

---

## 3. Permissions / scopes matrix
For each: why we need it, and whether it needs **Advanced Access** (App Review) for use beyond app admins/testers.

| Permission | Why FixFlow needs it | Access tier |
|---|---|---|
| `business_management` | Read the shop's Business; operate ad account/Page on their behalf | **Advanced (review)** |
| `ads_management` | Create/manage campaigns on the shop's ad account (Stage-4 push) | **Advanced (review)** |
| `ads_read` | Read campaign insights (spend/impressions) for ROI | **Advanced (review)** |
| `pages_show_list` | List the shop's Pages so they can pick one | **Advanced (review)** |
| `pages_read_engagement` | Read Page metadata for lead ads | **Advanced (review)** |
| `pages_manage_ads` | Run ads tied to the Page | **Advanced (review)** |
| `leads_retrieval` | Pull lead-ad form submissions (the lead pipeline) | **Advanced (review)** |

> Standard Access (no review) only covers **app admins/devs/testers** — enough to **build & demo**, not to onboard
> real shops. Request **Advanced Access** for each above in App Review.

---

## 4. Webhooks (Lead Ads)
- [ ] Subscribe the app to the **`leadgen`** webhook field (Page subscription).
- [ ] **Callback URL** = `…/api/ads/webhooks/meta/leads` (the **receiver is already built + signature-verified**).
- [ ] **Verify token** = set `META_WEBHOOK_VERIFY_TOKEN` (the GET handshake checks it).
- [ ] Confirm the POST signature uses the App Secret (`X-Hub-Signature-256`) — already validated in code.

---

## 5. Required URLs / callbacks (must be live & reachable)
- [ ] **Privacy Policy URL** — public; describes Meta data use + retention.
- [ ] **Terms of Service URL** — public.
- [ ] **Data Deletion** — either a **Data Deletion Request URL** or callback that erases a user's stored Meta data on request.
- [ ] **Deauthorize callback URL** — when a user removes the app, clear their token + set `ads_account_connected=false`
      (scope §8 / endpoint `/api/ads/webhooks/meta/deauthorize`).
- [ ] All redirect URIs HTTPS and **exactly** matching what the backend sends.

---

## 6. App Review submission package (per permission)
For each Advanced-Access permission, Meta wants:
- [ ] A **clear use-case description**: *"FixFlow is an agency dashboard; shops connect their own Meta ad account so
      FixFlow staff can create/manage ad campaigns and retrieve leads on the shop's behalf. The shop funds spend on
      their own account."*
- [ ] A **screencast** showing the real flow end-to-end: log in as a (test) shop → click **Connect Meta** → Facebook
      consent → pick ad account + Page → connected state → (for ads_* ) a campaign action / insights view → leads view.
- [ ] **Step-by-step reviewer instructions** + **test credentials** (a test shop login on staging) so a reviewer can reproduce.
- [ ] Confirm the screencast scopes shown **match** the permissions requested (mismatch = rejection).
- [ ] **Business verification COMPLETE** before/with submission (ad permissions require it).

---

## 7. Tokens
- [ ] Decide token strategy (open decision in the scope §11):
  - **User long-lived token (~60d) + refresh** — simplest; nightly refresh job before `meta_oauth_expires_at`.
  - **Business system-user token (non-expiring)** — sturdier for an agency; needs the shop in/partnered to a Business.
- [ ] Use the **Access Token Debugger** to confirm scopes/expiry during testing.
- [ ] Store encrypted at rest (scope §5/§8).

---

## 8. Dev / test path (unblocks engineering NOW — no review needed)
- [ ] Keep the app in **Development mode**.
- [ ] Add engineers as **app Admins/Developers**; create **Test Users** (or use real test shop accounts that are app roles).
- [ ] Standard Access works for these roles → the **entire connect flow + token store + account pick** is testable on staging.
- [ ] Build the App-Review screencast from this same working flow.

---

## 9. Common rejection reasons (avoid up front)
- Privacy policy / data-deletion **not reachable** or doesn't mention Meta data.
- Screencast **doesn't show** the permission actually being used, or shows different scopes than requested.
- **Business not verified** when requesting ads permissions.
- Reviewer **can't reproduce** (bad/missing test creds or instructions).
- Requesting **more scopes than the demo justifies** — request only §3.
- Redirect URI / domain mismatch.

---

## 10. Timeline, ownership, go-live gate
- **Start immediately (parallel to build):** create app, **Business verification** (slowest), legal pages.
- **Engineering:** app config + callbacks + the connect flow (dev-mode testable) → produces the screencast.
- **Submit App Review** once verification is done + flow demoable. Review = days→weeks, may need resubmits.
- **Go-live gate:** App **Live** + all §3 perms at **Advanced Access** → flip the connect flag on; real shops self-serve.
  Until then: **admin-flip fallback** keeps the lifecycle working.

---

## 11. Quick status board
- [ ] Meta Business Account created
- [ ] Business verification submitted / **approved**
- [ ] App created; `META_APP_ID`/`META_APP_SECRET` set (staging)
- [ ] FB Login config + redirect URIs set
- [ ] Privacy / Terms / Data-deletion / Deauthorize URLs live
- [ ] Webhook `leadgen` subscribed + `META_WEBHOOK_VERIFY_TOKEN` set
- [ ] Connect flow working in **dev mode** (test users) on staging
- [ ] Screencast + reviewer instructions + test creds prepared
- [ ] App Review submitted (§3 perms)
- [ ] App Review **approved** → app **Live**
- [ ] Connect flag flipped on (go-live)
