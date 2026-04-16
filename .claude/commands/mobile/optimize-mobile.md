---
description: Analyze and optimize mobile app performance
---

Optimize the following area of the mobile app for better performance.

## Target

$ARGUMENTS

## Optimization Areas

### Rendering Performance
- Reduce unnecessary re-renders (React.memo, useMemo, useCallback)
- Optimize FlatList/FlashList (keyExtractor, getItemLayout, windowSize)
- Avoid inline styles/functions in render
- Use `removeClippedSubviews` for long lists

### Image Performance
- Use proper image sizing and caching
- Lazy load off-screen images
- Use WebP format where possible
- Implement placeholder/skeleton loading

### Navigation Performance
- Lazy load screens with React.lazy
- Minimize initial bundle size
- Preload data for likely next screens

### Data Fetching
- React Query caching strategy (staleTime, cacheTime)
- Pagination/infinite scroll for large lists
- Optimistic updates for mutations
- Prefetching for predictable navigation

### Memory
- Clean up subscriptions and listeners
- Avoid memory leaks in useEffect
- Minimize state stored in Zustand
- Use React Query for server state (auto garbage collection)

### Bundle Size
- Check for large dependencies
- Tree-shake unused imports
- Use platform-specific code splitting

## Process

1. **Measure** — Identify the specific bottleneck
2. **Analyze** — Find the root cause in code
3. **Optimize** — Apply targeted fixes
4. **Verify** — Explain expected improvement
