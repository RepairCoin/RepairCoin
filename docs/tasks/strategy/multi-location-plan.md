# Multi-Location Management — Implementation Plan

**Status:** Slices 1 & 2 shipped (PR #516) · Slice 3 shipped (per-location operations) · Slices 4
(inventory) & 5 (staff) planned
**Tier:** Business ($599) — gated feature `multiLocation`
**Author:** Nico Regalado

## Summary

Let a single shop manage multiple physical locations under one account. The shop remains the
single billing / wallet / subscription / tier identity; each location is a physical site
(address, geo, phone, primary flag). Delivered in 4 additive, independently-shippable slices.

## Decisions

- **Data model:** new `shop_locations` table owned by one shop — NOT `parent_shop_id`
  (each-location-is-a-shop would fragment billing/tier/wallet across the codebase, which assumes
  `shop_id` = billing entity).
- **Gating:** `multiLocation: 'business'` in `config/featureTiers.ts` (backend + frontend mirror)
  → `requireTier('multiLocation')` on routes + `<TierGate feature="multiLocation">` on UI, fed by
  the existing `GET /shops/feature-access` map.
- **Permission:** existing `shop:manage` guards writes.
- **Billing/RCN/wallet stay shop-level** (not per location).

## Data model (`shop_locations`)

`id (uuid pk), shop_id (varchar100 FK→shops ON DELETE CASCADE), name, address,
location_city, location_state, location_zip_code, location_lat, location_lng, phone,
is_primary (bool), active (bool), created_at, updated_at`

- Partial unique index `uq_shop_locations_primary ON (shop_id) WHERE is_primary` → at most one
  primary per shop.
- First location auto-becomes primary; deleting the primary promotes the oldest remaining.
- Later slices add `location_id` FKs on other tables — not on this table.

---

## Slice 1 — Locations CRUD + management UI (current)

A Business-tier "Locations" tab: add / edit / delete locations, set the primary. No booking or
service rewiring.

**Backend**
- `migrations/192_create_shop_locations.sql`
- `repositories/ShopLocationRepository.ts` — list / get / create / update / setPrimary / delete
  (transactional primary invariants)
- `repositories/index.ts` — export `shopLocationRepository` singleton
- `config/featureTiers.ts` — add `multiLocation: 'business'`
- `domains/shop/routes/locations.ts` — `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`,
  `POST /:id/primary`; all behind `authMiddleware, requireRole(['shop']),
  requireShopPermission('shop:manage'), requireTier('multiLocation')`
- Mount `router.use('/locations', locationsRoutes)` in `domains/shop/routes/index.ts`

**Frontend**
- `config/featureTiers.ts` — mirror `multiLocation: 'business'`
- `services/api/locations.ts` — typed client (mirrors `api/team.ts`)
- `components/shop/tabs/LocationsTab.tsx` — list + add/edit modal (with map picker) + set-primary
  + delete
- `components/shop/ShopDashboardClient.tsx` — render `activeTab === "locations"`
- `components/ui/sidebar/ShopSidebar.tsx` — "Locations" nav item

**Merge with the old single-location tab.** The former "Shop Location" tab (`ShopLocationTab`,
edited `shops.address` + geo via `PUT /shops/:id/details`, and held the map picker) is removed
and folded into the new Locations tab:
- The tab is available to **all tiers** (no whole-tab `<TierGate>`); tier gating moved to the
  *actions*. Every shop can **edit its primary location** (map picker included).
- **Add location / set-primary / delete are Business-only** (`can('multiLocation')` on the client;
  `requireTier('multiLocation')` on `POST /`, `POST /:id/primary`, `DELETE /:id`). `GET /` and
  `PUT /:id` are open to all tiers.
- Editing the primary syncs its fields back onto the canonical `shops` columns
  (`ShopLocationRepository.syncShopCanonicalAddress`) so shop-profile display stays correct.
- A shop can't delete its only location (keeps a canonical address).

**Proximity search uses all locations.** `GET /shops/map` now joins `shop_locations` (nearest
active branch per shop via `JOIN LATERAL`), so a multi-location shop is found via any branch;
returned coords/address are the closest branch (primary when no search coords).

**Decision:** gated on/off, no per-tier numeric cap on location count (revisit if needed).

---

## Slice 2 — Location-scoped bookings (Business $599 only)

A customer books at a specific location, and that choice flows through availability, the order
record, and the calendar. **Only genuine paid-Business shops get this** — trial-added or
post-downgrade extra locations are hidden, not usable.

### Core principle: "paid multi-location entitlement"

Everything customer-facing keys off a stricter gate than `getShopTier` (which treats trial as
full business and ignores downgrades):

```
hasPaidMultiLocation(shopId) = active subscription tier === 'business' AND NOT trialing
```

- **Trial** → `getShopTier` = business, but `hasPaidMultiLocation` = false. A location added during
  trial exists but is **dormant** (not bookable, not shown publicly) until they actually pay.
- **Downgraded** → false; extra locations go dormant automatically.
- **Re-upgrade** → true again; dormant locations relight (nothing is deleted).

**Dormant = hidden, not destroyed.** Non-primary locations stay in `shop_locations`; when a shop
isn't entitled, only the **primary** is live everywhere.

**Evaluation (recommended: stored flag).** Add `shops.multi_location_active boolean NOT NULL
DEFAULT false`, maintained by the subscription lifecycle (Stripe webhook / subscription
activate·update·cancel·trial-end), true only when paid-business-and-not-trialing. The proximity
map is set-based, so a boolean column keeps every gate a cheap, consistent read instead of joining
subscription tables per row. Per-shop endpoints may call `hasPaidMultiLocation()` directly, reading
the same source of truth; a reconcile job backfills the flag. (Alternative: compute on-demand
everywhere, skip the column — simpler but slower for the map.)

### Data model — migration 193

1. `service_orders.location_id UUID REFERENCES shop_locations(id) ON DELETE SET NULL` (nullable) + index.
2. `shops.multi_location_active boolean NOT NULL DEFAULT false`.
3. Backfill existing orders → the shop's primary `location_id`.
4. Backfill `multi_location_active` from current subscriptions.

### Shop-facing scope: a location switcher

The primary Slice 2 UX is a **location switcher** in the shop dashboard header (active-location
context, à la Shopify/Square) plus an "All locations" option. It doesn't replace `location_id` on
records — it consumes it: the switcher decides which location's data the shop views/acts on. The
active location is a **UI/session preference** (Zustand + localStorage), not a DB write; list
endpoints gain an optional `?locationId=` filter, and new manual bookings default to the active
location. Customer-facing branch selection is deferred to Slice 3.

### Backend

- `utils/multiLocationEntitlement.ts` — `hasPaidMultiLocation(shopId)`, `setMultiLocationActive`
  reconcile (wired into subscription lifecycle), and `resolveBookingLocationId(shopId, requested)`.
- **Booking creation** (`ManualBookingController`, `OrderController` → `PaymentService`) — accept
  optional `locationId` (from the switcher). Not entitled → force primary. Entitled → validate the
  location belongs to the shop and is active; default to primary if omitted. Persist `location_id`
  on every new order (customer flow defaults to primary until the Slice 3 picker ships).
- **List/calendar filtering** — bookings list + calendar endpoints accept `?locationId=` to scope
  to the active location (omitted = all locations).
- **Availability** — locations **inherit shop hours** in Slice 2; `max_concurrent_bookings` stays
  shop-level. (Per-location hours/concurrency = Slice 3.)
- **Calendar** (`GoogleCalendarService`) — timezone/calendar stay shop-level (per-location tz needs
  schema we don't have); attach the branch address to the event so the shop sees which location.
- **Entitlement exposure** — `GET /shops/feature-access` returns `multiLocationActive` (the paid
  flag) so the frontend can gate the switcher.
- **Public map** — `GET /shops/map` shows multiple branches only when `s.multi_location_active`,
  else primary only (honors the "not seen" rule for trial/downgraded shops).

### Frontend

- **Location switcher** in the shop dashboard header, shown only when `multiLocationActive` and the
  shop has >1 bookable location. Scopes the **bookings list + calendar + tab counts** to the active
  location and sets the default location for new manual bookings.
- **Manual booking form** — sends the active `locationId`.
- **Customer branch picker** (pulled in from Slice 3) — the checkout modal fetches bookable
  locations by `shopId` (`GET /services/shop/:shopId/locations`, entitlement-gated) and shows a
  branch `<select>` when there is more than one; the selected `locationId` is sent to
  create-payment-intent.

### Decisions (from open questions)
1. Concurrency stays **shop-level** in Slice 2 (per-location → Slice 3).
2. Trial shops **may add** locations; they stay dormant (not switchable/bookable/public) until paid.
3. **Stored `multi_location_active` flag**, maintained by subscription events.

### Downgrade / trial matrix

| Shop state | Manage tab | Switcher / public map / booking | Extra locations |
|---|---|---|---|
| Paid Business | full CRUD + set-primary | active; all branches | live |
| Trial (business via trial) | edit primary; add possible | hidden — primary only | dormant until paid |
| Downgraded (starter/growth) | edit primary only; no add | hidden — primary only | dormant, preserved |
| Re-upgraded | full again | active again | relit |

## Slice 3 — Per-location operations (Business $599 only) — SHIPPED

Locations stop merely inheriting shop-level settings and become independently operable: each branch
can have its own hours, its own booking capacity, and its own reports. Same paid-entitlement gate as
Slice 2 (`hasPaidMultiLocation` / `multi_location_active`) — when a shop isn't entitled, everything
falls back to shop-level / primary-only behavior. **Inventory is NOT in this slice** (→ Slice 4);
**per-location staff moved to its own Slice 5.**

### Data model — migration 204

1. `shop_time_slot_config.location_id UUID REFERENCES shop_locations(id) ON DELETE CASCADE`
   (nullable; `NULL` row = shop-level default / fallback) + index.
2. Holiday/override tables gain `location_id` the same way (nullable = applies to all branches).
3. No backfill needed — absent `location_id` continues to mean "shop-level," preserving today's
   behavior for every existing shop. (`shop_team_members.location_id` for per-branch staff → Slice 5.)

### Per-location hours, holidays & concurrency

- Availability resolution reads the branch's time-slot config when present, else falls back to the
  shop-level row. `max_concurrent_bookings` becomes per-location with the same fallback.
- Customer checkout availability and the shop calendar both honor the active/selected branch's
  hours (replaces the "inherit shop hours" rule from Slice 2).
- Not entitled → always use the shop-level config (dormant branches never expose custom hours).

**Shipped (hours, holidays, slot/concurrency config):** migration 204 adds nullable `location_id` to
`shop_availability`, `shop_time_slot_config`, `shop_date_overrides` (partial unique indexes; NULL row
= shop-level default). `AppointmentRepository` resolves per-branch with shop-level fallback for weekly
hours, date overrides, and slot/concurrency config (`getTimeSlotConfig`/`updateTimeSlotConfig`/
`deleteTimeSlotConfig` take `locationId`); timezone always resolves shop-level (per-location tz out of
scope). `getAvailableTimeSlots` threads `locationId` through availability, the holiday closure check,
config, and booked-slot counts; the booking-creation concurrency checks (`PaymentService`,
`ManualBookingController`) read the branch's `maxConcurrentBookings`/`minBookingHours`. Config +
date-override CRUD (shop and public) is branch-scoped via a shared `resolveWritableLocation` guard —
editing the primary writes the shop-level rows; non-primary branches require the paid entitlement.
Frontend: shared branch selector across the Availability Operating Hours / Booking Settings / Date
Overrides tabs, plus `locationId` threaded through the customer date/time pickers (closed holidays
grey out per branch). This sub-area is complete.

### Per-location reports & analytics

- Reports/analytics dashboards gain a `?locationId=` filter (plus an "All locations" default),
  reusing the `location_id` already stamped on `service_orders` in Slice 2.
- Revenue, bookings, top services, and conversion metrics can be viewed per branch or aggregated.

**Shipped (dashboard analytics):** `ServiceAnalyticsRepository` (`getShopMetrics`,
`getServicePerformance`, `getOrderTrends`, `getShopCategoryPerformance`) threads `locationId`,
filtering only the `service_orders` reads (`($n::uuid IS NULL OR location_id = $n::uuid)`;
`service_orders`-JOIN predicate on the LEFT JOINs so services with no branch orders still show).
Service-catalog columns (service count, avg price, rating) stay shop-wide by design. Controller
gates the filter behind `hasPaidMultiLocation` (`resolveLocationFilter`); CSV exports honor it too.
Frontend: `ServiceAnalyticsTab` renders the shared `<LocationSwitcher/>` and passes
`activeLocationId` into `serviceAnalyticsApi.getShopAnalytics`.

**Shipped (booking + group-performance analytics):** `getBookingAnalytics` (all six
`service_orders` reads) and `getGroupPerformanceAnalytics` (the three `service_orders` LEFT JOINs,
so the service/group catalog still lists even with no branch orders) thread `locationId`; both
controller endpoints gate it behind `resolveLocationFilter`/`hasPaidMultiLocation`. Frontend:
`BookingAnalyticsTab` renders the `<LocationSwitcher/>` and its Zustand cache is keyed by
`${trendDays}:${locationId}` so switching branches never shows another branch's data;
`GroupPerformanceSection` reads `activeLocationId` and refetches on change. This sub-area is complete.

### Backend (as built)

- Availability/time-slot services resolve config by `location_id` with shop-level fallback.
- Booking creation validates the requested slot against the branch's hours/concurrency, not the shop's.
- Reports controllers accept and enforce `?locationId=` scoping (ownership + entitlement checked via
  `resolveLocationFilter` / `resolveWritableLocation`).
- Calendar timezone stays shop-level (per-location tz deferred — see cross-cutting).

### Frontend (as built)

- Availability tab: shared branch selector across Operating Hours / Booking Settings / Date Overrides.
- Reports dashboards: branch filter wired to the shared `<LocationSwitcher/>` (location-store context).

### Decisions
1. Per-location config is **opt-in per branch** — absent config inherits shop-level, so nothing
   breaks for shops that don't customize.
2. Timezone stays shop-level in Slice 3.
3. Per-location staff split out to its own **Slice 5**; hours + config + reports were the core.

---

## Slice 4 — Per-location inventory (Business $599 only)

The largest change: inventory is keyed by `shop_id` today and must be scoped to `location_id` so
each branch tracks its own stock. Deferred out of Slice 3 to ship independently.

- Scope stock levels and purchase orders to `location_id` (migration adds `location_id` to
  inventory tables; backfill existing stock to the shop's primary location).
- Booking/checkout reads and decrements the selected branch's stock; low/out-of-stock flags per
  branch.
- Inventory UI gains a branch selector (reusing the location switcher context).
- Same paid-entitlement gate; not entitled → primary-location stock only.

---

## Slice 5 — Per-location staff (Business $599 only)

Split out of Slice 3. Assign team members to specific branches and scope their views, without
changing the shop-level billing/permission model.

- **Data model:** `shop_team_members.location_id UUID REFERENCES shop_locations(id) ON DELETE SET
  NULL` (nullable = all-locations access, today's behavior; no backfill).
- Assign members to one (or all) locations; scope their dashboard / bookings / calendar to their
  branch, reusing the location-switcher context.
- Same paid-entitlement gate — not entitled → all staff see the primary/shop-level view only.
- **Left-off = all-locations access**, so existing team members are unaffected until explicitly
  scoped.

---

## Cross-cutting notes

- The old single `shop-location` tab is merged into the new Locations tab (see Slice 1). The
  shop's own address is now its primary location, kept in sync via
  `syncShopCanonicalAddress`.
- New shops auto-seed a primary location in `ShopRepository.createShop` (mirrors migration-192
  backfill); admin create paths route through the same method, so they inherit it plus owner/team
  and time-slot seeding. The `demo-mode` CLI does a raw insert and bypasses all seeding.
- Every slice sits behind the same tier gate, so partial rollout is safe.
