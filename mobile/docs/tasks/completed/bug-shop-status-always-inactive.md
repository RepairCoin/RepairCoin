# Bug: Shop status always shows "Inactive" on customer view

**Status:** Completed
**Priority:** High
**Est. Effort:** 30 min
**Created:** 2026-03-30
**Updated:** 2026-04-07
**Completed:** 2026-04-07

## Problem / Goal

When a customer views a shop's profile Details tab, the "Status" field always shows "Inactive" regardless of the shop's actual status. A verified, actively operating shop appears as "Inactive" to customers.

**Steps to reproduce:**
1. Login as customer
2. Navigate to any shop's profile (Find Shop > tap a shop)
3. Tap the "Details" tab
4. Observe: "Status: Inactive" — even for verified, active shops

**Expected:** Status shows "Active" for active shops
**Actual:** Always shows "Inactive"

**Note:** "Cross-Shop Redemption: Disabled" is correct — it's the genuine default value, not a bug.

## Analysis

**Root Cause:** Backend omits `active` field from customer-facing shop response.

**Backend** (`backend/src/domains/shop/routes/index.ts`, lines 196-227):
The `GET /shops/:shopId` endpoint returns different data by role. The customer response does NOT include `active`:
```js
shopData = {
  shopId, name, address, phone, verified, crossShopEnabled,
  // 'active' is NOT included
};
```

**Mobile** (`mobile/feature/profile/components/ShopDetailsTab.tsx`, lines 167-171):
```jsx
shopData.active ? "Active" : "Inactive"
```
`undefined` is falsy → always renders "Inactive".

## Implementation

**Option A (Recommended): Add `active` to customer response**

File: `backend/src/domains/shop/routes/index.ts` (line ~201)
```js
shopData = {
  ...
  active: shop.active,  // Add this
  ...
};
```

The `active` status is not sensitive — customers should know if a shop is currently operating.

## Verification Checklist

- [ ] Active shops show "Active" with green dot on customer view
- [ ] Inactive shops show "Inactive" with gray dot
- [ ] Shop owner view still shows correct status
- [ ] Admin view still shows correct status

## Notes

- Cross-Shop Redemption "Disabled" is NOT a bug — shops must explicitly enable it
- Only the `active` field is missing from the customer response
- Files to modify: `backend/src/domains/shop/routes/index.ts`
