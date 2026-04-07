# Bug: Cancel Booking Fails with 400 — Missing Cancellation Reason

## Status: Open
## Priority: High
## Date: 2026-04-07
## Category: Bug - Booking Cancellation
## Affected: Customer cancel booking (mobile only)

---

## Overview

When a customer taps "Cancel Booking" on the mobile app, the request fails with "Request failed with status code 400". The backend requires a `cancellationReason` field in the request body, but the mobile sends no body at all.

---

## Root Cause

**Backend requirement** (`OrderController.ts` lines 489-494):
```typescript
const { cancellationReason, cancellationNotes } = req.body;

if (!cancellationReason) {
  return res.status(400).json({ success: false, error: 'Cancellation reason is required' });
}
```

**Mobile sends no body** (`booking.services.ts` line 46):
```typescript
async cancelOrder(orderId: string) {
  return await apiClient.post(`/services/orders/${orderId}/cancel`);
  // No body — cancellationReason is missing
}
```

**Web sends reason via modal** (`frontend/src/services/api/services.ts`):
```typescript
await apiClient.post(`/services/orders/${orderId}/cancel`, {
  cancellationReason,    // Required — from dropdown
  cancellationNotes,     // Optional — free text
});
```

The web shows a `CancelBookingModal` with predefined reason options (schedule_conflict, found_alternative, too_expensive, changed_mind, emergency, other) before calling the API.

---

## Fix Required

### Step 1: Add cancellation reason to API call

**File:** `mobile/shared/services/booking.services.ts` line 44-51

```typescript
async cancelOrder(orderId: string, cancellationReason: string, cancellationNotes?: string) {
  try {
    return await apiClient.post(`/services/orders/${orderId}/cancel`, {
      cancellationReason,
      cancellationNotes,
    });
  } catch (error: any) {
    console.error("Failed to cancel order:", error.message);
    throw error;
  }
}
```

### Step 2: Add cancellation reason modal

Create a simple cancel reason modal or use an Alert with options before calling the API:

```typescript
// Simple approach using Alert
Alert.alert(
  "Cancel Booking",
  "Please select a reason:",
  [
    { text: "Schedule Conflict", onPress: () => cancel(orderId, "schedule_conflict") },
    { text: "Found Alternative", onPress: () => cancel(orderId, "found_alternative") },
    { text: "Changed My Mind", onPress: () => cancel(orderId, "changed_mind") },
    { text: "Other", onPress: () => cancel(orderId, "other") },
    { text: "Back", style: "cancel" },
  ]
);
```

Or create a proper modal matching the web's `CancelBookingModal` with:
- Predefined reasons: schedule_conflict, found_alternative, too_expensive, changed_mind, emergency, other
- Optional notes text input
- Confirm/Cancel buttons

### Step 3: Update mutation

**File:** `mobile/feature/booking/hooks/mutations/useBookingMutations.ts` line 52-69

```typescript
export function useCancelOrderMutation() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();

  return useMutation({
    mutationFn: async ({ orderId, reason, notes }: { orderId: string; reason: string; notes?: string }) => {
      return bookingApi.cancelOrder(orderId, reason, notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "bookings"] });
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "appointments"] });
      showSuccess("Booking has been cancelled.");
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || error.message || "Failed to cancel booking.";
      showError(message);
    },
  });
}
```

---

## Web Cancel Reasons (Reference)

```typescript
const CANCEL_REASONS = [
  { value: "schedule_conflict", label: "Schedule Conflict" },
  { value: "found_alternative", label: "Found Alternative" },
  { value: "too_expensive", label: "Too Expensive" },
  { value: "changed_mind", label: "Changed My Mind" },
  { value: "emergency", label: "Emergency" },
  { value: "other", label: "Other" },
];
```

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/shared/services/booking.services.ts:44-51` | Add `cancellationReason` and `cancellationNotes` params |
| `mobile/feature/booking/hooks/mutations/useBookingMutations.ts:52-69` | Update mutation to pass reason |
| `mobile/feature/booking/hooks/ui/useBookingDetail.ts` | Update cancel handler to collect reason before calling mutation |
| `mobile/feature/booking/components/BookingActions.tsx` | Show reason selection before cancel |

---

## QA Test Plan

### Before fix
1. Login as customer on mobile
2. Open a paid booking → tap "Cancel Booking"
3. **Bug**: Toast shows "Request failed with status code 400"

### After fix
1. Tap "Cancel Booking"
2. **Expected**: Reason selection appears (modal or alert)
3. Select a reason → confirm
4. **Expected**: Booking cancelled successfully, toast shows confirmation
5. Booking list updates to show cancelled status
