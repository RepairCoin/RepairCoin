# Bug: Find Shop location lat/lng Returned as String Instead of Number

## Status: Fixed

## Priority: Low

## Date: 2026-03-26

## Category: Bug - Type Mismatch

## Found by: E2E testing (`backend/tests/customer/customer.find-shop.test.ts`)

---

## Problem

The `GET /api/customers/shops` endpoint returns `location.lat` and `location.lng` as **strings** instead of **numbers**. PostgreSQL's `DECIMAL`/`NUMERIC` columns return strings via the `pg` driver, and the `ShopRepository.mapRow()` method does not parse them.

### Evidence

```json
// Actual response
{
  "location": {
    "lat": "14.599512",   // ← String (should be number)
    "lng": "120.984222",  // ← String (should be number)
    "city": "Manila",
    "state": "NCR"
  }
}

// Expected response
{
  "location": {
    "lat": 14.599512,     // ← Number
    "lng": 120.984222,    // ← Number
  }
}
```

---

## Root Cause

`backend/src/repositories/ShopRepository.ts` line 597-598:

```typescript
// Line 597 — NO parseFloat (BUG)
locationLat: row.location_lat,
locationLng: row.location_lng,
```

Other mappers in the **same file** DO parse correctly:

```typescript
// Line 781 — CORRECT
locationLat: row.location_lat ? parseFloat(row.location_lat) : undefined,
locationLng: row.location_lng ? parseFloat(row.location_lng) : undefined,
```

---

## Impact

- **Frontend works** — `FindShop.tsx` uses `Number()` coercion when passing to Leaflet map, so the map still renders correctly
- **API contract inconsistent** — the same field is returned as `number` from some endpoints and `string` from others
- **External consumers broken** — any TypeScript-strict API client would fail type checking

---

## Fix

```typescript
// ShopRepository.ts line 597-598 — add parseFloat
locationLat: row.location_lat ? parseFloat(row.location_lat) : undefined,
locationLng: row.location_lng ? parseFloat(row.location_lng) : undefined,
```

---

## Verification

- [ ] `GET /api/customers/shops` returns `location.lat` as `number` type
- [ ] `GET /api/customers/shops` returns `location.lng` as `number` type
- [ ] Leaflet map still renders correctly on Find Shop tab
- [ ] No regression on other shop listing endpoints

---

## Files

- `backend/src/repositories/ShopRepository.ts` (line 597-598) — needs `parseFloat()`
