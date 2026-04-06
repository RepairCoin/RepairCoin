# Bug: Missing Category Validation on Service Creation

## Status: Fixed

## Priority: Medium

## Date: 2026-03-24

## Category: Bug - Validation

## Found by: E2E testing (`backend/tests/shop/shop.services.test.ts`)

---

## Problem

The `POST /api/services` endpoint accepts services with missing or invalid categories. This breaks marketplace filtering and allows inconsistent data in the database.

### Bug 1: Missing category accepted

Creating a service without a `category` field returns **201 Created** instead of **400 Bad Request**.

```json
// Request
POST /api/services
{ "serviceName": "Test", "priceUsd": 50 }

// Expected: 400 "Category is required"
// Actual: 201 Created (service saved with null category)
```

### Bug 2: Invalid category accepted

Creating a service with an arbitrary `category` value returns **201 Created** instead of **400 Bad Request**.

```json
// Request
POST /api/services
{ "serviceName": "Test", "priceUsd": 50, "category": "fake_category" }

// Expected: 400 "Invalid category"
// Actual: 201 Created (service saved with "fake_category")
```

---

## Valid Categories

The frontend defines 12 valid categories:

```
repairs
beauty_personal_care
health_wellness
fitness_gyms
automotive_services
home_cleaning_services
pets_animal_care
professional_services
education_classes
tech_it_services
food_beverage
other_local_services
```

---

## Root Cause

The service creation controller/route does not validate the `category` field:

- No required check (allows null/undefined)
- No enum validation (allows any string value)

### Files to check:

- `backend/src/domains/ServiceDomain/controllers/ServiceController.ts` — service creation handler
- `backend/src/domains/ServiceDomain/routes.ts` — route definition for `POST /api/services`
- `backend/src/repositories/ServiceRepository.ts` — `createService()` method

---

## Fix

Add validation before inserting into the database:

```typescript
const validCategories = [
  "repairs",
  "beauty_personal_care",
  "health_wellness",
  "fitness_gyms",
  "automotive_services",
  "home_cleaning_services",
  "pets_animal_care",
  "professional_services",
  "education_classes",
  "tech_it_services",
  "food_beverage",
  "other_local_services",
];

if (!category) {
  return res
    .status(400)
    .json({ success: false, error: "Category is required" });
}

if (!validCategories.includes(category)) {
  return res.status(400).json({
    success: false,
    error: `Invalid category. Must be one of: ${validCategories.join(", ")}`,
  });
}
```

Also consider adding a `CHECK` constraint on the database column:

```sql
ALTER TABLE shop_services ADD CONSTRAINT chk_service_category
CHECK (category IN ('repairs', 'beauty_personal_care', 'health_wellness',
'fitness_gyms', 'automotive_services', 'home_cleaning_services',
'pets_animal_care', 'professional_services', 'education_classes',
'tech_it_services', 'food_beverage', 'other_local_services'));
```

---

## Impact

- Services with null or invalid categories won't appear correctly in marketplace filters
- Category-based analytics will be inaccurate
- Frontend category dropdowns won't match backend data

---

## Verification

- [ ] `POST /api/services` without category → 400 "Category is required"
- [ ] `POST /api/services` with `category: "fake"` → 400 "Invalid category"
- [ ] `POST /api/services` with valid category → 201 Created
- [ ] `PUT /api/services/:id` with invalid category → 400
- [ ] Existing services with null/invalid categories audited and fixed
