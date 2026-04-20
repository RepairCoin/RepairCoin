# Bug: Transaction History screen has no back button when pushed from non-tab entry points

**Status:** Open
**Priority:** Medium
**Est. Effort:** 30-45 minutes
**Created:** 2026-04-20
**Updated:** 2026-04-20

---

## Problem

The Customer Transaction History screen has no back button, header arrow, or navigation chevron. Users who reach the screen by pushing into it (e.g., tapping the **History** quick-action on the Redeem screen) have no visible affordance to return to where they came from — they must use the device's gesture back, a hardware back button (Android), or tap a different bottom tab.

When the screen is accessed as the **History tab root** (bottom tab bar), a back button would be incorrect. So the fix is not "always add a back button" — it is "show a back button only when the screen was reached via push, not when it is the tab root."

Affects:

- Redeem screen → QuickActions "History" quick-action (`mobile/feature/redeem-token/components/QuickActions.tsx:21`)
- Push notification taps that route to history (`mobile/feature/notification/constants/index.ts:7,11,24,28`, `mobile/shared/hooks/notification/usePushNotifications.ts:258,273`)

---

## Root Cause

Two related issues:

1. **`CustomerHistoryScreen.tsx` renders its own header with no back-navigation control.** The component builds a header with a title but no back button, no `AppHeader`, no call to `router.back()`, and no check of navigation state.

2. **Callers use `router.push("/customer/tabs/history")` to navigate to a tab route.** In expo-router, pushing to a tab route causes a tab switch rather than pushing a new screen onto a stack. The active tab becomes History, the bottom tab bar updates, but there is no back-stack entry to pop back to Redeem. Even if the screen *wanted* to show a back button, `router.back()` would take the user to whatever was on the global navigation stack before — which is often not where they expect.

So the fix has to address both: the screen must optionally render a back control, AND the entry points must route in a way where "back" means something useful.

---

## Evidence

- `mobile/feature/history/screens/CustomerHistoryScreen.tsx` — grep for `router.back`, `arrow-back`, `AppHeader`, `headerLeft`, `onBackPress` returns zero matches. No back-nav component anywhere in the file.
- `mobile/feature/redeem-token/components/QuickActions.tsx:21`:
  ```tsx
  onPress={() => { haptics.selection(); router.push("/customer/tabs/history"); }}
  ```
  Pushes to a tab route, producing tab-switch behaviour, not a stack push.
- Visually confirmed on device 2026-04-20: Transaction History screen shows no header arrow; the only way out is bottom tabs or a gesture.
- The screen is also mounted as the tab root at `mobile/app/(dashboard)/customer/tabs/history/index.tsx`. Any fix must preserve the clean tab-root appearance.

---

## Fix Options

### Option A — Separate non-tab route for push entry points (cleanest)

Create a new route `mobile/app/(dashboard)/customer/history.tsx` that renders the same `CustomerHistoryScreen` component wrapped in a header with a back button. Change Redeem's quick-action (and any other push-entry callers) to push to this route instead of the tab route:

```tsx
// QuickActions.tsx
router.push("/customer/history"); // instead of "/customer/tabs/history"
```

```tsx
// New file: app/(dashboard)/customer/history.tsx
import { View } from "react-native";
import { router } from "expo-router";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { CustomerHistoryScreen } from "@/feature/history/screens";

export default function CustomerHistoryPushScreen() {
  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader title="Transaction History" onBackPress={() => router.back()} />
      <CustomerHistoryScreen hideHeader />
    </View>
  );
}
```

Then add a `hideHeader` prop to `CustomerHistoryScreen` so the pushed variant can suppress its own title (the new wrapper supplies one with a back button). Tab root continues to render its own title via the existing header.

Pros: Clean stack push with real back behaviour. Tab root untouched. Reuses the feature screen component.
Cons: Requires a new route file and a prop on the screen component. Every push-entry caller must switch to the new path.

### Option B — Conditional back button on the existing screen

Add a back button inside `CustomerHistoryScreen` that only renders when navigation has history to return to:

```tsx
import { useNavigation } from "@react-navigation/native";
// ...
const navigation = useNavigation();
const canGoBack = navigation.canGoBack();
// ...
{canGoBack && (
  <TouchableOpacity onPress={() => router.back()} className="mr-3">
    <Ionicons name="arrow-back" size={24} color="white" />
  </TouchableOpacity>
)}
```

Pros: Single-file change. No new route. Callers don't need to change.
Cons: With expo-router tab pushes, `canGoBack()` may return `true` inside the tab stack even for the initial tab render in some scenarios, causing the back button to appear at the tab root. Requires careful testing across all entry points. Also, `router.back()` from a pushed-tab target may not navigate to where the user expects.

### Option C — Change Redeem to not push at all

Replace Redeem's `router.push("/customer/tabs/history")` with something that doesn't imply a push-with-back semantic — e.g., `router.navigate()` or a tab switch via a clearer API. Accept that History remains a tab, not a sub-route.

Pros: Smallest diff. Honest with the tab-router's actual semantics.
Cons: The user experience is unchanged — still no back from History to Redeem, just no longer mis-labeled as a push. May not satisfy the bug report's intent.

### Recommendation

**Option A** is the most robust. The added route and prop are small; the UX is predictable (pushed from Redeem → back button present → back returns to Redeem); the tab root stays clean.

Use Option B only if the team strongly prefers not to add a new route file. In that case, be prepared to hit edge cases where `canGoBack()` disagrees with actual navigation intent.

---

## Files to Modify

### For Option A (recommended)

| File | Change |
|------|--------|
| `mobile/app/(dashboard)/customer/history.tsx` (new) | Wrapper screen with `AppHeader` + back button, renders `CustomerHistoryScreen hideHeader` |
| `mobile/feature/history/screens/CustomerHistoryScreen.tsx` | Accept `hideHeader?: boolean` prop; when true, skip rendering the built-in title |
| `mobile/feature/redeem-token/components/QuickActions.tsx` | Change `router.push("/customer/tabs/history")` → `router.push("/customer/history")` |
| `mobile/feature/notification/constants/index.ts` | Audit the 4 history route references (lines 7, 11, 24, 28) — decide whether notification-driven navigation should switch tab (current) or push with back button (new). Most likely keep tab switch for notifications; only change Redeem's push. |
| `mobile/shared/hooks/notification/usePushNotifications.ts:258,273` | Same audit — likely no change, notifications usually want tab switch |

### For Option B

| File | Change |
|------|--------|
| `mobile/feature/history/screens/CustomerHistoryScreen.tsx` | Add conditional back button wired to `navigation.canGoBack()` + `router.back()` |

---

## Verification Checklist

### Core behaviour

- [ ] **Tab entry:** Open History from the bottom tab bar. No back button in the header. Bottom tabs remain the primary navigation affordance. (Regression check — existing behaviour must not change.)
- [ ] **Pushed from Redeem:** Navigate to Redeem, tap the History quick-action. Header shows a back arrow. Tapping back returns to Redeem.
- [ ] **Hardware / gesture back from pushed entry:** Hardware back on Android, swipe back on iOS — both return to Redeem.
- [ ] **Pushed from notification (if kept as push):** Tap a transaction-related push notification. If behaviour is "switch to History tab", no back button expected. If behaviour is "push with back", back arrow present.

### UX / layout

- [ ] Back arrow is visually aligned with the existing "Transaction History" title; no double-title or layout shift between tab and pushed variants.
- [ ] Search bar, filter chips, and transaction list render identically in both tab and pushed variants.
- [ ] Status bar and safe-area insets look correct on iOS notched devices and Android with gesture navigation enabled.

### Regression

- [ ] Tab-bar highlight still shows "History" as active when the screen is open (in both variants).
- [ ] Scrolling, infinite-pagination, pull-to-refresh all work identically in both variants.
- [ ] No double-fire of data fetching when navigating between variants (e.g., tab→pushed doesn't cause redundant first-page fetches).

---

## Notes

- **Split from:** `mobile/docs/tasks/bugs/16-04-2026/bug-transaction-history-multiple-issues.md` (Issue #8). That parent doc covered 8 items; commit `36900643` addressed items #1-#7 but skipped #8. The other 7 items are verified working on `origin/main` as of 2026-04-20 and are tracked in `completed/bug-transaction-history-qa-issues.md`. Only #8 remains open, hence this separate doc.
- **Why Medium not High:** the screen is never a true navigation dead-end — the bottom tab bar is always visible and the device's gesture back works on both platforms. This is a UX polish issue (surprise for users who expect a pushed screen to have a back button), not a broken feature.
- **Priority elevates to High if:** push-notification-driven navigation to History also needs push semantics (back to wherever the notification was tapped from). If that flow gets higher priority, revisit.
- **Out of scope:** Shop-side history / transaction screens, if any, may have similar issues. Separate audit if relevant.
- **Design consideration:** If the app moves toward having more cross-tab push navigations in the future, consider introducing a general `PushableTabScreen` wrapper pattern so every tab screen can be cleanly reused as a pushed variant. Worth an enhancement doc if the pattern repeats.
