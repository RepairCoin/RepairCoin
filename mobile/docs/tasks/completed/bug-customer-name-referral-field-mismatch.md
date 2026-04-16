# Bug: Customer Name and Referral Code Not Saved — Field Name Mismatch

**Status:** Completed
**Priority:** High
**Est. Effort:** 15 min
**Created:** 2026-04-16
**Updated:** 2026-04-16
**Completed:** 2026-04-16

---

## Problem

When a customer registers and enters their full name (e.g., "Anna Cou") and optional referral code, neither is saved to the database:

- `name`, `first_name`, `last_name` columns all remain empty
- Referral code is ignored (no referrer linkage)
- Edit Profile screen shows an empty Full Name field
- Customer dashboard header shows no name

---

## Root Cause

Field name mismatch between mobile form and backend API contract.

**Mobile form** (`mobile/feature/register/types.ts`):

```typescript
interface CustomerFormData {
  fullName: string; // UI field name
  email: string;
  referral: string; // UI field name
}
```

**Mobile submission** (`mobile/feature/register/hooks/ui/useCustomerRegister.ts`):

```typescript
const submissionData = {
  ...formData, // spreads { fullName, email, referral }
  walletAddress: account.address,
};
registerCustomer(submissionData);
```

**Backend controller** (`backend/src/domains/customer/controllers/CustomerController.ts` line 72-83):

```typescript
const {
  walletAddress,
  email,
  name,           // ← backend reads "name", not "fullName"
  referralCode,   // ← backend reads "referralCode", not "referral"
  ...
} = req.body;
```

The backend destructures `name` and `referralCode` from the request body, but mobile sends `fullName` and `referral` — so those fields arrive as `undefined` and are silently stored as empty values.

---

## Fix

**File:** `mobile/feature/register/hooks/ui/useCustomerRegister.ts`

Map the UI field names to the backend field names when building `submissionData`:

```typescript
const submissionData = {
  ...formData,
  name: formData.fullName, // map fullName → name
  referralCode: formData.referral, // map referral → referralCode
  walletAddress: account.address,
};
```

The `...formData` spread is kept so any future field additions carry through, but the two UI-only names (`fullName`, `referral`) are explicitly remapped to the canonical backend names. Extra unused fields in the payload are harmless — the backend destructures only what it needs.

---

## Files Modified

| File                                                      | Change                                                                        |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `mobile/feature/register/hooks/ui/useCustomerRegister.ts` | Map `fullName` → `name` and `referral` → `referralCode` in submission payload |

---

## Verification Checklist

- [x] Register customer with full name "Test User" → `name` column populated in database
- [x] Edit Profile screen shows "Test User" in Full Name field
- [x] Customer dashboard header shows customer name
- [x] Name visible in shop's customer lookup
- [x] Registration with a referral code → `referralCode` reaches backend and referrer linkage is established

---

## Notes

- Same root-cause pattern as the referral code bug — both fixed together in the same change.
- The mobile-side form interface (`feature/register/types.ts`) and backend contract (`shared/interfaces/customer.interface.ts` — `name`, `referralCode`) are kept as-is; the mapping happens at the submission boundary, which is the simplest fix and avoids touching the form UI code.
