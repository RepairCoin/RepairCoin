# Bug: Suspended Shop Shows "Application Pending" Screen + No Real-Time Suspension Updates

## Status: Open
## Priority: High
## Date: 2026-04-15
## Category: Bug - Authentication / Shop Status
## Platform: Mobile (React Native / Expo)
## Affects: Suspended shops on mobile

---

## Problem

Two issues with shop suspension on mobile:

### Issue 1: Wrong screen for suspended shops
When a suspended shop logs in, they see the "Application Pending — Please wait for approval from the admin" screen. This is misleading — they should see a "Shop Suspended" message with the suspension reason.

### Issue 2: No real-time suspension updates
When an admin suspends a shop, the mobile app does not update in real-time. The shop can continue transacting until they manually refresh or re-login. On web, suspension is instant via WebSocket events.

---

## Root Cause

### Issue 1: Pending vs Suspended not distinguished

**File:** `mobile/shared/hooks/auth/useAuth.ts` (lines 60-65)

```typescript
// Treats ALL inactive shops the same — pending AND suspended
if (result.type === "shop" && !result.user?.isActive && !result.user?.active) {
  setUserProfile(result.user);
  setUserType("shop");
  setIsLoading(false);
  router.replace("/register/pending");  // ← Always goes to pending screen
  return;
}
```

A suspended shop has `verified=true`, `active=false`, `suspended_at=<timestamp>`. A pending shop has `verified=false`, `active=false`, `suspended_at=null`. Both route to the same pending screen.

### Issue 2: No WebSocket/push notification for status changes

The mobile app has no listener for `shop_status_changed` events. Status is only checked at login time.

---

## How Web Handles It (Working)

### Real-time detection
**File:** `frontend/src/hooks/useNotifications.ts` (lines 239-248)
```typescript
case 'shop_status_changed':
  window.dispatchEvent(new CustomEvent('shop-status-changed', {
    detail: message.payload
  }));
  break;
```

**File:** `frontend/src/components/shop/ShopDashboardClient.tsx` (lines 490-504)
```typescript
window.addEventListener('shop-status-changed', () => {
  loadShopDataRef.current(true);  // Forces immediate refresh
});
```

### Pending vs Suspended distinction
**File:** `frontend/src/hooks/useSubscriptionStatus.ts` (lines 58-66)
```typescript
// Suspended: has actual suspension record
hasSuspension || (shopData.active === false && shopData.verified !== false)

// Pending: not yet verified, no suspension
shopData.verified === false && !hasSuspension
```

---

## Fix Required

### Fix 1: Distinguish pending vs suspended at login

**File:** `mobile/shared/hooks/auth/useAuth.ts`

```typescript
if (result.type === "shop") {
  const user = result.user;
  const isActive = user?.isActive || user?.active;
  
  if (!isActive) {
    setUserProfile(user);
    setUserType("shop");
    setIsLoading(false);
    
    // Check if suspended (verified but deactivated) vs pending (not verified)
    if (user?.suspended_at || user?.suspendedAt || (user?.verified && !isActive)) {
      router.replace("/register/suspended");  // ← New screen
    } else {
      router.replace("/register/pending");
    }
    return;
  }
}
```

### Fix 2: Create Suspended Shop screen

Create a new screen at `mobile/app/(auth)/register/suspended/index.tsx`:

- Show "Shop Suspended" with a red/warning icon
- Display suspension reason if available
- Show "Contact support" link
- Include a "Check Status" button that re-checks with backend
- Logout button

### Fix 3: Add suspension fields to shop interface

**File:** `mobile/shared/interfaces/shop.interface.ts`

```typescript
interface ShopData {
  // ... existing fields
  suspendedAt?: string;
  suspended_at?: string;
  suspensionReason?: string;
  suspension_reason?: string;
}
```

### Fix 4: Add real-time suspension detection

Option A — Push notification handler:

**File:** `mobile/shared/hooks/notification/` or app-level listener

Listen for `shop_suspended` / `shop_unsuspended` notification types. On receiving:
- `shop_suspended`: Clear auth, navigate to suspended screen
- `shop_unsuspended`: Refresh shop data, navigate to dashboard

Option B — Periodic polling (fallback):

Add a background check every 60 seconds while shop dashboard is active:
```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    const result = await authApi.checkUserExists(address);
    if (result.user && !result.user.active && result.user.suspended_at) {
      // Shop was suspended — navigate to suspended screen
      router.replace("/register/suspended");
    }
  }, 60000);
  return () => clearInterval(interval);
}, []);
```

Option C — WebSocket (matches web approach):

If mobile has WebSocket connection, listen for `shop_status_changed` event type and handle the same way web does.

---

## Files to Create

| File | Purpose |
|------|---------|
| `mobile/app/(auth)/register/suspended/index.tsx` | Suspended shop screen route |
| `mobile/feature/register/screens/ShopSuspendedScreen.tsx` | Suspended screen component |

## Files to Modify

| File | Change |
|------|--------|
| `mobile/shared/hooks/auth/useAuth.ts` | Distinguish pending vs suspended, route accordingly |
| `mobile/shared/interfaces/shop.interface.ts` | Add suspension fields |
| `mobile/feature/register/hooks/ui/usePendingApproval.ts` | Fix field check (`isActive` vs `active`/`verified`) |
| Push notification handler or app-level listener | Add real-time suspension detection |

---

## QA Verification

### Pending vs Suspended
- [ ] Pending shop logs in → sees "Application Pending" screen (correct)
- [ ] Suspended shop logs in → sees "Shop Suspended" screen with reason
- [ ] Unsuspended shop logs in → goes to shop dashboard

### Real-Time Updates
- [ ] Shop is on dashboard → admin suspends shop → mobile instantly shows suspended screen
- [ ] Shop is on suspended screen → admin unsuspends → mobile allows re-entry to dashboard
- [ ] Works even if app was in background

### Edge Cases
- [ ] Shop suspended while app is closed → on next open, shows suspended screen
- [ ] Shop suspended during a transaction → transaction blocked with clear message
