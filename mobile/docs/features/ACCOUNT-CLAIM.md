# Account Claim (Wallet Detection)

## Overview

When a customer's wallet address is detected on-chain (e.g. they received RCN tokens but have not registered), the system can surface an "Account Claim" prompt that invites them to register and claim their existing balance.

## Status

| Platform | Status |
|----------|--------|
| Frontend (Next.js) | Fully implemented |
| Backend API | Implemented (wallet detection in CustomerDomain) |
| Mobile (React Native) | Not implemented |

## How It Works

1. Admin or shop issues RCN tokens to a wallet address
2. That address has no registered account in the system
3. When the wallet connects and tries to use the app, the system detects the unclaimed balance
4. An `AccountClaimBanner` is shown prompting the user to complete registration
5. After registration, the existing RCN balance is linked to the new account

## AccountClaimBanner

Shown at the top of the customer dashboard when:
- The logged-in wallet has an existing RCN balance
- But no full customer profile has been created yet

The banner:
- Displays the claimable RCN amount
- Has a CTA button to complete registration
- Can be dismissed

## Related Mechanism

- `CustomerDomain` has wallet detection logic that checks if a wallet address has on-chain transactions but no registered profile
- This is used in the referral flow and reward flow as well

## Frontend Location

- Banner: `frontend/src/components/customer/AccountClaimBanner.tsx`
- Wallet detection: `backend/src/domains/CustomerDomain/` (wallet detection service)
