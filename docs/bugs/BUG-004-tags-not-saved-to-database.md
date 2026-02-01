# BUG-004: Service tags are not saved to database

**Type:** Bug
**Severity:** High
**Priority:** P1
**Component:** Backend - Service Management
**Labels:** bug, backend, data-loss, critical
**Status:** FIXED ✅
**Date Fixed:** December 2025

---

## Description

Service tags entered in the Create/Edit Service modal are NOT being saved to the database. The `tags` field is missing from both `CreateServiceRequest` and `UpdateServiceRequest` interfaces in `ServiceManagementService.ts`, causing tags to be silently dropped during service creation and updates.

---

## Steps to Reproduce

1. Login as a shop owner with active subscription
2. Navigate to Shop Dashboard → Services tab
3. Click "Create New Service" button
4. Fill in required fields (name: "test tag", category: "Beauty & Personal Care", price: $32.98)
5. In the "Discovery" section, add tags: "tag1", "tag 2", "tag 3"
6. Observe tags display in Live Preview (shows correctly)
7. Click "Create Service" to save
8. Go to Customer side → Marketplace → View the service details
9. Notice: NO tags displayed
10. Return to Shop side → Edit the service
11. Notice: Tags section is EMPTY - tags were never saved

---

## Expected Result

- Tags entered during service creation should be saved to database
- Tags should display on customer-facing service cards and details
- Tags should persist when editing the service
- Tags should be searchable in marketplace discovery

---

## Actual Result

- Tags appear in Live Preview during creation (frontend state)
- Tags are NOT sent to backend or are dropped before database insert
- Tags do NOT display on customer side
- Tags are EMPTY when editing the service
- Tags are lost permanently after form submission

---

## Root Cause Analysis

**File:** `backend/src/domains/ServiceDomain/services/ServiceManagementService.ts`

### Issue 1: CreateServiceRequest missing `tags` (Lines 8-16)
```typescript
export interface CreateServiceRequest {
  shopId: string;
  serviceName: string;
  description?: string;
  priceUsd: number;
  durationMinutes?: number;
  category?: string;
  imageUrl?: string;
  // ❌ MISSING: tags?: string[];
}
```

### Issue 2: createService params missing `tags` (Lines 68-77)
```typescript
const params: CreateServiceParams = {
  serviceId,
  shopId: request.shopId,
  serviceName: request.serviceName,
  description: request.description,
  priceUsd: request.priceUsd,
  durationMinutes: request.durationMinutes,
  category: request.category,
  imageUrl: request.imageUrl
  // ❌ MISSING: tags: request.tags
};
```

### Issue 3: UpdateServiceRequest missing `tags` (Lines 18-26)
```typescript
export interface UpdateServiceRequest {
  serviceName?: string;
  description?: string;
  priceUsd?: number;
  durationMinutes?: number;
  category?: string;
  imageUrl?: string;
  active?: boolean;
  // ❌ MISSING: tags?: string[];
}
```

### Issue 4: updateService params missing `tags` (Lines 178-186)
```typescript
const params: UpdateServiceParams = {
  serviceName: updates.serviceName,
  description: updates.description,
  priceUsd: updates.priceUsd,
  durationMinutes: updates.durationMinutes,
  category: updates.category,
  imageUrl: updates.imageUrl,
  active: updates.active
  // ❌ MISSING: tags: updates.tags
};
```

---

## Screenshots

**Screenshot 1 (sc1.png):** Create Service modal showing tags "tag1", "tag 2", "tag 3" in form and Live Preview

**Screenshot 2 (sc2.png):** Customer Service Details - NO tags visible

**Screenshot 3 (sc3.png):** Edit Service modal - Tags section is EMPTY (data was never saved)

---

## Acceptance Criteria

- [ ] Add `tags?: string[]` to `CreateServiceRequest` interface
- [ ] Add `tags: request.tags` to createService params object
- [ ] Add `tags?: string[]` to `UpdateServiceRequest` interface
- [ ] Add `tags: updates.tags` to updateService params object
- [ ] Verify tags are saved to database on create
- [ ] Verify tags are updated in database on edit
- [ ] Verify tags display on customer service cards
- [ ] Verify tags display in service details modal
- [ ] Verify tags persist when editing service

---

## Technical Fix

**File:** `backend/src/domains/ServiceDomain/services/ServiceManagementService.ts`

### Fix 1: Update CreateServiceRequest interface
```typescript
export interface CreateServiceRequest {
  shopId: string;
  serviceName: string;
  description?: string;
  priceUsd: number;
  durationMinutes?: number;
  category?: string;
  imageUrl?: string;
  tags?: string[];  // ADD THIS
}
```

### Fix 2: Update createService params
```typescript
const params: CreateServiceParams = {
  serviceId,
  shopId: request.shopId,
  serviceName: request.serviceName,
  description: request.description,
  priceUsd: request.priceUsd,
  durationMinutes: request.durationMinutes,
  category: request.category,
  imageUrl: request.imageUrl,
  tags: request.tags  // ADD THIS
};
```

### Fix 3: Update UpdateServiceRequest interface
```typescript
export interface UpdateServiceRequest {
  serviceName?: string;
  description?: string;
  priceUsd?: number;
  durationMinutes?: number;
  category?: string;
  imageUrl?: string;
  active?: boolean;
  tags?: string[];  // ADD THIS
}
```

### Fix 4: Update updateService params
```typescript
const params: UpdateServiceParams = {
  serviceName: updates.serviceName,
  description: updates.description,
  priceUsd: updates.priceUsd,
  durationMinutes: updates.durationMinutes,
  category: updates.category,
  imageUrl: updates.imageUrl,
  active: updates.active,
  tags: updates.tags  // ADD THIS
};
```

---

## Impact

| Area | Impact |
|------|--------|
| **Data Loss** | All tags entered by users are permanently lost |
| **Search/Discovery** | Tag-based search returns no results |
| **Similar Services** | Algorithm cannot match by tags (always 0 points) |
| **User Experience** | Users waste time adding tags that don't save |
| **Customer Experience** | Cannot filter or discover services by tags |

---

## Related Files

| File | Status |
|------|--------|
| `backend/src/domains/ServiceDomain/services/ServiceManagementService.ts` | ❌ BUG - Missing tags |
| `backend/src/repositories/ServiceRepository.ts` | ✅ OK - Handles tags correctly |
| `frontend/src/components/shop/modals/CreateServiceModal.tsx` | ✅ OK - Sends tags |
| `frontend/src/services/api/services.ts` | ✅ OK - Includes tags in request |
