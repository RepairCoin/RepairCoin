# Strategy: WebSocket Message Delivery Reliability

_Drafted: 2026-05-15_

## Problem Statement

Real-time message delivery on the chat is unreliable: a non-trivial fraction of `message:new` WebSocket broadcasts never reach the receiver, leaving messages stuck in the database but invisible to the recipient until the next refetch trigger (manual refresh, page navigation, or the receiver themselves sending another message).

### Observed trace (Peanut ↔ Qua Ting, 2026-05-15)

DB-verified message timeline on conversation `conv_1778475156978_w09ibywla`:

```
18:03:40 customer  "Hi! I'm interested in your service Newly Baker..."
18:03:53 shop (AI) "Hey Qua Ting! I'm Peanut's AI assistant..."          → customer received ✓
18:04:30 customer  "what is your hours?"
18:04:33 shop (AI) "Here are the shop hours..."                          → customer received ✓
18:06:45 shop (human) "actually we will having saturday soon..."         → customer received ✓
18:07:57 customer  "that's cool! i will check my schedule"
18:08:02 shop (AI) "No worries, take your time!..."                      → customer received ✓
18:10:21 shop (human) "we have the best bread making training..."        → CUSTOMER DID NOT SEE
```

Customer's chat UI showed messages 1-7. Row 8 was in the DB but invisible until manual page refresh.

### Why this matters beyond one bug

The same delivery-drop pattern affects:
- Shop staff replying when the customer's tab was backgrounded for any reason
- AI auto-reply broadcasts when the customer's WS dropped during the 3-7s the model was generating
- Cross-device sync (customer on phone + desktop — one device drops, the other gets a permanent gap)
- Any message arriving during a frontend deploy / backend restart / network blip

It is the silent failure mode for the messaging system as a whole.

## Root Cause Analysis

Three independent causes can produce the same visible bug:

### Cause 1 — Receiver's WS connection is not OPEN at broadcast time

Backend's `WebSocketManager.sendToAddresses` (used by `MessageService.sendMessage`) iterates connected clients and skips any whose `readyState !== WebSocket.OPEN`:

```typescript
// Conceptual — actual code uses an address-keyed map
for (const client of clientsByAddress[address]) {
  if (client.readyState === WebSocket.OPEN) client.send(payload);
  // else: silently skipped
}
```

If the receiver:
- Just had their browser background the tab (browsers throttle / suspend timers, sometimes terminating WS)
- Hit a network blip (Wi-Fi handoff, VPN reconnect, ISP routing flap)
- Was on a tab that hadn't yet opened its WS (page load race)
- Backend was deploying / restarting

...the broadcast is silently dropped at the backend's send step. No retry, no buffer.

### Cause 2 — Reconnect happens but `ws-reconnected` event never fires

`useNotifications` (frontend) dispatches a `ws-reconnected` browser CustomEvent **only** when the WS detects its own onclose and reconnects via the exponential-backoff path. Edge cases where it WON'T fire:

- WS connection becomes a "zombie" (TCP stays open, but no traffic flows because of intermediate NAT timeout or proxy issue). The browser doesn't fire `onclose`, so reconnect logic never runs.
- Browser tab is suspended (mobile background) — JS event loop frozen, `onclose` may queue but not fire until tab is foregrounded again. Messages broadcast during suspension are lost; no reconnect event when tab wakes because the connection was never "closed" from JS's perspective.
- The reconnect logic itself errored at some path that wasn't caught.

### Cause 3 — No periodic / fallback refetch on open conversations

`useConversationMessages` refetches on three triggers:
1. Initial mount (`fetchMessages(true)`)
2. `new-message-received` browser event (driven by live WS)
3. `ws-reconnected` browser event (driven by detected reconnect)

There is no time-based fallback. A conversation can sit visibly stale indefinitely if (1), (2), and (3) all fail to fire.

The existing 5s/12s post-send catchup (`MessagesContainer.tsx`) is targeted only at the AI-reply-after-customer-send race. It does not fire for shop→customer messages because the trigger is the customer's own send action.

## Goal

Make message delivery durable enough that a dropped WS broadcast is corrected within **≤ 30 seconds** without requiring user action. The receiver should never see a permanently stale conversation while actively viewing it.

Out of scope for this strategy: real-time-delivery latency optimization, push notifications when tab backgrounded (already exists), encrypted-message delivery semantics (separate concern).

## Options

| # | Approach | Effort | Catches all 3 causes? | Notes |
|---|---|---|---|---|
| **A** | **Periodic background poll** on the actively-mounted conversation: every 30s, refetch page 1, merge anything newer than the mounted tail. | ~30 min | ✓ Catches all 3 causes — if WS missed it, the poll catches it within 30s. | Cheapest, most pragmatic. Cost: 1 extra HTTP GET per conversation per 30s while viewed. The endpoint is already there. |
| **B** | **WS heartbeat + zombie detection**: client pings every 15s, force-reconnect if no pong within 30s. | ~1.5-2 hours | Partial — only fixes Cause 2 (zombie connections). Doesn't help when WS was correctly closed and the broadcast already missed (Cause 1). | Useful complement to A, not a replacement. |
| **C** | **Server-side delivery confirmation**: client sends "last seen message ID" on reconnect AND on a periodic basis. Server returns everything newer in a single response. | ~3-4 hours | ✓ All 3 + drops eliminated by design. | Cleanest long-term. Requires API change, server-side state about delivery, client-side message-ID tracking. |
| **D** | **Optimistic local cache + diff-on-reconnect**: client maintains a local message-ID set, on every WS event verifies tail and refetches if there's a gap. | ~2-3 hours | ✓ All 3. | Most complex to get right. Useful only if A's polling cost becomes prohibitive at scale. |

## Recommendation

**Ship A immediately.** Plan C as the durable replacement when traffic grows enough to make A's per-conversation polling cost noticeable (rough threshold: > 500 concurrent open conversations × 2 polls/min = 1000 req/min — still fine on the current infra).

Why A over B: B addresses one specific cause (zombie connections), but the broadcast-was-already-skipped case (Cause 1) is unaffected. A's periodic refetch is the single mechanism that catches all three causes by treating WS as a "fast path" rather than the only path.

Why not jump to C: nothing wrong with C, but it's a real engineering investment (API contract, server state, client message-ID tracking). A is 30 lines and ships today; C is a sprint. Start with A, upgrade to C when scale demands.

## Detailed Plan — Option A

### Step 1 — Periodic refetch effect in `useConversationMessages`

In `frontend/src/hooks/messaging/useConversationMessages.ts`, add an effect that polls while the conversation is mounted:

```typescript
// Periodic safety-net refetch. Catches messages that landed in the DB
// but whose WS broadcast was dropped (receiver WS not OPEN at
// broadcast time, zombie connection, etc.). Runs every 30s while
// the conversation is selected and the tab is visible.
useEffect(() => {
  if (!selectedConversationId) return;
  // Pause when tab is hidden — no point polling when the user can't
  // see updates anyway. Resume immediately when tab becomes visible
  // (and do one catchup fetch right then to close the suspension gap).
  let intervalId: number | null = null;
  const start = () => {
    if (intervalId !== null) return;
    intervalId = window.setInterval(() => {
      window.dispatchEvent(
        new CustomEvent("new-message-received", {
          detail: { conversationId: selectedConversationId },
        })
      );
    }, 30_000);
  };
  const stop = () => {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      // Tab just came back — do a one-shot catchup, then resume polling.
      window.dispatchEvent(
        new CustomEvent("new-message-received", {
          detail: { conversationId: selectedConversationId },
        })
      );
      start();
    } else {
      stop();
    }
  };
  if (document.visibilityState === "visible") start();
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    stop();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}, [selectedConversationId]);
```

**Why dispatch `new-message-received` instead of calling fetch directly:** the existing listener in the same hook is the canonical refetch path. Reusing it keeps the dedup logic (same `activeIdRef` check, same response handling) without forking.

**Why 30s:** balances staleness window vs. server load. 30s means worst-case the customer waits 30s for a missing message, which feels much better than "indefinite until refresh" and well under the threshold where users start refreshing manually (~60s).

### Step 2 — Same treatment for the inbox list

`useConversations.ts` already listens for `new-message-received` to refetch the inbox. Adding a parallel 30s safety poll there ensures the inbox unread counts + last-message previews stay fresh too. Roughly 10 more lines following the same pattern.

### Step 3 — Behavior verification

After implementation, manually reproduce the staging trace:
1. Customer in chat
2. Disconnect customer's Wi-Fi for ~10s
3. While disconnected, shop sends a manual message
4. Reconnect customer's Wi-Fi
5. **Expect**: missing message appears within 30s (and possibly faster via `ws-reconnected` if the WS detected the drop)

### Step 4 — Optional: server-side hints

`/api/messages/conversations/:id/messages` could optionally accept a `?since=<messageId>` parameter and return only newer messages. Smaller payloads on the periodic poll. Not required for correctness; pure optimization. Defer unless poll cost shows up in metrics.

## Files to Modify

| File | Change |
|---|---|
| `frontend/src/hooks/messaging/useConversationMessages.ts` | Add 30s periodic-refetch effect with visibility-pause |
| `frontend/src/hooks/messaging/useConversations.ts` | Add parallel 30s inbox-refresh effect |

That's it. Backend untouched. No API changes. No DB migration.

## Rollback Plan

Two levels — both faster than the work itself:

### L1 — Constant flag
```typescript
const ENABLE_PERIODIC_REFETCH = true; // flip to false to disable
```
Wrap both effects in `if (!ENABLE_PERIODIC_REFETCH) return;`. Zero-deploy revert.

### L2 — Git revert
Both files are isolated additions. Single commit, easy to revert without affecting anything else.

### Failure modes that would trigger rollback

| Failure | Rollback | Reason |
|---|---|---|
| Server load spikes 2-3× on `/messages` endpoint | L1 flag flip + investigate | Polling cost too high at current concurrency; jump to Option C earlier than planned |
| Browser console fills with redundant network calls | L1 flag flip | The dedup pattern (active ref) may have an edge case |
| Battery drain reports on mobile | L1 flag flip OR shorten poll only when foregrounded (already in plan) | Mobile-specific; visibility-pause should mitigate but worth verifying |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Server cost increase from periodic polls | Low at current scale | Low | Visibility-pause means only foregrounded tabs poll. At 500 active customers × 1 conversation each = 16 req/sec — well within capacity. Reassess at 5000+ active. |
| Race: WS event AND poll fire in the same tick → double refetch | Medium | Negligible | Both go through the same `activeIdRef`-guarded fetcher; result is idempotent. Worst case one extra DB query. |
| Customer sees brief content flicker as polled data merges | Low | Low | The merge in `setMessages` already handles dedup by `id`. No visible flicker observed in similar React patterns. |
| iOS Safari throttles `setInterval` aggressively when backgrounded | Confirmed behavior | Low | Already handled by visibility-pause: we only poll while `document.visibilityState === "visible"` |
| User has 20+ tabs open, each polling | Low | Low | Each tab polls only the conversation it has selected. Background tabs paused. |

## Open Questions for Owner

1. **30s the right interval?** Or shorter (15s) / longer (60s)? Tradeoff is staleness window vs. server cost.
2. **Show a manual "Refresh" button somewhere?** Belt-and-suspenders for cases where even the poll fails (server hiccup). Not strictly needed.
3. **Telemetry?** Worth adding a backend counter on `ai_agent_messages.events` or similar for "polled-and-found-newer" cases? Helps quantify how often WS actually misses. ~30 min of extra work. Not required.

## Out of Scope (Known Gaps to Address Later)

- **Push-notification reliability** — different surface, different stack, separate strategy.
- **Cross-device sync correctness** — if customer is on phone AND desktop, both should converge to the same view. Today, both rely on independent WS connections. Option C (delivery confirmation) handles this for free; A doesn't.
- **Encrypted message delivery** — encrypted threads bypass some of the AI auto-reply path; verify the polling fallback works there too.
- **Message-ordering guarantees under high throughput** — unrelated; if it becomes a problem, dedicated work.

## Success Criteria

1. The staging trace (shop manual message at 18:10:21 not seen by customer) is no longer reproducible. Manual repro test (disconnect / message-during-disconnect / reconnect) shows recovery within 30 seconds.
2. Zero new customer complaints about "missing messages" tied to live conversations over a 2-week window post-deploy.
3. No measurable increase in 95th-percentile API response time on `/api/messages/conversations/:id/messages` (the polled endpoint).
4. Time-to-revert if a regression surfaces: < 60 seconds via L1 flag.

## Related

- The 5s/12s post-customer-send catchup in `MessagesContainer.tsx` covers a narrow case (AI reply after customer message). This strategy generalizes the same pattern to all incoming messages.
- The `ws-reconnected` event handler in `useConversationMessages.ts` covers the case where WS knew it dropped. This strategy covers the case where it didn't know.
- `docs/tasks/strategy/ai-human-handoff-clash.md` — surfaced this issue indirectly (intermittent shop message delivery during testing). Independent of that work.
