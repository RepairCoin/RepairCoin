# Auto Account Switching Implementation Plan

## Overview

Automatically detect and switch user accounts when MetaMask wallet changes, seamlessly transitioning between admin/shop/customer roles without requiring manual logout/login.

**Created**: February 9, 2026
**Status**: Planning
**Priority**: Medium

---

## Problem Statement

**Current Behavior:**
- When user switches accounts in MetaMask, the app detects the change
- Shows a "wallet mismatch" warning toast
- Disconnects the wallet and reloads the page
- User must manually re-authenticate

**Desired Behavior:**
- When user switches accounts in MetaMask, automatically:
  1. Logout current session
  2. Check if new wallet is registered
  3. If registered → auto-login and redirect to appropriate dashboard
  4. If not registered → redirect to registration page

---

## Technical Analysis

### Current Architecture

**Account Change Detection:**
```
MetaMask Switch → Thirdweb SDK → useActiveAccount() hook → useAuthInitializer effect
```

**Key Files:**
| File | Purpose |
|------|---------|
| `frontend/src/hooks/useAuthInitializer.ts` | Detects account changes, handles auth flow |
| `frontend/src/stores/authStore.ts` | Centralized auth state (role, profile) |
| `frontend/src/services/walletDetectionService.ts` | Determines user role from wallet |
| `frontend/src/services/api/auth.ts` | Auth API client |
| `backend/src/routes/auth.ts` | Authentication endpoints |

**Current Flow (useAuthInitializer.ts:91-276):**
```typescript
useEffect(() => {
  const currentAddress = account?.address;
  const previousAddress = previousAddressRef.current;

  if (currentAddress === previousAddress) return;

  previousAddressRef.current = currentAddress || null;

  if (currentAddress) {
    // Check session → wallet mismatch detection → warning toast
    // Does NOT auto-switch accounts
  }
}, [account?.address]);
```

---

## Implementation Plan

### Phase 1: Update Auth Store

**File:** `frontend/src/stores/authStore.ts`

**Changes:**
1. Add `switchingAccount` state flag to prevent race conditions
2. Add `switchAccount()` action for clean account transitions

```typescript
// Add to AuthState interface
switchingAccount: boolean;

// Add action
switchAccount: (newAddress: string) => Promise<void>;
```

**Implementation:**
```typescript
switchAccount: async (newAddress: string) => {
  set({ switchingAccount: true });

  try {
    // 1. Logout current session (clear cookies)
    await authApi.logout();

    // 2. Clear local state
    set({
      userProfile: null,
      isAuthenticated: false,
      userType: null,
    });

    // 3. Check if new wallet is registered
    const userCheck = await authApi.checkUser(newAddress);

    if (userCheck.exists) {
      // 4a. Auto-login with new wallet
      await get().login(newAddress);
    } else {
      // 4b. Redirect to registration
      window.location.href = '/choose';
    }
  } finally {
    set({ switchingAccount: false });
  }
},
```

---

### Phase 2: Update Account Change Handler

**File:** `frontend/src/hooks/useAuthInitializer.ts`

**Current Code (Lines 116-229):**
```typescript
// Wallet mismatch detection - shows warning and reloads
if (sessionAddress !== connectedAddress) {
  window.dispatchEvent(new CustomEvent('auth:wallet-mismatch', {...}));
  // ... disconnect and reload
}
```

**New Code:**
```typescript
// Auto-switch accounts when wallet changes
if (sessionAddress && connectedAddress && sessionAddress !== connectedAddress) {
  console.log('[Auth] Wallet changed, auto-switching account', {
    from: sessionAddress,
    to: connectedAddress,
  });

  // Check if this is an email-based login (social login)
  const connectedEmail = await getUserEmail({ client });
  const sessionEmail = userData?.email;

  if (connectedEmail && sessionEmail && connectedEmail === sessionEmail) {
    // Email-based login - don't switch, this is expected
    console.log('[Auth] Email-based login detected, keeping session');
    return;
  }

  // Genuine wallet switch - auto-switch accounts
  await switchAccount(connectedAddress);
  return;
}
```

---

### Phase 3: Add Loading State During Switch

**File:** `frontend/src/providers/AuthProvider.tsx`

**Add visual feedback during account switch:**
```typescript
const { switchingAccount } = useAuthStore();

// Show loading overlay during switch
if (switchingAccount) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 text-center">
        <Spinner className="w-8 h-8 mx-auto mb-4" />
        <p className="text-white">Switching account...</p>
      </div>
    </div>
  );
}
```

---

### Phase 4: Handle Role-Based Redirects

**File:** `frontend/src/hooks/useAuthInitializer.ts`

**After successful auto-login, redirect to appropriate dashboard:**
```typescript
const redirectToDashboard = (userType: string) => {
  const dashboards = {
    admin: '/admin',
    shop: '/shop',
    customer: '/customer',
  };

  const targetPath = dashboards[userType] || '/';

  // Only redirect if not already on correct dashboard
  if (!window.location.pathname.startsWith(targetPath)) {
    window.location.href = targetPath;
  }
};
```

---

### Phase 5: Edge Cases & Error Handling

**Scenarios to Handle:**

1. **Switch to unregistered wallet:**
   - Clear session
   - Redirect to `/choose` for registration
   - Show toast: "New wallet detected. Please register to continue."

2. **Switch during pending transaction:**
   - Block switch until transaction completes
   - Or warn user and allow cancel

3. **Network errors during switch:**
   - Show error toast
   - Keep user logged out (safe state)
   - Allow manual retry

4. **Rapid switching (multiple changes):**
   - Debounce account changes (300ms)
   - Cancel pending switch if new change detected

**Implementation:**
```typescript
// Debounce account changes
const debouncedSwitch = useMemo(
  () => debounce(async (address: string) => {
    await switchAccount(address);
  }, 300),
  [switchAccount]
);

// Cancel on unmount
useEffect(() => {
  return () => debouncedSwitch.cancel();
}, [debouncedSwitch]);
```

---

### Phase 6: Remove Old Wallet Mismatch Code

**Files to Update:**

1. `frontend/src/hooks/useAuthInitializer.ts`
   - Remove `auth:wallet-mismatch` event dispatch
   - Remove wallet mismatch warning logic

2. `frontend/src/providers/AuthProvider.tsx`
   - Remove `auth:wallet-mismatch` event listener
   - Remove mismatch handling code

---

## Implementation Checklist

### Phase 1: Auth Store Updates
- [ ] Add `switchingAccount` state to authStore
- [ ] Implement `switchAccount()` action
- [ ] Add proper error handling

### Phase 2: Account Change Handler
- [ ] Update `useAuthInitializer.ts` to auto-switch
- [ ] Preserve email-based login detection
- [ ] Add logging for debugging

### Phase 3: Loading State
- [ ] Add loading overlay during switch
- [ ] Show "Switching account..." message

### Phase 4: Role-Based Redirects
- [ ] Implement `redirectToDashboard()` function
- [ ] Handle all user types (admin/shop/customer)
- [ ] Prevent unnecessary redirects

### Phase 5: Edge Cases
- [ ] Handle unregistered wallet switch
- [ ] Add debouncing for rapid switches
- [ ] Implement error handling with toasts
- [ ] Test network failure scenarios

### Phase 6: Cleanup
- [ ] Remove old wallet mismatch event code
- [ ] Remove mismatch warning toasts
- [ ] Update any related tests

### Testing
- [ ] Test admin → customer switch
- [ ] Test customer → shop switch
- [ ] Test shop → admin switch
- [ ] Test switch to unregistered wallet
- [ ] Test rapid account switching
- [ ] Test switch during page load
- [ ] Test switch with network errors

---

## File Changes Summary

| File | Changes |
|------|---------|
| `frontend/src/stores/authStore.ts` | Add `switchingAccount` state, `switchAccount()` action |
| `frontend/src/hooks/useAuthInitializer.ts` | Replace mismatch warning with auto-switch logic |
| `frontend/src/providers/AuthProvider.tsx` | Add loading overlay, remove mismatch listener |
| `frontend/src/services/api/auth.ts` | No changes needed (logout already exists) |

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Auth Store | 1-2 hours |
| Phase 2: Change Handler | 2-3 hours |
| Phase 3: Loading State | 30 mins |
| Phase 4: Redirects | 1 hour |
| Phase 5: Edge Cases | 2-3 hours |
| Phase 6: Cleanup | 30 mins |
| Testing | 2-3 hours |
| **Total** | **~10-12 hours** |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Race conditions during rapid switching | Medium | Debounce + cancel pending operations |
| Session corruption on failed switch | High | Always logout first, then attempt login |
| User confusion during switch | Low | Clear loading indicator + toast messages |
| Breaking email-based login | High | Preserve email fallback detection logic |

---

## Success Criteria

1. User can switch MetaMask accounts without manual logout
2. Correct dashboard loads based on new wallet's role
3. Unregistered wallets redirect to registration
4. No race conditions or duplicate login attempts
5. Clear visual feedback during switch
6. Email-based logins (social login) continue to work

---

## Future Enhancements

1. **Remember last account per wallet** - Store preferences
2. **Multi-account support** - Quick switch menu in header
3. **Account linking** - Link multiple wallets to one profile
4. **Session persistence** - Remember sessions per wallet address

---

## References

- Current auth flow: `frontend/src/hooks/useAuthInitializer.ts`
- Auth store: `frontend/src/stores/authStore.ts`
- Thirdweb docs: https://portal.thirdweb.com/react/v5
- MetaMask events: https://docs.metamask.io/wallet/reference/provider-api/#events
