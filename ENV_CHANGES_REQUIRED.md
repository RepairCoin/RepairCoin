# Environment Variable Changes for Subdomain Setup

**Quick Reference:** What you need to add/change for the subdomain cookie setup

---

## 🔴 BACKEND - Changes Required

### For Local Development (.env file)

**ADD this new line** to your backend `.env`:

```bash
# ============================================
# NEW: Cookie Domain Configuration (add this line)
# ============================================
# Leave empty for local development (cookies work without domain)
COOKIE_DOMAIN=

# Or you can omit it entirely for local development
```

**Your backend `.env` already has:**
```bash
FRONTEND_URL=http://localhost:3001  ✅ Correct for local dev
NODE_ENV=production  ⚠️ Should be 'development' for local dev
```

### For Production Deployment (Digital Ocean/Your Backend Host)

**ADD these environment variables** in your deployment platform:

```bash
# ============================================
# NEW - REQUIRED for subdomain cookie sharing
# ============================================
COOKIE_DOMAIN=.repaircoin.ai

# ============================================
# UPDATE these for production
# ============================================
FRONTEND_URL=https://repaircoin.ai
NODE_ENV=production

# ============================================
# All other variables remain the same
# ============================================
```

**How to add in Digital Ocean:**
1. Go to your app in Digital Ocean dashboard
2. Settings → App-Level Environment Variables
3. Click "Edit" or "Add Variable"
4. Add: `COOKIE_DOMAIN` = `.repaircoin.ai`
5. Update: `FRONTEND_URL` = `https://repaircoin.ai`
6. Click "Save"
7. Redeploy the app

---

## 🔵 FRONTEND - Changes Required

### For Local Development (.env file)

**NO CHANGES NEEDED** - Your current settings are perfect for local dev:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3002/api  ✅ Correct
NEXT_PUBLIC_BACKEND_URL=http://localhost:3002  ✅ Correct
NEXT_PUBLIC_APP_URL=http://localhost:3001      ✅ Correct
```

### For Production Deployment (Vercel/Your Frontend Host)

**CHANGE these environment variables** in your deployment platform:

```bash
# ============================================
# CHANGE - Point to backend subdomain
# ============================================
NEXT_PUBLIC_API_URL=https://api.repaircoin.ai/api
NEXT_PUBLIC_BACKEND_URL=https://api.repaircoin.ai
NEXT_PUBLIC_APP_URL=https://repaircoin.ai

# ============================================
# All other variables remain the same
# ============================================
NEXT_PUBLIC_RCN_CONTRACT_ADDRESS=0xBFE793d78B6B83859b528F191bd6F2b8555D951C
NEXT_PUBLIC_RCN_THIRDWEB_CLIENT_ID=1969ac335e07ba13ad0f8d1a1de4f6ab
# ... etc (no changes to these)
```

**How to change in Vercel:**
1. Go to your project in Vercel dashboard
2. Settings → Environment Variables
3. Find `NEXT_PUBLIC_API_URL` and click "Edit"
4. Change value to: `https://api.repaircoin.ai/api`
5. Find `NEXT_PUBLIC_BACKEND_URL` and click "Edit"
6. Change value to: `https://api.repaircoin.ai`
7. Find `NEXT_PUBLIC_APP_URL` and click "Edit"
8. Change value to: `https://repaircoin.ai`
9. Click "Save"
10. Redeploy the app

---

## 📋 Quick Checklist

### Before Deployment

**Backend:**
- [ ] DNS configured: `api.repaircoin.ai` → Your backend server
- [ ] Add `COOKIE_DOMAIN=.repaircoin.ai` to production env vars
- [ ] Update `FRONTEND_URL=https://repaircoin.ai` in production
- [ ] Verify `NODE_ENV=production` in production

**Frontend:**
- [ ] Change `NEXT_PUBLIC_API_URL=https://api.repaircoin.ai/api` in production
- [ ] Change `NEXT_PUBLIC_BACKEND_URL=https://api.repaircoin.ai` in production
- [ ] Change `NEXT_PUBLIC_APP_URL=https://repaircoin.ai` in production

### Deployment Order

1. **Backend First:**
   - Add/update environment variables
   - Deploy backend code
   - Verify deployment successful
   - Test `/api/auth/test-cookie` endpoint

2. **Frontend Second:**
   - Update environment variables
   - Deploy frontend code
   - Verify deployment successful
   - Test login flow

3. **Verify:**
   - Check cookies in browser DevTools
   - Test authentication across browsers
   - Test on Safari/iOS

---

## 🔍 How to Verify

### Backend Verification

After setting `COOKIE_DOMAIN` in backend, check logs for:

```
✓ Cookie domain configured: .repaircoin.ai
✓ CORS configured for: https://repaircoin.ai
```

Test the cookie endpoint:
```bash
curl -v https://api.repaircoin.ai/api/auth/test-cookie
# Look for: Set-Cookie with Domain=.repaircoin.ai
```

### Frontend Verification

After updating frontend env vars, check browser console:

```javascript
// Should see in console:
API URL: https://api.repaircoin.ai/api
```

Check DevTools → Application → Cookies after login:

```
Name: auth_token
Domain: .repaircoin.ai  ← Should show this
Secure: ✓
HttpOnly: ✓
SameSite: Lax
```

---

## 🚨 Common Mistakes to Avoid

### Backend

❌ **Don't forget the leading dot:**
```bash
COOKIE_DOMAIN=repaircoin.ai  ❌ WRONG
COOKIE_DOMAIN=.repaircoin.ai ✅ CORRECT
```

❌ **Don't use http in production:**
```bash
FRONTEND_URL=http://repaircoin.ai  ❌ WRONG
FRONTEND_URL=https://repaircoin.ai ✅ CORRECT
```

### Frontend

❌ **Don't forget the /api suffix:**
```bash
NEXT_PUBLIC_API_URL=https://api.repaircoin.ai     ❌ WRONG
NEXT_PUBLIC_API_URL=https://api.repaircoin.ai/api ✅ CORRECT
```

❌ **Don't use trailing slashes:**
```bash
NEXT_PUBLIC_API_URL=https://api.repaircoin.ai/api/  ❌ WRONG
NEXT_PUBLIC_API_URL=https://api.repaircoin.ai/api   ✅ CORRECT
```

---

## 📝 Summary

### What's NEW:
- **Backend**: `COOKIE_DOMAIN=.repaircoin.ai` (NEW variable for production)

### What's CHANGED:
- **Backend**: `FRONTEND_URL` → `https://repaircoin.ai` (production only)
- **Frontend**: `NEXT_PUBLIC_API_URL` → `https://api.repaircoin.ai/api` (production only)
- **Frontend**: `NEXT_PUBLIC_BACKEND_URL` → `https://api.repaircoin.ai` (production only)
- **Frontend**: `NEXT_PUBLIC_APP_URL` → `https://repaircoin.ai` (production only)

### What's UNCHANGED:
- All blockchain configuration (RCN, RCG contracts)
- Database configuration
- JWT secrets
- Admin addresses
- Stripe configuration
- All other settings

---

## 🎯 Development vs Production Summary

| Variable | Development | Production |
|----------|-------------|------------|
| **Backend** | | |
| `COOKIE_DOMAIN` | Empty or omit | `.repaircoin.ai` |
| `FRONTEND_URL` | `http://localhost:3001` | `https://repaircoin.ai` |
| `NODE_ENV` | `development` | `production` |
| **Frontend** | | |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3002/api` | `https://api.repaircoin.ai/api` |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:3002` | `https://api.repaircoin.ai` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3001` | `https://repaircoin.ai` |

---

**Last Updated:** 2025-11-14
**For:** Subdomain Cookie Setup (api.repaircoin.ai)
