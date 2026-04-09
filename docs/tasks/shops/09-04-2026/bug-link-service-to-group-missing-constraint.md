# Bug: Linking Service to Group Fails — Missing Unique Constraint

## Status: Fixed (2026-04-09)
## Priority: High
## Date: 2026-04-09
## Category: Bug - Database / Service-Group Linking
## Affected: Shop service → Group Rewards → Link Service

---

## Overview

Linking a service to an affiliate group fails with: "there is no unique or exclusion constraint matching the ON CONFLICT specification". The `service_group_availability` table had no constraints or indexes at all.

---

## Root Cause

**Repository** (`ServiceRepository.ts` line 637):
```sql
INSERT INTO service_group_availability (...)
VALUES (...)
ON CONFLICT (service_id, group_id)  -- requires unique constraint
DO UPDATE SET ...
```

**Database**: `service_group_availability` table had zero constraints and zero indexes. The `ON CONFLICT` clause requires a unique constraint on `(service_id, group_id)` to work.

---

## Fix Applied

**Migration** `099_add_service_group_availability_constraint.sql`:
- Added `UNIQUE (service_id, group_id)` constraint
- Added indexes on `group_id`, `service_id`, and `active` for performance
- Applied directly to staging database

**Also fixed**: `ServiceGroupSettings.tsx` now shows actual backend error messages instead of generic "Make sure you are an active member"

---

## Files Changed

| File | Change |
|------|--------|
| `backend/migrations/099_add_service_group_availability_constraint.sql` | New migration — unique constraint + indexes |
| `frontend/src/components/shop/ServiceGroupSettings.tsx` | Show actual backend error in alert |

---

## QA Test Plan

1. Login as shop → open a service → Group Rewards tab
2. Click "Link Service" on a group you're a member of
3. **Before fix**: "there is no unique or exclusion constraint" error
4. **After fix**: Service linked successfully
5. Try linking same service again → "already linked" (409, handled correctly)
