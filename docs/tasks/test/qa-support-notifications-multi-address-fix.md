# QA Test Guide: Support Notifications Multi-Address Fix

**Related task:** `docs/tasks/shops/bug-support-notifications-wrong-receiver-address.md`
**Fix commit:** `9dbddac0 fix: support ticket notifications use wrong receiver_address`
**Environment:** Staging
**Created:** 2026-04-22
**Last verified against DB:** 2026-04-22 via `backend/scripts/verify-support-notifications-fix.ts`

---

## What this fix does

**Scope: visibility only, NOT real-time delivery.** This fix changes how the notification bell QUERIES the database — it does not add or change any real-time delivery mechanism.

Previously: notifications stored with `receiver_address = "peanut"` (the shopId) were invisible because the bell only queried by wallet address. They existed in the DB but the shop never saw them — even on refresh.

After the fix: the bell queries by BOTH the logged-in wallet address AND the shop ID from the JWT. So on page load / refresh / navigation, the bell includes every notification addressed to any of the shop's identities.

**What this fix does NOT do (out of scope):**
- It does NOT make new notifications appear instantly (no WebSocket push is added to the support notification flow).
- A new admin reply appears in the bell when the shop **refreshes** or navigates — not in real-time.
- Real-time delivery for support messages would be a separate follow-up task: SupportChatService would need to also emit a WebSocket event keyed by the shop's wallet address (not shopId), and that's not part of this fix.

## Pre-requisites

| Item | Value |
|---|---|
| Environment | Staging |
| Frontend URL | `https://staging.repaircoin.ai` (or current staging URL) |
| Test shop | **peanut** — email `kyle.cagunot@mothergooseschools.org`, wallet `0xb3afc20c0f66e9ec902bd7df2313b57ae8fb1d81` |
| Admin account | Any of Jeff / Khalid / Ian / deo (admin wallets from `prod_env.txt:6`) |
| Expected data (as of 2026-04-22) | Shop peanut has **278 total** notifications (277 unread): 126 stored under "peanut" shopId, 152 under the shop's wallet address |
| Browser | Chrome/Firefox latest. Use incognito or separate profile for admin vs shop to avoid session conflicts. |

## Quick re-verify DB counts before testing

If you want to confirm the expected numbers haven't drifted:

```bash
cd C:/dev/RepairCoin/backend
npx ts-node scripts/verify-support-notifications-fix.ts peanut
```

Use whatever "GRAND TOTAL" and "total=X unread=Y" shows as your expected values for Test 1.

---

## Test 1 — Shop sees ALL notifications (including shopId-addressed ones)

**Goal:** confirm the bell count matches the sum across all identities.

### Steps

1. Open incognito browser → `https://staging.repaircoin.ai`
2. Log in as shop "peanut" (email: `kyle.cagunot@mothergooseschools.org`, whichever login method the shop normally uses)
3. On the shop dashboard, locate the notification bell icon (top-right)
4. Observe the **unread badge count**
5. Click the bell to expand the notification list
6. Scroll to the bottom to view ALL notifications

### Expected

| Check | Expected value |
|---|---|
| Unread badge on bell icon | **277** (may vary slightly — re-run verification script for fresh count) |
| Total notifications in the list | **278** when fully scrolled / paginated |
| At least one notification with body text starting "Admin responded to your ticket: Test ticket" | **Yes** — 3 such notifications from 2026-03-24 + 2026-04-12 |

### Pass/Fail

- [ ] **PASS** — count matches (within ±1 due to any new notifications created during testing)
- [ ] **FAIL** — count is much lower (e.g., only 152 — meaning fix is not deployed to staging yet)

**If FAIL:** the fix (commit `9dbddac0`) may not have been deployed to staging yet. Check the DO staging app's deployed commit.

---

## Test 2 — Mark a shopId-addressed notification as read

**Goal:** confirm ownership check passes for notifications stored with `receiver_address = "peanut"`.

### Steps

1. While logged in as peanut (from Test 1)
2. In the notification list, find one of the "Admin responded to your ticket: Test ticket" entries (these are guaranteed to have `receiver_address = "peanut"`)
3. Click it — the notification should either navigate to the ticket view OR mark as read inline
4. Check the unread badge on the bell

### Expected

- Notification visually changes from unread to read state (dot disappears, text color dims, etc.)
- Bell unread badge decreases by 1 (276, or whatever it was minus 1)
- No 403 Forbidden error in browser devtools → Network tab for the `PATCH /api/notifications/:id/read` request

### Pass/Fail

- [ ] **PASS** — marked as read without error
- [ ] **FAIL** — got 403 or the notification stayed unread

**If FAIL:** the `isOwner()` ownership check in `NotificationController.ts:26-29` may not be treating shopId-receivers correctly.

---

## Test 3 — Mark all as read (multi-identity)

**Goal:** confirm the bulk mark-all endpoint works across both identities.

### Steps

1. While logged in as peanut
2. Note the current unread count (e.g., 276)
3. Click "Mark all as read" (typically in the notification dropdown footer)
4. Confirm the unread badge drops to 0
5. Refresh the page → verify badge stays at 0

### Expected

- Badge shows 0
- Notification list items are all styled as "read"
- Devtools → Network → `PATCH /api/notifications/read-all` returns 200 with `{ count: N, message: "..." }` where N is roughly your starting unread count

### Pass/Fail

- [ ] **PASS** — all marked, count went to 0
- [ ] **FAIL** — some notifications (likely the shopId-receiver ones) remain unread after clicking "Mark all"

**If FAIL:** `markAllAsReadMulti` in the repository isn't hitting all addresses. Check the query in `NotificationRepository.ts`.

---

## Test 4 — Delete a shopId-addressed notification

**Goal:** confirm deletion works for notifications with `receiver_address = "peanut"`.

### Steps

1. While logged in as peanut
2. Find a support_message_received notification (peanut receiver)
3. Delete it (via whatever UI affordance exists — X button, swipe, etc.)
4. Refresh the page
5. Verify it's gone from the list and the total count decreased by 1

### Expected

- Notification disappears from the UI immediately
- Refresh confirms server-side delete (does not reappear)
- Total count: was 278 → now 277
- No 403 Forbidden

### Pass/Fail

- [ ] **PASS** — deleted cleanly
- [ ] **FAIL** — 403, or reappears on refresh

**If FAIL:** ownership check in `deleteNotification` handler (`NotificationController.ts:217`) isn't treating shopId-receivers correctly.

**Caution:** this test is destructive. Use a support_* notification (which is what the fix targets) rather than something important. Or skip if you want to preserve test data — Tests 1–3 already exercise the fix sufficiently.

---

## Test 5 — New admin reply appears in bell after shop refreshes

**Goal:** confirm end-to-end flow — admin replies to ticket, and on the shop's next page refresh/navigation, the new notification appears in the bell.

**Important:** this test expects the notification to appear **on refresh**, NOT instantly. This fix is visibility-only; real-time push for support messages is out of scope. Do not fail this test if the notification doesn't show up without refreshing.

### Steps

1. In ONE browser (say Chrome incognito), log in as **admin** → go to the Admin dashboard → Support Tickets section
2. Find an existing ticket for peanut shop OR have peanut create a new test ticket first
3. Open the ticket → write a test reply: e.g., `QA test reply — 2026-04-22 14:00`
4. Send
5. In a SECOND browser (Firefox OR a different Chrome profile), log in as peanut shop
6. Go to the dashboard and refresh to ensure latest data
7. Click the notification bell

### Expected

- The most recent notification at the top of peanut's bell is: **"New message from Admin Support in ticket #... QA test reply — 2026-04-22 14:00"** (or similar — based on the `support_message_received` template)
- Created within the last few minutes
- `receiver_address` in the DB should be `"peanut"` (the shopId) — you can confirm with a direct DB query if curious:
  ```sql
  SELECT receiver_address, created_at, LEFT(message, 80)
  FROM notifications
  WHERE notification_type = 'support_message_received'
  ORDER BY created_at DESC LIMIT 3;
  ```

### Pass/Fail

- [ ] **PASS** — new notification appears in bell on refresh
- [ ] **FAIL** — notification not in bell even after refresh (bell doesn't see shopId-addressed notifications)

---

## Test 6 — MetaMask login vs Social login (both should work)

**Goal:** confirm the fix works regardless of which wallet address the JWT carries.

**Only applicable if peanut supports both login methods.** Skip if peanut only uses one method.

### Steps

#### 6a — MetaMask login

1. Clear browser storage (logout + incognito new window)
2. Log in to staging as peanut via **MetaMask**
3. Check bell count → should be 277 (or 278 depending on where Tests 2–4 left things)

#### 6b — Social login

1. Clear browser storage again
2. Log in as peanut via **Google / email / social** (whatever the shop uses)
3. Check bell count → should be the same as Test 6a

### Expected

Both login methods produce the same bell count, because both derive `shopId = "peanut"` from the JWT, and the fix queries by [wallet + shopId].

### Pass/Fail

- [ ] **PASS** — both login methods show the same count
- [ ] **FAIL** — MetaMask shows one count, social login shows a different count (suggests JWT `shopId` is missing for one of the two login paths — fix still works for the shopId-receivers, but the wallet-receivers would be invisible for the mismatched login)

---

## Test 7 — Regression: customer notifications unaffected

**Goal:** confirm the fix didn't break customer bell (customers don't have `shopId` in JWT).

### Steps

1. Log out of shop
2. Log in as a test customer (any existing customer with notifications)
3. Check the bell → should show the customer's notifications as before

### Expected

- Customer bell shows expected notifications addressed to their wallet
- No new notifications that belong to shops or admins (the fix's multi-address query simply doesn't add anything for customers since `req.user.shopId` is undefined → filter(Boolean) returns only the wallet)
- No 500 errors, no permission issues

### Pass/Fail

- [ ] **PASS** — customer bell works as before
- [ ] **FAIL** — customer can see notifications they shouldn't, or own notifications are missing

---

## Test 8 — Regression: admin notifications unaffected

**Goal:** confirm admin bell still shows admin-addressed notifications.

### Steps

1. Log in as any admin (Jeff / Khalid / Ian / deo wallet)
2. Check the bell

### Expected

- Admin's bell shows notifications where `receiver_address = <admin wallet>`
- Per the verification script, admins have 11–19 `support_*` notifications each → these should all appear
- Admins don't have a `shopId`, so the multi-address query reduces to just the wallet — same behavior as before the fix

### Pass/Fail

- [ ] **PASS** — admin bell works normally
- [ ] **FAIL** — admin can see a shop's notifications (would indicate the multi-address query is leaking), or admin's own notifications missing

---

## Test 9 — Unread count endpoint

**Goal:** confirm `/api/notifications/unread/count` also uses multi-address.

### Steps

1. Log in as peanut
2. Open browser devtools → Network tab → filter by `notifications`
3. Navigate in the app to something that triggers the bell count fetch
4. Find the `GET /api/notifications/unread/count` request
5. Examine the response JSON

### Expected

- Response: `{ "count": 277 }` (or current unread value)
- Matches the bell badge visually

### Pass/Fail

- [ ] **PASS** — count matches across both the badge and the endpoint response
- [ ] **FAIL** — endpoint returns a smaller count than expected (152 instead of 277 would mean the unread-count endpoint isn't using the multi-address helper)

---

## Summary checklist

| # | Test | Result |
|---|---|---|
| 1 | Shop sees ALL notifications (both identity types) | ☐ |
| 2 | Mark single shopId-addressed notification as read | ☐ |
| 3 | Mark all as read (both identities) | ☐ |
| 4 | Delete shopId-addressed notification | ☐ |
| 5 | New admin reply appears in shop bell | ☐ |
| 6a | MetaMask login shows correct count | ☐ (skip if N/A) |
| 6b | Social login shows correct count | ☐ (skip if N/A) |
| 7 | Customer bell unaffected | ☐ |
| 8 | Admin bell unaffected | ☐ |
| 9 | `/api/notifications/unread/count` returns multi-address count | ☐ |

**All green → close the bug doc as Status: Completed, move to `docs/tasks/completed/`.**

**Any red → screenshot the failure + relevant devtools Network response, and paste in a follow-up task doc so the fix can be revisited.**

---

## Notes

- Tests 1 and 5 are the highest-value — together they prove the core claim (notifications addressed via shopId are now visible, both historical and new).
- Tests 2, 3, 4 prove the fix extends across all CRUD operations (not just reads).
- Tests 7 and 8 prove no regressions in other roles.
- Test 9 proves the unread-count endpoint (used for the bell badge) is also multi-address aware.
- If you want to save time, do Tests 1, 5, 7, 8 only — that's 80% of the coverage in 20% of the time.
