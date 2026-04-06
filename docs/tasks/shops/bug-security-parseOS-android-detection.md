# Bug: parseOS Misidentifies Android Devices as Linux

## Status: Fixed
## Priority: Low
## Date: 2026-03-25
## Category: Bug - Security / Session Management

---

## Overview

The `parseOS()` function in the security routes misidentified Android devices as "Linux" because Android user-agent strings contain `"Linux; Android"` and the function checked for `"Linux"` before `"Android"`.

**Impact:** Active sessions from Android devices displayed "Linux" as the OS instead of "Android" in the Password & Authentication settings page.

---

## Root Cause

**File:** `backend/src/routes/security.ts` (line 332-342)

```typescript
if (userAgent.includes('Linux')) return 'Linux';        // ← matched first
if (userAgent.includes('Android')) return 'Android';    // ← never reached
```

A typical Android UA string:
```
Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36
```

This contains both `"Linux"` and `"Android"`, but `"Linux"` was checked first, so it returned `"Linux"` instead of `"Android"`.

---

## Fix Applied

Swapped the check order — `Android` before `Linux`:

```typescript
if (userAgent.includes('Android')) return 'Android';    // ← check Android BEFORE Linux
if (userAgent.includes('Linux')) return 'Linux';
```

---

## Files Changed

| File | Action |
|------|--------|
| `backend/src/routes/security.ts` | Swapped Android and Linux check order in `parseOS()` |
| `backend/tests/shop/shop.password-auth.test.ts` | Fixed local `parseOS` copy + updated test to expect `"Android"` |

---

## Verification

- [x] Android UA `"Mozilla/5.0 (Linux; Android 13)"` returns `"Android"`
- [x] Plain Linux UA `"Mozilla/5.0 (X11; Linux x86_64)"` still returns `"Linux"`
- [x] All 107 password-auth tests pass
