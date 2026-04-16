# Feature: On-Chain Wallet Balance View for Customer Home

**Status:** Open
**Priority:** Medium
**Est. Effort:** 2 hrs
**Created:** 2026-04-16
**Updated:** 2026-04-16

---

## Problem

The mobile customer home screen only shows a single "Your Current RCN Balance" (platform/off-chain balance from the database). It does not display the customer's on-chain blockchain wallet balance. The web app shows both:

- **"Available Balance"** (sublabel: "Off-chain balance") — platform `currentRcnBalance` from API
- **"Wallet Balance"** (sublabel: "On-chain balance") — reads `balanceOf(address)` from the RCN smart contract

Mobile has no equivalent of the on-chain balance display.

---

## Web Reference

**File:** `frontend/src/components/customer/OverviewTab.tsx` (lines 226-259, 395-407)

```typescript
// Reads on-chain balance from RCN smart contract
const { data: tokenBalance, refetch: refetchTokenBalance } = useReadContract({
  contract,
  method: "function balanceOf(address) view returns (uint256)",
  params: [customerData.address],
});

// Formats the raw uint256 to human-readable
useEffect(() => {
  if (tokenBalance !== undefined) {
    const formattedBalance = Number(tokenBalance) / 1e18;
    // ...
  }
}, [tokenBalance]);
```

Web displays two separate stat cards:
```
| Available Balance  | Wallet Balance     |
| Off-chain balance  | On-chain balance   |
| 150.00 RCN         | 25.00 RCN          |
```

---

## Current Mobile State

**File:** `mobile/feature/home/components/customer-wallet/index.tsx` (line 94)

```typescript
const totalBalance = customerData?.customer?.currentRcnBalance || 0;
```

Only the platform balance is shown via the `ActionCard` component. The `balanceLabel` defaults to "Your Current RCN Balance" — no on-chain balance is read or displayed.

---

## Implementation

### Step 1: Read on-chain balance

**File:** `mobile/feature/home/components/customer-wallet/index.tsx`

Add Thirdweb `useReadContract` to read the RCN contract balance:

```typescript
import { useReadContract } from "thirdweb/react";
import { getContract } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { thirdwebClient } from "@/shared/config/thirdweb"; // verify actual import path

const RCN_CONTRACT_ADDRESS = "0xBFE793d78B6B83859b528F191bd6F2b8555D951C";

const contract = getContract({
  client: thirdwebClient,
  chain: baseSepolia,
  address: RCN_CONTRACT_ADDRESS,
});

const { data: rawWalletBalance, refetch: refetchWalletBalance } = useReadContract({
  contract,
  method: "function balanceOf(address) view returns (uint256)",
  params: [account?.address!],
  queryOptions: { enabled: !!account?.address },
});

const walletBalance = useMemo(() => {
  if (rawWalletBalance === undefined) return 0;
  return Number(rawWalletBalance) / 1e18;
}, [rawWalletBalance]);
```

### Step 2: Display both balances

Add a wallet balance section below or alongside the existing `ActionCard`. Options:

**Option A — Info row below the card:**
```typescript
<View className="flex-row justify-between bg-zinc-900 rounded-xl p-4 mt-3">
  <View>
    <Text className="text-gray-400 text-xs">Platform Balance</Text>
    <Text className="text-white text-lg font-bold">{totalBalance.toFixed(2)} RCN</Text>
  </View>
  <View className="items-end">
    <Text className="text-gray-400 text-xs">Wallet Balance</Text>
    <Text className="text-white text-lg font-bold">{walletBalance.toFixed(2)} RCN</Text>
  </View>
</View>
```

**Option B — Second `ActionCard` or stat card** (closer to web parity).

### Step 3: Refresh wallet balance after mint

In the existing `mintMutation.onSuccess`, also refetch the on-chain balance:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["repaircoin", "customers"] });
  refetch();
  setTimeout(() => refetchWalletBalance(), 3000); // Delay for blockchain confirmation
  setShowMintModal(false);
  setMintAmount("");
  showSuccess("RCN minted to your wallet!");
},
```

### Step 4: Include in pull-to-refresh

Add `refetchWalletBalance` to the `onRefresh` handler:

```typescript
await Promise.all([
  refetch(),
  refetchServices(),
  refetchTrending(),
  refetchRecentlyViewed(),
  refetchFavorites(),
  refetchWalletBalance(), // ADD
]);
```

---

## Pre-Implementation Checks

Before implementing, verify:

| Check | How |
|-------|-----|
| Thirdweb client is configured | Grep for `thirdwebClient` or `createThirdwebClient` in mobile code |
| `useReadContract` works in React Native | Should work — Thirdweb SDK v5 supports React Native |
| RCN contract address is correct | `0xBFE793d78B6B83859b528F191bd6F2b8555D951C` on Base Sepolia |
| Chain config is available | Check for `baseSepolia` import from `thirdweb/chains` |

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/home/components/customer-wallet/index.tsx` | Add `useReadContract` for on-chain balance, display both balances, refresh after mint |

---

## Verification Checklist

- [ ] Customer home shows both platform balance and on-chain wallet balance
- [ ] On-chain balance matches what web shows for the same customer
- [ ] Customer with 0 on-chain RCN shows "0.00 RCN" for wallet balance
- [ ] After minting, wallet balance updates (with slight delay for blockchain confirmation)
- [ ] Pull-to-refresh updates both balances
- [ ] No wallet connected → wallet balance section hidden or shows 0
- [ ] Compare with web app — values should match

---

## Notes

- Related parent task: `features/feature-mint-rcn-to-wallet-and-balance-view.md` (partially completed — mint done, this view missing)
- Completed task: `completed/mint-rcn-and-wallet-balance.md` (marked as partial)
- The RCN token uses 18 decimals, so raw `balanceOf` value must be divided by `1e18`
