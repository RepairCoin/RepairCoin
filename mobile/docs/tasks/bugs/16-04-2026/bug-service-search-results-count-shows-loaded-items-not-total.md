# Bug: Service Search Results Count Shows Loaded Page Items Instead of Total Matches

**Status:** Open
**Priority:** Medium
**Est. Effort:** 30 min
**Created:** 2026-04-16
**Updated:** 2026-04-16

---

## Problem

When searching services in the customer marketplace, the results count displays `filteredServices.length` (number of items loaded in memory from page 1, typically 10) instead of `pagination.totalItems` (the actual total matching results from the API). This makes search appear broken — the count always shows "10 results found" regardless of what is typed, even though the actual data IS filtering correctly.

### Example

- Search "Ser" → API returns 39 total matches, 10 on page 1 → UI shows "10 results found"
- No search → API returns 110 total, 10 on page 1 → UI would show "10 results found" if displayed
- User sees "10 results found" in both cases and concludes search is not working

### Confirmation

The customer search IS working — the displayed items change correctly when searching. Backend API returns properly filtered results. The only issue is the misleading count display.

---

## Root Cause

**File:** `feature/service/screens/ServicesTabContent.tsx` (lines 153-158)

```typescript
{(searchQuery.length > 0 || hasActiveFilters) && (
  <Text className="text-gray-400 text-sm mb-2">
    {filteredServices.length} result          {/* ← Shows loaded items (10), not total (39) */}
    {filteredServices.length !== 1 ? "s" : ""} found
  </Text>
)}
```

`filteredServices.length` = number of items loaded in memory (typically 10 per page). Should use the pagination total from the API instead.

---

## Implementation

### 1. Expose pagination total from `useServicesTab` hook

**File:** `feature/service/hooks/ui/useServicesTab.ts`

Add a `totalResults` value derived from the API pagination:

```typescript
const totalResults = useMemo(() => {
  if (!servicesPages?.pages?.length) return 0;
  return servicesPages.pages[0]?.pagination?.totalItems ?? filteredServices.length;
}, [servicesPages, filteredServices.length]);
```

Return it from the hook:
```typescript
return {
  // ...existing
  totalResults,
};
```

### 2. Use `totalResults` in the component

**File:** `feature/service/screens/ServicesTabContent.tsx` (lines 153-158)

```typescript
{(searchQuery.length > 0 || hasActiveFilters) && (
  <Text className="text-gray-400 text-sm mb-2">
    {totalResults} result
    {totalResults !== 1 ? "s" : ""} found
  </Text>
)}
```

### 3. Same fix for shop side

**File:** `feature/service/hooks/ui/useServicesTabUI.ts`

Apply the same pattern — expose `totalResults` from pagination instead of `filteredServices.length`.

**File:** `feature/service/components/ServicesTab.tsx`

Update the count display to use `totalResults`.

---

## Files to Modify

| File | Change |
|------|--------|
| `feature/service/hooks/ui/useServicesTab.ts` | Add `totalResults` from pagination data |
| `feature/service/screens/ServicesTabContent.tsx` | Use `totalResults` instead of `filteredServices.length` |
| `feature/service/hooks/ui/useServicesTabUI.ts` | Add `totalResults` from pagination data |
| `feature/service/components/ServicesTab.tsx` | Use `totalResults` instead of `serviceCount` |

---

## Verification Checklist

- [ ] Customer: search "Ser" → shows "39 results found" (not "10 results found")
- [ ] Customer: clear search → results count hidden (no search active)
- [ ] Customer: search with no matches → shows "0 results found"
- [ ] Customer: apply category filter → count reflects filtered total
- [ ] Shop: same behavior (after shop search backend fix is applied)
- [ ] Load more pages → count stays at total (doesn't increment as pages load)

---

## Notes

- The customer search backend and mobile code chain are working correctly — data does filter. This is purely a display issue.
- This bug exists on both customer (`ServicesTabContent`) and shop (`ServicesTab`) screens.
- The shop search has a separate, more severe bug (search param not sent to API) documented in `bugs/16-04-2026/bug-shop-service-search-not-filtering-results.md`.
