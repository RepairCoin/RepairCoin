# Refactor: Shop Bookings 12-Hour Time Format

**Status:** Open
**Priority:** LOW
**Est. Effort:** 1 hour
**Created:** 2026-03-10

---

## Problem

Shop bookings display 24-hour time format (e.g., "14:00").

## Fix Required

Convert to 12-hour format with AM/PM (e.g., "2:00 PM").

## Implementation

Create or use existing helper function:

```typescript
function formatTime12Hour(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}
```

## Files to Update

- Shop bookings list/table component
- Appointment calendar view
- Booking details modal

## Verification Checklist

- [ ] All booking times show in 12-hour format
- [ ] AM/PM displays correctly
- [ ] Time sorting still works
