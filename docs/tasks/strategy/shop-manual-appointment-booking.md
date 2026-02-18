# Strategy: Shop Manual Appointment Booking

## Overview

Allow shops to manually create appointments for customers directly from the Appointments tab. This is useful for:
- Walk-in customers who want to schedule future appointments
- Phone/email bookings
- Rescheduling existing appointments to new times
- Booking for customers who don't have the app

## Current State Analysis

### Existing Components (Already Implemented)

| Component | Path | Status |
|-----------|------|--------|
| **ManualBookingModal** | `frontend/src/components/shop/ManualBookingModal.tsx` | ✅ Fully functional |
| **AppointmentsTab** | `frontend/src/components/shop/tabs/AppointmentsTab.tsx` | ✅ Calendar view ready |
| **appointmentsApi** | `frontend/src/services/api/appointments.ts` | ✅ API methods exist |

### ManualBookingModal Features (579 lines)
- ✅ Customer search by name/email/phone/address
- ✅ Create new customer form (name, email, phone, wallet address)
- ✅ No-show warning display for customers
- ✅ Service selection dropdown
- ✅ Date picker (HTML date input)
- ✅ Time slot grid with availability
- ✅ Payment status: paid/pending/unpaid
- ✅ Notes field
- ✅ Backend API: `POST /api/services/shops/{shopId}/appointments/manual`

### Customer Booking Flow (for reference)
- Uses `ServiceCheckoutModal` with visual calendar (`DateAvailabilityPicker`)
- Shows availability indicators on calendar days
- Time slot grid with 12-hour format
- Stripe payment integration

---

## Trigger Options Analysis

### Option 1: Button Above Right Column
**Location**: Above the "Appointments" sidebar panel header

**Pros**:
- Always visible and accessible
- Clear call-to-action
- Consistent with common UI patterns
- Works regardless of calendar state

**Cons**:
- Requires manual date selection in modal
- Additional click to select date

### Option 2: Click Calendar Day
**Location**: Click on any day in the calendar to add appointment

**Pros**:
- Intuitive date selection
- Pre-fills date automatically
- Visual workflow

**Cons**:
- Not discoverable (users may not know they can click)
- Conflicts with existing "view appointments" click behavior
- Can't add appointment without selecting a date first

### Option 3: Hybrid Approach (Recommended)

**Combine both triggers for maximum flexibility:**

1. **Primary Button**: "Book Appointment" button above the sidebar header
   - Always accessible
   - Opens modal with today's date pre-selected

2. **Calendar Quick-Add**: Click on empty area of a calendar day OR add "+" icon on hover
   - Opens modal with that date pre-selected
   - Maintains existing click-to-view behavior for days with appointments

**Why this is better**:
- Discoverable (button is always visible)
- Efficient (calendar click pre-fills date)
- Non-conflicting (doesn't break existing behavior)
- Flexible (works for both planned and spontaneous bookings)

---

## Recommended Implementation

### Phase 1: Add Trigger Button (Quick Win)

Add a "Book Appointment" button to the AppointmentsTab sidebar header.

**Location in AppointmentsTab.tsx** (around line 736-756):
```tsx
{/* Sidebar Header */}
<div className="p-3 sm:p-4 border-b border-gray-800">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2 text-[#FFCC00]">
      <CalendarClock className="w-4 h-4 sm:w-5 sm:h-5" />
      <span className="font-semibold text-sm sm:text-base">
        {sidebarAppointments.mode === 'selected' ? 'Appointments' : 'Upcoming'}
      </span>
    </div>
    <div className="flex items-center gap-2">
      {/* NEW: Book Appointment Button */}
      <button
        onClick={() => setShowManualBookingModal(true)}
        className="px-3 py-1.5 bg-[#FFCC00] text-black text-xs font-semibold rounded-lg hover:bg-[#FFD700] transition-colors flex items-center gap-1"
      >
        <Plus className="w-3.5 h-3.5" />
        Book
      </button>
      {selectedDate && (
        <button onClick={clearSelectedDate} ...>
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  </div>
</div>
```

**Changes needed**:
1. Import `ManualBookingModal` and `Plus` icon
2. Add state: `const [showManualBookingModal, setShowManualBookingModal] = useState(false)`
3. Add modal component at end of return
4. Pass `preSelectedDate` when opening from calendar click

### Phase 2: Calendar Quick-Add (Enhancement)

Add hover "+" button on calendar days for quick booking.

**Modify calendar day cell** (around line 602-729):
```tsx
{/* Add quick-book button on hover for days in current month */}
{isInCurrentMonth && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      openManualBookingForDate(day.date);
    }}
    className="absolute top-1 right-1 w-5 h-5 bg-[#FFCC00] text-black rounded-full
               flex items-center justify-center opacity-0 group-hover:opacity-100
               transition-opacity text-xs font-bold"
    title="Book appointment"
  >
    +
  </button>
)}
```

### Phase 3: Improve Date/Time Picker (UX Enhancement)

Replace the basic HTML date input with a visual calendar matching the customer experience.

**Current (ManualBookingModal line 457-463)**:
```tsx
<input
  type="date"
  value={bookingDate}
  onChange={(e) => setBookingDate(e.target.value)}
  min={new Date().toISOString().split('T')[0]}
  className="w-full px-4 py-3 bg-[#0D0D0D] ..."
/>
```

**Recommended**: Create a simplified `DatePickerCalendar` component:

```tsx
// Reusable visual date picker (similar to sc2.png)
interface DatePickerCalendarProps {
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  shopId: string;
  minDate?: Date;
}

const DatePickerCalendar: React.FC<DatePickerCalendarProps> = ({
  selectedDate,
  onSelectDate,
  shopId,
  minDate = new Date()
}) => {
  // Month navigation
  // 7-column grid for days
  // Highlight selected date in yellow
  // Gray out past dates
  // Show availability indicators (optional)
};
```

**Benefits**:
- Consistent with customer booking experience
- Better mobile UX
- Can show shop availability indicators
- More visually appealing

---

## Payment Method Options

### Current Implementation
The ManualBookingModal has three payment status options:
- **Paid**: Customer already paid (cash, card at counter, etc.)
- **Pending**: Payment expected later
- **Unpaid**: No payment expected (comp, loyalty reward, etc.)

### Recommended Enhancements

#### Option A: Keep Current (Simplest)
- Works for walk-ins and phone bookings
- Shop handles payment separately
- No code changes needed

#### Option B: Add "Send Payment Link" (Recommended)
Add a fourth option that sends a Stripe payment link to the customer.

```tsx
<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
  {(['paid', 'pending', 'send_link', 'unpaid'] as const).map((status) => (
    <button
      key={status}
      onClick={() => setPaymentStatus(status)}
      className={`px-3 py-3 rounded-lg font-medium capitalize ...`}
    >
      {status === 'send_link' ? 'Send Link' : status}
    </button>
  ))}
</div>
```

**Backend flow for "Send Link"**:
1. Create order with status `awaiting_payment`
2. Generate Stripe Payment Link
3. Send email/SMS to customer with payment link
4. Order auto-confirms when payment completes

#### Option C: Full Stripe Terminal Integration (Future)
- In-person card reader support
- Requires Stripe Terminal SDK
- More complex implementation

### Recommendation
Start with **Option A** (current) for immediate use, then add **Option B** (send payment link) as a fast-follow enhancement.

---

## Data Flow

### Creating Manual Booking

```
Shop clicks "Book" → ManualBookingModal opens
                           ↓
              Select/Create Customer
                           ↓
               Select Service
                           ↓
          Select Date → Load available time slots
                           ↓
               Select Time Slot
                           ↓
            Set Payment Status + Notes
                           ↓
              Click "Book Appointment"
                           ↓
    POST /api/services/shops/{shopId}/appointments/manual
    {
      customerAddress: string,
      customerEmail?: string,
      customerName?: string,
      customerPhone?: string,
      serviceId: string,
      bookingDate: "YYYY-MM-DD",
      bookingTimeSlot: "HH:MM:SS",
      bookingEndTime: "HH:MM:SS",
      paymentStatus: "paid" | "pending" | "unpaid",
      notes?: string,
      createNewCustomer?: boolean
    }
                           ↓
         Backend creates service_order
                           ↓
    If paymentStatus === 'paid':
      - Send confirmation email to customer
      - Create in-app notification
      - Schedule 24-hour reminder
                           ↓
           Modal closes, calendar refreshes
```

---

## Implementation Checklist

### Phase 1: Core Integration (2-3 hours)
- [ ] Import ManualBookingModal into AppointmentsTab
- [ ] Add modal state management
- [ ] Add "Book" button to sidebar header
- [ ] Pass shopId to modal
- [ ] Refresh calendar on successful booking

### Phase 2: Calendar Quick-Add (1-2 hours)
- [ ] Add hover state to calendar day cells
- [ ] Add "+" button on day hover
- [ ] Pass pre-selected date to modal
- [ ] Handle click vs quick-add differentiation

### Phase 3: UX Improvements (3-4 hours)
- [ ] Create DatePickerCalendar component
- [ ] Replace HTML date input in modal
- [ ] Add shop availability indicators
- [ ] Improve mobile responsiveness

### Phase 4: Payment Link (4-6 hours)
- [ ] Add "Send Link" payment option
- [ ] Create backend endpoint for payment link generation
- [ ] Integrate Stripe Payment Links API
- [ ] Add email template for payment request

---

## Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/components/shop/tabs/AppointmentsTab.tsx` | Add button, import modal, state management |
| `frontend/src/components/shop/ManualBookingModal.tsx` | (Optional) Upgrade date picker |
| `frontend/src/components/shop/DatePickerCalendar.tsx` | (New) Visual date picker component |
| `backend/src/domains/ServiceDomain/controllers/ManualBookingController.ts` | (Optional) Add payment link support |

---

---

## Rollback Plan

If issues arise after implementation, follow these steps to revert changes:

### Phase 1 Rollback

**File**: `frontend/src/components/shop/tabs/AppointmentsTab.tsx`

**Changes to revert**:
1. Remove import of `ManualBookingModal` and `Plus` icon
2. Remove state: `showManualBookingModal`, `preSelectedBookingDate`
3. Remove the "Book" button from sidebar header
4. Remove the `<ManualBookingModal />` component from JSX

**Git rollback command**:
```bash
git checkout HEAD~1 -- frontend/src/components/shop/tabs/AppointmentsTab.tsx
```

**Manual rollback** (if needed):
```tsx
// Remove these imports:
// import { ManualBookingModal } from '../ManualBookingModal';
// Plus icon from lucide-react

// Remove these states:
// const [showManualBookingModal, setShowManualBookingModal] = useState(false);
// const [preSelectedBookingDate, setPreSelectedBookingDate] = useState<string | null>(null);

// Remove the Book button from sidebar header (around line 740-750)

// Remove the ManualBookingModal component at the end of the return
```

### Phase 2 Rollback
- Remove hover "+" button styles from calendar day cells
- Remove `openManualBookingForDate` function
- Revert calendar cell onClick handler changes

### Verification After Rollback
1. Appointments tab loads without errors
2. Calendar displays correctly
3. Clicking on dates with appointments shows sidebar details
4. No console errors

---

## Summary

**Recommended Approach**: Hybrid trigger (Button + Calendar click) with current payment options.

**Why**:
1. **ManualBookingModal already exists** - No need to rebuild from scratch
2. **Button provides discoverability** - Users know the feature exists
3. **Calendar click provides efficiency** - Quick date selection
4. **Current payment options sufficient** - Covers 95% of use cases
5. **Minimal code changes** - Can be implemented in a few hours

**Next Steps**:
1. Add "Book" button to AppointmentsTab sidebar (Phase 1)
2. Test with shop users
3. Gather feedback for Phase 2-4 enhancements
