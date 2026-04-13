# Bug: Onboarding Welcome Screen Flashes During New User Registration Flow

## Status: Open
## Priority: High
## Date: 2026-04-13
## Category: Bug - Navigation / UX
## Platform: Mobile (React Native / Expo)
## Affects: New user registration flow (first-time Google/wallet connection)

---

## Problem

When a new user connects via Google on the onboarding screen (slide 3), the following sequence occurs:

1. User taps "Connect" → selects Google account (correct)
2. FixFlow splash/loading screen appears (correct)
3. **Onboarding slide 1 ("Earn Rewards on Everyday Services") flashes briefly** (incorrect)
4. Role Selection screen ("Welcome to FixFlow") appears (correct)

The onboarding slide 1 should NOT appear between the loading screen and role selection. It creates a jarring, broken-feeling experience for new users.

---

## Root Cause

The issue is a **race condition between `isLoading` state reset and navigation** in the onboarding layout.

### Flow Analysis

**File:** `mobile/shared/hooks/auth/useAuth.ts` — `useConnectWallet()` mutation

1. User connects wallet → `mutationFn` fires (line 42):
   - `setIsLoading(true)` — onboarding layout shows loading screen ("Getting things ready")
   - Calls `authApi.checkUserExists(address)`

2. Backend returns **404** (new user not found) → goes to `onError` (line 100):
   - `setIsLoading(false)` — **onboarding layout stops showing loading screen**
   - `router.replace("/register")` — navigates to role selection

3. **The problem:** Between `setIsLoading(false)` at line 102 and `router.replace("/register")` at line 107, there is a **render cycle gap**. During this gap:
   - The onboarding layout (`app/(onboarding)/_layout.tsx`) re-renders
   - `isLoading` is now `false` (line 67), so the loading overlay is removed
   - The underlying onboarding slides become visible (slide 1 is the default with `currentIndex: 0`)
   - The user briefly sees onboarding slide 1 before `router.replace` completes

### Key Code

**`useAuth.ts` lines 100-110:**
```typescript
onError: (error: any) => {
  console.error("[useConnectWallet] Error:", error);
  setIsLoading(false);  // ← Loading overlay removed, onboarding slides visible

  // Check if user not found - redirect to register
  if (error?.response?.status === 404 || error?.status === 404) {
    router.replace("/register");  // ← Navigation happens AFTER next render cycle
    return;
  }
},
```

**`app/(onboarding)/_layout.tsx` lines 67-79:**
```typescript
if (isLoading) {
  return (
    <View>
      <Text>Getting things ready</Text>
      <ActivityIndicator />
    </View>
  );
}

// When isLoading becomes false, onboarding slides render (slide 1 visible)
return (
  <SafeAreaView>
    <OnboardingOne />  // ← This flashes before router.replace completes
    <OnboardingTwo />
    <OnboardingThree />
  </SafeAreaView>
);
```

---

## Fix Options

### Option A: Navigate BEFORE setting isLoading to false (Recommended)

Reorder the operations in the `onError` handler so navigation happens before the loading state is cleared:

```typescript
onError: (error: any) => {
  console.error("[useConnectWallet] Error:", error);

  if (error?.response?.status === 404 || error?.status === 404) {
    // Navigate FIRST, then clear loading
    router.replace("/register");
    // Delay clearing isLoading so onboarding slides don't flash
    setTimeout(() => setIsLoading(false), 300);
    return;
  }

  setIsLoading(false);
},
```

### Option B: Keep loading state until navigation completes

Don't set `isLoading(false)` for the 404 case at all — let the role selection screen handle its own loading state:

```typescript
onError: (error: any) => {
  if (error?.response?.status === 404 || error?.status === 404) {
    router.replace("/register");
    // isLoading stays true — onboarding layout shows loading until we leave
    return;
  }

  // Only clear loading for non-navigation errors
  setIsLoading(false);
},
```

Then in the role selection screen or a layout effect, clear `isLoading`:

```typescript
// In ChooseRoleScreen or register layout
useEffect(() => {
  setIsLoading(false);
}, []);
```

### Option C: Add a transitioning state to the onboarding layout

Add a separate `isNavigating` flag that keeps the loading screen visible during route transitions:

```typescript
// In onboarding layout
const isLoading = useAuthStore((state) => state.isLoading);
const [isTransitioning, setIsTransitioning] = useState(false);

// Show loading for both states
if (isLoading || isTransitioning) {
  return <LoadingScreen />;
}
```

---

## Same Issue in onSuccess Path

The `onSuccess` handler (line 52) has the same pattern for the `!result.exists` case, though it may not be triggered since the backend returns 404 for non-existent users:

```typescript
onSuccess: async (result, params) => {
  if (!result.exists) {
    setIsLoading(false);  // ← Same flash risk if this path is ever reached
    return;  // ← No navigation! User stuck on onboarding
  }
```

This path has a **second bug**: if `result.exists` is false but the response is 200 (not 404), the user gets stuck on the onboarding screen with no navigation at all.

---

## Reproduction Steps

1. Clear app data / fresh install (or delete user record from database)
2. Open app → swipe to onboarding screen 3
3. Tap "Connect" → select Google → choose account
4. **Observe**: After FixFlow loading screen, onboarding slide 1 ("Earn Rewards") briefly flashes
5. Role Selection screen appears

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/shared/hooks/auth/useAuth.ts` | Reorder `setIsLoading(false)` and `router.replace()` in `onError` handler (lines 100-110) |
| `mobile/app/(onboarding)/_layout.tsx` | (Optional) Add transition guard to prevent slide flash |

---

## QA Verification

- [ ] New user connects via Google → no onboarding slide flash between loading and role selection
- [ ] New user connects via MetaMask → same smooth transition
- [ ] Existing user connects → goes directly to dashboard (no flash)
- [ ] Pending shop connects → goes to pending screen (no flash)
- [ ] Loading screen ("Getting things ready") shows during wallet verification
- [ ] Cancel during connection → returns to onboarding screen 3 cleanly
