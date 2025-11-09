# Testing the New HttpOnly Cookie Authentication

## Quick Start

### 1. Start the Backend
```bash
cd backend
npm run dev
# Server should start on http://localhost:4000
```

### 2. Start the Frontend
```bash
cd frontend
npm run dev
# Frontend should start on http://localhost:3001
```

## Manual Testing Steps

### Test 1: Login Flow

1. **Navigate to login page**
   ```
   http://localhost:3001/login
   ```

2. **Connect wallet and login**
   - Click "Connect Wallet"
   - Login as admin/shop/customer

3. **Verify cookie is set**
   - Open DevTools → Application → Cookies
   - Look for `auth_token` cookie
   - Verify it has:
     - HttpOnly: ✓
     - Secure: ✓ (in production)
     - SameSite: Strict/Lax
     - Max-Age: 86400 (24 hours)

4. **Check localStorage is empty**
   - Open DevTools → Application → Local Storage
   - Verify NO tokens stored
   - You might see deprecation warnings in console (expected)

### Test 2: Protected Routes

1. **Try accessing protected route without auth**
   ```
   http://localhost:3001/admin
   ```
   - Should redirect to `/login?redirect=/admin`

2. **Login and access protected route**
   - Complete login
   - Navigate to `/admin` or `/shop` or `/customer`
   - Should load successfully

3. **Refresh the page**
   - Cookie should persist
   - User should remain logged in

### Test 3: API Requests

1. **Open Network tab in DevTools**

2. **Make authenticated API call**
   - Navigate through dashboard
   - Check any API request to `/api/*`

3. **Verify in request headers**
   ```
   Cookie: auth_token=eyJhbGc...
   ```
   - Should see cookie sent automatically
   - Should NOT see `Authorization: Bearer` header (unless using old code)

### Test 4: Logout Flow

1. **Click logout button**
   - Or call `authApi.logout()` in console

2. **Verify cookie is cleared**
   - Open DevTools → Application → Cookies
   - `auth_token` should be gone

3. **Try accessing protected route**
   - Should redirect to login

### Test 5: Token Refresh

1. **Login to the application**

2. **Open browser console**
   ```javascript
   // Call refresh endpoint
   fetch('http://localhost:4000/api/auth/refresh', {
     method: 'POST',
     credentials: 'include'
   }).then(r => r.json()).then(console.log)
   ```

3. **Verify response**
   - Should return `{ success: true, token: "...", user: {...} }`
   - Cookie should be refreshed with new expiration

### Test 6: Backward Compatibility

1. **Test old Authorization header still works**

   Open browser console:
   ```javascript
   // Manually send Authorization header (old method)
   fetch('http://localhost:4000/api/customers/balance/0xYourAddress', {
     headers: {
       'Authorization': 'Bearer YOUR_OLD_TOKEN_HERE'
     }
   }).then(r => r.json()).then(console.log)
   ```

2. **Verify it works**
   - Backend should accept Authorization header
   - Response should be successful

## Debugging

### Check Backend Logs

```bash
cd backend
npm run dev
# Look for authentication logs
```

Expected log patterns:
```
Authenticated admin: 0xabc123...
```

### Check Frontend Console

Open DevTools Console and look for:
- ❌ No errors about missing tokens
- ⚠️ Deprecation warnings (expected from old code using authManager)
- ✅ Successful API calls

### Common Issues

#### Issue: "CORS error"
**Solution:** Verify backend CORS is configured for credentials
```typescript
// backend/src/app.ts should have:
credentials: true
```

#### Issue: "Cookie not sent with request"
**Solution:** Check axios client has:
```typescript
withCredentials: true
```

#### Issue: "Infinite redirect loop"
**Solution:** Check middleware.ts matcher config:
- Should exclude static files
- Should exclude API routes

#### Issue: "401 Unauthorized"
**Possible causes:**
1. Cookie expired (24 hours)
2. Cookie not being sent (check withCredentials)
3. Backend not reading cookie (check cookie-parser middleware)

### Verify Cookie Security

1. **Try to access cookie via JavaScript**
   ```javascript
   // In browser console
   document.cookie
   ```
   - Should NOT see `auth_token` (httpOnly prevents this)
   - This is CORRECT behavior - proves XSS protection

2. **Check cookie flags**
   - DevTools → Application → Cookies → auth_token
   - HttpOnly: ✓ (protects against XSS)
   - Secure: ✓ in production (HTTPS only)
   - SameSite: Strict/Lax (protects against CSRF)

## API Testing with cURL

### Login
```bash
# Customer login
curl -X POST http://localhost:4000/api/auth/customer \
  -H "Content-Type: application/json" \
  -d '{"address":"0x123..."}' \
  -c cookies.txt

# Admin login
curl -X POST http://localhost:4000/api/auth/admin \
  -H "Content-Type: application/json" \
  -d '{"address":"0x123..."}' \
  -c cookies.txt
```

### Make authenticated request
```bash
curl http://localhost:4000/api/customers/balance/0x123... \
  -b cookies.txt
```

### Refresh token
```bash
curl -X POST http://localhost:4000/api/auth/refresh \
  -b cookies.txt \
  -c cookies.txt
```

### Logout
```bash
curl -X POST http://localhost:4000/api/auth/logout \
  -b cookies.txt
```

## Performance Testing

### Measure cookie overhead
```bash
# Before (with localStorage)
# Request size: ~800 bytes

# After (with cookie)
# Request size: ~1000 bytes

# Overhead: ~200 bytes per request
# Impact: Negligible
```

## Security Testing

### Test XSS Protection

1. **Try to steal token via XSS**
   ```javascript
   // In console
   console.log(document.cookie); // Should NOT show auth_token
   console.log(localStorage.getItem('token')); // Should be null
   ```

2. **Result:** Token cannot be accessed by JavaScript ✅

### Test CSRF Protection

1. **Try cross-origin request without cookies**
   ```javascript
   fetch('http://localhost:4000/api/admin/stats')
     .then(r => r.json())
     .then(console.log)
   ```

2. **Result:** Should fail with CORS error ✅

## Success Criteria

- ✅ Login sets httpOnly cookie
- ✅ Cookie persists across page refreshes
- ✅ API requests automatically send cookie
- ✅ Protected routes check for cookie
- ✅ Logout clears cookie
- ✅ Token refresh updates cookie
- ✅ Old Authorization header still works
- ✅ No tokens in localStorage
- ✅ XSS cannot access tokens
- ✅ CSRF protection enabled

## Next Steps After Testing

1. Deploy to staging environment
2. Test in production-like environment (HTTPS)
3. Monitor for any issues
4. Gradually update components to use new authApi
5. Remove deprecated authManager in future release

---

**Testing Date:** 2025-11-09
**Status:** Ready for testing
