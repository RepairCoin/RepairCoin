# QA Testing Guide - Phase 2

**App Name:** FixFlow
**Platforms:** iOS & Android (React Native / Expo)
**Last Updated:** June 10, 2026

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Test Area 1: Shop Token Operations - Buy RCN](#2-test-area-1-shop-token-operations---buy-rcn)
3. [Test Area 2: Shop Token Operations - Reward Customer](#3-test-area-2-shop-token-operations---reward-customer)
4. [Test Area 3: Shop Token Operations - Redeem Tokens](#4-test-area-3-shop-token-operations---redeem-tokens)
5. [Test Area 4: Customer Token Actions - Redeem](#5-test-area-4-customer-token-actions---redeem)
6. [Test Area 5: Customer QR Code](#6-test-area-5-customer-qr-code)
7. [Test Area 6: Service Management (Shop)](#7-test-area-6-service-management-shop)
8. [Test Area 7: Service Marketplace (Customer)](#8-test-area-7-service-marketplace-customer)
9. [Test Area 8: Service Booking - Customer](#9-test-area-8-service-booking---customer)
10. [Test Area 9: Service Booking - Shop Management](#10-test-area-9-service-booking---shop-management)
11. [Test Payment Card](#11-test-payment-card)
12. [Known Issues & Limitations](#12-known-issues--limitations)

---

## 1. Prerequisites

### Environment Setup

- Install FixFlow app on a test device (iOS or Android) via the provided build
- The backend is live on the **staging server** — no local setup required
- Have access to the **admin web dashboard** (staging)
- Prepare the following test accounts:
  - 1 active **customer** account (registered and not suspended)
  - 1 active **shop** account (approved, verified, with active subscription)
  - 1 active **shop** account (approved, verified, WITHOUT active subscription — for restriction tests)

### Test Payment Card (Stripe Test Mode)

| Field       | Value                    |
|-------------|--------------------------|
| Card Number | `4242 4242 4242 4242`    |
| Expiry      | Any future date          |
| CVC         | Any 3 digits             |
| ZIP         | Any 5 digits             |

---

## 2. Test Area 1: Shop Token Operations - Buy RCN

### Precondition
- Logged in as a **shop** with an **active subscription**
- Stripe test mode enabled

### Flow
1. Login as shop
2. Navigate to **Buy RCN** (from home dashboard or account settings)
3. Enter the amount of RCN to purchase
4. Proceed to **Stripe Checkout**
5. Complete payment
6. RCN balance updates

### RCN Pricing Tiers
- Standard shop: base price per RCN
- Premium shop (50K+ RCG): discounted price
- Elite shop (200K+ RCG): further discounted price

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| BR-01 | Successful RCN purchase | Enter valid amount, complete with test card `4242 4242 4242 4242` | Payment succeeds, RCN balance increases by purchased amount | High |
| BR-02 | RCN balance reflects purchase | After purchase, check shop home dashboard | RCN balance updated correctly | High |
| BR-03 | Purchase with declined card | Use test card `4000 0000 0000 0002` | Payment declined, RCN balance unchanged | High |
| BR-04 | Purchase with 3D Secure card | Use test card `4000 0025 0000 3155` | Authentication popup appears, completes successfully after auth | Medium |
| BR-05 | Cancel purchase mid-flow | Start checkout but cancel before completing | RCN balance unchanged, returns to buy RCN screen | High |
| BR-06 | Purchase history visible | After purchase, view purchase history | New purchase appears in history with amount, date, and cost | Medium |
| BR-07 | Shop without subscription tries to buy | Login as shop without active subscription, navigate to Buy RCN | Access restricted or subscription prompt shown | High |
| BR-08 | Deep link return after payment | Complete Stripe payment | App returns via deep link to correct screen with updated balance | High |
| BR-09 | Enter zero or negative amount | Type "0" or "-100" in amount field | Validation error — amount must be greater than zero | Medium |
| BR-10 | Very large purchase amount | Enter an extremely large number | Validation error or reasonable max limit enforced | Low |

---

## 3. Test Area 2: Shop Token Operations - Reward Customer

### Precondition
- Logged in as a **shop** with an **active subscription** and sufficient RCN balance
- A registered customer wallet address or customer QR code available

### Flow
1. Login as shop
2. Navigate to **Reward Token** section
3. Search for or scan customer QR code
4. Select the repair type / service completed
5. Enter reward amount (RCN to issue)
6. Confirm and issue reward

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| RW-01 | Successful reward issuance | Find customer, select repair type, enter valid amount, confirm | Customer RCN balance increases. Shop RCN balance decreases. Transaction recorded | High |
| RW-02 | Customer balance reflects reward | After reward, customer checks their balance | Balance increased by rewarded amount | High |
| RW-03 | Reward with insufficient shop balance | Try to reward more RCN than shop has | Error: insufficient shop RCN balance | High |
| RW-04 | Search customer by wallet address | Enter customer wallet address in search field | Customer found and displayed with name and tier | High |
| RW-05 | Scan customer QR code | Tap QR scan icon, scan customer QR code | Customer info populated automatically | High |
| RW-06 | Search non-existent customer | Enter a wallet address with no registered customer | Error: customer not found | Medium |
| RW-07 | Reward zero amount | Enter "0" as reward amount | Validation error — amount must be greater than zero | Medium |
| RW-08 | Reward suspended customer | Try to reward a suspended customer | Error or warning shown (suspended customers may be restricted) | Medium |
| RW-09 | Customer tier bonus applied | Reward a Gold tier customer | Tier bonus (+5 RCN) applied on top of base reward | High |
| RW-10 | Reward from unsubscribed shop | Login as shop without subscription, try to issue reward | Access restricted — requires active subscription | High |
| RW-11 | Transaction appears in history | After reward, check shop transaction history | Transaction recorded with customer address, amount, repair type, and timestamp | Medium |
| RW-12 | Customer notification on reward | Customer receives reward from shop | Customer receives push notification about new RCN reward | Medium |

---

## 4. Test Area 3: Shop Token Operations - Redeem Tokens

### Precondition
- Logged in as a **shop** with an **active subscription**
- A customer with RCN balance is available (earned from a previous service)
- Know the redemption rules: 100% at earning shop, 20% at other shops

### Flow
1. Login as shop
2. Navigate to **Redeem Token** section
3. Search for customer by wallet or scan QR code
4. Enter or confirm redemption amount
5. Confirm redemption
6. Customer RCN balance decreases

### Redemption Rules
- **100% redemption**: Customer redeeming at the shop where they originally earned the RCN
- **20% redemption**: Customer redeeming at any other shop (cross-shop redemption cap)

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| RD-01 | Successful redemption at earning shop | Customer redeems RCN at the shop where they earned it | Full redemption (100%) processed. Customer RCN balance decreases. Transaction recorded | High |
| RD-02 | Cross-shop redemption (20% cap) | Customer redeems at a different shop from where earned | Redemption capped at 20% of balance. Warning shown if attempting more | High |
| RD-03 | Redeem exact balance | Customer redeems their full available balance | Balance reduced to zero | High |
| RD-04 | Redeem more than balance | Enter redemption amount exceeding customer balance | Error: insufficient customer balance | High |
| RD-05 | Redeem zero amount | Enter "0" as redemption amount | Validation error | Medium |
| RD-06 | Customer not found | Enter unknown wallet address | Error: customer not found | Medium |
| RD-07 | How it works modal | Tap "How it works" or info button on redeem screen | Modal explains redemption rules (100% vs 20%) clearly | Low |
| RD-08 | Redemption history | After redemption, check shop transaction history | Redemption recorded with customer, amount, and timestamp | Medium |
| RD-09 | Customer balance after redemption | Customer checks their balance after shop redeems | Balance correctly reduced | High |
| RD-10 | Suspended customer redemption | Shop tries to redeem for a suspended customer | Appropriate error or restriction shown | Medium |

---

## 5. Test Area 4: Customer Token Actions - Redeem

### Precondition
- Logged in as a **customer** with an RCN balance
- Near a shop (or have the shop's QR/details available)

### Flow
1. Login as customer
2. Navigate to **Redeem** section (from home or tabs)
3. Select shop or scan shop QR code
4. Enter redemption amount
5. Submit redemption request
6. Shop confirms or auto-processes the redemption

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| CR2-01 | View pending redemption requests | Navigate to redeem screen | List of any pending redemption requests shown | High |
| CR2-02 | Redeem at earning shop | Submit redemption request to the shop where RCN was earned | 100% redemption rate applied. Request created and visible | High |
| CR2-03 | Redeem at different shop | Submit redemption at a shop different from earning shop | 20% cap applied. Warning shown about cross-shop rate | High |
| CR2-04 | View recent transactions | Open recent transactions on redeem screen | History of past redemptions visible with dates and amounts | Medium |
| CR2-05 | How to redeem modal | Tap "How to redeem" or info icon | Modal explains the redemption process and rates | Low |
| CR2-06 | Redeem with zero balance | Attempt to redeem with 0 RCN balance | Error: no balance available to redeem | High |
| CR2-07 | Cancel pending request | Cancel a pending redemption request | Request removed from pending list | Medium |

---

## 6. Test Area 5: Customer QR Code

### Precondition
- Logged in as a registered **customer**

### Flow
1. Login as customer
2. Navigate to **QR Code** section (from home quick actions)
3. QR code is displayed representing customer wallet address
4. Customer shows QR to shop for scanning

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| QR-01 | QR code displays correctly | Navigate to QR Code screen | QR code visible and represents the customer's wallet address | High |
| QR-02 | QR code is scannable | Shop scans customer QR code during reward/redeem flow | Shop successfully identifies the customer | High |
| QR-03 | Share QR code | Tap share button on QR screen | Share sheet appears with QR code image | Medium |
| QR-04 | QR code contains correct address | Compare QR content to customer wallet address | QR data matches the registered wallet address | High |
| QR-05 | QR code visible without internet | Put device in airplane mode, navigate to QR screen | QR code still displays (cached/generated locally) | Medium |

---

## 7. Test Area 6: Service Management (Shop)

### Precondition
- Logged in as a **shop** with an **active subscription**

### Flow
1. Login as shop
2. Navigate to **Services** tab
3. Create, edit, activate/deactivate, or delete services

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| SM-01 | Create new service | Fill all required fields (name, description, price, category) and save | Service created and visible in services list | High |
| SM-02 | Create service with image | Create service and upload an image | Image uploaded to storage, displayed on service card | High |
| SM-03 | Create service — missing name | Leave name empty, try to save | Validation error — name is required | High |
| SM-04 | Create service — missing price | Leave price empty, try to save | Validation error — price is required | High |
| SM-05 | Create service — negative price | Enter negative price | Validation error — price must be positive | Medium |
| SM-06 | Edit existing service | Open a service, change name/price/description, save | Changes saved and reflected in service list | High |
| SM-07 | Deactivate service | Toggle service to inactive | Service no longer appears in customer marketplace | High |
| SM-08 | Reactivate service | Toggle inactive service back to active | Service reappears in customer marketplace | High |
| SM-09 | Delete service | Delete a service | Service removed from list permanently | High |
| SM-10 | Service appears in marketplace | Create and activate service | Service visible to customers in marketplace with correct details | High |
| SM-11 | View service details | Tap on a service | Detail view shows name, price, description, category, image, and reviews | Medium |
| SM-12 | Add tags to service | Add tags during create/edit | Tags saved and displayed on service | Medium |
| SM-13 | Filter services by status | Filter shop services list by active/inactive | Only services matching the filter are shown | Medium |
| SM-14 | Service analytics tab | Navigate to Analytics tab on services screen | Shows performance metrics, top services, and order trends | Medium |
| SM-15 | Shop without subscription creates service | Login as shop without subscription, go to services | Access restricted — requires active subscription | High |

---

## 8. Test Area 7: Service Marketplace (Customer)

### Precondition
- Logged in as a **customer**
- At least a few active services exist in the system

### Flow
1. Login as customer
2. Navigate to **Services** tab
3. Browse, search, and filter available services

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| MP-01 | Browse marketplace | Navigate to services tab | List of active services shown with name, price, shop, and category | High |
| MP-02 | Search services by name | Type a service name in search bar | Matching services appear in results | High |
| MP-03 | Filter by category | Select a category filter | Only services in that category shown | High |
| MP-04 | Filter by price range | Set min/max price filter | Only services within price range shown | High |
| MP-05 | View service details | Tap on a service card | Detail view shows name, description, price, shop info, and reviews | High |
| MP-06 | Add service to favorites | Tap heart/bookmark icon on service card | Service saved to favorites, icon changes to filled | High |
| MP-07 | Remove service from favorites | Tap heart icon on a favorited service | Removed from favorites, icon reverts | High |
| MP-08 | View favorites list | Navigate to favorites | All saved services listed | High |
| MP-09 | Trending services | Check trending section on home | Shows top 4 services sorted by popularity | Medium |
| MP-10 | Recently viewed | Browse a few services, check recently viewed | Previously viewed services appear in recently viewed section | Medium |
| MP-11 | Share service | Tap share on service detail | Share options shown (WhatsApp, Twitter, copy link, etc.) | Low |
| MP-12 | Suspended shop service hidden | Shop gets suspended, customer browses marketplace | Suspended shop's services no longer visible | High |
| MP-13 | Inactive service not shown | Shop deactivates a service | Service disappears from customer marketplace | High |
| MP-14 | Service shows reviews | Open a service with reviews | Reviews and average rating visible on detail page | Medium |
| MP-15 | Empty search results | Search for something that doesn't exist | "No results found" message shown | Low |

---

## 9. Test Area 8: Service Booking - Customer

### Precondition
- Logged in as a **customer**
- At least one active service with appointment scheduling enabled exists

### Flow
1. Login as customer
2. Navigate to a service detail
3. Tap **Book** or **Schedule Appointment**
4. Select a date and available time slot
5. Optionally apply RCN discount
6. Complete payment (if service has a price)
7. Booking confirmed

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| BK-01 | Successful booking | Select date, time slot, and confirm | Booking created with status: pending. Confirmation shown | High |
| BK-02 | Date picker shows available dates | Open date picker | Only dates within shop operating hours are selectable | High |
| BK-03 | Time slot picker | After selecting date, select time | Available slots shown. Taken/unavailable slots greyed out | High |
| BK-04 | Book with RCN discount | Enter RCN amount to apply as discount during booking | Total price reduced by RCN value. RCN balance deducted on confirmation | High |
| BK-05 | Book with payment | Complete booking for paid service | Stripe checkout opens, payment processed, booking confirmed | High |
| BK-06 | View booking confirmation | After booking, check booking history | Booking appears with correct service, date, time, shop, and status | High |
| BK-07 | Cancel a booking | Find pending booking and cancel it | Booking status changes to cancelled | High |
| BK-08 | Book on a holiday/override date | Try to book on a date marked as closed by shop | Date not selectable or error shown — shop is closed that day | Medium |
| BK-09 | Book past available hours | Try to select time outside shop operating hours | Slot not available | Medium |
| BK-10 | View booking details | Tap on a booking in history | Full details shown: service, shop, date, time, price, status | Medium |
| BK-11 | Shop notification on new booking | Customer books a service | Shop receives push notification about new booking | Medium |
| BK-12 | No available slots | All time slots for a date are fully booked | "No available slots" message shown | Medium |

---

## 10. Test Area 9: Service Booking - Shop Management

### Precondition
- Logged in as a **shop** with active subscription
- At least one booking exists (created by a customer or manually)

### Flow
1. Login as shop
2. Navigate to **Service Orders** or **Booking** section
3. View, manage, and update bookings

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| SO-01 | View all bookings | Navigate to service orders list | All bookings listed with customer name, service, date, time, and status | High |
| SO-02 | View booking details | Tap on a booking | Full details shown: customer info, service, date/time, payment, RCN discount used | High |
| SO-03 | Mark booking as completed | Open booking, tap "Complete" | Status changes to completed. Completion modal shown | High |
| SO-04 | Issue RCN on completion | In completion modal, issue RCN reward to customer | Customer receives RCN. Transaction recorded | High |
| SO-05 | Mark booking as no-show | Open booking, mark as no-show | Status changes to no-show. No-show policy applied if configured | High |
| SO-06 | Cancel booking (shop side) | Shop cancels a booking | Status changes to cancelled. Customer notified | High |
| SO-07 | Manual booking creation | Shop creates booking manually for a walk-in customer | Booking created with customer wallet address, service, and date | Medium |
| SO-08 | Filter bookings by status | Filter list by pending/completed/cancelled/no-show | Only matching status bookings shown | Medium |
| SO-09 | Calendar view | Navigate to calendar view for bookings | Monthly calendar shows booking counts per day | Medium |
| SO-10 | Tap calendar day | Tap a day with bookings in calendar view | List of bookings for that day shown | Medium |
| SO-11 | Reschedule request | Customer requests reschedule — shop views request | Reschedule request visible in requests section. Shop can approve or reject | Medium |
| SO-12 | Customer notification on completion | Shop marks booking as complete | Customer receives push notification | Medium |

---

## 11. Test Payment Card

For all Stripe-related testing, use these test cards:

| Scenario | Card Number | Expected Behavior |
|----------|-------------|-------------------|
| Successful payment | `4242 4242 4242 4242` | Payment succeeds |
| Generic decline | `4000 0000 0000 0002` | Payment declined |
| Insufficient funds | `4000 0000 0000 9995` | Card declined (insufficient funds) |
| 3D Secure required | `4000 0025 0000 3155` | Requires authentication popup |
| Expired card | `4000 0000 0000 0069` | Card declined (expired) |
| Processing error | `4000 0000 0000 0119` | Processing error |

**For all test cards:**
- Expiry: Any future date (e.g., 12/30)
- CVC: Any 3 digits (e.g., 123)
- ZIP: Any 5 digits (e.g., 12345)

---

## 12. Known Issues & Limitations

| Area | Issue | Status |
|------|-------|--------|
| RCN Reward | Tier bonus calculation may have a slight delay before reflecting on customer balance | Expected behavior |
| Cross-shop Redemption | 20% cap warning may not appear in all UI flows | Known limitation |
| Service Image Upload | Large images may timeout on slow connections | Known limitation |
| Marketplace | Search results may take 1-2 seconds on first load | Expected behavior |
| Booking Slots | Slot availability updates may be slightly delayed in high-concurrency scenarios | Expected behavior |
| Manual Booking | Wallet address validation may not catch all invalid formats | Known bug (tracked) |

---

## Test Execution Checklist

Use this checklist to track Phase 2 testing progress:

- [ ] **BR-01 to BR-10** — Buy RCN (10 cases)
- [ ] **RW-01 to RW-12** — Reward Customer (12 cases)
- [ ] **RD-01 to RD-10** — Redeem Tokens — Shop (10 cases)
- [ ] **CR2-01 to CR2-07** — Redeem Tokens — Customer (7 cases)
- [ ] **QR-01 to QR-05** — Customer QR Code (5 cases)
- [ ] **SM-01 to SM-15** — Service Management (15 cases)
- [ ] **MP-01 to MP-15** — Service Marketplace (15 cases)
- [ ] **BK-01 to BK-12** — Service Booking — Customer (12 cases)
- [ ] **SO-01 to SO-12** — Service Booking — Shop (12 cases)

**Total Test Cases: 98**

---

## Reporting Bugs

When reporting a bug found during testing, include:

1. **Test Case ID** (e.g., BR-03)
2. **Platform** (iOS / Android / Both)
3. **Device** (model and OS version)
4. **Steps to Reproduce** (exact steps taken)
5. **Expected Result** (what should happen)
6. **Actual Result** (what actually happened)
7. **Screenshots/Screen Recording** (if applicable)
8. **Severity**: Critical / High / Medium / Low
