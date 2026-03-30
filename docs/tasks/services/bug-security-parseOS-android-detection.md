# Bug: parseOS Misidentifies Android Devices as Linux

## Status: Open
## Priority: Low
## Date: 2026-03-25
## Category: Bug - Security / Session Management

---

## Overview

The `parseOS()` function in the security routes misidentifies Android devices as "Linux" because Android user-agent strings contain `"Linux; Android"` and the function checks for `"Linux"` before `"Android"`.

**Impact:** Active sessions from Android devices display "Linux" as the OS instead of "Android" in the Password & Authentication settings page.

---

## Root Cause

**File:** `backend/src/routes/security.ts` (line 332-342)

```typescript
function parseOS(userAgent?: string): string {
  if (!userAgent) return 'Unknown OS';

  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac OS X') || userAgent.includes('Macintosh')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';        // ← matches first
  if (userAgent.includes('Android')) return 'Android';    // ← never reached
  if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';

  return 'Unknown OS';
}
```

A typical Android UA string:
```
Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36
```

This contains both `"Linux"` and `"Android"`, but `"Linux"` is checked first, so it returns `"Linux"` instead of `"Android"`.

---

## Fix

Move the `Android` check **before** the `Linux` check:

```typescript
function parseOS(userAgent?: string): string {
  if (!userAgent) return 'Unknown OS';

  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac OS X') || userAgent.includes('Macintosh')) return 'macOS';
  if (userAgent.includes('Android')) return 'Android';    // ← check Android BEFORE Linux
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';

  return 'Unknown OS';
}
```

---

## Files to Modify

| File | Action |
|------|--------|
| `backend/src/routes/security.ts` | Swap Android and Linux check order in `parseOS()` |
| `backend/tests/shop/shop.password-auth.test.ts` | Update test to expect "Android" instead of documenting bug |

---

## Verification

- [ ] Android UA `"Mozilla/5.0 (Linux; Android 13)"` returns `"Android"`
- [ ] Plain Linux UA `"Mozilla/5.0 (X11; Linux x86_64)"` still returns `"Linux"`
- [ ] Active sessions from Android devices show "Android" in the UI
