# Bug: Trending Services Page Uses Single Column Instead of 2-Column Grid

## Status: Open
## Priority: Low
## Date: 2026-04-07
## Category: Bug - UI Layout
## Affected: Customer Trending Services screen (mobile)

---

## Overview

The Trending Services page displays service cards in a single-column list layout. It should use a 2-column grid with proper spacing, matching the Services tab layout.

---

## Current vs Expected

| Screen | Current | Expected |
|---|---|---|
| Trending Services page | Single column, full-width cards | 2-column grid, half-width cards with gap |
| Services tab (reference) | 2-column grid with proper spacing | — (already correct) |

---

## Files to Investigate

| File | Purpose |
|------|---------|
| `mobile/feature/service/screens/TrendingServicesScreen.tsx` | Trending services full page — needs `numColumns={2}` on FlatList |
| `mobile/feature/service/screens/ServicesTabContent.tsx` | Services tab — reference for correct 2-column grid layout |
| `mobile/feature/home/components/customer-wallet/TrendingSection.tsx` | Home screen trending section (horizontal scroll — may be fine) |

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
2. **Before fix**: Cards stacked in single column
3. **After fix**: Cards in 2-column grid with consistent spacing
4. Compare with Services tab → layout should match
5. Test with odd number of items → last row shows single card aligned left
