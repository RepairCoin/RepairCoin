# Bug: useAnalyticsDataUI is not a function in AnalyticsTab

**Status:** Completed
**Priority:** Critical
**Est. Effort:** 15 min
**Created:** 2026-05-18
**Updated:** 2026-05-18
**Completed:** 2026-05-18

## Problem / Goal

The Shop dashboard crashes on load with:
```
TypeError: 0, _hooks.useAnalyticsDataUI is not a function (it is undefined)
```
The `AnalyticsTab` component at `feature/home/components/shop/analyics/index.tsx` imports `useAnalyticsDataUI` from the wrong module path.

## Analysis

- The import pointed to `@/feature/shop/account/hooks`, which does not export `useAnalyticsDataUI`.
- The hook is defined and exported from `@/feature/shop/analytics/hooks/useAnalyticsDataUI.ts`.
- Likely caused by a previous refactor that moved hooks between feature modules without updating all import paths.

## Implementation

**File changed:** `mobile/feature/home/components/shop/analyics/index.tsx`

Changed import from:
```ts
import { useAnalyticsDataUI } from "@/feature/shop/account/hooks";
```
To:
```ts
import { useAnalyticsDataUI } from "@/feature/shop/analytics/hooks";
```

## Verification Checklist

- [x] Shop dashboard home screen loads without crash
- [x] AnalyticsTab renders chart data correctly
- [x] No other files import useAnalyticsDataUI from the wrong path

## Notes

- The directory is misspelled as `analyics` (missing 't') but that's a pre-existing issue, not part of this fix.
