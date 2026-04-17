# Plan: Add Web Push (VAPID) Support — Backend Only

## Context

RepairCoin's mobile app has push notifications via Expo Push (proxies to FCM/APNs). The Next.js web frontend has **no push notification support**. We're adding Web Push using the `web-push` npm library with VAPID keys — an open standard that works on all browsers including Safari 16.4+, is completely free, and requires no third-party accounts.

The backend currently routes all push through `ExpoPushService`. We need to add a `WebPushService` alongside it, unified behind a `PushNotificationDispatcher` so all existing callers work with both mobile and web transparently.

---

## Files to Create

| File | Purpose |
|------|---------|
| `backend/migrations/101_add_web_push_support.sql` | Add `'web'` device type, `web_push_subscription` JSONB column |
| `backend/src/services/WebPushService.ts` | Web Push sender using `web-push` lib, mirrors ExpoPushService API |
| `backend/src/services/PushNotificationDispatcher.ts` | Routes to ExpoPushService (mobile) and WebPushService (web) |
| `backend/src/scripts/generate-vapid-keys.ts` | One-time VAPID key generation utility |

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/config/index.ts` | Add `webPush` config block (VAPID keys) |
| `backend/src/repositories/PushTokenRepository.ts` | Add web subscription support, `deviceTypes` filter param |
| `backend/src/services/ExpoPushService.ts` | Pass `['ios', 'android']` filter to repo queries (2 lines) |
| `backend/src/domains/notification/controllers/PushTokenController.ts` | Accept `'web'` device type, validate subscription JSON |
| `backend/src/domains/notification/routes/index.ts` | Add `GET /api/notifications/vapid-public-key` (public endpoint) |
| `backend/src/domains/notification/NotificationDomain.ts` | Use dispatcher instead of ExpoPushService |
| `backend/src/services/AppointmentReminderService.ts` | Use dispatcher instead of ExpoPushService |
| `backend/src/services/SubscriptionReminderService.ts` | Use dispatcher instead of ExpoPushService |
| `backend/src/domains/ServiceDomain/controllers/OrderController.ts` | Use dispatcher instead of ExpoPushService |
| `backend/package.json` | Add `web-push` + `@types/web-push` |

---

## Implementation Steps

### Step 1: Install dependency
```bash
cd backend && npm install web-push && npm install -D @types/web-push
```

### Step 2: Database migration (`backend/migrations/101_add_web_push_support.sql`)

- Drop and re-add `device_type` CHECK constraint to include `'web'`
- Add `web_push_subscription JSONB` column (nullable)
- Make `expo_push_token` nullable (web tokens won't have one)
- Add CHECK: web rows require `web_push_subscription IS NOT NULL`, mobile rows require `expo_push_token IS NOT NULL`
- Add unique index on `web_push_subscription->>'endpoint'` for web tokens
- Update `getTokenStats` query to include `web` platform count

**Key decision:** Web tokens store a synthetic `expo_push_token` value (`web-push:<sha256(endpoint)>`) to satisfy the existing unique constraint without restructuring it. The JSONB column stores the actual subscription `{ endpoint, keys: { p256dh, auth } }`.

### Step 3: VAPID key generation script (`backend/src/scripts/generate-vapid-keys.ts`)
- Calls `webpush.generateVAPIDKeys()`, prints keys to stdout
- Add npm script: `"generate:vapid": "ts-node src/scripts/generate-vapid-keys.ts"`

### Step 4: Config update (`backend/src/config/index.ts`)
- Add `static get webPush()` returning `vapidPublicKey`, `vapidPrivateKey`, `vapidSubject` from env
- VAPID keys are optional — if missing, WebPushService becomes a no-op (logs warning)

**Env vars to add:**
```
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:hello@repaircoin.ai
```

### Step 5: Update PushTokenRepository (`backend/src/repositories/PushTokenRepository.ts`)
- Add `WebPushSubscription` interface: `{ endpoint: string; keys: { p256dh: string; auth: string } }`
- Update `DevicePushToken` interface: add `webPushSubscription`, extend `deviceType` with `'web'`
- Update `RegisterTokenParams`: make `expoPushToken` optional, add optional `webPushSubscription`
- Update `registerToken()`: for web, generate synthetic expo token from endpoint hash, store subscription JSON
- Add optional `deviceTypes?: string[]` filter to `getActiveTokensByWallet()` and `getActiveTokensForUsers()`
- Update `getTokenStats()`: add web count

### Step 6: Minimal ExpoPushService change (`backend/src/services/ExpoPushService.ts`)
- In `sendToUser()`: pass `['ios', 'android']` to `getActiveTokensByWallet()`
- In `sendToMultipleUsers()`: pass `['ios', 'android']` to `getActiveTokensForUsers()`
- **Why:** Prevents web tokens from leaking into Expo pipeline where they'd be deactivated as invalid

### Step 7: Create WebPushService (`backend/src/services/WebPushService.ts`)
- Mirrors ExpoPushService structure: same `PushNotificationPayload` interface, same `SendPushResult` return type
- Initializes `web-push` with VAPID keys from Config; if keys missing, all sends return empty result
- `sendToUser()` calls repo with `['web']` filter, sends via `webpush.sendNotification()`
- Handles 410 Gone (expired subscription) by deactivating token — same pattern as Expo's `DeviceNotRegistered`
- Enforces 4KB payload limit (Web Push spec)
- Same 11 convenience methods as ExpoPushService (they just call `sendToUser` with the right payload)
- Singleton via `getWebPushService()`

### Step 8: Create PushNotificationDispatcher (`backend/src/services/PushNotificationDispatcher.ts`)
- Holds refs to both `ExpoPushService` and `WebPushService` singletons
- `sendToUser()` calls both services in parallel via `Promise.all`, merges `SendPushResult`
- `sendToMultipleUsers()` same pattern
- Same 11 convenience methods (delegate to `sendToUser`)
- Singleton via `getPushNotificationDispatcher()`

### Step 9: Update PushTokenController (`backend/src/domains/notification/controllers/PushTokenController.ts`)
- `registerToken()`: accept `deviceType: 'ios' | 'android' | 'web'`
- For `web`: require `webPushSubscription` body field (validate `endpoint`, `keys.p256dh`, `keys.auth`), skip Expo token validation
- For `ios`/`android`: existing validation unchanged

### Step 10: Update routes (`backend/src/domains/notification/routes/index.ts`)
- Add **before** `router.use(authMiddleware)`:
  ```
  GET /api/notifications/vapid-public-key -> returns { vapidPublicKey }
  ```
  This is public — the frontend needs it before auth to subscribe.

### Step 11: Swap callers to use dispatcher
Mechanical replacement in 4 files — same method signatures, just different import:

- `NotificationDomain.ts`: `expoPushService` -> `pushDispatcher` (via `getPushNotificationDispatcher()`)
- `AppointmentReminderService.ts`: same swap
- `SubscriptionReminderService.ts`: same swap
- `OrderController.ts`: same swap

---

## Deployment Order

Steps 1-6 can deploy independently with **zero behavior change** (mobile push keeps working exactly as before). Steps 7-8 add new code with no callers. Steps 9-10 enable web registration. Step 11 activates dispatching.

---

## Verification

1. **Migration:** Run `npm run db:migrate`, verify `device_push_tokens` table accepts `'web'` device type
2. **VAPID keys:** Run `npm run generate:vapid`, add to `.env`, verify `Config.webPush` returns them
3. **Public endpoint:** `curl http://localhost:4000/api/notifications/vapid-public-key` returns the public key
4. **Token registration:** POST to `/api/notifications/push-tokens` with `deviceType: 'web'` and a mock subscription JSON — verify row created in DB
5. **Mobile unaffected:** Existing Expo push token registration still works, mobile notifications still send
6. **Type check:** `cd backend && npm run typecheck`
7. **Existing tests:** `cd backend && npm run test`
