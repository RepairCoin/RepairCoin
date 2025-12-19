# Timezone Scheduling Bug Fix Plan

**Created:** 2025-12-19
**Updated:** 2025-12-19
**Branch:** fix/86d16d993-BUG--Referral-bonuses-not-distributed-after-first-repair
**Status:** Ready for Implementation
**Severity:** CRITICAL

---

## Bug Report (From End User)

> When a customer selects a booking date (e.g., December 24), the system saves it as the previous day (December 23). This is caused by using `.toISOString()` which converts to UTC, shifting the date backwards for users in positive UTC offset timezones.
>
> **Impact:** Customers book appointments for the wrong day, causing scheduling chaos for both customers and shops.

---

## Overview

The appointment scheduling system has critical timezone bugs:

| Priority | Bug | Impact |
|----------|-----|--------|
| **P0 - CRITICAL** | Wrong date saved (Dec 24 → Dec 23) | Customers book wrong day |
| **P1 - HIGH** | Backend parses dates as UTC | Day-of-week mismatches |
| **P2 - MEDIUM** | Times not displayed in customer's timezone | Confusing UX |

---

## The Bug Visualized

```
CUSTOMER IN ASIA (UTC+8) SELECTS: December 24, 2024

Step 1: Browser creates Date object
  └─► new Date("Dec 24, 2024") = "Dec 24, 2024 00:00:00" (local, UTC+8)

Step 2: .toISOString() converts to UTC (BUG!)
  └─► "2024-12-23T16:00:00.000Z"
             └───┘
             Dec 23! (shifted back 8 hours)

Step 3: .split('T')[0] extracts date
  └─► "2024-12-23"

Step 4: Backend saves
  └─► booking_date = '2024-12-23'  ❌ WRONG DAY!

RESULT: Customer wanted Dec 24, system saved Dec 23
```

---

## Two-Part Fix Strategy

### Part A: Fix the Bug (P0 - Required)
- Replace `toISOString().split('T')[0]` with `formatLocalDate()`
- Fix backend date parsing
- **No database changes required**
- **4 frontend files + 3 backend files**

### Part B: Timezone Display Enhancement (P2 - Optional)
- Display times in customer's local timezone
- Add shop timezone to database
- **Requires database migration**
- **Additional 5+ files**

---

## Current Database Schema (No Changes Needed for Part A)

| Column | Type | Notes |
|--------|------|-------|
| `booking_date` | `DATE` | Stores '2024-12-24' - timezone-naive, OK |
| `booking_time_slot` | `TIME` | Stores '14:30:00' - shop's local time, OK |
| `open_time` / `close_time` | `TIME` | Shop hours - shop's local time, OK |

**For Part A:** No database changes. Existing schema is fine.
**For Part B:** Add `timezone` column to `shops` table.

## Root Cause Analysis

| Issue | Location | Description | Part |
|-------|----------|-------------|------|
| UTC Conversion | Frontend | `toISOString().split('T')[0]` converts local date to UTC | **A** |
| Date Parsing | Backend | `new Date("YYYY-MM-DD")` interprets as UTC midnight | **A** |
| Wrong Date Reference | Backend | Time slot generation uses `new Date()` instead of booking date | **A** |
| No Timezone Storage | Database | Shop timezone not stored | **B** |
| Times Not Converted | Frontend | Times shown in shop's TZ, not customer's TZ | **B** |

---

## Affected Files

### Part A: Bug Fix (7 files)

| File | Lines | Issue |
|------|-------|-------|
| `frontend/src/utils/dateUtils.ts` | NEW | Create utility functions |
| `frontend/src/components/customer/TimeSlotPicker.tsx` | 40 | `toISOString().split('T')[0]` |
| `frontend/src/components/customer/ServiceCheckoutModal.tsx` | 199 | `toISOString().split('T')[0]` |
| `frontend/src/components/customer/AppointmentsTab.tsx` | 30-31 | `toISOString().split('T')[0]` |
| `frontend/src/components/shop/AppointmentCalendar.tsx` | 51-52 | `toISOString().split('T')[0]` |
| `backend/src/utils/dateUtils.ts` | NEW | Create utility functions |
| `backend/src/domains/ServiceDomain/services/AppointmentService.ts` | 32-33, 87-91 | `new Date()` parsing |

### Part B: Timezone Enhancement (5+ files)

| File | Lines | Issue |
|------|-------|-------|
| `backend/migrations/XXX_add_shop_timezone.sql` | NEW | Add timezone column |
| `backend/src/repositories/ShopRepository.ts` | - | Add timezone methods |
| `frontend/src/components/shop/service/ServiceAvailabilitySettings.tsx` | - | Add timezone selector |
| `frontend/src/components/customer/TimeSlotPicker.tsx` | - | Convert to customer TZ |
| `frontend/src/components/customer/DateAvailabilityPicker.tsx` | - | Handle TZ conversion |

---

# PART A: BUG FIX (Required)

## A.1: Create Date Utility Functions

### A.1.1: Create frontend date utility

**File:** `frontend/src/utils/dateUtils.ts` (NEW)

```typescript
/**
 * Format a Date object as YYYY-MM-DD in LOCAL timezone (not UTC)
 *
 * IMPORTANT: Do NOT use .toISOString().split('T')[0] as it converts to UTC first,
 * which can shift the date backwards for users in positive UTC offset timezones.
 *
 * Example of the bug this fixes:
 *   User in UTC+8 selects Dec 24 at midnight local time
 *   toISOString() -> "2024-12-23T16:00:00.000Z" (converted to UTC)
 *   split('T')[0] -> "2024-12-23" (WRONG - shifted back one day!)
 *
 * This function returns "2024-12-24" (correct)
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string as a local date (not UTC)
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format time for display (12-hour format)
 */
export function formatTime12Hour(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
}
```

### A.1.2: Create backend date utility

**File:** `backend/src/utils/dateUtils.ts` (NEW)

```typescript
/**
 * Parse a YYYY-MM-DD string as a local date (not UTC)
 *
 * IMPORTANT: JavaScript's new Date("YYYY-MM-DD") interprets the string as UTC,
 * which causes timezone issues. This function parses as local time instead.
 */
export function parseLocalDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format a Date as YYYY-MM-DD in local timezone
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Create a Date object from date string and time string
 * @param dateStr - YYYY-MM-DD format
 * @param timeStr - HH:MM format
 */
export function createDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}
```

---

## A.2: Fix Frontend Date Serialization

### A.2.1: Fix TimeSlotPicker.tsx

**File:** `frontend/src/components/customer/TimeSlotPicker.tsx`

```typescript
// Add import at top
import { formatLocalDate } from '@/utils/dateUtils';

// Line 40 - BEFORE (BUG)
const dateStr = selectedDate.toISOString().split('T')[0];

// Line 40 - AFTER (FIX)
const dateStr = formatLocalDate(selectedDate);
```

### A.2.2: Fix ServiceCheckoutModal.tsx

**File:** `frontend/src/components/customer/ServiceCheckoutModal.tsx`

```typescript
// Add import at top
import { formatLocalDate } from '@/utils/dateUtils';

// Line 199 - BEFORE (BUG)
bookingDate: bookingDate?.toISOString().split('T')[0],

// Line 199 - AFTER (FIX)
bookingDate: bookingDate ? formatLocalDate(bookingDate) : undefined,
```

### A.2.3: Fix AppointmentsTab.tsx

**File:** `frontend/src/components/customer/AppointmentsTab.tsx`

```typescript
// Add import at top
import { formatLocalDate } from '@/utils/dateUtils';

// Lines 30-31 - BEFORE (BUG)
startDate.toISOString().split('T')[0],
endDate.toISOString().split('T')[0]

// Lines 30-31 - AFTER (FIX)
formatLocalDate(startDate),
formatLocalDate(endDate)
```

### A.2.4: Fix AppointmentCalendar.tsx

**File:** `frontend/src/components/shop/AppointmentCalendar.tsx`

```typescript
// Lines 51-52 - BEFORE (BUG)
const startDate = firstDay.toISOString().split('T')[0];
const endDate = lastDay.toISOString().split('T')[0];

// Lines 51-52 - AFTER (FIX)
// Note: This file already has formatDateLocal function at line 90-96
// Use that instead of toISOString()
const startDate = formatDateLocal(firstDay);
const endDate = formatDateLocal(lastDay);
```

---

## A.3: Fix Backend Date Parsing

### A.3.1: Fix AppointmentService.ts

**File:** `backend/src/domains/ServiceDomain/services/AppointmentService.ts`

```typescript
// Add import at top
import { parseLocalDateString, createDateTime } from '../../utils/dateUtils';

// Lines 32-33 - BEFORE (BUG)
const targetDate = new Date(date);  // Parses as UTC
const dayOfWeek = targetDate.getDay();  // Gets UTC day

// Lines 32-33 - AFTER (FIX)
const targetDate = parseLocalDateString(date);  // Parses as local
const dayOfWeek = targetDate.getDay();  // Gets local day

// Lines 87-91 - BEFORE (BUG)
let currentTime = new Date();  // WRONG: current server time
currentTime.setHours(openHour, openMin, 0, 0);
const endTime = new Date();  // WRONG: current server time
endTime.setHours(closeHour, closeMin, 0, 0);

// Lines 87-91 - AFTER (FIX)
const [year, month, day] = date.split('-').map(Number);
let currentTime = new Date(year, month - 1, day, openHour, openMin, 0, 0);
const endTime = new Date(year, month - 1, day, closeHour, closeMin, 0, 0);

// Line 116 - BEFORE (BUG)
const slotDateTime = new Date(date + ' ' + timeStr);  // Ambiguous parsing

// Line 116 - AFTER (FIX)
const slotDateTime = createDateTime(date, timeStr);
```

---

## A.4: Build Verification

```bash
# Verify both builds pass
cd frontend && npm run build
cd backend && npm run build
```

---

# PART B: TIMEZONE DISPLAY ENHANCEMENT (Optional)

## B.1: Add Shop Timezone to Database

### B.1.1: Database migration

**File:** `backend/migrations/XXX_add_shop_timezone.sql` (NEW)

```sql
-- Add timezone column to shops table
ALTER TABLE shops ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/New_York';

-- Add comment for documentation
COMMENT ON COLUMN shops.timezone IS 'IANA timezone identifier (e.g., America/New_York, America/Los_Angeles)';
```

### B.1.2: Update ShopRepository

**File:** `backend/src/repositories/ShopRepository.ts`

```typescript
// Add method to get/set shop timezone
async getShopTimezone(shopId: string): Promise<string> {
  const result = await this.query(
    'SELECT timezone FROM shops WHERE shop_id = $1',
    [shopId]
  );
  return result.rows[0]?.timezone || 'America/New_York';
}

async updateShopTimezone(shopId: string, timezone: string): Promise<void> {
  await this.query(
    'UPDATE shops SET timezone = $1 WHERE shop_id = $2',
    [timezone, shopId]
  );
}
```

---

## B.2: Install Timezone Library

```bash
# Frontend
cd frontend && npm install date-fns-tz

# Backend
cd backend && npm install date-fns-tz
```

---

## B.3: Add Timezone Conversion Utilities

### B.3.1: Update frontend dateUtils.ts

**File:** `frontend/src/utils/dateUtils.ts` (ADD to existing file)

```typescript
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

/**
 * Get the customer's local timezone
 */
export function getCustomerTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Convert a time from shop timezone to customer timezone
 * @param time - Time in HH:MM format
 * @param date - Date for the conversion (needed for DST)
 * @param shopTimezone - Shop's IANA timezone (e.g., 'America/New_York')
 * @param customerTimezone - Customer's IANA timezone
 */
export function convertTimeToCustomerTimezone(
  time: string,
  date: Date,
  shopTimezone: string,
  customerTimezone: string
): string {
  const [hours, minutes] = time.split(':').map(Number);

  // Create date in shop's timezone
  const shopDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);

  // Format in customer's timezone
  return formatInTimeZone(shopDate, customerTimezone, 'HH:mm');
}

/**
 * Convert a time from customer timezone to shop timezone (for booking)
 */
export function convertTimeToShopTimezone(
  time: string,
  date: Date,
  customerTimezone: string,
  shopTimezone: string
): string {
  const [hours, minutes] = time.split(':').map(Number);

  const customerDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);

  return formatInTimeZone(customerDate, shopTimezone, 'HH:mm');
}
```

---

## B.4: Update Frontend Components for Timezone Display

### B.4.1: Update TimeSlotPicker.tsx

**File:** `frontend/src/components/customer/TimeSlotPicker.tsx`

```typescript
// Add imports
import { getCustomerTimezone, convertTimeToCustomerTimezone } from '@/utils/dateUtils';

// In component, convert slots to customer timezone for display
const customerTimezone = getCustomerTimezone();

// When displaying slots, convert from shop TZ to customer TZ
const displayTime = convertTimeToCustomerTimezone(
  slot.time,
  selectedDate,
  shopTimezone,
  customerTimezone
);

// Add timezone indicator
<span className="text-xs text-gray-400">
  Times shown in your timezone ({customerTimezone})
</span>
```

### B.4.2: Update ServiceAvailabilitySettings.tsx

**File:** `frontend/src/components/shop/service/ServiceAvailabilitySettings.tsx`

```typescript
// Add timezone selector above operating hours section
<div className="mb-6">
  <label className="block text-sm font-medium text-gray-400 mb-2">
    Shop Timezone
  </label>
  <select
    value={shopTimezone}
    onChange={(e) => handleUpdateTimezone(e.target.value)}
    className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white"
  >
    <option value="America/New_York">Eastern Time (ET)</option>
    <option value="America/Chicago">Central Time (CT)</option>
    <option value="America/Denver">Mountain Time (MT)</option>
    <option value="America/Los_Angeles">Pacific Time (PT)</option>
    <option value="America/Anchorage">Alaska Time (AKT)</option>
    <option value="Pacific/Honolulu">Hawaii Time (HT)</option>
    <option value="Asia/Manila">Philippine Time (PHT)</option>
    <option value="Asia/Tokyo">Japan Time (JST)</option>
    <option value="Europe/London">UK Time (GMT/BST)</option>
    <option value="UTC">UTC</option>
  </select>
  <p className="text-xs text-gray-500 mt-2">
    All operating hours are interpreted in this timezone
  </p>
</div>
```

---

## B.5: Update Backend for Timezone Handling

### B.5.1: Update API to return shop timezone

**File:** `backend/src/domains/ServiceDomain/controllers/AppointmentController.ts`

```typescript
// Include timezone in availability response
const shopTimezone = await shopRepository.getShopTimezone(shopId);

return res.json({
  success: true,
  data: {
    availability,
    timezone: shopTimezone  // NEW
  }
});
```

### B.5.2: Accept customer timezone on booking

**File:** `backend/src/domains/ServiceDomain/controllers/OrderController.ts`

```typescript
// Accept customerTimezone in request body
const { serviceId, bookingDate, bookingTime, customerTimezone } = req.body;

// Pass to payment service for conversion
```

---

## File Changes Summary

### Part A: Bug Fix (Required) - 7 files

| File | Action | Change |
|------|--------|--------|
| `frontend/src/utils/dateUtils.ts` | CREATE | `formatLocalDate()` utility |
| `frontend/src/components/customer/TimeSlotPicker.tsx` | MODIFY | Line 40 |
| `frontend/src/components/customer/ServiceCheckoutModal.tsx` | MODIFY | Line 199 |
| `frontend/src/components/customer/AppointmentsTab.tsx` | MODIFY | Lines 30-31 |
| `frontend/src/components/shop/AppointmentCalendar.tsx` | MODIFY | Lines 51-52 |
| `backend/src/utils/dateUtils.ts` | CREATE | `parseLocalDateString()` utility |
| `backend/src/domains/ServiceDomain/services/AppointmentService.ts` | MODIFY | Lines 32-33, 87-91, 116 |

### Part B: Enhancement (Optional) - 6+ files

| File | Action | Change |
|------|--------|--------|
| `backend/migrations/XXX_add_shop_timezone.sql` | CREATE | Add timezone column |
| `backend/src/repositories/ShopRepository.ts` | MODIFY | Add timezone methods |
| `frontend/src/utils/dateUtils.ts` | MODIFY | Add TZ conversion functions |
| `frontend/src/components/customer/TimeSlotPicker.tsx` | MODIFY | Display in customer TZ |
| `frontend/src/components/shop/service/ServiceAvailabilitySettings.tsx` | MODIFY | Add TZ selector |
| `backend/src/domains/ServiceDomain/controllers/AppointmentController.ts` | MODIFY | Return shop TZ |

---

## Testing Checklist

### Part A: Bug Fix Tests

- [ ] Customer in Asia (UTC+8) selects Dec 24 → saved as Dec 24 (not Dec 23)
- [ ] Customer in USA (UTC-5) selects Dec 24 → saved as Dec 24
- [ ] Shop calendar shows booking on correct day
- [ ] Time slots generated use booking date (not current date)
- [ ] Frontend build passes
- [ ] Backend build passes

### Part B: Enhancement Tests

- [ ] Shop in USA, Customer in Asia → times display in customer's timezone
- [ ] Shop timezone selector works and saves correctly
- [ ] Booking converts customer time to shop time before saving
- [ ] API returns shop timezone in availability response
- [ ] Timezone indicator shows in UI

---

## Progress Tracking

### PART A: BUG FIX

#### A.1: Create Utilities (Agent: `refactoring-expert`)
- [ ] A.1.1: Create `frontend/src/utils/dateUtils.ts`
- [ ] A.1.2: Create `backend/src/utils/dateUtils.ts`
- [ ] Agent completed successfully

#### A.2: Frontend Fixes (Agent: `frontend-architect`) [PARALLEL]
- [ ] A.2.1: Fix `TimeSlotPicker.tsx` (line 40)
- [ ] A.2.2: Fix `ServiceCheckoutModal.tsx` (line 199)
- [ ] A.2.3: Fix `AppointmentsTab.tsx` (lines 30-31)
- [ ] A.2.4: Fix `AppointmentCalendar.tsx` (lines 51-52)
- [ ] Agent completed successfully

#### A.3: Backend Fixes (Agent: `backend-architect`) [PARALLEL with A.2]
- [ ] A.3.1: Fix `AppointmentService.ts` (lines 32-33, 87-91, 116)
- [ ] Agent completed successfully

#### A.4: Build Verification
- [ ] Frontend builds successfully
- [ ] Backend builds successfully
- [ ] **BUG FIX COMPLETE** ✅

---

### PART B: TIMEZONE ENHANCEMENT (Optional)

#### B.1: Database Setup (Agent: `backend-architect`)
- [ ] B.1.1: Create migration `XXX_add_shop_timezone.sql`
- [ ] B.1.2: Update `ShopRepository.ts` with timezone methods
- [ ] Agent completed successfully

#### B.2: Install Dependencies
- [ ] Install `date-fns-tz` in frontend
- [ ] Install `date-fns-tz` in backend

#### B.3: Timezone Utilities (Agent: `refactoring-expert`)
- [ ] B.3.1: Add TZ conversion functions to `dateUtils.ts`
- [ ] Agent completed successfully

#### B.4: Frontend TZ Display (Agent: `frontend-architect`) [PARALLEL]
- [ ] B.4.1: Update `TimeSlotPicker.tsx` for customer TZ display
- [ ] B.4.2: Update `ServiceAvailabilitySettings.tsx` with TZ selector
- [ ] Agent completed successfully

#### B.5: Backend TZ Handling (Agent: `backend-architect`) [PARALLEL with B.4]
- [ ] B.5.1: Update API to return shop timezone
- [ ] B.5.2: Accept customer timezone on booking
- [ ] Agent completed successfully

#### B.6: Final Verification
- [ ] All builds pass
- [ ] Manual test: Shop USA, Customer Asia
- [ ] **ENHANCEMENT COMPLETE** ✅

---

## Example Failure Scenario (Before Fix)

**Setup:**
- Shop in London (UTC+0)
- Customer in New York (UTC-5)
- Shop hours: 9:00 AM - 5:00 PM

**Customer Action:**
- Selects: "Dec 20, 2024" at "2:00 PM" (New York time)

**What Happens (Bug):**
1. Frontend: `new Date("Dec 20").toISOString()` -> "2024-12-20T05:00:00Z" (UTC)
2. `.split('T')[0]` -> "2024-12-20" (correct by accident if after 7 PM ET)
3. Backend: `new Date("2024-12-20")` -> "2024-12-20T00:00:00Z" (midnight UTC)
4. `getDay()` on UTC date -> might be different day than customer intended
5. Time slot "14:00" stored without timezone context
6. Shop in London sees "2:00 PM" but this was meant to be 2 PM New York time = 7 PM London!

**Result:** Shop expects customer at 7 PM London, but displays as 2 PM. Customer misses appointment.

---

## Agent Execution Strategy

This plan uses **parallel agents** to maximize efficiency. Part A (bug fix) and Part B (enhancement) are separate phases.

### Execution Flow

```
╔═════════════════════════════════════════════════════════════════════╗
║                      PART A: BUG FIX (Required)                     ║
╚═════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────┐
│                    A.1: CREATE UTILITIES                             │
│                    (Sequential - Foundation)                         │
├─────────────────────────────────────────────────────────────────────┤
│  Agent: refactoring-expert                                          │
│  Tasks:                                                             │
│    - Create frontend/src/utils/dateUtils.ts                         │
│    - Create backend/src/utils/dateUtils.ts                          │
│  Output: formatLocalDate(), parseLocalDateString() ready            │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────┬────────────────────────────────────────┐
│   A.2: FRONTEND FIXES      │      A.3: BACKEND FIXES                │
│      (Parallel Agent)      │      (Parallel Agent)                  │
├────────────────────────────┼────────────────────────────────────────┤
│  Agent: frontend-architect │  Agent: backend-architect              │
│  Tasks:                    │  Tasks:                                │
│    - TimeSlotPicker.tsx    │    - AppointmentService.ts             │
│    - ServiceCheckoutModal  │                                        │
│    - AppointmentsTab.tsx   │  Replace:                              │
│    - AppointmentCalendar   │    - new Date(string) parsing          │
│                            │    - new Date() for time slots         │
│  Replace:                  │                                        │
│    - toISOString()         │                                        │
│      .split('T')[0]        │                                        │
└────────────────────────────┴────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    A.4: BUILD VERIFICATION                           │
├─────────────────────────────────────────────────────────────────────┤
│  cd frontend && npm run build                                       │
│  cd backend && npm run build                                        │
│                                                                     │
│  ✅ BUG FIX COMPLETE - Dates now saved correctly!                   │
└─────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════

╔═════════════════════════════════════════════════════════════════════╗
║               PART B: TIMEZONE ENHANCEMENT (Optional)               ║
╚═════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────┐
│                    B.1: DATABASE SETUP                               │
├─────────────────────────────────────────────────────────────────────┤
│  Agent: backend-architect                                           │
│  Tasks:                                                             │
│    - Create migration: shops.timezone column                        │
│    - Update ShopRepository                                          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    B.2: INSTALL DEPENDENCIES                         │
├─────────────────────────────────────────────────────────────────────┤
│  cd frontend && npm install date-fns-tz                             │
│  cd backend && npm install date-fns-tz                              │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────┬────────────────────────────────────────┐
│   B.4: FRONTEND TZ         │      B.5: BACKEND TZ                   │
│      (Parallel Agent)      │      (Parallel Agent)                  │
├────────────────────────────┼────────────────────────────────────────┤
│  Agent: frontend-architect │  Agent: backend-architect              │
│  Tasks:                    │  Tasks:                                │
│    - Add TZ conversion     │    - Return shop TZ in API             │
│    - Add TZ selector       │    - Accept customer TZ                │
│    - Show times in         │    - Convert on save                   │
│      customer's TZ         │                                        │
└────────────────────────────┴────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    B.6: FINAL VERIFICATION                           │
├─────────────────────────────────────────────────────────────────────┤
│  Test: Shop in USA, Customer in Asia                                │
│  Verify: Times display in customer's local timezone                 │
│                                                                     │
│  ✅ ENHANCEMENT COMPLETE - Full timezone support!                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Agent Assignments

#### Part A: Bug Fix

| Step | Agent Type | Files | Parallel? |
|------|------------|-------|-----------|
| **A.1** | `refactoring-expert` | 2 utility files | No (foundation) |
| **A.2** | `frontend-architect` | 4 frontend components | Yes |
| **A.3** | `backend-architect` | 1 backend service | Yes (with A.2) |
| **A.4** | - | Build verification | - |

#### Part B: Enhancement

| Step | Agent Type | Files | Parallel? |
|------|------------|-------|-----------|
| **B.1** | `backend-architect` | Migration + repository | No (database) |
| **B.2** | - | npm install | No |
| **B.3** | `refactoring-expert` | TZ utility functions | No |
| **B.4** | `frontend-architect` | TZ display in UI | Yes |
| **B.5** | `backend-architect` | TZ handling in API | Yes (with B.4) |
| **B.6** | Manual | Testing | No |

### Agent Prompts

#### A.1: Utility Creation Agent

```
Agent: refactoring-expert
Prompt: |
  Create date utility functions to fix timezone bug where dates shift backwards.

  BUG: Using .toISOString().split('T')[0] converts to UTC, causing Dec 24 to become Dec 23
       for users in positive UTC offset timezones (e.g., Asia).

  Task 1: Create frontend/src/utils/dateUtils.ts with:
  - formatLocalDate(date: Date): string - Format as YYYY-MM-DD in LOCAL timezone (NOT UTC)
  - parseLocalDate(dateStr: string): Date - Parse YYYY-MM-DD as local date
  - formatTime12Hour(time: string): string - Format HH:MM as 12-hour time

  Task 2: Create backend/src/utils/dateUtils.ts with:
  - parseLocalDateString(dateStr: string): Date - Parse YYYY-MM-DD as local (NOT UTC)
  - formatLocalDate(date: Date): string - Format as YYYY-MM-DD in local timezone
  - createDateTime(dateStr: string, timeStr: string): Date - Combine date + time

  CRITICAL: Do NOT use toISOString() - that's the bug we're fixing!
  Include JSDoc comments explaining WHY we avoid toISOString().
```

#### A.2: Frontend Fix Agent

```
Agent: frontend-architect
Prompt: |
  Fix timezone bug in frontend - dates are being shifted backwards due to UTC conversion.

  BUG: .toISOString().split('T')[0] converts Dec 24 (Asia) to Dec 23 (UTC)

  Add this import to each file:
  import { formatLocalDate } from '@/utils/dateUtils';

  Files to fix:

  1. frontend/src/components/customer/TimeSlotPicker.tsx
     Line 40: selectedDate.toISOString().split('T')[0]
     Fix to: formatLocalDate(selectedDate)

  2. frontend/src/components/customer/ServiceCheckoutModal.tsx
     Line 199: bookingDate?.toISOString().split('T')[0]
     Fix to: bookingDate ? formatLocalDate(bookingDate) : undefined

  3. frontend/src/components/customer/AppointmentsTab.tsx
     Lines 30-31: .toISOString().split('T')[0]
     Fix to: formatLocalDate(startDate) and formatLocalDate(endDate)

  4. frontend/src/components/shop/AppointmentCalendar.tsx
     Lines 51-52: .toISOString().split('T')[0]
     Fix to: formatDateLocal(firstDay) (use existing function at line 90-96)

  After changes, run: cd frontend && npm run build
```

#### A.3: Backend Fix Agent

```
Agent: backend-architect
Prompt: |
  Fix timezone bug in backend - dates parsed as UTC instead of local.

  BUG: new Date("2024-12-24") parses as UTC midnight, causing day-of-week mismatches.

  Add this import:
  import { parseLocalDateString, createDateTime } from '../../utils/dateUtils';

  File to fix: backend/src/domains/ServiceDomain/services/AppointmentService.ts

  1. Lines 32-33:
     Before: const targetDate = new Date(date);
     After:  const targetDate = parseLocalDateString(date);

  2. Lines 87-91 (time slot generation):
     Before: let currentTime = new Date(); currentTime.setHours(...)
     After:  const [year, month, day] = date.split('-').map(Number);
             let currentTime = new Date(year, month - 1, day, openHour, openMin, 0, 0);

  3. Line 116:
     Before: const slotDateTime = new Date(date + ' ' + timeStr);
     After:  const slotDateTime = createDateTime(date, timeStr);

  After changes, run: cd backend && npm run build
```

### Execution Commands

#### Part A: Bug Fix (Required)

```bash
# A.1: Create utilities (must complete first)
claude --agent refactoring-expert "Create date utility files per plan section A.1"

# A.2 + A.3: Fix frontend and backend in parallel
claude --agent frontend-architect "Fix frontend UTC bugs per plan section A.2" &
claude --agent backend-architect "Fix backend date parsing per plan section A.3" &
wait

# A.4: Verify builds
cd frontend && npm run build
cd backend && npm run build

# ✅ BUG FIX COMPLETE
```

#### Part B: Enhancement (Optional)

```bash
# B.1: Database setup
claude --agent backend-architect "Add shop timezone column per plan section B.1"

# B.2: Install dependencies
cd frontend && npm install date-fns-tz
cd backend && npm install date-fns-tz

# B.3: Add TZ utilities
claude --agent refactoring-expert "Add timezone conversion utilities per plan section B.3"

# B.4 + B.5: Frontend and backend TZ handling in parallel
claude --agent frontend-architect "Add timezone display per plan section B.4" &
claude --agent backend-architect "Add timezone API handling per plan section B.5" &
wait

# B.6: Final verification
cd frontend && npm run build
cd backend && npm run build

# Manual test: Shop USA, Customer Asia
# ✅ ENHANCEMENT COMPLETE
```

---

## Timezone Display Strategy

### Core Principle: Display in Customer's Local Timezone

Times should ALWAYS display in the **customer's local timezone** for the best user experience.

```
STORAGE (Database)                    DISPLAY (Frontend)
─────────────────                    ─────────────────
Shop timezone: America/New_York      Customer timezone: Asia/Manila
Shop hours: 09:00 - 18:00            Customer sees: 22:00 - 07:00
                    │                              ▲
                    └──── Convert ─────────────────┘
```

### Example Flow

**Shop Setup (New York):**
- Shop owner sets hours: 9:00 AM - 6:00 PM
- Stored with shop timezone: `America/New_York`

**Customer View (Asia/Manila, UTC+8):**
- Browser detects: `Asia/Manila`
- Converts shop hours: 9 AM ET → 10 PM PHT
- Displays: "Available 10:00 PM - 7:00 AM"

**Customer Books (10:30 PM their time):**
- Frontend sends: `{ time: "22:30", customerTimezone: "Asia/Manila" }`
- Backend converts: 22:30 PHT → 09:30 ET
- Stores: `booking_time_slot: "09:30"` (shop's local time)

**Shop Views Calendar:**
- Sees booking at 9:30 AM (their local time)

### Implementation Requirements

#### Frontend Changes

1. **Detect customer timezone:**
```typescript
const customerTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
// e.g., "Asia/Manila", "America/Los_Angeles"
```

2. **Convert shop hours to customer timezone:**
```typescript
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

function convertToCustomerTimezone(
  time: string,           // "09:00"
  shopTimezone: string,   // "America/New_York"
  customerTimezone: string // "Asia/Manila"
): string {
  // Create a date with shop's time in shop's timezone
  const today = new Date();
  const [hours, minutes] = time.split(':').map(Number);

  // Build datetime in shop timezone, convert to customer timezone
  const shopDateTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);

  // Use date-fns-tz for conversion
  return formatInTimeZone(shopDateTime, customerTimezone, 'HH:mm');
}
```

3. **Display with timezone indicator:**
```typescript
<span className="text-gray-400 text-xs">
  Times shown in your local timezone ({customerTimezone})
</span>
```

#### Backend Changes

1. **Store shop timezone** (already in Phase 5)

2. **Return shop timezone in API responses:**
```typescript
// GET /api/shops/:shopId/availability
{
  shopId: "...",
  timezone: "America/New_York",
  availability: [
    { dayOfWeek: 1, openTime: "09:00", closeTime: "18:00" }
  ]
}
```

3. **Accept customer timezone on booking:**
```typescript
// POST /api/orders
{
  serviceId: "...",
  bookingDate: "2024-12-20",
  bookingTime: "22:30",
  customerTimezone: "Asia/Manila"  // NEW
}
```

4. **Convert to shop timezone before storing:**
```typescript
const bookingTimeInShopTz = convertTimezone(
  bookingTime,           // "22:30"
  customerTimezone,      // "Asia/Manila"
  shopTimezone           // "America/New_York"
);
// Result: "09:30"
```

#### New Dependencies

```bash
# Frontend
cd frontend && npm install date-fns-tz

# Backend
cd backend && npm install date-fns-tz
```

---

## Notes

- Times are stored in **shop's local timezone** in the database
- Times are displayed in **customer's local timezone** in the UI
- Shop timezone is required for proper conversion (Phase 5 is now REQUIRED, not optional)
- Use `date-fns-tz` library for reliable timezone conversions
- Always show timezone indicator so users know what timezone they're viewing
