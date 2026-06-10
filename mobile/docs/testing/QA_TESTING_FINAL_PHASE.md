# QA Testing Guide - Final Phase

**App Name:** FixFlow
**Platforms:** iOS & Android (React Native / Expo)
**Last Updated:** June 10, 2026

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Test Area 1: Appointment Scheduling - Shop Setup](#2-test-area-1-appointment-scheduling---shop-setup)
3. [Test Area 2: Appointment Scheduling - Customer Booking](#3-test-area-2-appointment-scheduling---customer-booking)
4. [Test Area 3: Notifications](#4-test-area-3-notifications)
5. [Test Area 4: Reviews & Ratings](#5-test-area-4-reviews--ratings)
6. [Test Area 5: Referral System](#6-test-area-5-referral-system)
7. [Test Area 6: Customer Tier System](#7-test-area-6-customer-tier-system)
8. [Test Area 7: Messaging](#8-test-area-7-messaging)
9. [Test Area 8: Shop Moderation](#9-test-area-8-shop-moderation)
10. [Test Area 9: Profile Management](#10-test-area-9-profile-management)
11. [Test Area 10: Analytics Dashboards](#11-test-area-10-analytics-dashboards)
12. [Test Area 11: No-Show Policy & Promo Codes](#12-test-area-11-no-show-policy--promo-codes)
13. [Test Area 12: End-to-End Full Flow](#13-test-area-12-end-to-end-full-flow)
14. [Known Issues & Limitations](#14-known-issues--limitations)

---

## 1. Prerequisites

### Environment Setup

- Install FixFlow app on a test device (iOS or Android) via the provided build
- The backend is live on the **staging server** — no local setup required
- Have access to the **admin web dashboard** (staging)
- Prepare the following test accounts:
  - 1 active **customer** account with some RCN balance
  - 1 active **shop** account (approved, verified, with active subscription and at least 1 service)
  - 1 additional **customer** account (for referral and messaging tests)
  - Push notifications **enabled** on both test devices

### Notes
- Final Phase covers advanced features — all Phase 1 and Phase 2 features should be verified first
- Some tests require two devices (one for customer, one for shop) to verify real-time behavior

---

## 2. Test Area 1: Appointment Scheduling - Shop Setup

### Precondition
- Logged in as a **shop** with an active subscription

### Flow
1. Login as shop
2. Navigate to **Availability** settings
3. Configure operating hours, slot duration, buffer time, and max concurrent bookings
4. Set holiday closures or special override dates

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| AS-01 | Set operating hours | Configure open/close times for each day of the week | Hours saved and reflected in customer booking availability | High |
| AS-02 | Set closed days | Mark specific days as closed (e.g., Sunday) | Those days not selectable by customers when booking | High |
| AS-03 | Set slot duration | Set slot duration to 30 minutes | Booking time slots appear in 30-minute intervals for customers | High |
| AS-04 | Set buffer time | Set buffer time between bookings (e.g., 15 mins) | 15-minute gap enforced between bookable slots | Medium |
| AS-05 | Set max concurrent bookings | Set max concurrent bookings to 2 | Only 2 bookings allowed at the same time slot | Medium |
| AS-06 | Set break times | Add a lunch break (e.g., 12:00–13:00) | Time slots within break period not available to customers | Medium |
| AS-07 | Add holiday override | Mark a specific date as closed (holiday) | That date appears unavailable in customer date picker | High |
| AS-08 | Add special hours override | Set different hours for a specific date | Customer sees adjusted availability for that date | Medium |
| AS-09 | Save and reload settings | Save availability settings, close and reopen app | Settings persisted correctly | High |
| AS-10 | Remove holiday override | Delete a previously added holiday | Date becomes bookable again | Medium |

---

## 3. Test Area 2: Appointment Scheduling - Customer Booking

### Precondition
- A shop has configured availability settings (Test Area 1 completed)
- Logged in as a **customer**

### Flow
1. Login as customer
2. Open a service with scheduling enabled
3. Select a date from the date picker
4. Select an available time slot
5. Proceed to confirmation/payment

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| AB-01 | Date picker shows correct available dates | Open booking flow for a service | Only dates within shop's operating hours are shown as available | High |
| AB-02 | Time slots reflect shop schedule | Select an available date | Time slots shown match the shop's configured slot duration and hours | High |
| AB-03 | Unavailable slots are greyed out | View time slots on a busy date | Fully booked or buffered slots appear greyed out / unselectable | High |
| AB-04 | Holiday dates blocked | Try to select a date marked as holiday | Date not selectable | High |
| AB-05 | Book successfully | Select date, select time, confirm | Booking created, confirmation shown with all details | High |
| AB-06 | RCN discount during booking | Apply RCN balance as discount during booking | Price reduced, RCN deducted on confirmation | High |
| AB-07 | Booking appears in history | After booking, check history tab | New booking visible with service, shop, date, time, status | High |
| AB-08 | View upcoming appointment | After booking, check home or bookings | Upcoming appointment card visible | Medium |
| AB-09 | Reschedule request | Customer requests to reschedule an existing booking | Reschedule request sent to shop for approval | Medium |
| AB-10 | Cancel booking before appointment | Customer cancels before appointment date | Booking cancelled, customer notified | High |

---

## 4. Test Area 3: Notifications

### Precondition
- Push notifications enabled on the test device
- Logged in as both a customer and shop (on separate devices or accounts)

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| NT-01 | New booking notification (shop) | Customer books a service | Shop receives push notification: "New booking from [customer name]" | High |
| NT-02 | Booking completed notification (customer) | Shop marks booking as complete | Customer receives push notification: "Your booking was marked complete" | High |
| NT-03 | Booking cancelled notification | Either party cancels a booking | Other party receives cancellation push notification | High |
| NT-04 | RCN reward notification (customer) | Shop issues RCN reward to customer | Customer receives push notification: "You earned X RCN" | High |
| NT-05 | Redemption notification | Customer redeems RCN | Relevant party receives notification | Medium |
| NT-06 | New message notification | Shop or customer sends a message | Recipient receives push notification | High |
| NT-07 | Suspension notification | Admin suspends a customer or shop | Suspended party receives notification about suspension | High |
| NT-08 | Notification bell count | Multiple unread notifications exist | Bell icon shows correct unread badge count | High |
| NT-09 | Mark notification as read | Tap on a notification | Notification marked as read, badge count decreases | Medium |
| NT-10 | Notification list | Open notifications screen | All notifications listed in reverse chronological order | Medium |
| NT-11 | Notification preferences | Navigate to notification preferences | Toggles for each notification type are functional | Medium |
| NT-12 | Disable notification type | Turn off "New booking" notifications in preferences | Shop no longer receives push for new bookings | Medium |
| NT-13 | Tap notification — deep link | Tap a notification about a specific booking | App navigates directly to that booking's detail screen | High |
| NT-14 | Notifications persist after app restart | Receive notification, close app, reopen | Notification still visible in notification list | Medium |

---

## 5. Test Area 4: Reviews & Ratings

### Precondition
- A booking with status **completed** exists for the customer
- Logged in as **customer** for submitting reviews
- Logged in as **shop** for responding to reviews

### Flow (Customer)
1. Login as customer
2. After booking is marked complete, navigate to that booking
3. Tap **Leave a Review**
4. Select star rating and write a comment
5. Submit

### Flow (Shop)
1. Login as shop
2. Navigate to Services → select service → Reviews tab
3. View customer reviews and optionally respond

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| RV-01 | Submit review after completed booking | Navigate to completed booking, leave a review with 5 stars and comment | Review submitted and visible on service detail page | High |
| RV-02 | Review with rating only (no comment) | Submit review with stars but no comment text | Review accepted — comment is optional | Medium |
| RV-03 | Review with comment only | Submit review without selecting a star rating | Validation error — rating is required | Medium |
| RV-04 | Cannot review pending booking | Try to review a booking that is not yet completed | Review option not available for non-completed bookings | High |
| RV-05 | Cannot submit duplicate review | Submit review, then try to review the same booking again | Error or option not shown — one review per booking | High |
| RV-06 | Review visible on service page | After submitting, open service detail | Review appears with rating, comment, reviewer name, and date | High |
| RV-07 | Average rating updates | Submit multiple reviews with different ratings | Service average rating recalculates correctly | Medium |
| RV-08 | Shop views reviews | Login as shop, navigate to service reviews tab | All reviews visible with star ratings, comments, and customer names | High |
| RV-09 | Shop responds to review | Shop types and submits a response to a review | Response appears below the review on the service detail page | Medium |
| RV-10 | Flag inappropriate review | Customer or shop flags a review | Report sent to admin for review | Low |
| RV-11 | Paginate through reviews | Service with many reviews | Reviews load in pages with load more / infinite scroll | Low |

---

## 6. Test Area 5: Referral System

### Precondition
- Logged in as a **customer** (referrer)
- A fresh wallet/account available for referral signup (referee)

### Referral Rules
- **Referrer receives**: 25 RCN when referred user completes registration
- **Referee receives**: 10 RCN bonus on registration

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| RF-01 | View referral code | Navigate to referral section | Unique referral code displayed | High |
| RF-02 | Share referral code | Tap share button on referral screen | Share options shown (copy, WhatsApp, etc.) | Medium |
| RF-03 | New user registers with referral code | New user registers using referrer's code | Referee gets 10 RCN bonus. Referrer gets 25 RCN bonus | High |
| RF-04 | Referral code applied correctly | Check both accounts after referral registration | Referrer: +25 RCN. Referee: +10 RCN. Both transactions recorded in history | High |
| RF-05 | Invalid referral code | New user enters a non-existent referral code | Registration still succeeds but no referral bonus applied | Medium |
| RF-06 | Referral code is own code | New user tries to use their own referral code | Error or code rejected — cannot self-refer | Medium |
| RF-07 | Referral history | Check referral stats/history screen | List of successful referrals shown with date and bonus amount | Medium |
| RF-08 | Referral badge count | Check how many referrals the user has made | Count shown correctly on referral screen | Low |

---

## 7. Test Area 6: Customer Tier System

### Precondition
- Logged in as a **customer** with varying RCN balances (or ability to adjust via admin)

### Tier Thresholds
- **Bronze**: Default (0 lifetime earnings) — no bonus
- **Silver**: Reached at higher lifetime earnings — +2 RCN bonus
- **Gold**: Reached at highest threshold — +5 RCN bonus

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| TR-01 | Bronze tier display | Login as new customer | Tier shows as "Bronze" with no bonus | High |
| TR-02 | Tier info screen | Navigate to Tier Info from home | Tier info screen shows current tier, benefits, and next tier requirements | High |
| TR-03 | Silver tier bonus applied | Shop rewards a Silver tier customer | +2 RCN bonus automatically added on top of base reward | High |
| TR-04 | Gold tier bonus applied | Shop rewards a Gold tier customer | +5 RCN bonus automatically added on top of base reward | High |
| TR-05 | Tier displayed on customer card | Shop views customer profile during reward/redeem | Customer tier badge visible on profile | Medium |
| TR-06 | Tier update after earnings | Customer earnings reach Silver threshold | Tier updates to Silver. Notification or visual indicator shown | High |
| TR-07 | Tier shown on home dashboard | Login as Silver/Gold customer | Correct tier badge visible on home screen balance card | High |

---

## 8. Test Area 7: Messaging

### Precondition
- Logged in as a **customer** on one device and **shop** on another
- Both have active accounts

### Flow
1. Customer or shop initiates a conversation
2. Messages sent back and forth in real-time

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| MSG-01 | Send message (customer to shop) | Customer opens shop conversation and sends a message | Message appears in conversation. Shop receives it | High |
| MSG-02 | Send message (shop to customer) | Shop opens customer conversation and sends a message | Message appears. Customer receives it | High |
| MSG-03 | Message delivery in real-time | Send a message while both parties have the app open | Message appears on receiver's screen without requiring a refresh | High |
| MSG-04 | Message history | Open an existing conversation | All previous messages loaded in chronological order | High |
| MSG-05 | Unread message badge | Receive a message while on a different screen | Unread badge appears on messages tab icon | Medium |
| MSG-06 | Mark messages as read | Open conversation with unread messages | Badge count decreases when conversation opened | Medium |
| MSG-07 | Message list screen | Navigate to messages tab | All conversations listed with latest message preview and timestamp | High |
| MSG-08 | Long message | Send a message with many characters | Message displays fully without truncation or layout issues | Low |
| MSG-09 | Notification for new message | Receive message while app is in background | Push notification received with message preview | High |
| MSG-10 | Auto-message templates | Shop navigates to auto-message settings | Shop can configure automated message templates for bookings | Low |

---

## 9. Test Area 8: Shop Moderation

### Precondition
- Logged in as a **shop** with an active subscription
- At least one customer exists

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| MOD-01 | Block customer | Shop opens customer profile and blocks them | Customer added to blocked list with timestamp. Confirmation shown | High |
| MOD-02 | Blocked customer cannot book | Blocked customer tries to book a service at that shop | Booking rejected or shop not visible | High |
| MOD-03 | View blocked customers | Navigate to blocked customers list | All blocked customers shown with name, wallet, reason, and date | High |
| MOD-04 | Search blocked customers | Search by name, wallet, or reason in blocked list | Matching results shown | Medium |
| MOD-05 | Unblock customer | Shop unblocks a customer from blocked list | Customer removed from blocked list. Can book again | High |
| MOD-06 | Block with reason | Shop blocks customer and adds a reason | Reason saved and visible in blocked list | Medium |
| MOD-07 | Submit issue report to admin | Shop reports spam/fraud/harassment via report flow | Report submitted with type, description, and entity. Status shows "pending" | High |
| MOD-08 | View submitted reports | Shop views their submitted reports | List of reports with status (pending/investigating/resolved/dismissed) | Medium |
| MOD-09 | Flag a review | Shop flags an inappropriate customer review | Flag/report sent to admin for moderation | Medium |
| MOD-10 | Admin receives moderation report | After shop submits report | Admin can see and act on the report from web dashboard | Medium |

---

## 10. Test Area 9: Profile Management

### Precondition
- Logged in as a **customer** or **shop**

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| PR-01 | View customer profile | Navigate to profile screen | Name, email, phone, wallet address, tier, and referral code displayed | High |
| PR-02 | Edit customer profile | Change name, phone, or email and save | Changes saved and reflected immediately | High |
| PR-03 | Edit customer profile — invalid email | Enter invalid email format and save | Validation error shown | Medium |
| PR-04 | View shop profile | Navigate to shop account screen | Shop name, email, address, category, RCN balance, and subscription status shown | High |
| PR-05 | Edit shop profile | Change shop name, address, or description and save | Changes saved and reflected | High |
| PR-06 | Upload shop profile image | Tap profile image, select from gallery | Image uploaded and displayed on profile | Medium |
| PR-07 | Customer views shop profile (marketplace) | Customer taps on a shop's name/image from a service | Shop public profile shown with services and basic info | High |
| PR-08 | Logout | Tap logout from settings | Session cleared, redirected to connect wallet screen | High |
| PR-09 | Settings screen — all items load | Navigate to settings as customer and as shop | All settings items displayed correctly for each role | High |

---

## 11. Test Area 10: Analytics Dashboards

### Precondition
- Logged in as a **shop** with active subscription and some historical bookings/transactions

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| AN-01 | Service analytics tab | Navigate to Services → Analytics tab | Performance metrics shown: top services, conversion rates, category breakdown | High |
| AN-02 | Filter analytics by time period | Select 7-day / 30-day / 90-day filter | Analytics data updates to reflect selected time range | High |
| AN-03 | Top performing services | Check top services section | Top 5 services listed with order counts and conversion rates | Medium |
| AN-04 | Category breakdown | View category stats | Services grouped by category with totals | Medium |
| AN-05 | RCN redemption analytics | View redemption stats on analytics | Shows RCN redemptions processed, amounts, and trends | Medium |
| AN-06 | Customer ratings insight | View ratings section in analytics | Average rating, total reviews, and rating distribution shown | Medium |
| AN-07 | Revenue overview | Check revenue section | Total revenue and order trends chart displayed | High |
| AN-08 | Analytics with no data | Shop with zero orders checks analytics | Empty state shown with "no data available" message | Low |
| AN-09 | Booking analytics | Navigate to booking analytics section | Booking counts, completion rates, and no-show rates shown | Medium |

---

## 12. Test Area 11: No-Show Policy & Promo Codes

### Precondition
- Logged in as a **shop** with active subscription

### No-Show Policy Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| NS-01 | Configure no-show policy | Navigate to No-Show Policy settings, configure fee or strike rules | Policy saved | High |
| NS-02 | Mark booking as no-show | Open a booking and mark as no-show | Status changes to no-show. Policy applied if configured | High |
| NS-03 | No-show count tracked | Customer accumulates no-shows | No-show count visible on customer profile (shop view) | Medium |
| NS-04 | View no-show bookings | Filter bookings by "no-show" status | Only no-show bookings displayed | Medium |

### Promo Code Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| PC-01 | Create promo code | Navigate to Promo Code settings, create a new code with discount | Code created and saved | High |
| PC-02 | Apply promo code during booking | Customer enters promo code during booking flow | Discount applied to total price | High |
| PC-03 | Invalid promo code | Enter a non-existent promo code | Error: invalid or expired promo code | High |
| PC-04 | Expired promo code | Use a promo code past its expiry date | Error: promo code expired | Medium |
| PC-05 | View promo code list | Shop navigates to promo codes | List of active and expired codes shown | Medium |

---

## 13. Test Area 12: End-to-End Full Flow

These are complete user journey tests that combine multiple features across the app.

### E2E-01: Full Customer Journey
**Devices needed:** 1 customer device + 1 shop device

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Customer registers with referral code | Account created with 10 RCN bonus |
| 2 | Customer browses service marketplace | Services visible with correct info |
| 3 | Customer favorites a service | Service saved to favorites |
| 4 | Customer books a service with time selection | Booking created, shop notified |
| 5 | Shop marks booking as completed and issues RCN | Customer receives RCN + push notification |
| 6 | Customer leaves a review | Review appears on service page |
| 7 | Customer redeems RCN at the shop | Redemption processed successfully |
| 8 | Customer checks transaction history | All transactions recorded correctly |

---

### E2E-02: Full Shop Journey
**Devices needed:** 1 shop device + admin web access

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Shop subscribes (test card) | Subscription active |
| 2 | Shop configures availability hours | Slots reflect in customer booking |
| 3 | Shop creates a new service | Service appears in marketplace |
| 4 | Customer books the service | Shop receives booking notification |
| 5 | Shop manages booking and marks complete | Customer notified |
| 6 | Shop views analytics | Booking and revenue data updated |
| 7 | Shop blocks a problematic customer | Customer cannot book again |
| 8 | Shop cancels subscription | Status changes to cancelled |

---

### E2E-03: Referral Chain
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Existing customer shares referral code | Code shared via WhatsApp/copy |
| 2 | New user registers using the code | Referee gets +10 RCN, referrer gets +25 RCN |
| 3 | Both accounts show correct bonus in history | Transactions recorded |
| 4 | Referrer checks referral history | New referral entry visible |

---

## 14. Known Issues & Limitations

| Area | Issue | Status |
|------|-------|--------|
| Real-time Messaging | Messages may not deliver instantly on weak connections | Expected behavior |
| Push Notifications | Notification delivery can be delayed by up to 30 seconds on some devices | Expected behavior |
| Tier Updates | Tier upgrade notification may not fire immediately after threshold crossed | Known limitation |
| Reviews | Review submission may fail if booking status update is delayed | Known bug (tracked) |
| Analytics | Charts may not render on very old Android devices (API < 26) | Known limitation |
| Appointment Slots | Concurrent booking race conditions possible in high-traffic scenarios | Known limitation |
| Promo Codes | Promo code field may not be visible in all booking flows | Known bug (tracked) |

---

## Test Execution Checklist

Use this checklist to track Final Phase testing progress:

- [ ] **AS-01 to AS-10** — Appointment Setup — Shop (10 cases)
- [ ] **AB-01 to AB-10** — Appointment Booking — Customer (10 cases)
- [ ] **NT-01 to NT-14** — Notifications (14 cases)
- [ ] **RV-01 to RV-11** — Reviews & Ratings (11 cases)
- [ ] **RF-01 to RF-08** — Referral System (8 cases)
- [ ] **TR-01 to TR-07** — Tier System (7 cases)
- [ ] **MSG-01 to MSG-10** — Messaging (10 cases)
- [ ] **MOD-01 to MOD-10** — Shop Moderation (10 cases)
- [ ] **PR-01 to PR-09** — Profile Management (9 cases)
- [ ] **AN-01 to AN-09** — Analytics (9 cases)
- [ ] **NS-01 to NS-04** — No-Show Policy (4 cases)
- [ ] **PC-01 to PC-05** — Promo Codes (5 cases)
- [ ] **E2E-01 to E2E-03** — End-to-End Flows (3 flows)

**Total Test Cases: 107 cases + 3 E2E flows**

---

## Reporting Bugs

When reporting a bug found during testing, include:

1. **Test Case ID** (e.g., NT-03)
2. **Platform** (iOS / Android / Both)
3. **Device** (model and OS version)
4. **Steps to Reproduce** (exact steps taken)
5. **Expected Result** (what should happen)
6. **Actual Result** (what actually happened)
7. **Screenshots/Screen Recording** (if applicable)
8. **Severity**: Critical / High / Medium / Low
