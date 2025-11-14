# Subdomain Cookie Authentication Migration Summary

**Date:** 2025-11-14
**Status:** ✅ Complete
**Migration:** Cross-Origin → Subdomain Setup

---

## Overview

Successfully migrated cookie authentication from cross-origin setup to subdomain setup for improved security and compatibility.

### Architecture Change

**Before:**
- Frontend: `https://www.repaircoin.ai` (Vercel)
- Backend: `https://backend.ondigitalocean.app` (Digital Ocean)
- Cookie Settings: `sameSite: 'none'`, no domain attribute

**After:**
- Frontend: `https://repaircoin.ai` or `https://www.repaircoin.ai`
- Backend: `https://api.repaircoin.ai`
- Cookie Settings: `sameSite: 'lax'`, `domain: '.repaircoin.ai'`

---

## Files Modified

### Backend Changes

#### 1. `/backend/src/routes/auth.ts`

**Modified Functions:**
- `setAuthCookie()` - Legacy function (lines 34-79)
- `generateAndSetTokens()` - Main token generation (lines 70-161)
- `/logout` endpoint - Cookie clearing (lines 953-1025)
- `/refresh` endpoint - Token refresh (lines 1010-1147)
- `/test-cookie` endpoint - Cookie testing (lines 1126-1223)

**Changes Made:**
```typescript
// Added cookie domain configuration
const cookieDomain = process.env.COOKIE_DOMAIN; // '.repaircoin.ai'

// Changed sameSite from 'none' to 'lax'
sameSite: 'lax' as 'lax'

// Added domain attribute when in production
if (isProduction && cookieDomain) {
  cookieOptions.domain = cookieDomain;
}
```

**Benefits:**
- ✅ Better CSRF protection with `sameSite: 'lax'`
- ✅ Cross-subdomain cookie sharing
- ✅ Improved Safari/iOS compatibility
- ✅ Environment-based configuration

#### 2. `/backend/src/app.ts`

**Modified:** CORS Configuration (lines 93-140)

**Changes Made:**
```typescript
// Added backend subdomain to allowed origins
const allowedOrigins = [
  // ... existing origins
  'https://api.repaircoin.ai', // NEW
];
```

**Added Comments:**
```typescript
// SUBDOMAIN SETUP: Backend at api.repaircoin.ai,
// Frontend at repaircoin.ai/www.repaircoin.ai
```

### Frontend Changes

**No code changes required!** ✅

The frontend already uses `withCredentials: true` which automatically handles cookies for same-site and subdomain requests.

**Only requires environment variable update:**
```bash
NEXT_PUBLIC_API_URL=https://api.repaircoin.ai/api
```

---

## New Environment Variables

### Backend

**Required in Production:**
```bash
# NEW - Required for subdomain cookie sharing
COOKIE_DOMAIN=.repaircoin.ai

# Existing (update if needed)
FRONTEND_URL=https://repaircoin.ai
NODE_ENV=production
```

**Optional:**
```bash
# Force secure cookies (default: true in production)
COOKIE_SECURE=true
```

### Frontend

**Update in Production:**
```bash
# Point to backend subdomain
NEXT_PUBLIC_API_URL=https://api.repaircoin.ai/api
NEXT_PUBLIC_BACKEND_URL=https://api.repaircoin.ai
```

---

## Documentation Created

1. **`/docs/authentication/SUBDOMAIN_COOKIE_SETUP.md`**
   - Complete guide for subdomain cookie setup
   - Configuration details
   - Testing checklist
   - Troubleshooting guide
   - Migration steps

2. **`/docs/deployment/SUBDOMAIN_ENV_VARS.md`**
   - Environment variable reference
   - Production vs development configs
   - Platform-specific notes
   - Validation steps

3. **`/docs/authentication/SUBDOMAIN_MIGRATION_SUMMARY.md`** (this file)
   - Summary of changes
   - Quick reference

---

## Security Improvements

| Aspect | Before (Cross-Origin) | After (Subdomain) | Improvement |
|--------|----------------------|-------------------|-------------|
| **CSRF Protection** | None (`sameSite: 'none'`) | Good (`sameSite: 'lax'`) | ⬆️ High |
| **Browser Compatibility** | Poor (Safari blocks) | Excellent | ⬆️ High |
| **Cookie Scope** | Single domain | Subdomain sharing | ✅ Better |
| **XSS Protection** | `httpOnly: true` ✅ | `httpOnly: true` ✅ | Same |
| **Transport Security** | `secure: true` ✅ | `secure: true` ✅ | Same |

---

## Deployment Checklist

### Pre-Deployment

- [x] Code changes completed
- [x] Documentation created
- [x] Environment variables documented
- [ ] DNS configured for `api.repaircoin.ai`
- [ ] Backend environment variables ready
- [ ] Frontend environment variables ready

### Backend Deployment

1. **Set Environment Variables:**
   ```bash
   COOKIE_DOMAIN=.repaircoin.ai
   FRONTEND_URL=https://repaircoin.ai
   NODE_ENV=production
   ```

2. **Deploy Code:**
   ```bash
   git push origin main  # Triggers auto-deploy
   ```

3. **Verify Logs:**
   - Check for "Cookie domain configured: .repaircoin.ai"
   - Check for CORS configuration logs
   - Verify no errors

### Frontend Deployment

1. **Set Environment Variables:**
   ```bash
   NEXT_PUBLIC_API_URL=https://api.repaircoin.ai/api
   NEXT_PUBLIC_BACKEND_URL=https://api.repaircoin.ai
   ```

2. **Deploy Code:**
   ```bash
   git push origin main  # Triggers auto-deploy
   ```

3. **Verify:**
   - Check API URL in browser console
   - Test authentication flow

### Post-Deployment Testing

- [ ] Login as admin
- [ ] Login as shop
- [ ] Login as customer
- [ ] Check cookies in DevTools (domain should be `.repaircoin.ai`)
- [ ] Test across browsers (Chrome, Firefox, Safari)
- [ ] Test on mobile Safari/iOS
- [ ] Verify auto-refresh works
- [ ] Test logout functionality

---

## Backward Compatibility

The changes maintain backward compatibility:

1. **Development Environment:**
   - No `COOKIE_DOMAIN` set → Works on localhost as before
   - `sameSite: 'lax'` → Works fine for localhost

2. **Legacy Token Support:**
   - Still supports 24h legacy tokens
   - Backend auth middleware handles both cookie and Bearer token

3. **API Responses:**
   - Still returns `token` in response body for backward compatibility
   - Cookies set in addition to response body token

---

## Rollback Plan

If issues occur in production:

### Quick Rollback (Environment Variables Only)

**Backend:**
```bash
# Remove or comment out
# COOKIE_DOMAIN=.repaircoin.ai
```

**Frontend:**
```bash
# Revert to old API URL if needed
NEXT_PUBLIC_API_URL=https://old-backend-url.com/api
```

### Full Rollback (Code + Environment)

```bash
# Revert commits
git revert <commit-hash>
git push origin main

# Restore environment variables
# Follow previous configuration
```

---

## Monitoring

### Metrics to Watch

**First 24 Hours:**
- Login success rate (should remain same or improve)
- Cookie set rate (should be near 100%)
- CORS errors (should remain at 0)
- Safari/iOS login success (should improve)

**Ongoing:**
- Token refresh success rate (>95%)
- Authentication error rate
- Browser-specific issues

### Logging

Backend now logs cookie configuration:

```json
{
  "cookieSettings": {
    "domain": ".repaircoin.ai",
    "sameSite": "lax",
    "secure": true,
    "httpOnly": true
  }
}
```

Monitor these logs to verify correct configuration.

---

## Common Issues & Quick Fixes

### Issue: Cookies Not Set

**Quick Fix:**
```bash
# Verify environment variable is set
echo $COOKIE_DOMAIN
# Should output: .repaircoin.ai

# Check backend logs for cookie setting confirmation
```

### Issue: CORS Errors

**Quick Fix:**
```bash
# Verify FRONTEND_URL is set correctly
echo $FRONTEND_URL
# Should output: https://repaircoin.ai

# Check CORS allowed origins in logs
```

### Issue: Cookies Work in Chrome but not Safari

**Check:**
- ✅ Using `sameSite: 'lax'` (not `'none'`)
- ✅ Using `domain: '.repaircoin.ai'`
- ✅ Both sites use HTTPS

---

## Testing Commands

### Test Cookie Endpoint

```bash
# Test cookie setting
curl -v https://api.repaircoin.ai/api/auth/test-cookie

# Look for Set-Cookie header with:
# - Domain=.repaircoin.ai
# - SameSite=Lax
# - Secure
# - HttpOnly
```

### Test Authentication

```bash
# Login
curl -X POST https://api.repaircoin.ai/api/auth/admin \
  -H "Content-Type: application/json" \
  -d '{"address":"0x1234..."}' \
  -c cookies.txt

# Check cookies were saved
cat cookies.txt

# Make authenticated request
curl https://api.repaircoin.ai/api/auth/session \
  -b cookies.txt
```

---

## Related Documentation

- [Authentication README](./README.md) - Full auth system overview
- [Subdomain Cookie Setup](./SUBDOMAIN_COOKIE_SETUP.md) - Detailed setup guide
- [Environment Variables](../deployment/SUBDOMAIN_ENV_VARS.md) - Complete env var reference
- [Production Cookie Config](./PRODUCTION_COOKIE_AUTH_CONFIG.md) - Previous cross-origin setup

---

## Support

For issues or questions:

1. Check [SUBDOMAIN_COOKIE_SETUP.md](./SUBDOMAIN_COOKIE_SETUP.md) troubleshooting section
2. Review environment variables in [SUBDOMAIN_ENV_VARS.md](../deployment/SUBDOMAIN_ENV_VARS.md)
3. Check browser DevTools console and Network tab
4. Review backend logs for cookie configuration

---

**Migration Status:** ✅ Complete
**Ready for Deployment:** ✅ Yes
**Breaking Changes:** ❌ No (backward compatible)
**Environment Variable Changes Required:** ✅ Yes
