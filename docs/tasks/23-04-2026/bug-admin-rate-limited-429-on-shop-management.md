# Bug: Admin Rate Limited (429) on Shop Management — Unsuspend and Other Admin Actions Fail

## Status: Open
## Priority: Medium
## Date: 2026-04-23
## Category: Bug - Rate Limiting / Admin
## Platform: Web (admin dashboard)
## Affects: All admin operations on `/api/admin/*` routes during active work sessions — intermittent
## Found by: Manual testing — attempting to unsuspend "Lee Repairs" (SHOP-MO9H4434-8WUG) on staging as admin "deo"
## Behavior: Transient — retry after a few moments succeeds (confirms rate-limit, not a real unsuspend bug)

---

## Problem

Admin users get "Failed to unsuspend shop" toast errors when trying to perform routine shop management actions (unsuspend, suspend, etc.) during active work sessions. Root cause is the general API rate limiter blocking legitimate admin work, not a bug in the unsuspend logic itself.

### Reproduction

1. Log into admin dashboard on staging (`https://staging.repaircoin.ai/admin`) as admin user (e.g., "deo" — wallet `0x7db8...`)
2. Browse around the dashboard for a few minutes — view Customers, Shops, Subscriptions, Analytics tabs
3. Navigate to Shop Management → All Shops
4. Filter by name or status (each filter triggers more API calls)
5. Click unsuspend action on a suspended shop

**Expected:** shop is unsuspended, toast shows success.
**Actual:** toast shows "Failed to unsuspend shop".

### Evidence from browser devtools (Network tab + Console)

From the screenshots captured during reproduction:

```
GET  /api/auth/session               → 401   (x2)
GET  /api/admin/me                   → 429   ← rate-limited
POST /api/admin/shops/{id}/unsuspend → 429   ← rate-limited, user-visible failure
```

The HTTP 429 responses mean the server is returning "Too many requests." The frontend surfaces this as "Failed to unsuspend shop" since it can't distinguish rate-limiting from a shop-state failure.

---

## Root Cause

### `generalLimiter` in `backend/src/middleware/rateLimiter.ts:19-39`

```typescript
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 10000 : 500, // 500/15min in prod (prev: 100 was too restrictive)
  ...
});
```

Applied globally to all `/api/*` routes at `backend/src/app.ts:296`:

```typescript
this.app.use('/api/', generalLimiter);
```

### Why 500 is too low for admins

Per the comments in `rateLimiter.ts`:
- Admin dashboard page loads trigger 15–25 API calls each
- Normal browsing session: ~100–200 calls in 15 minutes

For an admin actively managing shops — navigating, filtering, clicking actions — the call count escalates fast. Each tab switch, filter change, or action reload can fire 10–30 API calls. An admin doing 15 minutes of concentrated work can burn through 500 easily, then every subsequent action returns 429 for the rest of the window.

### Why staging is affected (not just "prod-only" concern)

`backend/.env.staging` (and the external inventory `stage_env.txt`) has `NODE_ENV=production`. The limiter uses `isDevelopment = process.env.NODE_ENV === 'development'` to pick between 10000 and 500. Staging → NODE_ENV=production → uses the 500 cap. So the bug is reproducible on staging exactly as in prod.

### Secondary concern: 401 on `/api/auth/session`

Also visible in the console: two 401s on `/api/auth/session` preceding the 429s. These may be:
- An idle-session check that normally 401s on expiry (harmless, possibly pre-existing)
- OR a genuinely failing session validation that triggers retry loops → which burns through the rate limit faster

Worth investigating separately to confirm. Not the primary cause of the unsuspend failure.

### Why rate-limit keying makes this worse

`express-rate-limit` defaults to keying by `req.ip`. If multiple admins share an office IP, or if the admin uses a corporate VPN with shared egress IPs, all those admins share the 500/15min pool. One admin's burst blocks the others.

---

## User Impact

### Observed severity

**Transient, not permanent.** Per repro: first attempt at unsuspend hit 429 → second attempt a few moments later succeeded. The rate-limit window uses a 15-minute sliding cap, so individual requests age out and free capacity over time, allowing retries to succeed. The admin is never permanently locked out.

### Immediate

- Misleading "Failed to unsuspend shop" toast gives admins no indication it's rate-limiting. Likely to trigger needless bug reports ("unsuspend is broken").
- Admin workflow friction — retries disrupt focus, especially when performing multiple rapid actions (e.g., batch approvals).
- Same mechanism affects OTHER admin operations (customer management, shop approval, token minting) — anything under `/api/admin/*`.

### Compounding factors (why this will get worse)

- Multiple admins sharing an office IP / VPN → hit the limit collectively, faster and more often
- Admin dashboard polling (session checks, notifications, stats refreshes) silently consumes the quota in the background, even when the admin isn't actively clicking
- As the admin team grows (Princess Lim was just added 2026-04-22, more coming), per-IP contention increases
- First-time admins hitting this on their first session get a bad impression of the tooling ("it doesn't work")

---

## Fix Options

### Option A — Raise the production limit (quick fix)

Change `rateLimiter.ts:21`:
```typescript
max: isDevelopment ? 10000 : 2000, // was 500
```

**Pros:** one-line change, fast to deploy, restores admin productivity immediately.
**Cons:** weakens protection against abuse for all users, not just admins. Doesn't address the root issue that admins need different thresholds than public API callers.

### Option B — Exempt admin routes from generalLimiter, add an adminLimiter (recommended)

Apply `generalLimiter` only to non-admin `/api/*` paths, and add a higher-ceiling `adminLimiter` for `/api/admin/*`:

```typescript
// In rateLimiter.ts — new limiter
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 10000 : 3000, // 3000/15min for admins
  ...
});

// In app.ts — apply conditionally
this.app.use('/api/admin/', adminLimiter);
this.app.use('/api/', generalLimiter); // existing, now only catches non-admin /api/*
```

Note: Express middleware order matters. `/api/admin/` must be mounted before the general `/api/` limiter, OR use a `skip` function on generalLimiter that bypasses when path starts with `/api/admin/`.

**Pros:** principled — admins get headroom they need, public endpoints stay protected. Clear separation of concerns.
**Cons:** needs a touch more testing to ensure middleware ordering is correct. Still IP-based, so shared-IP issue persists for admin teams.

### Option C — Skip rate limiting for authenticated admins (cleanest, but requires careful implementation)

Use `express-rate-limit`'s `skip` function:

```typescript
export const generalLimiter = rateLimit({
  ...
  skip: (req: Request) => {
    // Bypass rate limit for authenticated admin users
    // Requires auth middleware to have already populated req.user
    return req.user?.role === 'admin';
  }
});
```

**Pros:** admins never hit rate limits regardless of IP. No per-IP pool issue. Public API still protected.
**Cons:** requires `authMiddleware` to run BEFORE `generalLimiter` (currently it's the other way — limiter applied app-wide before auth middleware parses routes). Restructure needed. Also means if an admin session is hijacked, attacker gets unlimited API access — arguably mitigated by JWT invalidation but worth threat-modeling.

### Option D — Use JWT claim as rate-limit key instead of IP

Customize the `keyGenerator` so each authenticated user has their own pool:

```typescript
keyGenerator: (req: Request) => {
  return req.user?.address || req.ip; // Per-user when authenticated, per-IP when anonymous
}
```

**Pros:** shared-IP admin teams stop blocking each other. More accurate "per-user" limits.
**Cons:** limits are lower per-user if we keep max=500, since admins don't share pools anymore (might be desirable). Auth middleware ordering issue same as Option C.

---

## Recommendation

**Option B + Option D together**, as a phased rollout:

**Phase 1 (immediate hotfix):** Option A — raise production `generalLimiter` max from 500 → 2000. Ships in minutes, restores admin productivity. Commit message: "hotfix(rate-limit): raise general limit to 2000/15min to unblock admin work pending proper per-role limits."

**Phase 2 (proper fix):** Option B + D — add dedicated `adminLimiter` (3000/15min), plus change `keyGenerator` to prefer `req.user?.address` when available so admins are tracked per-user rather than per-IP. Requires ~30 min engineering plus testing; ships when there's bandwidth.

### Secondary investigation

File a separate follow-up to investigate the 401s on `/api/auth/session`. If the frontend's session refresh logic is looping on failure, it could be silently burning rate-limit quota and exacerbating the 429 issue. Not blocking the primary fix.

---

## Files to Modify

### Phase 1 (hotfix)

| File | Change |
|---|---|
| `backend/src/middleware/rateLimiter.ts:21` | Change `500` → `2000` in `generalLimiter` max |

### Phase 2 (proper fix)

| File | Change |
|---|---|
| `backend/src/middleware/rateLimiter.ts` | Add `adminLimiter` export; add `keyGenerator` using `req.user?.address` fallback to `req.ip` |
| `backend/src/app.ts:296` | Apply `adminLimiter` to `/api/admin/` before falling through to `generalLimiter` for the rest |
| `backend/src/app.ts` (middleware order) | Ensure `authMiddleware` parses JWT before the limiters run, so `req.user` is populated for `keyGenerator` |

---

## Verification

### For Phase 1 (hotfix)

- [ ] Admin can perform 3+ consecutive unsuspend/suspend actions without 429
- [ ] Admin dashboard can be loaded + browsed for 20 minutes without hitting 429
- [ ] Public API (customer/shop registration, token earn) still rate-limited appropriately
- [ ] Deploy to staging first — soak for an hour with active admin usage

### For Phase 2 (proper fix)

- [ ] `/api/admin/*` requests governed by `adminLimiter` (3000/15min), not `generalLimiter`
- [ ] Non-admin `/api/*` endpoints still governed by `generalLimiter` at its configured threshold
- [ ] When authenticated as admin, rate limit bucket is keyed by wallet address (verify via logs) — two admins on same IP don't share pool
- [ ] Anonymous/unauthenticated requests still keyed by IP
- [ ] Response headers `RateLimit-Limit`, `RateLimit-Remaining` accurately reflect the adminLimiter config when authenticated as admin
- [ ] Backend tests pass (`npm run test`)
- [ ] Frontend surfaces 429s with better messaging than "Failed to unsuspend shop" — suggest "Too many recent admin actions, please wait a moment and retry"

---

## Notes

- **User impact severity:** Medium. Transient — retry succeeds once the 15-minute sliding window frees capacity. Admin is never permanently blocked, but each 429 causes confusion + workflow friction. Priority raised above Low because (a) the error message is misleading, and (b) the problem will compound as the admin team grows.
- **Original assessment was High** based on one screenshot showing 429. Downgraded to Medium after follow-up observation that retry succeeded, confirming intermittent rate-limit behavior rather than a hard block.
- **Not a regression per se** — the 500 limit has been in place for a while per the comment "(prev: 100 was too restrictive)", suggesting this limit was already raised once. It needs another raise, or a proper per-role split.
- **Staging vs prod:** both affected since staging has `NODE_ENV=production`. Anyone doing QA on staging hits this; anyone doing ops on prod hits this.
- **Related latent issue:** 401s on `/api/auth/session` in the same console trace. File as separate investigation if repro shows retry loops.
- **Frontend UX improvement (nice-to-have):** the shop management page should check response status and display a specific "rate limited — try again in a moment" message for 429 instead of the generic "Failed to unsuspend shop". Small UX fix, separate task.
- **Monitoring:** after fix deploys, watch DO backend logs for `Rate limit exceeded` warnings. If still frequent for admin routes, may need to raise further or implement smarter strategies (sliding window, burst allowance, etc.).

---

## Evidence Screenshots

From manual testing 2026-04-23:
- `sc1.png`: Admin Shop Management page with red toast "Failed to unsuspend shop" in top-right; Lee Repairs shop shown as Suspended with unsuspend button visible
- `sc2.png`: Browser console showing `401` on `/api/auth/session` (x2) and `429` on `/api/admin/me` and `/api/admin/shops/.../unsuspend`

(Screenshots stored locally at `C:\dev\sc1.png` and `C:\dev\sc2.png` at time of testing — not committed to repo.)
