# WebSocket Cookie Investigation

## Issue
WebSocket connections are connecting and immediately disconnecting with "Unauthenticated WebSocket disconnected" messages in production.

## Current Setup
- Frontend: `https://repaircoin.ai`
- Backend: `https://api.repaircoin.ai`
- WebSocket URL: `wss://api.repaircoin.ai`
- Cookie Domain: `.repaircoin.ai`
- Cookie SameSite: `lax`

## Potential Root Cause

### WebSocket Cookie Limitation with `sameSite: 'lax'`

**The Problem:**
WebSocket upgrade requests are treated differently from regular HTTP requests. With `sameSite: 'lax'`, cookies are **only sent on top-level navigations**, not on:
- WebSocket upgrade requests
- Fetch/XHR requests (except top-level GET)
- Embedded resources

**Why This Matters:**
When the frontend at `https://repaircoin.ai` tries to connect to `wss://api.repaircoin.ai`:
1. Browser initiates WebSocket upgrade request
2. With `sameSite: 'lax'`, cookies might **not be sent** with the upgrade request
3. Backend can't authenticate → 5-second timeout → Disconnect

## Testing This Theory

### Logs to Check
After deploying enhanced logging, look for:

```json
{
  "hasCookieHeader": false,  // ← If this is false, confirms the issue
  "origin": "https://repaircoin.ai",
  "host": "api.repaircoin.ai",
  "allCookies": []  // ← Should have auth_token if cookies were sent
}
```

## Solutions

### Solution 1: Use `sameSite: 'none'` for WebSocket Cookies (Recommended)

Create a separate WebSocket-specific cookie with `sameSite: 'none'`:

```typescript
// For WebSocket connections only
res.cookie('ws_auth_token', accessToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'none',  // Required for WebSocket cross-origin
  domain: '.repaircoin.ai',
  maxAge: 15 * 60 * 1000
});

// Regular API cookies can stay as 'lax'
res.cookie('auth_token', accessToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',  // Better CSRF protection for regular requests
  domain: '.repaircoin.ai',
  maxAge: 15 * 60 * 1000
});
```

Then update WebSocketManager to check both cookies:
```typescript
const authCookie = cookies.find(c =>
  c.startsWith('ws_auth_token=') || c.startsWith('auth_token=')
);
```

### Solution 2: Manual Authentication (Workaround)

Frontend sends token manually instead of relying on cookies:

**Frontend:**
```typescript
const ws = new WebSocket(WS_URL);
ws.onopen = () => {
  // Get token from cookie and send manually
  const token = document.cookie
    .split('; ')
    .find(row => row.startsWith('auth_token='))
    ?.split('=')[1];

  if (token) {
    ws.send(JSON.stringify({
      type: 'authenticate',
      payload: { token }
    }));
  }
};
```

**Backend:** Already supports manual authentication (line 190-252 in WebSocketManager.ts)

### Solution 3: Same-Origin WebSocket (Not Feasible)

Move WebSocket to same origin as frontend - not possible with current architecture.

## Recommended Fix

**Option: Dual Cookie Strategy**

1. Keep `sameSite: 'lax'` for regular API cookies (better security)
2. Add `sameSite: 'none'` specifically for WebSocket cookies
3. Backend checks both cookies

This provides:
- ✅ CSRF protection for API calls (`lax`)
- ✅ WebSocket authentication (`none`)
- ✅ Defense in depth (two cookies)

## Next Steps

1. Deploy enhanced logging
2. Check production logs to confirm cookies aren't being sent
3. Implement dual cookie strategy if confirmed
4. Test in production

## Browser Behavior Reference

| Browser | WebSocket + sameSite:'lax' | WebSocket + sameSite:'none' |
|---------|---------------------------|----------------------------|
| Chrome | ❌ Cookies not sent | ✅ Cookies sent |
| Firefox | ❌ Cookies not sent | ✅ Cookies sent |
| Safari | ❌ Cookies not sent | ✅ Cookies sent |
| Edge | ❌ Cookies not sent | ✅ Cookies sent |

Sources:
- MDN: SameSite cookies
- WebSocket RFC 6455
- Chrome Cookie Behavior Updates
