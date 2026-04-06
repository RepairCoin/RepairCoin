# Bug: Service Search Only Finds Items in Already-Loaded Pages

## Status: Open
## Priority: High
## Date: 2026-04-06
## Category: Bug - Service Marketplace
## Affected: Customer service browsing (mobile only)

---

## Overview

The mobile service marketplace search only filters services that have already been loaded via infinite scroll pagination. If a matching service exists on page 2 or beyond and hasn't been fetched yet, it won't appear in search results. The web app works correctly because it sends the search query to the backend API which searches across all services.

---

## Root Cause

Search is done **client-side only** — it filters the in-memory array of already-loaded pages instead of sending the search query to the backend API.

### The Problem Chain

1. `useServicesTab.ts` line 22 — calls `useInfiniteServicesQuery()` with **no parameters**
2. `useService.ts` `useInfiniteServicesQuery()` — sends API request with no search/filter params
3. API returns page 1 (10 items) without any search filter
4. `useServicesTab.ts` line 98-103 — filters the 10 loaded items client-side by `searchQuery`
5. Services on unloaded pages are never found

### Why Web Works

`ServiceMarketplaceClient.tsx` passes `filters` (including `search`) directly to `getAllServices()` API call and resets to page 1 on filter change. The backend handles search via `ILIKE` on `service_name` and `description`.

---

## Code Locations

### Mobile (broken)

**`mobile/feature/service/hooks/ui/useServicesTab.ts`**
- Line 22: `useInfiniteServicesQuery()` — called with no filters
- Lines 98-103: Client-side search filtering on already-loaded data:
  ```typescript
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    services = services.filter((service: ServiceData) =>
      service.serviceName.toLowerCase().includes(query)
    );
  }
  ```

**`mobile/shared/hooks/service/useService.ts`** — `useInfiniteServicesQuery`
- queryKey: `['services', 'infinite', filters]` — `filters` is always undefined
- queryFn calls `serviceApi.getAll({ ...filters, page: pageParam, limit: 10 })` — no search param

**`mobile/shared/services/service.services.ts`** line 17-25
- `getAll(filters)` supports filters but never receives search from the hook

### Backend (works correctly)

**`backend/src/repositories/ServiceRepository.ts`** lines 349-353:
```sql
(s.service_name ILIKE $N OR s.description ILIKE $N)
```
Backend supports `?search=query` and searches across ALL services with pagination.

### Web (works correctly)

**`frontend/src/components/customer/ServiceMarketplaceClient.tsx`**
- Passes `filters` (including search) to API call
- Resets page to 1 when filters change

---

## Fix Required

Pass `searchQuery` (and other filters) to `useInfiniteServicesQuery` so the backend handles search server-side.

### Option A: Pass search to infinite query (recommended)

1. **`useServicesTab.ts`** — pass search and filters to the infinite query:
   ```typescript
   const filters = useMemo(() => ({
     search: searchQuery.trim() || undefined,
     category: selectedCategories.length > 0 ? selectedCategories.join(',') : undefined,
     minPrice: priceRange.min ?? undefined,
     maxPrice: priceRange.max ?? undefined,
   }), [searchQuery, selectedCategories, priceRange]);

   const { data: servicesPages, ... } = useInfiniteServicesQuery(filters);
   ```

2. **`useService.ts`** — ensure `useInfiniteServicesQuery` passes filters to API and includes them in queryKey:
   ```typescript
   const useInfiniteServicesQuery = (filters?: ServiceFilters) => {
     return useInfiniteQuery({
       queryKey: ['services', 'infinite', filters],
       queryFn: async ({ pageParam = 1 }) => {
         const response = await serviceApi.getAll({ ...filters, page: pageParam, limit: 10 });
         return { data: response.data || [], pagination: response.pagination };
       },
       ...
     });
   };
   ```

3. **`useServicesTab.ts`** — remove client-side search filter (lines 98-103) since backend handles it. Keep client-side sorting only.

4. **Add debounce** — debounce the search input (300-500ms) to avoid excessive API calls on every keystroke.

### Option B: Fetch all pages on search (not recommended)

Fetch all pages when user searches — bad for performance with large datasets.

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/service/hooks/ui/useServicesTab.ts` | Pass filters to infinite query, remove client-side search |
| `mobile/shared/hooks/service/useService.ts` | Accept and forward filters in `useInfiniteServicesQuery` |

---

## QA Test Plan

### Reproduce Bug (before fix)
1. Open mobile app as customer
2. Go to Marketplace → Services tab
3. Note which services are visible (first 10)
4. Type a service name that exists but is NOT in the first 10 items
5. **Result**: No results found (service exists in DB but not loaded yet)

### Verify Fix
1. Search for a service name that exists on page 2+
2. **Expected**: Service appears in results (backend searched all services)
3. Search for partial name (e.g., "box" for "BOXING TRAINING")
4. **Expected**: Matches on partial service name
5. Search for text in description
6. **Expected**: Matches on description too (backend searches both fields)
7. Clear search → verify full list returns
8. Type search → load more → verify pagination works with search active
9. Compare results with web app — should be identical
