# Task: Shop Bookings Time Format (24hr to 12hr)

## Overview
Convert time display in shop bookings from 24-hour format (12:45:00) to 12-hour format with AM/PM (12:45 PM).

## Problem
Times in shop booking cards displayed in raw 24-hour format:
- `12:45:00` instead of `12:45 PM`
- `09:00:00` instead of `9:00 AM`

## Solution
Created a reusable `formatTime12Hour()` helper function that handles multiple time formats.

---

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/components/shop/bookings/mockData.ts` | Added `formatTime12Hour()` helper |
| `frontend/src/components/shop/bookings/BookingCard.tsx` | Use formatter for time display |
| `frontend/src/components/shop/bookings/tabs/BookingOverviewTab.tsx` | Use formatter for time display |
| `frontend/src/components/shop/bookings/BookingsTabV2.tsx` | Use formatter in timeline descriptions |

---

## Code Snippets

### 1. Helper Function (mockData.ts)

```typescript
/**
 * Format a time string (HH:MM:SS or HH:MM) to 12-hour format with AM/PM
 * Also handles ISO timestamps and already formatted times
 */
export const formatTime12Hour = (timeString: string): string => {
  if (!timeString) return '';

  // If already in 12-hour format (contains AM or PM), return as-is
  if (timeString.includes('AM') || timeString.includes('PM')) {
    return timeString;
  }

  // If it's an ISO timestamp, parse and format
  if (timeString.includes('T') || timeString.includes('-')) {
    const date = new Date(timeString);
    if (!isNaN(date.getTime())) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
  }

  // Parse HH:MM:SS or HH:MM format
  const timeParts = timeString.split(':');
  if (timeParts.length >= 2) {
    const hours = parseInt(timeParts[0], 10);
    const minutes = timeParts[1];

    if (!isNaN(hours)) {
      const period = hours >= 12 ? 'PM' : 'AM';
      const hours12 = hours % 12 || 12;
      return `${hours12}:${minutes} ${period}`;
    }
  }

  // Fallback: return original
  return timeString;
};
```

### 2. Usage in BookingCard.tsx

```typescript
// Import
import { MockBooking, getStatusLabel, getStatusColor, formatDate, formatTime12Hour, truncateAddress } from "./mockData";

// Usage
<div className="bg-[#0D0D0D] rounded-lg p-2">
  <p className="text-gray-500 text-xs">Time</p>
  <p className="text-white font-medium">{formatTime12Hour(booking.serviceTime)}</p>
</div>
```

### 3. Usage in BookingOverviewTab.tsx

```typescript
// Import
import { MockBooking, getTierColor, formatDate, formatTime12Hour, truncateAddress } from "../mockData";

// Usage
<div>
  <p className="text-gray-500 text-sm">Time</p>
  <p className="text-white font-medium">{formatTime12Hour(booking.serviceTime)}</p>
</div>
```

### 4. Usage in BookingsTabV2.tsx (Timeline)

```typescript
// Import
import { mockBookings, MockBooking, Message, transformApiOrder, formatTime12Hour } from "./mockData";

// Usage in timeline description
description: `Service scheduled for ${b.serviceDate} at ${formatTime12Hour(b.serviceTime)}`
```

---

## Supported Input Formats

| Input | Output |
|-------|--------|
| `12:45:00` | `12:45 PM` |
| `09:00:00` | `9:00 AM` |
| `14:30` | `2:30 PM` |
| `00:00:00` | `12:00 AM` |
| `2026-01-20T12:45:00.000Z` | `12:45 PM` |
| `9:00 AM` | `9:00 AM` (unchanged) |
| `""` | `""` (empty) |

---

## Key Features

1. **Handles multiple formats** - Works with HH:MM:SS, HH:MM, ISO timestamps
2. **Idempotent** - Already formatted times pass through unchanged
3. **Graceful fallback** - Returns original string if parsing fails
4. **Reusable** - Single helper function used across all components

---

## Testing Checklist

- [ ] Booking cards show 12-hour format
- [ ] Booking details panel shows 12-hour format
- [ ] Timeline descriptions show 12-hour format
- [ ] Mock data times (already 12hr) display correctly
- [ ] API data times (24hr) convert correctly
- [ ] Edge cases: midnight (00:00), noon (12:00)

---

## Status
**Completed** - January 2026
