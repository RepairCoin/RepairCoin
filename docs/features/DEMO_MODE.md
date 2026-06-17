# Demo Mode — Customer Account

Demo mode provides a read-only customer experience for App Store / Play Store reviewers without requiring a real wallet.

## Overview

When enabled, an "Explore Demo" button appears on the mobile connect screen. Tapping it logs the user in as a pre-seeded demo customer with realistic data. All write actions (favorites, redemptions, etc.) are blocked with a toast message.

---

## Demo Account Details

| Field | Value |
|---|---|
| Address | `0x00000000000000000000000000000000000de210` |
| Name | Demo User |
| Email | demo@repaircoin.app |
| Tier | BRONZE |
| RCN Balance | 75 RCN |
| Lifetime Earnings | 150 RCN |
| Total Redemptions | 25 |
| Referral Code | `DEMO0000` |
| Referral Count | 2 |

---

## Managing Demo Mode (Backend CLI)

Run these commands from the `backend/` directory:

```bash
# Create the demo customer in DB and activate the button
npm run demo:enable

# Hide the "Explore Demo" button (sets is_active = false)
npm run demo:disable

# Check current state
npm run demo:status
```

- `demo:enable` — upserts the demo customer row and sets `is_active = true`
- `demo:disable` — sets `is_active = false`; the mobile app hides the button automatically
- The demo customer row is never deleted; toggling `is_active` controls visibility

---

## API Endpoints

### Check if demo mode is active
```
GET /api/auth/demo/status
Response: { "enabled": true | false }
```
Called by the mobile app on the connect screen to decide whether to show the "Explore Demo" button.

### Demo login
```
POST /api/auth/demo
Response: { success, token, address, userType, profile }
```
Returns a signed JWT for the demo address. No wallet signature required.

---

## Backend Implementation

**Files:**
- `backend/src/cli/demo-mode.ts` — CLI to manage the demo customer
- `backend/src/routes/auth.ts` (lines 1637–1722) — `/demo/status` and `/demo` endpoints
- `backend/src/middleware/auth.ts` (line 472) — demo address bypasses DB validation in JWT middleware
- `backend/src/domains/ServiceDomain/controllers/FavoriteController.ts` — returns empty/mock data for the demo address instead of hitting the DB

The demo address is defined as a constant in each file:
```typescript
const DEMO_ADDRESS = '0x00000000000000000000000000000000000de210';
```

**Auth middleware bypass:**
The demo JWT is valid but the demo address has no real DB record (beyond the `customers` table row). The middleware skips the normal user existence check for this address so it never gets a 401.

---

## Mobile Implementation

**Files:**
- `mobile/feature/auth/services/auth.services.ts` — `getDemoStatus()` and `loginDemo()` API calls
- `mobile/feature/auth/hooks/useAuthQuery.ts` — `useDemoLogin` mutation
- `mobile/feature/auth/store/auth.store.ts` — `isDemo: boolean` flag (persisted via SecureStore)
- `mobile/feature/auth/screens/connect/ConnectWalletScreen.tsx` — conditional "Explore Demo" / "Connect" button
- `mobile/shared/hooks/useDemoGuard.ts` — blocks write actions in demo mode
- `mobile/shared/components/ui/DemoBanner.tsx` — yellow banner shown across all customer screens

### Login flow

1. `ConnectWalletScreen` calls `getDemoStatus()` on mount
2. If `enabled`, renders "Explore Demo" button instead of "Connect"
3. Tapping calls `useDemoLogin` → `POST /api/auth/demo`
4. On success: sets `isDemo = true` in auth store, stores token, navigates to `/customer/tabs/home`

### Demo guard

Use `useDemoGuard` before any write operation:

```typescript
const demoBlocked = useDemoGuard();

const handleSomething = () => {
  if (demoBlocked()) return; // shows toast and exits
  // proceed with write action
};
```

Returns `true` and shows an error toast if the user is in demo mode.

### Demo banner

`DemoBanner` renders a yellow bar at the top of screens when `isDemo = true`:

> "Demo Mode — Browse only. Sign in with a wallet for full access."

The "Exit" button clears auth state and redirects to the connect screen.

---

## Restrictions in Demo Mode

| Action | Allowed |
|---|---|
| Browse services | Yes |
| View home dashboard | Yes |
| View profile | Yes |
| Add/remove favorites | No (blocked by `FavoriteController`) |
| Redeem RCN | No (blocked by `useDemoGuard`) |
| Any other write | No (blocked by `useDemoGuard`) |

---

## Setup for a New Environment

1. Run `cd backend && npm run demo:enable` once to seed the demo customer
2. The mobile app will automatically show the "Explore Demo" button
3. To hide it before a production release, run `npm run demo:disable`
