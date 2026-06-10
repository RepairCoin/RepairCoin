# Wallet Payouts

## Overview

The Wallet Payouts feature allows shop owners to view their earnings and manage payout methods (bank account or crypto wallet) for withdrawing funds earned through the platform.

## Status

| Platform | Status |
|----------|--------|
| Frontend (Next.js) | UI implemented (with mock data — API not fully wired) |
| Backend API | Not fully implemented |
| Mobile (React Native) | Not implemented |

## Features

### Overview Section
- Available balance (ready to withdraw)
- Pending balance (processing)
- Total earnings (lifetime)
- Last payout date and amount

### Payout Methods
Shop owners can add and manage payout destinations:
- **Bank account** — routing/account number
- **Crypto wallet** — wallet address
- Set a default payout method
- Add, edit, delete methods

### Payout History
List of all past payouts with:
- Amount and currency
- Status: `pending`, `processing`, `completed`, `failed`
- Method used
- Created and completed dates
- Export/download history

## Frontend Location

- Tab: `frontend/src/components/shop/tabs/WalletPayoutsTab.tsx`

> Note: As of the current implementation, the tab uses mock/hardcoded data. Backend API integration is incomplete.

## Implementation Notes

- Backend API endpoints for payouts are not yet created
- The UI is built and ready but requires backend wiring
- Payout processing would likely integrate with Stripe Connect or a crypto payout service
