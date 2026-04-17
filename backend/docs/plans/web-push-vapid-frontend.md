# Plan: Add Web Push (VAPID) Support — Frontend

## Context

The backend VAPID/Web Push implementation is complete (committed `69b0a57f`). The backend exposes:
- `GET /api/notifications/vapid-public-key` — public, returns `{ vapidPublicKey }`
- `POST /api/notifications/push-tokens` — auth required, accepts `{ deviceType: 'web', webPushSubscription: { endpoint, keys: { p256dh, auth } } }`
- `DELETE /api/notifications/push-tokens` — deactivate all tokens for user

The frontend currently has **no service worker, no Push API usage, no PWA config**. It uses WebSocket for real-time in-app notifications and the basic browser `Notification` API for foreground alerts. We need to add the Push API subscription flow so users receive notifications even when the tab is closed/backgrounded.

No new npm packages needed — Service Worker + Push API are browser-native.

---

## Files to Create

| File | Purpose |
|------|---------|
| `frontend/public/sw.js` | Service worker: handles `push` and `notificationclick` events |
| `frontend/src/hooks/usePushSubscription.ts` | Hook: SW registration, push subscribe/unsubscribe, token sync |

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/services/api/notifications.ts` | Add `getVapidPublicKey`, `registerPushToken`, `deactivateAllPushTokens` |
| `frontend/src/hooks/useNotifications.ts` | Call `subscribeToPush()` on auth, `unsubscribeFromPush()` on logout |
| `frontend/src/stores/authStore.ts` | Add push token cleanup in `logout()` before `resetAuth()` |
| `frontend/src/components/notifications/GeneralNotificationSettings.tsx` | Replace SMS "Coming Soon" card with Push Notifications status card |

---

## Implementation Steps

### Step 1: Service Worker (`frontend/public/sw.js`)

Plain JS file (no TypeScript, no imports). Next.js serves it at `/sw.js` automatically.

**`push` event handler:**
- Parse `event.data.json()` → `{ title, body, data }`
- Deduplicate with active tabs: check `clients.matchAll({ type: 'window', includeUncontrolled: true })` — if a **focused** client exists, skip `showNotification` (the WebSocket handler in `useNotifications.ts` already shows a browser notification for foreground)
- Call `self.registration.showNotification(title, { body, icon: '/logo.png', badge: '/logo.png', data, tag: data?.type || 'default' })`
- `tag` groups by notification type so duplicates replace rather than stack

**`notificationclick` event handler:**
- Read `event.notification.data` for payload
- Build target URL from `data.type`:
  - `new_booking`, `reschedule_request` → `/shop/orders`
  - `booking_confirmed`, `appointment_reminder`, `order_completed` → `/customer/bookings`
  - `reward_issued`, `token_gifted` → `/customer/dashboard`
  - `subscription_expiring` → `/shop/settings`
  - Default → `/`
- Close notification, then: find existing tab via `clients.matchAll()` → focus it + navigate, or `clients.openWindow(url)` if no tab

**`activate` event handler:**
- `self.clients.claim()` to take control of open tabs immediately on first install

**No `fetch` handler** — this is not a PWA cache worker.

### Step 2: API Functions (`frontend/src/services/api/notifications.ts`)

Add 3 functions to the existing file + update the `notificationsApi` export:

```typescript
// Public endpoint — no auth needed
export const getVapidPublicKey = async (): Promise<string> => {
  const response = await apiClient.get('/notifications/vapid-public-key');
  return response.vapidPublicKey;
};

export const registerPushToken = async (params: {
  deviceType: 'web';
  deviceName?: string;
  webPushSubscription: { endpoint: string; keys: { p256dh: string; auth: string } };
}): Promise<void> => {
  await apiClient.post('/notifications/push-tokens', params);
};

export const deactivateAllPushTokens = async (): Promise<void> => {
  await apiClient.delete('/notifications/push-tokens');
};
```

### Step 3: Push Subscription Hook (`frontend/src/hooks/usePushSubscription.ts`)

Exports two imperative functions (no useEffect — the caller decides when):

**`subscribeToPush()`:**
1. Guard: `if (!('serviceWorker' in navigator) || !('PushManager' in window)) return`
2. Register SW: `navigator.serviceWorker.register('/sw.js')`
3. Wait for `registration.active` (handle `installing`/`waiting` states)
4. Fetch VAPID key: `await getVapidPublicKey()`
5. Convert to `Uint8Array` via `urlBase64ToUint8Array()` helper
6. Check existing subscription: `await registration.pushManager.getSubscription()`
7. If existing endpoint matches `localStorage('rc_push_endpoint')` → skip (already registered)
8. If no subscription or endpoint changed → `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
9. POST to backend: `await registerPushToken({ deviceType: 'web', webPushSubscription: { endpoint, keys: { p256dh, auth } } })`
10. Store endpoint in `localStorage('rc_push_endpoint')`
11. If permission `'denied'` → log and return silently (no toast nagging)

**`unsubscribeFromPush()`:**
1. Get registration: `navigator.serviceWorker.getRegistration()`
2. Get subscription: `registration.pushManager.getSubscription()`
3. If exists: `subscription.unsubscribe()`
4. Call `deactivateAllPushTokens()` (backend cleanup)
5. Remove `rc_push_endpoint` from localStorage

**Internal helpers:**
- `urlBase64ToUint8Array(base64)` — standard VAPID key conversion (padding + atob + Uint8Array)
- `arrayBufferToBase64(buffer)` — convert `getKey()` ArrayBuffer to base64 string

### Step 4: Wire into useNotifications (`frontend/src/hooks/useNotifications.ts`)

In the main initialization `useEffect` (line 336):
- Import and call `usePushSubscription()` to get `{ subscribeToPush, unsubscribeFromPush }`
- After `connectWebSocket()` on line 355, add: `subscribeToPush()` (fire-and-forget)
- In the `!isAuthenticated` branch (line 359), after `disconnectWebSocket()`, add: `unsubscribeFromPush()`
- Return `subscribeToPush` from the hook so settings components can trigger re-subscription

### Step 5: Logout Cleanup (`frontend/src/stores/authStore.ts`)

In the `logout` function (line 366), **before** `get().resetAuth()` on line 386:

```typescript
// Deactivate web push tokens
try {
  await deactivateAllPushTokens();
  const registration = await navigator.serviceWorker?.getRegistration();
  const subscription = await registration?.pushManager?.getSubscription();
  await subscription?.unsubscribe();
  localStorage.removeItem('rc_push_endpoint');
} catch (e) {
  // Non-critical — tokens expire naturally
}
```

This is needed here (not just in the hook) because `logout()` calls `window.location.href = '/'` which unmounts all hooks before they can clean up.

### Step 6: Settings UI (`frontend/src/components/notifications/GeneralNotificationSettings.tsx`)

Replace the SMS "Coming Soon" card (line 510-516) with a Push Notifications card:

- Check `Notification.permission` on mount via a small `useState`/`useEffect`
- **`'granted'`** → green dot + "Active" label
- **`'default'`** → "Enable" button that calls `subscribeToPush()`
- **`'denied'`** → "Blocked" label + note to enable in browser settings

---

## Edge Cases

- **Subscription rotation**: Push API can silently change endpoints. On each auth'd app load, `subscribeToPush()` compares current endpoint with localStorage — re-registers if changed.
- **Multiple tabs**: `serviceWorker.register('/sw.js')` is idempotent. Multiple tabs get the same registration/subscription. Backend upserts by endpoint.
- **Duplicate notifications (foreground)**: The SW's `push` handler checks `clients.matchAll()` — if a focused client exists, it skips `showNotification` since the WebSocket handler already fires `new Notification()`.
- **Browser support**: Safari 16.4+, Chrome, Edge, Firefox all support Web Push. `'PushManager' in window` guard handles older browsers.
- **HTTPS requirement**: Web Push requires HTTPS (or localhost for dev). Production already uses HTTPS.

---

## Verification

1. Start frontend dev server: `cd frontend && npm run dev`
2. Open browser, log in, check DevTools > Application > Service Workers — `sw.js` should be registered
3. Check DevTools > Application > Push Messaging — subscription should be active
4. Verify backend received the token: check `device_push_tokens` table for a `device_type = 'web'` row
5. Trigger a test notification from another tab/backend — should appear as a system notification even if tab is backgrounded
6. Log out → verify the push subscription is deactivated (token row marked inactive in DB)
7. Check Notification Settings page — Push Notifications card shows correct status
8. Type check: `cd frontend && npx tsc --noEmit`
