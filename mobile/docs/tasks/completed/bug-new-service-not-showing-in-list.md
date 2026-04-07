# Bug: Newly Created Service Not Appearing in Shop Services List

## Status: Open
## Priority: High
## Date: 2026-04-06
## Category: Bug - Service Management
## Affected: Shop services tab (mobile only)
## Test: Shop "peanut" created "Mongo Tea" — not visible in list

---

## Overview

After creating a new service on the mobile app, it saves to the database successfully but does not appear in the shop's services list. The service also cannot be found via search. A manual pull-to-refresh does load it. The issue is a cache invalidation mismatch — the create mutation invalidates the wrong React Query key.

---

## Root Cause

**`mobile/feature/service/hooks/ui/useServiceFormUI.ts`** lines 286-288:

```typescript
await queryClient.invalidateQueries({
  queryKey: queryKeys.service(shopId!),  // → ['services', 'detail', 'peanut']
});
```

**`mobile/feature/service/hooks/queries/useServiceQueries.ts`** line 33:

```typescript
queryKey: ['shopServices', 'infinite', shopId],  // ← what the list actually uses
```

The create mutation invalidates `queryKeys.service(shopId)` which resolves to `['services', 'detail', 'peanut']` — a **detail** query for a single service. The shop services list uses `['shopServices', 'infinite', shopId]` — a completely different key. So the list never knows to refetch.

### Query Key Comparison

| Purpose | Query Key | Defined In |
|---|---|---|
| Shop services list (infinite) | `['shopServices', 'infinite', shopId]` | `useServiceQueries.ts:33` |
| Shop services list (basic) | `queryKeys.shopServices({ shopId, page, limit })` | `useServiceQueries.ts:15` |
| Single service detail | `queryKeys.service(id)` → `['services', 'detail', id]` | `queryClient.ts:97` |
| **After create invalidates** | `queryKeys.service(shopId!)` → `['services', 'detail', shopId]` | `useServiceFormUI.ts:287` |

The create mutation invalidates the detail key (passing shopId as if it were a serviceId), which doesn't match anything.

---

## Database Confirmation

"Mongo Tea" exists in DB:
```
service_id: srv_e073ca83-516a-472b-9d37-fcb80f3b2c08
shop_id: peanut
active: true
category: food_beverage
price_usd: 200.00
created_at: 2026-04-05T19:32:23
```

Shop "peanut" has **11 active services** — the list loads 10 per page, so even with proper cache invalidation, "Mongo Tea" might require scrolling/loading page 2 depending on sort order.

---

## Fix Required

Invalidate the correct query keys after service creation.

**`useServiceFormUI.ts`** lines 286-288 — change:

```typescript
await queryClient.invalidateQueries({
  queryKey: queryKeys.service(shopId!),
});
```

To:

```typescript
// Invalidate both the infinite and basic shop service list queries
await queryClient.invalidateQueries({
  queryKey: ['shopServices'],
});
```

Using a partial key `['shopServices']` will invalidate all shop service queries (infinite, basic, any page). This is the simplest and safest approach.

The same fix should be applied to the **update service** flow (line 335-337 in the same file) to ensure edits also refresh the list.

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/service/hooks/ui/useServiceFormUI.ts:286-288` | Fix invalidation key for create |
| `mobile/feature/service/hooks/ui/useServiceFormUI.ts:335-337` | Fix invalidation key for update |

---

## QA Test Plan

### Before fix (reproduce)
1. Login as shop "peanut" on mobile
2. Go to Services tab → note existing services
3. Create a new service → success toast shows
4. Return to Services tab → new service is NOT listed
5. Pull to refresh → new service appears

### After fix (verify)
1. Create a new service
2. Return to Services tab → new service appears immediately (no manual refresh needed)
3. Edit an existing service → changes reflected immediately in list
4. Delete/deactivate a service → list updates immediately
