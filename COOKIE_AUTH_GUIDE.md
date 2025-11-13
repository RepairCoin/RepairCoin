# Cookie-Based Authentication Guide

## Overview

RepairCoin uses **httpOnly cookies** for authentication to prevent XSS attacks. This guide explains how to configure and troubleshoot cookie-based authentication, especially in production with separate frontend (Vercel) and backend (Digital Ocean) deployments.

## How It Works

1. **User logs in** → Backend generates JWT tokens (access + refresh)
2. **Backend sets httpOnly cookies** → `auth_token` (15 min) and `refresh_token` (7 days)
3. **Browser automatically sends cookies** → With every API request via `withCredentials: true`
4. **Backend validates cookies** → Extracts token from cookie header
5. **Token expires** → Frontend automatically calls `/auth/refresh` to get new access token

## Cookie Configuration

### Production (Cross-Domain)

When frontend and backend are on **different domains** (e.g., `www.repaircoin.ai` on Vercel and `*.ondigitalocean.app`):

```javascript
{
  httpOnly: true,      // Prevents JavaScript access (security)
  secure: true,        // REQUIRED: Only sent over HTTPS
  sameSite: 'none',    // REQUIRED: Allows cross-domain cookies
  path: '/',           // Cookie available for all routes
  maxAge: 900000       // 15 minutes for access token
}
```

### Development (Same-Domain)

For local development where frontend and backend are both on `localhost`:

```javascript
{
  httpOnly: true,
  secure: false,       // Can use HTTP in dev
  sameSite: 'lax',     // More permissive for same-site
  path: '/',
  maxAge: 900000
}
```

## Environment Variables

### Backend (.env)

```bash
# Environment
NODE_ENV=production  # or 'development'

# OPTIONAL: Override cookie settings
COOKIE_SECURE=true   # Force secure cookies even in development

# Frontend URL (for CORS)
FRONTEND_URL=https://www.repaircoin.ai

# JWT
JWT_SECRET=your-secret-key-min-32-chars
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
```

### Frontend (.env)

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=https://your-backend.ondigitalocean.app/api
```

## Common Issues & Solutions

### Issue 1: Cookies Not Being Set

**Symptoms:**
- Login succeeds but subsequent API calls return 401
- DevTools → Application → Cookies shows no `auth_token` or `refresh_token`

**Causes & Solutions:**

1. **Backend not using HTTPS in production**
   - ✅ **Solution**: Ensure Digital Ocean app has HTTPS enabled
   - Check: `req.get('x-forwarded-proto')` should be `'https'`

2. **Trust proxy not configured**
   - ✅ **Solution**: Backend already has `app.set('trust proxy', true)` in app.ts:91
   - This tells Express to trust the `X-Forwarded-Proto` header from Digital Ocean's load balancer

3. **CORS not allowing credentials**
   - ✅ **Solution**: Backend already has `credentials: true` in CORS config (app.ts:131)
   - Frontend already has `withCredentials: true` in axios config (client.ts:8)

### Issue 2: Cookies Not Being Sent

**Symptoms:**
- Cookies appear in DevTools but aren't sent with API requests
- Network tab shows no `Cookie` header in request

**Causes & Solutions:**

1. **Missing `withCredentials: true`**
   - ✅ **Solution**: Already configured in `frontend/src/services/api/client.ts:8`

2. **Cookie domain mismatch**
   - ⚠️ **Important**: Do NOT set `domain` attribute for cross-origin cookies
   - Let the browser handle it automatically
   - ✅ **Solution**: Backend cookies do not set `domain` attribute

3. **SameSite=none without Secure**
   - ❌ **Browsers reject**: `sameSite: 'none'` requires `secure: true`
   - ✅ **Solution**: Backend dynamically sets both based on `NODE_ENV`

### Issue 3: "TypeError: Cannot read httpOnly cookie"

**Symptoms:**
- Frontend tries to read `document.cookie` but auth_token is missing
- Console warnings about httpOnly cookies

**Solution:**
- ✅ **httpOnly cookies CANNOT be read by JavaScript** - this is by design for security
- ✅ **Fixed**: Removed invalid cookie reading code from `client.ts`
- The browser automatically includes cookies in requests with `withCredentials: true`

### Issue 4: Mixed Content Warnings

**Symptoms:**
- Frontend (HTTPS) can't connect to backend (HTTP)
- Browser blocks cookie sending

**Solution:**
- Ensure BOTH frontend and backend use HTTPS in production
- Digital Ocean: Enable HTTPS in app settings
- Vercel: Automatically uses HTTPS

## Testing Cookie Authentication

### 1. Test Cookie Setting (Backend)

```bash
# Test endpoint to verify cookies can be set
curl -X GET https://your-backend.ondigitalocean.app/api/auth/test-cookie \
  -H "Origin: https://www.repaircoin.ai" \
  -v

# Check response headers for:
# Set-Cookie: test_cookie=...; HttpOnly; Secure; SameSite=None
```

### 2. Test Login Flow

```bash
# Login and save cookies
curl -X POST https://your-backend.ondigitalocean.app/api/auth/admin \
  -H "Content-Type: application/json" \
  -H "Origin: https://www.repaircoin.ai" \
  -d '{"address":"0x..."}' \
  -c cookies.txt -v

# Use cookies for authenticated request
curl -X GET https://your-backend.ondigitalocean.app/api/auth/session \
  -b cookies.txt -v
```

### 3. Browser DevTools

**Check Cookies:**
1. Open DevTools → Application → Cookies
2. Look for `auth_token` and `refresh_token` under your backend domain
3. Verify attributes:
   - ✅ HttpOnly: Yes
   - ✅ Secure: Yes (in production)
   - ✅ SameSite: None (in production) or Lax (in dev)

**Check Network Requests:**
1. Open DevTools → Network
2. Make an API call (e.g., load dashboard)
3. Click the request → Headers tab
4. Verify:
   - **Request Headers**: Should have `Cookie: auth_token=...`
   - **Response Headers**: Should have `Access-Control-Allow-Credentials: true`

## Deployment Checklist

### Digital Ocean Backend

- [ ] App uses HTTPS (not HTTP)
- [ ] Environment variable `NODE_ENV=production` is set
- [ ] Environment variable `FRONTEND_URL` points to Vercel domain
- [ ] Trust proxy is enabled (already in code)
- [ ] CORS allows your Vercel domain (already configured)

### Vercel Frontend

- [ ] `NEXT_PUBLIC_API_URL` points to Digital Ocean backend (with HTTPS)
- [ ] No client-side code tries to read httpOnly cookies
- [ ] `withCredentials: true` is set in API client (already configured)

## Security Best Practices

✅ **What We Do:**
- httpOnly cookies prevent XSS attacks
- Short-lived access tokens (15 min) limit exposure
- Refresh tokens (7 days) avoid frequent re-login
- SameSite=none with Secure prevents CSRF in cross-domain setup
- Automatic token refresh on 401 errors

❌ **What We Don't Do:**
- Don't store tokens in localStorage (vulnerable to XSS)
- Don't send tokens in URL parameters (logged and cached)
- Don't use long-lived access tokens (security risk)
- Don't set cookie domain attribute for cross-origin (breaks functionality)

## Troubleshooting Commands

### Check Backend HTTPS

```bash
curl -I https://your-backend.ondigitalocean.app/
# Look for: HTTP/2 200 (indicates HTTPS)
```

### Check CORS Configuration

```bash
curl -X OPTIONS https://your-backend.ondigitalocean.app/api/auth/session \
  -H "Origin: https://www.repaircoin.ai" \
  -H "Access-Control-Request-Method: GET" \
  -v

# Look for:
# Access-Control-Allow-Origin: https://www.repaircoin.ai
# Access-Control-Allow-Credentials: true
```

### Check Cookie Attributes

```javascript
// Run in browser console on your frontend domain
document.cookie.split(';').forEach(c => console.log(c.trim()));

// Note: You won't see httpOnly cookies - that's correct!
// Check DevTools → Application → Cookies instead
```

## Alternative: Testing Without HTTPS (Development Only)

If you need to test cross-domain cookies in development without HTTPS:

1. **Backend**: Set `COOKIE_SECURE=false` in `.env`
2. **Frontend**: Use `http://localhost:4000` instead of HTTPS
3. **Browser**: Chrome allows insecure cookies on localhost

⚠️ **Never use this in production!**

## Contact & Support

If cookies still aren't working after following this guide:

1. Check browser console for errors
2. Check Network tab for cookie headers
3. Verify both backend and frontend use HTTPS
4. Verify CORS configuration
5. Check backend logs for cookie setting confirmation

## References

- [MDN: Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
- [MDN: SameSite cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [Chrome: SameSite cookie changes](https://www.chromium.org/updates/same-site)
