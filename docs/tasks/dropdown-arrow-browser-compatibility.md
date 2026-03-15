# Dropdown Arrow Browser Compatibility

## Overview

Dropdown select elements across the app render inconsistent arrow icons depending on the browser. Some selects have been updated with a custom SVG arrow, but most still rely on native browser styling. This task standardizes the dropdown arrow across the entire application.

**Created**: March 2, 2026
**Status**: Open
**Priority**: Low
**Category**: UI Consistency

---

## Problem Statement

Native `<select>` dropdown arrows look different across browsers (Chrome shows a black triangle, Firefox a subtle chevron, Safari its own variant). This causes inconsistent UX across the app.

Additionally:
1. **CreateServiceModal** has `appearance-none` applied but is **missing the custom arrow** — the dropdown looks like a plain text input with no visual indicator
2. **~25+ select elements** across shop, customer, and admin views still use native browser arrows — inconsistent with selects that already have the custom styling

---

## Recommended Approach

Use `appearance-none` + CSS data URI SVG background image to replace native arrows with a consistent custom chevron:

```css
appearance-none
bg-[url('data:image/svg+xml;charset=UTF-8,...')]  /* Custom SVG chevron */
bg-[length:20px]
bg-[right_12px_center]
bg-no-repeat
pr-10
```

### Browser Compatibility: PASS

| CSS Property | Chrome | Firefox | Safari | Edge | iOS Safari |
|---|---|---|---|---|---|
| `appearance: none` | 84+ | 80+ | 15.4+ | 84+ | 15.4+ |
| `-webkit-appearance` (Tailwind auto-adds) | All | N/A | All | All | All |
| Data URI SVG `background-image` | All | All | All | All | All |
| `background-size` / `background-position` | All | All | All | All | All |

Tailwind v3.4 generates both `-webkit-appearance: none` and `appearance: none`. SVG data URI is properly encoded with `xmlns`, `viewBox`, and URL-safe characters.

---

## Tasks

### Task 1: Fix missing arrow in CreateServiceModal
- **Status**: `TODO`
- **File**: `frontend/src/components/shop/modals/CreateServiceModal.tsx:196`
- **Issue**: `appearance-none` removes native arrow but no custom arrow is provided — looks like a plain text input
- **Fix**: Add the SVG background classes (see reference below)

### Task 2: Standardize shop dashboard selects
- **Status**: `TODO`
- **Files**:
  - `frontend/src/components/shop/bookings/CancelBookingModal.tsx` (1 select)
  - `frontend/src/components/shop/ManualBookingModal.tsx` (1 select)
  - `frontend/src/components/shop/tabs/PromoCodesTab.tsx` (1 select)

### Task 3: Standardize customer-facing selects
- **Status**: `TODO`
- **Files**:
  - `frontend/src/components/customer/FindShop.tsx` (1 select)
  - `frontend/src/components/customer/ServiceMarketplaceClient.tsx` (1 select)
  - `frontend/src/components/customer/ServiceFilters.tsx` (2 selects)

### Task 4: Standardize admin dashboard selects
- **Status**: `TODO`
- **Files**:
  - `frontend/src/components/admin/tabs/AdminSupportTab.tsx` (3 selects)
  - `frontend/src/components/admin/tabs/AdminWaitlistTab.tsx` (3 selects)
  - `frontend/src/components/admin/tabs/ShopsManagementTab.tsx` (1 select)
  - `frontend/src/components/admin/tabs/SessionManagementTab.tsx` (2 selects)
  - `frontend/src/components/admin/tabs/CustomersTabEnhanced.tsx` (2 selects)
  - `frontend/src/components/admin/tabs/TransactionsTab.tsx` (1 select)
  - `frontend/src/components/admin/tabs/RecentActivityTimeline.tsx` (1 select)
  - `frontend/src/components/admin/tabs/RecentActivitySection.tsx` (1 select)
  - `frontend/src/components/admin/tabs/PromoCodesAnalyticsTab.tsx` (1 select)
  - `frontend/src/components/admin/tabs/OverviewTab.tsx` (1 select)
  - `frontend/src/components/admin/tabs/AdvancedTreasuryTab.tsx` (2 selects)
  - `frontend/src/components/admin/tabs/AdminsTab.tsx` (1 select)
  - `frontend/src/components/admin/tabs/AddShopModal.tsx` (2 selects)

### Task 5 (Optional): Extract reusable select component or Tailwind class
- **Status**: `TODO`
- **Rationale**: Avoid copy-pasting the long class string ~30 times. Create a shared `SelectInput` component or a Tailwind `@apply` utility class
- **Approach**: Either a `<SelectInput>` wrapper component or a global CSS class like `.select-custom` with `@apply`

---

## Custom Arrow CSS (Copy-Paste Reference)

```
appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10 cursor-pointer
```

---

## Verification Checklist

- [ ] CreateServiceModal shows custom arrow (not blank)
- [ ] All SupportTab selects render correctly on Chrome, Firefox, Safari
- [ ] All shop dashboard selects have consistent arrow styling
- [ ] All customer-facing selects have consistent arrow styling
- [ ] All admin selects have consistent arrow styling
- [ ] Arrow visible on both light and dark backgrounds
- [ ] Arrow doesn't overlap with long option text (pr-10 padding)
- [ ] Focus ring still visible when select is focused

---

## References

- Reference implementation: `frontend/src/components/shop/tabs/SupportTab.tsx:233`
- Tailwind docs: `appearance-none` generates `-webkit-appearance: none` + `appearance: none`
- SVG: Lucide chevron-down icon, stroke `#9ca3af` (gray-400)
