# Payment Methods

## Overview

The Payment Methods tab allows shop owners to view and manage what payment types they accept from customers. This is a configuration feature for the shop's service booking and checkout flow.

## Status

| Platform | Status |
|----------|--------|
| Frontend (Next.js) | Implemented |
| Backend API | Partial |
| Mobile (React Native) | Not implemented |

## Features

- View currently enabled payment methods
- Toggle accepted payment types:
  - Cash
  - Credit / Debit card
  - RCN token redemption
  - Online payment (Stripe)
- Configuration is reflected in the customer-facing booking/checkout flow

## Frontend Location

- Tab: `frontend/src/components/shop/tabs/PaymentMethodsTab.tsx`

## Notes

- RCN redemption is always available as long as the customer has a balance
- This feature primarily controls which cash/card/online payment options the shop advertises
- Stripe payment processing is handled separately via the subscription and payment flow
