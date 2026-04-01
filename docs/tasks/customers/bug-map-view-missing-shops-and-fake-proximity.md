# Web Map Overhaul — Unified Map Experience (Services Map + Find Shop)

**Status:** open
**Priority:** high
**Date:** 2026-03-31
**Platform:** Web (Next.js)
**Affects:** Customer role
**Pages:**
- **Phase A (this task):** Services > Shops tab > Map view (`/customer?tab=marketplace`)
- **Phase B (next task):** Find Shop page (`/customer?tab=findshop`)
**Reference:** Mobile Find Shop (`mobile/feature/find-shop/`) — the target UX

---

## Summary

The web Services Map view is significantly weaker than the mobile Find Shop screen. This task builds a **shared map component library** that will first power the Services Map overhaul (Phase A), then be reused to upgrade the Find Shop page (Phase B) — ensuring a uniform experience across both web pages and matching the mobile UX.

---

## Mobile vs Web Feature Gap

| Feature | Mobile (Find Shop) | Web (Current) | Web (Target) |
|---|---|---|---|
| Auto-detect location | Yes — on mount | No — hardcoded Manila | Yes |
| Radius circle | Yes — yellow, 1-20 mi | No | Yes |
| Radius controls (−/+) | Yes — with shop count | No | Yes |
| Shop markers | Custom (storefront icon, selected state) | Generic red pins | Custom styled |
| Shop popup/panel | Bottom sheet (minimized/expanded) | Leaflet popup (light theme) | Sidebar panel (dark theme) |
| Directions | Yes — route polyline, distance, duration | No | Yes |
| Search bar | Yes — filter shops by name | No | Yes |
| Category filter | Yes — horizontal chips | No | Yes |
| List view toggle | Yes — Map/List integrated | Separate Grid tab | Integrated toggle |
| Center on me button | Yes | No | Yes |
| Data source | All shops with coordinates | Paginated 12 services | Dedicated endpoint |

---

## Shared Component Architecture

All map features are built as **reusable components and hooks** under `frontend/src/components/map/` and `frontend/src/hooks/`, so both the Services Map and Find Shop pages can consume them without duplication.

```
frontend/src/
├── hooks/
│   └── useShopMap.ts              # Core hook: location, radius, filtering, search, directions
├── utils/
│   ├── distance.ts                # Haversine distance calculation
│   └── route.ts                   # OpenRouteService route fetching
├── components/
│   └── map/                       # Shared map components (reusable across pages)
│       ├── ShopMapContainer.tsx    # Leaflet map with markers, radius circle, route polyline
│       ├── RadiusControl.tsx       # Radius −/+ control bar with shop count
│       ├── ShopSearchBar.tsx       # Search input for filtering shops
│       ├── ShopMarker.tsx          # Custom styled shop marker (DivIcon)
│       ├── DirectionsPanel.tsx     # Route distance/duration display
│       ├── CategoryFilter.tsx      # Horizontal category chips
│       ├── ShopInfoPanel.tsx       # Selected shop details sidebar
│       ├── NearbyShopsList.tsx     # Sorted shop list with distances
│       ├── LocationButton.tsx      # "Update Location" / "Center on me" button
│       └── MapSidebar.tsx          # Sidebar container (shop info + nearby list)
├── services/api/
│   └── shop.ts                    # Add getShopsForMap() method
└── components/customer/
    ├── ShopMapView.tsx             # Phase A: Services Map page (consumes shared components)
    └── FindShopMap.tsx             # Phase B: Find Shop page (consumes same shared components)
```

### Core Hook: `useShopMap`

A single hook that encapsulates all map logic — consumed by both pages with different configurations.

```typescript
interface UseShopMapOptions {
  autoDetectLocation?: boolean;    // true for Find Shop, false for Services Map
  defaultRadius?: number;          // 1 mi default
  showDirections?: boolean;        // enable/disable directions feature
}

function useShopMap(options: UseShopMapOptions = {}) {
  // Location state
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [hasLocation, setHasLocation] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([defaultLat, defaultLng]);
  const [mapZoom, setMapZoom] = useState(defaultZoom);

  // Shop data (from GET /api/shops/map)
  const { data: shops } = useQuery({ queryKey: ['shopsMap'], queryFn: shopApi.getShopsForMap });

  // Radius state
  const [radiusMiles, setRadiusMiles] = useState(options.defaultRadius || 1);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);

  // Directions state
  const [showDirections, setShowDirections] = useState(false);
  const [routeData, setRouteData] = useState({ coordinates: [], distance: 0, duration: 0 });

  // Computed: nearbyShops (filtered by radius + search + category, sorted by distance)
  const nearbyShops = useMemo(() => { ... }, [shops, userLocation, radiusMiles, searchQuery, selectedCategory]);

  // Computed: displayedShops (all shops or nearby depending on hasLocation)
  const displayedShops = useMemo(() => hasLocation ? nearbyShops : filteredBySearch, [...]);

  // Actions
  const requestLocation = () => { ... };
  const openDirections = async (shop) => { ... };
  const closeDirections = () => { ... };
  const increaseRadius = () => { ... };
  const decreaseRadius = () => { ... };

  return {
    // State
    shops, nearbyShops, displayedShops, userLocation, hasLocation,
    mapCenter, mapZoom, radiusMiles, searchQuery, selectedCategory,
    selectedShop, showDirections, routeData,
    // Setters
    setSearchQuery, setSelectedCategory, setSelectedShop, setMapCenter, setMapZoom,
    // Actions
    requestLocation, openDirections, closeDirections, increaseRadius, decreaseRadius,
  };
}
```

**Services Map page** uses it as:
```typescript
const map = useShopMap({ autoDetectLocation: false, defaultRadius: 1 });
// User must click "Update Location" to reveal sidebar
```

**Find Shop page** uses it as:
```typescript
const map = useShopMap({ autoDetectLocation: true, defaultRadius: 5, showDirections: true });
// Auto-detects location on mount, larger default radius
```

---

## Implementation Order

### Phase 1: Foundation (Backend + Shared Utilities)
1. **Bug 1** — Dedicated shops endpoint (`GET /api/shops/map`)
2. **Bug 4** — Env-based default location
3. **Shared utils** — `distance.ts` (Haversine), `route.ts` (OpenRouteService)
4. **Core hook** — `useShopMap.ts`

### Phase 2: Shared Map Components
5. **ShopMarker** — Custom Leaflet DivIcon (storefront icon, selected state)
6. **RadiusControl** — `−`/`+` buttons with shop count badge
7. **ShopSearchBar** — Search input with clear button
8. **LocationButton** — "Update Location" with optional glow animation
9. **ShopMapContainer** — Leaflet map wrapper (markers, circle, polyline, controls)
10. **ShopInfoPanel** — Selected shop details
11. **NearbyShopsList** — Sorted list with distances
12. **MapSidebar** — Container for ShopInfoPanel + NearbyShopsList
13. **DirectionsPanel** — Route distance/duration display
14. **CategoryFilter** — Horizontal category chips

### Phase 3: Services Map Page (Phase A)
15. **Progressive Disclosure Layout** — Full-width map → sidebar slides in after location
16. **Glowing "Update Location" button** — Animated CTA
17. **Wire everything** — ShopMapView consumes shared components via `useShopMap`
18. **Bug 2 fix** — Real proximity filtering
19. **Bug 3 fix** — Notice for shops without coordinates

### Phase 4: Find Shop Page (Phase B — next task)
20. **FindShopMap** — Consumes same shared components with different config
21. **Auto-detect on mount** — `useShopMap({ autoDetectLocation: true })`
22. **Integrated List/Map toggle** — Reuse ViewModeToggle pattern from mobile

---

## Bug 1: Map Shows Only a Fraction of Shops

### Root Cause

Map piggybacks on paginated services API (`limit: 12`). Only shops from page 1 with coordinates appear.

### Fix: Dedicated Shops-with-Location Endpoint

**Backend — `GET /api/shops/map`**

```typescript
async getShopsWithLocation(): Promise<ShopMapData[]> {
  const query = `
    SELECT
      s.shop_id, s.name, s.address, s.phone, s.email,
      s.location_lat, s.location_lng, s.location_city, s.location_state,
      s.verified, s.logo_url, s.category,
      COALESCE(
        (SELECT COUNT(*) FROM shop_services ss WHERE ss.shop_id = s.shop_id AND ss.active = true), 0
      )::int as service_count,
      COALESCE(
        (SELECT AVG(sr.rating) FROM service_reviews sr
         JOIN shop_services ss ON sr.service_id = ss.service_id
         WHERE ss.shop_id = s.shop_id), 0
      )::numeric(3,2) as avg_rating
    FROM shops s
    WHERE s.active = true
      AND s.verified = true
      AND s.location_lat IS NOT NULL
      AND s.location_lng IS NOT NULL
    ORDER BY s.name
  `;
  // No pagination — bounded dataset
}
```

Both Services Map and Find Shop pages will consume this same endpoint via `useShopMap`.

---

## Bug 2: "Use My Location" Does Not Filter by Proximity

### Root Cause

Button gets GPS, centers map, shows misleading toast — but does NOT filter shops by distance.

### Fix

Handled by `useShopMap` hook — after location is obtained, `nearbyShops` is computed with Haversine distance filtering by radius. See Radius Controls section.

---

## Bug 3: Shops Without Coordinates Are Invisible

### Fix

Show info text in the Nearby Shops panel:
```
ℹ Some shops haven't set their map location yet. Browse all shops in Grid view.
```

---

## Bug 4: Map Default Location Hardcoded to Manila

### Fix: Env-based defaults

```env
# .env.production (US deployment)
NEXT_PUBLIC_MAP_DEFAULT_LAT=39.8283
NEXT_PUBLIC_MAP_DEFAULT_LNG=-98.5795
NEXT_PUBLIC_MAP_DEFAULT_ZOOM=4

# .env.development (Philippines dev)
NEXT_PUBLIC_MAP_DEFAULT_LAT=14.5995
NEXT_PUBLIC_MAP_DEFAULT_LNG=120.9842
NEXT_PUBLIC_MAP_DEFAULT_ZOOM=12
```

Used by `useShopMap` as the initial map center. Auto-detect overrides it when location is granted.

---

## Feature: Progressive Disclosure Layout (Services Map only)

### State 1 — First Load (no location):
```
┌─────────────────────────────────────────────────────────────┐
│ Find Nearby Shops                        [Update Location✨] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    FULL-WIDTH MAP                           │
│              (all shop markers visible)                     │
│         No right panel — map takes full width               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
- "Update Location" button has **glowing yellow border animation**
- Radius controls and Nearby Shops are hidden

### State 2 — After "Update Location" clicked:
```
┌─────────────────────────────────────────────────┬───────────┐
│                                                 │ Nearby    │
│                MAP                              │ Shops (3) │
│         (radius circle + controls)              │ • Shop A  │
│                                                 │   0.3 mi  │
└─────────────────────────────────────────────────┴───────────┘
```
- Sidebar slides in, glow animation stops

### State 3 — Shop selected:
```
┌─────────────────────────────────────────────────┬───────────┐
│                                                 │ Shop Info │
│                MAP                              │ + Actions │
│         (selected marker highlighted)           │───────────│
│                                                 │ Nearby    │
│                                                 │ Shops (3) │
└─────────────────────────────────────────────────┴───────────┘
```

**Glow animation CSS:**
```css
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 5px rgba(255, 204, 0, 0.4), 0 0 10px rgba(255, 204, 0, 0.2); }
  50% { box-shadow: 0 0 15px rgba(255, 204, 0, 0.8), 0 0 30px rgba(255, 204, 0, 0.4); }
}
.glow-button { animation: glowPulse 2s ease-in-out infinite; }
```

---

## Feature: Custom Shop Markers

Shared `ShopMarker` component — Leaflet DivIcon with storefront icon, yellow border, selected state.

```typescript
// components/map/ShopMarker.tsx
export const createShopIcon = (isSelected: boolean) => {
  return L.divIcon({
    className: 'custom-shop-marker',
    html: `
      <div style="
        width: 44px; height: 44px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        background: ${isSelected ? '#FFCC00' : '#18181b'};
        border: 2px solid #FFCC00;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="${isSelected ? '#000' : '#FFCC00'}" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
};
```

---

## Feature: Radius Controls

Shared `RadiusControl` component with shop count badge.

```
┌──────────────────────────────────────┐
│ 🏪 3 within 1 mi    [ − ] 1 mi [ + ] │
└──────────────────────────────────────┘
```

- Steps: 1, 2, 5, 10, 15, 20 mi
- Default: 1 mi
- Only visible when `hasLocation === true`

**Haversine distance** (`utils/distance.ts` — shared):
```typescript
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function milesToMeters(miles: number): number { return miles * 1609.34; }
export function metersToMiles(meters: number): number { return meters / 1609.34; }
```

---

## Feature: Shop Search Bar

Shared `ShopSearchBar` — filters both map markers and sidebar list simultaneously.

```typescript
// Filtering logic lives in useShopMap
const displayedShops = useMemo(() => {
  let result = hasLocation ? nearbyShops : shops;
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    result = result.filter((shop) =>
      shop.shopName?.toLowerCase().includes(query) ||
      shop.shopAddress?.toLowerCase().includes(query)
    );
  }
  if (selectedCategory) {
    result = result.filter((shop) => shop.categories?.includes(selectedCategory));
  }
  return result;
}, [shops, nearbyShops, hasLocation, searchQuery, selectedCategory]);
```

---

## Feature: Directions with Route

Shared `DirectionsPanel` + `utils/route.ts` — route polyline, distance, drive time.

**Route fetching** (`utils/route.ts` — shared):
```typescript
const API_KEY = process.env.NEXT_PUBLIC_OPENROUTESERVICE_API_KEY;

export async function fetchRoute(
  startLat: number, startLng: number, endLat: number, endLng: number
): Promise<{ coordinates: [number, number][]; distance: number; duration: number } | null> {
  const response = await fetch(
    `https://api.openrouteservice.org/v2/directions/driving-car?` +
    `api_key=${API_KEY}&start=${startLng},${startLat}&end=${endLng},${endLat}`
  );
  const data = await response.json();
  const feature = data.features?.[0];
  if (!feature) return null;
  return {
    coordinates: feature.geometry.coordinates.map(([lng, lat]: number[]) => [lat, lng]),
    distance: feature.properties.summary.distance,
    duration: feature.properties.summary.duration,
  };
}
```

**DirectionsPanel** shows distance (mi) and drive time (min) with a close button. "Get Directions" button appears in ShopInfoPanel when `userLocation` is available.

---

## Feature: Category Filter

Shared `CategoryFilter` — horizontal chips, filters `displayedShops` in `useShopMap`.

---

## Files to Create/Modify

### Backend
1. `backend/src/repositories/ShopRepository.ts` — Add `getShopsWithLocation()` method
2. `backend/src/domains/shop/routes/index.ts` — Add `GET /shops/map` route

### Frontend — New Shared Files (reusable across Services Map + Find Shop)
| File | Purpose | Used By |
|---|---|---|
| `frontend/src/hooks/useShopMap.ts` | Core hook: location, radius, filtering, search, directions | Both pages |
| `frontend/src/utils/distance.ts` | Haversine, milesToMeters, metersToMiles | Hook + components |
| `frontend/src/utils/route.ts` | OpenRouteService route fetching | Hook |
| `frontend/src/components/map/ShopMapContainer.tsx` | Leaflet map with markers, circle, polyline | Both pages |
| `frontend/src/components/map/ShopMarker.tsx` | Custom DivIcon factory | ShopMapContainer |
| `frontend/src/components/map/RadiusControl.tsx` | Radius −/+ bar with shop count | ShopMapContainer |
| `frontend/src/components/map/ShopSearchBar.tsx` | Search input with clear button | Both pages |
| `frontend/src/components/map/DirectionsPanel.tsx` | Route distance/duration display | MapSidebar |
| `frontend/src/components/map/CategoryFilter.tsx` | Horizontal category chips | Both pages |
| `frontend/src/components/map/ShopInfoPanel.tsx` | Selected shop details + actions | MapSidebar |
| `frontend/src/components/map/NearbyShopsList.tsx` | Sorted shop list with distances | MapSidebar |
| `frontend/src/components/map/LocationButton.tsx` | "Update Location" / glow animation | Both pages |
| `frontend/src/components/map/MapSidebar.tsx` | Sidebar container (info + list) | Both pages |

### Frontend — Modified Files (Phase A: Services Map)
1. `frontend/src/components/customer/ShopMapView.tsx` — Rewrite: consumes shared components via `useShopMap`
2. `frontend/src/components/customer/ServiceMarketplaceClient.tsx` — Decouple map data from services pagination
3. `frontend/src/services/api/shop.ts` — Add `getShopsForMap()` API method
4. `frontend/src/app/globals.css` — Add `glowPulse` keyframe animation

### Frontend — Future Files (Phase B: Find Shop — next task)
1. `frontend/src/components/customer/FindShopMap.tsx` — Consumes same shared components, different config

### Environment
1. `.env.production` — `NEXT_PUBLIC_MAP_DEFAULT_LAT=39.8283`, `NEXT_PUBLIC_MAP_DEFAULT_LNG=-98.5795`, `NEXT_PUBLIC_MAP_DEFAULT_ZOOM=4`
2. `.env.development` — Same vars with Philippines coordinates
3. `.env` — `NEXT_PUBLIC_OPENROUTESERVICE_API_KEY`

### Mobile Reference Files (architecture to replicate)
| Mobile File | Web Equivalent |
|---|---|
| `mobile/feature/find-shop/hooks/ui/useFindShop.ts` | `frontend/src/hooks/useShopMap.ts` |
| `mobile/feature/find-shop/utils/index.ts` | `frontend/src/utils/distance.ts` |
| `mobile/shared/providers/RouteProvider.ts` | `frontend/src/utils/route.ts` |
| `mobile/feature/find-shop/components/RadiusControl.tsx` | `frontend/src/components/map/RadiusControl.tsx` |
| `mobile/feature/find-shop/components/ShopPopupExpanded.tsx` | `frontend/src/components/map/ShopInfoPanel.tsx` |
| `mobile/feature/find-shop/components/DirectionsPanelExpanded.tsx` | `frontend/src/components/map/DirectionsPanel.tsx` |
| `mobile/feature/find-shop/components/CategoryFilter.tsx` | `frontend/src/components/map/CategoryFilter.tsx` |
| `mobile/feature/find-shop/screens/FindShopScreen.tsx` | `frontend/src/components/customer/FindShopMap.tsx` |

---

## Reproduction Steps (Current Bugs)

1. Login as customer `0x6cd036477D1C39dA021095a62A32c6bB919993Cf`
2. Navigate to Services > Shops tab (Map view)
3. Observe: only 2 shop markers visible despite more shops in the system
4. Click "Use My Location" → map centers on your position
5. Observe: still only 2 shops shown, no proximity-based filtering applied
6. Toast says "Showing nearby shops" but shop list is unchanged
7. "Nearby Shops" lists same 2 shops regardless of user location or distance
