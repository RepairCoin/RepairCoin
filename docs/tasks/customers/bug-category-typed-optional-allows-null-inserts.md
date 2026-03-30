# Bug: Category Typed as Optional Allows NULL Database Inserts

## Status: Fixed
## Priority: Low
## Date: 2026-03-26
## Category: Bug - Type Safety
## Found by: E2E testing (code review during `bug-missing-category-validation-on-service-creation`)

---

## Problem

Three TypeScript interfaces had `category` typed as optional (`category?: string`), which meant:

1. **No compile-time enforcement** — code could omit `category` without TypeScript flagging it
2. **Repository NULL fallback** — `ServiceRepository.createService()` used `params.category || null`, silently inserting NULL into the database even when controller validation was in place
3. **Bypass risk** — any code path calling the repository directly (migrations, scripts, internal services) could insert NULL categories without hitting the controller validation

### Affected Interfaces

```typescript
// backend/src/domains/ServiceDomain/services/ServiceManagementService.ts
export interface CreateServiceRequest {
  category?: string;  // <-- BUG: should be required
}

// backend/src/repositories/ServiceRepository.ts
export interface CreateServiceParams {
  category?: string;  // <-- BUG: should be required
}

export interface ShopService {
  category?: string;  // <-- BUG: should be required for persisted entity
}
```

### Repository Fallback

```typescript
// ServiceRepository.ts line 118 (before fix)
params.category || null,  // Silently converts undefined/empty to NULL
```

---

## Root Cause

The interfaces were originally written before category validation was implemented. When the controller validation was added, the interfaces and repository were not updated to match.

---

## Fix Applied

### 1. Interfaces Updated

```typescript
// CreateServiceRequest
category: string;   // Required (was category?: string)

// CreateServiceParams
category: string;   // Required (was category?: string)

// ShopService
category: string;   // Required (was category?: string)
```

### 2. Repository Fallback Removed

```typescript
// Before:
params.category || null,

// After:
params.category,
```

### 3. TypeScript Compilation

Zero type errors after changes (`npx tsc --noEmit` passes).

---

## Verification

- [x] `CreateServiceRequest.category` is `string` (required)
- [x] `CreateServiceParams.category` is `string` (required)
- [x] `ShopService.category` is `string` (required)
- [x] `UpdateServiceParams.category` remains `string?` (optional on update — correct)
- [x] `ServiceFilters.category` remains `string?` (optional for filtering — correct)
- [x] Repository uses `params.category` without fallback
- [x] `npx tsc --noEmit` passes with zero errors
- [x] All 38 service tests pass

---

## Files Changed

- `backend/src/domains/ServiceDomain/services/ServiceManagementService.ts` — `category` required
- `backend/src/repositories/ServiceRepository.ts` — `category` required in `CreateServiceParams` and `ShopService`, removed `|| null` fallback
