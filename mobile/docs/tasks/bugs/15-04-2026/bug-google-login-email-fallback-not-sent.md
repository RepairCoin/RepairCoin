# Bug: Google Login Doesn't Send Email to Backend — Email Fallback Never Triggers

## Status: Open
## Priority: High
## Date: 2026-04-15
## Category: Bug - Authentication
## Platform: Mobile (React Native / Expo)
## Affects: Shops registered with MetaMask trying to login via Google

---

## Problem

When a shop registered with MetaMask logs in via Google on mobile, they are taken to the Role Selection screen ("I'm a Customer / I'm a Shop Owner") instead of their shop dashboard. The backend supports email fallback — if a wallet address isn't found, it checks by email to match the shop. But the mobile app never sends the email in the API call.

---

## Root Cause

**File:** `mobile/shared/services/auth.services.ts` (line 18)

```typescript
async checkUserExists(address: string) {
  return await apiClient.post("/auth/check-user", { address });
  //                                                ^^^^^^^^^ email NOT included
}
```

The function only accepts and sends `address`. The `email` from Google login is captured in `useAuth.ts` (line 43, 48) and stored in account state, but never passed to `checkUserExists()`.

**File:** `mobile/shared/hooks/auth/useAuth.ts` (lines 42-50)

```typescript
mutationFn: async (params: { address: string; email?: string }) => {
  const { address, email } = params;  // email IS available here
  setAccount({ address, email });      // stored in state
  return await authApi.checkUserExists(address);  // ← email NOT passed
},
```

**Backend** (`backend/src/routes/auth.ts` line 536) reads `{ email }` from `req.body` for the fallback lookup, but mobile never sends it.

---

## Flow Comparison

**Web app (working):**
```
Google login → get address + email → POST /auth/check-user { address, email }
  → address not found → email fallback → shop found by email → login success
```

**Mobile app (broken):**
```
Google login → get address + email → POST /auth/check-user { address }
  → address not found → no email to fallback → 404 user not found → Role Selection
```

---

## Fix Required

### Fix 1: Pass email to checkUserExists

**File:** `mobile/shared/services/auth.services.ts`

```typescript
async checkUserExists(address: string, email?: string) {
  return await apiClient.post("/auth/check-user", { address, email });
}
```

### Fix 2: Pass email from useAuth hook

**File:** `mobile/shared/hooks/auth/useAuth.ts` (line 50)

```typescript
return await authApi.checkUserExists(address, email);
```

### Fix 3: Also pass email to getToken

The `/auth/token` endpoint also uses email fallback. Check if `getToken()` needs the same fix.

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/shared/services/auth.services.ts` | Add `email` param to `checkUserExists()` and include in request body |
| `mobile/shared/hooks/auth/useAuth.ts` | Pass `email` to `checkUserExists()` call |
| `mobile/shared/services/auth.services.ts` | Also check `getToken()` — may need email param too |

---

## QA Verification

- [ ] Register shop with MetaMask wallet + email "test@example.com"
- [ ] Logout
- [ ] Login via Google using same email "test@example.com"
- [ ] **Expected**: Goes directly to shop dashboard (not Role Selection)
- [ ] Shop data and settings are accessible
- [ ] Same test for customer accounts registered with MetaMask + Google login
