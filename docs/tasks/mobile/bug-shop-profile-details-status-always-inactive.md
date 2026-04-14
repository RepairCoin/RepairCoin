# Bug: Shop Profile Details — Status Always Shows "Inactive" for Customers

**Status:** Fixed (code verified 2026-04-14)
**Priority:** medium
**Date:** 2026-03-30
**Platform:** Mobile (React Native / Expo)

---

## Summary

When a customer views a shop's profile Details tab, the "Status" field always shows "Inactive" regardless of the shop's actual status. This is misleading — a Verified Shop that is actively operating shows as "Inactive" to customers. The "Cross-Shop Redemption: Disabled" value is correct (genuine default).

---

## Root Cause: Backend Omits `active` Field from Customer Response

**File:** `backend/src/domains/shop/routes/index.ts` (lines 196-227)

The `GET /shops/:shopId` endpoint returns different data depending on the user's role:

```typescript
if (req.user?.role === 'admin' || (req.user?.role === 'shop' && req.user.shopId === shopId)) {
  // Full data for admin or shop owner
  shopData = shop;  // includes 'active'
} else {
  // Limited data for others (customers)
  shopData = {
    shopId: shop.shopId,
    name: shop.name,
    address: shop.address,
    phone: shop.phone,
    verified: shop.verified,
    crossShopEnabled: shop.crossShopEnabled,  // included
    // ... other fields
    // 'active' is NOT included
  };
}
```

The "Limited data for others" response (what customers get) **does not include `active`**. So `shopData.active` is always `undefined`.

**File:** `mobile/feature/profile/components/ShopDetailsTab.tsx` (lines 167-171)

```typescript
<View className={`w-2 h-2 rounded-full mr-2 ${shopData.active ? "bg-green-500" : "bg-gray-500"}`} />
<Text className={shopData.active ? "text-green-500" : "text-gray-500"}>
  {shopData.active ? "Active" : "Inactive"}
</Text>
```

`undefined` is falsy → always renders "Inactive" with gray dot.

---

## Cross-Shop Redemption: NOT a Bug

`crossShopEnabled` IS included in the customer response (line 207 of the backend route). It defaults to `false` when a shop is created (`ShopRepository.ts:180`). So "Disabled" is the genuine value — shops must explicitly enable cross-shop redemption.

---

## Fix Options

### Option A: Add `active` to the customer-facing response (Recommended)

**File:** `backend/src/domains/shop/routes/index.ts` (line 201)

```diff
  shopData = {
    shopId: shop.shopId,
    name: shop.name,
    address: shop.address,
    phone: shop.phone,
    verified: shop.verified,
+   active: shop.active,
    crossShopEnabled: shop.crossShopEnabled,
    ...
  };
```

The `active` status is not sensitive data — it's useful for customers to know if a shop is currently operating.

### Option B: Remove Status and Cross-Shop from customer view

If these fields aren't relevant for customers, remove the "Shop Details" section entirely from the customer-facing profile:

**File:** `mobile/feature/profile/components/ShopDetailsTab.tsx`

Remove lines 152-181 (the Shop Details section with Status and Cross-Shop Redemption), keeping only Contact Information and Social Media.

### Option C: Hide Status row when `active` is undefined

**File:** `mobile/feature/profile/components/ShopDetailsTab.tsx`

Only show the Status row when the value is explicitly provided:

```typescript
{shopData.active !== undefined && (
  <View className="flex-row justify-between py-3 border-b border-zinc-800">
    <Text className="text-gray-400">Status</Text>
    <View className="flex-row items-center">
      <View className={`w-2 h-2 rounded-full mr-2 ${shopData.active ? "bg-green-500" : "bg-gray-500"}`} />
      <Text className={shopData.active ? "text-green-500" : "text-gray-500"}>
        {shopData.active ? "Active" : "Inactive"}
      </Text>
    </View>
  </View>
)}
```

---

## Relevance Assessment

The user asked whether these fields are relevant for customers:

| Field | Value Shown | Actual Value | Relevant? |
|---|---|---|---|
| **Member Since** | Nov 6, 2025 | Correct from `joinDate` | Yes — builds trust |
| **Status** | "Inactive" | Should be "Active" (shop is verified & operating) | **Misleading** — either fix or remove |
| **Cross-Shop Redemption** | "Disabled" | Correct — default is `false` | Somewhat — tells customer if they can redeem RCN earned elsewhere |

**Recommendation:** Either fix the `active` field (Option A) so it shows correctly, or remove both Status and Cross-Shop from the customer view (Option B) since they're more operational than customer-facing.

---

## Files to Modify

1. `backend/src/domains/shop/routes/index.ts` (line ~201) — Add `active` to customer response
2. `mobile/feature/profile/components/ShopDetailsTab.tsx` — (Optional) Hide row if undefined

---

## Reproduction Steps

1. Login as a customer on the mobile app
2. Navigate to any shop's profile (Find Shop > tap a shop)
3. Tap the "Details" tab
4. Observe: "Status: Inactive" — even for verified, active shops
5. Observe: "Cross-Shop Redemption: Disabled" — this is correct (default value)
