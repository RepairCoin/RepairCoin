# Backend "Too Many Connections" Database Error

## Priority: High
## Status: Fixed
## Assignee: Backend Developer
## Fixed Date: January 26, 2026

## Problem

Users experience "too many connections" database errors when refreshing pages, particularly on shop accounts that were registered with MetaMask but logged in via Google OAuth.

**Specific Scenario:**
- User logs into shop account via Google (registered with MetaMask)
- User refreshes the page
- Multiple concurrent requests hit the auth middleware
- Each request creates a new `RefreshTokenRepository` instance
- Each instance runs a connection test that acquires a pool connection
- With default pool size of 20, rapid refreshes exhaust the connection pool
- Error: "sorry, too many clients already"

## Root Cause

The `auth.ts` middleware was creating a **new** `RefreshTokenRepository` instance on every token refresh:

```typescript
// Line 136 - BEFORE (problematic)
const refreshTokenRepo = new RefreshTokenRepository();
const validRefreshToken = await refreshTokenRepo.validateRefreshToken(...);
```

**Why this is problematic:**

1. `BaseRepository` constructor runs a connection test on every new instance
2. The connection test calls `pool.connect()` which acquires a connection
3. Token refresh happens on every authenticated request (sliding window refresh)
4. Multiple concurrent requests = multiple new instances = pool exhaustion

**Connection Pool Configuration** (`backend/src/utils/database-pool.ts`):
```typescript
const config = {
  max: parseInt(process.env.DB_POOL_MAX || '20'),  // Default: 20 connections
  min: parseInt(process.env.DB_POOL_MIN || '5'),
  // ...
};
```

With only 20 max connections and multiple repositories creating instances with connection tests, concurrent requests quickly exhaust the pool.

## Affected Files

### Backend
- `backend/src/middleware/auth.ts` - Created new RefreshTokenRepository on every token refresh
- `backend/src/repositories/BaseRepository.ts` - Runs connection test on construction
- `backend/src/utils/database-pool.ts` - Pool configuration

### Other files with similar pattern (potential future fixes)
- `backend/src/domains/admin/routes/analytics.ts` - 8 repository instantiations
- `backend/src/domains/admin/routes/customers.ts` - 2 repository instantiations
- `backend/src/domains/shop/routes/subscription.ts` - 5 repository instantiations
- `backend/src/domains/shop/routes/webhooks.ts` - 3 repository instantiations
- `backend/src/services/AppointmentReminderService.ts` - 2 repository instantiations
- `backend/src/services/CleanupService.ts` - 1 repository instantiation
- `backend/src/services/MarketingService.ts` - 1 repository instantiation

## Solution Implemented

### Changes Made

#### `backend/src/middleware/auth.ts`

**1. Updated import to use singleton (line 5):**
```typescript
// BEFORE
import { customerRepository, shopRepository, adminRepository } from '../repositories';
import { RefreshTokenRepository } from '../repositories/RefreshTokenRepository';

// AFTER
import { customerRepository, shopRepository, adminRepository, refreshTokenRepository } from '../repositories';
```

**2. Use singleton instead of new instance (line 135):**
```typescript
// BEFORE
const refreshTokenRepo = new RefreshTokenRepository();
const validRefreshToken = await refreshTokenRepo.validateRefreshToken(
  refreshDecoded.tokenId,
  refreshToken
);

// AFTER
const validRefreshToken = await refreshTokenRepository.validateRefreshToken(
  refreshDecoded.tokenId,
  refreshToken
);
```

**3. Updated updateLastUsed call (line 179):**
```typescript
// BEFORE
await refreshTokenRepo.updateLastUsed(refreshDecoded.tokenId);

// AFTER
await refreshTokenRepository.updateLastUsed(refreshDecoded.tokenId);
```

### How It Works

The `repositories/index.ts` file already exports singleton instances:

```typescript
// backend/src/repositories/index.ts
export const refreshTokenRepository = new RefreshTokenRepository();
```

By importing and using this singleton:
- Only ONE connection test runs at application startup
- All subsequent token refreshes reuse the same instance
- No additional connections are acquired from the pool during auth middleware execution

## Testing Checklist

### Setup
- [x] Have a shop account registered with MetaMask
- [x] Login via Google OAuth (uses email fallback)

### Scenario 1: Rapid Page Refresh
- [x] Login to shop dashboard
- [x] Rapidly refresh the page 10+ times
- [x] Verify no "too many connections" error
- [x] Verify session remains valid

### Scenario 2: Multiple Browser Tabs
- [x] Login to shop dashboard
- [x] Open 5+ tabs of the shop dashboard
- [x] Refresh all tabs simultaneously
- [x] Verify no database errors

### Scenario 3: Normal Operations
- [x] Login with MetaMask - works normally
- [x] Login with Google OAuth - works normally
- [x] Token refresh on page reload - works normally
- [x] All shop dashboard features accessible

## Related Issues

- `docs/tasks/email-based-shop-lookup.md` - Email fallback for Google OAuth login
- `docs/tasks/web-wallet-session-mismatch-bug.md` - Wallet mismatch detection

**Note:** This fix does NOT affect the email-based lookup or wallet mismatch detection features. Those are frontend changes that remain intact.

## Future Improvements

### Option A: Disable Connection Tests in BaseRepository

Add environment variable to skip connection tests:

```typescript
// In BaseRepository constructor
if (process.env.SKIP_DB_CONNECTION_TESTS === 'true') {
  return;
}
```

### Option B: Increase Pool Size

For high-traffic deployments:

```bash
DB_POOL_MAX=40
DB_POOL_MIN=10
```

### Option C: Refactor Other Files

Apply the same singleton pattern to other files that create repository instances:

| File | Instances | Priority |
|------|-----------|----------|
| `admin/routes/analytics.ts` | 8 | Medium |
| `shop/routes/subscription.ts` | 5 | Medium |
| `shop/routes/webhooks.ts` | 3 | Medium |
| `admin/routes/customers.ts` | 2 | Low |
| `services/AppointmentReminderService.ts` | 2 | Low |

## Technical Details

### Connection Pool Flow

```
BEFORE (problematic):
Request 1 → auth.ts → new RefreshTokenRepository() → connection test → pool.connect()
Request 2 → auth.ts → new RefreshTokenRepository() → connection test → pool.connect()
Request 3 → auth.ts → new RefreshTokenRepository() → connection test → pool.connect()
...
Request 20+ → POOL EXHAUSTED → "too many clients"

AFTER (fixed):
App Start → refreshTokenRepository singleton created → ONE connection test
Request 1 → auth.ts → refreshTokenRepository (reused) → no new connection
Request 2 → auth.ts → refreshTokenRepository (reused) → no new connection
Request 3 → auth.ts → refreshTokenRepository (reused) → no new connection
...
Request N → Works fine, pool not exhausted
```

### Database Pool Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `DB_POOL_MAX` | 20 | Maximum connections in pool |
| `DB_POOL_MIN` | 5 | Minimum idle connections |
| `DB_IDLE_TIMEOUT_MS` | 30000 | Close idle connections after 30s |
| `DB_CONNECTION_TIMEOUT_MS` | 10000 | Timeout for acquiring connection |

## References

- PostgreSQL connection pooling best practices
- Node.js `pg` module documentation
- BaseRepository pattern in `backend/src/repositories/BaseRepository.ts`
