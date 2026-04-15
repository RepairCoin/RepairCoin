# Bug: Promo Code Created Successfully But Not Listed

## Status: Open
## Priority: High
## Date: 2026-04-10
## Category: Bug - Response Structure Mismatch
## Affected: Shop Promo Code tab (mobile)

---

## Overview

When a shop creates a promo code on mobile, the toast says "Promo code created successfully!" but the list still shows "No promo codes created yet". The promo code IS saved in the database — the list just can't read it due to a response field mismatch.

---

## Root Cause

**Backend returns:**
```json
{ "success": true, "data": [ { "id": "...", "code": "SAVE10", ... } ] }
```

**Mobile reads** (`usePromoCodeQueries.ts` line 14):
```typescript
const response = await promoCodeApi.getPromoCodes(shopId);
return response.items || [];  // ❌ response.items is undefined
```

After `apiClient.get` unwraps `response.data`, the result is `{ success: true, data: [...] }`. The mobile reads `response.items` but the field is `data` — so it always returns `[]`.

---

## Fix Required

**File:** `mobile/feature/promo-code/hooks/queries/usePromoCodeQueries.ts` line 14

Change:
```typescript
return response.items || [];
```

To:
```typescript
return response.data || response.items || [];
```

**Also update the interface** in `mobile/shared/interfaces/shop.interface.ts`:

```typescript
export interface PromoCodesListResponse {
  success?: boolean;
  data?: PromoCodeData[];
  items?: PromoCodeData[];  // keep for backwards compatibility
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/promo-code/hooks/queries/usePromoCodeQueries.ts:14` | Read `response.data` instead of `response.items` |
| `mobile/shared/interfaces/shop.interface.ts:237-239` | Update interface to match actual response |

---

## QA Test Plan

1. Login as shop → Promo Code tab
2. Create a new promo code → success toast shows
3. **Before fix**: List shows "No promo codes created yet"
4. **After fix**: New promo code appears in the list immediately
5. Refresh page → promo code persists
