# Stage 0 — Concrete Build Scope (Ads System Foundation)

**Status:** Ready to build. Companion: `ads-system-implementation-plan.md` (§3 Stage 0).
**Created:** 2026-06-11. **Branch:** `deo/ads-system-stage-0-foundation` off `main`.
**Goal:** schema + role-scoped CRUD wiring so Stages 1-5 are pure feature work. No user-visible UI.

---

## 0. Reality-checks vs the plan (read first)

The plan's §3 Stage 0 was written before checking the live codebase. Three concrete adjustments:

1. **Roles.** The JWT only carries `role: 'admin' | 'shop' | 'customer'` (`src/middleware/auth.ts:12`).
   The plan's `super_admin` / `ads_manager` / `employee` roles **do not exist** and adding them is a
   large auth change. For v1:
   - `super_admin` + `ads_manager` → both collapse to the existing **`admin`** role
     (`requireRole(['admin'])`). Fine-grained ads-manager-vs-super-admin is a v2 admin-permissions
     refinement (a sub-permission flag on admin users), explicitly deferred.
   - `shop_owner` → existing **`shop`** role + shopId-from-JWT scoping.
   - `employee` → **not built in v1** (Q10: shop owner is the sole assignee; no employee routing).
     The `assigned_to_employee_id` column still ships (nullable, future-proof) but no employee role/auth.
2. **Migration numbers.** Current max applied = **145**. Stage 0 uses **146 + 147**. Re-check the
   next-free number across all branches/remotes at branch-cut time (the runner keys on the integer
   version PRIMARY KEY; a duplicate number silently skips one file's SQL — see the migration-collision
   incident). Two files, not the plan's three (safeguards folded into 146 — no benefit to splitting).
3. **IDs.** Ads tables use `UUID DEFAULT gen_random_uuid()` (the plan specs `service_orders.ad_lead_id`
   as a UUID FK). `shop_id` is `TEXT` (FK → `shops.shop_id`); `customer_id` is `TEXT` (FK → `customers.address`).

---

## 1. Migrations

### `146_create_ads_tables.sql`

```sql
-- 146_create_ads_tables.sql
-- Ads System Stage 0 — foundation tables. Additive; no existing table touched here
-- (service_orders ALTER is 147). All UUID PKs. shop_id TEXT FK shops(shop_id),
-- customer_id TEXT FK customers(address). See docs/tasks/strategy/ads-system/.

-- Reference: industries (seeded). Slug used in code; name shown in UI.
CREATE TABLE IF NOT EXISTS industries (
  id          SERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO industries (slug, name) VALUES
  ('repair','Repair'), ('landscaping','Landscaping'), ('gyms','Gyms'),
  ('nail_salons','Nail Salons'), ('barbershops','Barbershops'),
  ('lawyers','Lawyers'), ('plumbing','Plumbing'), ('electricians','Electricians')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS ad_campaigns (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id              TEXT NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  industry_id          INT  REFERENCES industries(id),
  name                 TEXT NOT NULL,
  platform             TEXT NOT NULL DEFAULT 'meta',     -- meta | google | ...
  target_radius_miles  NUMERIC(6,2),
  target_units         TEXT NOT NULL DEFAULT 'mi',       -- mi | km
  daily_budget_cents   INT  NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','active','paused','archived')),
  ai_agent_enabled     BOOLEAN NOT NULL DEFAULT false,
  notes                TEXT,
  started_at           TIMESTAMPTZ,
  paused_at            TIMESTAMPTZ,
  archived_at          TIMESTAMPTZ,
  created_by           TEXT,                              -- admin wallet/id
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_shop   ON ad_campaigns (shop_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON ad_campaigns (status)  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS ad_creatives (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  creative_type     TEXT NOT NULL CHECK (creative_type IN ('image','video','carousel')),
  language          TEXT NOT NULL DEFAULT 'en',
  landing_url       TEXT,
  landing_url_type  TEXT CHECK (landing_url_type IN ('booking_page','shop_profile','lead_form')),
  headline          TEXT,
  body              TEXT,
  experiment_id     UUID,                                 -- reserved (Stage 5 A/B)
  version           INT  NOT NULL DEFAULT 1,
  -- Q8 LOCKED: creatives are reviewed before launch in v1.
  review_status     TEXT NOT NULL DEFAULT 'pending'
                      CHECK (review_status IN ('pending','approved','rejected')),
  reviewed_by       TEXT,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ad_creatives_campaign ON ad_creatives (campaign_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS ad_leads (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id             UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  creative_id             UUID REFERENCES ad_creatives(id),
  customer_id             TEXT REFERENCES customers(address),  -- populated on convert (Stage 2)
  name                    TEXT,
  phone                   TEXT,
  email                   TEXT,
  messenger_id            TEXT,
  whatsapp_id             TEXT,
  lead_status             TEXT NOT NULL DEFAULT 'new'
                            CHECK (lead_status IN ('new','contacted','booked','paid','completed','lost')),
  assigned_to_employee_id TEXT,                            -- nullable; no employee role in v1 (Q10)
  first_response_at       TIMESTAMPTZ,
  consent_to_contact      BOOLEAN NOT NULL DEFAULT false,
  consent_version         TEXT,
  attribution_method      TEXT NOT NULL DEFAULT 'manual'
                            CHECK (attribution_method IN ('manual','utm','click_id','meta_webhook')),
  is_duplicate            BOOLEAN NOT NULL DEFAULT false,  -- used by Stage 2 dedupe
  ip_address              TEXT,
  user_agent              TEXT,
  notes                   TEXT,
  lost_reason             TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_leads_campaign ON ad_leads (campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_leads_status   ON ad_leads (lead_status);
CREATE INDEX IF NOT EXISTS idx_ad_leads_phone    ON ad_leads (phone);

-- roi is NOT stored (Q5) — computed at read by RoiCalculator.
CREATE TABLE IF NOT EXISTS ad_performance_daily (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id              UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  date                     DATE NOT NULL,
  timezone                 TEXT NOT NULL DEFAULT 'America/New_York',
  spend_cents              INT  NOT NULL DEFAULT 0,
  impressions              INT  NOT NULL DEFAULT 0,
  clicks                   INT  NOT NULL DEFAULT 0,
  leads_captured           INT  NOT NULL DEFAULT 0,
  conversations_started    INT  NOT NULL DEFAULT 0,
  messages_received        INT  NOT NULL DEFAULT 0,
  avg_first_response_minutes NUMERIC(8,2),
  bookings_created         INT  NOT NULL DEFAULT 0,
  revenue_cents            INT  NOT NULL DEFAULT 0,
  revenue_30d_cents        INT,                            -- lazy-filled (Stage 5 cohort)
  revenue_90d_cents        INT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, date)
);

CREATE TABLE IF NOT EXISTS ad_safeguards_state (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id                   UUID NOT NULL UNIQUE REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  auto_pause_threshold_cents    INT NOT NULL DEFAULT 40000,  -- $400 spent, 0 leads → soft alert
  auto_pause_no_bookings_cents  INT NOT NULL DEFAULT 80000,  -- $800 spent, 0 bookings → hard pause
  paused_by_safeguard_at        TIMESTAMPTZ,
  paused_reason                 TEXT,
  notes                         TEXT
);
```

### `147_add_ad_lead_id_to_service_orders.sql`

```sql
-- 147_add_ad_lead_id_to_service_orders.sql
-- Ads attribution: link a service order back to the ad lead that produced it.
-- Backwards-compatible — existing rows stay NULL. Must run AFTER 146 (ad_leads).
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS ad_lead_id UUID REFERENCES ad_leads(id);
CREATE INDEX IF NOT EXISTS idx_service_orders_ad_lead ON service_orders (ad_lead_id)
  WHERE ad_lead_id IS NOT NULL;
```

> Verify `gen_random_uuid()` is available on staging (PG15 has it built-in; if a DB lacks it,
> prepend `CREATE EXTENSION IF NOT EXISTS pgcrypto;`).

---

## 2. Domain skeleton — `backend/src/domains/AdsDomain/`

Mirrors `ServiceDomain` (DomainModule: `name` + `routes` + `initialize()`; mounted at `/api/{name}`).

```
backend/src/domains/AdsDomain/
├── index.ts                       ← DomainModule (name='ads')
├── routes.ts                      ← initializeRoutes(): Router, mounted /api/ads
├── events.ts                      ← event-type constants (no listeners in Stage 0)
├── controllers/
│   ├── CampaignController.ts      ← CRUD (admin) + read (shop, own-scoped)
│   ├── CreativeController.ts      ← CRUD + approve/reject (admin)
│   ├── LeadController.ts          ← list/get/create/updateStatus (Stage 0: basic CRUD)
│   └── PerformanceController.ts   ← read perf (ROI computed-at-read)
├── services/
│   ├── CampaignService.ts         ← orchestration (thin in Stage 0)
│   ├── LeadAttributionService.ts  ← STUB in Stage 0 (impl Stage 2)
│   ├── RoiCalculator.ts           ← STUB in Stage 0 (impl Stage 1)
│   └── SafeguardEvaluator.ts      ← STUB in Stage 0 (impl Stage 1)
└── repositories/
    ├── CampaignRepository.ts      ← extends BaseRepository (real CRUD)
    ├── CreativeRepository.ts      ← extends BaseRepository
    ├── LeadRepository.ts          ← extends BaseRepository
    ├── PerformanceRepository.ts   ← extends BaseRepository
    └── SafeguardRepository.ts     ← extends BaseRepository
```

**`index.ts`** (complete):
```ts
import { DomainModule } from '../types';
import { initializeRoutes } from './routes';
import { logger } from '../../utils/logger';
import { Router } from 'express';

export class AdsDomain implements DomainModule {
  name = 'ads';
  routes: Router;
  constructor() { this.routes = initializeRoutes(); }
  async initialize(): Promise<void> {
    logger.info(`${this.name} domain initialized — Ads System (Stage 0)`);
  }
}
```

**Register in `app.ts`** (one line, next to the others ~line 387):
```ts
domainRegistry.register(new AdsDomain());   // + import at top
```

**Repositories** extend `BaseRepository` (no-arg constructor; `this.pool` from `getSharedPool()`).
Stage 0 implements straightforward CRUD: `create`, `findById`, `findByShop(paginated)`,
`update`, `softDelete` (set `deleted_at`). Use `withTransaction()` for multi-step writes.

**Services** `RoiCalculator` / `SafeguardEvaluator` / `LeadAttributionService` ship as **stubs**
(typed signatures + `throw new Error('not implemented — Stage 1/2')`) so the skeleton typechecks;
real logic is Stage 1/2.

---

## 3. Endpoints (Stage 0 CRUD surface) — mounted at `/api/ads`

Admin = `requireRole(['admin'])`. Shop = `requireRole(['shop'])` + shopId from JWT (never a path param).

- `POST   /api/ads/campaigns`                 admin — create campaign
- `GET    /api/ads/campaigns`                 admin — list (filter shop/status, paginated)
- `GET    /api/ads/campaigns/:id`             admin — detail
- `PATCH  /api/ads/campaigns/:id`             admin — update (status/budget/notes)
- `DELETE /api/ads/campaigns/:id`             admin — soft delete
- `POST   /api/ads/campaigns/:id/creatives`   admin — add creative
- `PATCH  /api/ads/creatives/:id`             admin — edit (bumps `version`)
- `PATCH  /api/ads/creatives/:id/review`      admin — approve/reject (Q8)
- `GET    /api/ads/leads`                     admin — list (filter campaign/status)
- `POST   /api/ads/leads/manual`              admin — manual lead (attribution_method='manual')
- `PATCH  /api/ads/leads/:id/status`          admin — change lead_status
- `GET    /api/ads/campaigns/:id/performance` admin — perf + ROI (computed-at-read)
- `GET    /api/ads/shop/campaigns`            shop  — own campaigns (read-only)
- `GET    /api/ads/shop/campaigns/:id/performance`  shop — own campaign perf (ownership-checked)
- `GET    /api/ads/shop/leads`                shop  — own leads (read-only)

Shop ownership: every shop endpoint resolves `shopId` from the JWT and the controller asserts the
target campaign/lead belongs to that shop before returning (mirrors the AIAgentDomain pattern —
shopId never comes from a path/body param).

---

## 4. EventBus events (`events.ts` — constants only; no listeners in Stage 0)

```ts
export const AdsEvents = {
  CAMPAIGN_CREATED:           'ads:campaign_created',
  CAMPAIGN_PAUSED_BY_SAFEGUARD:'ads:campaign_paused_by_safeguard',
  LEAD_CAPTURED:              'ads:lead_captured',
  LEAD_CONVERTED_TO_CUSTOMER: 'ads:lead_converted_to_customer',
  LEAD_BOOKED:                'ads:lead_booked',
} as const;
```
Publish via `eventBus.publish(createDomainEvent(AdsEvents.CAMPAIGN_CREATED, payload))` (existing
pattern, e.g. `ServiceDomain/controllers/OrderController.ts:357`). Stage 0 wires only
`CAMPAIGN_CREATED` (on create); the rest are reserved for Stages 1-3.

---

## 5. Permissions note (deferred granularity)

v1 uses `admin` for all ads management and `shop` for own-read. The plan's `ads_manager` (CRUD but
no settings/pricing) and `super_admin` distinction needs an admin sub-permission system that doesn't
exist yet — **deferred to v2**. Document this so no one assumes role-level gating is enforced in v1.
`employee` is not built (Q10); the `assigned_to_employee_id` column ships nullable for future use.

---

## 6. Acceptance criteria (Stage 0)

- [ ] `146` + `147` run cleanly on staging via the normal runner; objects exist; `service_orders.ad_lead_id` present.
- [ ] `AdsDomain` registered; `/api/ads/health`-style or a CRUD endpoint responds.
- [ ] `npm run build` (backend) exit 0 — skeleton + stubs typecheck.
- [ ] Admin can create a campaign + creative + manual lead via curl/Postman; shop can read its own campaign (and is blocked from another shop's).
- [ ] `requireRole` correctly rejects `customer`/unauth on every ads route; shop endpoints reject cross-shop access.
- [ ] No user-visible frontend (that's Stage 1). Feature flag `ADS_DASHBOARD_ENABLED` reserved (Stage 1 gates UI on it).

---

## 7. Effort

~1 week, one backend engineer: migrations (0.5d) → repositories CRUD (1.5d) → controllers + routes +
permissions (1.5d) → service stubs + events + registration (0.5d) → smoke test + acceptance (1d).
Frontend is Stage 1. No exec input outstanding (Q6/Q8 locked).
