# Bug: Service search results count shows page size instead of total matches

**Status:** Completed
**Priority:** High
**Est. Effort:** 30 minutes
**Created:** 2026-04-16
**Updated:** 2026-04-16
**Completed:** 2026-04-16

## Problem

On both the customer marketplace and the shop Services tab, the results count under the search field displayed the number of items **currently loaded in memory** (page size, typically 10) instead of the **total matching results** reported by the API.

This made search feel broken — users saw "10 results found" for any query (e.g., searching "Ser" against 39 total matches), even though the underlying list was in fact filtered correctly.

## Analysis

### Root cause

The `useInfiniteQuery` responses contain `pagination.totalItems` (server-side count of all matching rows across pages). The components were ignoring it and using `filteredServices.length` / `serviceCount`, which only reflects what's loaded client-side.

- `feature/service/screens/ServicesTabContent.tsx` (customer) line 155 — used `filteredServices.length`
- `feature/service/components/ServicesTab.tsx` (shop) line 168 — used `serviceCount`

Both hooks (`useServicesTab` for customer, `useServicesTabUI` for shop) had the paged data available but never exposed the total.

### Confirmation

The underlying query filtering works correctly — list items change on search. Only the count label was wrong. Backend returns accurate `totalItems`.

## Implementation

### Files modified

- `mobile/feature/service/hooks/ui/useServicesTab.ts`
  - Added `totalResults` memo reading `servicesPages.pages[0]?.pagination?.totalItems`.
  - Falls back to `filteredServices.length` if pagination metadata is missing.
  - Exposed from the hook's return.
- `mobile/feature/service/screens/ServicesTabContent.tsx`
  - Destructured `totalResults` and used it in the results-count label.
- `mobile/feature/service/hooks/ui/useServicesTabUI.ts`
  - Added the same `totalResults` memo and exposed it alongside `serviceCount`.
- `mobile/feature/service/components/ServicesTab.tsx`
  - Destructured `totalResults` and used it in the results-count label.

### Approach

Minimal change — only the count label consumer was swapped. `filteredServices` / `serviceCount` are still returned (used by the FlatList data/extraData), just no longer used for the count display.

## Verification Checklist

- [x] Customer: search "Ser" → shows total matches (e.g., "39 results found"), not page size
- [x] Customer: clear search → count hidden (no search active)
- [x] Customer: search with no matches → shows "0 results found"
- [x] Customer: apply single category → count reflects server-filtered total
- [x] Shop: same behavior — count reflects server total for active search/filter
- [x] Load more pages → count stays at total (doesn't increment as pages load)

## Notes

- **Edge case:** Client-side-only filters (customer status filter, shop multi-category, customer sorting) operate on already-loaded pages. When those are active, `totalResults` shows the server total for the active server-side filters, which may be larger than `filteredServices.length`. This matches the bug-report-specified behavior and is still a major improvement over the previous "always 10". Future work could reconcile by falling back to `filteredServices.length` when client-side filters are active.
- **Related:** Paired with the earlier shop-side fix where `search` / `category` were not forwarded to the backend (see `completed/bug-shop-services-search-silent-fail.md`). Together, shop search now both filters and displays the correct count.
