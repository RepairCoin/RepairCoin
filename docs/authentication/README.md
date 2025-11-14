# Authentication Documentation

Complete documentation for RepairCoin's authentication system, including the access/refresh token implementation.

---

## 📊 Current Status

✅ **Phase 1 Complete**: Backend implementation
✅ **Phase 2 Complete**: Frontend implementation
⏳ **Phase 3 Pending**: Production deployment

---

## 🎯 Quick Start

**New to the auth system?** Start here:

1. [**Access/Refresh Token Design**](./ACCESS_REFRESH_TOKEN_DESIGN.md) - Understand the architecture
2. [**Backend Implementation**](./ACCESS_REFRESH_TOKEN_IMPLEMENTATION.md) - Backend details
3. [**Frontend Implementation**](./FRONTEND_TOKEN_REFRESH_IMPLEMENTATION.md) - Frontend details
4. [**Security Audit**](./AUTH_SECURITY_AUDIT.md) - Security analysis

---

## 📁 Documentation Files

### Core Implementation (Start Here)

| Document | Description | Status |
|----------|-------------|--------|
| **ACCESS_REFRESH_TOKEN_DESIGN.md** | Architecture and design decisions | ✅ Complete |
| **ACCESS_REFRESH_TOKEN_IMPLEMENTATION.md** | Backend implementation guide (Phase 1) | ✅ Complete |
| **FRONTEND_TOKEN_REFRESH_IMPLEMENTATION.md** | Frontend implementation guide (Phase 2) | ✅ Complete |
| **AUTH_SECURITY_AUDIT.md** | Security audit and recommendations | ✅ Complete |

### Production Issues & Fixes

| Document | Description |
|----------|-------------|
| **SUBDOMAIN_COOKIE_SETUP.md** | ⭐ **Current Setup** - Subdomain cookie configuration (api.repaircoin.ai) |
| **SUBDOMAIN_MIGRATION_SUMMARY.md** | Summary of subdomain migration changes |
| **COOKIE_AUTH_PRODUCTION_ISSUES.md** | Analysis of cookie auth issues in production |
| **COOKIE_AUTH_FIXES_APPLIED.md** | Fixes for cross-origin cookie problems |
| **PRODUCTION_COOKIE_AUTH_CONFIG.md** | Legacy cross-origin cookie configuration guide |

### Migration Documentation

| Document | Description |
|----------|-------------|
| **AUTHENTICATION_MIGRATION_STATUS.md** | Cookie authentication migration status |
| **AUTH_MIGRATION_SUMMARY.md** | Summary of authentication migrations |
| **MIGRATION_COMPLETE.md** | Migration completion report |
| **MIGRATION_PROGRESS.md** | Migration progress tracking |
| **IMPLEMENTATION_COMPLETE_PHASE1.md** | Phase 1 completion report |

### Testing & Cleanup

| Document | Description |
|----------|-------------|
| **TESTING_AUTH.md** | Authentication testing guide |
| **CLEANUP_SUMMARY.md** | API client cleanup documentation |

---

## 🔐 Authentication Flow

### Login Flow
```
User connects wallet (Thirdweb)
   ↓
Frontend calls /auth/{role} with address
   ↓
Backend validates user exists
   ↓
Backend generates:
- Access Token (15 min, for API calls)
- Refresh Token (7 days, for renewal)
   ↓
Backend sets httpOnly cookies
   ↓
User authenticated for 7 days
```

### Token Refresh Flow
```
Access token expires (15 min)
   ↓
Frontend auto-detects expiry (proactive)
OR API call fails with 401 (reactive)
   ↓
Frontend calls /auth/refresh
   ↓
Backend validates refresh token in DB
   ↓
Backend generates new access token
   ↓
User stays logged in seamlessly
```

---

## 🚀 Key Features

### Implemented ✅

- **Dual-Token System**: Access (15m) + Refresh (7d) tokens
- **99% Attack Window Reduction**: 24h → 15m
- **Automatic Refresh**: Frontend auto-refreshes before expiry
- **Token Revocation**: Logout immediately invalidates sessions
- **Session Management**: Track and manage active sessions
- **Backward Compatible**: Legacy 24h tokens still supported
- **Request Queuing**: Prevents duplicate refresh attempts
- **Graceful Degradation**: Fallback to login if refresh fails

### Security Improvements

- ✅ Shorter attack window (15 min vs 24h)
- ✅ Token revocation on logout
- ✅ Session tracking and audit trail
- ✅ HttpOnly cookies (XSS protection)
- ✅ SameSite: none for cross-origin
- ✅ Token hashing in database (SHA-256)

### Still Needed ⚠️

- ⏳ Rate limiting on /auth endpoints (HIGH)
- ⏳ CSRF protection (MEDIUM)
- ⏳ Token rotation on refresh (LOW)
- ⏳ JWT secret rotation (LOW)

---

## 📖 Implementation Summary

### Backend (Phase 1) ✅

**Files Modified**:
- `backend/src/middleware/auth.ts` - Token generation and validation
- `backend/src/routes/auth.ts` - Login/logout/refresh endpoints
- `backend/src/services/CleanupService.ts` - Token cleanup cron
- `backend/src/repositories/RefreshTokenRepository.ts` - NEW

**Database**:
- Migration 029: `refresh_tokens` table created
- 6 indexes for performance
- Foreign key to shops table

**Endpoints**:
- `/auth/admin`, `/auth/shop`, `/auth/customer` - Issue both tokens
- `/auth/refresh` - Validate refresh token, issue new access token
- `/auth/logout` - Revoke refresh token in DB

### Frontend (Phase 2) ✅

**Files Modified**:
- `frontend/src/services/api/client.ts` - Auto-refresh interceptor
- `frontend/src/contexts/AuthContext.tsx` - Integrated refresh hook
- `frontend/src/hooks/useTokenRefresh.ts` - NEW

**Features**:
- Proactive refresh (2 min before expiry)
- Reactive refresh (on 401 error)
- Request queuing (prevent duplicates)
- Automatic retry after refresh

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] Login flow (all 3 roles: admin, shop, customer)
- [ ] Proactive refresh (wait 13 minutes, check auto-refresh)
- [ ] Reactive refresh (delete auth_token, trigger API call)
- [ ] Multiple simultaneous requests (verify only 1 refresh call)
- [ ] Logout (verify token revoked in DB)
- [ ] Session persistence (close browser, re-open)
- [ ] Cross-device logout (logout on device A affects device B)

### Production Testing

1. Deploy backend with migration
2. Verify refresh_tokens table exists
3. Login and monitor token refresh calls
4. Check browser DevTools → Network tab
5. Verify cookies are set correctly
6. Test for 24 hours, monitor errors

---

## 🔧 Configuration

### Environment Variables

```bash
# Backend .env
ACCESS_TOKEN_EXPIRES_IN=15m    # Access token lifespan
REFRESH_TOKEN_EXPIRES_IN=7d     # Refresh token lifespan
JWT_EXPIRES_IN=24h              # Legacy token (backward compat)
JWT_SECRET=your-secret-key      # Must be 32+ characters
```

### Cookie Settings

```typescript
{
  httpOnly: true,           // Prevent XSS
  secure: true,             // HTTPS only
  sameSite: 'none',        // Cross-origin support
  maxAge: 15 * 60 * 1000,  // 15 minutes (access)
  path: '/'
}
```

---

## 📊 Monitoring

### Metrics to Track

- **Token Refresh Rate**: Should be >95%
- **Failed Refresh Attempts**: <5% of total
- **Active Sessions**: Monitor growth
- **Average Session Duration**: ~7 days
- **Logout Rate**: Track forced logouts

### Database Queries

```sql
-- Active refresh tokens
SELECT COUNT(*) FROM refresh_tokens
WHERE revoked = false AND expires_at > NOW();

-- Token statistics
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE revoked = false AND expires_at > NOW()) as active,
  COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired,
  COUNT(*) FILTER (WHERE revoked = true) as revoked
FROM refresh_tokens;

-- Tokens by role
SELECT user_role, COUNT(*)
FROM refresh_tokens
WHERE revoked = false AND expires_at > NOW()
GROUP BY user_role;
```

---

## 🚨 Troubleshooting

### Issue: Infinite redirect loop

**Cause**: Missing auth cookie but user detected as registered
**Fix**: Check cookie validation in `page.tsx`, ensure hasAuthCookie check

### Issue: 401 on all requests

**Cause**: Access token expired, refresh token missing/invalid
**Fix**: Check browser DevTools → Application → Cookies, verify refresh_token exists

### Issue: Token refresh fails

**Cause**: Refresh token expired or revoked
**Fix**: User needs to re-login (expected after 7 days or logout)

### Issue: Multiple refresh calls

**Cause**: Request queue not working
**Fix**: Check `isRefreshing` flag in `api/client.ts`

---

## 📚 Related Documentation

- [Database Schema](../database/DATABASE_SCHEMA.md) - `refresh_tokens` table
- [Deployment Guide](../deployment/DEPLOYMENT.md) - Production deployment
- [API Documentation](../api/) - API endpoint specs

---

**Last Updated**: November 10, 2025
**Version**: 2.0 (Access/Refresh Tokens)
**Status**: Phase 1 & 2 Complete, Production Pending
