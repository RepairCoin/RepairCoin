# Strategy: Messages Tab — Viewport-Lock Layout (WhatsApp-style)

_Drafted: 2026-05-14_

## Problem Statement

The customer Messages tab forces the user to **page-scroll the dashboard** to find the latest message and the typing input. WhatsApp / Slack / Discord / iMessage all confine chat scrolling to a fixed-viewport region — message list scrolls internally, input stays anchored to the bottom of the visible area. We don't.

### Observed symptoms
1. Open `/customer?tab=messages` on a conversation with > ~15 messages.
2. The conversation thread renders at its natural content height (can be ~2000px+).
3. The browser's outer scrollbar appears. To see the latest AI reply or to type, the customer scrolls the page down.
4. On long threads the input bar can land below the fold for several scroll-rolls.
5. Sending a message auto-scrolls the *messages container*, but the outer page scroll position is unchanged — the user often can't see their own message land.

### Root cause
The `h-full` cascade breaks in the dashboard's layout chain. There's no concrete viewport-height anchor between `<DashboardLayout>` and `<MessagesTab>`, so `h-full` resolves to natural content height rather than viewport.

```
DashboardLayout       min-h-screen           ← min height, no max
  Main                pt-[76px] lg:pt-0,
                      lg:ml-{20|64}          ← no height set
    Page wrapper      min-h-screen py-8      ← min height, no max
      max-w-7xl       (no height)            ← width-only bound
        Banners       (natural height)       ← suspension, breadcrumb, no-show, account-claim
          MessagesTab h-full ✗               ← parent doesn't define height → 0/undefined
            MessagesLayout h-full ✗
              ConversationThread (natural height)
```

## Goal

Match the chat-app convention: **page scroll is killed on the messages tab**; only the message list scrolls. The input bar is always visible. Banners above the chat take their natural height and the chat region absorbs the remainder.

Concretely:
- Viewport height = `100dvh` (dynamic — shrinks with iOS Safari address bar)
- Sidebar + top header occupy their fixed slice
- Banners (suspension, breadcrumb, no-show, account-claim, in-tab info banner) stack at their natural height above the chat region
- Chat region: `flex-1`, internal scroll only on the message list
- Input: pinned to the chat region's bottom — never below the fold

## Constraints (called out by owner)

> "the messages container is having other elements at the top thats why getting it fix layout can't handle other elements"

The fix must accommodate **variable-height banners** above the chat without arithmetic. Today the elements above the chat can include:
- SuspensionBanner (conditional)
- CustomerBreadcrumb (always)
- NoShowWarningBanner (conditional)
- AccountClaimBanner (conditional)
- In-tab info banner ("Message Shops Directly")

Any combination can render; their heights are not known in advance and may change with i18n / content. We cannot use `calc(100dvh - 240px)` style math.

## Approach

**Flexbox `flex-1` / `shrink-0` cascade** — banners say "I take what I need" (`shrink-0`), chat says "I take whatever's left" (`flex-1`). The browser does the math at layout time, on every banner show/hide, with no JS.

```
DashboardLayout           h-[100dvh] flex flex-col overflow-hidden    ← viewport lock
  Mobile header           shrink-0 (fixed, unchanged)
  Main content area       flex-1 flex flex-col overflow-hidden ml-{20|64}
    Page wrapper          flex-1 flex flex-col overflow-hidden py-4    ← was: min-h-screen py-8
      max-w-7xl           flex-1 flex flex-col overflow-hidden
        Banners           shrink-0                                       ← natural height each
        MessagesTab       flex-1 flex flex-col overflow-hidden           ← gets leftover
          Info banner     shrink-0
          Chat container  flex-1 overflow-hidden
            Inbox + Thread  h-full flex
              Thread        flex-1 flex flex-col
                ChatHeader  shrink-0
                Messages    flex-1 overflow-y-auto                       ← only this scrolls
                Input       shrink-0
```

### Why not the alternatives

| Option | Verdict | Notes |
|---|---|---|
| `calc(100vh - N)` math | ✗ | Breaks when banner set changes. iOS `100vh` includes collapsed address bar. |
| Scroll-snap / `position: sticky` on chat container | ✗ | Needs IntersectionObserver + JS state; janky during transition; iOS Safari edge cases. (This was the owner's initial idea; the flexbox approach delivers the same end-state without the JS layer.) |
| Move messages to its own route `/customer/messages` | △ | Cleanest separation but breaks `?tab=` URL pattern. Save for a separate refactor. |
| Lock the **entire** dashboard to `100dvh` (every tab) | △ | Cleaner long-term but requires auditing every tab's internal scroll. Out of scope for this change. |
| Tab-conditional flex viewport lock (this proposal) | ✓ | Targeted, ~30 lines, no JS, handles banner variability natively. |

## Files to Modify

| File | Current | Change |
|---|---|---|
| `frontend/src/components/ui/DashboardLayout.tsx` | `<div min-h-screen>` wrapper, no flex on main | Add optional `fullHeight?: boolean` prop; when true, wrapper becomes `h-[100dvh] flex flex-col overflow-hidden` and main area becomes `flex-1 flex flex-col overflow-hidden` |
| `frontend/src/app/(authenticated)/customer/CustomerDashboardClient.tsx` | Always renders `<div min-h-screen py-8>` | Pass `fullHeight={activeTab === "messages"}` to DashboardLayout. When messages tab is active, swap the inner `min-h-screen py-8` for `flex-1 flex flex-col overflow-hidden py-4` and wrap banners with `shrink-0` |
| `frontend/src/components/customer/tabs/MessagesTab.tsx` | `h-full flex flex-col`, info banner inline, container `flex-1 ... overflow-hidden` | Add `shrink-0` to the info banner. Container already has `flex-1` — verify. |
| `frontend/src/components/messaging/MessagesLayout.tsx` | `h-full flex bg-[#0A0A0A]` | No change needed (already correct). |
| `frontend/src/components/messaging/ConversationThread.tsx` | Messages list + input already use flex | Verify message list has `flex-1 overflow-y-auto` and input wrapper has `shrink-0`. Confirmed from prior reads — likely no change. |

## Implementation Plan

### Step 1 — Make DashboardLayout viewport-lockable
Add a `fullHeight` prop (default `false` to preserve current behavior on every other consumer):
```tsx
interface DashboardLayoutProps {
  // ... existing props
  fullHeight?: boolean; // when true, lock the layout to 100dvh and kill page scroll
}
```
Apply conditional classes:
```tsx
<div className={fullHeight
  ? "h-[100dvh] bg-[#101010] flex flex-col overflow-hidden"
  : "min-h-screen bg-[#101010]"}>
  {/* sidebar + mobile header unchanged */}
  <div className={`transition-all duration-300 ease-in-out pt-[76px] lg:pt-0
    ${isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"}
    ${fullHeight ? "flex-1 flex flex-col overflow-hidden min-h-0" : ""}`}>
    <main className={fullHeight ? "flex-1 flex flex-col overflow-hidden min-h-0" : ""}>
      {children}
    </main>
  </div>
</div>
```
The `min-h-0` on flex children is the standard fix for the "child won't shrink below content height" flex bug — required for the inner scroll to actually clip.

### Step 2 — Toggle from CustomerDashboardClient
```tsx
const isMessagesTab = activeTab === "messages";

<DashboardLayout
  userRole="customer"
  activeTab={activeTab}
  onTabChange={handleTabChange}
  fullHeight={isMessagesTab}
>
  <div className={isMessagesTab
    ? "flex-1 flex flex-col overflow-hidden py-4 pt-16 lg:pt-4"
    : "min-h-screen py-8 pt-16 lg:pt-8"} style={...bgImage}>
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
      ${isMessagesTab ? "flex-1 flex flex-col overflow-hidden min-h-0" : ""}`}>
      {/* Wrap banners in shrink-0 when full-height so they don't fight chat for space */}
      <div className={isMessagesTab ? "shrink-0" : undefined}>
        {userProfile?.suspended && <SuspensionBanner .../>}
        <CustomerBreadcrumb activeTab={activeTab} />
        <NoShowWarningBanner status={noShowStatus} />
        <AccountClaimBanner />
      </div>
      {/* Tab content. Messages gets flex-1 wrapping; other tabs render in-flow as before. */}
      {isMessagesTab ? (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {userProfile?.id && <MessagesTab customerId={userProfile.id} />}
        </div>
      ) : (
        <>
          {activeTab === "overview" && <OverviewTab />}
          {/* ... etc */}
        </>
      )}
    </div>
  </div>
</DashboardLayout>
```

### Step 3 — Pin the in-tab info banner
In `MessagesTab.tsx`, add `shrink-0` to the yellow "Message Shops Directly" banner so it sits above the chat without competing for space:
```tsx
<div className="bg-gradient-to-r ... shrink-0">
```

### Step 4 — Verify (no changes expected)
- `MessagesLayout.tsx` is already `h-full flex` — works inside a bounded parent.
- `ConversationThread.tsx` already uses `flex-1 overflow-y-auto` on the message scroll region (verified from earlier reads when adding the typing indicator).

### Step 5 — Smoke test the four banner combinations
Local sanity matrix — chat region must remain functional in every cell:
- Non-suspended customer, no claim banner, no-show clear (most common)
- Suspended customer (suspension banner adds ~80px)
- Customer with placeholder accounts (account-claim banner adds ~120px)
- Customer in deposit-required tier (no-show banner adds ~60px)

## Testing Checklist

- [ ] Open Messages tab with 30+ message conversation → page does NOT scroll; chat scrolls internally
- [ ] Latest message visible without scrolling on tab open
- [ ] Input bar always visible (not below fold)
- [ ] Send a message → message appears, AI typing indicator appears in-view
- [ ] Switch from Messages tab to Marketplace tab → Marketplace returns to normal page-scroll behavior (no leftover `overflow-hidden`)
- [ ] Resize browser height down to 600px → input still visible, message list still scrollable
- [ ] iOS Safari: open with address bar visible, scroll, address bar collapses → input bar follows (no gap, no clipping). Tests `100dvh` correctness.
- [ ] iOS Safari: tap input, soft keyboard rises → input stays visible above keyboard
- [ ] All four banner combinations (smoke matrix above)
- [ ] Sidebar collapse/expand → chat region width adjusts; no horizontal scroll
- [ ] Mobile: hamburger header (~76px) still renders above chat; chat fills remaining space
- [ ] **Regression**: Marketplace, Overview, Orders, Bookings, Appointments, Referrals, Settings tabs all behave exactly as before (page scroll intact)

## Rollback Plan

The change is **layered**, with three independent rollback levers from cheapest to most disruptive:

### Level 1 — Runtime toggle (zero deploy)

Add a tiny feature flag controlling whether the new layout activates:
```tsx
// In CustomerDashboardClient.tsx
const FULL_HEIGHT_MESSAGES_ENABLED = true; // flip to false to revert behavior
const isMessagesTab = activeTab === "messages" && FULL_HEIGHT_MESSAGES_ENABLED;
```
Flipping the constant to `false` reverts the customer dashboard to the previous always-scrolling behavior with zero other code changes. `DashboardLayout`'s `fullHeight` prop stays at its default (`false`) for all consumers when the flag is off.

**Why we ship with this:** lets us pull the change instantly if a banner / iOS edge case surfaces in production without waiting for a revert PR + redeploy.

### Level 2 — Per-PR revert

The implementation lands as one PR touching ≤ 4 files. `git revert <merge-commit>` cleanly removes everything. No DB / config / migration coupling — pure CSS class additions and one new optional prop.

### Level 3 — Targeted file revert

If only one file regresses (e.g. iOS issue isolated to `DashboardLayout.tsx`), revert that one file:
```bash
git checkout HEAD~1 -- frontend/src/components/ui/DashboardLayout.tsx
```
Since `fullHeight` defaults to `false`, removing the prop usage at the call site (or restoring the prior `DashboardLayout`) auto-reverts every consumer to the old behavior.

### Failure modes that would trigger rollback

| Failure | Rollback level | Reason |
|---|---|---|
| iOS Safari: input bar hidden behind keyboard | L1 flag flip | Keyboard inset isn't covered by `100dvh` alone — needs `interactiveWidget` viewport meta. Punt to a follow-up. |
| Sidebar collapse animation glitches the chat region width | L1 flag flip | DashboardLayout's transition class fights with `overflow-hidden`. Investigate offline. |
| Non-messages tab loses its scroll | L3 revert of `CustomerDashboardClient` | The `isMessagesTab` conditional logic leaked into other tabs. |
| Banner above chat clips (suspension + breadcrumb + account-claim stack too tall on short viewports) | Accept + show-fewer-banners follow-up, OR L1 flag flip | The chat region just gets a tiny height — still functional, but tight. Mitigation: hide breadcrumb on messages tab when the stack exceeds ~30% of viewport. |
| Mobile dashboard layout breaks (hamburger header overlaps chat) | L1 flag flip | The `pt-[76px]` on Main was authored before `flex-col` mode existed; the spacing math may need re-derivation. |

### Out-of-scope rollback considerations
- **No data changes** — purely a render-layer fix. Nothing to backfill, no DB writes.
- **No backend changes** — orchestrator/repository code untouched.
- **No URL changes** — `/customer?tab=messages` route unchanged. Bookmarks survive.
- **No auth / permission changes** — every existing access check still runs.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| iOS keyboard pushes input off-screen | Medium | High (unusable on mobile) | Test on real iOS device before merge; have L1 flag ready |
| Banner stack overflows tiny viewport (e.g. landscape iPhone SE) | Low | Medium (chat region < 200px) | Accept for v1; follow-up to hide breadcrumb on messages tab on heights < 600px |
| Sidebar collapse animation jitter | Low | Low (visual only) | Pre-existing transition; verify with sidebar toggle stress test |
| Other tabs accidentally get viewport-locked | Low | Medium (page scroll missing on Orders etc.) | Test matrix covers every tab; `fullHeight` prop defaults to `false` |
| Customer's just-sent message lands below typing indicator and goes out of view | Low | Low (already addressed in the typing-indicator commit's scroll-on-show effect) | Existing auto-scroll on `showTypingIndicator` change handles this |
| Shop dashboard's messages tab is broken in the same way and not covered here | Confirmed | N/A (out of scope) | Document as known gap; apply same pattern to shop side in a follow-up PR |

## Out of Scope (Known Gaps to Address Later)

- **Shop-side messages tab.** `ShopDashboardClient.tsx` exhibits the same layout pattern; the same `fullHeight` prop will apply but requires its own CustomerDashboardClient-equivalent edit. Recommend a parallel follow-up PR rather than bundling.
- **Global "all tabs locked to viewport" mode.** Cleaner long-term architecture but requires auditing every tab's internal scroll. Track as separate ticket.
- **iOS keyboard inset handling.** `100dvh` doesn't account for the soft keyboard. If testing reveals a problem, we'll add the `interactiveWidget=resizes-content` viewport meta in a follow-up.
- **Mobile gestures.** Pull-to-refresh, swipe-back — `overflow: hidden` on a body-level container can suppress these. Smoke test on mobile and document any UX cost.

## Success Criteria

1. Customer can open any conversation and immediately see the latest message + input bar without page-scrolling.
2. Sending a message keeps the input bar in the same screen position (no jump).
3. Every other tab (Overview, Marketplace, Orders, Bookings, Appointments, Referrals, Settings) behaves identically to today.
4. Time-to-revert if a regression surfaces: < 60 seconds (L1 flag flip) without a deploy.
