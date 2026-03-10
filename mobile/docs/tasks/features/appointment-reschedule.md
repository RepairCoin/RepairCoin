# Feature: Appointment Reschedule

**Status:** Open
**Priority:** MEDIUM
**Est. Effort:** 4+ days (large feature)
**Created:** 2026-03-10

---

## Overview

Allow customers to request appointment changes with shop approval workflow.

## Key Components

- New database table: `appointment_reschedule_requests`
- Customer UI: "Edit Time" button on appointments, reschedule modal
- Shop UI: Reschedule requests tab with approve/reject
- Notifications for both parties
- Auto-expiry after 48 hours

## Scope

- Customer can request reschedule for `paid`/`confirmed` orders
- 24-hour minimum before appointment (same as cancellation)
- Shop must approve (protects shop schedules)
- Original slot stays booked until approved

## Database Schema

```sql
CREATE TABLE appointment_reschedule_requests (
  request_id UUID PRIMARY KEY,
  order_id VARCHAR(255) NOT NULL,
  shop_id VARCHAR(255) NOT NULL,
  customer_address VARCHAR(255) NOT NULL,
  original_date DATE NOT NULL,
  original_time_slot TIME NOT NULL,
  requested_date DATE NOT NULL,
  requested_time_slot TIME NOT NULL,
  customer_reason TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
