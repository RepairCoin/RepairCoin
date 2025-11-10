# API Client Cleanup Summary

## Overview
Removed the unused `frontend/src/utils/apiClient.ts` file to prevent confusion and ensure the codebase uses a single, standardized API client.

---

## Changes Made

### ✅ 1. Updated AdminsTab.tsx
**File**: `frontend/src/components/admin/tabs/AdminsTab.tsx`

**Changed import:**
```typescript
// Before
import apiClient from "@/utils/apiClient";

// After
import apiClient from "@/services/api/client";
```

**Fixed API calls** (removed deprecated `role` parameter):
```typescript
// Before
await apiClient.get("/admin/admins", { role: "admin" });
await apiClient.post("/admin/admins/create", formData, { role: "admin" });
await apiClient.put(`/admin/admins/${address}`, formData, { role: "admin" });
await apiClient.delete(`/admin/admins/${address}`, { role: "admin" });

// After
await apiClient.get("/admin/admins");
await apiClient.post("/admin/admins/create", formData);
await apiClient.put(`/admin/admins/${address}`, formData);
await apiClient.delete(`/admin/admins/${address}`);
```

**Why:**
- The old `utils/apiClient.ts` had a custom `role` option for auth
- The axios client (`services/api/client.ts`) automatically handles auth via cookies + headers
- No need for manual role specification

---

### ✅ 2. Removed Unused File
**Deleted**: `frontend/src/utils/apiClient.ts`

**Reason:**
- This file was a custom fetch-based API client
- It was superseded by the axios-based client in `services/api/client.ts`
- Only one component (AdminsTab) was still using it
- Keeping both clients caused confusion and inconsistency

---

## Benefits

### 🎯 Single Source of Truth
- **Before**: Two different API clients with different interfaces
- **After**: One standardized axios-based client used everywhere

### 🔒 Consistent Authentication
- All API calls now use the same auth mechanism:
  - Cookies sent via `withCredentials: true`
  - Authorization header extracted from cookie as backup
  - Consistent error handling

### 🛡️ Better Error Handling
- Axios interceptors provide standardized error handling
- Automatic 401 redirect to home page
- User-friendly error messages

### 📝 Cleaner Code
- No confusion about which client to import
- Consistent API call patterns across codebase
- Easier for new developers to understand

---

## API Client Architecture

### Current (Correct) Pattern
```typescript
import apiClient from "@/services/api/client";

// GET request
const response = await apiClient.get("/endpoint");
// response = { success: true, data: {...} }

// POST request
const response = await apiClient.post("/endpoint", data);

// PUT request
const response = await apiClient.put("/endpoint", data);

// DELETE request
const response = await apiClient.delete("/endpoint");
```

### How It Works
```
1. Component makes request
   ↓
2. Axios request interceptor:
   - Extracts token from cookie
   - Adds Authorization: Bearer header
   - Sends request with both cookie + header
   ↓
3. Backend receives request:
   - Checks cookie first
   - Falls back to Authorization header
   - Verifies JWT token
   ↓
4. Axios response interceptor:
   - Returns response.data (unwraps axios response)
   - Handles 401 errors
   - Provides user-friendly error messages
   ↓
5. Component receives:
   { success: true, data: {...} }
```

---

## Files Changed

### Modified
1. ✅ `frontend/src/components/admin/tabs/AdminsTab.tsx`
   - Updated import to use correct API client
   - Removed deprecated `role` parameter from API calls
   - Updated error handling

### Deleted
1. ✅ `frontend/src/utils/apiClient.ts`
   - Removed unused custom API client
   - Prevented future confusion

---

## Testing

### Build Verification
```bash
npm run build
# ✅ Build successful
# No errors related to missing imports
```

### What Was Tested
- ✅ Frontend builds successfully
- ✅ No import errors
- ✅ AdminsTab uses correct API client
- ✅ No other components importing old client

### What to Test in Production
- [ ] Admin dashboard → Admins tab loads correctly
- [ ] Creating new admin works
- [ ] Updating admin works
- [ ] Deleting admin works
- [ ] Error messages display correctly

---

## Migration Complete

All components now use the standardized axios-based API client:

**Location**: `frontend/src/services/api/client.ts`

**Features**:
- ✅ Cookie-based authentication
- ✅ Authorization header backup
- ✅ Automatic error handling
- ✅ Consistent response format
- ✅ Type-safe (TypeScript)

**Used by**:
- All domain-specific API services (`services/api/*.ts`)
- All components making direct API calls
- All hooks making API requests

---

## Future Guidelines

### ✅ DO: Use the Axios Client
```typescript
import apiClient from "@/services/api/client";
const response = await apiClient.get("/endpoint");
```

### ❌ DON'T: Create Custom API Clients
- Don't create new fetch wrappers
- Don't bypass the standard client
- Don't store tokens in localStorage

### 🎯 Best Practices
1. Import from `@/services/api/client`
2. Use standardized methods: `get`, `post`, `put`, `delete`
3. Handle errors with try/catch
4. Let interceptors handle auth automatically

---

## Rollback Plan

If issues arise with AdminsTab:

### Quick Fix
```typescript
// Temporarily restore old behavior by handling errors differently
try {
  const response = await apiClient.get("/admin/admins");
  setAdmins(response.data || []);
} catch (error: any) {
  // Log full error for debugging
  console.error("Full error:", error);
  showToast.error(error.message || "Failed to fetch admins");
}
```

### Full Rollback
1. Restore `utils/apiClient.ts` from git history
2. Revert changes to `AdminsTab.tsx`
3. Investigate root cause before trying again

---

## Success Criteria

✅ **Completed**:
- [x] Removed unused API client file
- [x] Updated AdminsTab to use correct client
- [x] Verified build succeeds
- [x] No import errors
- [x] Consistent API patterns across codebase

📋 **To Verify in Production**:
- [ ] AdminsTab functionality works
- [ ] No console errors
- [ ] Auth works correctly
- [ ] Error messages are user-friendly
