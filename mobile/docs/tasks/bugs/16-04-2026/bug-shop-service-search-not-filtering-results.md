# Bug: Shop Service Search Not Filtering Results

**Status:** Open
**Priority:** High
**Est. Effort:** 2-3 hrs
**Created:** 2026-04-16
**Updated:** 2026-04-16

---

## Problem

In the shop service management screen (Services tab), typing in the search field has no effect. The result count always shows "10 results found" regardless of the search query, and the displayed services never change. For example, searching "service 20" in shop "peanut" still shows all 10 loaded services with no filtering.

---

## Analysis

The `useServicesTabUI.ts` hook correctly builds `apiFilters` with debounced search and passes them to `useInfiniteShopServicesQuery(apiFilters)`. However, the filters are silently ignored because the 3 layers below never received the corresponding changes:

### Problem Chain (4 broken layers)

| Layer | File | Issue |
|-------|------|-------|
| **1. Mobile Query Hook** | `feature/service/hooks/queries/useServiceQueries.ts` (line 28) | `useInfiniteShopServicesQuery()` accepts **no parameters** — the `apiFilters` argument is silently discarded |
| **2. Mobile API Service** | `shared/services/service.services.ts` (line 27-40) | `getShopServices()` only accepts `{ page?, limit? }` — no `search` or `category` option |
| **3. Backend Controller** | `backend/src/domains/ServiceDomain/controllers/ServiceController.ts` (line 140-146) | `getShopServices` only extracts `page` and `limit` from `req.query` — ignores `search` and `category` |
| **4. Backend Repository** | `backend/src/repositories/ServiceRepository.ts` (line 204-212) | `getServicesByShop()` options only accept `page`, `limit`, `activeOnly`, `customerAddress` — no `search` or `category` in the SQL query |

### Why it silently fails

TypeScript doesn't error because `useInfiniteShopServicesQuery` has no parameter defined — the extra argument is just ignored by JavaScript at runtime. No runtime error, no console warning.

---

## Implementation

### 1. Backend Repository — `ServiceRepository.ts` (line 204-212)

Add `search` and `category` to the options type and the SQL WHERE clause:

```typescript
async getServicesByShop(
  shopId: string,
  options: {
    page?: number;
    limit?: number;
    activeOnly?: boolean;
    customerAddress?: string;
    search?: string;      // ADD
    category?: string;    // ADD
  } = {}
)
```

Add to WHERE clause (after the `activeOnly` check):

```typescript
if (options.search) {
  whereClause += ` AND (s.service_name ILIKE $N OR s.description ILIKE $N)`;
  // Use parameterized query with `%${options.search}%`
}
if (options.category) {
  whereClause += ` AND s.category = $N`;
}
```

Ensure the count query and the main query both use the same `whereClause` and params.

### 2. Backend Service — `ServiceManagementService.ts` (line 167-174)

Add `search` and `category` to the options type:

```typescript
async getShopServices(
  shopId: string,
  options: {
    page?: number;
    limit?: number;
    activeOnly?: boolean;
    customerAddress?: string;
    search?: string;      // ADD
    category?: string;    // ADD
  } = {}
)
```

### 3. Backend Controller — `ServiceController.ts` (line 140-146)

Extract `search` and `category` from query params and pass them through:

```typescript
const options = {
  page: parseInt(req.query.page as string) || 1,
  limit: parseInt(req.query.limit as string) || 20,
  activeOnly: requestingShopId !== shopId,
  customerAddress,
  search: req.query.search as string || undefined,       // ADD
  category: req.query.category as string || undefined,    // ADD
};
```

### 4. Mobile API Service — `service.services.ts` (line 27-40)

Extend the options type to accept search and category:

```typescript
async getShopServices(
  shopId: string,
  options?: { page?: number; limit?: number; search?: string; category?: string }
): Promise<ServiceResponse> {
  const queryString = options ? buildQueryString(options) : "";
  return await apiClient.get<ServiceResponse>(`/services/shop/${shopId}${queryString}`);
}
```

### 5. Mobile Query Hook — `useServiceQueries.ts` (line 28-54)

Accept filters parameter, include in queryKey, and spread into API call:

```typescript
export function useInfiniteShopServicesQuery(filters?: { search?: string; category?: string }) {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId ?? "";

  return useInfiniteQuery({
    queryKey: ['shopServices', 'infinite', shopId, filters],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await serviceApi.getShopServices(shopId, {
        ...filters,
        page: pageParam,
        limit: 10,
      });
      return {
        data: response.data || [],
        pagination: response.pagination,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination?.hasMore) {
        return (lastPage.pagination.page || 1) + 1;
      }
      return undefined;
    },
    enabled: !!shopId,
    staleTime: 5 * 60 * 1000,
  });
}
```

No changes needed to `useServicesTabUI.ts` — it already correctly builds and passes `apiFilters`.

---

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/repositories/ServiceRepository.ts` | Add `search` and `category` to `getServicesByShop()` options and SQL WHERE clause |
| `backend/src/domains/ServiceDomain/services/ServiceManagementService.ts` | Add `search` and `category` to `getShopServices()` options type |
| `backend/src/domains/ServiceDomain/controllers/ServiceController.ts` | Extract `search` and `category` from `req.query` and pass to service |
| `mobile/shared/services/service.services.ts` | Add `search` and `category` to `getShopServices()` options |
| `mobile/feature/service/hooks/queries/useServiceQueries.ts` | Accept filters param in `useInfiniteShopServicesQuery()`, include in queryKey |

---

## Verification Checklist

- [ ] Search for a service name that exists → results filter correctly
- [ ] Search for a partial name (e.g., "box" for "BOXING TRAINING") → partial match works
- [ ] Search for text in description → matches on description
- [ ] Clear search → full list returns with correct count
- [ ] Search with no results → shows "0 results found" and empty state
- [ ] Category filter works alongside search
- [ ] Pagination still works with active search (load more returns filtered results)
- [ ] Result count updates correctly when search/filters change
- [ ] Debounce works — no API call on every keystroke (400ms delay)
- [ ] Backend typecheck passes: `cd backend && npm run typecheck`

---

## Notes

- This is the **shop-side** equivalent of the customer marketplace search bug documented in `completed/bug-service-search-only-searches-loaded-pages.md`. The customer side was fixed, but the shop side was missed.
- `useServicesTabUI.ts` (the caller) was already updated with debounce and filter building — only the downstream layers were never wired up.
- The backend `getAllActiveServices()` (customer endpoint) already supports search via ILIKE — the same pattern should be applied to `getServicesByShop()`.
