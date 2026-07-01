# Multi-Location Management — Implementation Plan

**Status:** Slice 1 in progress
**Tier:** Business ($599) — gated feature `multiLocation`
**Author:** Nico Regalado

## Summary

Let a single shop manage multiple physical locations under one account. The shop remains the
single billing / wallet / subscription / tier identity; each location is a physical site
(address, geo, phone, primary flag). Delivered in 3 additive, independently-shippable slices.

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

1. `orders.location_id UUID REFERENCES shop_locations(id) ON DELETE SET NULL` (nullable) + index.
2. `shops.multi_location_active boolean NOT NULL DEFAULT false`.
3. Backfill existing orders → the shop's primary `location_id`.
4. Backfill `multi_location_active` from current subscriptions.

### Backend

- `utils/multiLocationEntitlement.ts` — `hasPaidMultiLocation(shopId)` + `setMultiLocationActive`
  reconcile; wire the reconcile into subscription lifecycle events.
- **Booking creation** (`ManualBookingController`, `OrderController`, `PaymentService`, customer
  booking route) — accept optional `locationId`. Not entitled → force primary. Entitled → validate
  the location belongs to the shop and is active; default to primary if omitted. Persist
  `location_id`.
- **Availability** (`AppointmentService` / `shop_time_slot_config`) — resolved for the chosen
  location; locations **inherit shop hours** in Slice 2 (per-location hours = Slice 3).
  `max_concurrent_bookings` stays shop-level for now.
- **Calendar** (`GoogleCalendarService`) — resolve timezone/target calendar by the booking's
  location (builds on the merged calendar-sync work).
- **Public exposure (harden Slice 1):**
  - `GET /shops/map` — lateral join returns all active locations only when
    `s.multi_location_active`, else primary only.
  - Shop/service detail endpoints return `locations: [...]` of bookable locations (all active if
    entitled, else primary only); frontend renders what it's given.
  - `GET /shops/locations` (management) — not entitled → primary only.

### Frontend

- **Location selector** in booking flow appears only when the returned `locations` array has >1
  entry (entitled + multiple active). Single-location shops auto-assign primary, no selector.
- **Marketplace / shop page** — surface bookable locations from the payload.
- **Locations tab** — already tier-gated; consumes the narrowed list, so a downgraded/trial shop
  simply sees its primary only.

### Downgrade / trial matrix

| Shop state | Manage tab | Public map / booking | Extra locations |
|---|---|---|---|
| Paid Business | full CRUD + set-primary | all active bookable | live |
| Trial (business via trial) | edit primary; add possible | primary only | dormant until paid |
| Downgraded (starter/growth) | edit primary only; no add | primary only | dormant, preserved |
| Re-upgraded | full again | all active again | relit |

### Open questions
1. Concurrency per location — defer to Slice 3 (recommended) or now?
2. Block trial shops from adding locations entirely, or allow dormant adds (implied acceptable)?
3. Stored `multi_location_active` flag + event wiring (recommended) vs. on-demand entitlement.

## Slice 3 — Per-location operations & analytics (as needed)

- Per-location hours/holidays (`shop_time_slot_config.location_id`).
- Optional per-location services / inventory scoping.
- Per-location analytics filter on reports dashboards.
- Optional: team members assigned to specific locations.

---

## Cross-cutting notes

- The old single `shop-location` tab is merged into the new Locations tab (see Slice 1). The
  shop's own address is now its primary location, kept in sync via
  `syncShopCanonicalAddress`.
- New shops auto-seed a primary location in `ShopRepository.createShop` (mirrors migration-192
  backfill); admin create paths route through the same method, so they inherit it plus owner/team
  and time-slot seeding. The `demo-mode` CLI does a raw insert and bypasses all seeding.
- Every slice sits behind the same tier gate, so partial rollout is safe.
