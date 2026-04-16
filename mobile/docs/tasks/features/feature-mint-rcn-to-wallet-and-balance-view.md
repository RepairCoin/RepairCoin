# Feature: Mint RCN to Wallet & Blockchain Wallet Balance View

**Status:** Partially Completed
**Priority:** Medium
**Est. Effort:** 4-6 hrs (original), ~2 hrs remaining
**Created:** 2026-04-07
**Updated:** 2026-04-16

---

## Overview

The mobile customer app is missing two token management features that exist on web:

1. **Mint RCN to Wallet** — transfer platform RCN balance to the customer's on-chain blockchain wallet
2. **Wallet Balance View** — display the customer's on-chain RCN token balance (separate from platform balance)

---

## Web Implementation Reference

### Mint RCN to Wallet

**File:** `frontend/src/components/customer/overview/MintRCNCard.tsx`

Web shows a "Mint RCN to Wallet" card in the customer Overview tab when the customer has available balance. Features:
- Shows available platform balance eligible for minting
- "How it works" tooltip explaining the 3-step process
- Amount input with MAX button
- Calls backend to mint tokens to blockchain
- Only visible when `availableBalance > 0`

### Wallet Balance View

**File:** `frontend/src/components/customer/OverviewTab.tsx` lines 224-229, 401-403

Web shows two separate balance cards:
- **"Available Balance"** (sublabel: "Off-chain balance") — platform `current_rcn_balance` from DB
- **"Wallet Balance"** (on-chain) — reads directly from smart contract via `balanceOf(address)`

```typescript
// Reads on-chain balance from RCN smart contract
const { data: tokenBalance } = useReadContract({
  contract,
  method: "function balanceOf(address) view returns (uint256)",
  params: [customerData.address],
});
```

---

## What Mobile Currently Shows

**File:** `mobile/feature/home/components/customer-wallet/index.tsx` lines 87-96

Mobile only shows a single "Your Current RCN Balance" calculated from `lifetimeEarnings - totalRedemptions`. It does not:
- Read on-chain wallet balance from the smart contract
- Distinguish between platform balance and wallet balance
- Offer a "Mint to Wallet" action

---

## Implementation Plan

### Feature 1: Wallet Balance View

#### Step 1: Read on-chain balance

Use Thirdweb SDK v5 (already in the mobile app) to read the contract balance:

```typescript
import { useReadContract } from "thirdweb/react";
import { getContract } from "thirdweb";

const contract = getContract({
  client: thirdwebClient,
  chain: baseSepolia,
  address: RCN_CONTRACT_ADDRESS, // 0xBFE793d78B6B83859b528F191bd6F2b8555D951C
});

const { data: walletBalance } = useReadContract({
  contract,
  method: "function balanceOf(address) view returns (uint256)",
  params: [customerAddress],
});
```

#### Step 2: Display both balances

Show two balance values on the customer home screen:
- **Platform Balance**: `current_rcn_balance` from API (what they can redeem at shops)
- **Wallet Balance**: on-chain `balanceOf` reading (what's in their blockchain wallet)

### Feature 2: Mint RCN to Wallet

#### Step 1: Create API service method

```typescript
// mobile/shared/services/token.services.ts
async mintToWallet(amount: number): Promise<any> {
  return apiClient.post('/tokens/mint-to-wallet', { amount });
}
```

#### Step 2: Create mint screen or modal

- Amount input with validation (min 1, max = available platform balance)
- MAX button to fill available balance
- "How it works" explanation
- Confirm button
- Loading state during blockchain transaction
- Success/error toast

#### Step 3: Create hook

```typescript
export function useMintToWalletMutation() {
  return useMutation({
    mutationFn: (amount: number) => tokenApi.mintToWallet(amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "customers"] });
      queryClient.invalidateQueries({ queryKey: ["tokenBalance"] });
      showSuccess("RCN minted to your wallet!");
    },
  });
}
```

---

## Backend Endpoints (Check if Exist)

| Endpoint | Purpose | Status |
|---|---|---|
| `POST /api/tokens/mint-to-wallet` | Mint platform RCN to on-chain wallet | Check if exists |
| `GET /api/tokens/balance/:address` | Get on-chain balance | May use Thirdweb SDK directly instead |

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `mobile/feature/home/components/customer-wallet/WalletBalanceCard.tsx` | Create — display on-chain wallet balance |
| `mobile/feature/home/components/customer-wallet/MintToWalletModal.tsx` | Create — mint amount input + confirmation |
| `mobile/feature/home/components/customer-wallet/index.tsx` | Modify — add wallet balance display + mint button |
| `mobile/shared/services/token.services.ts` | Add `mintToWallet` API method |
| `mobile/shared/hooks/token/useMintToWallet.ts` | Create — mutation hook |

---

## QA Test Plan

### Wallet balance view
1. Login as customer with RCN on-chain (e.g., Mamaw Cou has 25 RCN on-chain)
2. **Expected**: See both "Platform Balance" and "Wallet Balance" displayed
3. Compare wallet balance with web → should match
4. Customer with 0 on-chain → wallet balance shows 0

### Mint to wallet
1. Customer has platform balance > 0
2. Tap "Mint to Wallet" → enter amount → confirm
3. **Expected**: Platform balance decreases, wallet balance increases
4. Transaction appears in history
5. Try minting more than available → should show validation error
6. Try minting 0 → should be disabled

### Note
This feature depends on the fix in `docs/tasks/customers/07-04-2026/bug-rcn-earning-mints-directly-to-blockchain.md` — once earnings are DB-only, the mint-to-wallet feature becomes the only way to get tokens on-chain.

---

## Implementation Status (Updated 2026-04-16)

| Sub-Feature | Status | Notes |
|---|---|---|
| **Mint RCN to Wallet** | **Done** | Implemented in `feature/home/components/customer-wallet/index.tsx`. Modal with amount input, MAX button, validation, backend call to `POST /customers/balance/:address/instant-mint`. |
| **Wallet Balance View (On-chain)** | **Not Done** | No `useReadContract` / `balanceOf` call exists in mobile. Only platform balance is displayed. Web shows both off-chain and on-chain balances — mobile does not. |

Remaining work tracked in: `bugs/16-04-2026/feature-on-chain-wallet-balance-view.md`
