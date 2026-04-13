# Bug: Missing Wallet Options in Connect Wallet Modal

## Status: Open
## Priority: Medium
## Date: 2026-04-13
## Category: Bug - Missing Feature / UI Mismatch
## Platform: Mobile (React Native / Expo)
## Affects: Wallet connection flow (Onboarding Screen 3)

---

## Problem

The Connect Wallet modal only shows **2 options** (Google and MetaMask), but the backend handler in `OnboardingScreen3.tsx` supports **5 wallet types**. WalletConnect, Coinbase, and Rainbow are handled in the switch statement but never appear in the UI because they were never added to the `walletOptions` array.

---

## Current State

### Modal UI (`WalletSelectionModal.tsx` lines 29-44)

Only 2 options defined:

```typescript
const walletOptions: WalletOption[] = [
  { id: "google",   name: "Google",   type: "social", available: true },
  { id: "metamask", name: "MetaMask", type: "wallet", available: true },
];
```

### Backend Handler (`OnboardingScreen3.tsx` lines 81-119)

Supports 5 wallet types:

```typescript
switch (walletId) {
  case "google":        // ✅ In modal
  case "metamask":      // ✅ In modal
  case "walletconnect": // ❌ Missing from modal
  case "coinbase":      // ❌ Missing from modal
  case "rainbow":       // ❌ Missing from modal
}
```

---

## Missing Wallet Options

| Wallet | ID | Thirdweb Create | Status |
|---|---|---|---|
| WalletConnect | `walletconnect` | `walletConnect()` | Handler exists, not in UI |
| Coinbase Wallet | `coinbase` | `createWallet("com.coinbase.wallet")` | Handler exists, not in UI |
| Rainbow | `rainbow` | `createWallet("me.rainbow")` | Handler exists, not in UI |

---

## Fix Required

**File:** `mobile/shared/components/wallet/WalletSelectionModal.tsx` (lines 29-44)

Add the missing wallet options to the `walletOptions` array:

```typescript
const walletOptions: WalletOption[] = [
  // Social Login
  { id: "google", name: "Google", icon: require("@/assets/icons/icons8-google-100.png"), type: "social", available: true },
  // Wallet Apps
  { id: "metamask", name: "MetaMask", icon: require("@/assets/icons/icons8-metamask-100.png"), type: "wallet", available: true },
  { id: "walletconnect", name: "WalletConnect", icon: require("@/assets/icons/walletconnect-icon.png"), type: "wallet", available: true },
  { id: "coinbase", name: "Coinbase Wallet", icon: require("@/assets/icons/coinbase-icon.png"), type: "wallet", available: true },
  { id: "rainbow", name: "Rainbow", icon: require("@/assets/icons/rainbow-icon.png"), type: "wallet", available: true },
];
```

### Prerequisites

- Need icon assets for WalletConnect, Coinbase, and Rainbow in `assets/icons/`
- Verify each wallet SDK works on both iOS and Android (some may only work on physical devices, not simulators)
- Consider setting `available: false` for wallets that don't work in dev/simulator and showing "Not available in simulator" text

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/shared/components/wallet/WalletSelectionModal.tsx` | Add WalletConnect, Coinbase, Rainbow to `walletOptions` array |
| `mobile/assets/icons/` | Add wallet icon assets |

---

## QA Verification

- [ ] Connect Wallet modal shows all 5 options (Google, MetaMask, WalletConnect, Coinbase, Rainbow)
- [ ] WalletConnect opens QR code / wallet selection flow
- [ ] Coinbase Wallet opens Coinbase app for approval
- [ ] Rainbow opens Rainbow app for approval
- [ ] Each wallet returns correct address after connection
- [ ] Cancel during each wallet connection returns to modal cleanly
- [ ] Wallets unavailable on simulator show "Not available in simulator" hint
