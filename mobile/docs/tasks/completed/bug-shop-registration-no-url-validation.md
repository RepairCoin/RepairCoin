# Bug: Shop Registration Accepts Invalid URLs for Website and Social Media

## Status: Closed
## Resolved: 2026-04-22
## Resolution: Fixed in commit 5c988d46 (Option B — auto-prepend https:// on submit). QA verified 2026-04-22: "abc" rejected with validation popup, "abc.com" accepted and normalized to "https://abc.com" on submission. Website and social media fields behave identically.
## Priority: Medium
## Date: 2026-04-15
## Category: Bug - Registration / Validation
## Platform: Mobile (React Native / Expo)
## Affects: Shop registration — Business Info (website) and Social Media slides

---

## Problem

Two URL validation issues in the shop registration flow:

### Issue 1: Website field has NO validation
The Website URL field on the Business Info slide (SecondSlide) accepts any text, including "SD", "abc", or empty gibberish. There is no URL validation — the field is passed directly to the backend without checking.

**Evidence:** Entered "SD" as website URL → registration proceeded without error.

### Issue 2: Social media URLs accept URLs without protocol
The Social Media slide validates URLs using a regex that makes `https://` optional. This means `facebook.com/yourpage` passes validation, but these URLs won't work as clickable links when displayed to customers since browsers need the protocol prefix.

**Evidence:** Entered "facebook.com/yourpage" → validation passed.

---

## Root Cause

### Website (no validation)

**File:** `mobile/feature/register/components/SecondSlide.tsx` (lines 19-31)

`validateAndProceed()` only validates `name`, `companySize`, `monthlyRevenue` — website is not included:

```typescript
const errors = validateShopSecondSlide(
  formData.name,
  formData.companySize,
  formData.monthlyRevenue
);
// Website field is never validated
```

### Social Media (weak regex)

**File:** `mobile/feature/register/utils/validation.ts` (lines 20-23)

```typescript
export const isValidUrl = (url: string): boolean => {
  const urlRegex =
    /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-@]*)*\/?$/;
  return urlRegex.test(url.trim());
};
```

The `(https?:\/\/)?` makes the protocol optional. `facebook.com/yourpage` passes because it matches `([\da-z\.-]+)\.([a-z\.]{2,6})`.

---

## Fix Required

### Fix 1: Add website validation to SecondSlide

**File:** `mobile/feature/register/components/SecondSlide.tsx`

Add website validation in `validateAndProceed()`:

```typescript
const validateAndProceed = () => {
  const errors = validateShopSecondSlide(
    formData.name,
    formData.companySize,
    formData.monthlyRevenue
  );

  // Validate website if provided
  if (formData.website && formData.website.trim() && !isValidUrl(formData.website.trim())) {
    errors.push("Please enter a valid website URL");
  }

  if (errors.length > 0) {
    Alert.alert("Validation Error", errors.join("\n"));
    return;
  }
  handleGoNext();
};
```

### Fix 2: Auto-prepend https:// to URLs missing protocol

**File:** `mobile/feature/register/utils/validation.ts`

Either require `https://` in the regex, or auto-prepend it before saving:

**Option A: Require protocol in regex**
```typescript
const urlRegex = /^https?:\/\/([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-@]*)*\/?$/;
```

**Option B: Auto-prepend https:// (Recommended)**

Apply to all URL fields (website, facebook, instagram, twitter) before submission:

```typescript
const normalizeUrl = (url: string): string => {
  if (!url || !url.trim()) return '';
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && trimmed.includes('.')) {
    return 'https://' + trimmed;
  }
  return trimmed;
};
```

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/register/components/SecondSlide.tsx` | Add website URL validation |
| `mobile/feature/register/utils/validation.ts` | Strengthen URL regex or add auto-prepend helper |
| `mobile/feature/register/hooks/ui/useShopRegister.ts` | Normalize URLs before submission |

---

## QA Verification

- [ ] Website field: enter "SD" → validation error shown
- [ ] Website field: enter "example.com" → auto-prepend https:// or show error
- [ ] Website field: enter "https://example.com" → accepted
- [ ] Website field: leave empty → accepted (optional)
- [ ] Facebook: enter "facebook.com/page" → auto-prepend https:// or show error
- [ ] Instagram: enter "instagram.com/handle" → auto-prepend https:// or show error
- [ ] Twitter: enter "twitter.com/handle" → auto-prepend https:// or show error
- [ ] All social fields: leave empty → accepted (optional)
