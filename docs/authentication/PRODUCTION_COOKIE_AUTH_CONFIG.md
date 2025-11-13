# Production Cookie Authentication Configuration

## Problem: Cookies Not Working in Production

When frontend is deployed on **Vercel** and backend on **Digital Ocean**, cookies require special cross-origin configuration.

## Root Cause

The default `sameSite: 'strict'` cookie setting blocks cross-site cookies. Since Vercel and Digital Ocean are different domains, the browser treats them as "cross-site" and blocks the cookies.

## Solution Applied

### Backend Changes (`backend/src/routes/auth.ts`)

```typescript
const setAuthCookie = (res: Response, token: string) => {
  const cookieOptions = {
    httpOnly: true,
    secure: true,           // Required for sameSite: 'none'
    sameSite: 'none',       // Allow cross-site cookies
    maxAge: 24 * 60 * 60 * 1000,
    path: '/'
  };
  res.cookie('auth_token', token, cookieOptions);
};
```

### Key Changes:
- **`sameSite: 'none'`** - Allows cookies to be sent between Vercel and Digital Ocean
- **`secure: true`** - Required when using `sameSite: 'none'` (enforces HTTPS)
- **`httpOnly: true`** - Prevents JavaScript access (XSS protection)

## Required Environment Variables

### Backend (Digital Ocean)

Ensure these are set in Digital Ocean App Platform:

```bash
NODE_ENV=production
FRONTEND_URL=https://your-app.vercel.app  # Your Vercel deployment URL
JWT_SECRET=<your-strong-secret-32-chars-min>

# CORS will automatically allow:
# - https://repaircoin.ai
# - https://www.repaircoin.ai
# - *.vercel.app domains
# - *.ondigitalocean.app domains
```

### Frontend (Vercel)

Ensure this is set in Vercel Environment Variables:

```bash
NEXT_PUBLIC_API_URL=https://your-api.ondigitalocean.app/api
```

## HTTPS Requirements

**Both frontend and backend MUST use HTTPS in production.**

- ✅ Vercel provides HTTPS automatically
- ✅ Digital Ocean App Platform provides HTTPS automatically
- ❌ Cookies with `sameSite: 'none'` will **fail** over HTTP

## Testing Checklist

### 1. Check Backend CORS Headers

Open DevTools → Network → Select any API call → Check Response Headers:

```
Access-Control-Allow-Origin: https://your-app.vercel.app
Access-Control-Allow-Credentials: true
```

### 2. Check Cookie is Set

Open DevTools → Application → Cookies → Check for `auth_token`:

```
Name: auth_token
Value: eyJhbGciOiJIUzI1... (JWT token)
Domain: your-api.ondigitalocean.app
Path: /
Secure: ✓ (must be checked)
HttpOnly: ✓ (must be checked)
SameSite: None (must be None for cross-origin)
```

### 3. Check Cookie is Sent with Requests

Open DevTools → Network → Select any API call → Check Request Headers:

```
Cookie: auth_token=eyJhbGciOiJIUzI1...
```

If cookie is NOT in Request Headers, check:
- Is `withCredentials: true` set in axios config? ✅ (already done)
- Is `sameSite` set to `none`? ✅ (just fixed)
- Are both sites using HTTPS? (required)

## Common Issues & Solutions

### Issue 1: Cookie Set but Not Sent
**Symptom:** Cookie appears in DevTools → Cookies but not in request headers

**Solutions:**
- ✅ Verify `sameSite: 'none'` in backend
- ✅ Verify both sites use HTTPS
- ✅ Verify `withCredentials: true` in frontend axios config
- ✅ Clear browser cookies and try again

### Issue 2: Cookie Not Set at All
**Symptom:** No cookie appears after login

**Solutions:**
- Check CORS headers include `Access-Control-Allow-Credentials: true`
- Check Set-Cookie header is present in login response
- Verify backend `credentials: true` in CORS config
- Check browser console for CORS errors

### Issue 3: CORS Errors
**Symptom:** "No 'Access-Control-Allow-Origin' header present"

**Solutions:**
- Verify `FRONTEND_URL` environment variable is set in backend
- Check backend CORS config includes your Vercel URL
- Verify Vercel URL matches exactly (with/without www)

### Issue 4: 401 Unauthorized on Every Request
**Symptom:** User logs in but immediately gets 401 on next request

**Solutions:**
- ✅ This was the main issue - `sameSite: 'strict'` blocked cookies
- ✅ Now fixed with `sameSite: 'none'`
- Verify cookie is being sent (check Network tab)

## Alternative: Same-Domain Deployment

If you want to avoid cross-origin cookies entirely, deploy both on the same domain:

**Option A: Subdomain**
- Frontend: `https://app.repaircoin.ai`
- Backend: `https://api.repaircoin.ai`
- Cookie settings: `sameSite: 'lax'`, `domain: '.repaircoin.ai'`

**Option B: Path-based routing**
- Frontend: `https://repaircoin.ai/*`
- Backend: `https://repaircoin.ai/api/*`
- Cookie settings: `sameSite: 'lax'`

This would allow stricter cookie settings but requires DNS/routing configuration.

## Security Notes

### Current Security (Cross-Origin with sameSite: none)
- ✅ **XSS Protection:** httpOnly prevents JavaScript access
- ✅ **HTTPS Required:** secure flag enforces encryption
- ⚠️ **CSRF Risk:** sameSite: none increases CSRF vulnerability
- ✅ **CSRF Mitigation:** Backend validates requests, check Origin header

### Recommended Additional Protections
1. **CSRF Token:** Consider adding CSRF token validation
2. **Origin Validation:** Backend already validates Origin header via CORS
3. **Short Expiration:** Cookie expires in 24 hours (consider refresh tokens)
4. **Token Rotation:** Implement token refresh/rotation for enhanced security

## Deployment Steps

### 1. Deploy Backend to Digital Ocean

```bash
# Push changes to trigger deployment
git push origin main

# Or deploy manually via DO dashboard
```

Verify environment variables in Digital Ocean App Platform:
- NODE_ENV=production
- FRONTEND_URL=https://your-vercel-app.vercel.app
- JWT_SECRET=(your secret)

### 2. Deploy Frontend to Vercel

```bash
# Push changes to trigger deployment
git push origin main

# Or deploy via Vercel dashboard
```

Verify environment variables in Vercel:
- NEXT_PUBLIC_API_URL=https://your-backend.ondigitalocean.app/api

### 3. Test End-to-End

1. Visit your Vercel app
2. Connect wallet and sign in
3. Open DevTools → Application → Cookies
4. Verify `auth_token` cookie is present with correct settings
5. Navigate to protected pages (dashboard)
6. Open DevTools → Network → Check requests include Cookie header
7. Verify no 401 errors

## Monitoring

After deployment, monitor for:
- Login success rate
- 401 error frequency
- CORS error logs in backend
- Cookie setting/transmission issues

Check backend logs:
```bash
# Digital Ocean
doctl apps logs <app-id> --follow
```

## Rollback Plan

If issues persist:

1. **Quick Fix:** Revert to Authorization header method
   - Frontend: Restore localStorage token storage
   - Backend: Auth middleware already supports Bearer tokens as fallback

2. **Full Rollback:** Revert to previous commit before cookie migration
   ```bash
   git revert <cookie-migration-commit-hash>
   git push origin main
   ```

## Support

If issues persist after following this guide:
1. Check browser DevTools Console for errors
2. Check browser DevTools Network tab for CORS/cookie issues
3. Check backend logs for authentication errors
4. Verify all environment variables are set correctly
5. Clear browser cookies and cache, try again

---

**Last Updated:** 2025-11-10
**Status:** Production-ready for cross-origin deployment
