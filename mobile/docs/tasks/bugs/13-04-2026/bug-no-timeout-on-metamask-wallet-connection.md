# Bug: No Timeout on MetaMask Wallet Connection

## Status: Open
## Priority: Low
## Date: 2026-04-13
## Category: Bug - UX
## Platform: Mobile (React Native / Expo)
## Affects: Wallet connection flow — MetaMask only

---

## Problem

When connecting via MetaMask with no internet (or if MetaMask hangs), the app has no timeout. MetaMask loads indefinitely with no error message. The user must manually switch back to RepairCoin via the phone's app switcher.

Google login handles this correctly — Thirdweb's embedded wallet shows a clear network error.

---

## Fix

Add a timeout wrapper around the MetaMask wallet connection in `OnboardingScreen3.tsx`. After 30 seconds with no response, auto-cancel and show an error toast.

**File:** `mobile/feature/onboarding/screens/OnboardingScreen3.tsx` (lines 92-95)

```typescript
// Wrap MetaMask connection with timeout
case "metamask":
  w = createWallet("io.metamask");
  await Promise.race([
    w.connect({ client }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Connection timed out. Please try again.")), 30000)
    )
  ]);
  break;
```

This applies to all external wallet types (MetaMask, WalletConnect, Coinbase, Rainbow).

---

## QA Verification

- [ ] Turn off internet → tap MetaMask → after 30s, error toast shown and user returns to wallet modal
- [ ] Google login still works as before (Thirdweb handles its own error)
- [ ] Normal MetaMask connection (with internet) still works within 30s timeout
