# Bug: Affiliate Group Accepts Empty Name

## Status: Fixed
## Priority: Medium
## Date: 2026-03-24
## Category: Bug - Validation
## Found by: E2E testing (`backend/tests/shop/shop.affiliate-groups.test.ts`)

---

## Problem

The `POST /api/affiliate-shop-groups` endpoint accepts groups with an empty `groupName` field, returning **201 Created** instead of **400 Bad Request**.

```json
// Request
POST /api/affiliate-shop-groups
{ "groupName": "", "customTokenName": "TestToken", "customTokenSymbol": "TT" }

// Expected: 400 "Group name is required"
// Actual: 201 Created (group saved with empty name)
```

---

## Impact

- Groups with blank names appear in the affiliate groups list with no visible name
- Breaks UI display and filtering
- Confusing for shop owners managing multiple groups
- Could cause issues with group discovery for customers

---

## Root Cause

The group creation handler does not validate that `groupName` is non-empty before inserting into the database.

### Files to check:
- `backend/src/domains/AffiliateShopGroupDomain/` — group creation controller/route
- `backend/src/services/AffiliateShopGroupService.ts` — business logic

---

## Fix

Add validation before creating the group:

```typescript
if (!groupName || groupName.trim() === '') {
  return res.status(400).json({
    success: false,
    error: 'Group name is required'
  });
}
```

Also consider:
- Minimum length (e.g., 2+ characters)
- Maximum length (e.g., 100 characters)
- Trim whitespace before saving

---

## Related Issue: groupType Field Inconsistency

When creating a group, the `groupType` field returns `null` in some environments instead of the default `'public'`. This suggests the database column may not have a proper DEFAULT constraint, or the INSERT query doesn't include `groupType` explicitly.

### Symptoms:
- Live API returns `groupType: "private"` when `isPrivate: true` is sent
- Live API returns `groupType: null` (not `"public"`) when no type is specified
- Expected: default to `"public"` when not specified

### Fix:
- Add `DEFAULT 'public'` to the `group_type` column if not already set
- Ensure the INSERT query maps `isPrivate: true` → `group_type: 'private'`

---

## Verification

- [ ] `POST /api/affiliate-shop-groups` with `groupName: ""` → 400
- [ ] `POST /api/affiliate-shop-groups` with `groupName: "  "` (whitespace only) → 400
- [ ] `POST /api/affiliate-shop-groups` with valid name → 201
- [ ] Created group without `isPrivate` → `groupType: "public"` (not null)
- [ ] Created group with `isPrivate: true` → `groupType: "private"`
