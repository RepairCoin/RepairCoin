# Phase 0 Inventory — Domain Migration repaircoin.ai → fixflow.ai

**Generated:** 2026-04-21
**Scope:** complete codebase grep audit for `repaircoin.ai`, `repaircoin.com`, `repaircoin://`, and auth-storage surface area.
**Purpose:** ground-truth list for Phase 1 CORS PR and Phase 2 env-ification work.

---

## Summary Counts

| Category | Count | Notes |
|---|---|---|
| `repaircoin.ai` hits across code (excl. docs/node_modules) | ~32 | Split between env-var defaults, hardcoded URLs, CORS allowlist, comments |
| `repaircoin.com` hits across code (excl. docs/node_modules) | ~60+ | Predominantly support email addresses (`support@`, `security@`, etc.) in templates + UI + mailto links. A handful of hardcoded URLs. |
| `repaircoin://` deep-link emitters | **4** | All in backend, all Stripe payment return URLs |
| Frontend sitemap.xml / robots.txt | **None found** | No static files; no `next-sitemap` config; no dynamic route handlers generating them. **Nothing to migrate here** — SEO canonicals handled via `metadataBase` (see Frontend section) |
| Public/static files referencing the domain | 0 | `frontend/public` grep clean |

---

## Critical Finding — Auth storage is HYBRID (cookies + localStorage)

**This changes the previously-stated "localStorage-only" assumption in the strategy doc.**

**Backend** (`backend/src/routes/auth.ts:55,128,1383,1494,1585`):
- When `COOKIE_DOMAIN` env var is set (documented as `.repaircoin.ai` for production), JWT tokens are set as **httpOnly cookies scoped to `.repaircoin.ai`**
- When `COOKIE_DOMAIN` is empty, tokens fall through to a flow where frontend stores in localStorage
- Cookie domain behavior is documented in `docs/deployment/SUBDOMAIN_ENV_VARS.md` and `docs/authentication/SUBDOMAIN_COOKIE_SETUP.md`

**Frontend** (`frontend/src/hooks/useAuthInitializer.ts`, `frontend/src/stores/authStore.ts`, etc.):
- localStorage fallback exists (`authToken`, `customerAuthToken`, `shopAuthToken`, `adminAuthToken`)
- Hybrid pattern supports both modes

**Operator action needed:** confirm whether production has `COOKIE_DOMAIN=.repaircoin.ai` set in DO App Platform env vars. Two scenarios:

1. **COOKIE_DOMAIN is set (cookies active in prod):** at cutover, cookies scoped to `.repaircoin.ai` won't transmit to `www.fixflow.ai` → users log in again. Same user-visible effect as localStorage-only. Plan: after cutover, also set `COOKIE_DOMAIN=.fixflow.ai` in backend production env so going-forward sessions bind to the new domain.
2. **COOKIE_DOMAIN is empty (localStorage active in prod):** users log in again because localStorage is origin-scoped. No backend change needed at cutover.

Either way, the migration plan's "web users log in again" statement stays correct. But Phase 3 runbook should add a **conditional step**: if COOKIE_DOMAIN is set in prod, flip it from `.repaircoin.ai` to `.fixflow.ai` at the cutover moment (same as flipping `NEXT_PUBLIC_API_URL`).

**Mobile is unaffected either way** — mobile uses SecureStore (device-scoped), not cookies or localStorage.

---

## Phase 1 CORS PR Input — exact edit location

**File:** `backend/src/app.ts`
**Lines:** 210–230 (existing allowlist array)
**Current entries to keep:**
- `https://repaircoin.ai`
- `https://www.repaircoin.ai`
- `https://api.repaircoin.ai`
- `https://staging.repaircoin.ai`
- `https://api-staging.repaircoin.ai`

**New entries to add (purely additive):**
- `https://fixflow.ai`
- `https://www.fixflow.ai`
- `https://api.fixflow.ai`
- `https://staging.fixflow.ai`
- `https://api-staging.fixflow.ai`

**Merge safety:** fully backward-compatible. Adding origins to allowlist is a no-op until traffic comes from them. **Safe to merge before DNS.**

---

## Phase 2 Env-ification Targets

### Backend — hardcoded URLs to env-ify

| File | Line | Current value | Proposed env var (default) | Phase |
|---|---|---|---|---|
| `backend/src/config/index.ts` | 47 | `'mailto:hello@repaircoin.ai'` | `VAPID_SUBJECT` (env var exists; just update default to `'mailto:hello@repaircoin.ai'` for now; Phase 3 flips to fixflow) | 2 |
| `backend/src/services/MarketingService.ts` | 457 | `process.env.FRONTEND_URL \|\| 'https://repaircoin.ai'` | keep `FRONTEND_URL` env var; flip default in Phase 3 | 2 |
| `backend/src/services/MarketingService.ts` | 459 | `'https://repaircoin.ai/img/landing/repaircoin-icon.png'` | `PUBLIC_APP_URL` or interpolate from `FRONTEND_URL` | 2 |
| `backend/src/services/MarketingService.ts` | 528 | same as line 457 | same | 2 |
| `backend/src/domains/admin/routes/settings.ts` | 53 | `'support@repaircoin.ai'` default | `SUPPORT_EMAIL` env var | 2 |
| `backend/src/domains/admin/routes/emailTemplates.ts` | 161 | `'https://repaircoin.ai/reset-password?token=abc123'` (example preview) | `PUBLIC_APP_URL` interpolation | 2 |
| `backend/src/docs/swagger.ts` | 42–56 | hardcoded `support@repaircoin.ai`, `https://repaircoin.ai`, `https://api.repaircoin.ai` | env-derived (not user-facing; Phase 3 flip acceptable) | 2/3 |
| `backend/src/scripts/generate-vapid-keys.ts` | 10 | prints `VAPID_SUBJECT=mailto:hello@repaircoin.ai` | update print string (scripts only; low priority) | 2 low |

### Backend — deep-link scheme (already scoped in strategy doc Phase 2)

| File | Line | Current | Proposed |
|---|---|---|---|
| `backend/src/domains/ServiceDomain/services/PaymentService.ts` | 491 | `` `repaircoin://shared/payment-sucess?...` `` | `` `${MOBILE_DEEP_LINK_SCHEME \|\| 'repaircoin'}://shared/...` `` |
| `backend/src/domains/ServiceDomain/services/PaymentService.ts` | 492 | `` `repaircoin://shared/payment-cancel?...` `` | same pattern |
| `backend/src/domains/shop/routes/purchase.ts` | 461 | `` `repaircoin://shared/payment-sucess?...` `` | same pattern |
| `backend/src/domains/shop/routes/purchase.ts` | 462 | `` `repaircoin://shared/payment-cancel?...` `` | same pattern |

### Frontend — hardcoded URLs to env-ify

| File | Line | Current value | Proposed |
|---|---|---|---|
| `frontend/src/app/layout.tsx` | 34 | `new URL('https://www.repaircoin.ai')` | `new URL(process.env.NEXT_PUBLIC_APP_URL \|\| 'https://www.repaircoin.ai')` |
| `frontend/src/app/waitlist/[source]/page.tsx` | 25, 29, 41 | `'https://www.repaircoin.ai/...'` | `${NEXT_PUBLIC_APP_URL}/...` |
| `frontend/src/app/waitlist/layout.tsx` | 12, 16, 29 | `'https://www.repaircoin.ai/...'` | `${NEXT_PUBLIC_APP_URL}/...` |
| `frontend/src/app/contact-us/page.tsx` | 38 | `href="https://repaircoin.ai"` | `href={NEXT_PUBLIC_APP_URL}` |
| `frontend/src/app/contact-us/page.tsx` | 49 | displays text `"repaircoin.ai"` | computed from env or a new `NEXT_PUBLIC_BRAND_DOMAIN` label var |
| `frontend/src/app/(public)/services/[serviceId]/page.tsx` | 46 | `process.env.NEXT_PUBLIC_APP_URL \|\| 'https://repaircoin.ai'` | **already env-var'd** — only the fallback default needs updating in Phase 3 |
| `frontend/src/middleware.ts` | 80–81 | comment only | update comment to mention `.fixflow.ai` alongside, or drop domain-specific language |

### Mobile — eas.json profile additions (non-destructive)

| File | Existing profile | Existing value | Action |
|---|---|---|---|
| `mobile/eas.json` | `tester.env.EXPO_PUBLIC_API_URL` | `https://api-staging.repaircoin.ai/api` | Add new profile `tester-fixflow` (or similar) pointing to `https://api-staging.fixflow.ai/api`, OR simply update in Phase 4 when rebuilding. Existing profile stays. |
| `mobile/eas.json` | `preview.env.EXPO_PUBLIC_API_URL` | `https://api-staging.repaircoin.ai/api` | same |
| `mobile/eas.json` | `production.env.EXPO_PUBLIC_API_URL` | `https://api.repaircoin.ai/api` | same — change in Phase 4 rebuild |
| `mobile/eas.json` | `production-apk.env.EXPO_PUBLIC_API_URL` | `https://api.repaircoin.ai/api` | same |
| `mobile/app.config.ts` | 14 | `scheme: "repaircoin"` | Phase 4: change to `scheme: ["repaircoin", "fixflow"]` |

---

## Phase 5 (Email Brand) Follow-up — `repaircoin.com` references

These are all "email-brand" references (support email addresses, FROM domain, mailto links). **Not in Phase 2 scope per earlier decision — keep email FROM as `noreply@repaircoin.com` during web cutover.**

### Template body text (backend)

| File | Lines | Nature |
|---|---|---|
| `backend/src/services/EmailService.ts` | 139, 251, 297, 343, 397, 443, 485, 533, 592, 638, 682, 731, 1052, 1112, 1236, 1317, 1403, 1596, 1673, 1779 | `support@repaircoin.com` footer strings; `noreply@repaircoin.com` FROM default; hardcoded `https://repaircoin.com` in 1673 and FRONTEND_URL default `https://repaircoin.com` in 1779 |
| `backend/src/domains/shop/routes/webhooks.ts` | 789, 906 | `support@repaircoin.com` in receipt emails |
| `backend/src/services/SubscriptionReminderService.ts` | 204 | `support@repaircoin.com` in subscription reminders |

### UI — support email mailto links

| File | Lines | Nature |
|---|---|---|
| `frontend/src/components/shop/SuspendedShopModal.tsx` | 309–310, 384–387 | mailto:support@repaircoin.com |
| `frontend/src/components/shop/ShopFAQSection.tsx` | 140 | same |
| `frontend/src/components/shop/CancelledSubscriptionModal.tsx` | 137, 140 | same |
| `frontend/src/components/shop/RCGPurchaseModal.tsx` | 60 | mailto:rcg-sales@repaircoin.com |
| `frontend/src/app/(authenticated)/shop/rcg-otc/page.tsx` | 92 | mailto:treasury@repaircoin.com |
| `frontend/src/components/customer/BookingDetailsModal.tsx` | 280, 434 | `www.repaircoin.com` in printed receipt PDF |
| `mobile/feature/register/screens/ShopSuspendedScreen.tsx` | 84 | support@repaircoin.com |
| `mobile/feature/register/screens/PendingApprovalScreen.tsx` | 55 | same |
| `mobile/app/(dashboard)/shop/purchase-cancelled.tsx` | 89 | same |
| `mobile/feature/reward-token/components/CustomerWarning.tsx` | 12 | `https://repaircoin.com/download` link |

### Tests

| File | Lines | Nature |
|---|---|---|
| `backend/tests/subscription/*.test.ts` | (3 files, 1 line each) | `admin@repaircoin.com` test credentials. Non-production. |

---

## Mobile Deep-Link Scheme — verified

Grep for `repaircoin://` returns exactly **4 emitters** (all backend), confirming the earlier finding:

- `backend/src/domains/ServiceDomain/services/PaymentService.ts:491` — Stripe success URL for service-order payment
- `backend/src/domains/ServiceDomain/services/PaymentService.ts:492` — Stripe cancel URL for service-order payment
- `backend/src/domains/shop/routes/purchase.ts:461` — Stripe success URL for shop RCN purchase
- `backend/src/domains/shop/routes/purchase.ts:462` — Stripe cancel URL for shop RCN purchase

Mobile declares `scheme: "repaircoin"` at `mobile/app.config.ts:14`.

**No other emitters found** in mobile or frontend. Safe to env-ify the 4 backend emitters in Phase 2.

---

## Confirmations Checklist

- [x] Deep-link emitters inventoried — exactly 4, all backend
- [x] Mobile eas.json profiles captured — 4 build profiles (tester, preview, production, production-apk)
- [x] Frontend sitemap.xml / robots.txt — **do not exist** in frontend/public; no dynamic generation found. Nothing to migrate for SEO sitemaps.
- [x] Email templates use `FRONTEND_URL` env var fallback in most places; footers have hardcoded `support@repaircoin.com` and `support@repaircoin.ai` (split across templates). **Only the `.ai` instances need Phase 2 action; `.com` deferred to Phase 5.**
- [!] Web auth storage: **NOT localStorage-only** — hybrid with httpOnly cookies scoped to `.repaircoin.ai` when `COOKIE_DOMAIN` is set. **Operator must confirm prod env setting.** Migration plan's "users log in again at cutover" conclusion stays correct regardless.

---

## Updates to Strategy Doc Required

Based on this inventory, the strategy doc needs two updates:

1. **Phase 0 Engineer inventory section** — mark completed, link to this file.
2. **Phase 3 Cutover runbook** — add a **conditional step**: if prod has `COOKIE_DOMAIN=.repaircoin.ai`, flip it to `.fixflow.ai` at the cutover moment (alongside `NEXT_PUBLIC_API_URL` flip and Vercel primary-domain swap). Without this flip, going-forward sessions on `www.fixflow.ai` will not set the cookie correctly.
3. **Risk Matrix** — upgrade the "Cookies scoped to .repaircoin.ai" row from "N/A if using localStorage" to a real mitigation describing the COOKIE_DOMAIN flip.

I'll apply these updates to the strategy doc as a follow-up step.

---

## Next Actions

**Engineer — ready to proceed with:**
1. **Phase 1 CORS PR** — clear input: `backend/src/app.ts:225–230` + add 5 new origin lines. Already staged as Phase 1 engineer work.
2. **Phase 2 Backend env-ification PR** — 8 hardcoded URL sites + 4 deep-link sites. All backward-compatible (defaults preserved).
3. **Phase 2 Frontend env-ification PR** — 6 sites, all in `frontend/src/app/`. OG metadata + canonical URL + brand text.
4. **Strategy doc updates** per "Updates to Strategy Doc Required" above.

**Operator — needs to confirm:**
1. Is `COOKIE_DOMAIN` set in DO production env vars? If yes, value is `.repaircoin.ai`? This determines whether Phase 3 requires a conditional COOKIE_DOMAIN flip step.
2. DO App Platform production instance count (relates to deploy-gap analysis).
3. External systems inventory (Stripe webhooks, Google OAuth redirect URIs, Thirdweb allowed origins, Play/App Store listing URLs).
