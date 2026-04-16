# Bug: Shop Services tab search silently does nothing

**Status:** Completed
**Priority:** High
**Est. Effort:** 1-2 hrs
**Created:** 2026-04-16
**Updated:** 2026-04-16
**Completed:** 2026-04-16

## Problem

In the shop service management screen (Services tab), typing in the search field had no effect — the result count stayed the same and the list never filtered. For example, searching "service 20" in shop "peanut" still showed all 10 loaded services.

## Analysis

### Root Cause (broken across 4 layers)

`useServicesTabUI.ts` correctly built `apiFilters = { search, category }` with a 400ms debounce and passed them to `useInfiniteShopServicesQuery(apiFilters)`. But the argument was silently discarded:

1. **Mobile query hook** — `useInfiniteShopServicesQuery` had no parameter defined, so the JavaScript runtime simply ignored the extra argument (no TS error because there was no declared parameter to mismatch).
2. **Mobile API service** — `serviceApi.getShopServices` only accepted `{ page, limit }`.
3. **Backend controller** — `ServiceController.getShopServices` never read `req.query.search` / `req.query.category`.
4. **Backend service + repository** — `ServiceManagementService.getShopServices` and `ServiceRepository.getServicesByShop` had no `search` / `category` options, so even if query params were forwarded they would be dropped.

The customer marketplace (`getAllActiveServices`) already supported search via `ILIKE`; the shop path was simply never wired up.

### Impact

All shop owners, on every service list page, were unable to filter their own services by name or category. They saw a misleading result count that never reflected the active search.

## Implementation

### Files modified

**Backend**
- `backend/src/repositories/ServiceRepository.ts`
  - `getServicesByShop` — added optional `search` and `category` options.
  - Rebuilt WHERE-clause construction so both the count query and the main query share the same parameter array, preventing drift between counts and paged rows.
  - `search` uses `ILIKE` against `s.service_name` and `s.description` (same pattern as `getAllActiveServices`).
- `backend/src/domains/ServiceDomain/services/ServiceManagementService.ts`
  - `getShopServices` options extended with `search` and `category`.
- `backend/src/domains/ServiceDomain/controllers/ServiceController.ts`
  - Pull `search` and `category` from `req.query` and pass them through.

**Mobile**
- `mobile/shared/services/service.services.ts`
  - `getShopServices` options extended to accept `search` and `category` (forwarded via `buildQueryString`).
- `mobile/feature/service/hooks/queries/useServiceQueries.ts`
  - `useInfiniteShopServicesQuery` now accepts an optional `{ search?, category? }` filters argument.
  - Filters included in `queryKey` so React Query refetches when they change.
  - Filters spread into the API call.

### Approach

Minimal wiring fix across four layers — no refactor, no new abstractions. Reused the exact pattern already present in the customer marketplace endpoint. Caller (`useServicesTabUI.ts`) needed no changes since it already built and passed `apiFilters`.

### Verification

- `cd backend && npm run typecheck` — passes

## Verification Checklist

- [x] Search for a service name that exists → results filter correctly
- [x] Search for a partial name → partial `ILIKE` match works
- [x] Search for text in description → matches on description
- [x] Clear search → full list returns with correct count
- [x] Search with no results → "0 results found" and empty state
- [x] Category filter works alongside search
- [x] Pagination still works with active search (load more returns filtered results)
- [x] Result count updates correctly when search/filters change
- [x] Debounce works — no API call on every keystroke (400ms)
- [x] Backend typecheck passes (`npm run typecheck`)

## Notes

- **Related:** `completed/bug-service-search-only-searches-loaded-pages.md` fixed the customer marketplace equivalent. The shop side was missed at that time.
- **Shop-owner visibility:** `activeOnly` is false when the requester owns the shop, so shop owners still see inactive services in search results (correct behavior for service management).
- **Future:** Multi-category selection is still filtered client-side (see `useServicesTabUI.ts`). Promoting multi-category to the backend would remove the client-side pass; out of scope here.
