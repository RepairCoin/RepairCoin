# Cookie-Based Authentication Migration Guide

## Problem
Many components are still using `localStorage.getItem('*AuthToken')` to get authentication tokens. With httpOnly cookies, JavaScript cannot access tokens directly.

## Solution

### For API Calls

**BEFORE (❌ Wrong):**
```typescript
const token = localStorage.getItem('shopAuthToken');
const response = await axios.get('http://localhost:4000/api/shops/data', {
  headers: {
    Authorization: `Bearer ${token}`
  }
});
```

**AFTER (✅ Correct):**
```typescript
import apiClient from '@/services/api/client';

const response = await apiClient.get('/shops/data');
// Cookie is sent automatically - no token needed!
```

### For Authentication Checks

**BEFORE (❌ Wrong):**
```typescript
const token = localStorage.getItem('customerAuthToken');
if (!token) {
  // Not authenticated
}
```

**AFTER (✅ Correct):**
```typescript
import { useAuthStore } from '@/stores/authStore';

const { isAuthenticated, userProfile } = useAuthStore();
if (!isAuthenticated) {
  // Not authenticated
}
```

### For WebSocket Connections

**Note:** WebSocket still needs a token (backend returns it in login response for WS use)

```typescript
import { useAuthStore } from '@/stores/authStore';

const { userProfile } = useAuthStore();
const wsToken = userProfile?.token; // Backend still returns this for WS
```

## Common Patterns to Fix

### Pattern 1: Direct localStorage Access
```typescript
// ❌ REMOVE
const token = localStorage.getItem('shopAuthToken') || sessionStorage.getItem('shopAuthToken');

// ✅ USE
import apiClient from '@/services/api/client';
// Just make API calls - cookies are automatic
```

### Pattern 2: Setting Tokens
```typescript
// ❌ REMOVE
localStorage.setItem('customerAuthToken', token);

// ✅ USE
// Nothing needed - backend sets cookie automatically
```

### Pattern 3: Multiple Token Checks
```typescript
// ❌ REMOVE
const token =
  localStorage.getItem("token") ||
  localStorage.getItem("shopAuthToken") ||
  sessionStorage.getItem("shopAuthToken");

// ✅ USE
import { useAuthStore } from '@/stores/authStore';
const { isAuthenticated } = useAuthStore();
```

### Pattern 4: Manual Authorization Headers
```typescript
// ❌ REMOVE
headers: {
  Authorization: `Bearer ${token}`
}

// ✅ USE
// No headers needed - apiClient sends cookies automatically
```

## Files to Update

Run this search to find remaining issues:
```bash
grep -r "localStorage.getItem.*Token" frontend/src/
grep -r "sessionStorage.getItem.*Token" frontend/src/
```

## Testing After Migration

1. **Clear all localStorage**
   ```javascript
   localStorage.clear();
   ```

2. **Login and verify cookie is set**
   - DevTools → Application → Cookies → `auth_token`

3. **Make API request**
   - Network tab should show cookie being sent
   - Should NOT see Authorization header

4. **Verify no localStorage errors**
   - Console should be clean (except deprecation warnings)
