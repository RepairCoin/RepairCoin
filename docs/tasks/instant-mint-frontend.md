# Frontend Implementation: Instant Mint with Transaction Hash Display

**Date:** 2025-12-16
**Feature:** Customer Instant Mint UI
**Component:** `frontend/src/components/customer/OverviewTab.tsx`

---

## Overview

This implementation updates the customer "Mint to Wallet" feature to use the new instant-mint API endpoint. Instead of queuing tokens for admin approval, customers can now mint tokens directly to their blockchain wallet and see the transaction hash immediately.

### Key Features
- **Instant minting** - No queue, no waiting for admin approval
- **Transaction hash display** - Shows blockchain tx hash on success
- **Block explorer link** - One-click to view transaction on BaseScan
- **Gas fees covered** - Clear messaging that platform pays gas

---

## User Experience Flow

```
┌─────────────────────────────────────┐
│  Customer Dashboard (OverviewTab)   │
│  "Mint to Wallet" Button            │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Mint Modal - Form State            │
│  ┌─────────────────────────────┐    │
│  │ Available Balance: 50 RCN  │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ Amount: [____] [MAX]       │    │
│  │ Max per transaction: 10,000│    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ ℹ️ Instant Minting          │    │
│  │ Gas fees covered by platform│    │
│  └─────────────────────────────┘    │
│  [Cancel]  [Mint to Wallet]         │
└─────────────────────────────────────┘
                 │
                 ▼ (Click Mint)
┌─────────────────────────────────────┐
│  Mint Modal - Loading State         │
│                                     │
│  [Cancel]  [🔄 Minting...]          │
│                                     │
└─────────────────────────────────────┘
                 │
                 ▼ (Success)
┌─────────────────────────────────────┐
│  Mint Modal - Success State         │
│                                     │
│         ✅ (green checkmark)        │
│                                     │
│        "50 RCN Minted!"             │
│  "Your tokens have been minted..."  │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Transaction Hash:           │    │
│  │ 0x1234...abcd         🔗   │    │
│  └─────────────────────────────┘    │
│                                     │
│  [🔗 View on Block Explorer]        │
│  [Done]                             │
└─────────────────────────────────────┘
```

---

## File Modified

**Path:** `frontend/src/components/customer/OverviewTab.tsx`

### Changes Summary

| Section | Change |
|---------|--------|
| Imports | Added `CheckCircle`, `ExternalLink` from lucide-react |
| State | Added `mintResult` state for success tracking |
| Handler | Updated `handleMintToWallet()` to call instant-mint API |
| Helpers | Added `handleCloseMintModal()` and `getExplorerUrl()` |
| Modal | Redesigned with form state and success state |

---

## Code Changes

### 1. New Imports

```typescript
// Before
import { Coins, X, Loader2, AlertTriangle } from "lucide-react";

// After
import { Coins, X, Loader2, AlertTriangle, CheckCircle, ExternalLink } from "lucide-react";
```

### 2. New State

```typescript
// Added alongside existing mint states
const [mintResult, setMintResult] = useState<{
  success: boolean;
  transactionHash?: string;
  amount?: number;
} | null>(null);
```

### 3. Updated Handler

```typescript
// Before - Queue mint (requires admin approval)
const result = await apiClient.post(
  `/customers/balance/${account.address}/queue-mint`,
  { amount }
);

// After - Instant mint (immediate blockchain transaction)
const result = await apiClient.post(
  `/customers/balance/${account.address}/instant-mint`,
  { amount }
);

if (result.success) {
  setMintResult({
    success: true,
    transactionHash: result.data?.transactionHash,
    amount: result.data?.amount || amount
  });
  toast.success(`Successfully minted ${amount} RCN to your wallet!`);
  // ...
}
```

### 4. New Helper Functions

```typescript
// Close modal and reset all state
const handleCloseMintModal = () => {
  setShowMintModal(false);
  setMintAmount("");
  setMintResult(null);
};

// Generate block explorer URL for transaction
const getExplorerUrl = (txHash: string) => {
  // Base Sepolia (testnet)
  return `https://sepolia.basescan.org/tx/${txHash}`;
  // For production (Base Mainnet):
  // return `https://basescan.org/tx/${txHash}`;
};
```

### 5. Modal UI States

The modal now has two distinct states:

**Form State** (when `mintResult` is null):
- Shows available balance
- Amount input with MAX button
- Info box about instant minting
- Cancel and Mint buttons

**Success State** (when `mintResult.success` is true):
- Green checkmark icon
- Amount minted message
- Transaction hash with copy/link
- View on Block Explorer button
- Done button

---

## UI Components

### Success State Display

```tsx
{mintResult?.success && (
  <div className="space-y-4">
    {/* Success Icon */}
    <div className="flex justify-center">
      <div className="bg-green-500/20 p-4 rounded-full">
        <CheckCircle className="w-12 h-12 text-green-500" />
      </div>
    </div>

    {/* Success Message */}
    <div className="text-center">
      <p className="text-white text-lg font-medium mb-2">
        {mintResult.amount} RCN Minted!
      </p>
      <p className="text-gray-400 text-sm">
        Your tokens have been successfully minted to your wallet.
      </p>
    </div>

    {/* Transaction Hash */}
    {mintResult.transactionHash && (
      <div className="bg-[#2F2F2F] p-4 rounded-lg">
        <p className="text-gray-400 text-xs mb-2">Transaction Hash:</p>
        <div className="flex items-center gap-2">
          <code className="text-[#FFCC00] text-xs break-all flex-1">
            {mintResult.transactionHash}
          </code>
          <a
            href={getExplorerUrl(mintResult.transactionHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FFCC00] hover:text-yellow-400"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    )}

    {/* View on Explorer Button */}
    <a
      href={getExplorerUrl(mintResult.transactionHash)}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full px-4 py-2 bg-[#2F2F2F] text-[#FFCC00] rounded-lg..."
    >
      <ExternalLink className="w-4 h-4" />
      View on Block Explorer
    </a>

    {/* Done Button */}
    <button onClick={handleCloseMintModal} className="...">
      Done
    </button>
  </div>
)}
```

### Info Box (Form State)

Changed from yellow warning to blue info style:

```tsx
<div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
  <Coins className="w-5 h-5 text-blue-400" />
  <div className="text-sm text-blue-200">
    <p className="font-medium mb-1">Instant Minting</p>
    <p>
      Your tokens will be minted directly to your wallet. Gas fees
      are covered by the platform.
    </p>
  </div>
</div>
```

---

## Validation

### Client-Side Validation

| Check | Error Message |
|-------|---------------|
| Wallet not connected | "Please connect your wallet first" |
| Amount ≤ 0 | "Please enter a valid amount" |
| Amount > balance | "Amount exceeds available balance" |
| Amount > 10,000 | "Maximum mint amount is 10,000 RCN per transaction" |

### Input Constraints

```tsx
<input
  type="number"
  min="0"
  max={Math.min(balanceData?.availableBalance || 0, 10000)}
  step="0.01"
  disabled={isMinting}
/>
<p className="text-gray-500 text-xs mt-1">
  Max per transaction: 10,000 RCN
</p>
```

---

## API Integration

### Request

```typescript
POST /api/customers/balance/{address}/instant-mint
Content-Type: application/json

{
  "amount": 50
}
```

### Response Handling

```typescript
// Success response
{
  "success": true,
  "data": {
    "transactionHash": "0x1234...",
    "amount": 50,
    "customerAddress": "0xabc..."
  },
  "message": "Successfully minted 50 RCN to wallet"
}

// Error response
{
  "success": false,
  "error": "Insufficient database balance"
}
```

### Error Handling

```typescript
} catch (error: any) {
  console.error("Mint error:", error);
  const errorMessage = error?.response?.data?.error
    || error?.message
    || "Failed to process mint request";
  toast.error(errorMessage);
  setMintResult(null);
}
```

---

## Block Explorer Integration

### Network Configuration

| Network | Explorer URL |
|---------|--------------|
| Base Sepolia (testnet) | `https://sepolia.basescan.org/tx/{hash}` |
| Base Mainnet (production) | `https://basescan.org/tx/{hash}` |

### Future Enhancement

For production, consider using environment variable:

```typescript
const getExplorerUrl = (txHash: string) => {
  const baseUrl = process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL
    || 'https://sepolia.basescan.org';
  return `${baseUrl}/tx/${txHash}`;
};
```

---

## Styling

### Color Scheme

| Element | Color | Hex |
|---------|-------|-----|
| Primary button | Yellow | `#FFCC00` |
| Success icon | Green | `text-green-500` |
| Transaction hash | Yellow | `text-[#FFCC00]` |
| Info box border | Blue | `border-blue-700/50` |
| Background | Dark gray | `#212121`, `#2F2F2F` |

### Responsive Design

- Modal max-width: `max-w-md`
- Input and buttons are full-width on mobile
- Text sizes adjust for smaller screens

---

## Testing

### Manual Test Steps

1. **Login as customer** with available RCN balance
2. **Click "Mint to Wallet"** button in overview section
3. **Enter amount** (try MAX button)
4. **Click "Mint to Wallet"** in modal
5. **Verify loading state** shows "Minting..." with spinner
6. **On success**, verify:
   - Green checkmark appears
   - Amount shows correctly
   - Transaction hash displays
   - External link icon works
   - "View on Block Explorer" opens BaseScan
   - "Done" closes modal
7. **Verify balance** updates after closing modal

### Error Testing

| Test | Action | Expected |
|------|--------|----------|
| Empty amount | Leave blank, click mint | Toast error |
| Zero amount | Enter 0, click mint | Toast error |
| Over balance | Enter more than available | Toast error |
| Over max | Enter 15000 | Toast error |
| Network error | Disconnect internet | Toast error, form resets |

---

## Comparison: Before vs After

| Feature | Before (Queue) | After (Instant) |
|---------|----------------|-----------------|
| API endpoint | `/queue-mint` | `/instant-mint` |
| Processing | Admin approval needed | Immediate |
| Result display | "Queued" message | Transaction hash |
| User feedback | Toast only | Modal success state |
| Block explorer | Not available | Link provided |
| Info messaging | Warning (yellow) | Info (blue) |

---

## Related Files

| File | Purpose |
|------|---------|
| `backend/src/domains/customer/routes/balance.ts` | API endpoint |
| `backend/src/domains/customer/services/CustomerBalanceService.ts` | Business logic |
| `docs/tasks/instant-mint-endpoint.md` | Backend documentation |

---

## Future Enhancements

1. **Copy transaction hash** - Add copy-to-clipboard button
2. **Transaction history** - Show recent mints in dashboard
3. **Wallet balance display** - Show on-chain balance alongside off-chain
4. **Production explorer** - Environment-based explorer URL
5. **Confirmation step** - Optional "Are you sure?" before minting
6. **Email notification** - Notify customer on successful mint
