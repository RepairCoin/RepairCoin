# Feature: Sponsored Ad Cards in Trending Services

**Status:** In Progress
**Priority:** Medium
**Est. Effort:** 4-6 hrs
**Created:** 2026-07-24
**Updated:** 2026-07-24

---

## Problem / Goal

The ads product (`ad_campaigns`) only ran on Meta and Google, with traffic landing on the public
web landing page. A shop paying for ads got nothing from the RepairCoin customer audience, and
the app had no ad surface at all.

Goal: the first **in-app ad placement** — full-width sponsored cards interleaved into the
Trending Services grid, reusing existing campaign and creative data with no new ad authoring
flow. This also establishes the pattern for placements on other customer screens.

Agreed behaviour:

- Ad-first layout, spanning both grid columns: **AD → 6 services → AD → 6 services → …**
- Eligible campaigns: `status = 'active'` with an **approved** creative that has an image.
- Tap → the campaign's first still-active promoted service, else the advertising shop's profile.
- Taps are logged; impressions are **not** tracked in v1 (needs viewability logic).
- Ads are strictly additive — if the ads request fails, the grid renders exactly as before.

## Analysis

- **`FlatList numColumns={2}` cannot span.** It forces every item to equal width, so a
  full-width ad row is impossible with it. The grid had to be pre-chunked into row objects and
  rendered single-column.
- **Ad copy lives in `ad_creatives`, not `ad_campaigns`** — `headline`, `body`, `image_url`.
  `ad_campaigns` carries no creative fields.
- **Promoted services live in `ad_campaign_requests.promote_service_ids`**, a snapshot from when
  the campaign was requested. A service may have been deactivated since, so each id is re-checked
  against `shop_services.active = true` before being used as a tap target.
- **`AdsDomain` had no customer-facing routes** — every existing `/api/ads` route is admin- or
  shop-gated. A customer-gated surface had to be added.

## Implementation

### Backend

| File | Change |
|------|--------|
| `backend/migrations/241_create_ad_app_placement_clicks.sql` | New `ad_app_placement_clicks` table (`placement` column so other screens reuse it) |
| `backend/src/domains/AdsDomain/repositories/AppPlacementRepository.ts` | `listEligible()` (campaign → newest approved creative → brief → shop → brand kit), `findActiveServices()`, `recordClick()`, `campaignExists()` |
| `backend/src/domains/AdsDomain/controllers/AppPlacementController.ts` | `getAppPlacements()`, `recordPlacementClick()` — public-safe fields only, null-safe like `LandingController` |
| `backend/src/domains/AdsDomain/routes.ts` | New `customer` middleware tuple + `GET /api/ads/app-placements`, `POST /api/ads/app-placements/:campaignId/click` |

`listEligible` uses `DISTINCT ON (c.id) … ORDER BY c.id, cr.updated_at DESC` to take exactly one
creative per campaign — the newest approved one — matching `CreativeRepository.findAiByCampaign()`.

### Mobile

| File | Change |
|------|--------|
| `shared/components/shared/SponsoredAdCard.tsx` | New full-width card: hero image, "Sponsored" pill, shop logo + name, headline, body, offer pill |
| `feature/services/services-main/feature-tab/utils/buildAdRows.ts` | New `buildAdRows()` — chunks services into rows and splices ad rows in |
| `feature/services/services/ads.services.ts` | New `adsApi` — `getAppPlacements()`, `recordAdClick()` |
| `feature/services/services/service.interface.ts` | `AdPlacement`, `AdPlacementTarget`, `AdPlacementsResponse` |
| `shared/config/queryClient.ts` | `queryKeys.adPlacements()` |
| `feature/services/services-main/feature-tab/hooks/useFeatureTabQuery.ts` | `useAdPlacementsQuery` (`retry: false`), `useRecordAdClickMutation` |
| `feature/services/services-main/feature-tab/hooks/useTrendingServices.ts` | Wires ads in, exposes `rows` + `handleAdPress`, refetches ads on pull-to-refresh |
| `feature/services/services-main/screens/customer/TrendingServicesScreen.tsx` | Renders pre-chunked rows instead of `numColumns={2}` |
| `feature/services/services-main/feature-tab/hooks/useAdPlacements.ts` | Shared hook: ads query + click log + navigation for one surface. Both screens use it, so the tap rules live in one place |
| `feature/services/services-main/services-tab/components/ServicesTabContent.tsx` | **Second surface** — same row-chunking on the customer marketplace tab, `placement: 'marketplace'` |

Surfaces are separable by `placement`: `trending_services` and `marketplace`. The shop-side
`ServicesTab.tsx` is deliberately untouched — no ads on a shop's own service management list.

Service cards keep their original `CARD_WIDTH`; only the ad row spans the full width.

## Verification Checklist

**Backend**

- [x] `cd backend && npm run typecheck` → clean
- [x] `npm run db:migrate` → applied as **version 242** on staging (2026-07-25); table, both indexes and the `ad_campaigns` FK verified present
- [x] `listEligible` SQL proven against staging: joins resolve, real headline/body/image/offer returned, promoted service still active → `target = service`
- [x] Seed: campaign `9b715598-708a-4df0-a017-deea58dad9a4` ("Peanut Campaign — more_bookings") set to `status='active'` on staging. `listEligible` returns exactly 1 row; tap target resolves to service `srv_4287324a…` ("I Robot", $699.99, active)
- [ ] `GET /api/ads/app-placements` with a customer JWT returns items with non-null `imageUrl` and a resolved `target`
- [ ] `POST /api/ads/app-placements/<id>/click` returns `{success:true}` and the row lands in `ad_app_placement_clicks`
- [ ] A **shop** JWT gets 403 on both routes

**Mobile**

- [x] `cd mobile && npx tsc --noEmit` → no new errors
- [x] **Bug found in first build:** the screen fetches `DEFAULT_TRENDING_LIMIT = 6` services, and with exactly 6 the ad boundary lands on the last row where the "no trailing ad" rule suppressed it — so no ad could ever render. Fixed: a boundary on the last row now still yields an ad when it would be the first one. Verified across service counts 0-20
- [x] Marketplace row math verified at real page sizes: 20/40/60/150 services → ads at row 3, 7, 11, … with unique keys, and ad positions stay **stable as infinite-scroll pages append** (they don't shift under the user)
- [ ] Customer login → Trending Services: ad row spans full width after the 6th service, "Sponsored" pill visible
- [ ] Customer login → Services tab (marketplace): ad card every 3 rows while scrolling; card does not shift position when the next page loads
- [ ] Tap opens the promoted service; pull-to-refresh rotates the ad
- [ ] Clear `promote_service_ids` on the campaign → tap falls back to the shop profile
- [ ] Stop the backend ads route → the grid renders exactly as before, no gap or crash
- [ ] Edge cases: 0 ads (no ad rows), 1 ad (repeats every 6), <6 services (no ad row), odd service count (last row has one card at `CARD_WIDTH`, not stretched)

## Notes

- Migration applied to **staging** as version 242 on 2026-07-25 (not production).
  It was authored as 241, but 241 was already taken on staging by
  `241_ai_usage_events_management_labels`, a migration with no file in the repo — the DB is ahead
  of `migrations/`. Renumbered to 242 before applying.
- The migration runner also refused on a **pre-existing** collision at 240: staging recorded
  `240_create_ai_usage_events_view` with the `NNN_` filename prefix instead of the bare name, the
  same drift already whitelisted for 206-209 and 232-233. Verified both objects that migration
  creates are present on staging (view `ai_usage_events`, table `ai_misc_usage`), then added 240
  to `KNOWN_DRIFT` in `scripts/run-migrations.ts`. Without this, `npm run db:migrate` was blocked
  for everyone on staging, not just this task.
- **No ad card has rendered yet.** Staging has 12 campaigns — 8 paused, 4 draft, 0 active — so
  `listEligible` correctly returns nothing. Activating one of the paused campaigns that already
  has an approved creative with an image is enough to see a card.
- **Staging currently has 1 active campaign, left active deliberately** so the card can be seen
  in the app. Revert with `cd backend && node flip-campaign.tmp.js revert` (temporary helper,
  untracked — delete it once testing is done), or:
  `UPDATE ad_campaigns SET status='paused' WHERE id='9b715598-708a-4df0-a017-deea58dad9a4';`
- The HTTP layer (auth gating, controller response shape, click insert) is still **unexercised** —
  minting a customer JWT to curl the endpoint was blocked by the sandbox permission classifier.
  It needs a real customer login in the app. `ad_app_placement_clicks` currently has 0 rows, so
  a row appearing there after a tap is the end-to-end confirmation.
- Side effects of flipping a campaign to `active` on the shared DB, if doing so: the nightly
  `SafeguardScheduler` (03:00) evaluates active campaigns and `AdBillingService.accrue()` writes
  Plan B/C charges for them. Both read `ad_performance_daily`, which is empty for these
  campaigns, so neither should do anything — but revert to `paused` after testing regardless.
- `mobile` has 13 pre-existing `tsc` errors in unrelated files (booking, reschedule,
  appointment); none are in files touched by this task.
- Impressions were deliberately left out of v1 — viewability plus per-session dedupe in a
  scrolling list is easy to get wrong and noisy.
- The `placement` column already supports further surfaces (marketplace, favorites) without
  another migration.
- Follow-ups: impression tracking, additional placements, shop-visible reporting on in-app
  placement clicks.
