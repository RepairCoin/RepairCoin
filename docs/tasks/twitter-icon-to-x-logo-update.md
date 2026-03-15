# Replace Old Twitter Icon with X Logo

## Status: 🔲 TODO

**Priority:** Medium
**Area:** Frontend - UI Icons
**Reported:** March 4, 2026

---

## Problem Statement

Several components still render the old Twitter bird icon (`FaTwitter` from `react-icons/fa`) instead of the new X logo (`FaXTwitter` from `react-icons/fa6`). The `FindShop.tsx` component has already been updated correctly and serves as the reference pattern.

---

## Affected Files

### 1. `frontend/src/components/customer/ShopProfileClient.tsx` — HIGH

**Line 24:** Old import
```tsx
import { FaFacebook, FaTwitter, FaInstagram } from "react-icons/fa";
```

**Lines 524-531:** Renders old Twitter bird in the shop social links section (both active link and disabled placeholder)
```tsx
// Active link (sky-blue circle)
<FaTwitter className="w-5 h-5 text-white" />
// Disabled placeholder
<FaTwitter className="w-5 h-5 text-gray-400" />
```

**Fix:**
```tsx
// Import
import { FaFacebook, FaInstagram } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

// Replace both JSX usages
<FaXTwitter className="w-5 h-5 text-white" />
<FaXTwitter className="w-5 h-5 text-gray-400" />
```

---

### 2. `frontend/src/components/customer/ShareButton.tsx` — MEDIUM

**Line 170:** The SVG icon is already the correct X logo, but the text label still says "Twitter"
```tsx
<span className="text-sm text-gray-300">Twitter</span>
```

**Fix:**
```tsx
<span className="text-sm text-gray-300">X</span>
```

---

### 3. `frontend/src/components/customer/ShopMapView.tsx` — LOW

**Line 7:** Dead import — `FaTwitter` is imported but never rendered
```tsx
import { FaFacebook, FaTwitter, FaInstagram } from "react-icons/fa";
```

**Fix:** Remove `FaTwitter` from the import
```tsx
import { FaFacebook, FaInstagram } from "react-icons/fa";
```

---

### 4. `frontend/src/components/customer/FindShop.tsx` — LOW

**Line 19:** Dead import — old `FaTwitter` still imported alongside the correct `FaXTwitter`
```tsx
import { FaFacebook, FaTwitter, FaInstagram } from "react-icons/fa";  // FaTwitter unused
import { FaXTwitter } from "react-icons/fa6";  // This is the one actually used
```

**Fix:** Remove `FaTwitter` from the import
```tsx
import { FaFacebook, FaInstagram } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
```

---

## Already Correct (No Changes Needed)

| File | Status |
|------|--------|
| `FindShop.tsx` (line 669) | Already uses `FaXTwitter` from `react-icons/fa6` |
| `Footer.tsx` (lines 13-15) | Uses correct X logo inline SVG |

---

## Non-Icon References (No Changes Needed)

These files use "twitter" only as data field names, form labels, or metadata — not rendered icons:

- `frontend/src/types/shop.ts` — Type definition field
- `frontend/src/services/shopService.ts` — API payload field
- `frontend/src/components/shop/tabs/SettingsTab.tsx` — Form input label/placeholder
- `frontend/src/components/shop/ShopRegistrationForm.tsx` — Form input label/placeholder
- `frontend/src/app/(public)/services/[serviceId]/page.tsx` — Next.js twitter card metadata

---

## Testing

1. Visit `/customer/shop/iantroy-shop` (or any shop with a Twitter link) — verify X logo in social links
2. Open share dropdown on any service card — verify X logo and "X" label
3. Visit `/customer/find-shop` — verify X logo on shop cards
4. Check footer — verify X logo is still correct
