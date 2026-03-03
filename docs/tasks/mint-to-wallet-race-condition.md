# Mint to Wallet — Race Condition During Page Load

## Overview

The "Mint to Wallet" button on the customer Overview tab shows a "Please connect your wallet first" error when clicked during page load or immediately after a page refresh, even though the user is authenticated and their wallet is connected.

**Created**: March 2, 2026
**Completed**: March 3, 2026
**Status**: Resolved
**Priority**: Medium
**Category**: UX / Race Condition

---

## Problem Statement

The customer dashboard loads UI using cached session data (via `rc_session_cache` in sessionStorage), which makes the page interactive almost instantly. However, the Thirdweb `useActiveAccount()` hook returns `null` until the wallet connection is fully restored — a process that can take 1-3 seconds after page load.

During this window, the "Mint to Wallet" button is visible and clickable, but the `handleMintToWallet` handler rejects the action because `account?.address` is `null`.

### User Experience

1. User refreshes the customer dashboard
2. Dashboard renders instantly from cached session data
3. User clicks "Mint to Wallet" → enters amount → clicks "Mint to Wallet" button
4. Toast error appears: **"Please connect your wallet first"**
5. A few seconds later, wallet restores and the same action works fine

### Root Cause

```
Timeline:
  0ms    — Page renders from session cache (UI interactive)
  0ms    — Thirdweb SDK begins wallet restoration (async)
  ~500ms — User clicks "Mint to Wallet" button
  ~800ms — User enters amount and clicks confirm
  ~800ms — handleMintToWallet() checks account?.address → NULL → error toast
  ~2000ms — Thirdweb wallet restoration completes (account now available)
```

---

## Affected Code

**File**: `frontend/src/components/customer/OverviewTab.tsx`

### Guard Check (line 249-253)
```tsx
const handleMintToWallet = async () => {
  if (!account?.address) {
    toast.error("Please connect your wallet first");
    return;
  }
  // ... proceeds with mint
};
```

### Data Source
- `account` comes from `useActiveAccount()` (Thirdweb hook) — line 67
- `userProfile` comes from `useAuthStore()` (Zustand, populated from session cache) — line 68
- The wallet address IS available in `userProfile?.address` before Thirdweb restores

### Button (line 589-604)
```tsx
<button
  onClick={handleMintToWallet}
  disabled={isMinting || !mintAmount || parseFloat(mintAmount) <= 0}
  // No disabled state for wallet loading
>
```

---

## Recommended Solutions

### Option A: Use session address as fallback (Minimal change)

Use `userProfile?.address` as a fallback when `account?.address` is not yet available:

```tsx
const handleMintToWallet = async () => {
  const walletAddress = account?.address || userProfile?.address;
  if (!walletAddress) {
    toast.error("Please connect your wallet first");
    return;
  }
  // Use walletAddress instead of account.address
};
```

**Pros**: Minimal code change, uses already-available data
**Cons**: Relies on cached session data for the wallet address (though the same address is used elsewhere in the component already — see line 221)

### Option B: Disable button while wallet is connecting

Add a wallet-loading state and disable the mint button until Thirdweb is ready:

```tsx
const isWalletReady = !!account?.address;

// In the modal's mint button:
<button
  onClick={handleMintToWallet}
  disabled={isMinting || !mintAmount || parseFloat(mintAmount) <= 0 || !isWalletReady}
>
  {!isWalletReady ? (
    <>
      <Loader2 className="w-4 h-4 animate-spin" />
      Connecting Wallet...
    </>
  ) : (
    <>
      <Coins className="w-4 h-4" />
      Mint to Wallet
    </>
  )}
</button>
```

**Pros**: Clear visual feedback, prevents the error entirely
**Cons**: Button appears disabled for 1-3 seconds on page load

### Option C: Combine both approaches (Recommended)

Use the session address as fallback for the guard check AND show a subtle loading state:

```tsx
const walletAddress = account?.address || userProfile?.address;
const isWalletReady = !!walletAddress;

const handleMintToWallet = async () => {
  if (!walletAddress) {
    toast.error("Please connect your wallet first");
    return;
  }
  // Use walletAddress for the API call
};
```

This allows the button to work immediately using the cached session address while Thirdweb catches up.

---

## Scope Check

This race condition pattern may exist in other places that depend on `useActiveAccount()` during page load. A quick audit of other `account?.address` checks would be valuable.

---

## Verification Checklist

- [x] Clicking "Mint to Wallet" during page load does NOT show wallet error
- [x] Mint works correctly after page refresh (amount deducted, TX hash returned)
- [x] Mint still correctly errors when wallet is genuinely not connected
- [x] No regression in normal mint flow (after wallet is fully loaded)
- [ ] Works on Chrome, Firefox, and Safari
- [ ] Works on staging and production

---

## References

- **Component**: `frontend/src/components/customer/OverviewTab.tsx:249`
- **Wallet hook**: `useActiveAccount()` from `thirdweb/react`
- **Session cache**: `rc_session_cache` in sessionStorage (30s TTL)
- **Related pattern**: `walletAddress` fallback already used at line 221 of the same file
