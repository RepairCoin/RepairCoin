# Production Deployment Guide - Cookie Authentication Fix

## Quick Fix for Cookie Issues in Production

If cookies are not being sent from your Vercel frontend to Digital Ocean backend, follow these steps:

## 1. Backend Configuration (Digital Ocean)

### Required Environment Variables

```bash
# CRITICAL: Must be set to 'production' for proper cookie settings
NODE_ENV=production

# Your Vercel frontend URL
FRONTEND_URL=https://www.repaircoin.ai

# JWT Configuration
JWT_SECRET=your-super-secret-key-min-32-characters
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Database and other configs...
```

### Verify HTTPS is Enabled

1. Go to Digital Ocean App Console
2. Navigate to Settings → Domains
3. Ensure your domain has HTTPS enabled
4. Test: `curl -I https://your-backend.ondigitalocean.app/` should return HTTP/2 200

### What the Backend Does Automatically

✅ Sets `trust proxy: true` (tells Express to trust X-Forwarded-Proto header)
✅ Configures CORS with `credentials: true`
✅ Allows Vercel domains (`*.vercel.app`)
✅ Sets cookies with correct attributes based on NODE_ENV:
  - Production: `secure: true, sameSite: 'none'`
  - Development: `secure: false, sameSite: 'lax'`

## 2. Frontend Configuration (Vercel)

### Required Environment Variables

```bash
# CRITICAL: Must be HTTPS URL to your backend
NEXT_PUBLIC_API_URL=https://your-backend.ondigitalocean.app/api
```

### What the Frontend Does Automatically

✅ Sends cookies with every request (`withCredentials: true`)
✅ Automatically refreshes tokens when access token expires
✅ Handles 401 errors and redirects to login

## 3. Testing the Fix

### Step 1: Verify Backend Cookie Settings

Visit your backend test endpoint:
```
https://your-backend.ondigitalocean.app/api/auth/test-cookie
```

Open DevTools → Network → Check the response headers:
```
Set-Cookie: test_cookie=...; Path=/; HttpOnly; Secure; SameSite=None
```

### Step 2: Test Login Flow

1. Go to your frontend: `https://www.repaircoin.ai`
2. Connect wallet and login
3. Open DevTools → Application → Cookies → Select your backend domain
4. You should see:
   - `auth_token` (HttpOnly, Secure, SameSite=None)
   - `refresh_token` (HttpOnly, Secure, SameSite=None)

### Step 3: Verify Cookies Are Sent

1. Still in DevTools → Network tab
2. Navigate to any protected page (e.g., dashboard)
3. Click on an API request
4. Check Headers → Request Headers
5. Should see: `Cookie: auth_token=...; refresh_token=...`

## Common Issues & Quick Fixes

### Issue: Cookies set but not sent

**Cause**: Backend not using HTTPS
**Fix**: Enable HTTPS in Digital Ocean app settings

**Cause**: Frontend URL not HTTPS
**Fix**: Update `NEXT_PUBLIC_API_URL` to use `https://`

### Issue: Login succeeds but next request returns 401

**Cause**: `NODE_ENV` not set to `production`
**Fix**: Set `NODE_ENV=production` in Digital Ocean environment variables

### Issue: CORS error when making requests

**Cause**: Backend CORS not configured for your domain
**Fix**: Already configured! Backend allows all `*.vercel.app` and your production domain

### Issue: Mixed Content warning in console

**Cause**: Trying to call HTTP backend from HTTPS frontend
**Fix**: Use HTTPS for backend URL in `NEXT_PUBLIC_API_URL`

## 4. Deploy the Changes

### Backend (Digital Ocean)

1. Commit changes to your repository
2. Push to main branch
3. Digital Ocean will automatically deploy
4. Verify environment variables are set correctly

### Frontend (Vercel)

1. Verify `NEXT_PUBLIC_API_URL` in Vercel dashboard
2. Trigger a new deployment (or push to main)
3. Clear browser cache and cookies after deployment

## 5. Post-Deployment Verification

Run these checks:

```bash
# 1. Backend is using HTTPS
curl -I https://your-backend.ondigitalocean.app/

# 2. CORS configured correctly
curl -X OPTIONS https://your-backend.ondigitalocean.app/api/auth/session \
  -H "Origin: https://www.repaircoin.ai" \
  -H "Access-Control-Request-Method: GET" \
  -v

# 3. Test cookie is set correctly
curl -X GET https://your-backend.ondigitalocean.app/api/auth/test-cookie \
  -H "Origin: https://www.repaircoin.ai" \
  -c cookies.txt -v
cat cookies.txt

# 4. Login and verify session
curl -X POST https://your-backend.ondigitalocean.app/api/auth/admin \
  -H "Content-Type: application/json" \
  -H "Origin: https://www.repaircoin.ai" \
  -d '{"address":"your-admin-address"}' \
  -c cookies.txt -v

curl -X GET https://your-backend.ondigitalocean.app/api/auth/session \
  -H "Origin: https://www.repaircoin.ai" \
  -b cookies.txt -v
```

## Alternative: Override Cookie Settings

If you need to force specific cookie behavior (debugging only):

```bash
# Backend .env - Force secure cookies even in development
COOKIE_SECURE=true

# This is automatically handled based on NODE_ENV, so you rarely need this
```

## Code Changes Summary

### Backend Changes (`backend/src/routes/auth.ts`)

- ✅ Made cookie settings dynamic based on `NODE_ENV`
- ✅ Production: `secure: true, sameSite: 'none'`
- ✅ Development: `secure: false, sameSite: 'lax'`
- ✅ Applied to all cookie operations: set, clear, refresh

### Frontend Changes (`frontend/src/services/api/client.ts`)

- ✅ Removed invalid httpOnly cookie reading code
- ✅ Cookies are automatically sent via `withCredentials: true`
- ✅ Added request ID tracking for debugging

## Need More Help?

See the comprehensive guide: [COOKIE_AUTH_GUIDE.md](./COOKIE_AUTH_GUIDE.md)

## Security Notes

✅ **httpOnly**: Prevents JavaScript from accessing tokens (XSS protection)
✅ **Secure**: Ensures cookies only sent over HTTPS (MITM protection)
✅ **SameSite=None**: Required for cross-domain cookies (with Secure flag)
✅ **Short-lived tokens**: Access token expires in 15 minutes
✅ **Refresh tokens**: 7-day lifetime, stored in database with revocation support

## What NOT to Do

❌ Don't set `secure: false` in production
❌ Don't use `sameSite: 'lax'` for cross-domain in production
❌ Don't set the `domain` attribute for cross-origin cookies
❌ Don't try to read httpOnly cookies with JavaScript
❌ Don't store tokens in localStorage (security risk)
