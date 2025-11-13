# Production Cookie Issue - Diagnosis & Fix

## Problem
Cookies are not being passed from backend to frontend in production, causing authentication to fail.

## Root Causes

### 1. **Cross-Origin Cookie Blocking (Most Likely)**
Modern browsers block third-party cookies by default. Your setup:
- Frontend: `www.repaircoin.ai` (Vercel)
- Backend: `*.ondigitalocean.app` (Digital Ocean)

These are **different domains**, so cookies are considered "third-party" and may be blocked.

### 2. **Missing Environment Variables**
Your frontend `.env` file points to `localhost:3002`, but in production it needs to point to your actual backend URL.

### 3. **HTTPS/Secure Cookie Requirements**
Cookies with `secure: true` and `sameSite: 'none'` only work over HTTPS.

---

## Solutions

### Option 1: Use Subdomain (RECOMMENDED)

Use a subdomain for your backend so it's the same domain as frontend:

**Current (cross-origin):**
- Frontend: `www.repaircoin.ai`
- Backend: `repaircoin-backend-xyz.ondigitalocean.app`

**Recommended (same-origin):**
- Frontend: `www.repaircoin.ai`
- Backend: `api.repaircoin.ai` (points to Digital Ocean backend)

**Steps:**
1. Add DNS record in your `repaircoin.ai` domain:
   ```
   Type: CNAME
   Name: api
   Value: repaircoin-backend-xyz.ondigitalocean.app
   ```

2. Update cookie settings in `backend/src/routes/auth.ts`:
   ```typescript
   const cookieOptions = {
     httpOnly: true,
     secure: true,
     sameSite: 'lax' as const,  // Changed from 'none'
     maxAge: 15 * 60 * 1000,
     path: '/',
     domain: '.repaircoin.ai'  // Include subdomain
   };
   ```

3. Set Vercel environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://api.repaircoin.ai/api
   NEXT_PUBLIC_BACKEND_URL=https://api.repaircoin.ai
   ```

4. Redeploy both backend and frontend

---

### Option 2: Keep Current Setup (Requires Browser Compatibility Check)

If you want to keep separate domains, ensure:

1. **Verify HTTPS on both domains**
   - Frontend: ✅ `https://www.repaircoin.ai`
   - Backend: ❓ Must be HTTPS (check Digital Ocean app settings)

2. **Set Vercel Environment Variables:**
   Go to Vercel Project Settings → Environment Variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-url.ondigitalocean.app/api
   NEXT_PUBLIC_BACKEND_URL=https://your-backend-url.ondigitalocean.app
   NEXT_PUBLIC_APP_URL=https://www.repaircoin.ai
   ```

3. **Verify CORS is allowing your frontend:**
   Check backend logs for CORS blocks. Your backend already allows:
   - `https://repaircoin.ai`
   - `https://www.repaircoin.ai`
   - All `*.vercel.app` domains
   - All `*.ondigitalocean.app` domains

4. **Test in different browsers:**
   - Chrome: May block third-party cookies (check Settings → Privacy)
   - Firefox: May block third-party cookies
   - Safari: Blocks third-party cookies by default

---

## Quick Diagnosis

### Check if cookies are being set:

1. **Open DevTools** (F12) on `www.repaircoin.ai`
2. **Go to Network tab**
3. **Login to your app**
4. **Find the auth request** (e.g., `/api/auth/customer`)
5. **Check Response Headers** - Look for:
   ```
   Set-Cookie: auth_token=...; HttpOnly; Secure; SameSite=none
   Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=none
   ```

6. **Check Application tab → Cookies**
   - If cookies appear under your backend domain but NOT frontend domain = third-party cookie block
   - If NO cookies appear at all = CORS or HTTPS issue

---

## Current Code Status

Your code is **already configured correctly** for cross-origin cookies:

**Backend:**
- ✅ `credentials: true` in CORS
- ✅ `secure: true` on cookies
- ✅ `sameSite: 'none'` on cookies
- ✅ Allows `www.repaircoin.ai` origin

**Frontend:**
- ✅ `withCredentials: true` in axios
- ❌ `.env` points to localhost (needs production URL)

---

## Action Items

### Immediate Fix (Test in Production):

1. **Set Vercel Environment Variables** (highest priority):
   ```bash
   # In Vercel Dashboard → Project → Settings → Environment Variables
   NEXT_PUBLIC_API_URL=https://[YOUR-BACKEND-URL]/api
   NEXT_PUBLIC_BACKEND_URL=https://[YOUR-BACKEND-URL]
   ```

2. **Redeploy frontend** from Vercel

3. **Test login** and check DevTools

### Long-term Fix (Recommended):

1. **Set up subdomain** `api.repaircoin.ai` → Digital Ocean backend
2. **Update cookie settings** to `sameSite: 'lax'` and `domain: '.repaircoin.ai'`
3. **Update environment variables** to use `api.repaircoin.ai`
4. **Redeploy both** backend and frontend

---

## Testing Checklist

After deploying fixes:

- [ ] Login works in Chrome (incognito)
- [ ] Login works in Firefox (private)
- [ ] Login works in Safari (private)
- [ ] Cookies persist after page refresh
- [ ] API calls include auth cookie
- [ ] WebSocket connects with auth cookie
- [ ] Logout clears cookies
- [ ] Token refresh works

---

## Additional Notes

### Why httpOnly cookies?
- More secure (JavaScript can't access them, preventing XSS attacks)
- The backend returns the token in the response body as backup

### Why sameSite: 'none'?
- Required for cross-origin cookie support
- Only works with `secure: true` (HTTPS)

### Browser Compatibility
- Chrome 80+: Requires `sameSite: 'none'` + `secure: true` for cross-origin
- Firefox 69+: Same as Chrome
- Safari 13+: Blocks third-party cookies by default (may need same-origin setup)

---

## Support

If issues persist after setting environment variables:
1. Check browser console for CORS errors
2. Check Network tab for cookie headers
3. Verify backend URL is accessible via HTTPS
4. Consider switching to subdomain approach (Option 1)
