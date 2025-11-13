# Authentication Architecture Refactor

**Date:** November 10, 2025
**Issue:** Duplicate refresh tokens created during login (admin/shop/customer)
**Status:** ✅ RESOLVED

---

## Problem Statement

When users logged in, multiple refresh tokens were created in the database:
- **Admin**: 10-11 tokens per login
- **Shop**: 2-3 tokens per login
- **Customer**: 1 token per login (correct)

Additionally, logout behavior had poor UX - users remained on the same page after logout.

---

## Root Causes

### 1. **Multiple Authentication Entry Points**
Three separate hooks were independently triggering authentication:
- `useAuth` - had its own useEffect listening to account changes
- `useAdminAuth` - exposed `authenticateAdmin()` function
- `AuthContext` - deprecated but present, causing confusion

Each hook had its own `loginInProgressRef` (useRef), so they couldn't prevent each other from running.

### 2. **Shop-Specific Duplicate Auth Call**
`ShopDashboardClient.tsx` had a direct fetch call to `/auth/shop` in the `loadShopData()` function, which was called by a useEffect whenever the wallet address changed. This bypassed centralized authentication.

### 3. **Race Conditions**
The Thirdweb `useActiveAccount` hook can trigger multiple times during wallet connection, and each hook's useEffect was firing independently, creating race conditions.

### 4. **Logout UX Issue**
The logout function did not redirect users to the home page, leaving them stuck on authenticated pages.

---

## Solution Architecture

### **Single Source of Truth Pattern**

Created a centralized authentication flow with ONE entry point:

```
User connects wallet
        ↓
useActiveAccount() (Thirdweb)
        ↓
useAuthInitializer() ← ONLY place that triggers auth
        ↓
authStore.login() ← Centralized login with global lock
        ↓
authApi.authenticate*() ← Creates 1 refresh token
```

---

## Changes Made

### 1. **Created `useAuthInitializer` Hook** (NEW)
**File:** `frontend/src/hooks/useAuthInitializer.ts`

- **Purpose:** Single global authentication initializer
- **Usage:** ONLY used ONCE at app root (in AuthProvider)
- **Features:**
  - Tracks previous wallet address with `useRef` to detect actual changes
  - Only triggers login on wallet connect
  - Only triggers logout on wallet disconnect (not on initial load)
  - Prevents infinite loops by comparing previous vs current address

**Key Code:**
```typescript
export function useAuthInitializer() {
  const account = useActiveAccount();
  const { login, logout, setAccount } = useAuthStore();
  const previousAddressRef = useRef<string | null>(null);

  useEffect(() => {
    const currentAddress = account?.address;
    const previousAddress = previousAddressRef.current;

    // Only process actual changes
    if (currentAddress === previousAddress) {
      return;
    }

    if (currentAddress) {
      // User connected wallet
      setAccount(account);
      login(currentAddress);
    } else if (previousAddress) {
      // User disconnected wallet (only logout if previously connected)
      logout();
    }
    // else: initial load with no wallet - do nothing

    previousAddressRef.current = currentAddress || null;
  }, [account?.address]);
}
```

### 2. **Enhanced `authStore` with Centralized Login/Logout**
**File:** `frontend/src/stores/authStore.ts`

**Added:**
- `loginInProgress` - Global flag to prevent duplicate logins (replaces per-hook refs)
- `login(address)` - Centralized authentication function
- `logout()` - Centralized logout with home page redirect

**Key Features:**
```typescript
// Global lock prevents race conditions
login: async (address: string) => {
  const state = get();

  // Prevent duplicate login attempts - GLOBAL LOCK
  if (state.loginInProgress) {
    console.log('[authStore] Login already in progress, skipping duplicate call');
    return;
  }

  set({ loginInProgress: true, isLoading: true, error: null }, false, 'login:start');

  try {
    // Check user type
    const userCheck = await authApi.checkUser(address);

    // Authenticate based on user type
    let authResult = null;
    switch (userCheck.type) {
      case 'admin':
        authResult = await authApi.authenticateAdmin(address);
        break;
      case 'shop':
        authResult = await authApi.authenticateShop(address);
        break;
      case 'customer':
        authResult = await authApi.authenticateCustomer(address);
        break;
    }

    // Build and set user profile
    // ...
  } finally {
    set({ isLoading: false, loginInProgress: false }, false, 'login:complete');
  }
}

// Logout with redirect for better UX
logout: async () => {
  try {
    await authApi.logout();
  } catch (error) {
    console.error('[authStore] Logout error:', error);
  }

  get().resetAuth();

  // Redirect to home page for better UX
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  }
}
```

### 3. **Simplified `useAuth` Hook**
**File:** `frontend/src/hooks/useAuth.tsx`

**Removed:**
- `login()` function - authentication now handled by `useAuthInitializer`
- `logout()` function - authentication now handled by `useAuthInitializer`
- useEffect listening to account changes - moved to `useAuthInitializer`

**Now:** Read-only hook that exposes auth state and utility functions (checkUserExists, fetchUserProfile, refreshProfile)

### 4. **Simplified `useAdminAuth` Hook**
**File:** `frontend/src/hooks/useAdminAuth.ts`

**Removed:**
- `authenticateAdmin()` function - authentication now handled by `useAuthInitializer`

**Now:** Only handles admin-specific profile fetching and permissions checking

### 5. **Deleted Unused AuthContext**
**File:** `frontend/src/contexts/AuthContext.tsx` (DELETED)

Was redundant with authStore and not actually used in the app.

### 6. **Fixed Shop Dashboard Duplicate Auth**
**File:** `frontend/src/components/shop/ShopDashboardClient.tsx`

**Removed:** Direct fetch call to `/auth/shop` in `loadShopData()` function (lines 273-296)

**Before:**
```typescript
const loadShopData = async () => {
  // First, authenticate and get JWT token
  const authResponse = await fetch(`${apiUrl}/auth/shop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: account?.address }),
  });
  // ... (created duplicate token)
}
```

**After:**
```typescript
const loadShopData = async () => {
  // NOTE: Authentication is now handled globally by useAuthInitializer
  // No need to call /auth/shop here - cookies are already set

  // Load shop data with authentication (cookies sent automatically)
  const shopResult = await apiClient.get(`/shops/wallet/${account?.address}`);
  // ...
}
```

### 7. **Updated Logout API (Comment Correction)**
**File:** `frontend/src/services/api/auth.ts`

**Updated:** Comment to clarify that logout does NOT redirect (handled by authStore)

```typescript
/**
 * Logout user - Calls backend to clear httpOnly cookie
 * Note: Does NOT redirect - let the calling component handle navigation
 */
export const logout = async (): Promise<void> => {
  try {
    await apiClient.post('/auth/logout');
  } catch (error) {
    console.error('Logout error:', error);
  }
}
```

### 8. **Integrated into Root Provider**
**File:** `frontend/src/providers/AuthProvider.tsx`

Added `useAuthInitializer()` call at the top of AuthProvider:

```typescript
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const router = useRouter();

  // Initialize authentication ONCE at the app root
  useAuthInitializer();

  // ... rest of provider logic
}
```

---

## Testing & Validation

### Expected Behavior

**Login:**
1. User connects wallet via Thirdweb UI
2. `useActiveAccount()` detects connection
3. `useAuthInitializer` triggers `authStore.login(address)`
4. Global lock prevents duplicate calls
5. One authentication API call creates **exactly 1 refresh token**

**Logout:**
1. User disconnects wallet
2. `useAuthInitializer` detects disconnection
3. `authStore.logout()` is called
4. Backend clears httpOnly cookies
5. User is redirected to home page (`/`)

### Database Verification

Query to verify single token per login:
```sql
SELECT user_address, user_role, created_at
FROM refresh_tokens
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;
```

**Expected Result:** Only **1 token** per user per login for all user types (admin, shop, customer)

---

## Key Architectural Principles

### 1. **Single Source of Truth**
- Only ONE hook (`useAuthInitializer`) triggers authentication
- Only ONE place in the entire app listens to wallet connection changes

### 2. **Global Locking**
- `loginInProgress` flag in Zustand store prevents race conditions
- All hooks share the same lock (not per-hook useRefs)

### 3. **Separation of Concerns**
- `useAuthInitializer` - Triggers authentication on wallet events
- `authStore` - Manages authentication state and logic
- `useAuth` / `useAdminAuth` - Read-only state access + utilities
- Components - Read state, don't trigger auth

### 4. **Preventing Infinite Loops**
- Track previous address with `useRef`
- Only trigger on actual changes (not initial load)
- Logout redirect happens AFTER state reset

---

## Migration Notes

### For Developers

**If you were previously calling:**
```typescript
// ❌ OLD - Don't do this anymore
const { login, logout } = useAuth();
await login();

// ❌ OLD - Don't do this anymore
const { authenticateAdmin } = useAdminAuth();
await authenticateAdmin();
```

**Now:**
```typescript
// ✅ NEW - Authentication is automatic
// Just read the state
const { isAuthenticated, userProfile } = useAuth();

// Authentication happens automatically when user connects wallet
// No manual login/logout calls needed
```

**For manual logout (rare cases):**
```typescript
import { useAuthStore } from '@/stores/authStore';

const { logout } = useAuthStore();
await logout(); // Will redirect to home page
```

---

## Files Changed

### Created
- `frontend/src/hooks/useAuthInitializer.ts` - New single authentication initializer

### Modified
- `frontend/src/stores/authStore.ts` - Added login/logout functions, global lock
- `frontend/src/hooks/useAuth.tsx` - Removed login/logout, now read-only
- `frontend/src/hooks/useAdminAuth.ts` - Removed authenticateAdmin
- `frontend/src/providers/AuthProvider.tsx` - Integrated useAuthInitializer
- `frontend/src/components/shop/ShopDashboardClient.tsx` - Removed duplicate auth call
- `frontend/src/services/api/auth.ts` - Updated logout comment

### Deleted
- `frontend/src/contexts/AuthContext.tsx` - Unused, redundant with authStore

---

## Troubleshooting

### Still seeing duplicate tokens?

1. **Check for direct auth API calls:** Search codebase for `authenticateAdmin`, `authenticateShop`, `authenticateCustomer`
   ```bash
   grep -r "authenticateAdmin\|authenticateShop\|authenticateCustomer" frontend/src --exclude-dir=node_modules
   ```

2. **Verify useAuthInitializer is only used once:** Should only appear in `AuthProvider.tsx`
   ```bash
   grep -r "useAuthInitializer" frontend/src --exclude-dir=node_modules
   ```

3. **Check browser console:** Look for `[authStore] Login already in progress, skipping duplicate call` - indicates the lock is working

### Logout not redirecting?

Check that `authStore.logout()` is being called (not `authApi.logout()` directly)

---

## Performance Impact

✅ **Positive:**
- Reduced API calls (no duplicate auth requests)
- Reduced database writes (no duplicate token creation)
- Faster login (no race conditions, no retries)
- Better UX (logout redirect)

---

## Related Documentation

- [Access/Refresh Token Implementation](./ACCESS_REFRESH_TOKEN_IMPLEMENTATION.md)
- [Zustand State Management](../architecture/STATE_MANAGEMENT.md)
- [Thirdweb Integration](../integrations/THIRDWEB.md)

---

## Commit Message

```
fix: resolve duplicate refresh token creation and improve logout UX

- Create single global authentication initializer (useAuthInitializer)
- Add centralized login/logout in authStore with global lock
- Remove duplicate auth calls from useAuth, useAdminAuth, ShopDashboard
- Delete unused AuthContext
- Add logout redirect to home page for better UX

Fixes issue where admin/shop users had 2-11 duplicate refresh tokens created per login.
Now all user types (admin/shop/customer) create exactly 1 token per login.

Changes:
- NEW: frontend/src/hooks/useAuthInitializer.ts
- MODIFIED: frontend/src/stores/authStore.ts
- MODIFIED: frontend/src/hooks/useAuth.tsx
- MODIFIED: frontend/src/hooks/useAdminAuth.ts
- MODIFIED: frontend/src/providers/AuthProvider.tsx
- MODIFIED: frontend/src/components/shop/ShopDashboardClient.tsx
- MODIFIED: frontend/src/services/api/auth.ts
- DELETED: frontend/src/contexts/AuthContext.tsx
```
