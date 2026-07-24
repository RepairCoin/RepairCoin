# Sponsored ad cards in Trending Services (mobile)

## Context

`AdsDomain` (backend) runs paid Meta/Google campaigns for shops — `ad_campaigns`, `ad_creatives`, leads, billing. Today those campaigns only exist **outside** the app: they render on Meta/Google, and traffic lands on the public web landing page (`GET /api/ads/landing/:campaignId`). There is no in-app placement, so a shop paying for ads gets nothing from the RepairCoin customer audience.

This adds the first **in-app ad placement**: a full-width sponsored card interleaved into the Trending Services grid at `mobile/feature/services/services-main/screens/customer/TrendingServicesScreen.tsx`. It reuses the existing campaign + creative data (no new ad authoring flow), gives shops a new distribution channel, and establishes the pattern for placements on other customer screens later.

Decisions locked with the user:
- Tap → the campaign's **promoted service detail** (`/customer/service/[id]`), falling back to the shop when the campaign has no promoted services.
- **One ad row after every 6 services**, spanning both columns.
- Eligible = `status='active'` **and** an approved creative with an image.
- **Tap tracking only** for now — no impression/viewability tracking.

## Constraints & gotchas

- **`numColumns={2}` cannot span.** A `FlatList` with `numColumns` gives every item the same width. The current screen relies on it (line 68). To get a full-width ad row we must pre-chunk the data into rows and render with `numColumns` removed — see step 5.
- **Campaign copy lives in `ad_creatives`, not `ad_campaigns`.** `ad_campaigns` has no headline/image; `ad_creatives.headline / body / image_url` does. `CreativeRepository.findAiByCampaign()` (`backend/src/domains/AdsDomain/repositories/CreativeRepository.ts:102`) already returns "latest creative with an image".
- **Promoted services live in `ad_campaign_requests.promote_service_ids`** (`text[]`), reachable via `CampaignRequestRepository.findByCampaignId()`. Not every campaign has a request row → fallback required.
- **All existing `/api/ads` routes are admin- or shop-gated.** There is no customer-facing surface; one must be added.
- **Never edit a committed migration** — add a new numbered file. Latest is `240_create_ai_usage_events_view.sql`, so the new one is `241_`.

---

## Backend

### 1. Migration — `backend/migrations/241_create_ad_app_placement_clicks.sql`

```sql
CREATE TABLE IF NOT EXISTS ad_app_placement_clicks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  customer_address TEXT,                       -- lowercase wallet; null if unauthenticated
  placement      TEXT NOT NULL DEFAULT 'trending_services',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_app_clicks_campaign ON ad_app_placement_clicks (campaign_id, created_at DESC);
```

`placement` is there so the same table serves future screens without another migration.

### 2. Repository — `backend/src/domains/AdsDomain/repositories/AppPlacementRepository.ts` (new)

Extends `BaseRepository` like its siblings. Two methods:

- **`listEligible(limit: number)`** — one query joining campaign → newest approved creative → the campaign's request brief → shop:

  ```sql
  SELECT DISTINCT ON (c.id)
         c.id, c.shop_id, cr.headline, cr.body, cr.image_url,
         req.offer, req.promote_service_ids, s.name AS shop_name,
         bk.logo_url
    FROM ad_campaigns c
    JOIN ad_creatives cr ON cr.campaign_id = c.id
                        AND cr.review_status = 'approved'
                        AND cr.image_url IS NOT NULL
                        AND cr.deleted_at IS NULL
    JOIN shops s ON s.shop_id = c.shop_id
    LEFT JOIN ad_campaign_requests req ON req.campaign_id = c.id
    LEFT JOIN shop_brand_kits bk ON bk.shop_id = c.shop_id
   WHERE c.status = 'active' AND c.deleted_at IS NULL
   ORDER BY c.id, cr.updated_at DESC
   LIMIT $1
  ```

  `DISTINCT ON (c.id) … ORDER BY c.id, cr.updated_at DESC` picks exactly one — the newest approved — creative per campaign, matching `findAiByCampaign`'s "latest wins" rule.

- **`recordClick({ campaignId, customerAddress, placement })`** — single insert; caller does not await the result path.

### 3. Controller — `backend/src/domains/AdsDomain/controllers/AppPlacementController.ts` (new)

Model the shape on `LandingController.ts` — **public-safe fields only**, every enrichment null-safe so a missing brand kit or empty brief degrades one field instead of failing the request. Never expose budget, spend, Meta/Google ids, or lead data.

- **`getAppPlacements(req, res)`** → `GET /api/ads/app-placements`
  - `?limit=` (default 5, clamp 1–10), `?placement=` (default `trending_services`).
  - Resolve the tap target per campaign:
    - Take `promote_service_ids[0]`, verify with `SELECT service_id, service_name, image_url FROM shop_services WHERE service_id = ANY($1) AND active = true` (same guard `LandingController.ts:90-94` uses — a promoted service can since have been deactivated).
    - First **active** promoted service wins → `{ target: 'service', serviceId }`.
    - Otherwise → `{ target: 'shop', shopId }`.
  - Response per item:
    ```ts
    {
      campaignId, shopId, shopName,
      headline,            // creative.headline ?? request.offer ?? shop name
      body,                // creative.body, truncated ~140 chars
      imageUrl,            // creative.image_url (guaranteed non-null by the query)
      logoUrl,             // brand kit logo, nullable
      offer,               // request.offer, nullable — rendered as a pill
      target: { type: 'service', serviceId } | { type: 'shop', shopId }
    }
    ```
  - Drop any campaign whose resolved target is unusable rather than shipping a dead card.

- **`recordPlacementClick(req, res)`** → `POST /api/ads/app-placements/:campaignId/click`
  - Reads the wallet from `req.user` (lowercased, consistent with the rest of the codebase), inserts, returns `{ success: true }`. Log-and-swallow on failure — analytics must never break a tap.

### 4. Routes — `backend/src/domains/AdsDomain/routes.ts`

Add a **customer** middleware tuple alongside the existing `admin` / `shop` ones (~line 69):

```ts
const customer = [authMiddleware, requireRole(['customer'])];
```

Then, in a new `// ---- Customer-facing in-app placements ----` block:

```ts
router.get('/app-placements', ...customer, getAppPlacements);
router.post('/app-placements/:campaignId/click', ...customer, recordPlacementClick);
```

Both are customer-gated — this is a logged-in-only surface, so no public exposure of shop campaign data.

---

## Mobile

### 5. Rewrite the list as pre-chunked rows — `TrendingServicesScreen.tsx`

The only structural change to the screen. Replace `numColumns={2}` with a row-typed data array:

```ts
type Row =
  | { kind: 'services'; key: string; items: ServiceData[] }   // 1–2 services
  | { kind: 'ad'; key: string; ad: AdPlacement };
```

`buildRows(services, ads, { adEvery: 6 })` — a pure helper in `feature/services/services-main/feature-tab/utils/buildAdRows.ts`, memoized with `useMemo` on the screen:

- Chunk services into pairs.
- After every 3 pairs (= 6 services), splice in one ad row, cycling `ads[adIndex % ads.length]`.
- No ads loaded, or ads query still pending/errored → returns pure service rows. **The grid must render identically to today when the ads call fails.**
- Never emit a trailing ad row after the last service pair.

Render:

```tsx
<FlatList
  data={rows}
  keyExtractor={(row) => row.key}
  renderItem={({ item }) =>
    item.kind === 'ad'
      ? <SponsoredAdCard ad={item.ad} onPress={() => handleAdPress(item.ad)} />
      : <View className="flex-row">{item.items.map(renderServiceCard)}</View>
  }
  contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 100 }}
  ...
/>
```

`CARD_WIDTH` (line 10) stays as-is for service cards. The ad card uses `SCREEN_WIDTH - 32` — the full two-column span. Keep `ListEmptyComponent`, `RefreshControl`, and the `SkeletonServiceGrid` loading branch untouched; loading gates on `isLoading` from services only, never on the ads query.

### 6. `SponsoredAdCard` — `shared/components/shared/SponsoredAdCard.tsx` (new)

Styled to sit in the dark grid (`bg-zinc-950`) next to `ServiceCard`'s `transparent` variant. Deliberately a separate component, not a `ServiceCard` prop — the layouts differ (landscape hero vs. portrait grid tile) and `ServiceCard` is already carrying 25+ props.

Layout: full-width landscape hero image (`h-40 rounded-2xl`), a **"Sponsored"** pill top-left over the image, `logoUrl` avatar + `shopName` row beneath, `headline` (2 lines max), `body` (2 lines, muted), and the `offer` pill in accent `#FFCC00` when present. Whole card is one `TouchableOpacity`. Reuse `Badge` (`shared/components/ui/Badge.tsx`) for the pills and `useHaptics` for press feedback, matching `ServiceCard`.

The "Sponsored" label is non-negotiable — it must be legible at a glance so paid placement is never mistaken for organic trending content.

### 7. Data layer

- **`feature/services/services/service.interface.ts`** — add `AdPlacement` and `AdPlacementTarget` types mirroring the controller response.
- **`shared/config/queryClient.ts`** — add to `queryKeys` next to the service block (~line 113):
  ```ts
  adPlacements: (placement?: string) => [...queryKeys.all, 'ads', 'placements', placement] as const,
  ```
- **`feature/services/services/ads.services.ts`** (new) — small `AdsApi` class following `service.services.ts`: `getAppPlacements({ limit, placement })` and `recordAdClick(campaignId, placement)`, both via the shared `apiClient` from `shared/utilities/axios`.
- **`useFeatureTabQuery.ts`** — add:
  ```ts
  export function useAdPlacementsQuery(placement = 'trending_services') {
    const { accessToken } = useAuthStore();
    return useQuery({
      queryKey: queryKeys.adPlacements(placement),
      queryFn: async () => (await adsApi.getAppPlacements({ limit: 5, placement })).data,
      enabled: !!accessToken,
      staleTime: 10 * 60 * 1000,
      retry: false,          // an ad failure must never retry-storm the grid
    });
  }
  export function useRecordAdClickMutation() { /* fire-and-forget, no toast on error */ }
  ```
  `enabled: !!accessToken` matches how `useGetRecentlyViewedQuery` gates auth-only queries (line 117-128).

### 8. `useTrendingServices.ts` — wire it together

Pull in `useAdPlacementsQuery` + `useRecordAdClickMutation`, expose `ads` and:

```ts
const handleAdPress = (ad: AdPlacement) => {
  recordClick(ad.campaignId);                       // fire-and-forget
  if (ad.target.type === 'service') router.push(`/customer/service/${ad.target.serviceId}` as any);
  else router.push(`/customer/shop/${ad.target.shopId}` as any);
};
```

Include the ads `refetch` in the existing `onRefresh` (line 20-24) so pull-to-refresh rotates ads too.

> Verify the customer shop-profile route path before wiring the `shop` fallback — confirm the actual segment under `app/(dashboard)/customer/`. If no such route exists, fall back to the shop's services list instead.

### 9. Task doc

Add `mobile/docs/tasks/enhancements/sponsored-ad-cards-trending.md` using the exact header format in `mobile/docs/tasks/RULES.md` (`# Feature: …`, `**Status:** In Progress`, `**Priority:** Medium`, `**Created:** 2026-07-24`), and add the line to the current `week-*.md` summary. Required by `mobile/CLAUDE.md`.

---

## Verification

**Backend**
1. `cd backend && npm run typecheck && npm run lint:fix`
2. `npm run db:migrate` — confirm `ad_app_placement_clicks` exists.
3. Seed: pick any `ad_campaigns` row, set `status='active'`; on its newest `ad_creatives` row set `review_status='approved'` and a real `image_url`. If the shop has no `ad_campaign_requests.promote_service_ids`, add one active `shop_services.service_id` to exercise the service target — then clear it once to confirm the shop fallback.
4. `curl -H "Authorization: Bearer <customer JWT>" localhost:4000/api/ads/app-placements` → items with non-null `imageUrl` and a resolved `target`.
5. `curl -X POST -H "Authorization: Bearer <customer JWT>" localhost:4000/api/ads/app-placements/<id>/click` → `{success:true}`; confirm the row landed in `ad_app_placement_clicks`.
6. Confirm a **shop** JWT gets 403 on both routes.

**Mobile**
7. `cd mobile && npx tsc --noEmit`
8. `npx expo start` → customer login → Trending Services. Check: ad row spans the full width after the 6th service; "Sponsored" pill is visible; tap opens the promoted service; pull-to-refresh rotates the ad.
9. **Degradation (the important one):** stop the backend ads route (or force the query to error) and reload — the grid must render exactly as it does today, with no gap, no crash, no error toast.
10. Edge cases: 0 eligible ads (no ad rows), 1 eligible ad (repeats every 6), fewer than 6 trending services (no ad row at all), and odd service counts (last row has one card at `CARD_WIDTH`, not stretched).
