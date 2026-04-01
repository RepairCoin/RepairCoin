# Bug: Transaction history hides rejected/cancelled redemptions and missing type mappings

**Status:** Completed
**Priority:** High
**Est. Effort:** 1-2 hrs
**Created:** 2026-03-31
**Updated:** 2026-03-31
**Completed:** 2026-03-31

## Problem / Goal

The mobile Transaction History explicitly filters out `rejected_redemption` and `cancelled_redemption` transactions, making them invisible to customers. These same transactions display correctly on the web frontend. Additionally, several transaction types may fall outside any filter category and some have no icon/label mapping.

**Steps to reproduce:**
1. Login as a shop
2. Initiate a redemption request to customer 0x6cd036477D1C39dA021095a62A32c6bB919993Cf
3. Login as the customer on mobile
4. Reject the incoming redemption
5. Go to Transaction History — the rejection does NOT appear
6. Check web Transaction History — the rejection DOES appear with "Rejected" badge

**Expected:** Rejected/cancelled redemptions visible in transaction history with proper labels
**Actual:** These transaction types are filtered out and never shown

## Analysis

- The mobile transaction history query or filter logic explicitly excludes `rejected_redemption` and `cancelled_redemption` types
- The web frontend shows all transaction types without filtering
- The `TransactionHistoryCard` component already has icon/label mappings for rejected and cancelled types, so the issue is in the data fetching layer
- Need to check the API call or local filter that removes these types

## Implementation

1. Find where transaction types are filtered in the mobile app (API service or screen component)
2. Remove the filter that excludes rejected/cancelled redemptions
3. Verify all transaction types have proper icon/label mappings in `TransactionHistoryCard`
4. Compare with web frontend to ensure parity

## Verification Checklist

- [ ] Rejected redemptions appear in transaction history
- [ ] Cancelled redemptions appear in transaction history
- [ ] Rejected transactions show "Rejected" label with red icon
- [ ] Cancelled transactions show "Cancelled" label with red icon
- [ ] All other transaction types still display correctly
- [ ] Transaction history matches web frontend for same account

## Notes

- The `TransactionHistoryCard` already handles rejected/cancelled types with proper styling (lines 70-79)
- Issue is likely in the API query params or a filter in the history screen
- Web frontend shows these correctly — this is a mobile-only filtering issue
