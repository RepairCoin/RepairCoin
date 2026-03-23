# Bug: Shop Profile Form Resets While Typing

## Status: Open
## Priority: High
## Date: 2026-03-23
## Category: Bug - UX

---

## Problem

When editing the shop profile fields (including social media URLs) on `/shop?tab=settings`, the form values reset/clear while the user is typing. This makes it impossible to edit social media links or other profile fields.

---

## Root Cause

In `frontend/src/components/shop/tabs/SettingsTab.tsx` (lines 122-140):

```typescript
useEffect(() => {
  if (shopData) {
    setShopFormData({
      name: shopData.name || "",
      email: shopData.email || "",
      phone: shopData.phone || "",
      address: shopData.address || "",
      facebook: shopData.facebook || "",
      x: shopData.x || "",
      instagram: shopData.instagram || "",
      website: shopData.website || "",
      logoUrl: shopData.logoUrl || "",
      location: { ... },
    });
  }
}, [shopData]);
```

This `useEffect` runs every time `shopData` changes. `shopData` is passed from `ShopDashboardClient` which re-fetches shop data on various triggers:
- Background polling / WebSocket updates
- Other tabs calling `loadShopData()`
- Session/cache refreshes
- `onSettingsUpdate` callback after saving other settings

When `shopData` updates (even with the same values), this effect fires and **overwrites the form state with the server values**, wiping out any unsaved user input.

---

## Fix

Only initialize form data **once** on mount, or only when the user is NOT actively editing. Two approaches:

### Option A: Guard with `isEditingShop` flag (simplest)
```typescript
useEffect(() => {
  if (shopData && !isEditingShop) {
    setShopFormData({ ... });
  }
}, [shopData, isEditingShop]);
```

### Option B: Only initialize once using a ref
```typescript
const initialized = useRef(false);
useEffect(() => {
  if (shopData && !initialized.current) {
    setShopFormData({ ... });
    initialized.current = true;
  }
}, [shopData]);
```

Option A is preferred because it still allows re-syncing when the user exits edit mode.

---

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/shop/tabs/SettingsTab.tsx` | Guard `setShopFormData` useEffect with `isEditingShop` check |

---

## Also Affects

The `SocialMediaSettings` component (`frontend/src/components/shop/SocialMediaSettings.tsx`) has a similar pattern but is less affected because it uses its own `useState` initialized from `initialLinks` prop only on mount. However, if the parent unmounts/remounts the component (conditional rendering with `activeTab === "social-media"`), the state resets to the new `initialLinks` which may be stale if the user saved via the Shop Profile tab's inline social media fields.

---

## Verification

- [ ] Type in any shop profile field — values should NOT reset
- [ ] Type in social media URL fields — values should NOT reset
- [ ] Save profile → values persist correctly
- [ ] Switch tabs and come back → saved values show correctly
- [ ] Background data refresh does NOT wipe unsaved edits
