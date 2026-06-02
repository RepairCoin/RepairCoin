# Customer Appointments Calendar

## Overview

The Customer Appointments Calendar gives customers a visual monthly calendar view of their upcoming, completed, and cancelled bookings. It includes the ability to cancel or request reschedules directly from the calendar.

## Status

| Platform | Status |
|----------|--------|
| Frontend (Next.js) | Fully implemented |
| Backend API | Fully implemented |
| Mobile (React Native) | Partial — booking list exists, no calendar widget |

## Features

### Calendar Widget
- Monthly grid calendar (`AppointmentCalendarWidget`)
- Dates with bookings are highlighted with dots
- Click a date to see bookings on that day
- Navigate between months

### Appointment List View
- Filter by: `upcoming`, `completed`, `cancelled`
- Sort by date ascending/descending
- Each appointment card shows:
  - Service name and shop
  - Date, time, and duration
  - Booking status with color coding
  - Reschedule request status (if pending)

### Actions per Appointment
- **Cancel** — opens `CancelBookingModal` with reason input
- **Reschedule** — opens `RescheduleModal` to pick a new date/time
- View booking details

### Reschedule Requests
- Customer submits a reschedule request with preferred new time
- Shop approves or rejects the request
- Pending reschedule requests are shown inline on the appointment card

## API

- Get customer appointments: `GET /api/appointments/customer?startDate=&endDate=`
  - Returns appointments from 90 days in the past to 90 days in the future
- Cancel booking: `POST /api/bookings/:orderId/cancel`
- Reschedule request: `POST /api/appointments/:orderId/reschedule-request`

## Frontend Location

- Tab component: `frontend/src/components/customer/AppointmentsTab.tsx`
- Calendar widget: `frontend/src/components/customer/AppointmentCalendarWidget.tsx`
- Appointment card: `frontend/src/components/customer/AppointmentCard.tsx`
- Cancel modal: `frontend/src/components/customer/CancelBookingModal.tsx`
- Reschedule modal: `frontend/src/components/customer/RescheduleModal.tsx`

## Mobile Gap

The mobile app has:
- `BookingsTabContent` — list view of bookings (under services tab)
- `RescheduleModal` and `RescheduleRequestsScreen` — reschedule flow exists

What is missing on mobile:
- Monthly calendar widget view (`AppointmentCalendarWidget` equivalent)
- Filter tabs (upcoming / completed / cancelled) within the customer appointments view
- Cancel booking directly from the appointments tab
