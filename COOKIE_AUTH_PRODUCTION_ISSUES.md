# Cookie Authentication Production Issues - Root Cause Analysis

## Environment
- **Backend**: Digital Ocean (repaircoin-staging-s7743.ondigitalocean.app)
- **Frontend**: Vercel (https://www.repaircoin.ai/)
- **Issue**: Cookie authentication not working in production, causing infinite redirect loops

## Critical Issues Identified

### 🔴 ISSUE #1: TWO DIFFERENT API CLIENTS (Critical - Causing API failures)

The codebase has **TWO separate API clients** that work differently:

1. **`frontend/src/utils/apiClient.ts`** (Custom fetch-based)
   - Returns `{ success: boolean, data?: any, error?: string }`
   - Uses `credentials: 'include'`
   - ❌ **NOT BEING USED** by most components

2. **`frontend/src/services/api/client.ts`** (Axios-based)
   - Uses axios with `withCredentials: true`
   - Returns `response.data` directly (unwrapped)
   - ✅ **ACTUALLY USED** by components

**THE PROBLEM:**
- Components import from `@/services/api/client` (axios)
- Axios returns data directly: `response.data`
- But code tries to access `response.success` which doesn't exist on axios responses
- This causes TypeScript errors and runtime failures

**Example of broken code:**
```typescript
// In ShopDashboardClient.tsx line 301
const shopResult = await apiClient.get(`/shops/wallet/${account?.address}`);
if (shopResult.success && shopResult.data) { // ❌ .success doesn't exist on axios!
```

**Axios responses look like:**
```typescript
{
  data: { success: true, data: {...} },  // Backend response
  status: 200,
  statusText: 'OK',
  headers: {...}
}
```

**But the interceptor in `services/api/client.ts` returns `response.data`**, so you get:
```typescript
{
  success: true,
  data: {...}
}
```

---

### 🔴 ISSUE #2: Protected Routes Need Authorization Header (Critical)

**Backend middleware** (`backend/src/middleware/auth.ts`) expects JWT token from:
1. `req.cookies.auth_token` (preferred)
2. `Authorization: Bearer <token>` header (fallback)

**Frontend API clients** only send cookies, no Authorization header:
```typescript
// services/api/client.ts line 13-16
apiClient.interceptors.request.use((config) => {
  // Cookies are automatically sent by the browser
  // No manual token management needed
  return config;
});
```

**THE PROBLEM:**
When cookies fail (cross-origin, browser blocking, etc.), there's **NO FALLBACK**.
Protected API routes return 401, but the frontend has no way to retry with a Bearer token.

---

### 🔴 ISSUE #3: Cookie Configuration Issues

**Backend sets cookies correctly** (`backend/src/routes/auth.ts` line 16-28):
```typescript
const cookieOptions = {
  httpOnly: true,
  secure: true,           // ✅ Required for HTTPS
  sameSite: 'none',       // ✅ Required for cross-origin
  maxAge: 24 * 60 * 60 * 1000,
  path: '/',
  // ❌ No domain set (correct for cross-origin)
};
```

**CORS is configured** (`backend/src/app.ts` line 90-132):
```typescript
cors({
  origin: [
    'https://repaircoin.ai',
    'https://www.repaircoin.ai',
    // + *.ondigitalocean.app
    // + *.vercel.app
  ],
  credentials: true  // ✅ Allows cookies
})
```

**However:**
- Cookies with `sameSite: 'none'` require `secure: true` ✅ (present)
- Cross-origin cookies may be blocked by browser privacy settings
- Safari/iOS aggressively blocks cross-site cookies

---

### 🔴 ISSUE #4: Infinite Redirect Loop

**Frontend middleware** (`frontend/src/middleware.ts` line 56-61) redirects unauthenticated users:
```typescript
if (isProtectedRoute && !authToken) {
  const homeUrl = new URL('/', request.url);
  homeUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(homeUrl);
}
```

**Landing page** (`frontend/src/app/page.tsx` line 24-39) auto-redirects registered users:
```typescript
React.useEffect(() => {
  if (account && isRegistered && !isDetecting && walletType !== 'unknown') {
    router.push("/admin"); // or /shop, /customer
  }
}, [account, isRegistered, isDetecting, walletType, router]);
```

**THE LOOP:**
1. User lands on `/admin` without cookie
2. Middleware redirects to `/`
3. Landing page detects registered user, redirects to `/admin`
4. Go to step 1 → **INFINITE LOOP**

**Why it happens:**
- `useWalletDetection()` calls `/auth/check-user` which doesn't require auth
- So `isRegistered = true` even without valid auth cookie
- But middleware blocks dashboard access without cookie
- Result: Redirect loop

---

### 🟡 ISSUE #5: Auth Flow Inconsistency

**Current flow:**
1. User connects wallet
2. `AuthContext.login()` calls `/auth/{role}` to set cookie
3. Components make API calls expecting cookie to be set

**Problems:**
- If cookie fails to set, user is "logged in" (has profile) but API calls fail with 401
- No error handling for cookie failures
- No way to detect if cookie was actually set

---

## Root Cause Summary

| Issue | Severity | Impact |
|-------|----------|--------|
| Two different API clients with incompatible interfaces | 🔴 Critical | API calls fail, TypeScript errors |
| No Authorization header fallback | 🔴 Critical | All API calls fail if cookies blocked |
| Cross-origin cookie blocking | 🔴 Critical | Cookies may not work in Safari/iOS |
| Infinite redirect loop | 🔴 Critical | Users can't access dashboards |
| Auth state inconsistency | 🟡 Medium | Silent failures, poor UX |

---

## Recommended Fixes

### FIX #1: Standardize on ONE API Client (Priority 1)

**Option A: Use Axios client everywhere**
1. Remove `frontend/src/utils/apiClient.ts`
2. Update all imports to use `@/services/api/client`
3. Fix axios response handling (it already unwraps to `{ success, data }`)

**Option B: Add Authorization header fallback**
1. Keep axios client
2. Add token to localStorage/memory as backup
3. Modify interceptor to add `Authorization: Bearer` header:

```typescript
// services/api/client.ts
apiClient.interceptors.request.use((config) => {
  // Try to get token from memory/localStorage as fallback
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

4. Update auth endpoints to store token:
```typescript
// After successful auth
const response = await apiClient.post('/auth/shop', { address });
if (response.success && response.token) {
  localStorage.setItem('auth_token', response.token);
}
```

---

### FIX #2: Break Redirect Loop (Priority 1)

**Solution: Check auth cookie before redirecting**

Update `frontend/src/app/page.tsx`:
```typescript
React.useEffect(() => {
  // Only redirect if user has valid auth cookie
  const hasAuthCookie = document.cookie.includes('auth_token');

  if (account && isRegistered && !isDetecting && walletType !== 'unknown' && hasAuthCookie) {
    router.push(`/${walletType}`);
  }
}, [account, isRegistered, isDetecting, walletType, router]);
```

---

### FIX #3: Hybrid Auth Strategy (Priority 1)

**Use BOTH cookies AND localStorage:**

1. **Backend**: Set both cookie AND return token in response ✅ (already doing this)

2. **Frontend**: Store token in localStorage as backup:
```typescript
// After auth success
const response = await apiClient.post('/auth/shop', { address });
if (response.success && response.token) {
  // Cookie is set by backend automatically
  // Also store in localStorage as fallback
  localStorage.setItem('auth_token', response.token);
  localStorage.setItem('auth_role', 'shop');
}
```

3. **API Client**: Send both:
```typescript
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Cookies still sent automatically via withCredentials: true
  return config;
});
```

This way:
- Cookies work → Great! Primary method
- Cookies blocked → localStorage fallback works
- Maximum compatibility

---

### FIX #4: Better Error Handling

```typescript
// services/api/client.ts
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      // Try to refresh token if cookie failed
      const token = localStorage.getItem('auth_token');
      if (token) {
        // Retry original request with token
        const config = error.config;
        config.headers.Authorization = `Bearer ${token}`;
        return axios.request(config).then(res => res.data);
      }

      // If still fails, redirect to home
      if (typeof window !== 'undefined') {
        localStorage.clear();
        window.location.href = '/?session=expired';
      }
    }
    return Promise.reject(error);
  }
);
```

---

## Migration Strategy

1. **Phase 1**: Add localStorage fallback (non-breaking)
   - Update auth endpoints to store token
   - Update API client to send Bearer token
   - Test in production

2. **Phase 2**: Fix redirect loop
   - Update landing page logic
   - Add cookie detection
   - Test navigation flows

3. **Phase 3**: Remove unused API client
   - Remove `utils/apiClient.ts`
   - Update all imports
   - Fix TypeScript errors

4. **Phase 4**: Comprehensive testing
   - Test in different browsers
   - Test with cookies blocked
   - Test redirect flows

---

## Testing Checklist

- [ ] Test auth flow in Chrome (cookies enabled)
- [ ] Test auth flow in Safari (strict cookie blocking)
- [ ] Test auth flow in iOS Safari
- [ ] Test with browser cookie blocking enabled
- [ ] Test redirect from protected routes
- [ ] Test landing page auto-redirect
- [ ] Test API calls with valid cookie
- [ ] Test API calls with blocked cookie but valid token
- [ ] Test session expiry handling
- [ ] Test logout flow

---

## Files Requiring Changes

**High Priority:**
1. `frontend/src/services/api/client.ts` - Add Authorization header
2. `frontend/src/contexts/AuthContext.tsx` - Store token in localStorage
3. `frontend/src/app/page.tsx` - Fix redirect loop
4. `frontend/src/stores/customerStore.ts` - Fix axios response handling
5. `frontend/src/hooks/useAdminAuth.ts` - Fix axios response handling
6. `frontend/src/components/shop/ShopDashboardClient.tsx` - Fix axios response handling

**Medium Priority:**
7. Remove `frontend/src/utils/apiClient.ts` (unused)
8. Update all components using `.success` on axios responses

**Low Priority:**
9. Add better error messages
10. Add auth state debugging tools
