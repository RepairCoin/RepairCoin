# Strategy: Reschedule Pending Badge on Appointments Tab

## Problem Statement
When customers submit reschedule requests, shops have no immediate visual indicator that there are pending approvals waiting for their attention. The shop owner must click into the "Reschedules" sub-tab to discover pending requests.

## Owner Request
> "We should have pending approval next to reschedule... to notify the customer that's there an approval to need attention"

## Current State Analysis

### Existing Infrastructure (Already Working)
```
Customer submits reschedule request
    ↓
appointment_reschedule_requests table (status: 'pending')
    ↓
API: GET /api/services/appointments/reschedule-requests/count
    ↓
Returns: { count: number }
    ↓
Frontend API: appointmentsApi.getShopRescheduleRequestCount()
    ↓
RescheduleRequestsTab.tsx - fetches and displays count internally
    ↓
BUT: AppointmentsTab.tsx tab button shows NO badge
```

### Key Finding
The pending count API already exists but the "Reschedules" tab button does not display a badge. The count is only visible after clicking into the tab.

## Files to Modify

| File | Current Behavior | Required Change |
|------|------------------|-----------------|
| `frontend/src/components/shop/tabs/AppointmentsTab.tsx` | Shows "Reschedules" text only | Fetch pending count and display badge on sub-tab |
| `frontend/src/components/ui/sidebar/ShopSidebar.tsx` | Shows "Appointments" text only | Fetch pending count and display badge on sidebar item |
| `frontend/src/components/ui/sidebar/BaseSidebar.tsx` | SectionMenuItem has no badge support | Add badge rendering in SectionMenuItem |
| `frontend/src/components/ui/sidebar/useSidebar.ts` | SidebarItem has no badge property | Add badge property to interface |

## Implementation Plan

### Step 1: Add State and Effect for Pending Count
```tsx
// Add to AppointmentsTab component
const [pendingRescheduleCount, setPendingRescheduleCount] = useState(0);

useEffect(() => {
  const fetchPendingCount = async () => {
    try {
      const count = await appointmentsApi.getShopRescheduleRequestCount();
      setPendingRescheduleCount(count);
    } catch (error) {
      console.error('Error fetching pending reschedule count:', error);
    }
  };

  fetchPendingCount();

  // Refresh count every 30 seconds
  const interval = setInterval(fetchPendingCount, 30000);
  return () => clearInterval(interval);
}, []);
```

### Step 2: Update Tab Button with Badge
```tsx
// Update the Reschedules tab button
<button
  onClick={() => setActiveSubTab('reschedules')}
  className={`pb-3 px-1 flex items-center gap-2 text-sm font-medium transition-colors ${
    activeSubTab === 'reschedules'
      ? 'text-[#FFCC00] border-b-2 border-[#FFCC00]'
      : 'text-gray-400 hover:text-gray-200'
  }`}
>
  <RefreshCw className="w-4 h-4" /> Reschedules
  {pendingRescheduleCount > 0 && (
    <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
      {pendingRescheduleCount > 99 ? '99+' : pendingRescheduleCount}
    </span>
  )}
</button>
```

## Visual Design

**With Pending Requests (action needed):**
```
┌─────────────────────────────────────────────────────────┐
│  📅 Appointments          🔄 Reschedules  [2]           │
│  ═══════════════                         ↑              │
│  (active tab)                     RED badge with        │
│                                   pending count         │
└─────────────────────────────────────────────────────────┘
```

**No Pending Requests (all clear):**
```
┌─────────────────────────────────────────────────────────┐
│  📅 Appointments          🔄 Reschedules  (0)           │
│  ═══════════════                         ↑              │
│  (active tab)                     GRAY badge shows      │
│                                   no pending requests   │
└─────────────────────────────────────────────────────────┘
```

### Badge Styling
- **When pending > 0**: Red background (`bg-red-500`) with white text - indicates action needed
- **When pending = 0**: Gray background (`bg-gray-700`) with gray text - shows system status
- **Text**: Bold, small (`text-xs font-bold`)
- **Shape**: Pill/rounded-full
- **Position**: Right side of "Reschedules" text
- **Max Display**: "99+" if count exceeds 99
- **Always Visible**: Badge shows count even when 0 for visibility

## Benefits

### For Shops
- Immediate visibility of pending reschedule requests
- No need to click into tab to check for pending items
- Reduces missed or expired reschedule requests (48-hour expiration)

### For Customers
- Faster response times from shops
- Better communication about schedule changes
- Reduced frustration from expired requests

## Testing Checklist
- [ ] Red badge appears when pending count > 0
- [ ] Gray badge with "0" appears when pending count = 0
- [ ] Count updates after approving/rejecting request
- [ ] Count refreshes periodically (every 30 seconds)
- [ ] Badge displays "99+" for counts > 99
- [ ] Red color provides clear visual urgency
- [ ] Gray color indicates no action needed

## Impact
- **No backend changes required** - API already exists
- **Minimal frontend change** - Single file modification
- **High visibility improvement** - Shops immediately see pending actions

---

## Bug Fix: Reschedule Request Expiration (Added)

### Problem
The reschedule expiration mechanism existed in code but was NOT automatically scheduled. Requests would stay "pending" indefinitely if shops didn't respond.

### Solution Implemented

| File | Change |
|------|--------|
| `backend/src/repositories/RescheduleRepository.ts` | Updated `expireOldRequests()` to return expired request details |
| `backend/src/domains/ServiceDomain/services/RescheduleService.ts` | Emit `reschedule:request_expired` event for each expired request |
| `backend/src/domains/notification/NotificationDomain.ts` | Subscribe to `reschedule:request_expired` and send notifications |
| `backend/src/services/RescheduleExpirationService.ts` | **NEW** - Scheduled service that runs every hour |
| `backend/src/app.ts` | Import and start/stop the expiration service |

### How It Works Now
1. Scheduled job runs **every hour**
2. Finds all pending requests where `expires_at < NOW()`
3. Marks them as `status = 'expired'`
4. Emits `reschedule:request_expired` event for each
5. Customer receives notification: "Your reschedule request has expired"
6. Original booking remains unchanged - customer can submit new request
