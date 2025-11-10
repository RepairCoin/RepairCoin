# Authentication & Security Audit Report

**Date**: 2025-11-10 (Updated: 2025-11-10 after auth refactor)
**Scope**: Complete authentication system review (backend + frontend)
**Status**: ✅ Generally Secure with Recommended Improvements

## 🎉 Recent Improvements (2025-11-10)

**Authentication Refactor Completed:**
- ✅ Fixed duplicate refresh token creation issue
- ✅ Implemented single source of truth for authentication (useAuthInitializer)
- ✅ Added global locking mechanism to prevent race conditions
- ✅ Improved logout UX with automatic redirect
- ✅ Removed redundant/duplicate authentication code
- ✅ Centralized authentication in authStore

See: [AUTHENTICATION_REFACTOR.md](../frontend/AUTHENTICATION_REFACTOR.md) for details.

---

## Executive Summary

### ✅ What's Working Well

1. **JWT-based authentication** with proper signing
2. **HttpOnly cookies** for token storage (secure)
3. **Dual auth mechanism** (cookie + Authorization header)
4. **Token refresh endpoint** implemented
5. **Role-based access control** (RBAC)
6. **Cross-origin cookie support** (sameSite: none, secure: true)
7. **Comprehensive logging** for security events
8. **Database validation** for each request

### ⚠️ Areas for Improvement

1. **No automatic token refresh** on frontend
2. **No rate limiting** on auth endpoints
3. **Missing token expiration warning** for users
4. **No refresh token rotation** (security best practice)
5. **Session management** could be improved
6. **CSRF protection** not explicitly implemented

---

## Detailed Analysis

## 1. Token Management

### Current Implementation

#### Backend (`backend/src/middleware/auth.ts`)
```typescript
// JWT Generation
export const generateToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',  // ⚠️ 24 hours is long
    issuer: 'repaircoin-api',
    audience: 'repaircoin-users'
  });
};
```

**Analysis:**
- ✅ Proper JWT signing with secret
- ✅ Token expiration set
- ⚠️ **24-hour expiration is quite long** for security-sensitive operations
- ⚠️ **Single token type** (no separate access/refresh tokens)

#### Cookie Settings (`backend/src/routes/auth.ts`)
```typescript
const cookieOptions = {
  httpOnly: true,      // ✅ Prevents XSS attacks
  secure: true,        // ✅ HTTPS only
  sameSite: 'none',    // ✅ Required for cross-origin
  maxAge: 24 * 60 * 60 * 1000,  // 24 hours
  path: '/',
};
```

**Analysis:**
- ✅ HttpOnly prevents JavaScript access (XSS protection)
- ✅ Secure flag requires HTTPS
- ✅ SameSite: none allows cross-origin (needed for your setup)
- ⚠️ **24-hour cookie duration** matches JWT expiration
- ⚠️ No explicit **domain** set (correct for cross-origin, but document this)

---

### 🔴 Issue #1: No Separate Access & Refresh Tokens

**Current**: Single JWT token with 24-hour lifespan

**Problem**:
- If token is compromised, attacker has 24-hour window
- User stays logged in for full 24 hours without re-validation
- Can't revoke sessions easily

**Best Practice**: Two-token system
```
Access Token:  Short-lived (15 min) - for API calls
Refresh Token: Long-lived (7 days) - only for getting new access tokens
```

**Recommendation**: Implement separate access/refresh tokens

**Priority**: 🟡 Medium (current setup is acceptable for MVP)

---

### 🟡 Issue #2: No Automatic Token Refresh

**Frontend** has refresh endpoint but doesn't use it automatically:

```typescript
// frontend/src/services/api/auth.ts (exists but unused)
export const refreshToken = async (): Promise<boolean> => {
  try {
    const response = await apiClient.post('/auth/refresh');
    return response?.success || false;
  } catch (error) {
    return false;
  }
};
```

**Problem**:
- User gets 401 error after 24 hours
- No graceful token renewal
- Poor UX (sudden logout)

**Recommendation**: Add automatic refresh before token expires

```typescript
// Pseudo-code for implementation
useEffect(() => {
  // Refresh token 5 minutes before expiry
  const refreshInterval = setInterval(async () => {
    const tokenExpiry = getTokenExpiry(); // Parse JWT exp
    const timeUntilExpiry = tokenExpiry - Date.now();

    if (timeUntilExpiry < 5 * 60 * 1000) { // < 5 minutes
      await authApi.refreshToken();
    }
  }, 60000); // Check every minute

  return () => clearInterval(refreshInterval);
}, []);
```

**Priority**: 🟡 Medium (improves UX)

---

### 🟢 Issue #3: Token Validation is Solid

**Backend validates**:
- ✅ Token signature
- ✅ Token expiration
- ✅ Token payload (address, role)
- ✅ User exists in database
- ✅ User is active/verified
- ✅ Role-specific checks (e.g., shop ID)

```typescript
// backend/src/middleware/auth.ts:128-142
const isValid = await validateUserInDatabase(decoded);
if (!isValid) {
  return res.status(401).json({
    success: false,
    error: 'User not found or inactive'
  });
}
```

**Analysis**: ✅ **Excellent** - Goes beyond just JWT validation

---

## 2. Security Vulnerabilities

### 🔴 HIGH: No Rate Limiting on Auth Endpoints

**Current**:
```typescript
// backend/src/middleware/auth.ts:254
export const sensitiveOperationLimit = (req, res, next) => {
  // This would integrate with Redis or in-memory store for rate limiting
  // For now, just log sensitive operations
  logger.security('Sensitive operation attempted', {...});
  next();
};
```

**Problem**:
- Auth endpoints (`/auth/admin`, `/auth/customer`, `/auth/shop`) have NO rate limiting
- Vulnerable to:
  - Brute force attacks
  - JWT token guessing
  - DoS attacks

**Attack Scenario**:
```
Attacker: POST /api/auth/admin with random addresses
Server: Responds instantly, no limit
Result: Can try thousands of addresses per second
```

**Recommendation**: Add rate limiting with `express-rate-limit`

```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply to auth routes
router.post('/admin', authLimiter, async (req, res) => {...});
router.post('/shop', authLimiter, async (req, res) => {...});
router.post('/customer', authLimiter, async (req, res) => {...});
```

**Priority**: 🔴 **HIGH** - Implement ASAP

---

### 🟡 MEDIUM: No CSRF Protection

**Current**: Relies on httpOnly cookies + sameSite

**Problem**:
- `sameSite: 'none'` allows cross-site requests
- No CSRF token validation
- Vulnerable if user visits malicious site while logged in

**Attack Scenario**:
```html
<!-- Attacker's website -->
<form action="https://repaircoin-staging.ondigitalocean.app/api/admin/..." method="POST">
  <input type="hidden" name="action" value="delete_all_users">
</form>
<script>document.forms[0].submit();</script>
<!-- If victim is logged in as admin, this executes! -->
```

**Recommendation**: Add CSRF protection

**Option 1**: Double-submit cookie pattern
```typescript
// Generate CSRF token on login
const csrfToken = crypto.randomBytes(32).toString('hex');
res.cookie('csrf_token', csrfToken, { httpOnly: false }); // Readable by JS

// Frontend sends token in header
axios.defaults.headers.common['X-CSRF-Token'] = getCsrfToken();

// Backend validates
if (req.headers['x-csrf-token'] !== req.cookies.csrf_token) {
  return res.status(403).json({ error: 'CSRF token mismatch' });
}
```

**Option 2**: Use `csurf` middleware
```typescript
import csrf from 'csurf';
const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);
```

**Priority**: 🟡 Medium (sameSite provides some protection)

---

### 🟢 LOW: JWT Secret in .env

**Current**:
```bash
# backend/.env
JWT_SECRET=dev-jwt-secret-32-chars-minimum-length-required
```

**Analysis**:
- ✅ In `.env` (not in code)
- ✅ Not committed to git (hopefully!)
- ⚠️ Secret name indicates it's a dev secret
- ⚠️ No key rotation mechanism

**Recommendation**:
1. Use strong production secret (64+ random characters)
2. Store in environment variables / secrets manager
3. Rotate JWT secret periodically (invalidates all tokens)

```bash
# Generate secure secret
openssl rand -base64 64

# Production .env
JWT_SECRET=<generated-secret>
JWT_SECRET_PREVIOUS=<old-secret>  # For graceful rotation
```

**Priority**: 🟢 Low (existing secret is acceptable if kept secure)

---

## 3. Session Management

### Current Behavior

**Login Flow**:
1. User connects wallet
2. Frontend calls `/auth/check-user` (no auth required)
3. Frontend calls `/auth/{role}` to get JWT
4. Backend sets cookie + returns token
5. User can make authenticated requests

**Session Duration**: 24 hours (JWT expiration)

**Session Termination**:
- Manual logout (`/auth/logout`)
- Token expiration (24 hours)
- Browser close (cookie persists!)

### 🟡 Issue: Sessions Persist After Browser Close

**Problem**:
- Cookie has `maxAge: 24h` (persistent)
- No `Expires` attribute
- Sessions survive browser restart

**Security Risk**: Shared/public computers

**Recommendation**: Add "Remember Me" option

```typescript
// Option 1: Session-only cookie (no maxAge)
const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  // No maxAge = session cookie (deleted on browser close)
};

// Option 2: Short-lived default + optional long-lived
const rememberMe = req.body.rememberMe;
const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000, // 7 days : 1 hour
};
```

**Priority**: 🟡 Medium (UX improvement + security)

---

## 4. Frontend Security

### ✅ What's Good

1. **No localStorage for tokens** (correct!)
2. **Cookies are httpOnly** (can't be stolen via XSS)
3. **Authorization header backup** (our recent fix!)
4. **Automatic 401 redirect** (user-friendly)

```typescript
// frontend/src/services/api/client.ts
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/?session=expired';
    }
  }
);
```

### 🟡 Issue: No Token Expiry Warning

**Problem**:
- User is actively using app
- Token expires after 24 hours
- Sudden logout with no warning

**User Experience**:
```
User: *typing form data*
Token: *expires*
User: *clicks submit*
App: 401! Redirecting to home...
User: *loses all form data* 😡
```

**Recommendation**: Show expiry warning

```typescript
// Check token expiry periodically
useEffect(() => {
  const checkExpiry = () => {
    const token = document.cookie.match(/auth_token=([^;]+)/)?.[1];
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresIn = payload.exp * 1000 - Date.now();

      if (expiresIn < 5 * 60 * 1000) { // < 5 minutes
        showToast.warning('Your session will expire soon. Please save your work.');
        // Auto-refresh token
        authApi.refreshToken();
      }
    }
  };

  const interval = setInterval(checkExpiry, 60000);
  return () => clearInterval(interval);
}, []);
```

**Priority**: 🟡 Medium (UX improvement)

---

## 5. Recommendations Summary

### 🔴 HIGH PRIORITY (Implement ASAP)

1. **Add Rate Limiting to Auth Endpoints**
   - Use `express-rate-limit`
   - Limit: 5 attempts per 15 minutes per IP
   - Apply to all `/auth/*` endpoints
   - Estimated time: 1 hour

2. **Shorten JWT Expiration**
   - Change from 24 hours → 2 hours
   - Implement automatic refresh
   - Better security with minimal UX impact
   - Estimated time: 2 hours

### 🟡 MEDIUM PRIORITY (Next Sprint)

3. **Implement Automatic Token Refresh**
   - Frontend checks expiry every minute
   - Auto-refresh 5 minutes before expiry
   - Show warning if refresh fails
   - Estimated time: 3 hours

4. **Add CSRF Protection**
   - Use double-submit cookie pattern or `csurf`
   - Add CSRF token to sensitive mutations
   - Estimated time: 2 hours

5. **Improve Session Management**
   - Add "Remember Me" option
   - Default to session-only cookies
   - Estimated time: 2 hours

6. **Add Token Expiry Warning**
   - Show UI warning 5 minutes before expiry
   - Auto-refresh token if possible
   - Estimated time: 1 hour

### 🟢 LOW PRIORITY (Future)

7. **Implement Separate Access/Refresh Tokens**
   - Access token: 15 minutes
   - Refresh token: 7 days
   - Token rotation on refresh
   - Estimated time: 1 day

8. **Add Session Revocation**
   - Store active sessions in Redis
   - Allow admin to revoke specific sessions
   - "Log out all devices" feature
   - Estimated time: 1 day

9. **JWT Secret Rotation**
   - Implement key rotation strategy
   - Support multiple valid secrets during rotation
   - Estimated time: 4 hours

---

## 6. Security Best Practices Checklist

### ✅ Currently Implemented

- [x] JWT-based authentication
- [x] HttpOnly cookies
- [x] Secure flag on cookies (HTTPS only)
- [x] Token expiration
- [x] Role-based access control
- [x] Database validation on each request
- [x] Comprehensive security logging
- [x] Error handling (no info leakage)
- [x] CORS properly configured
- [x] Dual auth mechanism (cookie + header)

### ⚠️ Partially Implemented

- [~] Rate limiting (only on webhooks, not auth)
- [~] Session management (no revocation)
- [~] Token refresh (endpoint exists, not used)

### ❌ Not Implemented

- [ ] CSRF protection
- [ ] Automatic token refresh
- [ ] Token expiry warnings
- [ ] Remember me functionality
- [ ] Separate access/refresh tokens
- [ ] Session revocation
- [ ] JWT secret rotation

---

## 7. Quick Win Implementations

### 1. Add Rate Limiting (30 minutes)

```typescript
// backend/src/routes/auth.ts
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts',
});

router.post('/admin', authLimiter, async (req, res) => {...});
router.post('/shop', authLimiter, async (req, res) => {...});
router.post('/customer', authLimiter, async (req, res) => {...});
```

### 2. Add Token Refresh Timer (1 hour)

```typescript
// frontend/src/hooks/useTokenRefresh.ts
export function useTokenRefresh() {
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      const cookie = document.cookie.match(/auth_token=([^;]+)/)?.[1];
      if (!cookie) return;

      try {
        const payload = JSON.parse(atob(cookie.split('.')[1]));
        const expiresIn = (payload.exp * 1000) - Date.now();

        if (expiresIn < 5 * 60 * 1000 && expiresIn > 0) {
          console.log('🔄 Refreshing token...');
          await authApi.refreshToken();
        }
      } catch (error) {
        console.error('Token refresh check failed:', error);
      }
    }, 60000);

    return () => clearInterval(refreshInterval);
  }, []);
}
```

### 3. Add Expiry Warning (30 minutes)

```typescript
// Show toast 5 minutes before expiry
if (expiresIn < 5 * 60 * 1000 && expiresIn > 4 * 60 * 1000) {
  toast.warning('Your session will expire in 5 minutes. Activity will auto-refresh.');
}
```

---

## 8. Conclusion

### Overall Security Score: 7.5/10

**Strengths**:
- ✅ Solid JWT implementation
- ✅ HttpOnly cookies (XSS protection)
- ✅ Dual auth mechanism (our fix!)
- ✅ Comprehensive validation
- ✅ Good logging

**Weaknesses**:
- ⚠️ No rate limiting on auth
- ⚠️ Long token expiration
- ⚠️ No CSRF protection
- ⚠️ No automatic refresh

**Verdict**: **Production-ready with recommended improvements**

The current implementation is secure enough for production, but adding rate limiting and shorter token expiration should be prioritized. The system follows most security best practices and uses industry-standard patterns.

---

## 9. Action Items

### This Week
1. [ ] Add rate limiting to auth endpoints
2. [ ] Shorten JWT expiration to 2 hours
3. [ ] Implement automatic token refresh

### Next Sprint
4. [ ] Add CSRF protection
5. [ ] Improve session management
6. [ ] Add token expiry warnings

### Future
7. [ ] Separate access/refresh tokens
8. [ ] Session revocation system
9. [ ] JWT secret rotation

---

**Audit Completed**: 2025-11-10
**Next Review**: After implementing HIGH priority items
