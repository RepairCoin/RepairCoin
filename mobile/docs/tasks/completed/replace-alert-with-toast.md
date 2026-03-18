# Enhancement: Replace Alert.alert with Toast Notifications

**Status:** ✅ Completed
**Completed:** 2026-03-13
**Priority:** HIGH
**Est. Effort:** 30 min
**Created:** 2026-03-13

---

## Problem

Error handling uses `Alert.alert()` which blocks UI and is less elegant than toast notifications.

## Current State

- 13 files use `Alert.alert()` for errors
- Toast library (`react-native-toast-notifications`) is installed but only used in 1 file
- Toast provider already configured in `app/_layout.tsx`

## Files to Update

| File | Location |
|------|----------|
| `useServiceMutations.ts` | `feature/service/hooks/mutations/` |
| `useBookingMutations.ts` | `feature/booking/hooks/mutations/` |
| `useChat.ts` | `feature/messages/hooks/ui/` |
| `useMessages.ts` | `feature/messages/hooks/ui/` |
| `useFindShop.ts` | `feature/customer/hooks/ui/` |
| `useRewardToken.ts` | `feature/reward-token/hooks/ui/` |
| `usePayment.ts` | `feature/booking/hooks/ui/` |
| `useBuyTokenMutations.ts` | `feature/buy-token/hooks/mutations/` |
| `usePromoCodeMutations.ts` | `feature/service/hooks/mutations/` |
| `useCustomerEditProfile.ts` | `feature/profile/hooks/ui/` |
| `useCustomerRegister.ts` | `feature/onboarding/hooks/` |
| `useShopRegister.ts` | `feature/onboarding/hooks/` |
| `useRescheduleActions.ts` | `feature/booking/hooks/ui/` |

## Implementation

```tsx
// Before
Alert.alert("Error", "Failed to create service");

// After
import { useToast } from "react-native-toast-notifications";

const toast = useToast();
toast.show("Failed to create service", { type: "danger" });
```

## Verification Checklist

- [ ] All Alert.alert errors replaced with toast
- [ ] Toast appears at bottom of screen
- [ ] Toast auto-dismisses after 3 seconds
- [ ] Error type uses red/danger styling
