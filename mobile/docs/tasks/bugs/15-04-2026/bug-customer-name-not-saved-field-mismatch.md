# Bug: Customer Full Name Not Saved During Registration — Field Name Mismatch

## Status: Open
## Priority: High
## Date: 2026-04-15
## Category: Bug - Registration / Data Integrity
## Platform: Mobile (React Native / Expo)
## Affects: Customer registration — name field

---

## Problem

When a customer registers and enters their full name (e.g., "Anna Cou"), the name is not saved to the database. The `name`, `first_name`, and `last_name` columns are all empty after registration. The Edit Profile screen shows an empty Full Name field.

---

## Root Cause

**Field name mismatch between mobile and backend — same pattern as the referral code bug.**

| Layer | Field Name | Value |
|---|---|---|
| Mobile form field | `fullName` | `"Anna Cou"` |
| Mobile sends to API | `fullName` | `"Anna Cou"` |
| Backend expects | `name` | `undefined` |

**Mobile** (`mobile/feature/register/types.ts` line 3):
```typescript
interface CustomerFormData {
  fullName: string;  // ← named "fullName"
  email: string;
  referral: string;
}
```

**Mobile submission** (`mobile/feature/register/hooks/ui/useCustomerRegister.ts` line 41-44):
```typescript
const submissionData = {
  ...formData,          // spreads { fullName: "Anna Cou", email: "...", referral: "..." }
  walletAddress: account.address,
};
// Sends: { fullName: "Anna Cou", ... }
// Backend never reads "fullName"
```

**Backend** (`backend/src/domains/customer/controllers/CustomerController.ts` line 75):
```typescript
const { name } = req.body;  // ← expects "name", gets undefined
```

---

## Evidence

- Customer anna.cagunot@gmail.com registered with Full Name "Anna Cou"
- Database: `name` = empty, `first_name` = empty, `last_name` = empty
- Edit Profile screen shows empty Full Name field

---

## Fix Required

**File:** `mobile/feature/register/hooks/ui/useCustomerRegister.ts` (line 41-44)

Map `fullName` to `name` in the submission data:

```typescript
const submissionData = {
  ...formData,
  name: formData.fullName,          // ← Map to backend field name
  referralCode: formData.referral,  // ← Also fix referral (separate bug)
  walletAddress: account.address,
};
```

**Note:** This is the same root cause as the referral code bug (`mobile/docs/tasks/bugs/15-04-2026/bug-referral-code-field-name-mismatch.md`). Both should be fixed together in the same PR.

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/register/hooks/ui/useCustomerRegister.ts` | Map `name: formData.fullName` in submission data |

---

## QA Verification

- [ ] Register customer with full name "Test User" → name saved in database
- [ ] Edit Profile screen shows "Test User" in Full Name field
- [ ] Customer dashboard header shows customer name
- [ ] Name visible in shop's customer lookup
