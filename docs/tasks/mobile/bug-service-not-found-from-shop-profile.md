# Bug: "Service not found" When Tapping Service Card from Shop Profile

**Status:** open
**Priority:** high
**Date:** 2026-03-30
**Platform:** Mobile (React Native / Expo)

---

## Summary

When a customer navigates to Shop Profile > Services and taps a service card, the detail screen sometimes shows "Service not found" instead of the service details. The issue is intermittent.

---

## Root Cause: Missing `enabled` Guard on `useGetService` Query

**File:** `mobile/shared/hooks/service/useService.ts` (lines 60-70)

```typescript
const useGetService = (serviceId: string) => {
  return useQuery({
    queryKey: queryKeys.service(serviceId),
    queryFn: async () => {
      const response: ServiceDetailResponse =
        await serviceApi.getService(serviceId);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};
```

**Problem:** There is no `enabled: !!serviceId` guard. When `useLocalSearchParams` returns `undefined` for `id` (which can happen during screen transitions or when the route hasn't fully resolved), the query fires immediately with `undefined` as the serviceId.

**Caller:** `mobile/feature/service/hooks/ui/useUnifiedServiceDetail.ts` (line 33)

```typescript
const { id } = useLocalSearchParams<{ id: string }>();  // can be undefined during transitions
const { data: serviceData, isLoading, error } = useGetService(id!);  // non-null assertion on potentially undefined value
```

The `id!` non-null assertion silences TypeScript but does not prevent `undefined` from being passed at runtime. This causes:
1. API call to `GET /services/undefined`
2. Backend returns `404 Service not found`
3. Screen renders the error state

**Note:** A properly guarded version already exists but is NOT used here:

`mobile/feature/service/hooks/queries/useServiceQueries.ts` (lines 56-66):
```typescript
export function useServiceDetailQuery(serviceId?: string) {
  return useQuery({
    queryKey: queryKeys.service(serviceId ?? ""),
    queryFn: async () => {
      const response: ServiceDetailResponse = await serviceApi.getService(serviceId!);
      return response.data;
    },
    enabled: !!serviceId,  // <-- This guard prevents the issue
    staleTime: 5 * 60 * 1000,
  });
}
```

---

## Why It's Intermittent

`useLocalSearchParams` relies on the Expo Router navigation state. During rapid navigation or when the screen mounts before the route params are fully resolved, `id` can briefly be `undefined`. On slower devices or under load, this race window is wider — explaining why it happens "sometimes."

---

## Fix

### Option A: Add `enabled` guard to `useGetService` (Recommended — fixes all consumers)

**File:** `mobile/shared/hooks/service/useService.ts`

```typescript
const useGetService = (serviceId: string) => {
  return useQuery({
    queryKey: queryKeys.service(serviceId),
    queryFn: async () => {
      const response: ServiceDetailResponse =
        await serviceApi.getService(serviceId);
      return response.data;
    },
    enabled: !!serviceId,           // ADD THIS
    staleTime: 5 * 60 * 1000,
  });
};
```

### Option B: Use existing `useServiceDetailQuery` instead

**File:** `mobile/feature/service/hooks/ui/useUnifiedServiceDetail.ts`

Replace line 33:
```typescript
// Before
const { useGetService, useTrackRecentlyViewed } = useService();
const { data: serviceData, isLoading, error } = useGetService(id!);

// After
const { useTrackRecentlyViewed } = useService();
const { data: serviceData, isLoading, error } = useServiceDetailQuery(id);
```

### Option C: Both (Most robust)

Apply Option A to protect all current and future consumers, plus update the caller to not use non-null assertion.

---

## Files to Modify

1. `mobile/shared/hooks/service/useService.ts` — Add `enabled: !!serviceId` to `useGetService`
2. `mobile/feature/service/hooks/ui/useUnifiedServiceDetail.ts` — Remove `id!` non-null assertion, pass `id` directly

---

## Reproduction Steps

1. Login as a customer on the mobile app
2. Navigate to a shop's profile (Find Shop > tap a shop)
3. Under the "Services" tab, tap on a service card
4. Observe: occasionally shows "Service not found" error screen instead of service details
5. More likely to reproduce on slower devices or with poor network conditions
6. Going back and tapping again usually works (params are resolved by then)

---

## Navigation Flow

```
Shop Profile (/customer/profile/shop-profile/[id])
  → ShopServicesTab (fetches GET /services/shop/{shopId})
    → ServiceCard onPress → router.push(/customer/service/{serviceId})
      → UnifiedServiceDetailScreen
        → useLocalSearchParams<{ id: string }>() ← can be undefined during mount
          → useGetService(id!) ← fires with undefined, no enabled guard
            → GET /services/undefined → 404
              → "Service not found" error screen
```
