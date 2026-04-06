# Bug: Create Service Fails with 400 Error on Mobile

**Status:** open
**Priority:** high
**Date:** 2026-03-30
**Platform:** Mobile (React Native / Expo)

---

## Summary

When a shop owner fills out the "Add New Service" form and taps "Create Service", the request fails with "Request failed with status code 400". The service is not created.

---

## Root Cause: Tags Double-Serialization

**File:** `mobile/shared/services/service.services.ts` (lines 94-97)

```typescript
const requestData = {
  ...serviceData,
  tags: serviceData.tags ? JSON.stringify(serviceData.tags) : undefined,
};
return await apiClient.post(`/services`, requestData);
```

The `apiClient.post()` already serializes the request body to JSON via axios. The explicit `JSON.stringify(tags)` converts the tags array `["tag1", "tag2"]` into a **string** `'["tag1","tag2"]'` *before* axios serializes the entire body. The backend receives:

```json
{
  "tags": "[\"tag1\",\"tag2\"]",  // string, NOT an array
  ...
}
```

The backend expects `tags?: string[]` (array). When `validateAndSanitizeTags()` in `ServiceManagementService.ts:49-68` calls `tags.map()` on this string, it iterates over individual characters instead of array elements, producing invalid results or throwing an error that cascades to a 400 response.

**Flow:**
1. Mobile form: user enters tags like "pricing" (comma-separated string)
2. `useServiceFormUI.ts:267-270`: splits into array `["pricing"]`
3. `service.services.ts:96`: `JSON.stringify(["pricing"])` → string `'["pricing"]'`
4. `apiClient.post()`: axios serializes body → `{ "tags": "[\"pricing\"]" }` (string in JSON)
5. Backend: `request.tags` is a string, not array → `tags.map()` fails or produces garbage
6. Database INSERT fails or validation throws → 400 error

---

## Secondary Issue: No Category Validation on Backend

**File:** `backend/src/domains/ServiceDomain/services/ServiceManagementService.ts` (lines 73-138)

The `createService()` method validates `serviceName`, `priceUsd`, `durationMinutes`, and `tags` — but **never validates `category`**. The category goes straight to the database INSERT at line 125:

```typescript
category: request.category,  // no validation
```

The database has a CHECK constraint (`chk_service_category`) and NOT NULL on the `category` column. If an invalid or missing category is sent, PostgreSQL rejects the INSERT with a constraint violation, which gets caught and returned as a generic 400 error with the database error message.

While the mobile defaults to `"repairs"` (valid) and the category picker only shows valid values, there's no backend defense if:
- Category is omitted (mobile interface marks it as `category?: string` — optional)
- An invalid value is sent via API directly

---

## Fix

### Fix 1: Remove tags double-serialization (Critical)

**File:** `mobile/shared/services/service.services.ts`

```diff
  async create(
    serviceData: CreateServiceRequest
  ): Promise<{ success: boolean; data?: ServiceData; message?: string }> {
    try {
-     const requestData = {
-       ...serviceData,
-       tags: serviceData.tags ? JSON.stringify(serviceData.tags) : undefined,
-     };
-     return await apiClient.post(`/services`, requestData);
+     return await apiClient.post(`/services`, serviceData);
    } catch (error: any) {
      console.error("Failed to create service:", error.message);
      throw error;
    }
  }
```

Axios handles JSON serialization automatically — no need to pre-stringify individual fields.

### Fix 2: Add category validation on backend (Recommended)

**File:** `backend/src/domains/ServiceDomain/services/ServiceManagementService.ts`

Add after line 110 (after duration validation):

```typescript
import { VALID_CATEGORIES } from '../constants';

// Validate category
if (!request.category) {
  throw new Error('Service category is required');
}
if (!VALID_CATEGORIES.includes(request.category as any)) {
  throw new Error(`Invalid category "${request.category}". Valid categories: ${VALID_CATEGORIES.join(', ')}`);
}
```

### Fix 3: Add category validation on mobile form (Optional improvement)

**File:** `mobile/feature/service/hooks/ui/useServiceFormUI.ts`

Add to `validateForm()` after line 190:

```typescript
if (!formData.category) {
  showError("Please select a category");
  return false;
}
```

---

## Files to Modify

1. `mobile/shared/services/service.services.ts` — Remove `JSON.stringify(tags)` (primary fix)
2. `backend/src/domains/ServiceDomain/services/ServiceManagementService.ts` — Add category validation
3. `mobile/feature/service/hooks/ui/useServiceFormUI.ts` — Add category to form validation (optional)

---

## Reproduction Steps

1. Login as a shop owner on the mobile app
2. Navigate to Services tab → tap "+" (Add Service)
3. Fill out the form:
   - Service Name: "Test Service"
   - Category: "Food & Beverage"
   - Description: "Test description"
   - Price: any value > 0
4. Tap "Create Service"
5. Red error toast: "Request failed with status code 400"
6. Service is NOT created

---

## Additional Notes

- The same `JSON.stringify(tags)` bug does NOT exist in the `update()` method — `service.services.ts:108` sends `updates` directly without stringifying tags
- The `durationMinutes` is hardcoded to `30` in `useServiceFormUI.ts:277` — not a bug per se, but the form has no duration input field
- The `INITIAL_FORM_DATA` defaults category to `"repairs"` which is valid, so category is unlikely to be the primary cause unless the user somehow clears it
