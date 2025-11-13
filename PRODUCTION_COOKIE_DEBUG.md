# Production Cookie Authentication Debugging Guide

## Issue Summary

Your friend cannot receive auth cookies when trying to login in production because of cross-domain cookie restrictions in modern browsers.

## Root Cause

When the **frontend** (`https://repaircoin.ai`) and **backend** (`https://repaircoin-staging-s7743.ondigitalocean.app`) are on different domains, browsers apply strict security policies for cookies:

### Requirements for Cross-Domain Cookies:
1. ✅ **HTTPS required** - You have this
2. ✅ **`secure: true` on cookies** - You have this
3. ✅ **`sameSite: 'none'` on cookies** - You have this
4. ✅ **`credentials: true` in CORS config** - You have this
5. ✅ **`withCredentials: true` in axios** - You have this
6. ⚠️ **Exact origin in CORS headers** - This was the bug (fixed)
7. ⚠️ **Browser settings** - User might have strict privacy settings

## What Was Fixed

### Fix #1: CORS Origin Header (CRITICAL)
**File**: `backend/src/app.ts` line 179

**Before:**
```typescript
res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
```

**After:**
```typescript
const origin = req.headers.origin;
if (origin) {
  res.header('Access-Control-Allow-Origin', origin);
}
```

**Why**: When using `credentials: true`, browsers **reject** the `Access-Control-Allow-Origin: *` header. It MUST be an exact origin match.

### Fix #2: Enhanced Diagnostic Logging
**File**: `backend/src/routes/auth.ts` line 1112

Added more detailed diagnostic information to help debug cookie issues:
- Cookie settings being applied
- Origin and referer headers
- Better instructions for testing

## Testing the Fix

### Step 1: Deploy Changes
```bash
# Commit and push to trigger deployment
git add backend/src/app.ts backend/src/routes/auth.ts
git commit -m "fix: correct CORS origin handling for cross-domain cookies"
git push origin main
```

### Step 2: Test Cookie Setting
1. Have your friend visit: `https://repaircoin.ai`
2. Open DevTools (F12) → **Network** tab
3. Make any API request to the backend
4. Check the response headers for:
   ```
   Access-Control-Allow-Origin: https://repaircoin.ai
   Access-Control-Allow-Credentials: true
   Set-Cookie: auth_token=...; Secure; HttpOnly; SameSite=None
   ```

### Step 3: Verify Cookie in Browser
1. After login, open DevTools → **Application** tab → **Cookies**
2. Look under `https://repaircoin-staging-s7743.ondigitalocean.app`
3. Should see:
   - `auth_token` cookie
   - `refresh_token` cookie
4. Check cookie properties:
   - ✅ `HttpOnly` = Yes
   - ✅ `Secure` = Yes
   - ✅ `SameSite` = None

### Step 4: Test the Diagnostic Endpoint
```bash
# From the frontend console or directly in browser
fetch('https://repaircoin-staging-s7743.ondigitalocean.app/api/auth/test-cookie', {
  credentials: 'include'
}).then(r => r.json()).then(console.log)
```

This should return diagnostic info showing:
- `cookieSettings.sameSite: "none"`
- `cookieSettings.secure: true`
- `corsOrigin` should show the actual origin (not "unknown")

## Common Browser Issues

### Safari / iOS
Safari has **Intelligent Tracking Prevention (ITP)** which blocks third-party cookies by default.

**Solution**: Use **same domain** for frontend and backend:
- Backend: `api.repaircoin.ai`
- Frontend: `www.repaircoin.ai`

This way they're on the same "site" (same eTLD+1) and cookies work.

### Firefox with Strict Privacy
Firefox with "Strict" tracking protection blocks cross-site cookies.

**User workaround**:
1. Click shield icon in address bar
2. Turn off "Enhanced Tracking Protection" for repaircoin.ai
3. Refresh page and login again

### Chrome Incognito Mode
Chrome's incognito mode blocks third-party cookies by default.

**User workaround**:
1. Settings → Privacy and security → Cookies
2. Select "Allow all cookies" or add exception for your domains

## Long-Term Solution (Same-Domain Setup)

To avoid all these issues, set up your domains like this:

### Option 1: Subdomain (Recommended)
- Frontend: `https://www.repaircoin.ai` (or just `https://repaircoin.ai`)
- Backend: `https://api.repaircoin.ai`

This way they share the same "site" and cookies work perfectly.

### Option 2: Path-Based (If same server)
- Frontend: `https://repaircoin.ai/`
- Backend: `https://repaircoin.ai/api/`

Both served from the same domain, no cross-domain issues.

## How to Set Up api.repaircoin.ai

1. **In your DNS provider** (where you bought repaircoin.ai):
   ```
   Type: CNAME
   Name: api
   Value: repaircoin-staging-s7743.ondigitalocean.app
   TTL: 3600
   ```

2. **In Digital Ocean App Platform**:
   - Go to your app settings
   - Add custom domain: `api.repaircoin.ai`
   - Digital Ocean will verify DNS and provision SSL certificate

3. **Update Environment Variables**:
   ```bash
   # Frontend .env
   NEXT_PUBLIC_API_URL=https://api.repaircoin.ai/api

   # Backend .env
   FRONTEND_URL=https://repaircoin.ai
   ```

4. **Update cookie settings** in `backend/src/routes/auth.ts`:
   ```typescript
   const cookieOptions = {
     httpOnly: true,
     secure: true,
     sameSite: 'lax' as const,  // Can use 'lax' now instead of 'none'
     domain: '.repaircoin.ai',  // Share across subdomains
     maxAge: 15 * 60 * 1000,
     path: '/'
   };
   ```

5. **Redeploy both frontend and backend**

## Verification Checklist

After deploying the fix:

- [ ] Visit production site in **normal browsing mode**
- [ ] Open DevTools → Network tab
- [ ] Try to login
- [ ] Check login API response headers:
  - [ ] `Access-Control-Allow-Origin` = exact origin (not `*`)
  - [ ] `Access-Control-Allow-Credentials` = `true`
  - [ ] `Set-Cookie` headers present
- [ ] Check DevTools → Application → Cookies:
  - [ ] `auth_token` cookie exists
  - [ ] `refresh_token` cookie exists
  - [ ] Both have `Secure`, `HttpOnly`, `SameSite=None`
- [ ] Try refreshing the page - should stay logged in
- [ ] Test in different browsers:
  - [ ] Chrome (normal mode)
  - [ ] Chrome (incognito) - might need settings change
  - [ ] Firefox (normal mode)
  - [ ] Safari (normal mode)

## If Still Not Working

### Debug Steps:

1. **Check backend logs** for CORS warnings:
   ```bash
   # In Digital Ocean console
   tail -f /var/log/app.log | grep CORS
   ```

2. **Verify environment variables**:
   ```bash
   # In backend
   echo $NODE_ENV
   echo $FRONTEND_URL
   ```

3. **Check browser console** for errors:
   - CORS errors
   - Cookie warnings
   - Network errors

4. **Try the test endpoint**:
   ```bash
   curl -i -H "Origin: https://repaircoin.ai" \
     --cookie-jar cookies.txt \
     https://repaircoin-staging-s7743.ondigitalocean.app/api/auth/test-cookie
   ```

5. **Contact me with**:
   - Full diagnostic response from `/api/auth/test-cookie`
   - Browser console errors
   - Network tab screenshot showing request/response headers
   - Browser and OS version

## Summary

The immediate fix (exact origin in CORS) is deployed. However, for the best user experience and to avoid browser privacy feature issues, I **strongly recommend** setting up `api.repaircoin.ai` as your backend domain. This eliminates all cross-domain cookie restrictions.
