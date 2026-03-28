# Bug: Auth token expires after 10-15 minutes and refresh token fails

**Status:** Completed
**Priority:** High
**Est. Effort:** 2-3 hrs
**Created:** 2026-03-28
**Updated:** 2026-03-28
**Completed:** 2026-03-28

## Problem / Goal

After a user authenticates successfully, the access token expires within 10-15 minutes. When the token expires, the refresh token mechanism is not working — the user's session is lost instead of being silently refreshed in the background.

Expected behavior: When the access token expires, the app should automatically use the refresh token to obtain a new access token without disrupting the user's session.

Actual behavior: The user gets logged out or encounters auth errors after 10-15 minutes because the refresh token flow fails silently.

## Analysis

**Root Cause:** Double `.data` unwrapping in `shared/utilities/axios.ts`.

`authApi.getRefreshToken()` calls `apiClient.post()` which already unwraps `response.data` before returning. So the response is already:
```json
{ "success": true, "data": { "accessToken": "...", "refreshToken": "..." } }
```

But the `refreshToken()` method was accessing `response.data.success` (→ `undefined`) and `response.data.data` (→ `undefined`), causing the refresh to silently fail every time — the backend returned a valid new token but the mobile app ignored it.

## Implementation

**File changed:** `shared/utilities/axios.ts` (lines 86-87, 99)

- Changed `response.data.success` → `response.success`
- Changed `response.data.data` → `response.data`
- Fixed debug log from `response.data` → `response`

## Verification Checklist

- [x] Authenticate and confirm token is received
- [ ] Wait 15+ minutes and confirm session stays active
- [x] Verify refresh token is called automatically on 401
- [ ] Confirm no duplicate refresh requests (race condition)
- [ ] Test on both Android and iOS
- [ ] Test with app backgrounded and resumed after 15+ minutes

## Notes

- Related frontend web auth files: `frontend/src/services/api/client.ts` (has token refresh logic that may serve as reference)
- The web frontend has auth resilience improvements (see CLAUDE.md) — mobile may need similar patterns
- Some verification items require manual device testing
