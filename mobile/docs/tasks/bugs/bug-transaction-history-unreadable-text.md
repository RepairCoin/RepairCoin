# Bug: Transaction history shows system variable names instead of readable text

**Status:** Open
**Priority:** Medium
**Est. Effort:** 1 hr
**Created:** 2026-03-30
**Updated:** 2026-03-30

## Problem / Goal

Transaction history screen displays raw system variable names like `service_redemption_refund` instead of human-readable text like "Service Redemption Refund". This makes the screen confusing for customers.

**Expected:** "Service Redemption Refund"
**Actual:** "service_redemption_refund"

## Analysis

- Transaction types come from the backend as snake_case strings
- The mobile app displays them as-is without formatting
- Need a formatter function to convert snake_case to Title Case

## Implementation

1. Create a utility function to convert snake_case to Title Case (e.g., `service_redemption_refund` → `Service Redemption Refund`)
2. Apply the formatter to transaction type/description text in the transaction history screen
3. Optionally map specific types to custom labels for better UX

## Verification Checklist

- [ ] All transaction types display in Title Case
- [ ] No raw snake_case text visible on the transaction history screen
- [ ] Verify with all known transaction types
- [ ] Edge cases handled (single word, empty string)

## Notes

- Client feedback: transaction text should be human readable
- Simple string transform — replace underscores with spaces and capitalize each word
