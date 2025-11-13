# Access & Refresh Token Implementation Design

**Date**: 2025-11-10
**Status**: Design Complete - Ready for Implementation

---

## Executive Summary

### Current System (Single Token)
```
User connects Thirdweb wallet
    ↓
Backend verifies wallet address
    ↓
Issues single JWT (24h lifespan)
    ↓
Stored in httpOnly cookie
    ↓
User makes API calls for 24 hours
```

**Problems**:
- 24-hour exposure window if token compromised
- Can't revoke sessions easily
- No granular control

### Proposed System (Access + Refresh)
```
User connects Thirdweb wallet
    ↓
Backend verifies wallet address
    ↓
Issues TWO tokens:
  - Access Token: 15 minutes (for API calls)
  - Refresh Token: 7 days (for getting new access tokens)
    ↓
Both stored in httpOnly cookies
    ↓
Access token expires after 15 min → Use refresh to get new one
Refresh token expires after 7 days → Re-authenticate
```

**Benefits**:
- ✅ Shorter attack window (15 min vs 24h)
- ✅ Can revoke refresh tokens
- ✅ Better security without UX impact
- ✅ Follows OAuth 2.0 best practices

---

## Thirdweb Integration Analysis

### How Thirdweb is Currently Used

**Thirdweb Role**: Wallet connection & address management ONLY

```typescript
// Frontend - Thirdweb provides wallet address
import { useActiveAccount } from 'thirdweb/react';

const account = useActiveAccount();
// account.address = "0x1234..." ← This is all we use from Thirdweb!

// Then we call OUR backend
await apiClient.post('/auth/shop', { address: account.address });
```

**Thirdweb does NOT handle**:
- ❌ JWT tokens
- ❌ Session management
- ❌ Authentication (just wallet connection)
- ❌ Our backend APIs

**What Thirdweb DOES provide**:
- ✅ Wallet connection UI (ConnectButton)
- ✅ Wallet address
- ✅ Account switching detection
- ✅ Network switching

### Impact Assessment

**Thirdweb is completely separate from our JWT auth!**

```
┌─────────────────────────────────────────────────┐
│  THIRDWEB (Wallet Layer)                        │
│  - Connects wallet                              │
│  - Provides address: "0x1234..."                │
│  - Detects disconnection                        │
└─────────────────────────────────────────────────┘
                      │
                      │ address
                      ↓
┌─────────────────────────────────────────────────┐
│  OUR AUTH SYSTEM (Backend JWT)                  │
│  - Verifies address in database                 │
│  - Issues access token (15 min)                 │
│  - Issues refresh token (7 days)                │
│  - Stores in httpOnly cookies                   │
└─────────────────────────────────────────────────┘
```

**Conclusion**: Access/refresh token implementation **will not affect** Thirdweb integration at all!

---

## Architectural Design

### Token Structure

#### Access Token (Short-lived)
```typescript
interface AccessTokenPayload {
  type: 'access';
  address: string;           // User's wallet address
  role: 'admin' | 'shop' | 'customer';
  shopId?: string;           // For shop role
  iat: number;               // Issued at
  exp: number;               // Expires in 15 minutes
}
```

**Purpose**: Used for API calls
**Lifetime**: 15 minutes
**Storage**: httpOnly cookie `access_token`
**Sent**: With every API request

#### Refresh Token (Long-lived)
```typescript
interface RefreshTokenPayload {
  type: 'refresh';
  address: string;
  role: 'admin' | 'shop' | 'customer';
  tokenId: string;           // Unique ID for revocation
  iat: number;
  exp: number;               // Expires in 7 days
}
```

**Purpose**: Get new access tokens
**Lifetime**: 7 days
**Storage**: httpOnly cookie `refresh_token`
**Sent**: Only to `/auth/refresh` endpoint

---

### Database Schema Addition

Need to track refresh tokens for revocation:

```sql
-- New table: refresh_tokens
CREATE TABLE refresh_tokens (
  id SERIAL PRIMARY KEY,
  token_id VARCHAR(255) UNIQUE NOT NULL,  -- UUID from token payload
  user_address VARCHAR(42) NOT NULL,
  user_role VARCHAR(20) NOT NULL,
  shop_id VARCHAR(100),
  issued_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  last_used_at TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_token_id (token_id),
  INDEX idx_user_address (user_address),
  INDEX idx_expires_at (expires_at)
);
```

**Purpose**:
- Track active sessions
- Revoke specific tokens
- Audit trail
- Cleanup expired tokens

---

### Authentication Flow

#### 1. Initial Login (Thirdweb → Backend)

```typescript
// Frontend
const account = useActiveAccount(); // Thirdweb gives us wallet address

// User connects wallet via Thirdweb ConnectButton
// Frontend calls our backend
const response = await apiClient.post('/auth/shop', {
  address: account.address
});

// Backend generates BOTH tokens
const accessToken = generateAccessToken({
  type: 'access',
  address,
  role: 'shop',
  shopId,
});

const refreshToken = generateRefreshToken({
  type: 'refresh',
  address,
  role: 'shop',
  tokenId: uuidv4(), // Unique ID
});

// Store refresh token in database
await refreshTokenRepository.create({
  tokenId: tokenId,
  userAddress: address,
  userRole: 'shop',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
});

// Send both cookies
res.cookie('access_token', accessToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  maxAge: 15 * 60 * 1000, // 15 minutes
});

res.cookie('refresh_token', refreshToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});
```

---

#### 2. Making API Calls

```typescript
// Frontend axios interceptor (already exists!)
apiClient.interceptors.request.use((config) => {
  // Extract access_token from cookie
  const accessToken = document.cookie
    .split(';')
    .find(c => c.trim().startsWith('access_token='))
    ?.split('=')[1];

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

// Backend middleware
export const authMiddleware = async (req, res, next) => {
  // Try cookie first
  let token = req.cookies?.access_token;

  // Fallback to Authorization header
  if (!token) {
    token = req.headers.authorization?.replace('Bearer ', '');
  }

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'NO_ACCESS_TOKEN'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify it's an access token
    if (decoded.type !== 'access') {
      return res.status(401).json({
        error: 'Invalid token type',
        code: 'WRONG_TOKEN_TYPE'
      });
    }

    // Continue with existing validation...
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Access token expired',
        code: 'ACCESS_TOKEN_EXPIRED'
      });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

---

#### 3. Token Refresh (Automatic)

```typescript
// Frontend - Automatic refresh before expiry
useEffect(() => {
  const checkAndRefresh = async () => {
    const accessToken = getCookie('access_token');
    if (!accessToken) return;

    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const expiresIn = (payload.exp * 1000) - Date.now();

      // Refresh 2 minutes before expiry
      if (expiresIn < 2 * 60 * 1000 && expiresIn > 0) {
        console.log('🔄 Refreshing access token...');
        await apiClient.post('/auth/refresh');
      }
    } catch (error) {
      console.error('Token refresh check failed:', error);
    }
  };

  // Check every 30 seconds
  const interval = setInterval(checkAndRefresh, 30000);
  return () => clearInterval(interval);
}, []);

// Backend refresh endpoint
router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;

  if (!refreshToken) {
    return res.status(401).json({
      error: 'No refresh token',
      code: 'NO_REFRESH_TOKEN'
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);

    // Verify it's a refresh token
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        error: 'Invalid token type',
        code: 'NOT_REFRESH_TOKEN'
      });
    }

    // Check if token is revoked
    const tokenRecord = await refreshTokenRepository.findByTokenId(decoded.tokenId);
    if (!tokenRecord || tokenRecord.revokedAt) {
      return res.status(401).json({
        error: 'Refresh token revoked',
        code: 'TOKEN_REVOKED'
      });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken({
      type: 'access',
      address: decoded.address,
      role: decoded.role,
      shopId: decoded.shopId,
    });

    // Update last used timestamp
    await refreshTokenRepository.updateLastUsed(decoded.tokenId);

    // Send new access token
    res.cookie('access_token', newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 15 * 60 * 1000,
    });

    res.json({
      success: true,
      message: 'Access token refreshed'
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Refresh token expired - please login again',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});
```

---

#### 4. Logout (Revoke Refresh Token)

```typescript
// Frontend
await apiClient.post('/auth/logout');

// Backend
router.post('/logout', authMiddleware, async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;

  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET);

      // Revoke refresh token in database
      await refreshTokenRepository.revoke(decoded.tokenId);
    } catch (error) {
      // Token might be expired, that's ok
    }
  }

  // Clear both cookies
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  });

  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  });

  res.json({ success: true, message: 'Logged out' });
});
```

---

#### 5. Thirdweb Disconnect Handling

```typescript
// Frontend - Detect when user disconnects wallet
const account = useActiveAccount();

useEffect(() => {
  if (!account?.address && wasConnected) {
    // Wallet disconnected - logout from our system
    console.log('👋 Wallet disconnected - logging out');
    authApi.logout();
  }

  setWasConnected(!!account?.address);
}, [account?.address]);
```

**Important**: Thirdweb disconnect triggers our logout, which revokes refresh token!

---

### Error Handling with 401

```typescript
// Frontend axios interceptor
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      const errorCode = error.response?.data?.code;

      if (errorCode === 'ACCESS_TOKEN_EXPIRED') {
        // Try to refresh
        try {
          await apiClient.post('/auth/refresh');
          // Retry original request
          return apiClient.request(error.config);
        } catch (refreshError) {
          // Refresh failed - redirect to login
          window.location.href = '/?session=expired';
        }
      } else if (errorCode === 'REFRESH_TOKEN_EXPIRED') {
        // Must re-authenticate
        window.location.href = '/?session=expired';
      } else {
        // Other auth error
        window.location.href = '/?auth=failed';
      }
    }

    return Promise.reject(error);
  }
);
```

---

## Implementation Steps

### Phase 1: Backend (Day 1)

1. **Create refresh token database table** (30 min)
   - Migration file
   - Repository class

2. **Update token generation** (1 hour)
   - Separate `generateAccessToken()` and `generateRefreshToken()`
   - Add token type to payload
   - Add tokenId to refresh tokens

3. **Update auth endpoints** (1 hour)
   - Issue both tokens on login
   - Store refresh token in database
   - Set both cookies

4. **Update auth middleware** (30 min)
   - Check token type
   - Verify it's an access token

5. **Implement refresh endpoint** (1 hour)
   - Validate refresh token
   - Check revocation
   - Issue new access token

6. **Implement token cleanup** (30 min)
   - Cron job to delete expired tokens
   - Revocation endpoint

**Total**: ~4.5 hours

---

### Phase 2: Frontend (Day 2)

1. **Update cookie names** (15 min)
   - Extract `access_token` instead of `auth_token`

2. **Implement token refresh hook** (1 hour)
   - `useTokenRefresh()` hook
   - Check expiry every 30 seconds
   - Auto-refresh 2 minutes before expiry

3. **Update axios interceptor** (30 min)
   - Handle 401 with automatic refresh
   - Retry failed requests
   - Better error codes

4. **Add expiry warning** (30 min)
   - Toast 5 minutes before expiry
   - "Session expiring soon" message

5. **Update logout** (15 min)
   - Clear both tokens

**Total**: ~2.5 hours

---

### Phase 3: Testing (Day 3)

1. **Test token flow** (1 hour)
2. **Test refresh mechanism** (1 hour)
3. **Test Thirdweb integration** (1 hour)
4. **Test session revocation** (30 min)
5. **Test expiry handling** (30 min)

**Total**: ~4 hours

---

## Migration Strategy

### Zero-Downtime Migration

**Step 1**: Deploy backend that supports BOTH old and new tokens
```typescript
// Middleware accepts both
let token = req.cookies?.access_token || req.cookies?.auth_token;
```

**Step 2**: Deploy frontend that uses new tokens
- New logins get access + refresh tokens
- Old sessions continue with single token

**Step 3**: After 24 hours, all old tokens expired
- Remove backward compatibility code

---

## Security Considerations

### ✅ Improvements Over Current System

1. **Shorter attack window**: 15 min vs 24 hours
2. **Token revocation**: Can invalidate specific sessions
3. **Audit trail**: Track all refresh token usage
4. **Rotation**: New access token every 15 minutes

### 🔒 Additional Security Measures

1. **Refresh token rotation** (optional)
   - Issue new refresh token on each refresh
   - Invalidate old one
   - Detects token theft

2. **IP/User-Agent binding** (optional)
   - Store IP and User-Agent with refresh token
   - Reject if mismatch (with warning)

3. **Max sessions per user** (optional)
   - Limit to 5 active refresh tokens per user
   - Auto-revoke oldest

---

## Compatibility with Thirdweb

### ✅ Perfect Compatibility

**Thirdweb provides**:
- Wallet connection
- Address detection
- Account switching

**Our system provides**:
- Backend authentication
- Session management
- API authorization

**They work together seamlessly**:

```
User clicks "Connect Wallet" (Thirdweb)
   ↓
Thirdweb returns address
   ↓
Frontend calls `/auth/shop` with address
   ↓
Backend issues access + refresh tokens
   ↓
User makes API calls (our tokens)
   ↓
User disconnects wallet (Thirdweb)
   ↓
Frontend calls `/auth/logout` (revokes our tokens)
```

**No changes needed to Thirdweb integration!**

---

## Testing Plan

### Unit Tests

```typescript
describe('Access Token', () => {
  it('should expire after 15 minutes');
  it('should contain correct payload');
  it('should be accepted by middleware');
});

describe('Refresh Token', () => {
  it('should expire after 7 days');
  it('should generate new access token');
  it('should be revocable');
});

describe('Token Refresh', () => {
  it('should issue new access token');
  it('should reject revoked refresh token');
  it('should reject expired refresh token');
});
```

### Integration Tests

1. Complete auth flow
2. Token refresh flow
3. Thirdweb disconnect
4. Concurrent refreshes
5. Token revocation

---

## Rollback Plan

If issues occur:

1. **Quick rollback**: Switch back to single token in 5 minutes
2. **Database**: Keep refresh_tokens table (no harm)
3. **Frontend**: Revert axios interceptor changes
4. **Backend**: Re-enable old token format

---

## Timeline

- **Day 1**: Backend implementation (4.5 hours)
- **Day 2**: Frontend implementation (2.5 hours)
- **Day 3**: Testing & deployment (4 hours)

**Total**: 11 hours (~2 work days)

---

## Ready to Implement?

✅ Design complete
✅ Thirdweb compatibility verified
✅ Migration plan ready
✅ Backward compatibility strategy
✅ Testing plan defined

**Next**: Implement Phase 1 (Backend)?
