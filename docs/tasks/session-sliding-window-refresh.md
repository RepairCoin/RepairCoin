# AUTH-003: Session Sliding Window Token Refresh

## Status: COMPLETED

## Priority: High

## Category: Authentication / UX Enhancement

## Problem Statement

Users were being unexpectedly logged out while actively using the application because:

1. **Fixed Token Expiry** - Access tokens expire after 15 minutes regardless of user activity
2. **Reactive Refresh Only** - Token refresh only happened AFTER the token expired (causing request failures)
3. **Poor UX** - Active users experienced jarring logouts mid-workflow
4. **Session Interruption** - Users had to re-authenticate even when continuously using the app

Additionally, `appointments.ts` was using raw `axios` instead of the centralized `apiClient`, bypassing the token refresh mechanism entirely.

## Previous Implementation

### Token Flow (Before)
1. User logs in, receives access token (15 min) and refresh token (7 days)
2. User makes API requests with access token
3. After exactly 15 minutes, access token expires
4. Next API request fails with 401
5. Frontend catches 401, attempts to refresh token
6. If refresh succeeds, retry failed request
7. User experiences brief interruption

### Issues with Previous Approach
- Token expiry was a cliff edge - working one moment, expired the next
- Users could be mid-action when token expires (e.g., filling a form)
- The failed request -> refresh -> retry cycle added latency
- `appointments.ts` didn't use `apiClient`, so booking-related requests could fail without retry

## Solution Implemented

### Option A: Sliding Window Token Refresh

Proactively refresh the access token BEFORE it expires when the user is active.

### How It Works
1. User logs in, receives access token (15 min) and refresh token (7 days)
2. User makes API requests with access token
3. Backend checks token expiry on every authenticated request
4. If token has **less than 5 minutes remaining** and user is active:
   - Generate new access token
   - Set new token in httpOnly cookie
   - Add `X-Token-Refreshed: true` header
   - Continue processing request normally
5. Token is refreshed transparently - user never notices
6. Token only truly expires if user is inactive for 15+ minutes

### Backend Changes (`backend/src/middleware/auth.ts`)

```typescript
// SLIDING WINDOW TOKEN REFRESH
// Proactively refresh the access token if it's close to expiring
// This prevents active users from being unexpectedly logged out
// Token is refreshed if less than 5 minutes remaining

const SLIDING_WINDOW_THRESHOLD_SECONDS = 5 * 60; // 5 minutes before expiry
const timeUntilExpiry = decoded.exp - Math.floor(Date.now() / 1000);

if (timeUntilExpiry > 0 && timeUntilExpiry < SLIDING_WINDOW_THRESHOLD_SECONDS) {
  // Generate new access token
  const newAccessToken = generateAccessToken({
    address: decoded.address,
    role: decoded.role,
    shopId: decoded.shopId
  });

  // Set new token in cookie
  res.cookie('auth_token', newAccessToken, cookieOptions);

  // Notify frontend
  res.setHeader('X-Token-Refreshed', 'true');
}
```

### Frontend Changes (`frontend/src/services/api/client.ts`)

```typescript
apiClient.interceptors.response.use(
  (response) => {
    // Check if backend performed sliding window refresh
    const tokenRefreshed = response.headers['x-token-refreshed'];
    if (tokenRefreshed === 'true') {
      console.log('[API Client] Sliding window refresh: Token was proactively refreshed');
      // Dispatch event for components to react if needed
      window.dispatchEvent(new CustomEvent('auth:token-refreshed', {
        detail: { type: 'sliding-window' }
      }));
    }
    return response.data;
  },
  // ... error handling
);
```

### Pre-requisite Bug Fix (`frontend/src/services/api/appointments.ts`)

Changed from raw `axios` to centralized `apiClient`:

```typescript
// Before
import axios from 'axios';
const response = await axios.get(`${API_URL}/...`, { withCredentials: true });

// After
import apiClient from './client';
const response = await apiClient.get(`/...`);
```

## Files Modified

| File | Change |
|------|--------|
| `backend/src/middleware/auth.ts` | Added sliding window refresh logic (lines 237-297) |
| `frontend/src/services/api/client.ts` | Added `X-Token-Refreshed` header detection |
| `frontend/src/services/api/appointments.ts` | Migrated from raw axios to apiClient |

## Token Lifecycle Summary

| Scenario | Token Behavior |
|----------|----------------|
| Active user (requests every < 10 min) | Token refreshed proactively, never expires |
| Semi-active user (requests every 10-15 min) | Token refreshed on last request before expiry |
| Inactive user (no requests for 15+ min) | Access token expires, refresh token used |
| Long inactive (no requests for 7+ days) | Refresh token expires, must re-login |

## Acceptance Criteria

- [x] Access tokens are refreshed when < 5 minutes remaining
- [x] Refresh happens transparently during normal API requests
- [x] No user-visible interruption during refresh
- [x] `X-Token-Refreshed` header sent to frontend
- [x] Frontend detects and logs sliding window refresh
- [x] `appointments.ts` uses centralized `apiClient`
- [x] Backend compiles without TypeScript errors
- [x] Changes don't break existing token refresh flow

## Business Impact

- **Improved UX** - Active users never experience unexpected logouts
- **Reduced Friction** - No more mid-workflow session expiry
- **Increased Engagement** - Users stay logged in while actively using app
- **Booking Reliability** - Appointment scheduling now uses proper token handling

## Technical Notes

- Sliding window threshold: 5 minutes (configurable)
- Access token lifetime: 15 minutes
- Refresh token lifetime: 7 days
- Cookie settings: httpOnly, secure (production), sameSite: none (production) / lax (dev)
- Logging: Backend logs all sliding window refreshes for monitoring

## Rollback Instructions

If you need to revert to the original 15-minute fixed session expiration:

### Step 1: Remove Backend Sliding Window Logic

In `backend/src/middleware/auth.ts`, remove the sliding window refresh block (search for "SLIDING WINDOW TOKEN REFRESH"):

```typescript
// DELETE THIS ENTIRE BLOCK (lines 237-297):

    // ============================================================
    // SLIDING WINDOW TOKEN REFRESH
    // ============================================================
    // Proactively refresh the access token if it's close to expiring
    // This prevents active users from being unexpectedly logged out
    // Token is refreshed if less than 5 minutes remaining
    // ============================================================
    const SLIDING_WINDOW_THRESHOLD_SECONDS = 5 * 60; // 5 minutes before expiry
    const timeUntilExpiry = decoded.exp - Math.floor(Date.now() / 1000);

    if (timeUntilExpiry > 0 && timeUntilExpiry < SLIDING_WINDOW_THRESHOLD_SECONDS) {
      // ... entire block until closing brace
    }
```

### Step 2: Remove Frontend Token Detection

In `frontend/src/services/api/client.ts`, revert the response interceptor success handler:

```typescript
// CHANGE FROM:
apiClient.interceptors.response.use(
  (response) => {
    // Check if the backend performed a sliding window token refresh
    const tokenRefreshed = response.headers['x-token-refreshed'];
    if (tokenRefreshed === 'true') {
      console.log('[API Client] Sliding window refresh: Token was proactively refreshed');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:token-refreshed', {
          detail: { type: 'sliding-window' }
        }));
      }
    }
    return response.data;
  },

// CHANGE TO:
apiClient.interceptors.response.use(
  (response) => response.data,
```

### Step 3: Keep appointments.ts Changes (Recommended)

**DO NOT rollback** `frontend/src/services/api/appointments.ts` - the migration from raw `axios` to `apiClient` is a bug fix that should remain regardless of sliding window feature.

### Rollback Verification

After rollback:
1. Run `npm run typecheck` in backend - should pass
2. Run `npx tsc --noEmit` in frontend - should have no new errors
3. Test login flow - token should expire exactly at 15 minutes
4. Test that 401 errors trigger refresh token flow correctly

### Behavior After Rollback

| Scenario | Token Behavior |
|----------|----------------|
| Active user | Token expires exactly at 15 minutes, refresh triggered on next request |
| Any user after 15 min | Access token expires, must use refresh token |
| User inactive 7+ days | Refresh token expires, must re-login |

## Related Files

- `backend/src/middleware/auth.ts` - Main authentication middleware
- `frontend/src/services/api/client.ts` - Centralized API client
- `frontend/src/services/api/appointments.ts` - Appointments API service
- `backend/src/repositories/RefreshTokenRepository.ts` - Refresh token storage

## Tags

`authentication` `session-management` `ux` `security` `token-refresh` `high-priority`
