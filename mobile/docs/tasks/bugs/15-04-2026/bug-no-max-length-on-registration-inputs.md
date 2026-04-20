# Bug: No Maximum Character Limit on Registration Form Inputs

## Status: Closed (Superseded)
## Priority: Medium
## Date: 2026-04-15
## Closed: 2026-04-20
## Category: Bug - Validation / Data Integrity
## Platform: Mobile (React Native / Expo)
## Affects: Customer and Shop registration forms

---

## Closed on 2026-04-20

**Superseded by:** `mobile/docs/tasks/bugs/20-04-2026/bug-registration-inputs-maxlength-insufficient-defense-in-depth.md`

This doc recommended both (A) native `maxLength` props at call sites and (B) `hasMaxLength` validation checks in `validation.ts`, and explicitly said to "use both."

Commit `672397c8` (2026-04-16) implemented **only Option A**. That partial fix is described in `mobile/docs/tasks/completed/bug-registration-inputs-no-max-length.md`. The QA items in this doc for basic typing and clipboard-paste are satisfied by the native `maxLength` props, but the broader intent (Option B + paste-bypass vectors) was not addressed.

All remaining work — including Option B (`hasMaxLength` checks), plus additional defense-in-depth for input paths that bypass native `InputFilter` (autofill, password managers, Google Sign-In prefill, voice dictation, keyboard suggestions, swipe typing, IME composition, etc.) — is tracked in the superseding 2026-04-20 doc as a 5-layer fix architecture with three independently-shippable PRs.

This doc kept for history. Do not reopen; add follow-up work to the 2026-04-20 superseder instead.

---

## Problem

All text input fields in the registration forms accept unlimited characters. Users can enter 500+ character strings for first name, last name, company name, website, and social media fields. There is no `maxLength` prop on any input and no validation for maximum length.

This can cause:
- Database truncation errors (columns have varchar limits)
- UI overflow in profile displays, cards, and lists
- Poor data quality

---

## Database Column Limits (Not Enforced by Mobile)

### Shop Table

| Field | DB Type | Max Length | Mobile Limit |
|---|---|---|---|
| name (company) | varchar | 255 | None |
| first_name | varchar | 255 | None |
| last_name | varchar | 255 | None |
| email | varchar | 255 | None |
| phone | varchar | 20 | None |
| address | text | Unlimited | None |
| website | varchar | 255 | None |
| facebook | varchar | 255 | None |
| instagram | varchar | 255 | None |
| twitter | varchar | 255 | None |

### Customer Table

| Field | DB Type | Max Length | Mobile Limit |
|---|---|---|---|
| name | varchar | 255 | None |
| first_name | varchar | 100 | None |
| last_name | varchar | 100 | None |
| email | varchar | 255 | None |
| phone | varchar | 20 | None |

---

## Fix Required

### Option A: Add `maxLength` prop to inputs (Recommended)

Add `maxLength` to all `FormInput` and `TextInput` components in registration screens:

**Shop Registration:**

```typescript
// FirstSlide.tsx
<FormInput label="First Name" maxLength={100} ... />
<FormInput label="Last Name" maxLength={100} ... />

// SecondSlide.tsx
<FormInput label="Company Name" maxLength={255} ... />
<FormInput label="Website URL" maxLength={255} ... />

// SocialMediaSlide.tsx
<FormInput label="Facebook" maxLength={255} ... />
<FormInput label="Instagram" maxLength={255} ... />
<FormInput label="Twitter / X" maxLength={255} ... />
```

**Customer Registration:**

```typescript
// CustomerRegisterScreen.tsx
<FormInput label="Full Name" maxLength={100} ... />
<FormInput label="Email Address" maxLength={255} ... />
```

### Option B: Add validation in validation.ts

Add max length checks alongside existing min length checks:

```typescript
export const hasMaxLength = (value: string, maxLength: number): boolean => {
  return value.trim().length <= maxLength;
};

// In validateShopFirstSlide:
if (firstName.length > 100) errors.push("First name cannot exceed 100 characters");
if (lastName.length > 100) errors.push("Last name cannot exceed 100 characters");
```

**Recommended: Use both** — `maxLength` prop prevents typing beyond the limit, validation catches edge cases.

---

## Recommended Limits

| Field | Recommended Max | Reason |
|---|---|---|
| First Name | 100 | Customer DB limit |
| Last Name | 100 | Customer DB limit |
| Full Name (customer) | 100 | Reasonable for display |
| Company Name | 150 | Fits UI cards comfortably |
| Email | 255 | DB limit |
| Phone | 20 | DB limit |
| Website URL | 255 | DB limit |
| Social media URLs | 255 | DB limit |
| Street Address | 300 | Reasonable for international addresses |
| City | 100 | Reasonable |
| Country | 100 | Reasonable |
| Referral code | 20 | Codes are short |

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/register/components/FirstSlide.tsx` | Add `maxLength` to first name, last name, email, phone |
| `mobile/feature/register/components/SecondSlide.tsx` | Add `maxLength` to company name, website |
| `mobile/feature/register/components/ThirdSlide.tsx` | Add `maxLength` to address, city, country |
| `mobile/feature/register/components/SocialMediaSlide.tsx` | Add `maxLength` to facebook, instagram, twitter |
| `mobile/feature/register/screens/CustomerRegisterScreen.tsx` | Add `maxLength` to full name, email, referral |
| `mobile/feature/register/utils/validation.ts` | Add `hasMaxLength` helper and max length checks |

---

## QA Verification

- [ ] First name: cannot type more than 100 characters
- [ ] Last name: cannot type more than 100 characters
- [ ] Company name: cannot type more than 150 characters
- [ ] Phone: cannot type more than 20 characters
- [ ] Website: cannot type more than 255 characters
- [ ] Social media URLs: cannot type more than 255 characters
- [ ] Customer full name: cannot type more than 100 characters
- [ ] Pasting long text is also truncated at the limit
