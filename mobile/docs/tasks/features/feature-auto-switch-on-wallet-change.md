# Feature: Auto-Switch Account on MetaMask Wallet Change

## Status: Open
## Priority: Medium
## Date: 2026-04-07
## Category: Feature - Authentication / Wallet
## Affected: All authenticated screens (mobile)

---

## Overview

When a user switches their MetaMask account while using the mobile app, the app does not detect the change. The session remains tied to the old wallet, causing stale data or failed API calls. The user must manually logout and reconnect. The web app handles this seamlessly with auto-detection and account switching within 500ms.

---

## Current Mobile Behavior

1. User connects wallet A and logs in
2. User switches to wallet B in MetaMask
3. App continues showing wallet A's data
4. API calls may fail or return wrong data
5. User must manually logout → reconnect with wallet B

## Expected Behavior (matches web)

1. User connects wallet A and logs in
2. User switches to wallet B in MetaMask
3. App detects the change automatically
4. App re-authenticates with wallet B
5. UI updates to show wallet B's data seamlessly

---

## Web Implementation Reference

The web has a comprehensive wallet monitoring system in `frontend/src/hooks/useAuthInitializer.ts` (~500 lines):

### Mechanism 1: MetaMask Event Listener (lines 294-345)
```typescript
// Listens to MetaMask native event
window.ethereum.on('accountsChanged', handleAccountsChanged);

function handleAccountsChanged(accounts) {
  if (accounts[0] !== sessionAddress) {
    switchAccount(accounts[0]);
  }
}
```

### Mechanism 2: Session vs Connected Wallet Comparison (lines 509-567)
```typescript
// On wallet connection, compares session wallet with connected wallet
if (sessionAddress !== connectedAddress) {
  // 500ms debounce for stability
  setTimeout(() => {
    if (stillMismatched) switchAccount(newAddress);
  }, 500);
}
```

### Web Auth Store (`authStore.ts`)
- `switchAccount()` function (lines 395-517) — handles full account switch
- `switchingAccount` flag — prevents race conditions
- `walletMismatchPending` flag — tracks pending switches
- Switch intent persisted to sessionStorage for recovery

---

## Mobile Implementation Plan

### Step 1: Add wallet change listener hook

Create `mobile/shared/hooks/auth/useWalletChangeDetector.ts`:

```typescript
import { useEffect, useRef } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useAuthStore } from '@/shared/store/auth.store';

export function useWalletChangeDetector() {
  const activeAccount = useActiveAccount();
  const { account, logout } = useAuthStore();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!activeAccount || !account) return;

    const connectedAddress = activeAccount.address.toLowerCase();
    const sessionAddress = account.address.toLowerCase();

    if (connectedAddress !== sessionAddress) {
      // Debounce to avoid false positives during rapid switches
      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(async () => {
        // Re-verify the mismatch after debounce
        const stillMismatched = activeAccount.address.toLowerCase() !== sessionAddress;
        if (stillMismatched) {
          // Logout and re-authenticate with new wallet
          await logout();
          // Navigation to login screen happens via auth state change
        }
      }, 500);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [activeAccount?.address, account?.address]);
}
```

### Step 2: Mount in app root layout

In `mobile/app/_layout.tsx`, add the hook so it runs globally:

```typescript
import { useWalletChangeDetector } from '@/shared/hooks/auth/useWalletChangeDetector';

function AppContent() {
  useWalletChangeDetector();
  return <Stack ... />;
}
```

### Step 3: Add switchAccount to auth store (optional enhancement)

For a seamless switch (like web) instead of logout+re-login:

```typescript
// In auth.store.ts
switchAccount: async (newAddress: string) => {
  set({ switchingAccount: true });
  // Call login API with new address
  // Update tokens and profile
  set({ account: newAccount, switchingAccount: false });
}
```

### Approach Decision

| Approach | UX | Complexity |
|---|---|---|
| **Logout + redirect to login** | User must reconnect (2 taps) | Low — just detect and logout |
| **Auto re-authenticate** | Seamless switch like web | Medium — needs login flow without UI |
| **Show prompt** | User chooses to switch or stay | Medium — needs modal + decision logic |

**Recommended**: Start with **logout + redirect** (simplest). Upgrade to auto re-authenticate later.

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `mobile/shared/hooks/auth/useWalletChangeDetector.ts` | Create — wallet change detection hook |
| `mobile/app/_layout.tsx` | Mount the hook in app root |
| `mobile/shared/store/auth.store.ts` | Optionally add `switchAccount()` and `switchingAccount` flag |

---

## QA Test Plan

### Basic detection
1. Login with wallet A on mobile
2. Open MetaMask → switch to wallet B
3. Return to the app
4. **Expected**: App detects the change and logs out (or auto-switches)
5. **Expected**: User is redirected to login/connect screen

### No false positives
1. Login with wallet A
2. Open MetaMask but DON'T switch accounts
3. Return to the app
4. **Expected**: Session remains intact, no logout triggered

### Rapid switching
1. Login with wallet A
2. Quickly switch MetaMask A → B → A (back to original)
3. **Expected**: No logout (debounce catches the rapid switch, final address matches)

### App backgrounding
1. Login with wallet A
2. Background the app → switch MetaMask to wallet B → return to app
3. **Expected**: Mismatch detected on app resume
