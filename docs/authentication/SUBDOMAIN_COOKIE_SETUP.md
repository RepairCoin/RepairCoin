# Subdomain Cookie Authentication Setup

## Overview

This document describes the updated cookie authentication configuration for the subdomain setup where:
- **Frontend**: `https://repaircoin.ai` or `https://www.repaircoin.ai`
- **Backend**: `https://api.repaircoin.ai`

## Benefits of Subdomain Setup

### Security Improvements
1. **Better SameSite Protection**: Can use `sameSite: 'lax'` instead of `'none'`
   - `'lax'` provides CSRF protection for most requests
   - `'none'` requires more careful security measures

2. **Simplified Cookie Sharing**: Use `domain: '.repaircoin.ai'` to share cookies across subdomains
   - More reliable than cross-origin cookie handling
   - Better browser compatibility (especially Safari/iOS)

3. **Maintains HTTPS Security**: Still uses `secure: true` for HTTPS-only cookies

### Compatibility Improvements
- **Safari/iOS**: Better cookie support compared to cross-origin `sameSite: 'none'`
- **Privacy Settings**: Less likely to be blocked by strict browser privacy settings
- **Third-party Cookie Blocking**: Not affected by third-party cookie restrictions

---

## Configuration Changes

### Backend Changes

#### 1. Cookie Settings (`backend/src/routes/auth.ts`)

**Previous (Cross-Origin):**
```typescript
const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as 'none', // Required for cross-origin
  maxAge: 15 * 60 * 1000,
  path: '/'
  // No domain set for cross-origin
};
```

**New (Subdomain):**
```typescript
const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as 'lax', // Better security for subdomain
  maxAge: 15 * 60 * 1000,
  path: '/',
  domain: '.repaircoin.ai' // Share cookies across subdomains
};
```

#### 2. CORS Configuration (`backend/src/app.ts`)

Added `https://api.repaircoin.ai` to allowed origins:

```typescript
const allowedOrigins = [
  'https://repaircoin.ai',
  'https://www.repaircoin.ai',
  'https://api.repaircoin.ai', // Backend subdomain
  // ... other origins
];
```

### Frontend Changes

**No code changes required!** The frontend already uses `withCredentials: true` which automatically handles cookies for subdomain requests.

Only update the environment variable:

```bash
# Frontend .env (Production)
NEXT_PUBLIC_API_URL=https://api.repaircoin.ai/api
NEXT_PUBLIC_BACKEND_URL=https://api.repaircoin.ai
```

---

## Environment Variables

### Backend Environment Variables

Add to your backend `.env` or deployment environment:

```bash
# Required for subdomain cookie setup
NODE_ENV=production
COOKIE_DOMAIN=.repaircoin.ai  # Note the leading dot for subdomain sharing

# Frontend URL (for CORS)
FRONTEND_URL=https://repaircoin.ai

# Other required vars
JWT_SECRET=your-secret-key-minimum-32-characters
```

### Frontend Environment Variables

Update for production deployment:

```bash
# API endpoint (backend subdomain)
NEXT_PUBLIC_API_URL=https://api.repaircoin.ai/api
NEXT_PUBLIC_BACKEND_URL=https://api.repaircoin.ai

# App URL (frontend)
NEXT_PUBLIC_APP_URL=https://repaircoin.ai
```

---

## Cookie Behavior Details

### Cookie Domain Attribute

The `domain` attribute determines which domains can access the cookie:

| Setting | Accessible From | Use Case |
|---------|----------------|----------|
| No domain | Only exact domain that set it | Cross-origin (different domains) |
| `.repaircoin.ai` | All `*.repaircoin.ai` subdomains | Subdomain setup (our case) |
| `api.repaircoin.ai` | Only `api.repaircoin.ai` | Restrict to specific subdomain |

**Our configuration:**
- `domain: '.repaircoin.ai'` (note the leading dot)
- Accessible from: `repaircoin.ai`, `www.repaircoin.ai`, `api.repaircoin.ai`

### SameSite Attribute Comparison

| Value | CSRF Protection | Cross-Origin Requests | Our Use |
|-------|----------------|----------------------|---------|
| `'strict'` | Best | Blocked | ❌ Too strict |
| `'lax'` | Good | Allowed for top-level navigation | ✅ **Recommended** |
| `'none'` | None (requires CSRF tokens) | Always sent | ⚠️ Previous setup |

**With subdomain setup, we can use `'lax'`** which provides:
- CSRF protection for most scenarios
- Cookies sent for same-site requests (including subdomains)
- Better browser compatibility

---

## Deployment Steps

### Step 1: Update Backend Environment

In your backend deployment (Digital Ocean, etc.):

```bash
# Add new environment variable
COOKIE_DOMAIN=.repaircoin.ai

# Verify existing variables
NODE_ENV=production
FRONTEND_URL=https://repaircoin.ai
JWT_SECRET=<your-secret>
```

### Step 2: Deploy Backend

Deploy the updated backend code with the new cookie configuration:

```bash
git push origin main  # Triggers auto-deployment
```

### Step 3: Update Frontend Environment

In your frontend deployment (Vercel, etc.):

```bash
# Update API URL to point to subdomain
NEXT_PUBLIC_API_URL=https://api.repaircoin.ai/api
NEXT_PUBLIC_BACKEND_URL=https://api.repaircoin.ai
```

### Step 4: Deploy Frontend

Deploy the updated frontend environment variables:

```bash
# Vercel will auto-deploy on push
git push origin main
```

### Step 5: DNS Configuration

Ensure your DNS is configured correctly:

```
A record:     repaircoin.ai      → Your frontend server IP
CNAME record: www.repaircoin.ai  → repaircoin.ai
CNAME record: api.repaircoin.ai  → Your backend server domain
```

---

## Testing Checklist

### 1. Browser DevTools Cookie Inspection

After login, open DevTools → Application → Cookies:

**Expected Cookie Settings:**
```
Name: auth_token
Value: eyJhbGciOiJIUzI1... (JWT)
Domain: .repaircoin.ai
Path: /
Secure: ✓ (checked)
HttpOnly: ✓ (checked)
SameSite: Lax
```

### 2. CORS Headers Check

Open DevTools → Network → Select any API call → Response Headers:

```
Access-Control-Allow-Origin: https://repaircoin.ai
Access-Control-Allow-Credentials: true
```

### 3. Cookie Transmission

Open DevTools → Network → Select any API call → Request Headers:

```
Cookie: auth_token=eyJhbGci...; refresh_token=eyJhbGci...
```

If cookies are NOT in request headers:
- ❌ Check `COOKIE_DOMAIN` is set to `.repaircoin.ai`
- ❌ Verify both sites use HTTPS
- ❌ Clear cookies and try again

### 4. Cross-Browser Testing

Test authentication flow in:
- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari (Desktop)
- ✅ Safari (iOS) - Critical due to strict cookie policies
- ✅ Edge

### 5. Functional Testing

- [ ] Login as admin
- [ ] Login as shop
- [ ] Login as customer
- [ ] Navigate between pages (cookies persist)
- [ ] Close browser and reopen (cookies persist)
- [ ] Wait 13 minutes and make request (auto-refresh triggers)
- [ ] Logout (cookies cleared)
- [ ] Try accessing protected route after logout (redirected to login)

---

## Troubleshooting

### Issue 1: Cookies Not Set

**Symptom:** No cookies appear in DevTools after login

**Solutions:**
1. Check backend logs for cookie setting confirmation
2. Verify `COOKIE_DOMAIN=.repaircoin.ai` is set in backend env
3. Ensure both frontend and backend use HTTPS
4. Check CORS headers include `Access-Control-Allow-Credentials: true`

**Debug:**
```bash
# Test cookie endpoint
curl -v https://api.repaircoin.ai/api/auth/test-cookie
# Look for Set-Cookie header in response
```

### Issue 2: Cookies Not Sent with Requests

**Symptom:** Cookies visible in DevTools but not in request headers

**Solutions:**
1. Verify `domain: '.repaircoin.ai'` includes the leading dot
2. Check frontend uses `withCredentials: true` ✅ (already configured)
3. Ensure `sameSite: 'lax'` (not `'strict'`)
4. Clear all cookies and try fresh login

### Issue 3: CORS Errors

**Symptom:** "No 'Access-Control-Allow-Origin' header present"

**Solutions:**
1. Verify backend CORS includes frontend URL
2. Check `credentials: true` in CORS config ✅ (already set)
3. Ensure frontend URL matches exactly (http vs https, www vs non-www)

### Issue 4: Cookies Work Locally but Not in Production

**Symptom:** Works on localhost but fails on production domains

**Solutions:**
1. Verify `COOKIE_DOMAIN` env var is set in production
2. Check both sites use HTTPS (required for `secure: true`)
3. Verify DNS is configured correctly for subdomain
4. Clear production cookies and test fresh
5. Check browser console for specific errors

### Issue 5: Safari/iOS Not Working

**Symptom:** Works in Chrome but fails in Safari

**Solutions:**
1. ✅ Verify using `sameSite: 'lax'` (not `'none'`)
2. ✅ Verify using subdomain setup with `domain: '.repaircoin.ai'`
3. Check Safari privacy settings (disable "Prevent cross-site tracking" for testing)
4. Test in Safari Private Browsing mode

---

## Migration from Cross-Origin Setup

If you're migrating from the previous cross-origin setup:

### Before (Cross-Origin)
- Frontend: `https://www.repaircoin.ai` (Vercel)
- Backend: `https://backend.ondigitalocean.app` (Digital Ocean)
- Cookies: `sameSite: 'none'`, no domain set

### After (Subdomain)
- Frontend: `https://repaircoin.ai` or `https://www.repaircoin.ai`
- Backend: `https://api.repaircoin.ai`
- Cookies: `sameSite: 'lax'`, `domain: '.repaircoin.ai'`

### Migration Steps

1. **Set up DNS for api.repaircoin.ai** pointing to your backend server
2. **Update backend environment variables** (add `COOKIE_DOMAIN`)
3. **Deploy backend changes** (new cookie configuration)
4. **Update frontend environment variables** (new API URL)
5. **Deploy frontend changes**
6. **Test thoroughly** across browsers
7. **Monitor for issues** in first 24-48 hours
8. **Update documentation** to reflect new URLs

### Rollback Plan

If issues occur:

1. **Quick rollback:** Revert environment variables
   - Backend: Remove `COOKIE_DOMAIN`
   - Frontend: Revert to old API URL

2. **Full rollback:** Revert code changes
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

---

## Security Considerations

### Improved Security with Subdomain Setup

1. **CSRF Protection**: `sameSite: 'lax'` provides automatic CSRF protection
2. **XSS Protection**: `httpOnly: true` prevents JavaScript access
3. **Transport Security**: `secure: true` requires HTTPS
4. **Domain Scoping**: `domain: '.repaircoin.ai'` restricts to our domains only

### Additional Recommendations

1. **Rate Limiting**: Already implemented on `/auth/*` endpoints ✅
2. **CSRF Tokens**: Consider adding for state-changing operations
3. **Token Rotation**: Consider rotating refresh tokens on use
4. **Security Headers**: Already using Helmet ✅
5. **Regular Security Audits**: Review access logs and auth patterns

---

## Monitoring

### Metrics to Track

After deployment, monitor:

1. **Login Success Rate**: Should remain ~same or improve
2. **Cookie Set Rate**: Should be near 100%
3. **Token Refresh Rate**: Should remain high (>95%)
4. **CORS Errors**: Should decrease or remain at 0
5. **Safari/iOS Success Rate**: Should improve significantly

### Logging

Backend logs now include cookie domain information:

```javascript
{
  cookieSettings: {
    domain: '.repaircoin.ai',
    sameSite: 'lax',
    secure: true,
    httpOnly: true
  }
}
```

Monitor these logs to verify correct configuration in production.

---

## References

- [MDN: SameSite Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [MDN: Cookie Domain Attribute](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#domain_attribute)
- [OWASP: Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

---

**Last Updated:** 2025-11-14
**Status:** Production Ready
**Configuration:** Subdomain Setup
