# Bug: Shop registration accepts invalid website and protocol-less social URLs

**Status:** Completed
**Priority:** Medium
**Est. Effort:** 30 minutes
**Created:** 2026-04-16
**Updated:** 2026-04-16
**Completed:** 2026-04-16

## Problem

Two URL-related issues in the shop registration flow:

1. **Website had no validation.** The Website URL field on the Business Info slide accepted any string, including obvious garbage like `SD` or `abc`.
2. **Social media URLs could be saved without a protocol.** Values like `facebook.com/yourpage` passed validation but would not work as clickable links when displayed to customers.

## Analysis

### Root causes

- **Website:** `SecondSlide.tsx`'s `validateAndProceed` only called `validateShopSecondSlide(name, companySize, monthlyRevenue)` — the `website` field was never passed and never checked.
- **Social URLs:** `isValidUrl` in `utils/validation.ts` used a regex that made `https?://` optional, so `facebook.com/page` passed. Even after validation, the raw string was persisted to the backend with no protocol, making the stored URL unusable as a real link.

## Implementation

### Files modified

- `mobile/feature/register/utils/validation.ts`
  - Added `normalizeUrl(url)` helper that prepends `https://` when a value looks like a URL (contains a `.`) but has no protocol. Returns empty string for blank input; returns non-URL strings (e.g. `SD`) untouched so `isValidUrl` can still reject them.
  - Extended `validateShopSecondSlide` with an optional `website` parameter. When provided, validates using the existing `isValidUrl` regex.
  - Kept `isValidUrl`'s regex permissive (accepts protocol-less inputs) since user-typed values are normalized before storage; this keeps the validator friendly to the most common typing pattern.

- `mobile/feature/register/components/SecondSlide.tsx`
  - `validateAndProceed` now passes `formData.website` to `validateShopSecondSlide`, so garbage like `SD` is rejected before the user can proceed.

- `mobile/feature/register/hooks/ui/useShopRegister.ts`
  - Imported `normalizeUrl` and applied it to `website`, `facebook`, `instagram`, and `twitter` in the submission payload so the backend only ever receives URLs with a protocol (or empty strings).

### Approach

Minimal surface change following Option B from the bug report (auto-prepend on submission) rather than forcing users to type `https://` explicitly. That preserves the common-case UX while guaranteeing the stored values are openable links.

## Verification Checklist

- [x] Website field: enter `SD` → validation error shown, cannot proceed
- [x] Website field: enter `example.com` → proceeds; submitted as `https://example.com`
- [x] Website field: enter `https://example.com` → proceeds unchanged
- [x] Website field: leave empty → accepted (optional)
- [x] Facebook / Instagram / Twitter with bare domains (`facebook.com/page`) → submitted as `https://facebook.com/page`
- [x] All social fields: leave empty → accepted (optional)
- [x] Existing valid URLs with `https://` already set → unchanged

## Notes

- **Why not tighten `isValidUrl`'s regex to require a protocol:** Users naturally type `facebook.com/page`. Rejecting that at the UI would create friction with no user benefit, since `normalizeUrl` at submission time produces a fully-formed URL anyway.
- **Edge cases handled:** Empty strings stay empty (no `https://` prepended), strings without a `.` (e.g. `SD`) are not mutated so the website validator can still flag them, and URLs that already start with `http://` are preserved (not force-upgraded).
- **Not in scope:** Customer-side URL fields (none currently exist in the customer registration form). Profile-edit screens that may also accept URLs — should receive the same treatment in a follow-up.
