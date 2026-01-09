# Shop Services (Marketplace) - Frontend Manual QA Test Cases

**Document Version:** 1.0
**Date:** December 17, 2024
**Feature:** Shop Services / Marketplace
**Test Environment:** http://localhost:3001/shop

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Test Data Specifications](#2-test-data-specifications)
3. [Service Creation Tests](#3-service-creation-tests)
4. [Service Editing Tests](#4-service-editing-tests)
5. [Service Deletion Tests](#5-service-deletion-tests)
6. [Image Upload Tests](#6-image-upload-tests)
7. [Service Listing & Display Tests](#7-service-listing--display-tests)
8. [Service Search & Filter Tests](#8-service-search--filter-tests)
9. [Service Details Modal Tests](#9-service-details-modal-tests)
10. [Customer Marketplace Tests](#10-customer-marketplace-tests)
11. [Authorization & Access Control Tests](#11-authorization--access-control-tests)
12. [Edge Cases & Boundary Tests](#12-edge-cases--boundary-tests)
13. [Mobile Responsiveness Tests](#13-mobile-responsiveness-tests)
14. [Time Slot Configuration Tests](#14-time-slot-configuration-tests)
    - [Service Duration](#tc-141-service-duration-minutes)
    - [Buffer Time](#tc-142-buffer-time-minutes)
    - [Max Concurrent Bookings](#tc-143-max-concurrent-bookings)
    - [Booking Advance](#tc-144-booking-advance-days)
    - [Minimum Notice](#tc-145-minimum-notice-hours)
    - [Allow Weekend Bookings](#tc-146-allow-weekend-bookings)
    - [Combined Configuration Tests](#tc-147-combined-configuration-tests)
    - [Configuration Persistence](#tc-148-configuration-persistence)

---

## 1. Prerequisites

### Test Account Requirements

| Role | Requirements |
|------|-------------|
| **Shop Owner** | Active subscription ($500/month), verified shop |
| **Customer** | Registered customer with wallet connected |
| **Admin** | Admin wallet address in ADMIN_ADDRESSES |

### Environment Setup

- [ ] Backend server running on port 4000
- [ ] Frontend running on port 3001
- [ ] Database connected
- [ ] Stripe webhook listening (for subscription verification)

---

## 2. Test Data Specifications

### Field Constraints Reference

| Field | Type | Required | Min | Max | Notes |
|-------|------|----------|-----|-----|-------|
| Service Name | string | Yes | 1 char | 255 chars | DB VARCHAR limit |
| Description | string | No | 0 | 200 chars | Frontend enforced |
| Price (USD) | number | Yes | 0.01 | 999,999,999.99 | 2 decimal places |
| Duration | number | No | 1 min | - | Integer minutes |
| Category | select | Yes | - | - | 12 predefined options |
| Image | file | No | - | 5 MB | JPEG, PNG, GIF, WebP |
| Tags | array | No | 0 | 5 items | Keywords for search |
| Active Status | boolean | No | - | - | Default: true |

### Valid Test Service Data

```
Name: iPhone Screen Repair
Description: Professional screen replacement for all iPhone models
Price: 99.99
Duration: 60
Category: repairs
Tags: iPhone, Screen, Apple, Repair
Active: true
```

### Categories List (12 options)

1. repairs
2. beauty_personal_care
3. health_wellness
4. fitness_gyms
5. automotive_services
6. home_cleaning_services
7. pets_animal_care
8. professional_services
9. education_classes
10. tech_it_services
11. food_beverage
12. other_local_services

---

## 3. Service Creation Tests

### TC-3.1: Create Service with All Valid Data

**Steps:**
1. Login as shop owner with active subscription
2. Navigate to Shop Dashboard > Services tab
3. Click "Create Service" or "+" button
4. Fill in all fields with valid data:
   - Service Name: "Test Service Alpha"
   - Description: "A comprehensive test service description"
   - Price: 49.99
   - Duration: 30 minutes
   - Category: "repairs"
   - Upload valid image (< 5MB)
   - Tags: "test", "service", "alpha"
   - Active: checked
5. Click "Create Service" / "Save"

**Expected Result:**
- [ ] Service created successfully
- [ ] Success toast notification displayed
- [ ] New service appears in service list
- [ ] All data matches input values

---

### TC-3.2: Create Service with Minimum Required Fields

**Steps:**
1. Login as shop owner
2. Navigate to Create Service modal
3. Fill only required fields:
   - Service Name: "Minimum Service"
   - Price: 1.00
   - Category: Select any category
4. Leave all optional fields empty
5. Click "Create Service"

**Expected Result:**
- [ ] Service created successfully
- [ ] Description shows empty/placeholder
- [ ] Duration shows as unset or default
- [ ] No image displayed (placeholder shown)
- [ ] No tags assigned

---

### TC-3.3: Service Name - Character Limits

| Test | Input | Expected |
|------|-------|----------|
| Empty name | "" | Error: "Service name is required" |
| 1 character | "A" | Should accept |
| 255 characters | "A" x 255 | Should accept (max DB limit) |
| 256 characters | "A" x 256 | Should truncate or reject |
| Special characters | "iPhone® Repair™ & More!" | Should accept |
| Unicode/Emoji | "Service 🔧 Repair" | Should accept |
| Leading/trailing spaces | "  Service  " | Should trim or accept |
| Only spaces | "   " | Error: Name required |

---

### TC-3.4: Description - Character Limits

| Test | Input | Expected |
|------|-------|----------|
| Empty | "" | Should accept (optional) |
| 1 character | "A" | Should accept |
| 200 characters | "A" x 200 | Should accept (max limit) |
| 201 characters | "A" x 201 | Should prevent typing or truncate |
| Character counter | Type text | Counter shows "X/200" |
| Multiline | "Line1\nLine2\nLine3" | Should preserve line breaks |
| HTML tags | "<script>alert(1)</script>" | Should escape/sanitize |

---

### TC-3.5: Price - Validation

| Test | Input | Expected |
|------|-------|----------|
| Empty | "" | Error: "Price is required" |
| Zero | 0 | Error: "Price must be greater than 0" |
| Negative | -10 | Error or prevent input |
| Minimum valid | 0.01 | Should accept |
| Normal price | 99.99 | Should accept |
| Large price | 9999999.99 | Should accept |
| Too many decimals | 10.999 | Should round to 10.99 or 11.00 |
| Non-numeric | "abc" | Should prevent input |
| Scientific notation | "1e5" | Should convert to 100000 or reject |

---

### TC-3.6: Duration - Validation

| Test | Input | Expected |
|------|-------|----------|
| Empty | "" | Should accept (optional) |
| Zero | 0 | Error: "Duration must be > 0" |
| Negative | -30 | Error or prevent input |
| Minimum valid | 1 | Should accept |
| Normal duration | 60 | Should accept |
| Very long | 480 (8 hours) | Should accept |
| Decimal | 30.5 | Should round or reject |

---

### TC-3.7: Category Selection

**Steps:**
1. Open Create Service modal
2. Click category dropdown
3. Verify all 12 categories listed
4. Select each category

**Expected Result:**
- [ ] All 12 categories displayed in dropdown
- [ ] Categories have readable display names (not raw keys)
- [ ] Selection persists after selecting
- [ ] Cannot submit without category selected

---

### TC-3.8: Tags - Validation

| Test | Input | Expected |
|------|-------|----------|
| No tags | [] | Should accept |
| 1 tag | ["repair"] | Should accept |
| 5 tags | ["a","b","c","d","e"] | Should accept (max limit) |
| 6 tags | Add 6th tag | Should prevent or show error |
| Duplicate tags | ["test", "test"] | Should prevent or dedupe |
| Long tag | "a" x 50 | Should accept or truncate |
| Special chars | ["tag-1", "tag_2"] | Should accept |
| Tag removal | Click X on tag | Tag should be removed |

---

### TC-3.9: Active Status Toggle

| Test | Action | Expected |
|------|--------|----------|
| Default state | Open modal | Toggle should be ON (active) |
| Toggle OFF | Click toggle | Status changes to inactive |
| Toggle ON | Click toggle again | Status changes to active |
| Create inactive | Create with toggle OFF | Service not visible in public marketplace |
| Create active | Create with toggle ON | Service visible in marketplace |

---

## 4. Service Editing Tests

### TC-4.1: Edit Existing Service

**Steps:**
1. Login as shop owner
2. Navigate to Services tab
3. Click edit icon on existing service
4. Modify service name, price, description
5. Click "Save Changes"

**Expected Result:**
- [ ] Edit modal opens with pre-filled data
- [ ] Changes save successfully
- [ ] Service list shows updated data
- [ ] `updated_at` timestamp updated

---

### TC-4.2: Edit Service - Image Replacement

**Steps:**
1. Open edit modal for service with existing image
2. Click "Remove" on current image
3. Upload new image
4. Save changes

**Expected Result:**
- [ ] Old image removed
- [ ] New image uploaded successfully
- [ ] Preview shows new image
- [ ] After save, new image displayed in list

---

### TC-4.3: Edit Service - Clear Optional Fields

**Steps:**
1. Open service with all fields filled
2. Clear description, duration, remove tags
3. Save changes

**Expected Result:**
- [ ] All cleared fields save as empty/null
- [ ] No validation errors for optional fields
- [ ] Service displays correctly without optional data

---

### TC-4.4: Edit Service - Validation on Update

**Test same validation rules as creation:**
- [ ] Cannot save empty service name
- [ ] Cannot save zero or negative price
- [ ] Description limit still enforced
- [ ] Tag limit still enforced

---

## 5. Service Deletion Tests

### TC-5.1: Delete Service (Soft Delete)

**Steps:**
1. Login as shop owner
2. Navigate to Services tab
3. Click delete icon on a service
4. Confirm deletion in dialog

**Expected Result:**
- [ ] Confirmation dialog appears
- [ ] Service removed from shop's list
- [ ] Service no longer visible in marketplace
- [ ] Data preserved in database (soft delete)

---

### TC-5.2: Delete Service - Cancel

**Steps:**
1. Click delete icon on a service
2. Click "Cancel" in confirmation dialog

**Expected Result:**
- [ ] Dialog closes
- [ ] Service NOT deleted
- [ ] Service still visible in list

---

### TC-5.3: Delete Service with Orders

**Steps:**
1. Create a service
2. Have customer place an order
3. Try to delete the service

**Expected Result:**
- [ ] Service can still be deleted (soft delete)
- [ ] Existing orders remain intact
- [ ] Order history shows service name

---

## 6. Image Upload Tests

### TC-6.1: Valid Image Upload

| Test | File | Expected |
|------|------|----------|
| JPEG | test.jpg (< 5MB) | Upload successful, preview shown |
| PNG | test.png (< 5MB) | Upload successful, preview shown |
| GIF | test.gif (< 5MB) | Upload successful, preview shown |
| WebP | test.webp (< 5MB) | Upload successful, preview shown |

---

### TC-6.2: Invalid File Type

| Test | File | Expected |
|------|------|----------|
| PDF | test.pdf | Error: "Invalid file type" |
| SVG | test.svg | Error: "Invalid file type" |
| BMP | test.bmp | Error: "Invalid file type" |
| Text | test.txt | Error: "Invalid file type" |
| Executable | test.exe | Error: "Invalid file type" |

---

### TC-6.3: File Size Validation

| Test | Size | Expected |
|------|------|----------|
| Small | 100 KB | Upload successful |
| Medium | 2 MB | Upload successful |
| At limit | 5 MB | Upload successful |
| Over limit | 5.1 MB | Error: "File size exceeds 5MB limit" |
| Very large | 20 MB | Error: "File size exceeds 5MB limit" |

---

### TC-6.4: Image Upload UX

**Steps:**
1. Click upload area or drag-drop image
2. Observe upload progress
3. After upload, verify preview

**Expected Result:**
- [ ] Loading indicator during upload
- [ ] Progress percentage shown (optional)
- [ ] Preview displays uploaded image
- [ ] Remove/replace button available
- [ ] Image URL stored correctly

---

### TC-6.5: Image Upload Error Handling

| Test | Scenario | Expected |
|------|----------|----------|
| Network error | Disable network mid-upload | Error message, retry option |
| Server error | Server returns 500 | Error message displayed |
| Timeout | Very slow connection | Timeout error or retry |

---

## 7. Service Listing & Display Tests

### TC-7.1: Service List View

**Steps:**
1. Login as shop owner
2. Navigate to Services tab
3. Observe service list

**Expected Result:**
- [ ] All shop's services displayed
- [ ] Service name visible
- [ ] Price displayed with $ symbol and 2 decimals
- [ ] Category displayed (human-readable)
- [ ] Status (active/inactive) visible
- [ ] Edit and delete buttons present
- [ ] Image thumbnail displayed (or placeholder)

---

### TC-7.2: Empty State

**Steps:**
1. Login as new shop with no services
2. Navigate to Services tab

**Expected Result:**
- [ ] Empty state message displayed
- [ ] "Create your first service" CTA shown
- [ ] No broken UI elements

---

### TC-7.3: Service List Pagination

**Steps:**
1. Create 25+ services
2. Navigate to Services tab
3. Scroll or paginate

**Expected Result:**
- [ ] Pagination controls visible (if > 20 services)
- [ ] Load more or page numbers work
- [ ] All services accessible

---

### TC-7.4: Service Card Information Display

**Verify each card shows:**
- [ ] Service image (or placeholder)
- [ ] Service name (truncated if too long)
- [ ] Price (formatted as $XX.XX)
- [ ] Category badge/label
- [ ] Duration (if set)
- [ ] Rating (if reviews exist)
- [ ] RCN earning potential badge

---

## 8. Service Search & Filter Tests

### TC-8.1: Search by Service Name

| Test | Search Term | Expected |
|------|-------------|----------|
| Exact match | "iPhone Screen Repair" | Service found |
| Partial match | "iPhone" | All iPhone services |
| Case insensitive | "iphone" | Same as "iPhone" |
| No results | "xyznonexistent" | Empty results message |
| Special chars | "repair & fix" | Matches if exists |

---

### TC-8.2: Filter by Category

**Steps:**
1. Open marketplace with multiple categories
2. Select category filter
3. Observe results

**Expected Result:**
- [ ] Only services in selected category shown
- [ ] Filter persists across pagination
- [ ] Clear filter shows all services
- [ ] Multiple category filters (if supported)

---

### TC-8.3: Filter by Price Range

| Test | Min | Max | Expected |
|------|-----|-----|----------|
| Min only | 50 | - | Services >= $50 |
| Max only | - | 100 | Services <= $100 |
| Range | 50 | 100 | Services $50-$100 |
| Invalid range | 100 | 50 | Error or no results |

---

### TC-8.4: Combined Filters

**Steps:**
1. Apply category filter: "repairs"
2. Apply price filter: $50-$200
3. Enter search: "screen"

**Expected Result:**
- [ ] Results match ALL criteria
- [ ] Filter indicators shown
- [ ] Clear all filters option

---

## 9. Service Details Modal Tests

### TC-9.1: Open Service Details

**Steps:**
1. Click on a service card
2. Observe details modal

**Expected Result:**
- [ ] Modal opens smoothly
- [ ] Full service name displayed
- [ ] Full description shown
- [ ] Large image displayed
- [ ] Price prominently shown
- [ ] Duration shown (if set)
- [ ] Category shown
- [ ] Tags displayed
- [ ] Shop information visible
- [ ] Book/Order button present

---

### TC-9.2: Service Details - Reviews Tab

**Steps:**
1. Open service details modal
2. Click "Reviews" tab

**Expected Result:**
- [ ] Reviews list displayed
- [ ] Average rating shown
- [ ] Individual review cards with:
  - Star rating
  - Customer name
  - Review text
  - Date
  - Shop response (if any)
- [ ] Pagination for many reviews

---

### TC-9.3: Service Details - Close Modal

| Test | Action | Expected |
|------|--------|----------|
| X button | Click X | Modal closes |
| Backdrop click | Click outside modal | Modal closes |
| Escape key | Press ESC | Modal closes |

---

## 10. Customer Marketplace Tests

### TC-10.1: Browse Marketplace as Customer

**Steps:**
1. Login as customer
2. Navigate to Marketplace tab
3. Browse services

**Expected Result:**
- [ ] Only active services shown
- [ ] Multiple shop services displayed
- [ ] Service cards show all key info
- [ ] Search and filters work
- [ ] Can click to view details

---

### TC-10.2: Add Service to Favorites

**Steps:**
1. Login as customer
2. Find a service
3. Click heart/favorite icon

**Expected Result:**
- [ ] Heart icon fills/changes color
- [ ] Toast: "Added to favorites"
- [ ] Service appears in Favorites view
- [ ] Click again removes from favorites

---

### TC-10.3: Book a Service

**Steps:**
1. Login as customer
2. Open service details
3. Click "Book Now"
4. Select date/time
5. Complete payment

**Expected Result:**
- [ ] Date picker shows available slots
- [ ] Time slots based on shop availability
- [ ] RCN discount applied if balance available
- [ ] Checkout modal opens
- [ ] Payment processes successfully
- [ ] Confirmation shown

---

### TC-10.4: Share Service

**Steps:**
1. Open service details
2. Click share button
3. Test each share option

**Expected Result:**
- [ ] Share dropdown appears
- [ ] WhatsApp share works (opens WhatsApp)
- [ ] Twitter share works
- [ ] Facebook share works
- [ ] Copy link copies URL to clipboard
- [ ] Toast: "Link copied!"

---

## 11. Authorization & Access Control Tests

### TC-11.1: Unauthorized Service Creation

| Test | User | Expected |
|------|------|----------|
| Not logged in | Guest | Redirect to login |
| Customer role | Customer | No "Create Service" option |
| Shop without subscription | Shop | Error: "Subscription required" |
| Unverified shop | Shop | Error: "Shop must be verified" |

---

### TC-11.2: Edit Other Shop's Service

**Steps:**
1. Login as Shop A
2. Try to access edit URL for Shop B's service

**Expected Result:**
- [ ] Error: "Unauthorized"
- [ ] Redirect to own services
- [ ] Cannot modify other shop's data

---

### TC-11.3: Delete Other Shop's Service

**Steps:**
1. Login as Shop A
2. Call DELETE API for Shop B's service

**Expected Result:**
- [ ] 403 Forbidden response
- [ ] Service NOT deleted
- [ ] Error logged

---

## 12. Edge Cases & Boundary Tests

### TC-12.1: Maximum Services per Shop

**Steps:**
1. Create many services (50+)
2. Check performance and limits

**Expected Result:**
- [ ] No explicit limit enforced
- [ ] Performance acceptable
- [ ] Pagination works correctly

---

### TC-12.2: Special Characters in All Fields

| Field | Input | Expected |
|-------|-------|----------|
| Name | `Test <script>` | Escaped, not executed |
| Description | `"Quotes" & <tags>` | Properly escaped |
| Tags | `tag'with"quotes` | Accepted and escaped |

---

### TC-12.3: Concurrent Editing

**Steps:**
1. Open service in two browser tabs
2. Edit different fields in each tab
3. Save both

**Expected Result:**
- [ ] Last save wins (or conflict resolution)
- [ ] No data corruption
- [ ] No server error

---

### TC-12.4: Rapid Actions

| Test | Action | Expected |
|------|--------|----------|
| Double click save | Click save twice quickly | Only one service created |
| Rapid delete | Click delete multiple times | Only one deletion |
| Spam create | Create button pressed repeatedly | Rate limiting or single creation |

---

### TC-12.5: Network Interruption

**Steps:**
1. Start creating service
2. Disable network before submit
3. Click save

**Expected Result:**
- [ ] Error message: "Network error"
- [ ] Form data preserved
- [ ] Can retry when network restored

---

## 13. Mobile Responsiveness Tests

### TC-13.1: Service List on Mobile

**Test on viewport: 375px (iPhone SE)**

- [ ] Service cards stack vertically
- [ ] All information readable
- [ ] Touch targets >= 44px
- [ ] Scrolling smooth
- [ ] No horizontal overflow

---

### TC-13.2: Create Service Modal on Mobile

**Test on viewport: 375px**

- [ ] Modal fits screen
- [ ] All form fields accessible
- [ ] Keyboard doesn't obscure inputs
- [ ] Save button always visible
- [ ] Can scroll within modal

---

### TC-13.3: Image Upload on Mobile

- [ ] Camera option available (if supported)
- [ ] Gallery picker works
- [ ] Upload progress visible
- [ ] Preview displays correctly

---

### TC-13.4: Tablet Responsiveness

**Test on viewport: 768px (iPad)**

- [ ] 2-column layout for service cards
- [ ] Modal width appropriate
- [ ] No wasted space
- [ ] Touch interactions work

---

## 14. Time Slot Configuration Tests

### Overview

The Time Slot Configuration settings control how customers can book appointments. These settings are found in:
- **Shop Dashboard** → **Services** → Click a service → **Availability** tab

**Settings to test:**
1. Service Duration (minutes)
2. Buffer Time (minutes)
3. Max Concurrent Bookings
4. Booking Advance (days)
5. Minimum Notice (hours)
6. Allow Weekend Bookings

---

### TC-14.1: Service Duration (minutes)

**What it does:** Sets how long the service appointment takes. This determines the length of each time slot and when the appointment ends.

**Location:** Service Availability tab → "Service Duration" section (top)

**Setup:**
1. Login as shop owner
2. Navigate to Services → Click a service → Availability tab
3. Set operating hours: 09:00 - 17:00
4. Set Buffer Time to 0 (to isolate duration testing)

---

#### TC-14.1.1: Service Duration = 60 minutes (Default)

**Steps:**
1. Set Duration to `60` minutes
2. Click "Save"
3. Login as customer
4. Browse to the service and click "Book Now"
5. Select any available date
6. Observe time slots

**Expected Result:**
- [ ] Time slots appear at 60-minute intervals: 09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00
- [ ] 8 slots available (8 hours ÷ 1 hour)
- [ ] Each slot shows end time as start + 60 min (e.g., "09:00 - 10:00")
- [ ] Last slot at 16:00 ends at 17:00 (closing time)

---

#### TC-14.1.2: Service Duration = 30 minutes

**Steps:**
1. Set Duration to `30` minutes
2. Save
3. As customer, view available time slots

**Expected Result:**
- [ ] Time slots appear at 30-minute intervals
- [ ] Slots: 09:00, 09:30, 10:00, 10:30, 11:00, 11:30, 12:00, 12:30, 13:00, 13:30, 14:00, 14:30, 15:00, 15:30, 16:00, 16:30
- [ ] 16 slots available (8 hours ÷ 0.5 hours)
- [ ] Last slot at 16:30 ends at 17:00

---

#### TC-14.1.3: Service Duration = 90 minutes

**Steps:**
1. Set Duration to `90` minutes
2. Save
3. As customer, view available time slots

**Expected Result:**
- [ ] Time slots appear at 90-minute intervals
- [ ] Slots: 09:00, 10:30, 12:00, 13:30, 15:00
- [ ] 5 slots available
- [ ] Last slot at 15:00 ends at 16:30 (within operating hours)
- [ ] No 16:30 slot (16:30 + 90 min = 18:00 > 17:00 closing)

---

#### TC-14.1.4: Service Duration = 15 minutes (Short service)

**Steps:**
1. Set Duration to `15` minutes
2. Save
3. As customer, view available time slots

**Expected Result:**
- [ ] Time slots appear at 15-minute intervals
- [ ] Slots: 09:00, 09:15, 09:30, 09:45, 10:00, ... 16:45
- [ ] 32 slots available (8 hours × 4 slots/hour)
- [ ] Many slots may make UI crowded (verify scrolling works)

---

#### TC-14.1.5: Service Duration = 240 minutes (4 hours - Long service)

**Steps:**
1. Set Duration to `240` minutes (4 hours)
2. Save
3. As customer, view available time slots

**Expected Result:**
- [ ] Time slots appear at 4-hour intervals
- [ ] Slots: 09:00, 13:00
- [ ] Only 2 slots available
- [ ] 09:00 ends at 13:00, 13:00 ends at 17:00
- [ ] No 17:00 slot (would exceed operating hours)

---

#### TC-14.1.6: Service Duration Interaction with Operating Hours

**Scenario:** Operating hours 09:00 - 12:00 (3 hours), Duration = 120 minutes

**Steps:**
1. Set operating hours to 09:00 - 12:00
2. Set Duration to `120` minutes (2 hours)
3. As customer, view slots

**Expected Result:**
- [ ] Only 1 slot available: 09:00 (ends at 11:00)
- [ ] No 10:00 slot (10:00 + 120 min = 12:00, but need full duration within hours)
- [ ] Actually 10:00 should work if it ends exactly at 12:00 - verify behavior

---

#### TC-14.1.7: Service Duration Edge Cases

| Test | Duration Value | Expected |
|------|----------------|----------|
| Minimum | 15 | Should accept (minimum practical duration) |
| Zero | 0 | Should reject or show error |
| Negative | -30 | Should reject or prevent input |
| Very short | 5 | May accept but impractical |
| Very long | 480 (8 hours) | Should accept, may result in 1 slot |
| Longer than operating hours | 600 (10 hours) | Should accept but 0 slots available |
| Non-increment | 17 | Should accept (any minute value) |
| Empty | "" | Should show error or use default |

---

#### TC-14.1.8: Service Duration Display in Booking

**Steps:**
1. Set Duration to `45` minutes
2. As customer, view booking modal
3. Select a time slot

**Expected Result:**
- [ ] Time slot shows duration: "09:00 - 09:45 (45 min)"
- [ ] Service details show duration information
- [ ] Confirmation shows appointment length
- [ ] Calendar/appointment view shows correct end time

---

#### TC-14.1.9: Service Duration vs Shop Default

**Context:** Each service can have its own duration that overrides the shop's default slot duration.

**Steps:**
1. Set shop's default time slot duration to 60 minutes (in Time Slot Config)
2. For Service A, set custom duration to 30 minutes
3. For Service B, leave duration empty (should use shop default)
4. As customer, compare slots for Service A vs Service B

**Expected Result:**
- [ ] Service A shows 30-minute slots
- [ ] Service B shows 60-minute slots (shop default)
- [ ] Custom duration overrides shop default
- [ ] Service card may show duration badge

---

### TC-14.2: Buffer Time (minutes)

**What it does:** Adds time between consecutive appointment slots for preparation/cleanup.

**Setup:**
1. Login as shop owner
2. Navigate to a service's Availability tab
3. Set service duration to 60 minutes
4. Set operating hours: 09:00 - 17:00

---

#### TC-14.2.1: Buffer Time = 0 minutes

**Steps:**
1. Set Buffer Time to `0`
2. Save Configuration
3. Login as customer
4. Browse to the service and click "Book Now"
5. Select any available date
6. Observe time slots

**Expected Result:**
- [ ] Time slots appear at exact duration intervals: 09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00
- [ ] No gap between slots
- [ ] 8 slots available (8 hours ÷ 1 hour)

---

#### TC-14.2.2: Buffer Time = 15 minutes

**Steps:**
1. Set Buffer Time to `15`
2. Save Configuration
3. As customer, view available time slots

**Expected Result:**
- [ ] Time slots appear at 75-minute intervals (60 min + 15 min buffer)
- [ ] Slots: 09:00, 10:15, 11:30, 12:45, 14:00, 15:15
- [ ] Last slot starts at 15:15 (ends at 16:15, fits before 17:00)
- [ ] 6 slots available

**Visual verification:**
```
09:00 - 10:00 (service) + 10:00 - 10:15 (buffer)
10:15 - 11:15 (service) + 11:15 - 11:30 (buffer)
11:30 - 12:30 (service) + 12:30 - 12:45 (buffer)
12:45 - 13:45 (service) + 13:45 - 14:00 (buffer)
14:00 - 15:00 (service) + 15:00 - 15:15 (buffer)
15:15 - 16:15 (service) + 16:15 - 16:30 (buffer) - BUT 16:30 > 16:00 end cutoff
Actually: 15:15 - 16:15 ends at 16:15 which is valid if close is 17:00
16:30 would start but 16:30 + 60 = 17:30 > 17:00, so no 16:30 slot
```

---

#### TC-14.2.3: Buffer Time = 30 minutes

**Steps:**
1. Set Buffer Time to `30`
2. Save Configuration
3. As customer, view available time slots

**Expected Result:**
- [ ] Time slots appear at 90-minute intervals (60 min + 30 min buffer)
- [ ] Slots: 09:00, 10:30, 12:00, 13:30, 15:00
- [ ] 5 slots available
- [ ] No slot after 15:00 (15:00 + 60 min = 16:00, + 30 buffer = 16:30, next would be 16:30 + 60 = 17:30 > 17:00)

---

#### TC-14.2.4: Buffer Time Edge Cases

| Test | Buffer Value | Expected |
|------|--------------|----------|
| Zero | 0 | Accepted, no buffer applied |
| Negative | -5 | Should reject or convert to 0 |
| Very large | 120 | Accepted, but may result in very few slots |
| Non-integer | 7.5 | Should round or reject |
| Empty | "" | Should default to 0 or show error |

---

### TC-14.3: Max Concurrent Bookings

**What it does:** Controls how many customers can book the same time slot.

**Setup:**
1. Set service duration to 60 minutes
2. Set Buffer Time to 0
3. Set operating hours: 09:00 - 12:00 (3 slots: 09:00, 10:00, 11:00)

---

#### TC-14.3.1: Max Concurrent = 1 (Default)

**Steps:**
1. Set Max Concurrent Bookings to `1`
2. Save Configuration
3. As Customer A, book the 09:00 slot
4. As Customer B, try to book the same 09:00 slot

**Expected Result:**
- [ ] Customer A books 09:00 successfully
- [ ] For Customer B, 09:00 slot shows as "Unavailable" or grayed out
- [ ] Customer B can still book 10:00 or 11:00
- [ ] Slot availability indicator shows "0/1 available" or similar

---

#### TC-14.3.2: Max Concurrent = 3

**Steps:**
1. Set Max Concurrent Bookings to `3`
2. Save Configuration
3. As Customer A, book 09:00
4. As Customer B, book 09:00
5. As Customer C, book 09:00
6. As Customer D, try to book 09:00

**Expected Result:**
- [ ] Customers A, B, C all book 09:00 successfully
- [ ] After 3 bookings, 09:00 shows as full/unavailable
- [ ] Customer D cannot book 09:00
- [ ] Availability shows "0/3 available" or "Fully booked"

---

#### TC-14.3.3: Max Concurrent Bookings Display

**Steps:**
1. Set Max Concurrent Bookings to `2`
2. Have Customer A book 09:00
3. As Customer B, view available slots

**Expected Result:**
- [ ] 09:00 slot shows partial availability (1/2 booked)
- [ ] Visual indicator shows slot is available but partially filled
- [ ] Customer B can still book 09:00

---

#### TC-14.3.4: Max Concurrent Edge Cases

| Test | Value | Expected |
|------|-------|----------|
| Zero | 0 | Should reject (must be >= 1) |
| Negative | -1 | Should reject |
| One | 1 | Default behavior, one booking per slot |
| Large | 50 | Accepted, 50 concurrent allowed |
| Empty | "" | Should default to 1 or show error |

---

### TC-14.4: Booking Advance (days)

**What it does:** Controls how far into the future customers can book appointments.

**Setup:**
1. Note today's date (e.g., December 17, 2024)
2. Set service with availability for all days

---

#### TC-14.4.1: Booking Advance = 7 days

**Steps:**
1. Set Booking Advance to `7`
2. Save Configuration
3. As customer, open date picker for booking

**Expected Result:**
- [ ] Dates from today to +7 days are selectable
- [ ] Today: December 17 ✓
- [ ] December 24 (7 days later) ✓
- [ ] December 25 (8 days later) ✗ (disabled/not shown)
- [ ] Dates beyond 7 days grayed out or not displayed

---

#### TC-14.4.2: Booking Advance = 30 days

**Steps:**
1. Set Booking Advance to `30`
2. Save Configuration
3. As customer, navigate date picker to ~30 days ahead

**Expected Result:**
- [ ] Can select dates up to 30 days in the future
- [ ] January 16 (30 days from Dec 17) ✓
- [ ] January 17 (31 days) ✗

---

#### TC-14.4.3: Booking Advance = 1 day

**Steps:**
1. Set Booking Advance to `1`
2. Save Configuration
3. As customer, view date picker

**Expected Result:**
- [ ] Only today and tomorrow are bookable
- [ ] Day after tomorrow is disabled
- [ ] Very limited booking window

---

#### TC-14.4.4: Booking Advance Edge Cases

| Test | Value | Expected |
|------|-------|----------|
| Zero | 0 | Should reject or mean "no advance booking" (only same-day) |
| One | 1 | Only today/tomorrow bookable |
| Large | 365 | Accepted, can book up to 1 year ahead |
| Very large | 999 | May accept or cap at reasonable maximum |
| Negative | -7 | Should reject |

---

### TC-14.5: Minimum Notice (hours)

**What it does:** Prevents last-minute bookings by requiring minimum hours before appointment.

**Setup:**
1. Set operating hours: 09:00 - 17:00
2. Assume current time is 10:00 AM

---

#### TC-14.5.1: Minimum Notice = 2 hours

**Steps:**
1. Set Minimum Notice to `2`
2. Save Configuration
3. Current time: 10:00 AM
4. As customer, try to book same-day slots

**Expected Result:**
- [ ] Slots before 12:00 PM are unavailable (less than 2 hours notice)
- [ ] 09:00, 10:00, 11:00 slots ✗ (too soon)
- [ ] 12:00 PM slot ✓ (exactly 2 hours from now)
- [ ] 13:00, 14:00, etc. ✓ (more than 2 hours notice)

---

#### TC-14.5.2: Minimum Notice = 24 hours

**Steps:**
1. Set Minimum Notice to `24`
2. Save Configuration
3. As customer, try to book for today and tomorrow

**Expected Result:**
- [ ] All of today's slots are unavailable (< 24 hours)
- [ ] Tomorrow's slots starting from current time + 24 hours are available
- [ ] If now is 10:00 AM Monday, first available slot is 10:00 AM Tuesday

---

#### TC-14.5.3: Minimum Notice = 0 hours

**Steps:**
1. Set Minimum Notice to `0`
2. Save Configuration
3. As customer, book a slot happening in 30 minutes

**Expected Result:**
- [ ] Can book slots for any time today (even very soon)
- [ ] Only past time slots are unavailable
- [ ] 09:00 unavailable if current time is 10:00 (already passed)
- [ ] 10:30 available if current time is 10:00

---

#### TC-14.5.4: Minimum Notice Interaction with Time Slots

**Scenario:** Current time is 10:30 AM, Minimum Notice = 1 hour

**Steps:**
1. View available slots for today

**Expected Result:**
- [ ] 10:00 slot: ✗ (already started/passed)
- [ ] 11:00 slot: ✗ (only 30 min notice, need 1 hour)
- [ ] 11:30 slot: ✓ (exactly 1 hour from now)
- [ ] 12:00+ slots: ✓ (more than 1 hour notice)

---

#### TC-14.5.5: Minimum Notice Edge Cases

| Test | Value | Expected |
|------|-------|----------|
| Zero | 0 | Accepted, immediate booking allowed |
| Small | 1 | 1 hour minimum notice |
| Medium | 4 | 4 hours notice required |
| Large | 48 | Must book 2+ days in advance |
| Very large | 168 | Must book 1 week in advance |
| Negative | -2 | Should reject |

---

### TC-14.6: Allow Weekend Bookings

**What it does:** Master switch to enable/disable Saturday and Sunday appointments.

**Important:** This setting overrides Shop Operating Hours for weekends.

---

#### TC-14.6.1: Weekend Bookings Disabled

**Steps:**
1. Uncheck "Allow weekend bookings (Saturday & Sunday)"
2. Save Configuration
3. In Shop Operating Hours, mark Saturday and Sunday as "Open"
4. Save Operating Hours
5. As customer, try to select a Saturday or Sunday date

**Expected Result:**
- [ ] Saturday dates are disabled/unselectable
- [ ] Sunday dates are disabled/unselectable
- [ ] No time slots appear for weekend dates
- [ ] Weekday dates work normally
- [ ] ⚠️ Despite Operating Hours showing "Open", weekends are blocked

---

#### TC-14.6.2: Weekend Bookings Enabled

**Steps:**
1. Check "Allow weekend bookings (Saturday & Sunday)"
2. Save Configuration
3. Mark Saturday as "Open" in Operating Hours
4. Mark Sunday as "Closed" in Operating Hours
5. As customer, view weekend dates

**Expected Result:**
- [ ] Saturday: Available (weekend allowed + Operating Hours Open)
- [ ] Sunday: Unavailable (weekend allowed BUT Operating Hours Closed)
- [ ] Weekend setting is a prerequisite, but Operating Hours still applies

---

#### TC-14.6.3: Weekend Bookings Logic Table

| Allow Weekend | Sat Operating Hours | Result |
|---------------|---------------------|--------|
| ❌ Disabled | Open | **No slots** (blocked by master switch) |
| ❌ Disabled | Closed | **No slots** |
| ✅ Enabled | Open | **Slots available** |
| ✅ Enabled | Closed | **No slots** (blocked by Operating Hours) |

---

#### TC-14.6.4: UX Verification for Weekend Settings

**Steps:**
1. Uncheck "Allow weekend bookings"
2. Scroll to Shop Operating Hours section
3. Observe Saturday and Sunday rows

**Expected UX (Enhancement):**
- [ ] Saturday/Sunday rows should be visually dimmed or show warning
- [ ] Warning: "Weekend bookings disabled above"
- [ ] Clear indication that these days are blocked regardless of "Open" status

**Current UX (Potential Issue):**
- [ ] No visual indication that Saturday/Sunday are blocked
- [ ] Shop owner may think weekends are available when they're not

---

### TC-14.7: Combined Configuration Tests

#### TC-14.7.1: All Settings Combined

**Setup:**
- Duration: 60 minutes
- Buffer Time: 15 minutes
- Max Concurrent: 2
- Booking Advance: 14 days
- Minimum Notice: 4 hours
- Allow Weekends: Yes
- Operating Hours: Mon-Sat 09:00-17:00, Sun Closed

**Test:**
1. Current: Monday 10:00 AM
2. Book for Saturday at 11:00

**Expected:**
- [ ] Saturday date is selectable (weekends enabled, Operating Hours Open)
- [ ] Slots appear at 75-min intervals: 09:00, 10:15, 11:30, 12:45, 14:00, 15:15
- [ ] All slots show "0/2 booked"
- [ ] Date must be within 14 days

---

#### TC-14.7.2: Restrictive Configuration

**Setup:**
- Buffer Time: 60 minutes (1 hour!)
- Max Concurrent: 1
- Booking Advance: 3 days
- Minimum Notice: 24 hours
- Allow Weekends: No

**Test:**
1. Verify very limited availability

**Expected:**
- [ ] Only 3 days visible in date picker
- [ ] No same-day bookings (24-hour notice)
- [ ] Very few slots per day (1-hour service + 1-hour buffer = 2-hour intervals)
- [ ] No weekend dates available

---

### TC-14.8: Configuration Persistence

#### TC-14.8.1: Save and Reload

**Steps:**
1. Set all configuration values
2. Click "Save Configuration"
3. Navigate away from page
4. Return to Availability tab

**Expected:**
- [ ] All values persist after page reload
- [ ] No data loss
- [ ] Toast shows "Configuration saved successfully"

---

#### TC-14.8.2: Cancel Without Saving

**Steps:**
1. Modify configuration values
2. Navigate away WITHOUT clicking Save

**Expected:**
- [ ] Changes are NOT saved
- [ ] Original values remain
- [ ] (Optional) Warning: "Unsaved changes will be lost"

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Clear browser cache
- [ ] Reset test database (optional)
- [ ] Verify test accounts exist
- [ ] Confirm backend running

### Test Completion
- [ ] All critical tests passed
- [ ] Bugs logged with:
  - Steps to reproduce
  - Expected vs actual
  - Screenshots/videos
  - Browser/device info

### Test Report
- [ ] Total tests: ___
- [ ] Passed: ___
- [ ] Failed: ___
- [ ] Blocked: ___
- [ ] Test date: ___
- [ ] Tester: ___

---

## Appendix: Test Image Files

Create these test files for image testing:

| File | Size | Type |
|------|------|------|
| valid-small.jpg | 100 KB | JPEG |
| valid-medium.png | 2 MB | PNG |
| valid-limit.jpg | 5 MB | JPEG |
| invalid-large.jpg | 6 MB | JPEG |
| invalid-type.pdf | 1 MB | PDF |
| invalid-type.svg | 50 KB | SVG |

---

**End of Test Cases Document**
