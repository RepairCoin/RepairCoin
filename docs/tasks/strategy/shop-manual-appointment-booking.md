# Strategy: Shop Manual Appointment Booking

## Overview

Allow shops to manually create appointments for customers directly from the Appointments tab. This is useful for:
- Walk-in customers who want to schedule future appointments
- Phone/email bookings
- Rescheduling existing appointments to new times
- Booking for customers who don't have the app

## Implementation Status ✅ ALL PHASES COMPLETE

| Phase | Feature | Status | Date |
|-------|---------|--------|------|
| 1 | Core Integration (Book button in sidebar) | ✅ Complete | Feb 18, 2026 |
| 2 | Calendar Quick-Add (+ button on hover) | ✅ Complete | Feb 18, 2026 |
| 3 | UX Improvements (Visual calendar, 12h time) | ✅ Complete | Feb 18, 2026 |
| 4 | Send Payment Link (Stripe email) | ✅ Complete | Feb 18, 2026 |
| 5 | QR Code Payment (Walk-in scan & pay) | ✅ Complete | Feb 18, 2026 |
| 6 | Auto-Cancel Unpaid (24h expiry protection) | ✅ Complete | Feb 18, 2026 |

### Payment Options Summary

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   ✓ Paid    │  │  ⏳ Pending │  │  🚫 Unpaid  │
│   (Green)   │  │   (Amber)   │  │   (Gray)    │
│  Already    │  │  Pay at     │  │ No payment  │
│  collected  │  │  arrival    │  │   needed    │
└─────────────┘  └─────────────┘  └─────────────┘

┌─────────────┐  ┌─────────────┐
│ 📱 QR Code  │  │  📧 Send    │
│  (Purple)   │  │    Link     │
│  Walk-in    │  │   (Blue)    │
│  scan&pay   │  │  Email link │
└─────────────┘  └─────────────┘
```

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

## Payment Method Options ✅ IMPLEMENTED

### Current Implementation (5 Options)
The ManualBookingModal has five payment status options:

| Status | Color | Description | Backend Behavior |
|--------|-------|-------------|------------------|
| **Paid** | Green | Customer already paid | Order created as `confirmed`, payment_status = `paid` |
| **Pending** | Amber | Payment expected later (pay at arrival) | Order created as `confirmed`, payment_status = `pending` |
| **Unpaid** | Gray | No payment expected (comp, loyalty) | Order created as `confirmed`, payment_status = `unpaid` |
| **QR Code** | Purple | Walk-in customer scans QR to pay | Order created as `awaiting_payment`, QR modal shows Stripe checkout URL |
| **Send Link** | Blue | Email payment link to customer | Order created as `awaiting_payment`, Stripe checkout session created, email sent |

### Send Payment Link Flow

```
Shop selects "Send Link" → Submit booking
                               ↓
Backend creates order with status = 'awaiting_payment'
                               ↓
Creates Stripe Checkout Session (24-hour expiry)
                               ↓
Updates order with stripe_session_id
                               ↓
Sends email with "Pay Now" button to customer
                               ↓
Customer clicks link → Stripe checkout page
                               ↓
Payment succeeds → Stripe webhook fires
                               ↓
checkout.session.completed with bookingType = 'manual_booking_payment'
                               ↓
Order updated: status = 'confirmed', payment_status = 'paid'
                               ↓
Shop receives "Payment received" notification
```

### QR Code Payment Flow (Walk-in Customers)

```
Shop selects "QR Code" → Submit booking
                               ↓
Backend creates order with status = 'awaiting_payment'
                               ↓
Creates Stripe Checkout Session (24-hour expiry)
                               ↓
Returns payment link URL in response
                               ↓
Frontend displays QR modal with:
  - Large QR code (Stripe checkout URL)
  - Service name, date, time
  - Amount due ($XX.XX)
  - 24-hour expiry warning
                               ↓
Walk-in customer scans QR with phone camera
                               ↓
Opens Stripe checkout page on customer's phone
                               ↓
Customer enters card details and pays
                               ↓
Payment succeeds → Stripe webhook fires
                               ↓
Order auto-confirmed, shop notified
```

### Email Template Features
- Professional styled HTML email
- Shop name and appointment details (service, date, time)
- Large "Pay Now" button with yellow branding
- Expiration warning (24 hours)
- Amount due prominently displayed

### Auto-Cancel Unpaid Bookings ✅ IMPLEMENTED

Prevents time slots from being blocked indefinitely when customers don't pay via Send Link.

**Service**: `UnpaidBookingCleanupService.ts`

```
Booking created with 'awaiting_payment' status
                    ↓
         24 hours pass without payment
                    ↓
    Cleanup service runs (every hour check)
                    ↓
         Finds expired unpaid bookings
                    ↓
    Order status → 'cancelled'
    Note added: "Auto-cancelled: Payment not received within 24 hours"
                    ↓
    Shop notification: "Booking auto-cancelled..."
                    ↓
         Time slot freed up for other bookings
```

**Security Summary**:

| Payment Method | Use Case | Risk Level | Protection |
|----------------|----------|------------|------------|
| **Paid** | Cash/external card | ✅ None | Payment already collected |
| **Pending** | Pay at arrival | ⚠️ Low | Customer expected in-person |
| **Unpaid** | Comp/loyalty | ✅ None | Shop's choice, no payment expected |
| **QR Code** | Walk-in | ✅ None | Customer present, pays immediately |
| **Send Link** | Remote booking | ✅ Protected | Auto-cancelled after 24h if no payment |

### Future Enhancements (Optional)
- **Stripe Terminal Integration**: In-person card reader support
- **SMS Payment Link**: For customers without email
- **Configurable expiry**: Allow shops to set custom expiry time (12h, 24h, 48h)

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

### Phase 1: Core Integration ✅ COMPLETED (Feb 18, 2026)
- [x] Import ManualBookingModal into AppointmentsTab
- [x] Add modal state management
- [x] Add "Book" button to sidebar header
- [x] Pass shopId to modal
- [x] Refresh calendar on successful booking
- [x] Fix ManualBookingModal API call (getShopServices)
- [x] Fix ManualBookingController NotificationService import
- [x] Add senderAddress to notification params

### Phase 2: Calendar Quick-Add ✅ COMPLETED (Feb 18, 2026)
- [x] Add hover state to calendar day cells (group relative classes)
- [x] Add "+" button on day hover (opacity transition)
- [x] Pass pre-selected date to modal
- [x] Handle click vs quick-add differentiation (e.stopPropagation)
- [x] Add useEffect to sync preSelectedDate when modal reopens

### Phase 3: UX Improvements ✅ COMPLETED (Feb 18, 2026)
- [x] Reuse existing DateAvailabilityPicker component (no need to create new)
- [x] Replace HTML date input with visual calendar in ManualBookingModal
- [x] Shop availability indicators included (green dots for available days)
- [x] Mobile responsiveness included (responsive grid, sm: breakpoints)
- [x] Add 12-hour time format (formatTime12Hour helper)
- [x] Improved time slot grid (4 columns on desktop, 3 on mobile)
- [x] Added ring effect for selected time slot

### Phase 4: Payment Link ✅ COMPLETED (Feb 18, 2026)
- [x] Add "Send Link" payment option (4-button UI: paid, pending, send_link, unpaid)
- [x] Create Stripe Checkout Session for payment link (24-hour expiration)
- [x] Update order with stripe_session_id
- [x] Send payment link email with styled HTML template (Pay Now button)
- [x] Order created with 'awaiting_payment' status until payment completes
- [x] Add webhook handler for checkout.session.completed (manual_booking_payment type)
- [x] Webhook updates order to 'confirmed' and payment_status to 'paid'
- [x] Shop notification when customer completes payment

### Phase 5: QR Code Payment ✅ COMPLETED (Feb 18, 2026)
- [x] Add "QR Code" payment option (5-button UI: paid, pending, unpaid, qr_code, send_link)
- [x] Install qrcode.react package for QR code generation
- [x] Create QR modal with styled display showing payment amount and booking details
- [x] QR code displays Stripe checkout URL for customer to scan
- [x] Same Stripe Checkout Session as send_link (24-hour expiration)
- [x] Same webhook handler for payment confirmation
- [x] No email sent for QR code (in-person transaction)

### Phase 6: Auto-Cancel Unpaid Bookings ✅ COMPLETED (Feb 18, 2026)
- [x] Create UnpaidBookingCleanupService (runs every hour)
- [x] Find orders with status 'awaiting_payment' older than 24 hours
- [x] Auto-cancel expired bookings (status → 'cancelled')
- [x] Add note to order: "Auto-cancelled: Payment not received within 24 hours"
- [x] Send notification to shop about auto-cancellation
- [x] Integrate with app.ts startup and graceful shutdown
- [x] Prevents time slots from being blocked indefinitely for remote bookings

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
