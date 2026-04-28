# Strategy: Domain Migration — repaircoin.ai → fixflow.ai

## Date: 2026-04-21
## Category: DevOps / Domain Strategy
## Status: Planning

---

## Goal

- **fixflow.ai** becomes the primary public domain for the RepairCoin platform.
- **repaircoin.ai** remains live and 301-redirects to fixflow.ai — preserves SEO, existing bookmarks, old email links, and any external references.
- Minimal user-visible downtime during the transition. No hard DNS cutover; both domains serve the same application in parallel before priority flips.
- Existing mobile app binaries continue working against `api.repaircoin.ai` until they naturally age out.

---

## Current State Snapshot (READ THIS FIRST)

**Last updated:** 2026-04-28 by engineer session.

**Cutover target:** TBD — original 2026-04-26 missed due to fixflow.ai DNS + Google Cloud Console blockers. Pending owner approval of new date once `app.fixflow.ai` confirmation lands.

**Strategy locked in (2026-04-28):** keep nameservers at Hostinger, edit records there directly, preserve Google Workspace email + `app.fixflow.ai` SaaS subdomain. See "What happened in this session (2026-04-28)" below for the precise edit list.

### Where we are

| Phase | Engineer side | Operator side |
|---|---|---|
| Phase 0 — Planning & Prep | **Engineer inventory complete** → `docs/tasks/strategy/phase-0-inventory.md`. **OAuth integrations verified end-to-end on staging AND prod (Calendar + Gmail) — three Gmail bugs found and fixed in 2026-04-28 session, see sections 7-8 below.** | **Inventory complete (2026-04-28).** All previously-blocked items now answered: marketing page = placeholder/expendable; Hostinger access available; Google Workspace email at @fixflow.ai (MUST preserve); subdomain recon done (app.fixflow.ai in use → preserve; fix/funnel/info effectively dead). DNS strategy locked: keep nameservers at Hostinger, edit records there. **Zeff Google Cloud Console blocker bypassed** — new `fixflow-project` Cloud project, OAuth clients live, staging + prod env vars updated. **Still pending:** Play/App Store access; cutover date selection. |
| Phase 1 — Parallel Infra | **Engineer side DONE.** CORS allowlist applied to `backend/src/app.ts` (fully additive; safe to deploy without DNS). OAuth callback flow refactored for Gmail (GET handler added, frontend redirect fixed). All shipped to prod 2026-04-28 — see `staging-to-production-deployment.md`. | **READY to pre-stage now.** Plan: edit records at Hostinger (not nameserver swap). Hostinger zone exported and analyzed; precise edit list documented in 2026-04-28 session notes. Vercel TXT verification + DO domain add can run today without traffic impact. |
| Phase 2 — Codebase Prep | **Engineer side DONE (backward-compatible).** Deep-link scheme env-ified (4 backend emitters). Frontend metadataBase + OG URLs env-ified. Backend hardcoded URLs (MarketingService logo, admin settings supportEmail, email-template preview reset link, swagger contact + production server URL) env-ified. Mobile eas.json changes deferred to Phase 4 rebuild. | Nothing until Phase 1 completes. |
| Phase 3 — Cutover | Not started. Gated by Phase 1 + Phase 2 verification. | Gated by Phase 1 + Phase 2. |
| Phase 4 — Mobile Rebuild | Not started. Post-cutover (not on critical path). | Post-cutover. |
| Phase 5 — Soak & Cleanup | Not started. | Not started. |

### What happened in this session (2026-04-21)

1. Strategy doc drafted with Phases 0–5, risk matrix, decision log, runbook.
2. Infrastructure state verified via operator screenshots: Vercel Pro, single `repair-coin` project with branch-per-subdomain routing, fixflow.ai in same GoDaddy account.
3. Operator decisions captured: cutover evening PH / 2026-04-26 / keep `noreply@repaircoin.com` during cutover / migrate staging in parallel (recommended, not yet confirmed).
4. Mobile deep-link scheme investigated — **corrected a prior wrong conclusion.** Found `scheme: "repaircoin"` in `mobile/app.config.ts:14` AND 4 backend emitters of `repaircoin://` (Stripe return URLs). Plan updated: Phase 2 env-ify, Phase 4 mobile registers both schemes via array.
5. GoDaddy access revoked mid-session — operator awaiting owner re-approval. This partially gates Phase 0 + Phase 1.
6. **Phase 0 Engineer inventory completed** → `docs/tasks/strategy/phase-0-inventory.md`. **New finding: auth is hybrid cookie + localStorage**, not localStorage-only. Phase 3 now has a conditional Step 3.2a to flip `COOKIE_DOMAIN` env var if set in prod.
7. **Phase 1 Engineer CORS allowlist applied + Phase 2 Engineer env-ification applied** (see next section for the exact file-level changes).

### What happened in this session (2026-04-22, continued)

**New blocker surfaced — fixflow.ai not ready for DNS records yet:**

1. **GoDaddy access restored.** Operator completed Phase 0 Step 1 — TTL lowered to 600s (GoDaddy minimum) on all 4 migration-critical CNAMEs at repaircoin.ai: `www`, `api`, `staging`, `api-staging`. The `A @` record was already at 600s. Propagation completes by ~2026-04-23 mid-day.
2. **Phase 0 Step 2 — fixflow.ai domain verification surfaced two blockers:**
   - **DNS delegated to Hostinger, not GoDaddy.** GoDaddy DNS tab shows `DNS Provider: Hostinger — This domain's DNS is managed outside GoDaddy`. Adding records at GoDaddy has no effect; nameserver change or Hostinger access is required.
   - **fixflow.ai currently serves a live FixFlow marketing/lead-gen landing page** hosted at Hostinger (screenshot: "Built by Business Owners for Business Owners - Start Your 14-Day Free Trial"). Any DNS change that points fixflow.ai at Vercel/RepairCoin will replace this marketing site.
3. **Awaiting owner confirmation before proceeding:**
   - Is the current fixflow.ai marketing page a pre-launch placeholder (replace freely) OR content to preserve (needs subdomain relocation plan)?
   - Does the team have Hostinger account access? (Determines Option A nameserver swap vs Option B edit at Hostinger.)
   - Is any email configured on `@fixflow.ai` currently? (Need to preserve MX records if so.)
4. **Recommended path (pending owner answer):** if the marketing page is a placeholder AND team has Hostinger access, edit records AT Hostinger directly (zero-downtime transition, one provider per domain is a minor housekeeping concern we can consolidate later). If Hostinger access is unavailable, switch nameservers to GoDaddy — introduces a 1–24h propagation window during which fixflow.ai returns DNS errors.
5. **DO NOT touch fixflow.ai DNS or nameservers until owner confirms.** The current live site would go down immediately on any DNS change.

### Paused — waiting on owner

Phase 1 (parallel infrastructure) is **paused** pending the 3 owner answers above. Resume point:
- Once answered, pick up at **Phase 1 Step A1** if Option A (nameserver switch to GoDaddy)
- OR at **an equivalent "add records at Hostinger" sub-flow** if Option B (keep nameservers at Hostinger)

TTL propagation on repaircoin.ai (Phase 0 Step 1) continues in the background — completes 2026-04-23 regardless of the pause.

### Google Cloud Console access — second blocker (2026-04-22 afternoon)

**Operator has Google Cloud Console access, but to the WRONG project.**

- Operator's Google account has access to project `nifty-stage-491303-n3` ("My First Project") which holds a **dev-only** OAuth Client ID `389596546887-rl181dtaae3d66oe6vigtsiksa2u995a.apps.googleusercontent.com`. This matches the operator's local `backend/.env`.
- **Prod + staging both use a DIFFERENT OAuth Client ID** (`854830853827-1ub6cg2tticq8vpatg4af4e6svqcfr43`), from `prod_env.txt:52` and `stage_env.txt:51`. This Client ID lives in a Google Cloud project **owned by a different Google account** — operator cannot see or edit it.
- **Who owns it (identified via git log):** `Zeff01 <jzeffsomera@gmail.com>` is the exclusive author of all Google Calendar + Gmail OAuth commits (`2026-03-25 feat: implement Gmail and Calendar OAuth integrations for shops`, `2026-03-30 fix: Google Calendar OAuth integration with comprehensive logging`). The production Google Cloud project was almost certainly created under that Gmail account. Cross-reference: `prod_env.txt:7` lists `ADMIN_NAME=Jeff,Khalid,Ian,deo` where "Jeff" likely = Zeff.
- **Action taken:** operator is messaging Zeff to request either (a) IAM membership on the project with "OAuth Config Editor" role, OR (b) have Zeff add the redirect URIs himself using the list provided.
- **Decision point if Zeff doesn't respond by 2026-04-24:** pivot to **Path B** — switch DO prod + staging env vars (`GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI`) to use the operator's dev Client ID. Hygiene regression (dev project serves production) but unblocks cutover. Can be corrected post-cutover.
- **Risk if unresolved:** Google Calendar OAuth redirect URIs at `api.fixflow.ai/...` won't be registered → "Connect Google Calendar" feature breaks at cutover with `redirect_uri_mismatch` error. Also blocks fixing the pre-existing localhost redirect URI bug in prod (already broken today — not a regression, but a known gap).

**Paused** — waiting for Zeff. Operator has NOT modified either Google Cloud project yet.

---

### What happened in this session (2026-04-22)

**Operator external-systems inventory reviewed** (files at `C:\dev\external_inventory\` — outside the repo, not committed). Confirmed answers to 4 previously-open operator questions + identified 2 new findings:

1. **`COOKIE_DOMAIN=.repaircoin.ai` is SET in DO prod env vars** (`prod_env.txt:4`). Phase 3 Step 3.2a flips to `COOKIE_DOMAIN=.fixflow.ai` — **no longer conditional, now required.**
2. **DO prod component count = 1 instance** ($12/mo, 1 Shared vCPU, 1 GB RAM, 1 Container). Deploy micro-gap confirmed: 10–30s window per redeploy. Schedule merges for the low-traffic evening PH window.
3. **DO prod backend autodeploys from `main` branch** (web-services.png). Merging to main triggers immediate prod backend redeploy. Phase 1/2 commits are backward-compatible so safe; but timing should still be the evening PH window to avoid the 1-instance micro-gap landing on users.
4. **Stripe webhook target is a DO-generated hostname** (`repaircoin-staging-s7743....an.app/api/shops/webhooks/stripe`), not `api.repaircoin.ai`. DO-generated hostnames do NOT change with domain migration, so **no Stripe action required at cutover** (for this webhook). Only 1 webhook endpoint visible in sandbox/test mode — if a separate prod-live webhook exists, it's not in the screenshot; verify via Stripe dashboard toggle.
5. **Thirdweb project has no domain restrictions set** ("No Domains Configured" state). Client ID is unrestricted — works from any origin. **No Thirdweb action required at cutover.**
6. **Stripe `STRIPE_MODE=test` in production** (`prod_env.txt:39`, `sk_test_` prefix). Real shops currently pay with test cards, not real money. **Not a migration blocker** but worth confirming with the team whether this is intentional pre-launch state.
7. **Pre-existing bug flagged — not a migration concern but urgent:** `GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:4000/api/shops/calendar/callback/google` in prod (`prod_env.txt:54`). The "Connect Google Calendar" feature is broken in production — shops would be redirected to localhost. File as a separate bug. Should be `https://api.repaircoin.ai/api/shops/calendar/callback/google` today; `https://api.fixflow.ai/...` post-cutover.

**Still pending operator input:**
- Google Cloud Console access (OAuth redirect URIs for Google Calendar + Gmail)
- Play Store + App Store listing URLs (website / support / privacy)
- GoDaddy access restoration (blocks Phase 0 TTL + Phase 1 DNS)
- Confirm whether there's a separate `repaircon-staging` DO app on a different branch, or backend really runs staging + prod off the same `main` branch (affects pre-cutover validation strategy).

### What happened in this session (2026-04-28)

**fixflow.ai DNS blocker fully resolved** — strategy locked in, ready to proceed when team confirms `app.fixflow.ai` ownership.

#### 1. Marketing page confirmation

Owner confirmed: the FixFlow WordPress marketing page on Hostinger is a **placeholder, OK to take down**. No content preservation or relocation needed. Removes the largest sub-blocker from the 2026-04-22 inventory.

#### 2. Hostinger DNS zone exported and analyzed

Operator exported the full fixflow.ai zone (saved at `c:\dev\fixflow.ai.txt`, not committed). Findings:

- **Email IS configured at @fixflow.ai** via Google Workspace
  - MX → `smtp.google.com` priority 5
  - SPF TXT → `v=spf1 include:_spf.google.com ~all`
  - DMARC TXT at `_dmarc` → `v=DMARC1; p=none`
  - **All three records MUST be preserved** — answers Q3 from 2026-04-22 (yes, email is live)
- **CAA records already allow Let's Encrypt** (12 entries including `letsencrypt.org`) — Vercel auto-cert provisioning will work without modification
- **Nameservers are Hostinger** (`athena.dns-parking.com.`, `apollo.dns-parking.com.`)

Existing subdomains discovered:
- `app.fixflow.ai` CNAME → `whitelabel.ludicrous.cloud` — **IN USE** per operator's live check (white-label SaaS, likely a FixFlow product)
- `fix.fixflow.ai` ALIAS → Hostinger CDN — same content as marketing page (mirror)
- `funnel.fixflow.ai` ALIAS → Hostinger CDN — empty/placeholder, no functional content
- `info.fixflow.ai` CNAME → `sites.ludicrous.cloud` — returns 404 (broken destination)
- `www.fixflow.ai` CNAME → Hostinger CDN — current marketing page www variant

#### 3. DNS strategy locked: keep nameservers at Hostinger

Originally considered switching nameservers to GoDaddy for consolidation. **Rejected** — would force recreating every record (email, CAA, all subdomains) at GoDaddy before nameserver flip, with a 1-24h propagation gap during which **email would bounce** and `app.fixflow.ai` SaaS would go offline. No operational benefit during cutover.

**Decision:** edit records directly at Hostinger. Touch only the apex (`@`) and `www` records + add `api`, `api-staging`, `staging`. Leave email, CAA, `app`, `fix`, `funnel`, `info` records alone.

#### 4. Precise Hostinger record edit list (final)

For Phase 1 + Phase 3 cutover, only these records change:

**ADD (new records, before cutover):**
```
api          CNAME  <DigitalOcean prod app hostname>     TTL 300
api-staging  CNAME  <DigitalOcean staging app hostname>  TTL 300
staging      CNAME  cname.vercel-dns.com                 TTL 300
_vercel      TXT    <Vercel verification value>          TTL 300
```

**MODIFY (at cutover hour, replaces marketing page):**
```
@   ALIAS  fixflow.ai.cdn.hstgr.net.       →   @   <Vercel A record per Vercel instructions>
www CNAME  www.fixflow.ai.cdn.hstgr.net.   →   www CNAME  cname.vercel-dns.com
```

**LEAVE ALONE (preserve):**
```
@ MX 5 smtp.google.com                   (Google Workspace email — preserves @fixflow.ai)
@ TXT  v=spf1 include:_spf.google.com... (SPF for email)
_dmarc TXT v=DMARC1; p=none               (DMARC for email)
@ CAA  × 12 records                       (TLS cert authorization — already allows Let's Encrypt)
@ NS   athena.dns-parking.com             (keep nameservers at Hostinger)
@ NS   apollo.dns-parking.com
app    CNAME whitelabel.ludicrous.cloud   (in use — preserve)
SOA record                                (auto-managed)
```

**OPTIONAL CLEANUP (Phase 5 — non-blocking):**
```
fix    ALIAS fix.fixflow.ai.cdn.hstgr.net.    (mirror — harmless to delete or keep)
funnel ALIAS funnel.fixflow.ai.cdn.hstgr.net. (empty placeholder — harmless to delete or keep)
info   CNAME sites.ludicrous.cloud            (broken 404 — harmless to delete or keep)
```

#### 5. Risk profile after this session

Significantly de-risked from 2026-04-22:

| Risk | 2026-04-22 status | 2026-04-28 status |
|---|---|---|
| Email outage at cutover | Unknown (didn't know if email was on @fixflow.ai) | ✅ Eliminated — MX/SPF/DMARC stay untouched |
| `app.fixflow.ai` outage | Unknown | ✅ Eliminated — CNAME stays untouched (pending team confirmation) |
| 1-24h DNS propagation gap | Likely (nameserver switch path) | ✅ Eliminated — editing records at Hostinger, no nameserver change |
| TLS cert provisioning failure | Unknown (CAA records not checked) | ✅ Pre-cleared — CAA records already authorize Let's Encrypt |
| Marketing page goes down | Concern (preserve vs replace?) | ✅ Acceptable — placeholder, OK to lose |

#### 6. Google Cloud Console blocker bypassed — `fixflow-project` created

Original Zeff-owned Cloud Console project remained inaccessible. Bypassed by spinning up a brand-new Google Cloud project (`fixflow-project`, project number `948748310237`) under our control and creating fresh OAuth clients there. New Client IDs registered with redirect URIs covering all four environments:

- `https://api-staging.repaircoin.ai/api/shops/calendar/callback/google` (and `/gmail/callback`)
- `https://api-staging.fixflow.ai/api/shops/calendar/callback/google` (and `/gmail/callback`)
- `https://api.repaircoin.ai/api/shops/calendar/callback/google` (and `/gmail/callback`)
- `https://api.fixflow.ai/api/shops/calendar/callback/google` (and `/gmail/callback`)
- `http://localhost:4000/...` for dev

OAuth consent screen kept in **Testing mode** (test users explicitly added). Production publish + Google verification deferred until `fixflow.ai` is live with hosted privacy/terms pages — Gmail uses sensitive scopes (`gmail.send`, `gmail.compose`) so verification will take 4-8 weeks once submitted.

Staging env vars updated on DigitalOcean: `GOOGLE_CALENDAR_CLIENT_ID/SECRET/REDIRECT_URI`, `GMAIL_CLIENT_ID/SECRET/REDIRECT_URI`, both encryption keys.

#### 7. OAuth integrations verified end-to-end on staging

**Calendar:** Connect flow walked from the shop dashboard, Google consent → Allow → backend exchange → tokens stored → frontend success toast. ✅ Working.

**Gmail:** Initial test failed. Three real bugs found and fixed in this session:

1. **`frontend/src/services/api/gmail.ts` double-unwrap** (commit `87ac3345`)
   - Service file did `response.data` after `await apiClient.get(...)`, but the apiClient interceptor *already* returns `response.data`. Effectively unwrapped twice, dropping the `{ success, data }` wrapper. Handler then threw "Failed to get authorization URL" because `response.success` was undefined.
   - Fix: return the body directly, mirroring the working `calendar.ts` pattern.

2. **`backend/src/domains/ShopDomain/routes/gmail.routes.ts` missing GET handler** (commit `2d584b07`)
   - Gmail callback route only registered POST. Google's OAuth always redirects via GET with `code` and `state` in the query string, so the redirect hit "Route not found" and aborted connect.
   - Fix: register both GET (no JWT required, shopId comes from `state` param) and POST (programmatic, with auth). Updated the controller to branch on `req.method`, redirect to a frontend success/error page on GET, return JSON on POST.

3. **`frontend/src/app/shop/gmail/callback/page.tsx` wrong redirect target** (commit `1024f6fe`)
   - Success/error redirects pointed to `/shop/settings?tab=social`, which doesn't exist as a Next.js route. Settings is a tab inside `/shop`. Connection succeeded but landed on a 404.
   - Fix: redirect to `/shop` (matching the Calendar callback). Also removed the now-redundant POST call from the frontend page, since the backend GET handler already exchanged the code before redirecting.

After all three commits Gmail connect now works end-to-end on staging — same flow as Calendar.

#### 8. OAuth promoted to production (later same day, 2026-04-28)

Promoted the 3 Gmail OAuth fixes from `main` to `prod` (commits `87ac3345`, `2d584b07`, `1024f6fe`) along with the prod env-var rotation onto the `fixflow-project` OAuth clients. Runbook + log: `docs/tasks/strategy/staging-to-production-deployment.md`.

**Env var swap mistake + recovery:**

Initial prod env-var update copied staging values verbatim, including the redirect URI host. Result:

```
Click Connect Gmail on repaircoin.ai (PROD)
  ↓ prod backend builds OAuth URL with redirect_uri = api-staging.repaircoin.ai/...   ← wrong host
  ↓ Google redirects browser to that staging URL
  ↓ STAGING backend handles the callback, exchanges code, stores token in STAGING DB
  ↓ Staging redirects to staging FRONTEND_URL → user lands on staging homepage
```

OAuth flow looked successful from the user's perspective, but the tokens landed in the wrong database — prod had no record of the connection.

Fix on DO prod env vars:

| Variable | Wrong (copied from staging) | Correct |
|---|---|---|
| `GMAIL_REDIRECT_URI` | `https://api-staging.repaircoin.ai/api/shops/gmail/callback` | `https://api.repaircoin.ai/api/shops/gmail/callback` |
| `GOOGLE_CALENDAR_REDIRECT_URI` | `https://api-staging.repaircoin.ai/api/shops/calendar/callback/google` | `https://api.repaircoin.ai/api/shops/calendar/callback/google` |

Both prod URIs were already registered with the `fixflow-project` OAuth clients (we'd registered all four envs upfront), so this was an env-var-only fix — no Cloud Console change. After the swap + DO redeploy, disconnect-then-reconnect cycle stored tokens in the correct prod DB. Calendar + Gmail end-to-end verified on prod.

**Lesson worth carrying forward:** when copying env vars between environments, always grep for the host portion of every URL-shaped value. `api-staging.repaircoin.ai` ≠ `api.repaircoin.ai` ≠ `api-staging.fixflow.ai` ≠ `api.fixflow.ai` — same OAuth client accepts all four, but only one is correct per environment, and Google won't tell you you used the wrong one because the URI *is* registered.

#### 9. What still remains

**Done since this section was last revised:**
- ✅ ~~OAuth setup~~
- ✅ ~~Marketing page / Hostinger access / email preservation / DNS strategy~~
- ✅ ~~Production OAuth env vars~~ (executed today, including the redirect-URI fix in section 8)
- ✅ ~~Promote OAuth code to prod~~ (3 Gmail fixes — see `staging-to-production-deployment.md`)

**Now blocking next phase:**

1. **Team confirmation** that `app.fixflow.ai` is internally owned. The DNS plan preserves it either way; this just confirms the destination.
2. **Cutover date** — original 2026-04-26 missed; pick a new evening-PH window once aligned. Rough effort estimate: 4-6 hour window (DNS edit + Vercel redeploy + smoke tests + DO domain attach + cookie/CORS validation).

**Pre-stage steps ready to execute now (no team blockers, low risk):**

1. Add `fixflow.ai` to the Vercel project → obtain verification TXT and Vercel DNS target.
2. Add the verification TXT at Hostinger (risk-free — TXT only, no traffic impact, no email impact).
3. Add `api.fixflow.ai` to the DigitalOcean prod app's Domains list (DO will provision a cert and start serving, but nothing routes there until the DNS CNAME flips).
4. Set up sacrificial subdomain test (`migrate-test.fixflow.ai` → Vercel) to validate the full Vercel + DO + cookie-domain stack before touching the apex.
5. Once `fixflow.ai` Vercel deploy is up at the test subdomain, walk a full shop OAuth flow end-to-end from the new domain — same playbook we just used on `repaircoin.ai` prod.

**Rollout path after cutover (NOT cutover-blocking but customer-rollout-blocking):**

Real (non-test-list) shop owners cannot connect Gmail until the OAuth consent screen is published to Production with Google's app verification. Gmail uses sensitive scopes (`gmail.send`, `gmail.compose`), so verification is mandatory. 4-8 week review window. Has to start *after* `fixflow.ai` is live because Google verifies the live URLs.

Verification submission requires:
- Hosted `fixflow.ai/privacy` and `fixflow.ai/terms` pages
- Public homepage describing the app + scope justifications
- Demo video walking the OAuth flow and showing scope use
- Verified domain ownership in Google Search Console (added at `_google-site-verification` TXT record)

In the interim, real shop owners' Gmail connect attempts will hit "FixFlow has not completed the Google verification process" unless individually added to the test-user list (max 100). Acceptable for a slow controlled rollout but not for general availability.

**Mobile rebuild (Phase 4)** — post-cutover, not on critical path. Expo deep-link scheme migration documented in Phase 2 env-ification PR; mobile rebuild + store re-submission only triggers once the cutover is committed.

#### 10. Phase 1A — Pre-stage `fixflow.ai` infrastructure (DO NEXT, ~45 min total)

While we wait on team confirmation of `app.fixflow.ai` ownership, every other piece of the migration stack can be set up *now* without disrupting email, the existing marketing page, or `app.fixflow.ai`. The goal: at cutover hour, the only edit is flipping the apex `@` ALIAS — not provisioning Vercel, certs, and DO domains in a tight window.

**Risk profile of this phase:** zero traffic impact, zero email impact, zero downtime. Adding domains to Vercel/DO and adding TXT records doesn't route any traffic; it just provisions what we'll route to later.

##### Step 1 — Vercel: add `fixflow.ai` (10 min)

1. Vercel dashboard → production RepairCoin frontend project → **Settings → Domains**
2. **Add Domain** → `fixflow.ai`
3. **Add Domain** → `www.fixflow.ai`
4. Vercel returns:
   - A **verification TXT** value (use in Step 2)
   - A **DNS target** (`cname.vercel-dns.com`) — keep for cutover hour, not used now
5. Save both values into a secure note

##### Step 2 — Hostinger: add verification TXT records (5 min, zero traffic impact)

In Hostinger DNS for fixflow.ai:

1. Add the `_vercel` TXT record from Step 1:
   ```
   Type:  TXT
   Name:  _vercel
   Value: <Vercel verification value>
   TTL:   300
   ```
2. While editing, also add the placeholder for Google Search Console (used during Google verification later — safe to add now):
   ```
   Type:  TXT
   Name:  @
   Value: <google-site-verification value, after registering domain in Search Console>
   TTL:   300
   ```
3. Save. Vercel detects the TXT within ~minutes and marks `fixflow.ai` as **verified**. Still won't serve traffic until the apex `@` ALIAS flips at cutover.
4. **Don't touch the apex `@` ALIAS or `www` CNAME** in this phase — those are the cutover-hour edits.

##### Step 3 — DigitalOcean: add `api.fixflow.ai` to prod backend (5 min)

1. DO → Apps → **production backend app** → Settings → **Domains** → Add Domain → `api.fixflow.ai`
2. DO will start provisioning a Let's Encrypt cert. CAA records on fixflow.ai (per section 4) already authorize Let's Encrypt, so this should provision in 1-3 min.
3. DO marks the domain as "Active" once cert is issued. It's now reachable at `api.fixflow.ai` from DO's edge — but no traffic flows there until Hostinger DNS adds the CNAME.

##### Step 4 — Sacrificial canary: `migrate-test.fixflow.ai` (15 min)

This is the most valuable verification step. Builds end-to-end FixFlow infrastructure on a throwaway hostname so cutover is risk-tested.

1. Hostinger DNS → add:
   ```
   Type:  CNAME
   Name:  migrate-test
   Value: cname.vercel-dns.com
   TTL:   300
   ```
2. Vercel → same project → Settings → Domains → Add `migrate-test.fixflow.ai` → wait for cert (~2-5 min)
3. Once Vercel says "Active", open `https://migrate-test.fixflow.ai` in a browser
4. **Verification checklist:**
   - [ ] Page renders the live frontend (Vercel serving correctly)
   - [ ] DevTools → Network → API requests succeed (CORS allowlist from Phase 1 actually permits `fixflow.ai`)
   - [ ] Try shop login — likely fails because cookie is set on `.repaircoin.ai`. **Document the failure mode.** This tells us whether cutover needs cookie-rewriting code or just accepts a one-time relogin.
   - [ ] Try Calendar Connect from the canary — confirms OAuth callback chain still works when frontend is on a new domain (the redirect_uri stays at `api.repaircoin.ai/...` for now, which is fine and registered)
   - [ ] Check console for any hardcoded `repaircoin.ai` URL leftover from Phase 2 env-ification — anything that breaks here is something to fix before cutover

##### What we know after Phase 1A

When all four steps are green, we have evidence that:
- Vercel is correctly configured for `fixflow.ai`
- Let's Encrypt provisions certs on `api.fixflow.ai` and `*.fixflow.ai`
- DNS at Hostinger accepts our edits and propagates correctly
- The full app stack runs on a fixflow.ai-hosted page

Cutover hour shrinks to: edit apex `@` ALIAS at Hostinger + add `www` CNAME → done in 30 seconds, propagates in 5-10 min on the existing 300s TTL.

#### 11. Phase 1B — Async content work (start in parallel, customer-rollout-blocking)

These are NOT cutover-blocking but ARE blockers for the post-cutover Gmail rollout (Google verification needs them live and reachable on `fixflow.ai`). Starting now removes weeks from the critical path because Google review takes 4-8 weeks once submitted.

| Asset | What it is | Why it's needed |
|---|---|---|
| `fixflow.ai/privacy` | Privacy policy | Google verification — must explicitly disclose Gmail/Calendar data usage, retention, sharing |
| `fixflow.ai/terms` | Terms of service | Google verification |
| `fixflow.ai` (homepage) | Public homepage describing FixFlow | Google verification — needs to match what the consent screen claims the app does |
| Demo video (~2-3 min) | Narrated OAuth walkthrough with per-scope justification | Google verification — required for sensitive scope (`gmail.send`, `gmail.compose`) review |
| Search Console verification | TXT record at fixflow.ai apex | Required to submit OAuth client for verification |

These can be drafted by anyone with content/marketing skills — not engineer-blocking.

#### 12. Phase 1C — Engineering polish on the canary (today, ~30 min)

After Phase 1A canary is up, use it to surface anything Phase 2 env-ification missed:

1. **Hardcoded URL grep** — `grep -rn "repaircoin\.ai" frontend/src backend/src` and review every match. Anything not in a comment, config default, or env-loader fallback needs to be env-driven before cutover.
2. **Cookie behavior test** — log a shop in via `migrate-test.fixflow.ai`, inspect cookies, confirm whether cross-domain auth needs intervention or works "for free".
3. **Email/asset URL audit** — open a transactional email rendered through `migrate-test.fixflow.ai` and confirm logo/asset URLs use `PUBLIC_ASSET_URL` env var (already env-ified in Phase 2 — this just verifies in practice).

#### 13. Suggested next working session — quick reference

| Order | Effort | Action | Phase |
|---|---|---|---|
| 1 | 45 min | Phase 1A pre-stage (Vercel + Hostinger TXT + DO Domains + canary) | 1A |
| 2 | 30 min | Phase 1C engineering polish on the canary (hardcoded URL grep + cookie test) | 1C |
| 3 | Async | Phase 1B content drafting (privacy, terms, homepage, demo video script) | 1B |
| 4 | When team aligns | Lock cutover date | 3 |
| 5 | Cutover hour | Apex DNS flip — runbook in section 4 above | 3 |

---

### What was applied in this session (2026-04-21 engineer PR)

All changes are **backward-compatible** — every new env var defaults to the current `repaircoin.ai` / `repaircoin` value. Deploying this PR produces zero behavior change. Phase 3 flips the env vars; no further code changes required at cutover.

**Phase 1 CORS allowlist (backend/src/app.ts:218–237):** added 5 new origins to the existing allowlist array:
- `https://fixflow.ai`
- `https://www.fixflow.ai`
- `https://api.fixflow.ai`
- `https://staging.fixflow.ai`
- `https://api-staging.fixflow.ai`

Legacy repaircoin.ai origins kept unchanged — purely additive.

**Phase 2 Backend env-ification — new env vars introduced** (all with backward-compatible defaults):

| Env var | Used by | Default (backward-compat) | Phase 3 flip value |
|---|---|---|---|
| `MOBILE_DEEP_LINK_SCHEME` | 4 Stripe return URL emitters | `'repaircoin'` | `'fixflow'` (only after mobile rebuild with array scheme) |
| `PUBLIC_ASSET_URL` | Marketing email logo URL | `'https://repaircoin.ai'` | `'https://fixflow.ai'` |
| `SUPPORT_EMAIL` | admin settings default + swagger contact | `'support@repaircoin.ai'` | `'support@fixflow.ai'` (Phase 5 — email brand) |
| `API_PUBLIC_URL` | swagger "Production server" URL | `'https://api.repaircoin.ai'` | `'https://api.fixflow.ai'` |

Existing env vars re-used (no new var introduced):
- `FRONTEND_URL` — swagger contact url, email-template reset link preview, marketing email url — default stays `https://repaircoin.ai`; flipped at Phase 3

**Backend files modified:**
- `backend/src/app.ts` — CORS allowlist additive update
- `backend/src/domains/ServiceDomain/services/PaymentService.ts:490–493` — `MOBILE_DEEP_LINK_SCHEME` interpolation
- `backend/src/domains/shop/routes/purchase.ts:459–464` — `MOBILE_DEEP_LINK_SCHEME` interpolation
- `backend/src/services/MarketingService.ts:459` — `PUBLIC_ASSET_URL` for logo URL
- `backend/src/domains/admin/routes/settings.ts:53` — `SUPPORT_EMAIL` env var
- `backend/src/domains/admin/routes/emailTemplates.ts:161` — `FRONTEND_URL` interpolation for reset-link preview
- `backend/src/docs/swagger.ts:42–43` — `SUPPORT_EMAIL` + `FRONTEND_URL`
- `backend/src/docs/swagger.ts:56` — `API_PUBLIC_URL`

**Phase 2 Frontend env-ification — env var used** (existing, widely known):

| Env var | Used by | Default (backward-compat) | Phase 3 flip value |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | metadataBase, waitlist OG URLs, contact-us href/display | `'https://www.repaircoin.ai'` | `'https://www.fixflow.ai'` |

**Frontend files modified:**
- `frontend/src/app/layout.tsx:34` — metadataBase
- `frontend/src/app/waitlist/[source]/page.tsx:15–44` — extract `appUrl` const + interpolate into OG/twitter URLs
- `frontend/src/app/waitlist/layout.tsx:1–32` — extract module-level `appUrl` const + interpolate into OG/twitter URLs
- `frontend/src/app/contact-us/page.tsx:8–50` — derive `appUrl` + `brandDomain` (hostname stripped of `www.`) from env; use in website href and displayed text

**Verification performed:**
- `backend: npm run typecheck` → exit 0 (clean)
- `frontend: npm run lint` → errors present but all pre-existing, none in the 4 files modified in this PR

**Deferred to later phases (not in this PR):**
- Mobile `eas.json` profile URL updates → Phase 4 rebuild (cleaner to flip at the same time as the scheme-array change)
- Mailto links to `@repaircoin.com` addresses (support@, security@, treasury@, rcg-sales@) → Phase 5 email-brand follow-up
- Legacy `www.repaircoin.com` strings in BookingDetailsModal receipt PDF → Phase 5
- `VAPID_SUBJECT` default flip (already env-driven) → Phase 3 env var flip
- CLAUDE.md / docs mentioning repaircoin.ai → low priority; update as part of Phase 5 cleanup

### Immediate next actions (if session crashes, resume here)

**Engineer (me) — next session start here:**
1. ~~Phase 0 inventory~~ — **DONE** → `docs/tasks/strategy/phase-0-inventory.md`.
2. ~~Phase 1 CORS PR~~ — **DONE** and committed to `deo/dev` (see "What was applied in this session").
3. ~~Phase 2 backend + frontend env-ification~~ — **DONE** and committed to `deo/dev`.
4. **Remaining engineer work before cutover:**
   - [ ] Update CLAUDE.md references to reflect dual-domain setup (low priority — deferred)
   - [ ] Phase 3 Step 3.2 dry-run: prepare the list of Vercel env var names + target values as a checklist (do right before cutover to avoid drift)
   - [ ] Phase 3 Step 3.2a: decide whether `COOKIE_DOMAIN` flip is required (depends on operator check; see below)
5. **Do not deploy the current `deo/dev` commits to production until operator confirms Phase 1 infra is provisioned** — the code changes are backward-compatible, but there's no rush to deploy until DNS is also ready.

**Operator — next session start here:**
1. ~~Confirm `COOKIE_DOMAIN` in DO production env vars~~ — **DONE 2026-04-22.** Set to `.repaircoin.ai`. Phase 3 Step 3.2a required.
2. ~~Confirm DO production instance count~~ — **DONE 2026-04-22.** 1 container. Deploy micro-gap confirmed.
3. External Systems Inventory — **PARTIALLY DONE 2026-04-22:**
   - ~~Stripe webhooks~~ — DONE (single webhook, DO-generated hostname, no migration action required)
   - ~~Thirdweb allowed origins~~ — DONE (no restrictions configured, no migration action required)
   - [ ] **Google Cloud Console** OAuth redirect URIs — pending access
   - [ ] **Play Store + App Store** listing URLs — pending access
4. **Decide pending Open Questions:** #3 (migrate staging in parallel — recommended yes) and canonical www vs bare (recommended Option A — www).
5. **Clarify deploy topology:** is there a separate `repaircon-staging` DO app, or does prod backend double as staging? Check DigitalOcean Apps list.
6. **Flag to team (not cutover-blocking):** `STRIPE_MODE=test` in prod — intentional pre-launch, or needs to flip to `live`?
7. **File as separate bug (urgent, not migration):** `GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:4000/...` in prod — "Connect Google Calendar" is broken in production.
8. **When GoDaddy access returns:** run "Phase 0 Operator — Step-by-Step" (TTL lowering, fixflow.ai state verification) and "Phase 1 Operator — Step-by-Step" (DNS + Vercel + DO domain adds).

---

## Current Infrastructure

| Component | Production | Staging |
|---|---|---|
| Frontend canonical | `www.repaircoin.ai` (Vercel) | `staging.repaircoin.ai` (Vercel) |
| Frontend redirect | `repaircoin.ai` → 301 → `www.repaircoin.ai` (existing Vercel redirect) | n/a |
| Vercel project | Single project `repair-coin` — production = `prod` branch, staging = `main` branch (branch-per-subdomain routing) | same project |
| Backend API | `api.repaircoin.ai` (DO App Platform, SGP) | `api-staging.repaircoin.ai` (DO App Platform, NYC) |
| DNS registrar | GoDaddy (same account holds both repaircoin.ai and fixflow.ai) | same |
| Database | DO Managed Postgres (prod cluster) | DO Managed Postgres (staging cluster) |
| Mobile builds | `EXPO_PUBLIC_API_URL=https://api.repaircoin.ai/api` | `EXPO_PUBLIC_API_URL=https://api-staging.repaircoin.ai/api` |

---

## Target Infrastructure

Assumes canonical preference stays at `www.` variant (matching current `www.repaircoin.ai` canonical). See Decision needed below if the team wants to flip to bare `fixflow.ai` as canonical instead.

| Component | Production | Staging |
|---|---|---|
| Frontend canonical | `www.fixflow.ai` (Vercel) | `staging.fixflow.ai` (Vercel) |
| Frontend redirects | `fixflow.ai` → 301 → `www.fixflow.ai`; `repaircoin.ai` + `www.repaircoin.ai` → 301 → `www.fixflow.ai` | `staging.repaircoin.ai` → 301 → `staging.fixflow.ai` |
| Vercel project | Same single `repair-coin` project — new fixflow.ai domains assigned to the existing `prod` and `main` branches | same project |
| Backend API primary | `api.fixflow.ai` | `api-staging.fixflow.ai` |
| Backend API legacy alias | `api.repaircoin.ai` (same DO app, kept indefinitely for mobile compatibility) | `api-staging.repaircoin.ai` |
| Mobile builds (new) | `EXPO_PUBLIC_API_URL=https://api.fixflow.ai/api` | `EXPO_PUBLIC_API_URL=https://api-staging.fixflow.ai/api` |
| Mobile builds (existing) | unchanged — keep hitting api.repaircoin.ai via alias | unchanged |

### Decision needed — canonical www vs bare

The current production canonical is `www.repaircoin.ai` (bare `repaircoin.ai` 301s to www). Two options for fixflow.ai:

- **Option A (preserve pattern):** canonical is `www.fixflow.ai`; `fixflow.ai` redirects to www. Minimal change for end users and SEO continuity with the current www-preferred pattern.
- **Option B (switch to bare):** canonical is `fixflow.ai`; www redirects to bare. More common for modern SPAs and shorter / cleaner URLs. Breaks the existing www-preferred pattern, which is minor SEO churn but not dangerous.

**Recommendation: Option A** unless the product owner actively prefers bare-domain canonical. Either works; pick before Phase 1 finishes so the Vercel "primary" flip in Phase 3 knows what to target.

---

## Core Principle: Parallel Before Cutover

At no point should DNS be pointed away from a working endpoint. Both domains serve the same application throughout Phases 1–2. Phase 3 flips priority; before this flip users already work on both domains, so the "flip" is just a routing preference.

Rollback at any step is reverting a single Vercel primary-domain toggle — seconds, not minutes.

---

## Downtime Analysis (per phase)

**Summary: no planned downtime. The system continues serving users throughout every phase.** What you can expect:

| Phase | Hard downtime? | Micro-gaps? | User-visible effect |
|---|---|---|---|
| Phase 0 — Prep | **None.** Read-only work. | None. | None. |
| Phase 1 — Parallel Infra | **None.** All changes are additive. | Possibly during the CORS PR deploy (see below). | None. |
| Phase 2 — Codebase Prep | **None.** Each change is backward-compatible. | Possibly during each backend deploy. | None. |
| Phase 3 — Cutover | **None.** Vercel primary-flip and env-var flips are atomic. | Possibly during the frontend redeploy. | **Active web users get logged out** (see below). |
| Phase 4 — Mobile Rebuild | **None.** New binary goes to stores; old binaries keep working. | None. | None (users who install the new build see the new brand). |
| Phase 5 — Soak & Cleanup | **None.** Monitoring + deferred cleanup only. | None. | None. |

### The three things to actually worry about

**1. Backend deploy micro-gap (Phase 1 CORS merge, Phase 2 env-ification deploys)**

Each backend code change triggers a DO App Platform redeploy. Whether this causes a user-visible gap depends on DO instance count:
- **If the production app runs ≥2 instances:** DO does a rolling deploy. Zero user impact — new instance comes up, old one drains, traffic shifts. Imperceptible.
- **If the production app runs 1 instance:** there's a ~10–30 second window where requests may queue at the DO ingress or return a brief 502. The load balancer absorbs most of it, but heavy-traffic requests during the swap may see a brief latency bump.

**Action before Phase 1 merge:** operator confirms DO instance count in the production app's Settings. If 1, schedule the CORS PR merge for a low-traffic moment (same evening PH window as the cutover is fine).

**2. Frontend redeploy during Phase 3 cutover**

The Phase 3 cutover flips `NEXT_PUBLIC_API_URL` env var in Vercel and redeploys. Vercel deploys are **atomic** — the new build is prepared on a preview URL first, then the project's production pointer swaps instantly. There's no window of serving a half-broken build. **No user-visible gap.**

What IS visible: users on a page at the exact second of the swap may see their next navigation load the new build. Any fetch already in flight completes on the old build; subsequent fetches hit the new build. This is how every Vercel deploy works and is not migration-specific.

**3. Web user logout at cutover (the only "user-visible" event)**

JWT tokens are stored in `localStorage`. `localStorage` is scoped per origin — `www.repaircoin.ai` localStorage ≠ `www.fixflow.ai` localStorage. When a user's browser first lands on `www.fixflow.ai` (either via the new primary URL or via the 301 redirect from the old domain), localStorage is empty. They need to log in again. **One-time friction, not downtime.** The app still serves; they see the login screen.

**Mitigation options** (pick one or none):
- Accept as one-time friction. Send a heads-up email or in-app banner 24h before cutover saying "you'll be asked to log in again on {{date}} when we switch to fixflow.ai — this is expected."
- **Do NOT** try to migrate tokens via a redirect handshake during cutover — adds complexity and a new failure mode for a one-time event.

Mobile users are **unaffected** — mobile uses SecureStore (device-scoped, not origin-scoped) and keeps hitting `api.repaircoin.ai` alias, which we never decommission.

### What would cause real downtime (things we explicitly don't do)

- Decommissioning `api.repaircoin.ai` before mobile fully ages out → would break mobile payment flows. **We keep the alias permanently.**
- Changing the mobile deep-link scheme without a backward-compatible array → would break Stripe payment-return bounce on any user on the old build. **Phase 4 uses `scheme: ["repaircoin", "fixflow"]` array to avoid this.**
- Deleting the Stripe webhook endpoint for repaircoin.ai before the soak window ends → would lose webhook events. **Phase 5 waits 2+ weeks.**
- Switching DNS nameservers (vs. editing records) during the cutover → could cause a multi-hour propagation gap. **We edit records, never swap nameservers, during cutover windows.**

---

## Phase 0 — Planning & Prep

**Duration:** ~1–2 hours across both sides.
**Goal:** produce the complete list of things that need to change in later phases. No user-visible impact.

### Phase 0 Engineer Inventory — Step-by-Step

Save output to `docs/tasks/strategy/phase-0-inventory.md` (create if missing) so subsequent sessions can resume without rerunning.

#### Step 1 — Grep for `repaircoin.ai` across the repo

From the repo root (`C:\dev\RepairCoin`):

```bash
# Frontend
grep -rn "repaircoin\.ai" frontend/src frontend/public frontend/next.config.* 2>/dev/null | grep -v node_modules | grep -v ".next"

# Backend
grep -rn "repaircoin\.ai" backend/src 2>/dev/null | grep -v node_modules | grep -v dist

# Mobile
grep -rn "repaircoin\.ai" mobile/app mobile/feature mobile/shared mobile/app.config.ts mobile/eas.json 2>/dev/null | grep -v node_modules

# Docs
grep -rn "repaircoin\.ai" docs/ CLAUDE.md README.md 2>/dev/null
```

**Expected categories** to tag each hit:
- `ENV_DEFAULT` — default value for an env var (edit in Phase 2 env-ification)
- `HARDCODED_URL` — inline URL string (must env-ify in Phase 2)
- `CORS_ALLOWLIST` — backend CORS config (edit in Phase 1 CORS PR)
- `EMAIL_TEMPLATE` — string in email HTML/text body (edit in Phase 2)
- `OG_METADATA` — Open Graph / canonical / sitemap (edit in Phase 2)
- `DOC_REFERENCE` — docs/readme mention (edit in Phase 2 low-pri)

**Acceptance:** every line of grep output is categorized. Count per category captured.

#### Step 2 — Grep for `repaircoin.com` (email FROM + any other .com uses)

```bash
grep -rn "repaircoin\.com" frontend/src backend/src mobile docs/ CLAUDE.md 2>/dev/null | grep -v node_modules | grep -v dist | grep -v ".next"
```

**Expected:** at minimum, `backend/.env.example` or config default for `EMAIL_FROM`. Any template that hardcodes "@repaircoin.com" is flagged for Phase 5 email-brand migration.

#### Step 3 — Grep for mobile deep-link scheme usage

Already done this session — findings captured in Open Question #7. Re-run if needed:

```bash
grep -rn "repaircoin://" backend/src mobile 2>/dev/null | grep -v node_modules
```

Known hits (as of 2026-04-21):
- `backend/src/domains/ServiceDomain/services/PaymentService.ts:491-492`
- `backend/src/domains/shop/routes/purchase.ts:461-462`

**Acceptance:** no new hits beyond these four lines (or any new hits are added to the Phase 2 env-ification list).

#### Step 4 — Confirm web auth storage is `localStorage` (not `.repaircoin.ai` cookies)

```bash
grep -rn "localStorage\|document.cookie" frontend/src/stores frontend/src/services 2>/dev/null | grep -v node_modules | grep -v ".next"
```

**Acceptance:** JWT storage path confirmed as `localStorage`. If any cross-subdomain cookie (`.repaircoin.ai`) is found, raise immediately — cutover logout plan changes.

#### Step 5 — Email templates that reference domain names

```bash
grep -rn "repaircoin\|RepairCoin" backend/src/services/EmailService.ts backend/src/services/templates 2>/dev/null
```

**Acceptance:** every URL inside an email body string is listed. Phase 2 introduces `PUBLIC_APP_URL` env var to replace these.

#### Step 6 — Mobile eas.json profile audit

Read `mobile/eas.json`. For each profile (`development`, `preview`, `tester`, `production-apk`, `production`), capture:
- Current `EXPO_PUBLIC_API_URL` value
- Whether it's `api.repaircoin.ai` or `api-staging.repaircoin.ai`

**Acceptance:** table of profile → API URL committed to inventory doc.

#### Step 7 — Summarize findings

Write the summary into `docs/tasks/strategy/phase-0-inventory.md` using this skeleton:

```markdown
# Phase 0 Inventory — {{date}}

## Summary counts
- Frontend hits: X
- Backend hits: Y (excl. CORS allowlist which is a separate category)
- Mobile hits: Z
- Docs hits: W

## CORS allowlist (Phase 1 CORS PR input)
- File: backend/src/xxx.ts, line N — origins array

## Phase 2 Env-ification Targets
| File | Line | Type | Current value | Proposed env var |

## Phase 5 (email brand) follow-up
| File | Line | Notes |

## Confirmations
- [ ] Web auth storage: localStorage (not cross-subdomain cookies)
- [ ] No unexpected `repaircoin://` deep-link emitters beyond the 4 known
- [ ] Mobile eas.json profiles captured
```

### Phase 0 Operator — Step-by-Step

**Parts that need GoDaddy access (currently blocked):**

#### Step 1 (blocked) — Lower DNS TTLs on repaircoin.ai records to 300s

- Login to GoDaddy → Domains → `repaircoin.ai` → DNS → Manage Records
- Edit each A / CNAME record currently pointing at Vercel or DO. For each: change TTL from default (usually 1 hour) to **600 seconds (10 minutes)** — GoDaddy's minimum allowed custom value is 600s (verified 2026-04-22). Originally targeted 300s but GoDaddy UI enforces a 600s floor. 600s is acceptable for fast rollback in DNS terms.
- Records to hit: `@`, `www`, `staging`, `api`, `api-staging`, and any MX records if they exist for email
- **Timing requirement:** must complete by **2026-04-25** (≥24h before the 2026-04-26 cutover) so real-world DNS caches have converged to the low TTL value.

**Acceptance:** `dig repaircoin.ai +short` and `dig www.repaircoin.ai +short` from any external shell shows a TTL ≤300 after 1 hour. Operator pastes one `dig` output into this doc's Decision Log as verification.

#### Step 2 (blocked) — Verify fixflow.ai domain state at GoDaddy

- Login to GoDaddy → Domains → click **`fixflow.ai`** to open its detail page
- Confirm:
  - **Status** shows "Active" (not "Parked", "Expired", "Pending Transfer")
  - **Nameservers** are GoDaddy's (`ns*.domaincontrol.com`) OR Vercel's — either is fine, but we need to be able to edit DNS records there
  - **No 60-day transfer lock** is active (visible if recently purchased or transferred)
  - **WHOIS is unlocked** enough to edit DNS (locked WHOIS is fine; locked domain transfer is fine)

**Acceptance:** domain is editable for DNS records. Capture a screenshot into the Decision Log.

**Parts that do NOT need GoDaddy (can proceed now):**

#### Step 3 — External Systems Inventory

Produce a list of every external dashboard that has a `repaircoin.ai` URL in its config. This becomes the Phase 3 cutover checklist.

**Stripe dashboard** (both live and test modes):
- Developers → Webhooks → list every endpoint. Note the URL of each. Any `*.repaircoin.ai` endpoint needs a counterpart added at `*.fixflow.ai` in Phase 3.
- Connect → Settings (if Stripe Connect used) → redirect URIs. Note any `*.repaircoin.ai` value.

**Google Cloud Console** (for Gmail + Calendar OAuth, if used):
- APIs & Services → Credentials → click each OAuth 2.0 Client ID
- Authorized redirect URIs → list each `*.repaircoin.ai/callback` (or similar)
- Authorized JavaScript origins → list each `*.repaircoin.ai`

**Thirdweb dashboard**:
- Project → Settings → Allowed domains (for in-app wallet / social login). Note every entry.

**Play Store + App Store listings** (if already published):
- Play Store → App → Store presence → Main store listing → Website / support / privacy URLs
- App Store Connect → App → App Information → Marketing URL / Support URL / Privacy Policy URL

**Email sending DNS** (for Phase 5 follow-up, not cutover-critical):
- Currently Gmail SMTP with `noreply@repaircoin.com` — no DNS work required for the web cutover. Skip until Phase 5.

**Branded short links / QR codes / marketing collateral**:
- Inventory anything hardcoded to `repaircoin.ai` in printed, scanned, or shared assets.

**Acceptance:** list committed to `docs/tasks/strategy/phase-0-external-inventory.md` (create if missing). Every entry notes (a) where it is, (b) current value, (c) action in Phase 3 (add counterpart / leave / migrate).

#### Step 4 — Confirm pending decisions

- **Open Question #3 — migrate staging in parallel** (`staging.fixflow.ai`)? Recommended: **yes**. Zero extra cost given single-project architecture and keeps dev/stage/prod in sync.
- **Canonical URL preference**: Option A (canonical `www.fixflow.ai`, bare redirects) recommended to preserve current `www.repaircoin.ai` pattern.

**Acceptance:** both decisions captured in the Decision Log table below.

---

## Phase 1 — Parallel Infrastructure (Additive)

**Duration:** ~1–2 hours operator-side. Zero user impact.
**Goal:** both domains resolve and serve the identical app side-by-side. repaircoin.ai infrastructure is untouched.

**Recommended sequence:** Engineer task (CORS PR) → Operator Vercel team-level add (reveals required DNS values) → Operator GoDaddy DNS → Operator Vercel project-level assign → Operator DO custom domains → wait for SSL → verify.

### Phase 1 Engineer — CORS PR Step-by-Step

This PR is the first Phase 1 deliverable. It adds fixflow.ai origins to the backend CORS allowlist so that when Phase 1 DNS + Vercel provisioning completes, `https://staging.fixflow.ai` can call `https://api-staging.repaircoin.ai` without a CORS failure.

**Prerequisite:** Phase 0 Engineer inventory identifies which file holds the CORS allowlist. As of 2026-04-21, the CORS config lives in the backend — likely `backend/src/app.ts` or a dedicated middleware. Confirm via grep before editing.

#### Step 1 — Branch

```bash
git checkout deo/dev
git pull origin deo/dev
git checkout -b deo/fixflow-cors-allowlist
```

#### Step 2 — Find the CORS allowlist

```bash
grep -rn "cors\|origin" backend/src/app.ts backend/src/middleware 2>/dev/null | grep -i "allow\|origin"
```

Look for an array of allowed origins. Typical pattern:

```ts
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://repaircoin.ai',
  'https://www.repaircoin.ai',
  'https://staging.repaircoin.ai',
];
```

#### Step 3 — Add fixflow.ai entries

Add without removing any existing entries:

```ts
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  // legacy — kept permanently as an alias
  'https://repaircoin.ai',
  'https://www.repaircoin.ai',
  'https://staging.repaircoin.ai',
  // fixflow.ai — new primary brand
  'https://fixflow.ai',
  'https://www.fixflow.ai',
  'https://staging.fixflow.ai',
];
```

#### Step 4 — Local verification

```bash
cd backend
npm run typecheck
npm run lint
npm run test
```

**Acceptance:** typecheck + lint + tests pass. No existing origin removed.

#### Step 5 — Open draft PR, do NOT merge yet

```bash
git add -p  # review before staging
git commit -m "Add fixflow.ai origins to CORS allowlist (pre-Phase 1)"
git push -u origin deo/fixflow-cors-allowlist
gh pr create --draft --title "Add fixflow.ai CORS allowlist (pre-Phase 1)" --body "Adds fixflow.ai variants to backend CORS allowlist. Part of domain migration Phase 1. DO NOT MERGE until Phase 1 infra (DNS + Vercel + DO) is verified operational. See docs/tasks/strategy/domain-migration-repaircoin-to-fixflow.md for the full plan."
```

**Acceptance:** PR is in draft. Link the PR URL in this doc's Decision Log when opened.

---

### Phase 1 Operator — DNS + Vercel + DO Step-by-Step

**Prerequisite:** GoDaddy access restored.

#### Step A1 — Vercel team-level: Add Existing domain

- URL: `https://vercel.com/repair-coin/~/domains`
- Click **Add Existing Domain**
- Enter: `fixflow.ai`
- Vercel shows a DNS configuration panel. It will display **either:**
  - Option A — change nameservers to Vercel's (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`), OR
  - Option B — keep GoDaddy nameservers and add specific A/CNAME records

**For this migration: use Option B** (keep GoDaddy nameservers). Rationale: we want to keep email MX records and any other non-web DNS records manageable in GoDaddy. Note the exact A / CNAME values Vercel requests — usually:
- `A @` → `76.76.21.21` (Vercel ingress IP)
- `CNAME www` → `cname.vercel-dns.com`

**Save these values** into this doc's Decision Log for reference.

#### Step A2 — GoDaddy: add DNS records for fixflow.ai

Login to GoDaddy → Domains → `fixflow.ai` → DNS → Manage Records. Add (do not replace anything):

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@` | `76.76.21.21` (or whatever Vercel specified above) | 300 |
| CNAME | `www` | `cname.vercel-dns.com` (or whatever Vercel specified) | 300 |
| CNAME | `staging` | `cname.vercel-dns.com` (Vercel staging target — confirm in Vercel) | 300 |
| CNAME | `api` | DO app hostname for prod (e.g. `xyz.ondigitalocean.app` — see Step C below) | 300 |
| CNAME | `api-staging` | DO app hostname for staging | 300 |

Set TTL=300 on every new record from the start — no need to lower later.

**Acceptance:** records visible in GoDaddy UI. Wait 5–10 min for propagation before moving on.

#### Step A3 — Verify DNS from external

From any shell:

```bash
dig fixflow.ai +short
dig www.fixflow.ai +short
dig staging.fixflow.ai +short
dig api.fixflow.ai +short
dig api-staging.fixflow.ai +short
```

**Acceptance:** every query returns a non-empty result pointing at Vercel (for web domains) or DO (for api domains). If any returns empty, wait another 5 min and retry; if still empty after 30 min, check record syntax at GoDaddy.

#### Step B — Vercel project-level: assign domains to branches

- URL: `https://vercel.com/repair-coin/repair-coin/settings/domains` (or navigate: Dashboard → `repair-coin` project → Settings → Domains)
- Add each of these three domains to the project. For each, select the branch as shown:

| Domain | Assign to branch | Redirect |
|---|---|---|
| `www.fixflow.ai` | `prod` | leave blank — do NOT set as primary yet |
| `fixflow.ai` (bare) | `prod` | leave blank — do NOT configure redirect yet |
| `staging.fixflow.ai` | `main` | leave blank |

**Critical:** do not set any of these as "primary" during Phase 1. The primary stays `www.repaircoin.ai` until Phase 3 cutover.

**Acceptance:** each domain shows a green checkmark with valid SSL cert within 15 minutes. If a domain is stuck "pending verification," recheck DNS values.

#### Step C — DigitalOcean App Platform: add custom domains to backend apps

**Prod app (SGP region):**
- URL: DigitalOcean Cloud → Apps → click the production app
- Settings → Domains → **Add Domain**
- Domain: `api.fixflow.ai`
- Select **You manage your domain** (we use GoDaddy)
- DO shows a CNAME target like `xyz.ondigitalocean.app` — **copy this exactly into the GoDaddy CNAME record for `api`** (Step A2 row)
- Click **Add Domain**

**Staging app (NYC region):**
- Same flow on the staging app
- Domain: `api-staging.fixflow.ai`
- Copy the CNAME target into GoDaddy's `api-staging` CNAME record

**Acceptance:** both `api.fixflow.ai` and `api-staging.fixflow.ai` show as "Active" with SSL in DO's domains panel within 30 minutes. If stuck in "Pending Certificate Issuance" after 1 hour, verify the CNAME resolves externally via `dig`.

#### Step D — Merge the Engineer CORS PR

Once Phase 1 infra is verified green (Steps A1–C complete), merge the CORS allowlist PR prepared in "Phase 1 Engineer — CORS PR Step-by-Step" above. Wait for DO to redeploy the backend (~3 min). This unlocks the Phase 1 verification below.

### Phase 1 Verification — Acceptance Checklist

Run in a browser / curl after Step D merge is deployed:

- [ ] `curl -I https://fixflow.ai` returns 200 (not 308/301 yet — cutover hasn't happened)
- [ ] `curl -I https://www.fixflow.ai` returns 200
- [ ] `curl -I https://staging.fixflow.ai` returns 200
- [ ] `curl https://api.fixflow.ai/api/health` returns `{"status":"ok"}` or equivalent 200
- [ ] `curl https://api-staging.fixflow.ai/api/health` returns 200
- [ ] Open `https://staging.fixflow.ai` in a browser; open devtools Network tab; perform a login or a page load that calls the API; confirm calls to `https://api-staging.repaircoin.ai` succeed without CORS errors (the CORS PR enables this)
- [ ] `curl -I https://repaircoin.ai` still returns its current 301 → www, unchanged
- [ ] `curl -I https://www.repaircoin.ai` still returns 200
- [ ] SSL cert on each new domain is valid (no browser warning)

**If any checkbox fails,** do NOT proceed to Phase 2 until resolved.

---

## Phase 2 — Codebase Prep (Backward-Compatible)

**Duration:** ~2–4 hours engineer-side. Zero user impact — both domains continue to work throughout.

All changes are additive/backward-compatible. repaircoin.ai remains functional after each PR merges.

### Engineer

**Backend:**
- Merge the CORS allowlist PR from Phase 1 — deploy includes both repaircoin.ai AND fixflow.ai origins.
- Replace hardcoded `repaircoin.com` / `repaircoin.ai` strings in email template body text with a `PUBLIC_APP_URL` env var (or similar). Default the env var to `https://repaircoin.ai` for now — flip it in Phase 3.
- **Env-ify the mobile deep-link scheme.** Introduce `MOBILE_DEEP_LINK_SCHEME` env var (default `repaircoin`). Replace the 4 hardcoded `repaircoin://` strings:
  - `backend/src/domains/ServiceDomain/services/PaymentService.ts:491-492` (Stripe success/cancel for order payments)
  - `backend/src/domains/shop/routes/purchase.ts:461-462` (Stripe success/cancel for shop RCN purchases)
  - Replace with `\`${process.env.MOBILE_DEEP_LINK_SCHEME || 'repaircoin'}://shared/...\``. No behavior change yet — default preserves current scheme.
- Audit `app.ts`, any URL-constant modules, any webhook path strings.
- Deploy to staging first. Verify both `staging.repaircoin.ai` AND `staging.fixflow.ai` can call the API correctly, and confirm the Stripe payment-return flow still works on the existing mobile build.

**Frontend:**
- Replace hardcoded domain strings with env-derived where sensible (canonical URL logic, OG metadata, share links).
- Keep `NEXT_PUBLIC_API_URL` defaulting to `https://api.repaircoin.ai/api` for now — the frontend on fixflow.ai still calls the repaircoin.ai API at this stage. Flip the env var in Phase 3.
- Audit service worker (`frontend/public/sw.js`) for any cached domain references.
- Audit `robots.txt`, `sitemap.xml` (if present).
- Deploy to staging first. Verify by loading `https://staging.fixflow.ai` and confirming it calls `api-staging.repaircoin.ai` and renders correctly.

**Mobile (`mobile/eas.json`):**
- Add new env values for future builds pointing at `api.fixflow.ai` / `api-staging.fixflow.ai`.
- **Do not build new binaries yet.** Existing binaries keep using api.repaircoin.ai and keep working.

**Docs:**
- Update `CLAUDE.md` references to reflect dual-domain reality.
- Update `docs/tasks/strategy/staging-to-production-deployment.md` if needed.

### Operator

- Review and merge each PR as it arrives.
- After each deploy, spot-check both domains serve correctly and the API call succeeds.

### Phase 2 verification

- [ ] Backend CORS allows requests from fixflow.ai and repaircoin.ai origins
- [ ] Frontend on `staging.fixflow.ai` successfully calls `api-staging.repaircoin.ai` with no CORS errors
- [ ] Email template bodies use env-derived URLs (test via a non-production send)
- [ ] No hardcoded `repaircoin.ai` strings remain in production code paths (grep audit clean)

---

## Phase 3 — Cutover

**Duration:** ~1–2 hours with careful sequencing. Monitor closely.

**Precondition:** Phase 1 and Phase 2 fully verified. Both domains functionally identical.

### Sequence (each step is independently reversible)

**Step 3.1 — Vercel primary flip + redirects (operator)**

All changes inside the single `repair-coin` project → Settings → Domains. No separate staging project to manage.

- Set `www.fixflow.ai` as the **Primary** / **Production** domain (assumes Option A canonical — see Target Infrastructure section).
- Configure `fixflow.ai` (bare) to **Redirect to `www.fixflow.ai`**.
- Configure `www.repaircoin.ai` to **Redirect to `www.fixflow.ai`**.
- Reconfigure `repaircoin.ai` (bare) to **Redirect to `www.fixflow.ai`** — replaces the existing `→ www.repaircoin.ai` redirect.
- If migrating staging: `staging.fixflow.ai` stays assigned to the `main` branch; configure `staging.repaircoin.ai` to **Redirect to `staging.fixflow.ai`**.

Effect: any user hitting any repaircoin.ai variant receives a 301 to the equivalent fixflow.ai variant. Browsers follow automatically. Existing fixflow.ai sessions established during Phase 1 verification are unaffected.

**Step 3.2 — Frontend API URL flip (engineer)**

In the `repair-coin` project's Environment Variables:
- Change `NEXT_PUBLIC_API_URL` from `https://api.repaircoin.ai/api` to `https://api.fixflow.ai/api`.
- If staging uses a different env var value (e.g. per-environment override for `main` branch), update that too to `https://api-staging.fixflow.ai/api`.
- Trigger a redeploy for each environment (Vercel auto-deploys on env-var change in most configs; manual redeploy available if not).

Effect: new HTML bundles served from the fixflow.ai canonical call the api.fixflow.ai backend. Backend CORS (Phase 2) permits the new origin.

**Step 3.2a — Conditional: flip `COOKIE_DOMAIN` on backend (engineer + operator)**

**REQUIRED — confirmed 2026-04-22 that `COOKIE_DOMAIN=.repaircoin.ai` is set in DO prod env vars** (`prod_env.txt:4`). This step must run at cutover.

- In DO App Platform → `repaircon-prod` → Settings → App-level Environment Variables:
  - Current value: `COOKIE_DOMAIN=.repaircoin.ai`
  - Change to: `COOKIE_DOMAIN=.fixflow.ai`
- Save → triggers backend redeploy (expect 10–30s micro-gap per the 1-instance topology — schedule during evening PH window).
- Also update `FRONTEND_URL` in DO prod env: `https://repaircoin.ai` → `https://www.fixflow.ai` (affects email template reset-link preview + swagger contact URL; backward-compat defaults would keep the old value until this env var flips).
- Also update `CORS_ORIGIN` in DO prod env: `https://repaircoin.ai,https://www.repaircoin.ai` → add `,https://fixflow.ai,https://www.fixflow.ai`. (Note: backend code also has a hardcoded CORS allowlist that already includes all fixflow.ai origins via the Phase 1 CORS PR — the env var is a supplemental allowlist.)
- Effect: new JWT cookies bind to `.fixflow.ai` so subsequent auth on `www.fixflow.ai` ↔ `api.fixflow.ai` flows cleanly. Cookies on the old `.repaircoin.ai` domain are effectively orphaned — browsers won't send them to fixflow.ai anyway, so this is not a regression.
- **Rollback:** revert all three env vars (`COOKIE_DOMAIN`, `FRONTEND_URL`, `CORS_ORIGIN`) and redeploy. 2 minutes per redeploy.

**Note:** active web users are logged out at cutover regardless — cookies are scoped to `.repaircoin.ai` and won't transmit to `www.fixflow.ai`. This step ensures going-forward sessions work correctly on the new domain; it does not preserve existing sessions.

**Also flip at cutover (new env vars introduced in Phase 2 env-ification):**
- `MOBILE_DEEP_LINK_SCHEME` → **DO NOT flip yet** — leave as `repaircoin` (or unset, which defaults to `repaircoin`). Flip to `fixflow` only after mobile rebuild with `scheme: ["repaircoin", "fixflow"]` is in users' hands (Phase 5+).
- `PUBLIC_ASSET_URL` → set to `https://fixflow.ai` (marketing email logo source). Optional — can defer if assets aren't yet served from fixflow.ai.
- `SUPPORT_EMAIL` → keep as `support@repaircoin.ai` for Phase 3 (email brand is a Phase 5 concern); flip to `support@fixflow.ai` only when email domain migrates.
- `API_PUBLIC_URL` → set to `https://api.fixflow.ai` (swagger "Production server" URL).

**Step 3.3 — Update external service endpoints (operator)**

**Stripe dashboard** — *Simpler than originally planned.* Per 2026-04-22 inventory: the single active webhook endpoint (`repaircoin-staging-s7743....an.app/api/shops/webhooks/stripe`) targets a DigitalOcean-generated hostname, not `api.repaircoin.ai`. **DO-generated hostnames do not change with the domain migration**, so no Stripe webhook change is strictly required at cutover. **Action items:**
- [ ] Toggle Stripe dashboard between test/sandbox mode and live mode to verify there isn't a SEPARATE prod-live webhook still using `*.repaircoin.ai`. If one exists, add a fixflow.ai counterpart and keep both live for 1–2 weeks.
- [ ] Confirm (not cutover-blocking): is `STRIPE_MODE=test` in prod intentional? Real shops are paying with test cards. Flag to team.

**Google Cloud Console** (OAuth credentials for Gmail + Calendar integrations): add fixflow.ai variants to Authorized redirect URIs. Keep repaircoin.ai URIs. Do not remove. **Pending operator access as of 2026-04-22.**
- ⚠️ **Pre-existing bug to fix here too (not migration-related but urgent):** `GOOGLE_CALENDAR_REDIRECT_URI` in both prod and staging env is `http://localhost:4000/api/shops/calendar/callback/google` — the "Connect Google Calendar" feature is currently broken in production. Fix to the correct prod URI (`https://api.repaircoin.ai/...`) when access is restored, and add the fixflow.ai counterpart for post-cutover. File as a separate bug ticket.

**Thirdweb dashboard** — *No action required at cutover.* Per 2026-04-22 inventory: the Thirdweb project shows "No Domains Configured" (Client ID unrestricted — works from any origin). Confirm the OTHER project (RCN vs RCG — screenshot was of the `test` subproject) is also unrestricted. If either project DOES have domain restrictions later, add fixflow.ai + www.fixflow.ai alongside the existing repaircoin.ai entries.

**Step 3.4 — Verify cutover success**

- [ ] Visiting `https://repaircoin.ai` returns a 301 response (use curl with `-I`) → Location: `https://fixflow.ai/`
- [ ] Visiting `https://fixflow.ai` serves the app normally
- [ ] Browser dev tools on fixflow.ai show API calls going to `api.fixflow.ai`
- [ ] `https://api.repaircoin.ai/api/health` still returns 200 (mobile app compatibility)
- [ ] Vercel + DO dashboards show no error rate spike
- [ ] A sample booking flow end-to-end works on fixflow.ai (book → pay → shop receives new-booking email)
- [ ] Stripe test webhook from the dashboard lands on either endpoint successfully

### Rollback plan (Phase 3 only)

If the cutover breaks something:
- Step 3.1 reversal: in Vercel, swap primary back to `repaircoin.ai`, remove redirect on `fixflow.ai`. Takes ~30 seconds. All in-flight users return to the old domain on next navigation.
- Step 3.2 reversal: revert `NEXT_PUBLIC_API_URL` to `https://api.repaircoin.ai/api`. Redeploy. 1–2 minutes.

Because Phase 1+2 left both domains serving identical infra, rollback never leaves users stranded.

### Expected user-visible effects

- Users on `repaircoin.ai` → seamless 301 redirect to fixflow.ai. Transparent except for the URL-bar change.
- Users with an active web session (localStorage auth on repaircoin.ai) → **logged out**. `localStorage` is origin-scoped; sessions from repaircoin.ai don't carry to fixflow.ai. Users must re-authenticate.
  - Mitigation: send an in-app or email notice 24–48 hours before cutover ("We're moving to fixflow.ai. You'll need to sign in once more after the transition.").
- **Mobile apps unaffected** — they continue calling `api.repaircoin.ai`, which is a permanent alias to the same DO app.

---

## Phase 4 — Mobile Rebuild

**Duration:** ~half day. Can happen days/weeks after Phase 3 — not on the critical path.

The mobile app bakes `EXPO_PUBLIC_API_URL` into its binaries via `eas.json`. Existing installs keep hitting `api.repaircoin.ai`, which works because we're keeping the alias alive. New binaries should point at the new primary.

### Engineer

- Confirm `mobile/eas.json` profiles have `api.fixflow.ai` / `api-staging.fixflow.ai` URLs.
- **Add the new deep-link scheme in `mobile/app.config.ts`:** change `scheme: "repaircoin"` → `scheme: ["repaircoin", "fixflow"]`. Expo accepts an array and registers both — new builds answer `repaircoin://...` AND `fixflow://...`. This preserves the live Stripe return-URL contract (backend still emits `repaircoin://...` unchanged) while registering the new brand for future use.
- Bump app version in `mobile/app.config.ts` (currently `version: "1.0.0"` — bump per Expo convention).
- Run `npx eas build --profile production-apk --platform android`.
- Repeat for iOS production.
- Test the fresh build on a physical device before submission. **Specifically verify the Stripe payment flow** — book a service, pay via Stripe, confirm the return-URL bounces back into the app correctly. (Regression risk because of the scheme array change.)

### Operator

- Submit new builds to Google Play and Apple App Store.
- Update store listings (if URLs in description point at repaircoin.ai).
- **Critical:** do not decommission `api.repaircoin.ai` after mobile store approval. Many users won't auto-update for weeks. Keep `api.repaircoin.ai` alive **indefinitely** as a silent alias.

---

## Phase 5 — Soak & Cleanup

**Duration:** 2–4 weeks. Ongoing monitoring.

### What to monitor

- Vercel + DO error rates (look for CORS errors — indicates a missed hardcoded URL)
- Email bounce rates — if any email links broke or were cached with old URLs
- Stripe webhook delivery logs — both old and new endpoints; make sure nothing is stranded
- DO access logs split by hostname — track how much traffic still hits `api.repaircoin.ai` (old mobile installs)

### Cleanup checklist after 30 days

- [ ] Remove the old Stripe webhook endpoint (repaircoin.ai one) — only after observing zero fresh events land on it for several days
- [ ] Remove old OAuth redirect URIs from Google Cloud (after mobile fully migrated AND no webhook callbacks use them)
- [ ] **Keep repaircoin.ai DNS + Vercel redirect live indefinitely** — SEO preservation, external-link integrity
- [ ] **Keep `api.repaircoin.ai` alive indefinitely** — mobile app binaries with the old URL never stop requesting it
- [ ] Remove repaircoin.ai from Thirdweb allowed origins only if confident no user session uses it (probably leave)

### Optional brand migration (operator, any pace)

- Email-sending domain / from-address: set up SPF/DKIM/DMARC on fixflow.ai, migrate outbound email headers
- Support documentation, marketing site, social media bios
- Legal / trademark review of fixflow.ai

---

## Responsibilities Split

| Phase | Engineer (codebase) | Operator (infrastructure / external systems) |
|---|---|---|
| 0. Prep | Inventory codebase references; confirm auth storage mechanism | Lower DNS TTLs; confirm Vercel/DO/GoDaddy capacity; inventory external service references; decide cutover window |
| 1. Parallel infra | Prepare CORS PR | Add DNS records, Vercel domains, DO domains; verify parallel serving |
| 2. Codebase prep | Update CORS, env-ify hardcoded URLs, audit email/OG/sitemap; stage-test each change | Review/merge PRs; spot-check staging after each deploy |
| 3. Cutover | Flip `NEXT_PUBLIC_API_URL` env var and redeploy | Flip Vercel primary; configure repaircoin.ai redirect; update Stripe webhook, Google OAuth, Thirdweb origins |
| 4. Mobile rebuild | Bump version, run EAS builds | Test, submit to stores; keep api.repaircoin.ai alive permanently |
| 5. Soak & cleanup | Respond to any caught hardcoded-URL issues | Monitor dashboards; decommission old Stripe endpoint after soak; brand migration at team's pace |

---

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| DNS propagation delay slows rollback | Low if TTLs lowered | Short bump | Lower TTLs 24h in advance (Phase 0) |
| SSL cert not issued before primary flip | Low | Users hit cert warnings | Verify Phase 1 SSL status before Phase 3 begins |
| Hardcoded `repaircoin.ai` in codebase we missed | Medium | User-visible broken link/email | Phase 2 audit + full staging regression before Phase 3 |
| Users logged out at cutover (localStorage origin scope) | Certain | One-time re-auth for active web sessions | Accept; send advance notice to reduce surprise |
| Old mobile builds break | Low | Large install base broken | Keep `api.repaircoin.ai` as permanent alias — no decommission |
| Stripe webhooks stranded | Low | Payment events lost | Dual-endpoint config, keep both live 1–2 weeks |
| OAuth redirect URI mismatch | Low-medium | Integration breaks for shops using Gmail/Calendar | Pre-authorize fixflow.ai URIs in Phase 1 alongside repaircoin.ai |
| Email links in historical emails still reference repaircoin.ai | Certain | None — 301 redirect handles | Acceptable — redirect is transparent |
| SEO backlink loss | Low | Some ranking drift | 301 redirect transfers PageRank per Google guidelines; monitor Search Console |
| Service worker caches old URLs | Medium on repeat visitors | Stale bundles for some users | Bump SW cache key as part of Phase 2; service worker revalidation handles cleanup |
| Cookies scoped to .repaircoin.ai — going-forward sessions on fixflow.ai won't set cookies correctly | **Confirmed 2026-04-22: `COOKIE_DOMAIN=.repaircoin.ai` IS set in DO prod env.** Without mitigation: users re-login successfully at cutover but next session also fails silently (cookie set with wrong domain). | High without mitigation; none with mitigation | Phase 3 Step 3.2a: flip `COOKIE_DOMAIN` from `.repaircoin.ai` to `.fixflow.ai` at cutover (also flip `FRONTEND_URL` and `CORS_ORIGIN` together). Rollback = revert env vars + redeploy (2 min each). |
| Mobile deep-link scheme mismatch (Stripe return URL fails to reopen app) | Medium if handled naively | Users stuck on Stripe success page after payment, order status may lag | Phase 2 env-ify backend scheme (default unchanged). Phase 4 mobile build registers `scheme: ["repaircoin", "fixflow"]` (both). Backend env flip to `fixflow` only after new build penetration is acceptable. Never flip backend scheme unilaterally without a matching mobile build in the wild. |

---

## Open Questions for Operator (before Phase 2 starts)

1. ~~Vercel plan tier~~ — **Confirmed Pro (Active)** on 2026-04-21 from billing screenshot. Multiple custom domains supported without limit concern. Current usage $1.89 / $20 included credit → adding fixflow.ai does not change Vercel billing.
2. ~~Is `fixflow.ai` already live on the GoDaddy account or just reserved?~~ — **Confirmed on 2026-04-21**: FixFlow appears as a managed business entity in the same GoDaddy account (Miguel Rodriguez) alongside repaircoin.ai-related entities. Domain ownership is not a blocker. Still needs a quick check at the domain detail level to confirm (a) nameservers are Vercel/GoDaddy-managed and not parked elsewhere, and (b) no pending-transfer or WHOIS hold is active.
3. Migrate staging (`staging.fixflow.ai`) alongside production, or leave staging on the old domain? — **Pending** (recommended: yes, effectively free given single-project architecture)

**Additional questions answered 2026-04-22 via operator's external inventory:**
8. ~~`COOKIE_DOMAIN` set in prod?~~ — **Answered: YES, value is `.repaircoin.ai`.** Phase 3 Step 3.2a required.
9. ~~DO prod instance count?~~ — **Answered: 1 container.** Deploy micro-gap confirmed.
10. ~~Stripe webhooks use api.repaircoin.ai?~~ — **Answered: NO.** Single active webhook targets a DO-generated hostname. No Stripe action required at cutover for webhooks.
11. ~~Thirdweb domain restrictions configured?~~ — **Answered: NO.** Client ID unrestricted, works from any origin. No Thirdweb action required at cutover.

**Still pending:**
12. ~~Google Cloud Console OAuth redirect URIs — awaiting operator access.~~ **Refined 2026-04-22 afternoon:** operator has access to wrong project (dev-only, `nifty-stage-491303-n3`). Production project (`854830853827`) owned by Zeff (`jzeffsomera@gmail.com`). Awaiting Zeff to either grant IAM access OR make changes himself. Pre-existing localhost redirect URI bug in prod env blocked until this is resolved. Fallback Path B (switch prod to dev Client ID) available if Zeff doesn't respond by 2026-04-24.
13. Play Store + App Store listing URLs — awaiting operator access.
14. Is there a separate `repaircon-staging` DO app, or does prod backend autodeploy from main double as staging? Affects pre-cutover validation approach.
15. Stripe `STRIPE_MODE=test` in prod — intentional pre-launch state, or oversight? Non-blocking for migration but flag to team.
4. ~~Preferred cutover window~~ — **Answered 2026-04-21:** evening PH time (UTC+8). Target 20:00–23:00 PH = 12:00–15:00 UTC. Specific hour within that window TBD based on traffic patterns; recommend 21:00 PH (13:00 UTC).
5. ~~Timeline pressure~~ — **Answered 2026-04-21:** cutover target is 5 days from now, i.e. **2026-04-26**. Means Phase 0 TTL lowering must happen by 2026-04-25, Phase 1 parallel infra must complete by 2026-04-25 mid-day to leave a full day of soak, Phase 2 codebase prep can start immediately and be complete by 2026-04-24.
6. ~~Branded email-sending domain~~ — **Answered 2026-04-21:** current sending config uses Gmail SMTP (`smtp.gmail.com`) with `EMAIL_FROM=RepairCoin <noreply@repaircoin.com>`. FROM address uses `.com` TLD, already decoupled from the web's `.ai` domain. **Recommended**: ship the web migration with FROM unchanged — zero scope creep. Plan email-FROM migration as a Phase 5 follow-up after the site is stable. See "Email-sending notes" section below for details.
7. ~~Mobile deep-link URL scheme~~ — **Answered 2026-04-21 (corrected):** mobile app declares `scheme: "repaircoin"` at `mobile/app.config.ts:14`. Backend generates `repaircoin://shared/payment-sucess` and `repaircoin://shared/payment-cancel` URLs at `backend/src/domains/ServiceDomain/services/PaymentService.ts:491-492` and `backend/src/domains/shop/routes/purchase.ts:461-462` — these are Stripe success/cancel redirect targets that bounce back into the mobile app after payment. **This is a load-bearing deep link.** Plan: (a) Phase 2 env-ify the backend scheme (default `repaircoin`, no behavior change yet); (b) Phase 4 mobile rebuild declares BOTH schemes via `scheme: ["repaircoin", "fixflow"]` (Expo supports arrays) so the new build accepts both and nothing breaks for users on the old build during the transition; (c) Phase 5+ after adoption of the new build, flip the env to `fixflow` and eventually drop the legacy scheme.

### Additional operator verifications to confirm before Phase 1

- ~~Vercel project structure~~ — **Confirmed on 2026-04-21**: single project `repair-coin` with branch-per-subdomain routing (see Decision Log). Target setup adds new domains to the same project mapped to the existing branches.
- ~~GoDaddy ownership of fixflow.ai~~ — **Confirmed on 2026-04-21**: FixFlow is a managed business in the same GoDaddy account. One last drill-down verification needed at the fixflow.ai domain detail: (a) nameservers point where we can control them (GoDaddy's default or a DNS host we manage), (b) no pending-transfer / WHOIS hold / just-purchased 60-day lock, (c) domain is active (not expired/parked).
- **Canonical-URL preference:** confirm Option A (canonical `www.fixflow.ai`, bare redirects to www — preserves current pattern) vs Option B (canonical bare `fixflow.ai`, www redirects — modern SPA pattern). Recommended Option A.

---

## Decision Log

| Date | Decision | By | Rationale |
|---|---|---|---|
| 2026-04-21 | Vercel plan confirmed as Pro (Active) | Operator, verified via billing screenshot | Removes plan-tier concern as a blocker; multiple custom domains per project fully supported. Adding fixflow.ai does not change Vercel billing. |
| 2026-04-21 | `fixflow.ai` not yet added to Vercel team | Verified via team-level Domains page | Only repaircoin.ai present, marked "Third Party". Phase 1 will Add Existing at team level before assigning to the project. |
| 2026-04-21 | Vercel uses **single project `repair-coin` with branch-per-subdomain routing** (not separate prod/staging projects) | Verified via Projects view and repaircoin.ai domain detail | `www.repaircoin.ai` → prod branch; `staging.repaircoin.ai` → main branch; bare `repaircoin.ai` 301-redirects to www. Phase 1 adds fixflow.ai variants to the same project mapped to the same branches. Simplifies the cutover — one project's domains-panel holds every change. |
| 2026-04-21 | Current canonical is `www.repaircoin.ai` (bare `repaircoin.ai` 301s to www) | Observed in Connected Projects panel on repaircoin.ai domain detail | Decision recommended for fixflow.ai: **Option A — preserve www canonical** (`www.fixflow.ai`). Operator to confirm before Phase 3 cutover. |
| 2026-04-21 | `fixflow.ai` confirmed in the same GoDaddy account as repaircoin.ai | Verified via GoDaddy dashboard screenshot — FixFlow listed as a managed business entity | Unblocks Phase 1 DNS work. Still need a domain-level check for nameserver state + no pending transfer/hold, but ownership is confirmed. |
| 2026-04-21 | Operator's GoDaddy access temporarily revoked; awaiting re-approval from the owner | Reported by operator | **Temporarily blocks** Phase 0 TTL lowering, Phase 1 DNS records, and Phase 3 cutover. **Does NOT block** Phase 2 codebase prep (CORS, env-ification, email-template audit, mobile eas.json profiles). Engineer can proceed on Phase 2 in parallel so the team is ready the moment DNS access returns. |
| 2026-04-21 | Cutover window set to **evening PH time (UTC+8)**, target 21:00 PH / 13:00 UTC | Operator decision | Evening PH typically low-traffic for the region; aligns with most users being asleep and admins available for monitoring. |
| 2026-04-21 | Timeline pressure: **cutover target 2026-04-26** (5 days from now) | Operator decision | Phase 0 TTLs must be lowered by 2026-04-25. Phase 2 codebase work starts now. Phase 1 parallel infra needs GoDaddy access back by 2026-04-24 at latest to leave a soak day. |
| 2026-04-21 | Email FROM domain is `@repaircoin.com` (not `.ai`), via Gmail SMTP | Verified in backend/.env and EmailService.ts | Already decoupled from the web domain. Migrating the email-sending identity is a **separate Phase 5+ task**, not part of the web cutover. Keep `noreply@repaircoin.com` unchanged during migration. |
| 2026-04-21 | ~~No custom-scheme mobile deep links detected~~ **Corrected: `repaircoin://` IS in active use.** | `mobile/app.config.ts:14` declares `scheme: "repaircoin"`. Backend hardcodes `repaircoin://shared/payment-sucess` and `repaircoin://shared/payment-cancel` in `PaymentService.ts:491-492` and `shop/routes/purchase.ts:461-462` (Stripe return URLs). | The earlier grep only searched `mobile/`, missing backend emitters. Load-bearing for mobile payment flows. Plan: Phase 2 env-ify backend (default unchanged); Phase 4 mobile rebuild with `scheme: ["repaircoin", "fixflow"]` for backward-compat; Phase 5+ phase out legacy scheme once old builds age out. |
| 2026-04-22 | **`COOKIE_DOMAIN=.repaircoin.ai` IS set in DO prod env** | Operator shared `prod_env.txt` | Phase 3 Step 3.2a is now a **required** step (not conditional). Flip to `.fixflow.ai` at cutover alongside `FRONTEND_URL` and `CORS_ORIGIN` env var updates. |
| 2026-04-22 | **DO prod backend = 1 container** ($12/mo, 1 Shared vCPU, 1 GB RAM) | web-services.png screenshot of `repaircon-prod` DO App component settings | Deploy micro-gap confirmed: 10–30s window per redeploy. All deploys (Phase 1 CORS merge, Phase 2 env-ification merge, Phase 3 cutover) must be scheduled within the evening PH cutover window to minimize blast radius. |
| 2026-04-22 | **DO prod backend autodeploys from `main` branch** | web-services.png — `Branch: main, Autodeploy: On` | Merging to `main` triggers immediate prod backend redeploy. Phase 1/2 commits are backward-compatible so safe to deploy any time, but timing still matters due to 1-instance micro-gap. **Open question:** is there a separate `repaircon-staging` DO app on a different branch, or does prod backend double as staging? Affects whether there's a pre-cutover validation environment for backend changes. |
| 2026-04-22 | **Stripe prod webhook targets DO-generated hostname, not api.repaircoin.ai** | stripe.png — active endpoint `repaircoin-staging-s7743....an.app/api/shops/webhooks/stripe` | **No Stripe action required at cutover for webhooks.** DO-generated hostnames are stable across domain migration. Only remaining Stripe task: toggle dashboard to live mode to verify no separate prod-live webhook references `*.repaircoin.ai`. |
| 2026-04-22 | **Thirdweb project has no domain restrictions** | thirdweb.png — "No Domains Configured" state | **No Thirdweb action required at cutover.** Client ID works from any origin (including fixflow.ai). Spot-check the OTHER Thirdweb project (RCN vs RCG — screenshot was one of them) to confirm same state. |
| 2026-04-22 | **`STRIPE_MODE=test` in production** (non-blocking) | `prod_env.txt:39` — `sk_test_...` Stripe key prefix | Not a migration blocker, but worth confirming with team: real shops are paying with test cards in prod. Intentional pre-launch state? Or oversight? Flag separately. |
| 2026-04-22 | **Pre-existing bug flagged (non-migration):** `GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:4000/...` in prod | `prod_env.txt:54` | "Connect Google Calendar" feature broken in production. File separate bug. Fix to `https://api.repaircoin.ai/api/shops/calendar/callback/google` ASAP; add `https://api.fixflow.ai/...` counterpart at Phase 3 once Google Cloud Console access is restored. |
| 2026-04-22 | **fixflow.ai DNS is delegated to Hostinger, not GoDaddy** | Screenshot of GoDaddy DNS tab showing `DNS Provider: Hostinger` | Adding records at GoDaddy has no effect. Two paths: (A) switch nameservers back to GoDaddy (1-24h propagation window), or (B) edit records at Hostinger directly (zero downtime, requires Hostinger account access). Compounded by: fixflow.ai currently serves a live marketing/lead-gen landing page that will be replaced on any DNS change. **Paused pending owner confirmation** on (1) is marketing page a placeholder or content to preserve, (2) Hostinger access available, (3) email on @fixflow.ai. |
| 2026-04-22 | **TTL lowering on repaircoin.ai records COMPLETE at 600s** | GoDaddy enforces 600s minimum custom TTL (not 300s as originally targeted); 600s is acceptable for 10-min rollback. Applied to CNAMEs `www`, `api`, `staging`, `api-staging`; `A @` was already at 600s. | Propagation completes ~2026-04-23 mid-day. Strategy doc updated to reflect 600s floor instead of 300s. |
| 2026-04-22 | **Production + staging Google Cloud project is owned by Zeff (`jzeffsomera@gmail.com`), not operator** | Git log: `Zeff01 <jzeffsomera@gmail.com>` is exclusive author of all Google OAuth commits (2026-03-25 feat, 2026-03-30 fix). Operator's Google Cloud access is to a different dev-only project (`nifty-stage-491303-n3`) that holds a separate dev Client ID (`389596546887-rl181dtaae...`) matching `backend/.env` but NOT matching prod/staging env. | Awaiting Zeff to either (a) grant IAM access on project `854830853827`, or (b) make the Phase 3 redirect URI changes himself. Fallback Path B: switch DO prod + staging env vars to use operator's dev Client ID — small hygiene regression, unblocks cutover. Use only if Zeff doesn't respond by 2026-04-24. |
| 2026-04-22 | **Local dev OAuth client has staging.repaircoin.ai Gmail callback registered** | Screenshot of dev Client ID `389596546887` in Google Cloud Console shows URI 3: `https://staging.repaircoin.ai/api/shops/gmail/callback` | Leftover from earlier testing — this client isn't actually used by staging (staging env uses Zeff's `854830853827` client). Not cutover-blocking; can be cleaned up if pivoting to Path B. |

---

## Email-sending notes

The current transactional-email configuration sends from `RepairCoin <noreply@repaircoin.com>` via Gmail SMTP (`smtp.gmail.com`). The `.com` TLD is a deliberate separation from the web domain's `.ai` TLD — typical pattern for teams that own both.

**For the cutover itself:** do nothing. Keep `EMAIL_FROM=RepairCoin <noreply@repaircoin.com>` unchanged. Emails continue to arrive branded "RepairCoin" while the web shows "FixFlow." Users may briefly wonder why the email sender name and the website name differ, but it's not a broken state. No SPF/DKIM/DMARC work required.

**For the future Phase 5+ email-brand migration:** two paths.

1. **Add `noreply@fixflow.ai` as a "Send mail as" alias in the Gmail account.** Gmail verifies ownership by sending a confirmation link; once confirmed, set `EMAIL_FROM=FixFlow <noreply@fixflow.ai>` in backend env. Takes ~10 minutes. Works without new DNS records but deliverability depends on Gmail's spam heuristics — borderline. Best for low-volume.
2. **Full setup on fixflow.ai with SPF/DKIM/DMARC.** Proper domain-level authentication. Requires access to fixflow.ai DNS to add 3–4 TXT records. Then set `EMAIL_FROM=FixFlow <noreply@fixflow.ai>`. Takes ~1 hour of DNS + 24–48 hours for full propagation / DMARC alignment. Best for any volume. Better deliverability / not spam-flagged.

**Prerequisite check for Phase 5:** confirm whether the Gmail account actually owns a `@fixflow.ai` address (requires Google Workspace tenant on fixflow.ai, OR the Gmail account is set up with fixflow.ai as a custom domain). If not, step 1 isn't available and step 2 is required.

Keep `repaircoin.com` domain registered and renewing indefinitely — the FROM address continues to work and historical emails still render "from" correctly.

---

## Cutover Runbook (Compact)

Condensed sequence for the actual cutover hour, for reference during execution. Each line is atomic and reversible.

```
Phase 1 (day-of preparation, no user impact):
  1. Verify Phase 1 parallel setup complete — both domains serve app
  2. Verify Phase 2 CORS + env-prep deployed — staging regression clean
  3. Announce cutover to team in Slack

Phase 3 cutover window:
  4. [Vercel prod] Set fixflow.ai as Primary; repaircoin.ai as Redirect (301)
  5. [Vercel staging] Same for staging if migrating
  6. [Vercel env] Flip NEXT_PUBLIC_API_URL to https://api.fixflow.ai/api; redeploy
  7. [Stripe dashboard] Add new webhook endpoint to api.fixflow.ai
  8. [Google Cloud] Add fixflow.ai to OAuth redirect URIs
  9. [Thirdweb] Add fixflow.ai to Allowed Origins
  10. Verify smoke tests (curl, booking flow, webhook delivery)

Rollback (if needed at any step in 4-9):
  - Step 4: swap primary/redirect in Vercel
  - Step 6: revert NEXT_PUBLIC_API_URL env, redeploy
  - Later steps: remove newly-added entries

Phase 4 (deferred, not on cutover day):
  11. Build + submit new mobile binaries with api.fixflow.ai URL

Phase 5 (weeks later):
  12. Decommission old Stripe webhook (after observation window)
  13. Keep everything else permanent
```

---

## Notes

- **Related strategy doc:** `docs/tasks/strategy/staging-to-production-deployment.md` — the main→prod merge workflow. Unaffected by this domain migration but worth re-reviewing once per-domain DNS configs solidify in case the command sequence changes.
- **`api.repaircoin.ai` as permanent alias:** this is the single most important mitigation for "do not break existing mobile users." The cost of keeping a DNS record + TLS cert alive forever is effectively zero. Do not decommission, ever.
- **Session re-login at cutover:** unavoidable without a cross-origin auth bridge (out of scope). A pre-migration in-app banner + email to all authenticated shops/customers is the cheap mitigation.
- **Staging parity:** strongly recommend migrating staging (`staging.fixflow.ai`) at the same time to keep environment parity. Only real cost is a couple extra DNS records and domain adds. Avoids "works on staging, fails on prod" domain-related bugs.
- **Email-sending domain:** separate concern from this migration. Apps today probably send from a transactional provider (Gmail API in this codebase) with a specific `from:` address — if that's `@repaircoin.com`, the branded email migration requires DNS work on fixflow.ai (SPF/DKIM/DMARC). Plan as Phase 5+ optional if not immediately needed.
- **Internationalisation:** no specific concerns here; both domains are .ai TLDs and geographic routing is unaffected.
- **Budget / billing:** Vercel per-project domain counts, DO per-app domain counts, and GoDaddy renewal for fixflow.ai are trivially in scope but worth confirming as part of Phase 0.
