# Bug: Find Shop Social Media Field Mismatch (twitter vs x, missing linkedin)

## Status: Fixed
## Priority: Low
## Date: 2026-03-26
## Category: Bug - Field Mapping
## Found by: E2E testing (`backend/tests/customer/customer.find-shop.test.ts`)

---

## Problem

The `GET /api/customers/shops` endpoint returns social media fields that don't match what the frontend expects:

1. **Backend returns `twitter`**, but frontend expects **`x`** (X/Twitter rebranding)
2. **Backend doesn't return `linkedin`**, but frontend expects it and renders a LinkedIn icon

### Evidence

```typescript
// Backend response (CustomerController.ts line 38)
{
  "twitter": "https://x.com/shopname",  // Field name is "twitter"
  "facebook": "https://facebook.com/...",
  "instagram": "https://instagram.com/...",
  // NO "x" field
  // NO "linkedin" field
}

// Frontend expects (FindShop.tsx line 148, 668-669)
interface Shop {
  x?: string;        // ← Expects "x", not "twitter"
  linkedin?: string;  // ← Expects "linkedin", not returned at all
}

// Frontend rendering (FindShop.tsx line 668)
{selectedShop.x && (         // ← Never true because field is "twitter"
  <a href={selectedShop.x}>  // ← Dead code
)}
{selectedShop.linkedin && (  // ← Never true because field doesn't exist
  <a href={selectedShop.linkedin}>
)}
```

---

## Root Cause

1. **twitter → x renaming**: The database column is `twitter` (migration `016_add_social_media_fields.sql`). The `CustomerController.searchShops()` at line 38 maps it as `twitter: shop.twitter`. But the frontend was updated to expect `x` after the X/Twitter rebrand. The ShopDashboardClient was fixed (commit `7475b850`) but the customer-facing `searchShops` controller was **not updated**.

2. **linkedin missing**: The database has no `linkedin` column. Migration `016` only added `facebook`, `twitter`, `instagram`. The frontend interface includes `linkedin` but it was never backed by a database column.

---

## Impact

- **X/Twitter links never render** on the Find Shop detail panel — the `{selectedShop.x && ...}` check always fails because the field is named `twitter`
- **LinkedIn links never render** — the field simply doesn't exist in the response
- **No data loss** — the twitter URL is stored correctly in DB, just mapped to the wrong field name

---

## Fix

### Option A: Map `twitter` → `x` in controller (recommended)

```typescript
// CustomerController.ts line 38
// Before:
twitter: shop.twitter,

// After:
x: shop.twitter,  // Map DB "twitter" column to frontend "x" field
```

### Option B: Add linkedin column (if feature needed)

```sql
ALTER TABLE shops ADD COLUMN linkedin VARCHAR(255);
```

Then update the controller:
```typescript
linkedin: shop.linkedin,
```

---

## Verification

- [ ] `GET /api/customers/shops` returns `x` field (not `twitter`)
- [ ] Frontend renders X icon and link when shop has X/Twitter URL
- [ ] LinkedIn: decide whether to add DB column or remove from frontend interface
- [ ] No regression on shop dashboard social media editing

---

## Files

- `backend/src/domains/customer/controllers/CustomerController.ts` (line 38) — field mapping
- `frontend/src/components/customer/FindShop.tsx` (line 148, 668) — expects `x` and `linkedin`
- `backend/migrations/016_add_social_media_fields.sql` — only has `twitter`, no `linkedin`
