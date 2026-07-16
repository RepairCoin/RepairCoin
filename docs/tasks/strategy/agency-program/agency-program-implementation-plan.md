# Agency Program — Implementation Plan

**Status:** Scoped, not started · greenfield build
**Relates to:** `pricing-alignment/pricing-rollout-task-breakdown.md` → **WS6** (Agency Program), which this plan scopes (T6.0).
**Addon:** `agency` — currently `coming_soon` (`frontend/src/services/api/addons.ts`).

---

## 1. Current state

- **Marketing page only** (`frontend/src/app/agency/page.tsx`): $999/mo, ≤10 client shops, +$50/client, unified dashboard, cross-client reporting, dedicated account manager, white-glove onboarding. "Apply Now" links to `/contact-us`.
- **Zero backend/app functionality.** WS6 is flagged **unscoped**; the addon is `coming_soon`.
- **Explicit non-goal:** affiliate shop groups are *peer coalitions*, **not** managed-client accounts. Agency = a **parent account that manages independent client shops**.

## Primitives to reuse

- **`shop_team_members`** (migration 173) — user↔shop access + scoped permissions; basis for "an agency user acts on a client shop."
- **Dedicated account manager** (`shops.account_manager_address` + admin "My Shops") — extend to the agency level.
- **Auto-active signup** (approval removed) — agency-onboarded clients go live immediately.
- **Stripe subscription plumbing** (`services/SubscriptionService`, `config/subscriptionPlans.ts`) — reuse for agency billing.
- **Deferred sibling — Multi-Location (T7.4)** — one owner, many branches — is *also* a parent→child hierarchy. Shape the agency hierarchy generically so multi-location can adopt it later.

---

## 2. Agreed defaults (decisions locked for v1)

| # | Decision | Default | Rationale |
|---|---|---|---|
| 1 | **Billing model** | **$999 replaces** client subscriptions (clients included); +$50/client beyond 10 | "10 client accounts for $999" only works as a reseller/wholesale model; additive would be absurd. |
| 2 | **Client entitlement tier** | Fixed **Growth-tier** for all agency clients | $50/client is a wholesale rate; Growth ($299 standalone) is generous but sane; Business ($599) would give away the top tier. |
| 3 | **Client creation** | Agency **creates new** client shops only (v1) | Matches white-glove onboarding; auto-activates. Linking existing shops needs consent + billing-transfer → later. |
| 4 | **Access / role** | New top-level **`agency` role**, reuse `shop_team_members` scoping to "act as" a client | Distinct identity above shops + proven per-shop access mechanics. |
| 5 | **White-label** | **FixFlow branding** throughout (v1); white-label deferred (T6.4) | Per-agency theming is a large separate build. |
| 6 | **Shared hierarchy w/ Multi-Location** | Build agency standalone now, but **shape parent→child schema generically** | Multi-location is deferred; don't build it, don't paint into a corner. |

**Net model:** an **Agency** pays **$999/mo** (Stripe), owns up to **10 agency-created client shops** with **Growth-tier** features included, managed from a **unified dashboard** with client-switching + cross-client reporting, **+$50/client** metered beyond 10, with a **dedicated account manager** — FixFlow-branded, standalone but hierarchy-generic.

---

## 3. Cross-cutting integration points (touch existing systems)

- **Entitlement:** an agency-managed shop is **Growth-qualified without its own subscription**. Hooks into `subscriptionGuard`/`operational_status` (backend) and `useFeatureAccess` (frontend): `shops.agency_id IS NOT NULL` ⇒ Growth features + bypass the per-shop paywall.
- **Auth:** new **`agency` role** in the JWT + `routes/auth.ts` middleware; agency tokens resolve to `{ agencyId, clientShopIds[] }`. "Act as client" issues a shop-scoped context the agency is authorized for.
- **Provisioning is admin/sales-assisted** (addon is `contact`/`coming_soon`; "Apply" → contact-us). **Admins create agencies**; agencies then self-serve client creation.

---

## 4. Per-slice task breakdown

Migrations continue from `215` → this migration is `221` (216–220 were already claimed on the shared staging DB by other branches; 221 was the next free number).

### Slice 0 — Foundations: agency entity, hierarchy, role  *(Backend, L)*
**Migration `221`:**
- `agencies` — `id`, `name`, `owner_wallet_address`, `contact_email`, `contact_phone`, `stripe_customer_id`, `stripe_subscription_id`, `status` (`pending|active|past_due|cancelled`), `client_limit` int default 10, `per_client_price_cents` default 5000, `account_manager_address` varchar(42), timestamps.
- `agency_clients` — `id`, `agency_id` FK, `shop_id` FK, `status` (`active|removed`), `added_at`, `removed_at`, **unique(`agency_id`,`shop_id`)**. *(Generic parent→child link.)*
- `shops` — add nullable `agency_id` + index.

**Backend:** new `AgencyDomain` (`index.ts`, `routes.ts` at `/api/agency`, controllers, services) + `AgencyRepository`. Auth recognizes `agency` role; middleware `resolveAgencyAccess(req)` → agencyId + authorized shopIds; `requireAgency`; act-as-client guard verifying `shop ∈ agency_clients`.
- `POST /admin/agencies` (admin) — provision agency + owner + optional AM.
- `GET /agency/me` — profile, client count/limit, AM contact.

**Acceptance:** admin creates an agency; owner authenticates + fetches `/agency/me`; access to a non-owned shop is denied.

### Slice 1 — Client management + entitlement  *(Backend + light FE, L)*
- `POST /agency/clients` — create a **new** client shop (reuse shop registration; auto-active, `agency_id` set, linked, entitlement = Growth). Enforce `client_limit` (soft — allow beyond 10 only with metering, Slice 4).
- `GET /agency/clients` — roster (shop + basic metrics + status).
- `DELETE /agency/clients/:shopId` — unlink (soft; **default: unlinked client is suspended until it subscribes on its own**).
- **Entitlement wiring:** `shops.agency_id IS NOT NULL` ⇒ Growth-qualified; central change in `subscriptionGuard` + `useFeatureAccess`.

**Acceptance:** agency creates a client → live with Growth features, no separate subscription; roster lists it; limit enforced at 10 until metering.

### Slice 2 — Agency dashboard + client switcher  *(Frontend, L)*
- Agency dashboard shell (reuse shop dashboard layout with an **agency context provider**).
- **Client roster** view (name, status, metrics, "Enter").
- **"Enter client"** → sets active shop context; agency operates that shop's existing dashboard (`ShopDashboardClient`), scoped by the act-as-client guard.
- **Client switcher** dropdown + **Add Client** flow.
- Route/role guard so only `agency` users reach it.

**Acceptance:** agency logs in → roster → enters a client → operates → switches client without re-login.

### Slice 3 — Cross-client reporting  *(BE + FE, M)*
- `GET /agency/analytics` — aggregate across roster: revenue, RCN issued/redeemed, orders, active customers; per-client rows + totals; date-range filter.
- Frontend agency **Overview**: rollup KPIs + per-client comparison table + trend charts (follow the dataviz guidance for new charts).

**Acceptance:** overview matches each shop's own analytics.

### Slice 4 — Billing rollup ($999 + $50/client)  *(Backend, M)*
- **Stripe:** base **$999** item (`STRIPE_PRICE_AGENCY_BASE`) + per-extra-client **$50** item (`STRIPE_PRICE_AGENCY_EXTRA_CLIENT`) as quantity/metered for clients beyond 10.
- On client add/remove: sync Stripe subscription quantity (`max(0, clients − 10)`).
- **Webhooks:** agency `customer.subscription.*` → set `agencies.status`; `past_due|cancelled` gates agency + client access (with grace).
- Provisioning: admin-create triggers Stripe customer + subscription (card checkout **or** manual/invoice, since sales-assisted).

**Acceptance:** 12 clients → billed $999 + 2×$50; removing decrements; cancelled agency subscription blocks access after grace.

### Slice 5 — Dedicated AM + go-live polish  *(M — partly reuses shipped work)*
- Reuse account-manager at agency level (`agencies.account_manager_address`); surface "Your Account Manager" on the agency dashboard (reuse `SupportLevelCard` pattern); add agencies to the admin assigned view.
- Flip addon `agency: coming_soon → active`; keep "Apply" sales-assisted (optionally record an `agency_applications` row instead of raw contact-us).
- Docs/QA pass.

**Acceptance:** assigned AM shows to the agency; addon reads active; end-to-end: provision → add clients → operate → billed → reported.

---

## 5. Suggested build order & sizing

`0 → 1 → 4 → 2 → 3 → 5` (hierarchy + entitlement + billing correct before heavy UI).
Rough sizing: **0/1 = L, 4 = M, 2 = L, 3/5 = M**. Multi-week; each slice independently shippable behind a flag.

## 6. Open decisions to confirm before Slice 1 code

- **Unlink behavior** — default: unlinked client is suspended until it subscribes on its own.
- **Owner identity** — default: wallet-based (consistent with shops).
- **Client limit** — default: **soft** (meter-and-allow beyond 10), never block revenue.
