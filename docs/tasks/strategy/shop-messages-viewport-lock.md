# Strategy: Shop Messages Tab — Viewport-Lock Layout

_Drafted: 2026-05-15_

## Problem Statement

The shop-side Messages tab (`/shop?tab=messages`) has the same broken-scroll behavior the customer side had before the viewport-lock landed: opening a busy conversation forces the shop staff to page-scroll the dashboard down to see the latest message and the typing input. WhatsApp / Slack / iMessage and now the customer-side dashboard confine chat scroll to a fixed-viewport region — the shop side does not.

### What's different from the customer side

The shop dashboard has **more vertical chrome** above the chat than the customer side, which makes the problem worse and the fix slightly trickier:

```
DashboardLayout                     min-h-screen
  Main                              pt-[76px] lg:pt-0, lg:ml-{20|64}
    ShopDashboardClient wrapper     min-h-screen py-8                     ← no height bound
      max-w-screen-2xl w-[96%]      (no height)
        WarningBanner (blocked)     ~80-120px when shop has subscription/suspension issues
        ShopBreadcrumb              ~50px
        SubscriptionGuard           passthrough or full-screen fallback
          MessagesTab               h-full flex flex-col ✗               ← parent has no height
            Sub-tab switcher        ~50px (Conversations / Auto-Messages)
            Stats cards × 4         ~100px (collapsible — "Hide Stats" button exists)
            Quick Actions Bar       ~50px (Filter, Export)
            Chat container          flex-1 ← resolves to 0/undefined
            Pro-Tip footer          ~50px
```

On a 1080p laptop in a logged-in shop dashboard with stats visible, the chat region is currently **squeezed to 200-300px of natural-height content** before page-scroll takes over. On a tablet portrait or smaller, the chat is below the fold entirely.

### Same root cause

`h-full` cascade breaks the same way: nothing between `<DashboardLayout>` and `<MessagesTab>` defines a concrete viewport-height anchor. The same flex-`flex-1`/`shrink-0` cascade that fixed the customer side fixes this — the only differences are file paths and which banners exist.

## Goal

Match the customer-side fix: when `activeTab === "messages"` on the shop dashboard:
- Page scroll is killed; only the message list scrolls
- Input bar always visible (anchored to bottom of chat region)
- Sub-tab switcher + stats + filter bar stay above the chat at their natural heights
- WarningBanner stays (subscription/suspension info is critical — different from the customer banners we hid)
- Breadcrumb hidden on messages tab (same call as customer side — chat header already shows context)
- Stats cards default to **hidden** on messages tab (already has a toggle; just flip the default when viewport-locked to free up space)
- Pro-Tip footer hidden on small screens

## Constraints (lessons from the customer-side rollout)

The customer-side strategy doc called out one constraint that still applies:

> Variable-height banners above the chat must be handled without arithmetic — `calc(100vh - N)` breaks when the banner set changes (suspension banner appears/disappears, blocked-warning appears/disappears).

Solved the same way: **flex `flex-1` / `shrink-0` cascade** lets the browser do the math at layout time, on every banner show/hide, with no JS.

One **new** shop-side constraint: **SubscriptionGuard fallback**. When the shop isn't operational, `SubscriptionGuard` renders a full-page paywall instead of `<MessagesTab>`. That fallback must NOT inherit `overflow-hidden` from the viewport-lock mode (it has its own scroll requirements — typically a "Renew Subscription" form with CTA buttons that may overflow on small screens). The conditional layout must remain inert when the guard is active.

## Approach

Same as customer side — apply the existing `fullHeight` prop on `DashboardLayout` (already added during the customer-side work — no DashboardLayout change needed here). New conditional logic in `ShopDashboardClient.tsx` mirrors what was done in `CustomerDashboardClient.tsx`. MessagesTab gets `shrink-0` on its non-chat children and a `flex-1 min-h-0` on the chat container.

```
DashboardLayout h-[100dvh] flex flex-col overflow-hidden ─── viewport lock
  Main          flex-1 flex flex-col overflow-hidden ml-{20|64}
    ShopDashboardClient wrapper  flex-1 flex flex-col overflow-hidden py-4
      max-w-screen-2xl           flex-1 flex flex-col overflow-hidden w-full
        WarningBanner            shrink-0                  ← critical, keep visible
        (Breadcrumb hidden in messages mode)
        SubscriptionGuard        flex-1 (passthrough)      ← when not blocked
          MessagesTab            flex-1 flex flex-col overflow-hidden
            Sub-tab switcher     shrink-0
            Stats cards          shrink-0 + collapsed-by-default in fullHeight mode
            Filter bar           shrink-0
            Chat container       flex-1 overflow-hidden
              MessagesLayout       h-full flex                ← already correct
                Inbox + Thread     h-full
                  Thread           flex-col
                    Header         shrink-0                 ← already done
                    Messages       flex-1 overflow-y-auto   ← already done
                    Input          shrink-0                 ← already done
            Pro-Tip footer       shrink-0 + hidden lg:block (mobile = no room)
```

## Files to Modify

| File | Current | Change |
|---|---|---|
| `frontend/src/components/shop/ShopDashboardClient.tsx` | `<div min-h-screen py-8>` + `<div max-w-screen-2xl>` + banners + tab content | Add `FULL_HEIGHT_MESSAGES_ENABLED` L1 flag, `isMessagesTab` + `isMessagesFullHeight` derived. Pass `fullHeight` to `DashboardLayout`. When viewport-locked: outer wrapper → `flex-1 flex flex-col overflow-hidden`, inner → `flex-1 flex flex-col overflow-hidden w-full`, wrap WarningBanner with `shrink-0`, hide breadcrumb, wrap MessagesTab inside `<div className="flex-1 flex flex-col overflow-hidden min-h-0">`. Keep `SubscriptionGuard`. |
| `frontend/src/components/shop/tabs/MessagesTab.tsx` | `<div h-full flex flex-col>` root with sub-tab switcher, stats, filter, container, pro-tip | Add `shrink-0` to sub-tab switcher, stats grid, quick-actions bar. Add `flex-1 min-h-0` to chat container. Add `shrink-0 hidden lg:block` to Pro-Tip footer. Default `showStats=false` when in viewport-lock mode (read via a new prop, or via a small media-query effect). |
| `frontend/src/components/messaging/MessagesLayout.tsx` | Already `h-full flex` + lg breakpoint | No change |
| `frontend/src/components/messaging/ConversationThread.tsx` | Already `flex flex-col h-full` with all `shrink-0`/`flex-1` set | No change |
| `frontend/src/components/ui/DashboardLayout.tsx` | Already has `fullHeight` prop | No change — the prop was made generic during customer-side work |

## Implementation Plan

### Step 1 — `ShopDashboardClient.tsx` outer wrapper conditional

Pattern lifted from `CustomerDashboardClient.tsx`. Per decision #4, WarningBanner is hidden on messages tab (matching customer side):
```tsx
const FULL_HEIGHT_MESSAGES_ENABLED = true; // L1 rollback flag
const isMessagesTab = activeTab === "messages";
const isMessagesFullHeight = FULL_HEIGHT_MESSAGES_ENABLED && isMessagesTab;

return (
  <DashboardLayout
    userRole="shop"
    activeTab={activeTab}
    onTabChange={handleTabChange}
    fullHeight={isMessagesFullHeight}
  >
    <div className={
      isMessagesFullHeight
        ? "flex-1 flex flex-col overflow-hidden min-h-0 pb-4 pt-0 lg:py-4"
        : "min-h-screen py-8"
    }>
      <div className={`max-w-screen-2xl w-[96%] mx-auto ${
        isMessagesFullHeight ? "flex-1 flex flex-col overflow-hidden min-h-0" : ""
      }`}>
        {/* Decision #4: hide WarningBanner + Breadcrumb on messages tab —
            both are visible on every other tab the shop owner lands on. */}
        {!isMessagesTab && (
          <>
            {shopData && isBlocked && !showSuspendedModal && !showOnboardingModal && (
              /* existing warning-banner block */
            )}
            <ShopBreadcrumb activeTab={activeTab} onTabChange={handleTabChange} />
          </>
        )}

        {/* Loading state — same flow */}
        {!shopData && activeTab !== "overview" && (...)}

        {/* Messages: wrap in flex-1 so chat absorbs leftover height.
            Decision #1: pass compact so stats default to collapsed. */}
        {activeTab === "messages" && shopData && (
          <SubscriptionGuard shopData={shopData}>
            {isMessagesFullHeight ? (
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                <MessagesTab shopId={shopData.shopId} compact />
              </div>
            ) : (
              <MessagesTab shopId={shopData.shopId} />
            )}
          </SubscriptionGuard>
        )}

        {/* All other tabs — unchanged. They never run in viewport-lock mode. */}
      </div>
    </div>
  </DashboardLayout>
);
```

### Step 2 — `MessagesTab.tsx` shrink-0 + `compact` prop

Three changes:
1. `shrink-0` on every non-chat child of the root flex column (sub-tab switcher, stats grid, quick actions bar)
2. `flex-1 min-h-0` on the chat container (`<div className="flex-1 bg-[#1A1A1A] ...">`)
3. New optional `compact?: boolean` prop (per decision #1). When true: default `showStats` to `false`.
4. **Pro-tip footer block REMOVED entirely** per decision #2. Not conditional — the element is deleted from the JSX in both lock-on and rollback modes.

```tsx
interface MessagesTabProps {
  shopId: string;
  /**
   * Compact mode — used when the dashboard runs in viewport-lock mode for
   * the messages tab. Defaults stats to collapsed (shop can still toggle
   * via the existing button) to free vertical space for the chat region.
   */
  compact?: boolean;
}

const [showStats, setShowStats] = useState(!compact);
```

### Step 3 — Verify SubscriptionGuard fallback

`SubscriptionGuard` renders either its children (when shop has access) or a paywall fallback. Need to confirm the paywall fallback doesn't break inside the new `flex-1 flex flex-col overflow-hidden` wrapper. If the paywall has its own scroll, it needs `overflow-y-auto` somewhere. Quick check before merge — most likely it already uses `h-full` patterns, but worth eyeballing.

### Step 4 — Test matrix

Same as customer side, plus shop-specific cases:
- Operational shop, no warning banner → chat region absorbs entire viewport minus chrome
- Suspended shop → WarningBanner shows; SubscriptionGuard renders paywall (verify no scroll regression)
- Pending shop → WarningBanner shows; paywall renders
- Stats visible vs hidden → chat region adjusts
- Auto-Messages sub-tab → renders inside MessagesTab; verify `<AutoMessagesManager>` doesn't suffer (it's the other sub-tab; should be unaffected because chat container only renders when `activeSubTab === "conversations"`)
- Sidebar collapsed/expanded → width adjusts cleanly
- Mobile (iPhone SE 375×667) — at least 400px of chat region visible after chrome
- iOS Safari with address bar collapsed → `100dvh` shrinks correctly
- Switch from Messages tab to any other tab → normal page-scroll restored

### Step 5 — Cross-shop regression smoke

Spot-check that every OTHER shop tab still scrolls normally:
- Overview, Services, Inventory, Purchase Orders, Inventory Analytics, Low Stock Alerts, Bookings, Service Analytics, Appointments, Disputes, Reschedules, Purchase, Customers, Subscription, Settings, Onboarding, Profile, Discounts, Bonuses, Promo Codes, Marketing, Auto-Messages, Service Hours, Group Marketing

`fullHeight` defaults to false in `DashboardLayout`, and `isMessagesFullHeight` only fires when `activeTab === "messages"`, so other tabs should be untouched. Quick visual check on 2-3 tabs to confirm.

## Rollback Plan

Same three-level scheme as the customer side:

### L1 — Runtime toggle (zero deploy)
```tsx
const FULL_HEIGHT_MESSAGES_ENABLED = true; // flip to false
```
Reverts to old `min-h-screen py-8` always-scrolling behavior on the messages tab; every other consumer of `DashboardLayout` is already gated to `fullHeight={false}` by default. Instantaneous, no redeploy.

### L2 — Per-PR revert
Single PR, expected ≤ 2 files (`ShopDashboardClient.tsx` + `MessagesTab.tsx`). No DB / config / migration coupling. `git revert <merge-commit>` cleanly removes everything.

### L3 — Targeted file revert
If only `MessagesTab.tsx` regresses (`compact` prop misbehaves), revert that one file. ShopDashboardClient still works — the `compact` prop is optional with sensible default.

### Failure modes that would trigger rollback

| Failure | Rollback | Reason |
|---|---|---|
| SubscriptionGuard paywall clipping on suspended-shop view | L1 flag flip | Paywall expected scroll, viewport-lock prevented it |
| Auto-Messages sub-tab broken inside compact MessagesTab | L1 or L3 (revert MessagesTab) | Sub-tab swap path didn't account for the new flex parents |
| iOS Safari: keyboard pushes input off-screen on shop side | L1 flag flip | Same risk as customer side; same mitigation if it surfaces |
| WarningBanner stack tall enough to leave < 200px chat region on a busy shop | Accept (acceptable while WarningBanner is unusual) OR add a `compact-warning` mode | Edge case |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SubscriptionGuard fallback can't scroll inside the lock | Medium | Medium (paywall hard to read on small screens) | Verify before merge; if needed, give the guard fallback `overflow-y-auto h-full` |
| Auto-Messages sub-tab regression (not chat-focused, may not need viewport lock) | Low | Medium | Lock mode applies to the WHOLE messages tab, but `<AutoMessagesManager>` is internal — verify it still renders correctly as the sub-tab. If it scrolls, give it its own `overflow-y-auto` wrapper. |
| Stats-cards `showStats=true` default leaks back via state persistence | Low | Low (cosmetic) | Use `useState(!compact)` not localStorage; resets cleanly |
| Mobile shop view: warning banner + chrome leaves < 300px of chat | Medium on edge cases | Low | Already prepared to add `compact-warning` if it becomes a problem |
| `max-w-screen-2xl w-[96%]` width constraint behaves oddly inside flex column | Low | Low | Add `w-full` to the inner div in lock mode (already in the plan) |

## Decisions (locked in 2026-05-15)

1. **Stats cards** → default to **collapsed** in viewport-lock mode. Shop owner can still toggle via existing "Hide/Show Stats" button. Implementation: `compact?: boolean` prop on `MessagesTab` → `useState(!compact)` for `showStats`.
2. **Pro-tip footer** → **REMOVED** entirely from `MessagesTab`. No value vs. the vertical space it consumes. Apply to both modes (lock-on and rollback) — simpler than conditional rendering.
3. **Auto-Messages sub-tab** → **same viewport-lock treatment** as the chat sub-tab. Sits inside the same `flex-1 flex flex-col overflow-hidden` parent; if `<AutoMessagesManager>` needs internal scroll, it gets an `overflow-y-auto` wrapper inside its own content.
4. **WarningBanner** → **HIDDEN on messages tab** (matching the customer-side decision to hide alert banners). Reasoning: even though the WarningBanner is shop-specific and operational, it's already visible on every OTHER shop tab the owner lands on, so no information is lost by hiding it on the messages tab specifically. Maximizes chat space — same intent as the customer-side fix.

## Out of Scope (Known Gaps to Address Later)

- **Apply the same pattern to admin dashboard** if it grows a messages tab. None today.
- **Global tab-locked mode** — same out-of-scope decision as customer side; clean long-term architecture but bigger audit.
- **Stats cards as a slide-over** on messages tab — could free even more space. UX call for later.
- **iOS soft-keyboard inset** — if it surfaces, add `interactiveWidget=resizes-content` viewport meta in a separate fix.

## Success Criteria

1. Shop staff opens any conversation on the messages tab and immediately sees the latest message + input bar without page-scrolling.
2. Sending a message keeps the input bar in the same screen position.
3. Every other shop tab (24 of them) behaves identically to today (page-scroll intact).
4. Subscription paywall (when applicable) renders without clipping inside the new flex parents.
5. Auto-Messages sub-tab renders without layout regressions.
6. Time-to-revert if a regression surfaces: < 60 seconds (L1 flag flip).

## Related

- `docs/tasks/strategy/messages-layout-viewport-lock.md` — customer-side strategy doc. This shop-side fix reuses the same `DashboardLayout.fullHeight` prop introduced there.
- Customer-side PR: commits `5a89a15a`, `39d5bd4a`, `7446cb75` on branch `deo/ai-menu-item-faq`. Shop-side work expected to land on a separate branch when implemented.
