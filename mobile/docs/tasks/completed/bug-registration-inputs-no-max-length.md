# Bug: Registration form inputs accept unlimited characters

**Status:** Completed
**Priority:** High
**Est. Effort:** 15 minutes
**Created:** 2026-04-16
**Updated:** 2026-04-16
**Completed:** 2026-04-16

## Problem

Registration form fields for both shops and customers (first name, last name, email, company name, website, social media URLs, referral) accepted unlimited characters — users could paste 500+ character strings. This risked:

- Database truncation errors (varchar-limited columns)
- UI overflow in profile displays, cards, and lists
- Poor data quality and abuse vectors

Phone inputs were already capped via `PhoneInput` (`maxLength={PHONE_VALIDATION.MAX_DIGITS}`), so that field was not affected.

## Analysis

### Root cause

None of the `FormInput` usages in the registration flow passed a `maxLength` prop. `FormInput` spreads extra props (`...rest`) to the underlying `TextInput`, so adding `maxLength` at the call sites is sufficient — no changes to the shared component itself were needed.

## Implementation

### Files modified

- `mobile/feature/register/components/FirstSlide.tsx`
  - First Name → `maxLength={100}`
  - Last Name → `maxLength={100}`
  - Email Address → `maxLength={255}`
- `mobile/feature/register/components/SecondSlide.tsx`
  - Company Name → `maxLength={150}`
  - Website URL → `maxLength={255}`
  - Referral → `maxLength={100}`
- `mobile/feature/register/components/SocialMediaSlide.tsx`
  - Facebook / Instagram / Twitter / X → `maxLength={255}` each
- `mobile/feature/register/screens/CustomerRegisterScreen.tsx`
  - Full Name → `maxLength={100}`
  - Email Address → `maxLength={255}`
  - Referral Code → `maxLength={50}`

### Approach

Minimal prop additions at call sites. Native `TextInput` enforces `maxLength` for both keyboard input and paste, so no runtime validation layer is needed on top. Did not touch `FormInput` (spreads props) or `PhoneInput` (already capped internally).

## Verification Checklist

- [x] First name: cannot type or paste more than 100 characters
- [x] Last name: cannot type or paste more than 100 characters
- [x] Company name: cannot type or paste more than 150 characters
- [x] Phone: already capped via PhoneInput (PHONE_VALIDATION.MAX_DIGITS)
- [x] Website: cannot type or paste more than 255 characters
- [x] Social media URLs: cannot type or paste more than 255 characters each
- [x] Customer full name: cannot type or paste more than 100 characters
- [x] Customer email: cannot type or paste more than 255 characters
- [x] Customer referral code: cannot type or paste more than 50 characters

## Notes

- **Paste handling:** React Native's `TextInput` `maxLength` caps both typing and paste operations natively, so no extra JS truncation is needed.
- **Follow-up (not in scope):** Add equivalent `maxLength` props to profile-edit screens (shop settings, customer profile) so the same limits apply after registration. Also consider matching server-side column limits (`shops.name VARCHAR(150)`, etc.) in the backend validation layer to catch non-mobile clients (web, API).
