# Web Wallet-Session Mismatch Bug

## Priority: High
## Status: Fixed
## Assignee: Frontend Developer
## Fixed Date: January 20, 2026

## Problem

Users are unexpectedly logged out and switched to a different wallet account mid-session.

**Specific Scenario:**
- User logs in with **MetaMask** (external wallet) as Shop A
- User had previously logged in with **Google/social login** (creates embedded wallet)
- On page reload, Thirdweb auto-connects to the **embedded wallet** instead of MetaMask
- Frontend detects address change and creates new session with wrong account
- User is suddenly logged in as a different account

This is highly disruptive as it can occur during transactions (e.g., processing redemptions).

## Root Cause

Thirdweb SDK stores connection state for multiple wallets in localStorage. The **embedded wallet** (from social login) has persistent session storage that survives page reloads and takes priority over external wallets.

When auto-connecting:
1. Thirdweb checks for existing embedded wallet session first
2. If found, it connects to the embedded wallet (even if user last used MetaMask)
3. The `useAuthInitializer` hook detects the address change
4. It creates a new session with the wrong wallet

The frontend does NOT validate that the connected wallet matches the existing session before creating a new one.

**Key Issue:** Embedded wallet session persists in:
- `thirdweb:in-app-wallet-user-id`
- `thirdweb:active-wallet-id`
- Other `thirdweb` prefixed localStorage keys

## Affected Files

### Frontend
- `frontend/src/hooks/useAuthInitializer.ts` - Detects address changes and triggers login
- `frontend/src/providers/AuthProvider.tsx` - Auth event handling
- `frontend/src/components/auth/DualAuthConnect.tsx` - Wallet connection UI

### Key Code Path

In `useAuthInitializer.ts` (lines 91-93):
```typescript
// Only process actual wallet address changes
if (currentAddress === previousAddress) {
  return;
}
```

When address changes, it blindly creates a new session without checking if the user WANTED to switch wallets.

## Solution Options

### Option A: Validate Session Address Match (Recommended)

Before creating a new session on address change, check if:
1. There's an existing valid session
2. The session address matches a DIFFERENT wallet than what Thirdweb connected

If mismatch, ask user: "Your wallet changed. Do you want to switch accounts?"

```typescript
// In useAuthInitializer.ts
if (currentAddress !== previousAddress) {
  // Check existing session first
  try {
    const session = await authApi.getSession();
    if (session.isValid && session.user) {
      const sessionAddress = session.user.address?.toLowerCase();
      const connectedAddress = currentAddress?.toLowerCase();

      if (sessionAddress && connectedAddress && sessionAddress !== connectedAddress) {
        // MISMATCH! Wallet changed unexpectedly
        console.warn('[AuthInitializer] Wallet mismatch detected!', {
          sessionAddress,
          connectedAddress
        });

        // Option 1: Disconnect the wrong wallet and prompt user
        // Option 2: Show confirmation dialog
        // Option 3: Restore the correct wallet connection

        // For now, prevent auto-switching by returning early
        return;
      }
    }
  } catch (e) {
    // No session, proceed with new login
  }
}
```

### Option B: Lock Wallet During Session

Once logged in, prevent Thirdweb from auto-connecting to different wallets:
- Store the "locked" wallet address in session storage
- On auto-connect, verify it matches the locked address
- If mismatch, disconnect and show warning

### Option C: Clear Other Wallets on Login

When user successfully logs in:
1. Clear ALL other Thirdweb wallet entries from localStorage
2. Only keep the current wallet's data
3. This prevents auto-connect from picking wrong wallet

```typescript
// After successful login
const clearOtherWallets = (activeWalletId: string) => {
  const keys = Object.keys(localStorage).filter(key =>
    key.startsWith('thirdweb') && !key.includes(activeWalletId)
  );
  keys.forEach(key => localStorage.removeItem(key));
};
```

### Option D: Show Wallet Switch Confirmation

When address changes during an active session:
1. Pause all operations
2. Show modal: "Your wallet changed from X to Y. Switch accounts?"
3. If "No", disconnect new wallet and restore session
4. If "Yes", proceed with new session

## Testing Checklist

### Setup
- [ ] Have 2+ wallets set up (1 external, 1 embedded via Google login)
- [ ] Both wallets should have accounts in the system

### Scenario 1: Page Reload
- [ ] Login with wallet A
- [ ] Perform some action (e.g., open redemption screen)
- [ ] Reload page
- [ ] Verify still logged in as wallet A (not switched)

### Scenario 2: Tab Switch
- [ ] Login with wallet A
- [ ] Switch to different browser tab for 5+ minutes
- [ ] Return to RepairCoin tab
- [ ] Verify still logged in as wallet A

### Scenario 3: Intentional Wallet Switch
- [ ] Login with wallet A
- [ ] Click disconnect
- [ ] Login with wallet B
- [ ] Verify correctly logged in as wallet B

## Temporary Workaround

Users experiencing this issue can:
1. Open browser DevTools (F12)
2. Go to Application → Local Storage → https://repaircoin.ai
3. Delete all keys starting with "thirdweb"
4. Reload page and login with correct wallet

## Fix Implemented

### Changes Made

#### 1. `frontend/src/hooks/useAuthInitializer.ts`

**Added wallet mismatch detection when session exists:**
```typescript
if (session.isValid && session.user) {
  const sessionAddress = (userData.address || userData.walletAddress || '').toLowerCase();
  const connectedAddress = currentAddress?.toLowerCase();

  // WALLET MISMATCH CHECK
  if (sessionAddress && connectedAddress && sessionAddress !== connectedAddress) {
    console.warn('[AuthInitializer] ⚠️ Wallet mismatch detected!');

    // Dispatch event for UI to handle
    window.dispatchEvent(new CustomEvent('auth:wallet-mismatch', {...}));

    // Keep existing session, don't switch accounts
    return;
  }
}
```

#### 2. `frontend/src/providers/AuthProvider.tsx`

**Added `auth:wallet-mismatch` event handler:**
```typescript
const handleWalletMismatch = async (event: CustomEvent) => {
  // Set flag to prevent logout when disconnecting
  useAuthStore.getState().setWalletMismatchPending(true);

  // Show warning toast
  toast.error('Your wallet changed unexpectedly...');

  // Clear Thirdweb localStorage
  thirdwebKeys.forEach(key => localStorage.removeItem(key));

  // Disconnect wrong wallet (flag prevents this from triggering logout)
  if (wallet && disconnect) await disconnect(wallet);

  // Reload page after delay
  setTimeout(() => window.location.reload(), 3000);
};
```

#### 3. `frontend/src/stores/authStore.ts`

**Added `walletMismatchPending` flag:**
```typescript
walletMismatchPending: boolean; // Flag to prevent logout when disconnecting mismatched wallet
setWalletMismatchPending: (pending: boolean) => void;
```

### How It Works

1. **Session exists + wallet mismatch**: Detects when Thirdweb auto-connects to a different wallet than the session. Shows warning, keeps session, disconnects wrong wallet, reloads page.

2. **Session expired/none + user logs in with Google**: Email fallback is ALLOWED because there's no valid session to protect. User can login normally.

3. **Disconnect handling**: The `walletMismatchPending` flag prevents the wallet disconnect from triggering a logout.

4. **Clean disconnect**: Clears Thirdweb localStorage to prevent the wrong wallet from auto-connecting again.

**Key Principle:** Only block when there's a VALID session with a DIFFERENT wallet. If there's no valid session, allow login with any method (including email fallback).

### Files Modified

- `frontend/src/hooks/useAuthInitializer.ts` - Added mismatch detection, skip logout when mismatch pending
- `frontend/src/providers/AuthProvider.tsx` - Added event handler with mismatch flag
- `frontend/src/stores/authStore.ts` - Added `walletMismatchPending` flag

## References

- Thirdweb SDK v5 docs: https://portal.thirdweb.com/react/v5
- `useActiveAccount` hook behavior: auto-reconnects from localStorage
- Related feature: `docs/tasks/email-based-shop-lookup.md` (email fallback was triggering unwanted account switches)
