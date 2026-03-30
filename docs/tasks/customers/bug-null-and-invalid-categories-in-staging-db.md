# Bug: NULL and Invalid Categories in Staging Database

## Status: Fixed (Migration Run on Staging 2026-03-26)
## Priority: Medium
## Date: 2026-03-26
## Category: Bug - Data Integrity
## Found by: E2E testing (`backend/tests/shop/shop.category-validation.live.test.ts`)

---

## Problem

The staging database (`db-postgresql-repaircoin-staging-sg`) contains **7 services with NULL categories** and **1 service with an invalid category `"fake"`**. These services are invisible to marketplace category filters and cause inconsistent data. The same issue may also exist in production if services were created before validation was added.

### Evidence

Staging database query results (2026-03-26, host: `db-postgresql-repaircoin-staging-sg`):

```
beauty_personal_care: 21
fitness_gyms:         20
repairs:              20
health_wellness:      12
automotive_services:   7
null:                  7   <-- BUG
food_beverage:         4
other_local_services:  4
professional_services: 4
tech_it_services:      4
education_classes:     2
home_cleaning_services:2
fake:                  1   <-- BUG
pets_animal_care:      1
```

### Affected Services (NULL category)

| Service Name | Shop ID | Created |
|---|---|---|
| Test | peanut | 2026-03-23 |
| Oil Change (Test) | 3c982c25... | 2026-02-12 |
| Brake Inspection (Test) | 3c982c25... | 2026-02-12 |
| Tire Rotation (Test) | 3c982c25... | 2026-02-12 |
| Oil Change (Test) | b50db9f8... | 2026-02-12 |
| Brake Inspection (Test) | b50db9f8... | 2026-02-12 |
| Tire Rotation (Test) | b50db9f8... | 2026-02-12 |

### Affected Services (Invalid category)

| Service Name | Category | Shop ID |
|---|---|---|
| (unknown) | `fake` | (unknown) |

---

## Root Cause

The service creation endpoint (`POST /api/services`) did not validate the `category` field prior to the fix. Additionally:

1. **TypeScript interfaces** had `category` typed as optional (`category?: string`), so no compile-time enforcement existed
2. **Repository layer** used `params.category || null` fallback, silently inserting NULL when category was empty/undefined
3. **No database constraint** existed to prevent NULL or invalid values at the DB level
4. **Note**: The most recent NULL entry ("Test", 2026-03-23) was created *after* the controller validation was added, suggesting it may have been inserted through a different code path (direct DB insert, migration script, or test seeding)

---

## Impact

- **Marketplace filtering**: Services with NULL/invalid categories don't appear when customers filter by category
- **Analytics inaccuracy**: Category-based analytics reports are skewed
- **Frontend dropdowns**: Category counts in filter UI don't include these services
- **Admin dashboard**: Category breakdown charts show `null` as a separate category

---

## Fix

### Already Applied (Code)

1. **Controller validation** added in `ServiceController.ts` (lines 40-48):
   - Missing category returns `400 "Category is required"`
   - Invalid category returns `400 "Invalid category. Must be one of: ..."`
2. **TypeScript interfaces** tightened:
   - `CreateServiceRequest.category`: `string?` changed to `string`
   - `CreateServiceParams.category`: `string?` changed to `string`
   - `ShopService.category`: `string?` changed to `string`
3. **Repository**: Removed `|| null` fallback — now passes `params.category` directly
4. **Update validation**: `PUT /api/services/:id` also validates category if provided
5. **Shared constant**: `VALID_CATEGORIES` extracted to `backend/src/domains/ServiceDomain/constants.ts`

### Pending (Database Migration)

Migration file: `backend/migrations/095_add_category_check_constraint.sql`

```sql
-- Step 1: Backfill NULL/invalid categories
UPDATE shop_services
SET category = 'other_local_services'
WHERE category IS NULL
   OR category NOT IN (
     'repairs', 'beauty_personal_care', 'health_wellness', 'fitness_gyms',
     'automotive_services', 'home_cleaning_services', 'pets_animal_care',
     'professional_services', 'education_classes', 'tech_it_services',
     'food_beverage', 'other_local_services'
   );

-- Step 2: Add NOT NULL constraint
ALTER TABLE shop_services ALTER COLUMN category SET NOT NULL;

-- Step 3: Add CHECK constraint
ALTER TABLE shop_services ADD CONSTRAINT chk_service_category
CHECK (category IN (...));
```

**Migration was run on staging on 2026-03-26.** Production should be audited and migrated separately.

---

## Migration Results (Staging — 2026-03-26)

```
Step 1: Backfilling NULL/invalid categories...
  Updated: 8 rows (7 NULL + 1 "fake" → other_local_services)
Step 2: Adding NOT NULL constraint... Done
Step 3: Adding CHECK constraint... Done

NULL categories remaining: 0
other_local_services count: 4 → 12 (+8 backfilled)
CHECK constraint (chk_service_category): Active
is_nullable: NO
```

---

## Verification

- [x] `SELECT COUNT(*) FROM shop_services WHERE category IS NULL` returns `0`
- [x] `SELECT DISTINCT category FROM shop_services` shows only valid 12 categories
- [x] `POST /api/services` without category returns `400`
- [x] `POST /api/services` with `category: "fake"` returns `400`
- [x] `POST /api/services` with valid category returns `201`
- [x] CHECK constraint active — `INSERT ... NULL` will fail
- [x] CHECK constraint active — `INSERT ... 'invalid'` will fail
- [ ] Production database audited and migrated (pending — needs prod DB access)

---

## Test Coverage

| Test File | Tests | Status |
|---|---|---|
| `shop.category-validation.live.test.ts` | 17 | PASS |
| `shop.services.test.ts` (category sections) | 4 | PASS |
| `customer.marketplace.test.ts` (mock categories fixed) | 190 | PASS |
| `customer.edge-cases.test.ts` (mock categories fixed) | Compile fix | PASS |

---

## Files Changed

- `backend/src/domains/ServiceDomain/constants.ts` (NEW) — shared `VALID_CATEGORIES` constant
- `backend/src/domains/ServiceDomain/controllers/ServiceController.ts` — imports shared constant
- `backend/src/domains/ServiceDomain/services/ServiceManagementService.ts` — `category` required in interface
- `backend/src/repositories/ServiceRepository.ts` — `category` required, no NULL fallback
- `backend/migrations/095_add_category_check_constraint.sql` (NEW) — DB constraint migration
- `backend/tests/shop/shop.category-validation.live.test.ts` (NEW) — 17 E2E tests
- `backend/tests/customer/customer.marketplace.test.ts` — fixed invalid mock categories
- `backend/tests/customer/customer.edge-cases.test.ts` — fixed invalid mock categories
