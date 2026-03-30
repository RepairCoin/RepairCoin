# Bug: Session Location Lookup Not Implemented

## Status: Open
## Priority: Low
## Date: 2026-03-25
## Category: Bug - Security / Session Management

---

## Overview

The Active Sessions display in Password & Authentication settings always shows "Location lookup not yet implemented" for every session, regardless of the IP address available.

**Impact:** Users cannot identify sessions by geographic location, making it harder to detect unauthorized access from unfamiliar locations.

---

## Current State

**File:** `backend/src/routes/security.ts` (line 32)

```typescript
location: session.ipAddress ? 'Location lookup not yet implemented' : 'Unknown',
```

The IP address is available from the session data, but no geo-IP lookup is performed.

---

## Implementation Options

### Option A: Free IP Geolocation API (Recommended for MVP)

Use a free service like `ip-api.com` (no API key, 45 req/min limit):

```typescript
async function getLocationFromIP(ip: string): Promise<string> {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=city,country`);
    const data = await response.json();
    if (data.city && data.country) {
      return `${data.city}, ${data.country}`;
    }
    return 'Unknown location';
  } catch {
    return 'Unknown location';
  }
}
```

**Pros:** Free, no setup
**Cons:** Rate limited, HTTP only (no HTTPS on free tier)

### Option B: MaxMind GeoLite2 (Recommended for Production)

Use the free GeoLite2 database for offline lookups:

```bash
npm install maxmind
```

**Pros:** No API calls, fast, no rate limits, works offline
**Cons:** Requires downloading and updating the database file periodically

### Option C: Cache IP→Location in Database

Store location on session creation so it doesn't need re-lookup:

```sql
ALTER TABLE refresh_tokens ADD COLUMN location VARCHAR(100);
```

Look up location once at login time, store it with the session.

---

## Recommended Approach

**Option C + Option A:** Look up location via free API at login time, cache in the `refresh_tokens` table. This avoids repeated API calls and works for historical sessions.

---

## Files to Modify

| File | Action |
|------|--------|
| `backend/src/routes/security.ts` | Replace hardcoded string with actual location |
| `backend/src/repositories/RefreshTokenRepository.ts` | Add location column support |
| `backend/migrations/XXX_add_session_location.sql` | Add location column to refresh_tokens |

---

## Verification

- [ ] Sessions show city and country (e.g., "Manila, Philippines")
- [ ] Unknown IPs show "Unknown location" gracefully
- [ ] Local/private IPs (127.0.0.1, 192.168.x.x) show "Local network"
- [ ] Location cached in database for quick retrieval
