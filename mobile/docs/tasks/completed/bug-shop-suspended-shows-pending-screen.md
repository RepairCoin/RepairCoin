# Bug: Suspended shops see the Pending Approval screen

**Status:** Completed
**Priority:** High
**Est. Effort:** 1 hr
**Created:** 2026-04-16
**Updated:** 2026-04-16
**Completed:** 2026-04-16

## Problem

When a suspended shop logged in (or restored their session from SecureStore), the app routed them to `"Application Pending — Please wait for approval from the admin"`. That screen is for shops that have never been verified. Suspended shops (previously verified, now deactivated by an admin) need their own messaging with the suspension reason and a path to re-check status.

A related gap in real-time suspension detection (WebSocket / push) was noted in the bug report but scoped out of this fix as it requires additional infrastructure.

## Analysis

### Root cause

`useAuth.useConnectWallet` and `useAuth.useSplashNavigation` treated every `verified=false || active=false` shop the same and routed to `/register/pending`. The backend's `/auth/check-user` response already distinguishes the two:

- **Pending:** `verified: false`, `suspendedAt: null`
- **Suspended:** `verified: true`, `active: false`, `suspendedAt: <timestamp>`, `suspensionReason: <reason>`

The mobile never read `suspendedAt` / `suspensionReason` from the response.

## Implementation

### Files created

- `mobile/feature/register/screens/ShopSuspendedScreen.tsx` — red warning UI with shop ID, suspension reason, suspended-on date, "Check Status" button, and "Logout".
- `mobile/feature/register/hooks/ui/useShopSuspended.ts` — exposes `handleLogout` and `handleCheckStatus`. The status check re-hits `/auth/check-user`; if the shop was reactivated it updates the cached profile and routes to `/shop/tabs/home`.
- `mobile/app/(auth)/register/suspended/index.tsx` — Expo Router route re-exporting the screen.

### Files modified

- `mobile/shared/interfaces/shop.interface.ts`
  - Added `isActive?`, `suspendedAt?`, `suspensionReason?` to `ShopData` so downstream consumers can read suspension state without type casts.
- `mobile/shared/hooks/auth/useAuth.ts`
  - `useConnectWallet.onSuccess`: when shop is not fully active, decide between `/register/suspended` and `/register/pending` based on `suspendedAt` or the verified-but-inactive combo.
  - Token-error fallback path updated the same way (so a shop that fails token fetch because it was just suspended still lands on the correct screen).
  - `useSplashNavigation`: session restore now routes suspended shops to `/register/suspended` instead of `/register/pending`.
- `mobile/feature/register/screens/index.ts` and `mobile/feature/register/hooks/ui/index.ts`
  - Barrel exports for the new screen and hook.

### Approach

Minimal addition — a new parallel screen/hook pair alongside the existing Pending one, with three targeted branches in `useAuth`. Did not touch the Pending screen, existing routes, or wallet/connection flow. Real-time suspension (WebSocket/push) was intentionally not tackled; the "Check Status" button gives the user a manual path to refresh.

## Verification Checklist

- [x] Pending shop (verified=false) logs in → sees "Application Pending" screen (unchanged)
- [x] Suspended shop (verified=true, active=false, suspendedAt set) logs in → sees new "Shop Suspended" screen with reason and suspended-on date
- [x] Active shop logs in → goes to shop dashboard
- [x] Suspended shop re-opens the app (session restored) → lands on suspended screen, not pending
- [x] Suspended shop taps "Check Status" → re-hits backend; if now reactivated, routes to dashboard; otherwise stays with latest reason
- [x] Suspended shop taps "Logout" → normal logout flow

## Notes

- **Real-time updates (not in scope):** the bug report suggested three options (push notification handler, periodic polling, WebSocket). None is implemented here — the manual "Check Status" button covers the most common case. Adding push-notification-driven auto-detection is a reasonable follow-up once the notification handler surface is extended.
- **Design choice:** kept the suspension route under `/register/suspended` (mirroring `/register/pending`) so both live in the same auth group and share layout/unauthenticated treatment.
- **Backend already returns `suspendedAt` / `suspensionReason`** from `/auth/check-user` (see `backend/src/routes/auth.ts:522-523`) — no backend changes needed.
