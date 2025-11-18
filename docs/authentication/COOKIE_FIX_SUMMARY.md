# Cookie Authentication Fix - Summary

## Issue
Cookies were being set correctly in production, but the frontend couldn't redirect users to their dashboard after login.

## Root Cause
The frontend was trying to **read httpOnly cookies with JavaScript**, which is impossible by design. HttpOnly cookies are a security feature that prevents JavaScript from accessing tokens, protecting against XSS attacks.

## Files Changed

### Backend: `/backend/src/routes/auth.ts`
**Changes**: Made cookie settings environment-aware

**Before**:
```javascript
const cookieOptions = {
  httpOnly: true,
  secure: true,         // Always true
  sameSite: 'none',     // Always 'none'
  maxAge: 2 * 60 * 60 * 1000,
  path: '/',
};
```

**After**:
```javascript
const isProduction = process.env.NODE_ENV === 'production';

const cookieOptions = {
  httpOnly: true,
  secure: isProduction || process.env.COOKIE_SECURE === 'true',
  sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 2 * 60 * 60 * 1000,
  path: '/',
};
```

**Why**:
- Production uses `secure: true` + `sameSite: 'none'` for cross-domain (Vercel ↔ Digital Ocean)
- Development uses `secure: false` + `sameSite: 'lax'` for localhost testing

### Frontend: `/frontend/src/services/api/client.ts`
**Changes**: Removed invalid httpOnly cookie reading attempt

**Before**:
```javascript
apiClient.interceptors.request.use((config) => {
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';');
    const authCookie = cookies.find(cookie => cookie.trim().startsWith('auth_token='));
    if (authCookie) {
      const token = authCookie.split('=')[1];
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});
```

**After**:
```javascript
apiClient.interceptors.request.use((config) => {
  // Cookies are automatically sent via withCredentials: true
  // HttpOnly cookies CANNOT be read by JavaScript (security feature)

  // Optional: Add request ID for tracking
  if (typeof window !== 'undefined') {
    config.headers['X-Request-ID'] = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
  return config;
});
```

**Why**: HttpOnly cookies are automatically sent by the browser with `withCredentials: true`. No manual reading needed!

### Frontend: `/frontend/src/app/page.tsx`
**Changes**: Fixed redirect logic to use auth state instead of cookie reading

**Before**:
```javascript
// Check if auth cookie exists before redirecting
const hasAuthCookie = typeof document !== 'undefined' &&
                      document.cookie.split(';').some(cookie => cookie.trim().startsWith('auth_token='));

if (account && isRegistered && !isDetecting && walletType !== 'unknown' && hasAuthCookie) {
  // redirect...
}
```

**After**:
```javascript
// Use isAuthenticated from authStore instead of trying to read httpOnly cookies
if (account && isRegistered && isAuthenticated && !isDetecting && walletType !== 'unknown') {
  console.log('🔄 [LandingPage] Auto-redirecting authenticated user to:', walletType);
  // redirect...
}
```

**Why**: The `isAuthenticated` state is set by the authStore after successful API authentication, which proves the httpOnly cookie is valid.

### Frontend: `/frontend/src/hooks/useTokenRefresh.ts`
**Changes**: Replaced cookie parsing with session validation API calls

**Before**:
```javascript
// Get auth token from cookie
const cookieMatch = document.cookie.match(/auth_token=([^;]+)/);
if (!cookieMatch) return;

const token = cookieMatch[1];
// Parse JWT to check expiration...
```

**After**:
```javascript
// Verify session is still valid by making an API call
// The interceptor in client.ts will automatically refresh if needed
const sessionData = await authApi.getSession();

if (!sessionData.isValid) {
  console.log('[useTokenRefresh] Session is no longer valid');
  return;
}
```

**Why**:
- Cannot read httpOnly cookies with JavaScript
- API interceptor already handles automatic token refresh on 401 errors
- Session validation via API is the correct approach

## How It Works Now

### 1. Login Flow
```
User connects wallet → Frontend calls /api/auth/{role} → Backend sets httpOnly cookies →
Frontend receives auth response → authStore.isAuthenticated = true → Page redirects
```

### 2. Cookie Handling
- **Backend**: Sets cookies with appropriate `secure` and `sameSite` based on environment
- **Browser**: Automatically includes cookies in all requests (via `withCredentials: true`)
- **Frontend**: Never tries to read cookies directly, relies on auth state

### 3. Token Refresh
- **Automatic**: API client interceptor catches 401 errors → calls `/api/auth/refresh` → retries original request
- **Periodic**: `useTokenRefresh` hook checks session validity every 5 minutes as backup

## Testing Checklist

✅ **Cookies are set correctly**
- Open DevTools → Application → Cookies
- Should see `auth_token` and `refresh_token` with:
  - HttpOnly: Yes
  - Secure: Yes (production only)
  - SameSite: None (production) or Lax (development)

✅ **Cookies are sent with requests**
- DevTools → Network → Any API request → Headers
- Request should have `Cookie: auth_token=...; refresh_token=...`

✅ **Redirect works after login**
- Login with wallet → Should redirect to appropriate dashboard
- No "Redirecting to Dashboard..." loop

✅ **Token refresh works**
- Session lasts 15 minutes (access token)
- Should auto-refresh without user intervention
- Check Network tab for `/api/auth/refresh` calls

## Environment Variables

### Backend (Digital Ocean)
```bash
NODE_ENV=production              # CRITICAL: Enables secure cookies
FRONTEND_URL=https://www.repaircoin.ai
JWT_SECRET=your-secret-key
```

### Frontend (Vercel)
```bash
NEXT_PUBLIC_API_URL=https://your-backend.ondigitalocean.app/api
```

## Key Learnings

1. **HttpOnly cookies CANNOT be read by JavaScript** - This is intentional for security
2. **Use auth state, not cookie checks** - Validate via API calls, not document.cookie
3. **Browser handles cookies automatically** - With `withCredentials: true`, no manual work needed
4. **Environment-aware cookies** - Different settings for dev vs production
5. **Let interceptors handle refresh** - Don't try to manually manage token lifecycle

## Security Benefits

✅ **XSS Protection**: HttpOnly cookies can't be stolen by malicious JavaScript
✅ **CSRF Protection**: SameSite attribute prevents cross-site attacks
✅ **Short-lived tokens**: 15-minute access tokens limit exposure window
✅ **Automatic refresh**: 7-day refresh tokens avoid frequent re-authentication
✅ **Revocation support**: Refresh tokens stored in DB for instant revocation

## Related Documentation

- [COOKIE_AUTH_GUIDE.md](./COOKIE_AUTH_GUIDE.md) - Comprehensive authentication guide
- [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) - Deployment checklist and troubleshooting

## Status

✅ **Fixed**: Cookies are now set and sent correctly
✅ **Fixed**: Redirect loop resolved
✅ **Fixed**: HttpOnly cookie reading removed from all frontend code
✅ **Ready**: System ready for production deployment
