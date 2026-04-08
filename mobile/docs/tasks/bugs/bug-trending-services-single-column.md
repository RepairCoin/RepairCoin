# Bug: Trending Services Page Uses Single-Column Layout Instead of Grid

**Status:** Open
**Priority:** Low
**Est. Effort:** 30 min
**Created:** 2026-04-08
**Updated:** 2026-04-08

## Overview

The Trending Services page displays service cards in a single-column list layout. It should use a 2-column grid with proper spacing, matching the Services tab layout.

**Affected:** Trending Services page (mobile only)

## Current vs Expected

| Current | Expected |
|---------|----------|
| Single column, full width cards | 2-column grid, half-width cards |
| Inconsistent with Services tab | Matches Services tab layout |

## Files to Investigate

| File | Role |
|------|------|
| `mobile/feature/home/components/customer-wallet/TrendingSection.tsx` | Trending section on home (may link to full page) |
| `mobile/feature/service/screens/ServicesTabContent.tsx` | Reference for correct 2-column grid layout |

---

## Fix

Match the FlatList configuration from `ServicesTabContent.tsx`:

```tsx
<FlatList
  data={trendingServices}
  numColumns={2}
  columnWrapperStyle={{ gap: 16 }}
  contentContainerStyle={{ paddingHorizontal: 16 }}
  renderItem={({ item }) => (
    <View style={{ flex: 1, maxWidth: '50%' }}>
      <ServiceCard service={item} ... />
    </View>
  )}
/>
```

---

## QA Test Plan

1. Go to Home → tap "Trending" section → opens Trending Services page
2. **Before fix:** Cards stacked in single column
3. **After fix:** Cards in 2-column grid with consistent spacing
4. Compare with Services tab → layout should match
5. Test with odd number of items → last row shows single card aligned left
