# localStorage Token Usage - Cleanup Required

## Current State ⚠️

After scanning the frontend codebase, I found **50+ occurrences** of localStorage/sessionStorage being used for JWT tokens across **30+ files**.

### Files Requiring Updates

#### Hooks (3 files)
- ✅ `src/hooks/useNotifications.ts` - **FIXED**
- ⚠️ `src/hooks/useAdminAuth.ts` - Needs update
- ⚠️ `src/hooks/useAdminDashboardData.ts` - Needs update

#### Components - Shop (12 files)
- `src/components/shop/ShopDashboardClient.tsx` - 5 occurrences
- `src/components/shop/SubscriptionManagement.tsx` - 5 occurrences
- `src/components/shop/tabs/RedeemTabV2.tsx` - 10 occurrences
- `src/components/shop/tabs/IssueRewardsTab.tsx` - 3 occurrences
- `src/components/shop/tabs/PromoCodesTab.tsx` - 4 occurrences
- `src/components/shop/tabs/RedeemTab.tsx` - 1 occurrence
- `src/components/shop/tabs/SettingsTab.tsx` - 2 occurrences
- `src/components/shop/tabs/ShopLocationTab.tsx` - 2 occurrences
- `src/components/shop/tabs/CustomersTab.tsx` - Uses authManager
- `src/components/shop/ManualCompleteButton.tsx` - 1 occurrence
- `src/components/shop/PurchaseSyncButton.tsx` - 1 occurrence

#### Components - Admin (3 files)
- `src/components/admin/tabs/SubscriptionManagementTab.tsx` - 5 occurrences
- `src/components/admin/tabs/PromoCodesAnalyticsTab.tsx` - 2 occurrences

#### Components - Customer (2 files)
- `src/components/customer/RedemptionApprovals.tsx` - 3 occurrences
- `src/components/customer/OverviewTab.tsx` - 1 occurrence

#### Components - Other (2 files)
- `src/components/notifications/NotificationDebug.tsx` - 4 occurrences
- `src/components/auth/DualAuthConnect.tsx` - Unknown

#### Pages (4 files)
- `src/app/(authenticated)/shop/subscription-form/page.tsx` - 3 occurrences
- `src/app/(authenticated)/shop/subscription/payment/[enrollmentId]/page.tsx` - 2 occurrences
- `src/app/(authenticated)/shop/subscription/success/page.tsx` - 3 occurrences

#### Stores (1 file)
- `src/stores/customerStore.ts` - 3 occurrences

#### Providers (1 file)
- `src/providers/AuthProvider.tsx` - Uses authManager

#### Utils (2 files)
- ✅ `src/utils/auth.ts` - **DEPRECATED** (marked with warnings)
- `src/utils/apiClient.ts` - Uses authManager

## Recommended Approach

### Phase 1: Critical Paths (Do First) ⚡
Update the most-used components that affect core functionality:

1. **`src/utils/apiClient.ts`** - If this uses tokens, many components depend on it
2. **`src/stores/customerStore.ts`** - Central state management
3. **`src/providers/AuthProvider.tsx`** - App-wide authentication
4. **`src/hooks/useAdminAuth.ts`** - Admin authentication hook

### Phase 2: High-Impact Components (Do Next) 📊
Update frequently-used components:

1. `src/components/shop/ShopDashboardClient.tsx` (5 uses)
2. `src/components/shop/SubscriptionManagement.tsx` (5 uses)
3. `src/components/shop/tabs/RedeemTabV2.tsx` (10 uses!)
4. `src/components/admin/tabs/SubscriptionManagementTab.tsx` (5 uses)

### Phase 3: Remaining Components (Clean Up) 🧹
Update all remaining files systematically.

## Migration Pattern

For each file, follow this pattern:

### **BEFORE:**
```typescript
const token = localStorage.getItem('shopAuthToken') ||
              sessionStorage.getItem('shopAuthToken');

const response = await axios.post(
  'http://localhost:4000/api/shops/data',
  data,
  {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
);
```

### **AFTER:**
```typescript
import apiClient from '@/services/api/client';

const response = await apiClient.post('/shops/data', data);
// Cookie sent automatically - no token needed!
```

## Tools Created to Help

1. **`frontend/COOKIE_AUTH_MIGRATION_GUIDE.md`**
   - Comprehensive migration patterns
   - Common pitfalls and solutions

2. **`src/utils/cookieAuth.ts`**
   - Helper functions for cookie-based auth
   - Utility to clean up legacy tokens

3. **`src/utils/legacyTokenCompat.ts`**
   - Temporary compatibility layer
   - Shows migration warnings

## Automated Detection

### Find All Token Usage:
```bash
cd frontend
grep -rn "localStorage.getItem.*Token" src/ --color
grep -rn "sessionStorage.getItem.*Token" src/ --color
grep -rn "localStorage.setItem.*Token" src/ --color
```

### Find authManager Usage:
```bash
grep -rn "authManager\." src/ --color
```

## Testing Strategy

After updating each component:

1. **Manual Test**
   - Clear localStorage: `localStorage.clear()`
   - Login to the app
   - Test the component's functionality
   - Verify no console errors about missing tokens

2. **Verify Cookie Usage**
   - DevTools → Network tab
   - Make API request
   - Check Request Headers → should see `Cookie: auth_token=...`
   - Should NOT see `Authorization: Bearer ...`

3. **Check localStorage**
   - DevTools → Application → Local Storage
   - Should be EMPTY (no tokens)

## Priority Order (Suggested)

**Week 1: Core Infrastructure**
- [ ] `src/utils/apiClient.ts`
- [ ] `src/stores/customerStore.ts`
- [ ] `src/providers/AuthProvider.tsx`
- [ ] `src/hooks/useAdminAuth.ts`
- [ ] `src/hooks/useAdminDashboardData.ts`

**Week 2: Shop Components**
- [ ] `src/components/shop/ShopDashboardClient.tsx`
- [ ] `src/components/shop/SubscriptionManagement.tsx`
- [ ] `src/components/shop/tabs/RedeemTabV2.tsx`
- [ ] `src/components/shop/tabs/IssueRewardsTab.tsx`
- [ ] `src/components/shop/tabs/PromoCodesTab.tsx`

**Week 3: Admin & Customer Components**
- [ ] `src/components/admin/tabs/SubscriptionManagementTab.tsx`
- [ ] `src/components/admin/tabs/PromoCodesAnalyticsTab.tsx`
- [ ] `src/components/customer/RedemptionApprovals.tsx`
- [ ] `src/components/customer/OverviewTab.tsx`

**Week 4: Pages & Cleanup**
- [ ] All shop subscription pages
- [ ] Remaining small components
- [ ] Remove `legacyTokenCompat.ts` (temporary file)
- [ ] Final testing

## Quick Win: Bulk Replace Pattern

For simple cases, you can use this sed command (BACKUP FIRST!):

```bash
# ALWAYS BACKUP FIRST
cp src/components/shop/SomeFile.tsx src/components/shop/SomeFile.tsx.backup

# Replace localStorage.getItem pattern
sed -i 's/localStorage\.getItem.*AuthToken.*||.*sessionStorage\.getItem.*AuthToken.*/\/\/ Token migration: use apiClient directly/g' filename.tsx
```

**⚠️ WARNING:** Only use automated replacement for simple cases. Complex logic needs manual review!

## Current Status

### ✅ Completed
- Backend cookie support
- Auth middleware (reads from cookies)
- Auth routes (set cookies)
- Logout endpoint
- Refresh endpoint
- Next.js middleware
- Frontend axios client (withCredentials: true)
- Auth services (removed localStorage)
- useNotifications hook (updated)
- Migration guides created

### ⚠️ In Progress
- Cleaning up 50+ localStorage token usages

### 📋 Remaining
- Update 30+ component files
- Test all updated components
- Remove temporary compatibility files

## Estimated Effort

- **Time to Complete**: 10-15 hours
- **Complexity**: Medium (repetitive but straightforward)
- **Risk**: Low (backward compatible, can roll back)

## Need Help?

See these files for guidance:
- `frontend/COOKIE_AUTH_MIGRATION_GUIDE.md` - How to migrate
- `frontend/AUTH_MIGRATION_SUMMARY.md` - Why we're doing this
- `frontend/TESTING_AUTH.md` - How to test

---

**Last Updated:** 2025-11-09
**Status:** Migration in progress - core infrastructure done, components need updating
