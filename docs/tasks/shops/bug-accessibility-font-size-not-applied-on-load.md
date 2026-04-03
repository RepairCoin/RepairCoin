# Bug: Accessibility Font Size Not Applied on Page Load

## Status: Open
## Priority: Medium
## Date: 2026-03-25
## Category: Bug - Accessibility / UX
## Location: /shop?tab=settings → Accessibility

---

## Overview

The Accessibility font size setting saves to localStorage correctly but does not apply on page load unless the user visits the Settings → Accessibility tab first. This means a user who sets "Large" text, then navigates away or refreshes the page, will see default "Medium" text until they visit the Accessibility settings again.

---

## Root Cause

The `accessibilityStore.ts` has a global side-effect initialization at lines 56-60 that applies the saved font size:

```typescript
// Initialize font size on app load
if (typeof window !== 'undefined') {
  const store = useAccessibilityStore.getState();
  const scale = store.getFontScale();
  document.documentElement.style.fontSize = `${scale}%`;
}
```

**Problem:** This code only runs when the module is first imported. The module is only imported in two places:
1. `stores/accessibilityStore.ts` (the store itself)
2. `components/accessibility/AccessibilitySettings.tsx` (the settings UI)

Since `AccessibilitySettings.tsx` is only rendered when the user navigates to `/shop?tab=settings` → Accessibility, the store module is never imported on other pages, and the side-effect never runs.

**Result:** Font size reverts to browser default (100%) on every page load unless the user visits settings.

---

## Fix

Import the accessibility store in the root layout or providers so it initializes on every page load.

**Option A: Import in providers.tsx (Recommended)**

```typescript
// frontend/src/app/providers.tsx
import '@/stores/accessibilityStore'; // Side-effect import to initialize font size on load

export function Providers({ children }: { children: React.ReactNode }) {
  // ... existing code
}
```

**Option B: Import in root layout.tsx**

```typescript
// frontend/src/app/layout.tsx
import '@/stores/accessibilityStore';
```

**Option C: Create an AccessibilityProvider component**

```typescript
// frontend/src/components/providers/AccessibilityProvider.tsx
"use client";
import { useEffect } from 'react';
import { useAccessibilityStore } from '@/stores/accessibilityStore';

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const scale = useAccessibilityStore.getState().getFontScale();
    document.documentElement.style.fontSize = `${scale}%`;
  }, []);
  return <>{children}</>;
}
```

Then add to providers.tsx. This is more explicit but heavier than a simple import.

---

## Additional Issue: No Reset to Default Button

**Severity:** Low (UX gap)

There is no "Reset to Default" button. Users must manually select "Medium" to revert. Consider adding a small reset link below the options.

---

## Files to Modify

| File | Action |
|------|--------|
| `frontend/src/app/providers.tsx` | Add side-effect import of accessibilityStore |
| `frontend/src/components/accessibility/AccessibilitySettings.tsx` | Optionally add "Reset to Default" link |

---

## Verification Checklist

- [ ] Set font size to "Large", refresh the page → text stays large
- [ ] Set font size to "Extra Large", navigate to bookings tab → text stays extra large
- [ ] Set font size to "Small", close browser, reopen → text stays small
- [ ] Set font size to "Large", log out, log back in → text stays large (localStorage persists)
- [ ] Works on all pages: shop dashboard, customer dashboard, admin dashboard
- [ ] Default for new users is "Medium" (100%)
