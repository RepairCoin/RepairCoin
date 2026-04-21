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

**Last updated:** 2026-04-21 by engineer session.

**Cutover target:** 2026-04-26, evening PH time (21:00 PH = 13:00 UTC).
**Days remaining:** 5 from 2026-04-21.

### Where we are

| Phase | Engineer side | Operator side |
|---|---|---|
| Phase 0 — Planning & Prep | **In progress.** Deep-link scheme audit complete. Remaining: full grep audit, auth storage confirm, email template scan, mobile eas.json audit. | **Partially blocked.** TTL lowering + Vercel team-level domain add blocked on GoDaddy access (revoked, awaiting owner re-approval). External systems inventory can proceed now. |
| Phase 1 — Parallel Infra | **Can start now:** prepare CORS allowlist PR (draft only, no merge yet). | **Blocked on GoDaddy** for DNS records + Vercel team-level domain add. **Not blocked:** DO App Platform custom-domain adds can be configured immediately (SSL waits for DNS, but config is ready). |
| Phase 2 — Codebase Prep | Not started. Safe to start early on backward-compatible pieces (deep-link scheme env-ification, CORS allowlist). | Nothing until Phase 1 completes. |
| Phase 3 — Cutover | Not started. Gated by Phase 1 + Phase 2 verification. | Gated by Phase 1 + Phase 2. |
| Phase 4 — Mobile Rebuild | Not started. Post-cutover (not on critical path). | Post-cutover. |
| Phase 5 — Soak & Cleanup | Not started. | Not started. |

### What happened in this session (2026-04-21)

1. Strategy doc drafted with Phases 0–5, risk matrix, decision log, runbook.
2. Infrastructure state verified via operator screenshots: Vercel Pro, single `repair-coin` project with branch-per-subdomain routing, fixflow.ai in same GoDaddy account.
3. Operator decisions captured: cutover evening PH / 2026-04-26 / keep `noreply@repaircoin.com` during cutover / migrate staging in parallel (recommended, not yet confirmed).
4. Mobile deep-link scheme investigated — **corrected a prior wrong conclusion.** Found `scheme: "repaircoin"` in `mobile/app.config.ts:14` AND 4 backend emitters of `repaircoin://` (Stripe return URLs). Plan updated: Phase 2 env-ify, Phase 4 mobile registers both schemes via array.
5. GoDaddy access revoked mid-session — operator awaiting owner re-approval. This partially gates Phase 0 + Phase 1.

### Immediate next actions (if session crashes, resume here)

**Engineer (me) — next session start here:**
1. Run the "Phase 0 Engineer Inventory — Step-by-Step" below to produce the complete codebase grep audit. Commit the inventory to `docs/tasks/strategy/phase-0-inventory.md`.
2. Draft the CORS allowlist PR per "Phase 1 Engineer — CORS PR Step-by-Step" below. Leave as draft.
3. Deep-link scheme env-ification work: see Phase 2 section — fully backward-compatible so safe to start early, but **do it only after** #1 and #2 are complete so we have the inventory for context.
4. **Do not merge anything until operator confirms Phase 1 infra is provisioned.**

**Operator — next session start here:**
1. Track GoDaddy access restoration. The moment access returns, run "Phase 0 Operator — Step-by-Step" (TTL lowering) and "Phase 1 Operator — Step-by-Step" (DNS + Vercel + DO domain adds).
2. In parallel, complete "Phase 0 Operator — External Systems Inventory" — this doesn't need GoDaddy and produces the list of external dashboards that need redirect-URI updates in Phase 3.
3. Decide pending Open Questions #3 (migrate staging in parallel — recommended yes) and canonical www vs bare (recommended Option A — www).

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
- Edit each A / CNAME record currently pointing at Vercel or DO. For each: change TTL from default (usually 1 hour) to **300 seconds (5 minutes)**.
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

**Step 3.3 — Update external service endpoints (operator)**

- **Stripe dashboard:** add new webhook endpoint `https://api.fixflow.ai/api/shops/webhooks/stripe`. Copy the new `whsec_...` and add to DO backend env as an additional `STRIPE_WEBHOOK_SECRET` (or primary if the backend supports only one — check with engineer). **Keep the old webhook endpoint active for 1–2 weeks** so in-flight events finish cleanly.
- **Google Cloud Console** (OAuth credentials for Gmail + Calendar integrations): add fixflow.ai variants to Authorized redirect URIs. Keep repaircoin.ai URIs. Do not remove.
- **Thirdweb dashboard** (project settings): add fixflow.ai and www.fixflow.ai to Allowed Origins. Keep repaircoin.ai.

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
| Cookies scoped to .repaircoin.ai | N/A if using localStorage | None | Verified web uses localStorage, not cross-subdomain cookies; if wrong, re-evaluate |
| Mobile deep-link scheme mismatch (Stripe return URL fails to reopen app) | Medium if handled naively | Users stuck on Stripe success page after payment, order status may lag | Phase 2 env-ify backend scheme (default unchanged). Phase 4 mobile build registers `scheme: ["repaircoin", "fixflow"]` (both). Backend env flip to `fixflow` only after new build penetration is acceptable. Never flip backend scheme unilaterally without a matching mobile build in the wild. |

---

## Open Questions for Operator (before Phase 2 starts)

1. ~~Vercel plan tier~~ — **Confirmed Pro (Active)** on 2026-04-21 from billing screenshot. Multiple custom domains supported without limit concern. Current usage $1.89 / $20 included credit → adding fixflow.ai does not change Vercel billing.
2. ~~Is `fixflow.ai` already live on the GoDaddy account or just reserved?~~ — **Confirmed on 2026-04-21**: FixFlow appears as a managed business entity in the same GoDaddy account (Miguel Rodriguez) alongside repaircoin.ai-related entities. Domain ownership is not a blocker. Still needs a quick check at the domain detail level to confirm (a) nameservers are Vercel/GoDaddy-managed and not parked elsewhere, and (b) no pending-transfer or WHOIS hold is active.
3. Migrate staging (`staging.fixflow.ai`) alongside production, or leave staging on the old domain? — **Pending** (recommended: yes, effectively free given single-project architecture)
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
