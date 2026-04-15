# Bug: Referral Code Silently Ignored During Customer Registration — Field Name Mismatch

## Status: Open
## Priority: High
## Date: 2026-04-15
## Category: Bug - Registration / Referral System
## Platform: Mobile (React Native / Expo)
## Affects: Customer registration with referral code

---

## Problem

When a customer registers with a valid referral code, the referral is completely ignored. The customer is created with no `referred_by`, no referral record, and neither the referrer nor referee receives RCN bonuses. The referral code field is silently dropped because the mobile sends a different field name than what the backend expects.

---

## Root Cause

**Field name mismatch between mobile and backend.**

| Layer | Field Name | Value Sent |
|---|---|---|
| Mobile form | `referral` | `"UM9W57BM"` |
| Mobile submission | `referral` | `"UM9W57BM"` |
| Backend expects | `referralCode` | `undefined` (not mapped) |

**Mobile** (`mobile/feature/register/types.ts` line 5):
```typescript
interface CustomerFormData {
  fullName: string;
  email: string;
  referral: string;  // ← named "referral"
}
```

**Mobile submission** (`mobile/feature/register/hooks/ui/useCustomerRegister.ts` line 41-44):
```typescript
const submissionData = {
  ...formData,          // spreads { fullName, email, referral: "UM9W57BM" }
  walletAddress: account.address,
};
// Sends: { fullName, email, referral: "UM9W57BM", walletAddress: "0x..." }
```

**Backend** (`backend/src/domains/customer/controllers/CustomerController.ts` line 80):
```typescript
const { referralCode } = req.body;  // ← expects "referralCode", gets undefined
```

Since `referralCode` is `undefined`, the service skips referral processing entirely:
```typescript
if (data.referralCode) {  // undefined → falsy → skipped
  // Never executed
}
```

---

## Evidence

- Customer: anna.cagunot@gmail.com registered with referral code `UM9W57BM` (belongs to Qua Ting)
- Anna's `referred_by`: empty
- Anna's `referral_code`: empty (not auto-generated)
- Referrals table: no record created
- Anna's RCN balance: 0 (should have 10 RCN referee bonus)
- Qua Ting's RCN balance: unchanged at 171 (should have gained 25 RCN referrer bonus)

---

## Fix Required

**File:** `mobile/feature/register/hooks/ui/useCustomerRegister.ts` (line 41-44)

Map `referral` to `referralCode` in the submission data:

```typescript
const submissionData = {
  ...formData,
  referralCode: formData.referral,  // ← Map to backend field name
  walletAddress: account.address,
};
```

Or rename the form field from `referral` to `referralCode` across all files:

**Files to update if renaming:**
- `mobile/feature/register/types.ts` — `CustomerFormData.referral` → `referralCode`
- `mobile/feature/register/constants/initialFormData.ts` — `referral: ""` → `referralCode: ""`
- `mobile/feature/register/screens/CustomerRegisterScreen.tsx` — field references
- `mobile/feature/register/hooks/ui/useCustomerRegister.ts` — field references

---

## Also Affects Shop Registration

The same mismatch likely exists for shop registration:

**Mobile** (`mobile/feature/register/types.ts` line 36): `referral: string`
**Backend** (`backend/src/domains/shop/routes/index.ts` line 548): `const { referral } = req.body`

Shop registration uses `referral` (matches mobile), so this may only be a customer-side issue. Verify both.

---

## QA Verification

- [ ] Register customer with valid referral code → referee gets 10 RCN bonus
- [ ] Referrer gets 25 RCN bonus
- [ ] `referred_by` field populated on new customer record
- [ ] Referral record created in `referrals` table
- [ ] Customer's `referral_code` auto-generated for their own future referrals
- [ ] Invalid referral code → show error (not silently accepted)
