# Admin Access Fix - Production Issue

## Problem

Admin users couldn't access `/admin` page in production. The page would load briefly then redirect to home with the error:
```
[AdminDashboard] Unauthorized access, redirecting to home
isAuthenticated: false
```

## Root Causes

### 1. **Race Condition - Auth Check Too Early**

**Issue**: Dashboard components were checking `isAuthenticated` immediately on mount, BEFORE the auth session was restored.

**Sequence**:
```
1. Admin page loads → AdminDashboardClient mounts
2. useEffect runs immediately → isAuthenticated is false (not loaded yet)
3. Redirect to / triggered
4. AuthInitializer finishes restoring session → isAuthenticated becomes true
5. Too late - already redirected!
```

**Fix**: Modified auth check to wait for auth to initialize:

```typescript
// Before (WRONG):
if (!isAuthenticated || (userType && userType !== 'admin')) {
  router.push('/');
}

// After (CORRECT):
if (isAuthenticated === false && userType) {
  // Auth has fully loaded and user is not authenticated
  router.push('/');
} else if (isAuthenticated && userType && userType !== 'admin') {
  // User is authenticated but wrong role
  router.push('/');
}
```

**Key Change**: Don't redirect if `isAuthenticated` is `false` but `userType` is not set yet (still loading).

### 2. **Admin Detection Failure**

**Issue**: Wallet detection system detected admin user as `type: 'unknown'` because it only checked `NEXT_PUBLIC_ADMIN_ADDRESSES` environment variable.

**Problem**: Admin addresses need to be in TWO places:
- **Backend**: `ADMIN_ADDRESSES` (for backend auth)
- **Frontend**: `NEXT_PUBLIC_ADMIN_ADDRESSES` (for wallet detection)

If frontend env var isn't set, admin detection fails.

**Fix**: Enhanced wallet detection to check backend API as fallback:

```typescript
// Check environment variable first
const adminAddresses = process.env.NEXT_PUBLIC_ADMIN_ADDRESSES?.split(',') || [];
if (adminAddresses.some(admin => admin.toLowerCase() === address.toLowerCase())) {
  return { type: 'admin', isRegistered: true, route: '/admin' };
}

// Fallback: Check backend API using check-user endpoint
const adminCheckResponse = await fetch(`${this.apiUrl}/auth/check-user`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address })
});
if (adminCheckResponse.ok) {
  const userData = await adminCheckResponse.json();
  if (userData.type === 'admin') {
    return { type: 'admin', isRegistered: true, route: '/admin' };
  }
}
```

## Files Changed

### 1. Dashboard Auth Checks (All 3 dashboards)

**Files**:
- `/frontend/src/components/admin/AdminDashboardClient.tsx`
- `/frontend/src/components/shop/ShopDashboardClient.tsx`
- `/frontend/src/app/(authenticated)/customer/CustomerDashboardClient.tsx`

**Change**: Updated auth protection to wait for auth initialization before redirecting.

### 2. Wallet Detection Service

**File**: `/frontend/src/services/walletDetectionService.ts`

**Changes**:
- Added backend API check for admin status as fallback
- Uses existing `/auth/check-user` endpoint
- Provides better logging

## Testing

### Verify Admin Detection

**Test 1: Check wallet detection**
```javascript
// In browser console on admin page:
const detector = WalletDetectionService.getInstance();
const result = await detector.detectWalletType('YOUR_ADMIN_ADDRESS');
console.log(result);
// Should show: { type: 'admin', isRegistered: true, route: '/admin' }
```

**Test 2: Check console logs**
```
✅ Wallet 0x... detected as admin (from environment)
OR
✅ Wallet 0x... detected as admin (from backend)
```

### Verify Auth State

**Check authStore**:
```javascript
// In browser console:
console.log({
  isAuthenticated: window.__NEXT_DATA__.props.pageProps.authState?.isAuthenticated,
  userType: window.__NEXT_DATA__.props.pageProps.authState?.userType
});
// Should show: { isAuthenticated: true, userType: 'admin' }
```

## Environment Variables

### Backend (Digital Ocean)
```bash
ADMIN_ADDRESSES=0x44a541D8d0bDA1f1e381Aa4cE82010EeC2D9644e,0xOtherAdmin...
```
**Required**: ✅ Must be set

### Frontend (Vercel)
```bash
NEXT_PUBLIC_ADMIN_ADDRESSES=0x44a541D8d0bDA1f1e381Aa4cE82010EeC2D9644e,0xOtherAdmin...
```
**Required**: ⚠️ Optional (but recommended for faster detection)

**Note**: If `NEXT_PUBLIC_ADMIN_ADDRESSES` is not set in Vercel, the system will still work by checking the backend API. However, setting it improves performance by avoiding an extra API call.

## How It Works Now

### Admin Access Flow

```
1. Admin navigates to /admin
2. AdminDashboardClient mounts
3. Auth check effect runs:
   - If isAuthenticated is undefined/null → Wait (don't redirect)
   - If isAuthenticated is false and userType is set → Redirect to /
   - If isAuthenticated is true and userType !== 'admin' → Redirect to /
   - If isAuthenticated is true and userType === 'admin' → Allow access
4. Wallet detection runs:
   - Check NEXT_PUBLIC_ADMIN_ADDRESSES env var
   - If not found, call /auth/check-user API
   - If admin found, set walletType to 'admin'
5. Page loads successfully
```

### Protection Layers

**Layer 1: Client-side (Dashboard Component)**
- Checks `isAuthenticated` and `userType`
- Redirects unauthorized users
- Waits for auth to initialize

**Layer 2: Backend API**
- All admin API endpoints check `isAdmin` or `isSuperAdmin`
- Invalid requests return 403 Forbidden
- Ultimate security boundary

## Debugging

### Issue: Still redirected to home

**Check**:
1. Is `ADMIN_ADDRESSES` set in backend env?
2. Is address exactly matching (case-insensitive)?
3. Check console for wallet detection logs

**Debug commands**:
```bash
# Backend - check if admin is in database
psql -d repaircoin -c "SELECT * FROM admins WHERE wallet_address ILIKE '0x44a541D8d0bDA1f1e381Aa4cE82010EeC2D9644e';"

# Backend - check env var
echo $ADMIN_ADDRESSES
```

### Issue: Detected as admin but still redirected

**Check**:
1. Is `isAuthenticated` becoming true?
2. Is `userType` being set to 'admin'?
3. Check auth store state in React DevTools

**Debug logs to look for**:
```
[AuthInitializer] Valid session found, restoring state without new login
[AuthInitializer] Account connected: 0x44a541D8d0bDA1f1e381Aa4cE82010EeC2D9644e
✅ Wallet 0x44a541D8d0bDA1f1e381Aa4cE82010EeC2D9644e detected as admin
```

### Issue: Wallet detection shows 'unknown'

**Solution**:
1. Add address to backend `ADMIN_ADDRESSES` env var
2. Optionally add to frontend `NEXT_PUBLIC_ADMIN_ADDRESSES` env var
3. Restart both services after env var changes

## Related Documentation

- `ROLE_BASED_ACCESS_CONTROL.md` - Dual-layer protection explanation
- `CROSS_DOMAIN_AUTH_FIX.md` - Cross-domain cookie authentication
- `COOKIE_AUTH_GUIDE.md` - Comprehensive auth guide

## Status

✅ **Fixed**: Race condition in auth check resolved
✅ **Fixed**: Admin detection enhanced with backend API fallback
✅ **Improved**: Better logging for debugging
✅ **Ready**: Production deployment safe
📝 **Note**: Ensure `ADMIN_ADDRESSES` is set in backend environment
