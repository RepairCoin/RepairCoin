# Bug: Shops Tab Shows Empty When Service Category Filter Is Active

**Status:** fixed (Option A applied)
**Priority:** medium
**Date:** 2026-03-31
**Platform:** Web (Next.js)
**Affects:** Customer role — Marketplace > Shops tab

---

## Summary

When a customer selects a service category (e.g., "Health & Wellness") on the Marketplace Services tab, then switches to the Shops tab, no shops are found. The category filter from the Services tab leaks into the Shops tab, but the two use incompatible category systems — service categories vs shop categories.

---

## Root Cause: Shared Filter State + Incompatible Category Systems

### Two different category systems:

| System | Values | Column | Example |
|---|---|---|---|
| **Service categories** (`shop_services.category`) | `health_wellness`, `repairs`, `food_beverage` | snake_case | Selected on Services tab |
| **Shop categories** (`shops.category`) | `"Health and Wellness"`, `"Repairs and Tech"` | Human-readable | What ShopsGridView filters by |

### Data flow:

1. Customer selects "Health & Wellness" on Services tab → `filters.category = "health_wellness"`
2. Customer clicks "Shops" tab
3. `ServiceMarketplaceClient.tsx:391` passes `selectedCategory={filters.category}` to `ShopsGridView`
4. `ShopsGridView.tsx:67` filters: `shop.category === selectedCategory`
5. Compares `"Health and Wellness" === "health_wellness"` → `false` → 0 results

---

## Affected Files

1. **`frontend/src/components/customer/ServiceMarketplaceClient.tsx`** (line 391)
   - Passes `filters.category` (service category) to ShopsGridView

2. **`frontend/src/components/customer/ShopsGridView.tsx`** (line 67)
   - Filters by `shop.category === selectedCategory` (shop category column)

---

## Fix Options

### Option A: Clear category filter when switching tabs (Simplest)

**File:** `frontend/src/components/customer/ServiceMarketplaceClient.tsx`

When switching to Shops tab, don't pass the service category filter:

```diff
  {activeTab === "shops" && (
    <ShopsGridView
      searchTerm={filters.search}
-     selectedCategory={filters.category}
+     selectedCategory=""
    />
  )}
```

### Option B: Convert service category to shop category filter

Map `health_wellness` → `"Health and Wellness"` when passing to ShopsGridView. Fragile — requires maintaining a mapping between two systems.

### Option C: ShopsGridView filters by service categories (Best)

Change `ShopsGridView.tsx` to use the `GET /api/shops/map` endpoint (which includes `serviceCategories` array) and filter shops by whether they have services in the selected category:

```typescript
filtered = filtered.filter((shop) =>
  shop.serviceCategories?.includes(selectedCategory)
);
```

This aligns with the Find Shop page fix already implemented in `ShopRepository.searchActiveShops`.

---

## Reproduction Steps

1. Login as customer
2. Navigate to Marketplace > Services tab
3. Select a category filter (e.g., "Health & Wellness")
4. Observe: filtered services appear correctly
5. Click the "Shops" tab
6. Observe: "0 Active Shops" and "No shops found"
7. Click back to "Services" tab → services still show correctly
