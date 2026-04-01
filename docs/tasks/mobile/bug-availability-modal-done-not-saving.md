# Bug: Availability Settings Modal "Done" Button Does Not Save Changes

**Status:** open
**Priority:** high
**Date:** 2026-03-30
**Platform:** Mobile (React Native / Expo)

---

## Summary

When a shop owner opens the Availability Settings modal from the Add/Edit Service form, modifies settings (slot duration, max concurrent bookings, advance booking, etc.), and taps "Done", the changes are not persisted. Reopening the modal shows the original values. The web version saves immediately via dedicated Save buttons and works correctly.

---

## Root Cause: "Done" Only Stores Changes Locally, Never Calls API

The Availability Modal uses a **deferred save pattern** — tapping "Done" packages changes into local React state (`pendingAvailabilityChanges`) but never calls the API. The actual API save only happens when the parent service form is submitted ("Create Service" or "Update Service"). However, because the modal reloads fresh data from the API every time it opens, the unsaved local changes are lost.

### The Broken Flow

```
1. User opens Availability Settings modal
2. Modal loads current data from API (useAvailabilityModal.ts:48-52 → loadData)
3. User modifies settings (slot duration, hours, etc.)
4. User taps "Done"
5. handleDone() packages changes → calls onSave() → calls onClose()
   (useAvailabilityModal.ts:162-190)
6. onSave stores to setPendingAvailabilityChanges (local state only)
   (ServicesFormScreen.tsx:422)
7. Modal closes — NO API CALL is made
8. User reopens modal
9. Modal calls loadData() again — fetches ORIGINAL values from API
10. User sees unchanged values — changes appear lost
```

### Key Code

**useAvailabilityModal.ts:162-190** — `handleDone()` only packages and closes:
```typescript
const handleDone = useCallback(() => {
  onSave({
    availability: availability.map(...),
    timeSlotConfig: timeSlotConfig ? {...} : null,
    dateOverrides: dateOverrides.map(...),
    hasChanges: hasChanges(),
  });
  onClose();  // closes modal, NO API call
}, [...]);
```

**ServicesFormScreen.tsx:422** — `onSave` only stores locally:
```typescript
<AvailabilityModal
  visible={showAvailability}
  onClose={closeAvailabilityModal}
  onSave={(changes) => setPendingAvailabilityChanges(changes)}  // local state only
  shopId={shopId}
/>
```

**useServiceFormUI.ts:284,324** — `saveAvailabilityChanges()` is only called during form submission:
```typescript
// In createService():
await createServiceMutation.mutateAsync({ serviceData: createData });
await saveAvailabilityChanges(pendingAvailabilityChanges);  // only here

// In updateService():
await updateServiceMutation.mutateAsync({ serviceId, serviceData: updateData });
await saveAvailabilityChanges(pendingAvailabilityChanges);  // only here
```

**useAvailabilityModal.ts:48-52** — Modal always reloads from API on open:
```typescript
useEffect(() => {
  if (visible && shopId) {
    loadData();  // fetches fresh from API, overwrites local state
  }
}, [visible, shopId]);
```

---

## Why Web Works Correctly

The web `ServiceAvailabilitySettings.tsx` saves **immediately** when the user clicks each section's Save button:
- `handleSaveDuration()` → `appointmentsApi.updateServiceDuration()` (direct API call)
- `handleSaveTimeSlotConfig()` → `appointmentsApi.updateTimeSlotConfig()` (direct API call)
- Day availability → `appointmentsApi.updateShopAvailability()` per day (direct API call)

No deferred save. No pending state. Changes persist immediately.

---

## Why Standalone Mobile Screen Works

The standalone `AvailabilitySettingsScreen` (`mobile/feature/appointment/screens/AvailabilitySettingsScreen.tsx`) also saves **directly to the API**:
- Line 153: `appointmentApi.updateShopAvailability(payload)` — immediate
- Line 183: `appointmentApi.updateTimeSlotConfig({...})` — immediate
- Line 217: `appointmentApi.createDateOverride(payload)` — immediate

This screen is accessible via `/shop/availability/` and works correctly.

---

## Fix Options

### Option A: Save directly to API in handleDone (Recommended)

Modify `useAvailabilityModal.ts` to call the API when "Done" is pressed, matching the standalone screen behavior:

```typescript
const handleDone = useCallback(async () => {
  try {
    // Save availability for each changed day
    for (const day of availability) {
      await appointmentApi.updateShopAvailability({
        dayOfWeek: day.dayOfWeek,
        isOpen: day.isOpen,
        openTime: day.openTime || "09:00",
        closeTime: day.closeTime || "17:00",
        breakStartTime: day.breakStartTime || undefined,
        breakEndTime: day.breakEndTime || undefined,
      });
    }

    // Save time slot config
    if (timeSlotConfig) {
      await appointmentApi.updateTimeSlotConfig({
        slotDurationMinutes: timeSlotConfig.slotDurationMinutes,
        bufferTimeMinutes: timeSlotConfig.bufferTimeMinutes,
        maxConcurrentBookings: timeSlotConfig.maxConcurrentBookings,
        bookingAdvanceDays: timeSlotConfig.bookingAdvanceDays,
        minBookingHours: timeSlotConfig.minBookingHours,
        allowWeekendBooking: timeSlotConfig.allowWeekendBooking,
      });
    }

    // Save new date overrides
    for (const override of dateOverrides) {
      if (override.overrideId.startsWith('temp-')) {
        await appointmentApi.createDateOverride({...override});
      }
    }

    showSuccess("Availability settings saved");
    onClose();
  } catch (error) {
    showError("Failed to save availability settings");
  }
}, [...]);
```

### Option B: Remove deferred save from service form

Remove `saveAvailabilityChanges()` calls from `createService()` and `updateService()` in `useServiceFormUI.ts` since the modal now saves directly.

---

## Files to Modify

1. `mobile/feature/service/hooks/ui/useAvailabilityModal.ts` — Add API calls to `handleDone()`
2. `mobile/feature/service/hooks/ui/useServiceFormUI.ts` — Remove deferred `saveAvailabilityChanges()` from `createService()` and `updateService()` (if Option A applied)
3. `mobile/feature/service/screens/ServicesFormScreen.tsx` — Simplify `onSave` to just close (no pending state needed)

---

## Reproduction Steps

1. Login as a shop owner on the mobile app
2. Navigate to Services → tap "+" (Add New Service) or edit an existing service
3. Scroll down and tap "Availability Settings"
4. Switch to "Settings" tab
5. Change any value (e.g., slot duration from 15m to 30m, or max bookings from 1 to 3)
6. Tap "Done"
7. Reopen the Availability Settings modal
8. Observe: all values reverted to original — changes were not saved

---

## Comparison: Three Availability Save Approaches

| Approach | Saves to API | Works? |
|---|---|---|
| **Web** (`ServiceAvailabilitySettings.tsx`) | Immediately on "Save" button per section | Yes |
| **Mobile standalone** (`AvailabilitySettingsScreen.tsx`) | Immediately on save per section | Yes |
| **Mobile modal** (`AvailabilityModal` via `useAvailabilityModal.ts`) | Deferred to service form submission | No — modal reloads from API, losing changes |
