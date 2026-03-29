# Google Calendar Integration - Quick Implementation Checklist

⏱️ **Estimated Time**: 2-3 hours
📅 **Last Updated**: March 26, 2026

---

## ✅ Phase 2: Payment Flow (1-1.5 hours)

### Step 1: Add Imports to PaymentService.ts
```typescript
import { GoogleCalendarService } from '../../../services/GoogleCalendarService';
import { CalendarRepository } from '../../../repositories/CalendarRepository';
```

- [ ] Imports added

### Step 2: Database Migration (if needed)
```bash
# Check if columns exist
psql -U your_user -d repaircoin -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'service_orders' AND column_name IN ('calendar_event_id', 'calendar_connection_id', 'calendar_synced_at');"

# If missing, run migration
psql -U your_user -d repaircoin -f backend/src/migrations/096_add_calendar_fields_to_orders.sql
```

- [ ] Columns verified/added
- [ ] Migration run successfully

### Step 3: Add linkOrderToEvent Method to CalendarRepository.ts
```typescript
async linkOrderToEvent(
  orderId: string,
  connectionId: number,
  eventId: string
): Promise<void> {
  const query = `
    UPDATE service_orders
    SET calendar_event_id = $1, calendar_connection_id = $2, calendar_synced_at = NOW()
    WHERE order_id = $3
  `;
  await this.pool.query(query, [eventId, connectionId, orderId]);
}
```

- [ ] Method added to CalendarRepository

### Step 4: Add Calendar Sync to Payment Success Handler
**Location**: `PaymentService.ts` - AFTER order status set to 'paid'

- [ ] Copy calendar sync code block from docs (lines 57-130)
- [ ] Paste after payment success, before return
- [ ] Verify indentation and brackets

### Step 5: Test Payment Flow
- [ ] Connect Google Calendar in shop settings
- [ ] Create test booking with date/time
- [ ] Complete payment
- [ ] Verify event appears in Google Calendar
- [ ] Check backend logs for success message

---

## ✅ Phase 3: Appointment Updates (45-60 minutes)

### Step 6: Add Methods to CalendarRepository.ts
```typescript
async updateOrderSyncTimestamp(orderId: string): Promise<void> { ... }
async unlinkOrderFromEvent(orderId: string): Promise<void> { ... }
async getOrderCalendarEventId(orderId: string): Promise<string | null> { ... }
```

- [ ] Three methods added to CalendarRepository

### Step 7: Add Calendar Update on Reschedule
**Location**: `AppointmentController.ts` - AFTER reschedule approved

- [ ] Copy reschedule update code from docs (lines 161-200)
- [ ] Paste after reschedule approval
- [ ] Verify all variables are in scope

### Step 8: Add Calendar Delete on Cancellation
**Location**: `AppointmentController.ts` - AFTER cancellation confirmed

- [ ] Copy cancellation delete code from docs (lines 224-254)
- [ ] Paste after cancellation confirmed
- [ ] Verify all variables are in scope

### Step 9: Test Reschedule & Cancellation
- [ ] Reschedule appointment - event updates in calendar
- [ ] Cancel appointment - event deleted from calendar
- [ ] Check backend logs for success messages

---

## ✅ Phase 4: Final Verification (30 minutes)

### End-to-End Tests
- [ ] New booking creates calendar event
- [ ] Event shows correct time, customer, service details
- [ ] Reschedule updates calendar event
- [ ] Cancellation deletes calendar event
- [ ] Manual booking creates calendar event (if applicable)
- [ ] Mobile app shows all events correctly

### Error Handling Tests
- [ ] Payment succeeds when calendar disconnected (no event created)
- [ ] Payment succeeds when calendar API fails (logged error)
- [ ] Token auto-refreshes when expired
- [ ] Reschedule succeeds when calendar update fails

### Performance Tests
- [ ] 10+ rapid bookings all sync successfully
- [ ] No backend errors in logs
- [ ] Calendar API rate limits not hit

---

## 🔧 Quick Troubleshooting

### Events Not Creating
```bash
# Check connection status
psql -d repaircoin -c "SELECT * FROM shop_calendar_connections WHERE shop_id = 'SHOP_ID';"

# Check order has date/time
psql -d repaircoin -c "SELECT booking_date, booking_time_slot FROM service_orders WHERE order_id = 'ORDER_ID';"
```

### Token Issues
```bash
# Force token refresh
curl -X POST http://localhost:4000/api/shops/calendar/refresh-token \
  -H "Authorization: Bearer YOUR_JWT"
```

### Check Logs
```bash
# Watch backend logs
tail -f backend/logs/app.log | grep -i calendar
```

---

## 📝 Code Snippets Quick Access

### Calendar Sync Block (Payment)
See: `docs/setup/CALENDAR_INTEGRATION_IMPLEMENTATION.md` lines 57-130

### Calendar Update Block (Reschedule)
See: `docs/setup/CALENDAR_INTEGRATION_IMPLEMENTATION.md` lines 161-200

### Calendar Delete Block (Cancellation)
See: `docs/setup/CALENDAR_INTEGRATION_IMPLEMENTATION.md` lines 224-254

---

## ✅ Definition of Done

All checkboxes above must be checked:
- ✅ All code changes implemented
- ✅ Database migration run
- ✅ All repository methods added
- ✅ All tests passing
- ✅ No errors in backend logs
- ✅ Mobile calendar app verified

**Deployment Ready**: When all items checked, integration is production-ready! 🚀

---

## 📞 Need Help?

- Full docs: `docs/setup/CALENDAR_INTEGRATION_IMPLEMENTATION.md`
- Backend logs: `backend/logs/app.log`
- Database: Check `shop_calendar_connections` and `service_orders` tables
