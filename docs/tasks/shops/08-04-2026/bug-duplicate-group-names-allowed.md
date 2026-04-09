# Bug: Duplicate Affiliate Group Names Allowed

## Status: Fixed (2026-04-09)
## Priority: Medium
## Date: 2026-04-08
## Category: Bug - Validation / Data Integrity
## Affected: Shop Affiliate Groups creation

---

## Overview

Shops can create multiple affiliate groups with identical names. There is no unique constraint on `group_name` in the database and no validation in the backend service. This causes confusion for customers discovering groups and for shops managing them.

---

## Evidence

Database has massive duplicates:

| Group Name | Count |
|---|---|
| My Test Group | 14 |
| Private Group Test | 14 |
| Invite Code Test | 14 |
| Public Group Test | 14 |
| Admin Test Group | 14 |
| (empty name) | 8 |

---

## Root Cause

1. **No DB constraint**: `affiliate_shop_groups` table only has `PRIMARY KEY (group_id)` — no unique constraint on `group_name`
2. **No backend validation**: `AffiliateShopGroupService.createGroup()` does not check if a group with the same name already exists
3. **No frontend validation**: `CreateGroupModal` does not check for duplicates before submitting
4. **Empty names allowed**: No minimum length validation on group name

---

## Fix Options

### Option A: Unique per shop (recommended)
A shop cannot create two groups with the same name, but different shops can have groups with the same name.

```sql
ALTER TABLE affiliate_shop_groups
ADD CONSTRAINT unique_group_name_per_shop UNIQUE (created_by_shop_id, group_name);
```

Backend validation:
```typescript
const existing = await repo.findByNameAndShop(groupName, shopId);
if (existing) throw new Error('You already have a group with this name');
```

### Option B: Globally unique
No two groups can have the same name across the entire platform.

```sql
ALTER TABLE affiliate_shop_groups
ADD CONSTRAINT unique_group_name UNIQUE (group_name) WHERE active = true;
```

### Option C: No constraint, just warn
Allow duplicates but show a warning: "A group with this name already exists. Are you sure?"

### Recommendation: Option A + minimum name length (3 characters)

---

## Additional Validation Needed

- Minimum group name length: 3 characters
- Trim whitespace before saving
- Reject empty/whitespace-only names
- Optional: sanitize special characters (XSS test groups exist with `<script>` tags)

---

## Files to Modify

| File | Change |
|------|--------|
| `backend/migrations/` | New migration: add unique constraint |
| `backend/src/services/AffiliateShopGroupService.ts` | Add name uniqueness check in `createGroup()` |
| `backend/src/repositories/AffiliateShopGroupRepository.ts` | Add `findByNameAndShop()` method |
| `frontend/src/components/shop/groups/CreateGroupModal.tsx` | Add min length validation, trim whitespace |

---

## QA Test Plan

1. Create a group "Test Group A"
2. Try creating another group with same name "Test Group A"
3. **Expected**: Error — "You already have a group with this name"
4. Different shop creates "Test Group A" → **Expected**: Allowed (unique per shop)
5. Try empty name → **Expected**: Rejected
6. Try "  " (spaces only) → **Expected**: Rejected
7. Try "AB" (2 chars) → **Expected**: Rejected (min 3)
