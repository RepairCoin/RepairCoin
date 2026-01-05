# BUG-006: Shop services list has no pagination UI despite backend support

**Type:** Bug
**Severity:** Low
**Priority:** P3
**Component:** Frontend - Shop Services Tab
**Labels:** bug, frontend, pagination, ux

---

## Description

The Shop Services tab does not display pagination controls even when a shop has many services (27+). All services are loaded in a single request with a hardcoded limit of 100, and no pagination UI is rendered.

---

## Steps to Reproduce

1. Login as shop owner
2. Create 25+ services
3. Navigate to Shop Dashboard → Services tab
4. Scroll through the service list
5. Observe: No pagination controls (page numbers, next/previous buttons) are visible
6. All 27 services are displayed on a single page

---

## Expected Result

- Pagination controls should appear when services exceed a reasonable page limit (e.g., 12-20 per page)
- Page numbers or "Load More" button should be available
- Users should be able to navigate between pages
- Backend pagination metadata should be used

---

## Actual Result

- All services (up to 100) are loaded and displayed on one page
- No pagination controls are visible
- No page numbers, next/previous buttons, or load more functionality
- Services list can become very long and impact performance

---

## Root Cause Analysis

**File:** `frontend/src/components/shop/tabs/ServicesTab.tsx` (Line 58)

```typescript
const loadServices = async () => {
  setLoading(true);
  try {
    const response = await getShopServices(shopId, { limit: 100 });  // <-- HARDCODED LIMIT
    if (response?.data) {
      setServices(response.data);  // All services in one array
    }
  }
  ...
}
```

**Issues:**
1. Hardcoded `limit: 100` bypasses practical pagination
2. No state management for current page (`currentPage`, `totalPages`)
3. No pagination UI component rendered
4. Response pagination metadata (`totalPages`, `hasMore`) is ignored

**Backend Support EXISTS:**
- ✅ `ServiceController.getShopServices()` - Supports `page` and `limit` query params
- ✅ `ServiceRepository.getServicesByShop()` - Implements proper offset pagination
- ✅ API returns `PaginatedResponse<ShopService>` with `page`, `limit`, `totalItems`, `totalPages`, `hasMore`

---

## Acceptance Criteria

- [ ] Default limit reduced to 12-20 services per page
- [ ] Pagination controls appear when `totalPages > 1`
- [ ] Page numbers or prev/next buttons are clickable
- [ ] Current page is highlighted/indicated
- [ ] "Showing X-Y of Z services" indicator displayed
- [ ] Loading state shown when changing pages
- [ ] Scroll to top when page changes

---

## Technical Fix

**File:** `frontend/src/components/shop/tabs/ServicesTab.tsx`

### Add pagination state:
```typescript
const [currentPage, setCurrentPage] = useState(1);
const [totalPages, setTotalPages] = useState(1);
const [totalItems, setTotalItems] = useState(0);
const ITEMS_PER_PAGE = 12;
```

### Update loadServices function:
```typescript
const loadServices = async (page = 1) => {
  setLoading(true);
  try {
    const response = await getShopServices(shopId, {
      page,
      limit: ITEMS_PER_PAGE
    });
    if (response?.data) {
      setServices(response.data);
      setCurrentPage(response.pagination?.page || 1);
      setTotalPages(response.pagination?.totalPages || 1);
      setTotalItems(response.pagination?.total || response.data.length);
    }
  } finally {
    setLoading(false);
  }
};
```

### Add pagination UI:
```tsx
{totalPages > 1 && (
  <div className="flex justify-center items-center gap-2 mt-6">
    <button
      onClick={() => loadServices(currentPage - 1)}
      disabled={currentPage === 1}
      className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50"
    >
      Previous
    </button>
    <span className="text-gray-400">
      Page {currentPage} of {totalPages}
    </span>
    <button
      onClick={() => loadServices(currentPage + 1)}
      disabled={currentPage === totalPages}
      className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50"
    >
      Next
    </button>
  </div>
)}
```

---

## Related Files

| File | Status |
|------|--------|
| `frontend/src/components/shop/tabs/ServicesTab.tsx` | ❌ Needs pagination UI |
| `frontend/src/services/api/services.ts` | ✅ API supports pagination |
| `backend/src/domains/ServiceDomain/controllers/ServiceController.ts` | ✅ Backend supports pagination |
| `backend/src/repositories/ServiceRepository.ts` | ✅ Repository implements pagination |

---

## Impact

| Area | Impact |
|------|--------|
| **Performance** | Loading 100 items at once may slow page load |
| **UX** | Long scroll required for shops with many services |
| **Consistency** | Other lists in app may have pagination |
| **Scalability** | Will become worse as shops add more services |
