# Transaction History — Raw Type Labels Not Human-Readable

## Overview

The Transaction History table on the customer Overview tab (`/customer?tab=overview`) displays raw snake_case database values in the **Type** column instead of human-readable labels. Non-technical customers see values like `rcn_purchase`, `cross_shop_transfer`, and `service_redemption` which are meaningless to them.

**Created**: March 2, 2026
**Status**: Open
**Priority**: Medium
**Category**: UX / Readability

---

## Problem Statement

The Type column in the Transaction History table only maps 6 out of 12+ transaction types to human-readable labels. Any unmapped type falls through to the raw `transaction.type` value — a snake_case internal identifier.

### What customers see (current)

| Type Badge | Readable? |
|---|---|
| `Repair` | Yes |
| `Redeemed` | Yes |
| `Bonus` | Yes |
| `Referral` | Yes |
| `Rejected` | Yes |
| `Cancelled` | Yes |
| `shop_purchase` | **No** — raw variable |
| `rcn_purchase` | **No** — raw variable |
| `transfer_in` | **No** — raw variable |
| `transfer_out` | **No** — raw variable |
| `cross_shop_verification` | **No** — raw variable |
| `service_redemption` | **No** — raw variable |
| `service_redemption_refund` | **No** — raw variable |

---

## Root Cause

### Backend Transformation (partial)

**File**: `backend/src/domains/customer/services/CustomerService.ts:311`

```tsx
type: tx.type === 'mint' ? 'earned' : tx.type === 'redeem' ? 'redeemed' : tx.type,
```

Only `mint` → `earned` and `redeem` → `redeemed` are mapped. All other types pass through raw.

### Frontend Label Mapping (incomplete)

**File**: `frontend/src/components/customer/OverviewTab.tsx:166-178`

```tsx
{transaction.type === "earned"
  ? "Repair"
  : transaction.type === "tier_bonus"
  ? "Bonus"
  : transaction.type === "referral"
  ? "Referral"
  : transaction.type === "redeemed"
  ? "Redeemed"
  : transaction.type === "rejected_redemption"
  ? "Rejected"
  : transaction.type === "cancelled_redemption"
  ? "Cancelled"
  : transaction.type}   // <-- Raw fallback for all unmapped types
```

The fallback at line 178 renders `transaction.type` directly — the raw snake_case string.

### Badge Color Styling (also incomplete)

**File**: `frontend/src/components/customer/OverviewTab.tsx:152-163`

The same 6 types have color-coded badges. Unmapped types all fall into the green "earned" style, which is misleading (e.g., `service_redemption` appears green even though it's a deduction).

### Amount Sign (also incomplete)

**File**: `frontend/src/components/customer/OverviewTab.tsx:199-202`

Only `redeemed` shows a minus sign. Types like `service_redemption` and `cross_shop_verification` are also deductions but display with a `+` sign.

---

## All Transaction Types (from TypeScript definition)

**Source**: `backend/src/repositories/TransactionRepository.ts:46`

```typescript
type: 'mint' | 'redeem' | 'transfer' | 'transfer_in' | 'transfer_out'
    | 'tier_bonus' | 'shop_purchase' | 'rejected_redemption'
    | 'cancelled_redemption' | 'cross_shop_verification'
    | 'service_redemption' | 'service_redemption_refund';
```

---

## Recommended Fix

### Complete label + color + sign mapping

| DB Type | Display Label | Badge Color | Sign |
|---|---|---|---|
| `earned` (from `mint`) | Repair | Green | + |
| `redeemed` (from `redeem`) | Redeemed | Red | - |
| `tier_bonus` | Bonus | Purple | + |
| `referral` | Referral | Blue | + |
| `rejected_redemption` | Rejected | Orange | (neutral) |
| `cancelled_redemption` | Cancelled | Gray | (neutral) |
| `shop_purchase` | Purchase | Yellow | + |
| `transfer_in` | Transfer In | Teal | + |
| `transfer_out` | Transfer Out | Red | - |
| `cross_shop_verification` | Cross-Shop | Orange | - |
| `service_redemption` | Service Used | Red | - |
| `service_redemption_refund` | Refund | Green | + |

### Implementation approach

Add a type-label map object at the top of the component to replace the inline ternary chains:

```tsx
const TYPE_CONFIG: Record<string, { label: string; color: string; sign: '+' | '-' | '' }> = {
  earned:                    { label: 'Repair',       color: 'bg-green-900/30 text-green-400 border-green-800/50',   sign: '+' },
  redeemed:                  { label: 'Redeemed',     color: 'bg-red-900/30 text-red-400 border-red-800/50',         sign: '-' },
  tier_bonus:                { label: 'Bonus',        color: 'bg-purple-900/30 text-purple-400 border-purple-800/50', sign: '+' },
  referral:                  { label: 'Referral',     color: 'bg-blue-900/30 text-blue-400 border-blue-800/50',       sign: '+' },
  rejected_redemption:       { label: 'Rejected',     color: 'bg-orange-900/30 text-orange-400 border-orange-800/50', sign: '' },
  cancelled_redemption:      { label: 'Cancelled',    color: 'bg-gray-900/30 text-gray-400 border-gray-800/50',       sign: '' },
  shop_purchase:             { label: 'Purchase',     color: 'bg-yellow-900/30 text-yellow-400 border-yellow-800/50', sign: '+' },
  transfer_in:               { label: 'Transfer In',  color: 'bg-teal-900/30 text-teal-400 border-teal-800/50',       sign: '+' },
  transfer_out:              { label: 'Transfer Out', color: 'bg-red-900/30 text-red-400 border-red-800/50',          sign: '-' },
  cross_shop_verification:   { label: 'Cross-Shop',   color: 'bg-orange-900/30 text-orange-400 border-orange-800/50', sign: '-' },
  service_redemption:        { label: 'Service Used', color: 'bg-red-900/30 text-red-400 border-red-800/50',          sign: '-' },
  service_redemption_refund: { label: 'Refund',       color: 'bg-green-900/30 text-green-400 border-green-800/50',    sign: '+' },
};

// Safe fallback for any future/unknown types
const getTypeConfig = (type: string) =>
  TYPE_CONFIG[type] || { label: type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), color: 'bg-gray-900/30 text-gray-400 border-gray-800/50', sign: '' };
```

The fallback auto-converts any unknown snake_case type to Title Case (e.g., `new_future_type` → "New Future Type") so raw variables never appear to customers.

---

## Affected Files

| File | Changes |
|---|---|
| `frontend/src/components/customer/OverviewTab.tsx:148-208` | Type badge label, color, and amount sign logic |

---

## Verification Checklist

- [ ] All 12 transaction types render human-readable labels
- [ ] Badge colors correctly indicate positive (green), negative (red), and neutral (gray/orange) transactions
- [ ] Amount column shows correct +/- signs for all types
- [ ] Unknown/future types fall back to Title Case (not raw snake_case)
- [ ] No visual regression on existing transaction types (Repair, Redeemed, Bonus, etc.)

---

## References

- **Frontend component**: `frontend/src/components/customer/OverviewTab.tsx:148-208`
- **Backend transformation**: `backend/src/domains/customer/services/CustomerService.ts:303-324`
- **Type definition**: `backend/src/repositories/TransactionRepository.ts:46`
