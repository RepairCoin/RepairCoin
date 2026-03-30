# Bug: Invalid Mock Categories in Test Suites

## Status: Fixed
## Priority: Low
## Date: 2026-03-26
## Category: Bug - Test Data Integrity
## Found by: E2E testing (category validation live tests)

---

## Problem

Two test files used mock service data with categories that are not in the valid 12-category enum. While these are test-only mocks and don't affect production, they mask potential issues — tests pass with data that production would now reject.

### Affected Files

**`backend/tests/customer/customer.marketplace.test.ts`**

| Old Mock Category | Replacement | Context |
|---|---|---|
| `oil_change` | `automotive_services` | Main mock service + 4 filter/query uses |
| `tires` | `repairs` | Secondary mock service |
| `brakes` | `home_cleaning_services` | Third mock service |

Used in: mock service data, category filter tests, category filtering unit tests.

**`backend/tests/customer/customer.edge-cases.test.ts`**

| Old Mock Category | Replacement | Context |
|---|---|---|
| `consultation` | `professional_services` | Free service edge case mock |
| `phone_repair` | `tech_it_services` | Category filtering test (4 occurrences) |

---

## Root Cause

These test files were written before the valid categories were formalized into a shared constant. The mock data used plausible but invalid category strings.

---

## Fix Applied

1. Replaced all invalid categories with valid ones from `VALID_CATEGORIES` constant
2. Updated corresponding filter queries and assertions to use the new category names
3. Verified all 190 marketplace tests and edge-case tests pass

---

## Valid Categories (Reference)

```
repairs, beauty_personal_care, health_wellness, fitness_gyms,
automotive_services, home_cleaning_services, pets_animal_care,
professional_services, education_classes, tech_it_services,
food_beverage, other_local_services
```

Source: `backend/src/domains/ServiceDomain/constants.ts`

---

## Verification

- [x] `customer.marketplace.test.ts` — 190 tests passing
- [x] `customer.edge-cases.test.ts` — compiles and passes (4 pre-existing referral failures unrelated)
- [x] No remaining references to old categories: `grep -r "oil_change\|'tires'\|'brakes'\|consultation\|phone_repair" backend/tests/customer/` returns no matches
