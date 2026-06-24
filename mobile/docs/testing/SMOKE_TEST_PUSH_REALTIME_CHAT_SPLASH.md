# QA Smoke Test: Push Notifications, Realtime, Chat & Splash

## Date: 2026-06-24
## Platform: Mobile (React Native / Expo) — **physical devices only** (push does not fire on simulators/emulators)
## Build range under test: commit `0d692919` → `b5c308fa` (latest)
## Category: Smoke / regression pass before release

---

## Scope

This pass covers everything changed in the current branch since `0d692919`:

| Area | What changed | Commit(s) |
|------|--------------|-----------|
| A. Push token handoff | Logout/account-switch no longer leaks pushes to the old account | `d1a0102c` |
| B. Foreground banner suppression | No OS banner for the chat you're already viewing | `756c82b1` |
| C. Notification deep-link routing | Tapping a push opens the right screen (background/killed) | `0ad0ddea` |
| D. Cold-start splash | Branded gold-logo splash on every launch path | `c9ffc91b`, `e0ef9a08` |
| E. Realtime WebSocket | In-app notifications, badges & conversation list update live | `ca0a7cd7` |
| F. Chat thread | Newest-first pagination, working realtime refetch, presence | `bde3d869`, `d9fdbbaa` |
| G. Native notification dismissal on read | All of a conversation's tray notifications clear when read | `b5c308fa` |
| H. Push suppression leak fix | Pushes resume after viewing a thread (backend presence) | `9ad0456d` |

---

## Prerequisites & Setup

- **2 physical devices** (or 1 device + 1 web client) so you can send messages between two accounts.
  - **Device 1**: Customer account.
  - **Device 2**: Shop account (or use the web app as the shop).
- Both accounts must have an **active conversation** with each other.
- **Notifications permission GRANTED** on both devices (Settings → App → Notifications).
- Backend reachable; WebSocket endpoint up.
- Recommended: keep one device attached to Metro/logcat to watch for errors (no functional logs are expected — release build has none).
- Note "native notification" = the OS banner/tray entry. "In-app notification" = the bell/notification list inside the app.

> **Tip for testers:** A "cold start" = app fully killed (swiped away from recents) before the action. "Backgrounded" = app sent to background (home button) but still in recents.

---

## Section A — Push token handoff on logout / account switch

### Test A.1: Logged-out user stops receiving pushes
1. Log in as **Account 1** on the device; confirm pushes arrive (have Account 2 send a message — banner appears).
2. **Log out** of Account 1.
3. From Account 2, send Account 1 a new message.
4. **Expected**: Account 1 (now logged out) receives **NO** native notification.
5. **Verify**: No banner, no tray entry for the logged-out account.

### Test A.2: Account switch on the same device
1. Log in as **Account 1**, then log out.
2. Log in as a **different Account 2** on the same device.
3. Have a third party send Account 2 a message.
4. **Expected**: Only **Account 2** receives the push. Account 1 receives nothing.
5. **Verify**: The new account's notifications work immediately (token registered for the new wallet).

### Test A.3: "Notifications off" is per-account
1. As Account 1, turn notifications **OFF** in app settings.
2. Log out, log in as Account 2 (same device).
3. **Expected**: Account 2's notifications are **ON** by default (Account 1's "off" choice does NOT suppress Account 2).
4. Log back in as Account 1.
5. **Expected**: Account 1 is still **OFF** (its choice persisted).

---

## Section B — Foreground banner suppression for the active chat

### Test B.1: No banner while viewing the conversation
1. On Device 1, **open the chat thread** with Account 2 and keep it on screen.
2. From Device 2, send a message.
3. **Expected**: The message appears **live in the thread**, and **NO** OS heads-up banner/sound fires for it.
4. **Verify**: The message is visible without pull-to-refresh.

### Test B.2: Banner DOES show for other conversations
1. On Device 1, stay inside the chat with Account 2.
2. From a **different** sender (Account 3 / another shop), send Account 1 a message.
3. **Expected**: A native banner **DOES** appear (it's a different conversation).

### Test B.3: Banner shows when not viewing the thread
1. On Device 1, navigate to the **home screen** (not the chat).
2. From Device 2, send a message.
3. **Expected**: A native banner appears normally.

---

## Section C — Notification deep-link routing

### Test C.1: Tap push from a backgrounded app
1. On Device 1, background the app (home button).
2. From Device 2, send a message.
3. Tap the native notification.
4. **Expected**: App opens **directly to that conversation thread**.

### Test C.2: Tap push from a killed app (cold start)
1. On Device 1, **fully kill** the app (swipe from recents).
2. From Device 2, send a message.
3. Tap the native notification.
4. **Expected**: App cold-starts and lands **on that conversation thread** (not the home screen, not a blank screen).

### Test C.3: Other notification types route correctly
Trigger each (where feasible) and tap from background:
- Reward issued → **History** screen
- Redemption request → shop **Redeem** / customer **Redeem**
- New booking → the specific **booking detail**
- Appointment reminder / order completed → bookings / service screen
- Subscription expiring (shop) → **Subscription** screen

**Expected**: Each opens its correct destination. No notification should drop the user on a blank screen.

---

## Section D — Cold-start splash screen

### Test D.1: Launcher cold start
1. Fully kill the app.
2. Open it from the launcher icon.
3. **Expected**: A **black** screen with the **gold RepairCoin logo** is shown immediately (no white flash), held until the landed screen's data is ready.
4. **Verify**: You land on a **fully-loaded** screen (home with data / chat with messages), not an empty loading state.

### Test D.2: Cold start from a push tap
1. Fully kill the app.
2. Tap a message push to launch it.
3. **Expected**: Same branded gold-logo-on-black splash appears (the logo must be visible — this was previously blank on notification launches), then lands on the target conversation **already loaded**.

### Test D.3: Splash never hangs
1. Repeat cold starts a few times, including on a slow/throttled network.
2. **Expected**: The splash always lifts once the screen is ready, and never hangs longer than ~8s (safety timeout) even if data is slow.
3. **Verify**: Taps on the splash do nothing (they're swallowed) — no double navigation.

---

## Section E — Realtime WebSocket (in-app notifications, badges, lists)

### Test E.1: In-app notification list updates live
1. On Device 1, open the **Notifications** screen (bell).
2. Trigger a notification to Account 1 (e.g. Account 2 sends a message, or a reward is issued).
3. **Expected**: The new notification appears at the **top of the list live** — no manual refresh.
4. **Verify**: The connection indicator dot in the notification tabs shows **connected**.

### Test E.2: Message badge updates live
1. On Device 1, sit on the **home screen** (Message button visible with its unread badge).
2. From Device 2, send a message.
3. **Expected**: The Message button **unread badge increments live**.
4. Open and read the thread, return home.
5. **Expected**: The badge **clears/decrements** accordingly.
> Run this for **both** a customer home and a shop home.

### Test E.3: Conversation list reorders live
1. On Device 1, open the **Messages list** (conversations).
2. From Device 2, send a message into a conversation that is NOT at the top.
3. **Expected**: That conversation **jumps to the top** with the new preview/unread, live.

### Test E.4: Reconnect after backgrounding
1. On Device 1, background the app for ~1 minute, then foreground it.
2. **Expected**: The socket **reconnects** (connection dot returns to connected); live updates resume.
3. From Device 2, send a message → it should still arrive live in-app.

---

## Section F — Chat thread (pagination, realtime, presence)

### Test F.1: Opens pinned to the newest message
1. Open a conversation that has **more than 50 messages**.
2. **Expected**: It opens **pinned to the most recent message** (bottom), no manual scroll needed.
3. **Verify** (regression): You see the **latest** messages — NOT the oldest 50. (This was the core bug.)

### Test F.2: Load older messages on scroll up
1. In a long thread, **scroll up** to the top of the loaded messages.
2. **Expected**: A spinner shows and **older messages load** (30 per page) and prepend without jumping your scroll position.
3. Keep scrolling up to confirm further pages load until the start of the thread.

### Test F.3: Realtime new messages appear (the "refetch stopped working" regression)
1. Keep the thread open on Device 1.
2. From Device 2, send several messages.
3. **Expected**: Each new message **appears at the bottom live**, in order, with **no duplicates**.
4. **Verify**: Previously-loaded older pages remain loaded (new arrivals don't reset the list).

### Test F.4: Send a message
1. Send a message from Device 1.
2. **Expected**: It appears immediately at the bottom; the list auto-scrolls to it.
3. **Verify**: Device 2 receives it live (in-app if open, push if backgrounded).

---

## Section G — Native notification dismissal on read  ⭐ (primary fix)

### Test G.1: Reading clears ALL of a conversation's tray notifications
1. On Device 1, **kill or background** the app.
2. From Device 2, send **3 separate messages** → Device 1 shows **3 native notifications**.
3. Tap **one** of them (or open the app and open the thread from the conversation list).
4. **Expected**: After the thread opens/loads, **all 3** native notifications for that conversation are **removed from the tray** — not just the tapped one.
5. **Verify**: The notification tray has no leftover entries from that sender's thread.

### Test G.2: Open from conversation list also clears the tray
1. With 3 unread native notifications from Account 2 in the tray, open the app to the **conversation list** (not via the push).
2. Tap the conversation to open it.
3. **Expected**: The 3 tray notifications for that conversation clear once the thread loads.

### Test G.3: Other senders' notifications are NOT cleared
1. Have native notifications from **two different senders** in the tray.
2. Open and read **one** sender's thread.
3. **Expected**: Only **that sender's** notifications clear; the other sender's remain.
> **Known limitation (by design):** notifications received while backgrounded carry only the sender's display name. If two *different* conversations have the **exact same sender display name**, reading one will clear both. Verify behaviour with distinctly-named senders.

---

## Section H — Push suppression leak fix (backend presence)

### Test H.1: Pushes resume after viewing then leaving a thread
1. On Device 1, log in. Confirm a push arrives from Account 2 (Test A baseline).
2. Open the chat thread with Account 2, read it, then **navigate back** to the main page.
3. **Background or kill** the app.
4. From Device 2, send a new message.
5. **Expected**: Device 1 **receives the native notification** for that new message.
6. **Verify (the regression):** Notifications must keep arriving for that conversation **without** needing to log out and back in.

### Test H.2: Repeated open/close does not break notifications
1. Repeat several times: open the thread → back out → background the app → have Account 2 send a message.
2. **Expected**: Every round still produces a native notification on Device 1.
3. **Verify**: No state where the conversation goes permanently silent until re-login.

### Test H.3: Reconnect churn (stress)
1. On Device 1, toggle airplane mode on/off a couple of times while the app is open in a thread (forces socket reconnects), then leave the thread and background the app.
2. From Device 2, send a message.
3. **Expected**: The native notification still arrives (presence cleared correctly despite reconnect churn).

---

## Regression sanity (quick)

- [ ] Login / logout works; no stuck spinners.
- [ ] Customer and shop dashboards load with data after splash.
- [ ] Redeem / issue rewards flows still function (unaffected, but smoke them).
- [ ] No new crashes on cold start, push tap, or backgrounding.

---

## Result Log

| Section | Test | iOS | Android | Notes |
|---------|------|:---:|:-------:|-------|
| A | A.1 | ⬜ | ⬜ | |
| A | A.2 | ⬜ | ⬜ | |
| A | A.3 | ⬜ | ⬜ | |
| B | B.1 | ⬜ | ⬜ | |
| B | B.2 | ⬜ | ⬜ | |
| B | B.3 | ⬜ | ⬜ | |
| C | C.1 | ⬜ | ⬜ | |
| C | C.2 | ⬜ | ⬜ | |
| C | C.3 | ⬜ | ⬜ | |
| D | D.1 | ⬜ | ⬜ | |
| D | D.2 | ⬜ | ⬜ | |
| D | D.3 | ⬜ | ⬜ | |
| E | E.1 | ⬜ | ⬜ | |
| E | E.2 | ⬜ | ⬜ | |
| E | E.3 | ⬜ | ⬜ | |
| E | E.4 | ⬜ | ⬜ | |
| F | F.1 | ⬜ | ⬜ | |
| F | F.2 | ⬜ | ⬜ | |
| F | F.3 | ⬜ | ⬜ | |
| F | F.4 | ⬜ | ⬜ | |
| G | G.1 | ⬜ | ⬜ | |
| G | G.2 | ⬜ | ⬜ | |
| G | G.3 | ⬜ | ⬜ | |
| H | H.1 | ⬜ | ⬜ | |
| H | H.2 | ⬜ | ⬜ | |
| H | H.3 | ⬜ | ⬜ | |

**Legend:** ✅ pass · ❌ fail (file a bug under `mobile/docs/tasks/bugs/`) · ⬜ not run · ➖ N/A

---

## Notes for QA
- **Push requires a real device.** Simulators/emulators will not deliver Expo/FCM pushes.
- Android vs iOS behave differently for backgrounded notifications — run both columns where possible.
- Section **G** and **H** are the headline fixes in this build — prioritise them.
- If a native splash/color change (`app.config.ts`) looks off, confirm the build was a **fresh prebuild/rebuild** (that change is native, not OTA).
