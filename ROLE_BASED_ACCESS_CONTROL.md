# Role-Based Access Control - Dual Layer Protection

## Overview

RepairCoin implements a **dual-layer security model** for role-based access control:

1. **Layer 1: Middleware (Server-side)** - Works in localhost, may not work in production cross-domain
2. **Layer 2: Client-side React Components** - Works everywhere, provides UX protection

## Why Dual-Layer?

### The Cross-Domain Cookie Problem

**Development (Localhost)**:
- Frontend: `localhost:3001`
- Backend: `localhost:4000`
- Same root domain → Middleware CAN read httpOnly cookies ✅

**Production (Cross-Domain)**:
- Frontend: `repaircoin.ai` (Vercel)
- Backend: `repaircoin-staging-s7743.ondigitalocean.app` (Digital Ocean)
- Different domains → Middleware CANNOT read httpOnly cookies from backend ❌

### The Solution

Since middleware may not have access to cookies in production, we use **client-side protection as the primary enforcement layer**, with middleware providing additional protection when cookies are available (localhost).

## Security Layers

### Layer 1: Middleware Role-Based Access Control

**File**: `/frontend/src/middleware.ts`

**How it works**:
```typescript
// Only runs if middleware can read the auth_token cookie
if (authToken && isProtectedRoute) {
  const decoded = decodeJWT(authToken);
  const userRole = decoded?.role?.toLowerCase();

  // Define role-based route mappings
  const roleRouteMap: Record<string, string[]> = {
    customer: ['/customer', '/dashboard'],
    shop: ['/shop'],
    admin: ['/admin'],
    super_admin: ['/admin']
  };

  // Check if user has access to the current route
  if (userRole && roleRouteMap[userRole]) {
    const allowedRoutes = roleRouteMap[userRole];
    const hasAccess = allowedRoutes.some(route => pathname.startsWith(route));

    if (!hasAccess) {
      // Redirect to user's appropriate dashboard
      const redirectUrl = redirectMap[userRole] || '/';
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
  }
}
```

**Status**:
- ✅ **Enabled** - Still active in middleware
- ✅ **Works in localhost** - Can read cookies
- ⚠️ **May not work in production** - Cross-domain cookie issue
- 🛡️ **Additional security layer** - Defense in depth

### Layer 2: Client-Side Component Protection (Primary)

**Files**:
- `/frontend/src/components/shop/ShopDashboardClient.tsx`
- `/frontend/src/app/(authenticated)/customer/CustomerDashboardClient.tsx`
- `/frontend/src/components/admin/AdminDashboardClient.tsx`

**How it works**:
```typescript
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

export default function ShopDashboardClient() {
  const router = useRouter();
  const { isAuthenticated, userType } = useAuthStore();

  // Client-side auth protection
  useEffect(() => {
    // If not authenticated or wrong role, redirect to landing page
    if (!isAuthenticated || (userType && userType !== 'shop')) {
      console.log('[ShopDashboard] Unauthorized access, redirecting to home');
      router.push('/');
    }
  }, [isAuthenticated, userType, router]);

  // ... rest of component
}
```

**Status**:
- ✅ **Enabled** - Active in all dashboard components
- ✅ **Works everywhere** - Localhost and production
- 🛡️ **Primary protection** - Main enforcement layer

### Layer 3: Backend API Validation (Ultimate Security)

**Files**: `/backend/src/middleware/auth.ts`, all API routes

**How it works**:
- Every API request validates the `auth_token` cookie
- Backend reads httpOnly cookies directly (not affected by cross-domain)
- Invalid/missing token → 401 Unauthorized
- Wrong role → 403 Forbidden

**Status**:
- ✅ **Always active** - Backend always validates
- 🛡️ **Ultimate security** - Cannot be bypassed
- 🔐 **Primary security boundary** - This is the real protection

## Role Mappings

### Customer Role
**Allowed Routes**:
- `/customer` - Customer dashboard
- `/dashboard` - Legacy dashboard route

**Restricted From**:
- `/shop` - Shop dashboard
- `/admin` - Admin dashboard

**Protection**:
- Middleware: Redirects to `/customer` if trying to access `/shop` or `/admin`
- Client-side: `CustomerDashboardClient` checks `userType === 'customer'`
- Backend: API validates role on every request

### Shop Role
**Allowed Routes**:
- `/shop` - Shop dashboard

**Restricted From**:
- `/customer` - Customer dashboard
- `/admin` - Admin dashboard

**Protection**:
- Middleware: Redirects to `/shop` if trying to access `/customer` or `/admin`
- Client-side: `ShopDashboardClient` checks `userType === 'shop'`
- Backend: API validates role on every request

### Admin Role
**Allowed Routes**:
- `/admin` - Admin dashboard

**Restricted From**:
- `/customer` - Customer dashboard
- `/shop` - Shop dashboard

**Protection**:
- Middleware: Redirects to `/admin` if trying to access `/customer` or `/shop`
- Client-side: `AdminDashboardClient` checks `userType === 'admin'`
- Backend: API validates role on every request

### Super Admin Role
**Allowed Routes**:
- `/admin` - Admin dashboard (same as admin, with elevated permissions on backend)

**Restricted From**:
- `/customer` - Customer dashboard
- `/shop` - Shop dashboard

**Protection**:
- Middleware: Redirects to `/admin` if trying to access `/customer` or `/shop`
- Client-side: `AdminDashboardClient` checks `userType === 'admin'` (super_admin treated as admin on frontend)
- Backend: API validates role and provides additional permissions for super_admin

## Testing Role-Based Access Control

### Test Scenarios

#### Scenario 1: Customer Trying to Access Shop Dashboard
**Steps**:
1. Login as customer
2. Try to navigate to `/shop` URL directly

**Expected Behavior**:
- **Localhost**: Middleware intercepts → redirects to `/customer`
- **Production**: Page loads briefly → Client-side check redirects to `/`
- Console log: `[ShopDashboard] Unauthorized access, redirecting to home`

#### Scenario 2: Shop Trying to Access Admin Dashboard
**Steps**:
1. Login as shop
2. Try to navigate to `/admin` URL directly

**Expected Behavior**:
- **Localhost**: Middleware intercepts → redirects to `/shop`
- **Production**: Page loads briefly → Client-side check redirects to `/`
- Console log: `[AdminDashboard] Unauthorized access, redirecting to home`

#### Scenario 3: Unauthenticated User Trying to Access Any Dashboard
**Steps**:
1. Not logged in
2. Try to navigate to `/shop`, `/customer`, or `/admin`

**Expected Behavior**:
- **Localhost**: Middleware intercepts → redirects to `/`
- **Production**: Page loads briefly → Client-side check redirects to `/`
- Console logs from respective dashboard components

### Debug Console Logs

**Middleware logs** (only in localhost with valid cookies):
```
[Middleware] Protected route access: {
  pathname: '/shop',
  hasAuthToken: true,
  authTokenPreview: 'eyJhbGciOiJIUzI1NiIs...',
  allCookies: [ 'auth_token', 'refresh_token' ]
}

[Middleware] Role-based access check: {
  pathname: '/shop',
  userRole: 'customer',
  hasRole: true
}

[Middleware] Role mismatch - redirecting: {
  userRole: 'customer',
  attemptedPath: '/shop',
  redirectTo: '/customer'
}
```

**Client-side logs** (everywhere):
```
[ShopDashboard] Unauthorized access, redirecting to home
[CustomerDashboard] Unauthorized access, redirecting to home
[AdminDashboard] Unauthorized access, redirecting to home
```

## Implementation Checklist

### ✅ Completed
- [x] Middleware role-based access control (active when cookies available)
- [x] Client-side protection in ShopDashboardClient
- [x] Client-side protection in CustomerDashboardClient
- [x] Client-side protection in AdminDashboardClient
- [x] Backend API validation (always active)
- [x] Debug logging in middleware and components

### 🔄 To Test
- [ ] Customer cannot access shop dashboard
- [ ] Customer cannot access admin dashboard
- [ ] Shop cannot access customer dashboard
- [ ] Shop cannot access admin dashboard
- [ ] Admin cannot access customer dashboard
- [ ] Admin cannot access shop dashboard
- [ ] Unauthenticated users redirected from all protected routes

## Security Notes

### Why Client-Side Protection is Safe

**Concern**: "Can't users bypass client-side checks?"

**Answer**: Yes, but it doesn't matter because:

1. **Backend validation is the real security** - All API calls are validated
2. **Client-side is for UX** - Prevents users from seeing pages they shouldn't
3. **No data leakage** - Dashboard components won't load data without valid API responses
4. **Backend refuses invalid requests** - Even if user bypasses client-side, backend returns 401/403

**Example Attack**:
```
1. Customer bypasses client-side check and loads /shop page
2. Shop page tries to fetch shop data from API
3. Backend validates auth_token → sees role is 'customer'
4. Backend returns 403 Forbidden
5. No shop data is exposed
```

### Defense in Depth

Our security model uses multiple layers:

```
┌─────────────────────────────────────────┐
│  Layer 1: Middleware (when available)   │ ← Server-side, pre-render
├─────────────────────────────────────────┤
│  Layer 2: Client-side Component Checks  │ ← UX protection, immediate feedback
├─────────────────────────────────────────┤
│  Layer 3: Backend API Validation        │ ← Ultimate security, always enforced
└─────────────────────────────────────────┘
```

Each layer provides protection, but **Layer 3 (Backend) is the critical security boundary**.

## Troubleshooting

### Issue: Users can still access wrong dashboard

**Check**:
1. Are console logs showing unauthorized access?
2. Is `isAuthenticated` and `userType` correctly set in authStore?
3. Is the redirect happening but being reversed somehow?

**Debug**:
```typescript
// Add this to dashboard component
useEffect(() => {
  console.log('Auth state:', { isAuthenticated, userType });
}, [isAuthenticated, userType]);
```

### Issue: Middleware not catching role mismatches in localhost

**Check**:
1. Are cookies being set correctly?
2. Check browser DevTools → Application → Cookies → `auth_token`
3. Check middleware console logs

**Debug**:
- Look for `[Middleware] Role-based access check` logs
- Verify `hasAuthToken: true` in logs

### Issue: Infinite redirect loops

**Check**:
1. Is client-side protection redirecting to a page that also has protection?
2. Is middleware and client-side fighting each other?

**Fix**:
- Client-side always redirects to `/` (landing page)
- Landing page doesn't have protection (public route)
- This breaks any redirect loops

## Related Files

| File | Purpose | Role Check Type |
|------|---------|-----------------|
| `frontend/src/middleware.ts` | Server-side route protection | Role-based (when cookies available) |
| `frontend/src/components/shop/ShopDashboardClient.tsx` | Shop dashboard | Client-side (`userType === 'shop'`) |
| `frontend/src/app/(authenticated)/customer/CustomerDashboardClient.tsx` | Customer dashboard | Client-side (`userType === 'customer'`) |
| `frontend/src/components/admin/AdminDashboardClient.tsx` | Admin dashboard | Client-side (`userType === 'admin'`) |
| `backend/src/middleware/auth.ts` | API authentication | Server-side (JWT validation) |
| `backend/src/middleware/permissions.ts` | API authorization | Server-side (role validation) |

## Status

✅ **Implemented**: Dual-layer role-based access control
✅ **Working**: Client-side protection active on all dashboards
✅ **Enhanced**: Middleware role checks still active (when cookies available)
✅ **Secure**: Backend API validation always enforced
📝 **Ready for Testing**: Need to verify all role mismatch scenarios
