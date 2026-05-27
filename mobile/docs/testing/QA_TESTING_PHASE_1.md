# QA Testing Guide - Phase 1

**App Name:** FixFlow
**Platforms:** iOS & Android (React Native / Expo)
**Last Updated:** May 27, 2026

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Test Area 1: Authentication - Customer Registration](#2-test-area-1-authentication---customer-registration)
3. [Test Area 2: Authentication - Shop Registration](#3-test-area-2-authentication---shop-registration)
4. [Test Area 3: Authentication - Customer Login](#4-test-area-3-authentication---customer-login)
5. [Test Area 4: Authentication - Shop Login](#5-test-area-4-authentication---shop-login)
6. [Test Area 5: Shop Subscription](#6-test-area-5-shop-subscription)
7. [Test Area 6: Suspend Customer (Admin)](#7-test-area-6-suspend-customer-admin)
8. [Test Area 7: Suspend Shop (Admin)](#8-test-area-7-suspend-shop-admin)
9. [Test Payment Card](#9-test-payment-card)
10. [Known Issues & Limitations](#10-known-issues--limitations)

---

## 1. Prerequisites

### Environment Setup

- Install FixFlow app on a test device (iOS or Android) via the provided build (see [Tester Installation Guide](TESTER_INSTALLATION_GUIDE.md))
- The backend is already live on the **staging server** — no local setup required
- Have access to the **admin web dashboard** (staging) for suspension tests
- Prepare at least 2 wallet addresses (one for customer, one for shop)

### Wallet Options

- **Google Sign-In** (recommended for ease of testing) — creates a Thirdweb embedded wallet
- **MetaMask** or other WalletConnect-compatible wallet
- Each wallet address can only be registered as ONE role (customer OR shop, not both)

### Test Payment Card (Stripe Test Mode)

| Field       | Value                    |
|-------------|--------------------------|
| Card Number | `4242 4242 4242 4242`    |
| Expiry      | Any future date          |
| CVC         | Any 3 digits             |
| ZIP         | Any 5 digits             |

---

## 2. Test Area 1: Authentication - Customer Registration

### Precondition
- A wallet address that has NOT been registered before (fresh wallet or new Google account)
- The wallet address must NOT be registered as a shop

### Flow
1. Open the app
2. Tap **"Connect Wallet"**
3. Choose sign-in method: **Google** or **Wallet Connect**
4. After wallet connection, app checks if the address exists
5. If new user -> **Role Selection Screen** appears
6. Tap **"I'm a Customer"**
7. **Registration Form** appears with fields:
   - **Name** (required, max 255 characters)
   - **Email** (required, must be valid email format, must be unique)
   - **Phone** (required, valid phone format)
   - **Referral Code** (optional)
9. Tap **Register** / **Submit**
10. On success -> redirected to **Customer Dashboard (Home)**

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| CR-01 | Successful customer registration | Complete all required fields with valid data and submit | Account created, redirected to customer home dashboard with RCN balance showing 0 | High |
| CR-02 | Registration with all fields | Fill name, email, phone, and a valid referral code | Account created with referral link established | High |
| CR-03 | Missing name field | Leave name empty, fill other fields, submit | Validation error shown - name is required | High |
| CR-04 | Missing email field | Leave email empty, fill other fields, submit | Validation error shown - email is required | High |
| CR-05 | Missing phone field | Leave phone empty, fill other fields, submit | Validation error shown - phone is required | High |
| CR-06 | Invalid email format | Enter "notanemail" in email field | Validation error shown - invalid email format | High |
| CR-07 | Duplicate email | Use an email already registered by another user | Error: email already in use | High |
| CR-08 | Duplicate wallet address | Try to register with a wallet already registered as customer | Should not reach registration (auto-login instead) | Medium |
| CR-09 | Wallet already registered as shop | Connect a wallet that's registered as a shop, try to select "Customer" | Role conflict error - wallet already associated with shop role | High |
| CR-10 | Invalid referral code | Enter a non-existent referral code | Registration should still succeed (referral code is optional/ignored if invalid) | Medium |
| CR-11 | Name exceeds max length | Enter a name longer than 255 characters | Validation error or input truncated | Low |
| CR-12 | Double-tap register button | Quickly tap the register button twice | Only one request should be sent; no duplicate account creation or error toast | High |
| CR-13 | Network error during registration | Disconnect network before submitting | Appropriate error message shown with retry option | Medium |
| CR-14 | Special characters in name | Use special characters (e.g., accents, symbols) in name field | Should be accepted or properly validated | Low |

---

## 3. Test Area 2: Authentication - Shop Registration

### Precondition
- A wallet address that has NOT been registered before
- The wallet address must NOT be registered as a customer

### Flow
1. Open the app
2. Tap **"Connect Wallet"**
3. Choose sign-in method: **Google** or **Wallet Connect**
4. After wallet connection, app checks if the address exists
5. If new user -> **Role Selection Screen** appears
6. Tap **"I'm a Shop Owner"**
7. **Multi-step Shop Registration Form** appears (slides):

**Slide 1 - Business Info:**
- Shop ID (required, unique identifier, string)
- Shop Name (required)
- Email (required, valid format, unique)
- Phone (required)

**Slide 2 - Owner Info:**
- First Name
- Last Name
- City
- Country

**Slide 3 - Business Details:**
- Address (physical business address, required)
- Wallet Address (auto-populated from connected wallet)
- Company Size
- Monthly Revenue
- Website
- Category

**Slide 4 - Social & Terms:**
- Facebook URL
- Twitter URL
- Instagram URL
- Referral (how they heard about us)
- Accept Terms (required)

9. Submit registration
10. On success -> **Pending Approval Screen** appears (shop awaits admin verification)

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| SR-01 | Successful shop registration | Complete all required fields across all slides and submit | Shop created with status: pending (unverified). Pending approval screen shown | High |
| SR-02 | Missing Shop ID | Leave Shop ID empty, try to proceed | Validation error - Shop ID is required | High |
| SR-03 | Duplicate Shop ID | Use a Shop ID that already exists (e.g., "peanut") | Error: Shop ID already registered (409 conflict) | High |
| SR-04 | Missing shop name | Leave name empty | Validation error - name is required | High |
| SR-05 | Missing email | Leave email empty | Validation error - email is required | High |
| SR-06 | Duplicate email | Use an email already registered by another shop | Error: email already in use | High |
| SR-07 | Invalid email format | Enter invalid email | Validation error - invalid email | High |
| SR-08 | Missing phone | Leave phone empty | Validation error - phone is required | High |
| SR-09 | Missing physical address | Leave address empty | Validation error - address is required | High |
| SR-10 | Wallet already registered as customer | Connect a wallet registered as customer, select "Shop Owner" | Role conflict error - wallet already associated with customer role | High |
| SR-11 | Wallet already registered as shop | Connect a wallet already registered as a shop | Should not reach registration (auto-login instead) | Medium |
| SR-12 | Wallet address auto-population | Check that wallet address field is auto-filled from connected wallet | Wallet address should match the connected wallet and not be editable | Medium |
| SR-13 | Accept terms not checked | Try to submit without accepting terms | Should not be able to submit without accepting terms | High |
| SR-14 | Double-tap register button | Quickly tap submit twice | Only one registration request sent | High |
| SR-15 | Navigate back between slides | Go forward to slide 3, then back to slide 1 | Data from previous slides should be preserved | Medium |
| SR-16 | Pending approval screen display | After successful registration, check pending screen | Shows "Pending Approval" message, shop cannot access dashboard features | High |
| SR-17 | Admin approves shop | After registration, admin approves shop from web dashboard | Shop can now access full dashboard on next login/refresh | High |
| SR-18 | Network error during registration | Disconnect network before submitting | Appropriate error message shown | Medium |

---

## 4. Test Area 3: Authentication - Customer Login

### Precondition
- A wallet address that IS already registered as a customer

### Flow
1. Open the app
2. Tap **"Connect Wallet"**
3. Choose sign-in method: **Google** or **Wallet Connect**
4. After wallet connection, backend checks: `POST /api/auth/customer` with `{ address }`
5. If customer exists -> JWT token issued, redirected to **Customer Dashboard**

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| CL-01 | Successful customer login | Connect wallet with registered customer address | JWT token received, redirected to customer home dashboard with correct balance and tier | High |
| CL-02 | Login shows correct user data | Login and check home screen | Name, RCN balance, tier (Bronze/Silver/Gold), and wallet address are correct | High |
| CL-03 | Session persistence | Login, close app completely, reopen app | Session restored automatically without requiring wallet reconnection | High |
| CL-04 | Login with unregistered wallet | Connect a wallet not associated with any account | Redirected to role selection screen (not dashboard) | High |
| CL-05 | Login with shop wallet as customer | Try to authenticate as customer with a shop wallet | Error: "Address not associated with a customer" (403) | Medium |
| CL-06 | Login after token expiry | Wait for access token to expire | App should auto-refresh token via refresh endpoint; user stays logged in | Medium |
| CL-07 | Login with suspended customer account | Connect wallet of a suspended customer | Login succeeds BUT user sees suspension status. Certain actions restricted | High |
| CL-08 | Login after session revocation | Login within 1 hour after admin revoked sessions | Error: "Your session was recently revoked. Please wait before logging in again." (403) with 60-minute cooldown | Medium |
| CL-09 | Logout and re-login | Logout from account, then login again with same wallet | Successful re-authentication, all data intact | Medium |
| CL-10 | Google sign-in login | Use Google sign-in with a previously registered Google account | Successful login with embedded wallet | High |

---

## 5. Test Area 4: Authentication - Shop Login

### Precondition
- A wallet address that IS already registered as a shop
- Test with both: an approved/active shop AND a pending (unverified) shop

### Flow
1. Open the app
2. Tap **"Connect Wallet"**
3. Choose sign-in method: **Google** or **Wallet Connect**
4. After wallet connection, backend checks: `POST /api/auth/shop` with `{ address, email? }`
5. If shop exists -> JWT token issued, redirected to **Shop Dashboard**

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| SL-01 | Successful shop login (active & verified) | Connect wallet with an approved shop address | JWT token received, redirected to shop dashboard with full access | High |
| SL-02 | Login with pending (unverified) shop | Connect wallet of a newly registered, unapproved shop | Login succeeds with limited access warning. Shows pending approval screen | High |
| SL-03 | Login shows correct shop data | Login and check dashboard | Shop name, RCN balance, subscription status, and stats are correct | High |
| SL-04 | Session persistence | Login, close app, reopen | Session restored automatically | High |
| SL-05 | Login with unregistered wallet | Connect a wallet not associated with any shop | Error: "Address not associated with a shop" (403) | Medium |
| SL-06 | Login with customer wallet as shop | Try to authenticate as shop with a customer wallet | Error: "Address not associated with a shop" (403) | Medium |
| SL-07 | Email fallback login (Google sign-in) | Register shop with MetaMask wallet, then login via Google using the same email | Login succeeds via email fallback. Response includes `linkedByEmail: true` and `originalWallet` | Medium |
| SL-08 | Login with suspended shop | Connect wallet of a suspended shop | Login succeeds but suspension info included in response. User sees suspended state | High |
| SL-09 | Login after session revocation | Login within 1 hour of admin session revocation | Error: "Your session was recently revoked" with 60-minute cooldown | Medium |
| SL-10 | Logout and re-login | Logout, reconnect same wallet | Successful re-authentication | Medium |

---

## 6. Test Area 5: Shop Subscription

### Precondition
- A registered and admin-approved (verified + active) shop account
- Stripe test mode enabled

### Flow
1. Login as an approved shop
2. Navigate to **Subscription** section (from dashboard or account settings)
3. If no active subscription -> **Subscription Form** shown
4. Tap **Subscribe** / **Start Subscription**
5. Redirected to **Stripe Checkout** (opens in secure browser)
6. Enter test card details (see test card above)
7. Complete payment ($500/month)
8. Deep link returns to app
9. Subscription status updates to **Active**

### Subscription States
- **No subscription** - Shop has never subscribed
- **Active** - Subscription is live and current
- **Cancelled** - Shop cancelled; may still have access until period end (`cancelAtPeriodEnd`)
- **Paused** - Admin paused the subscription
- **Past Due** - Payment failed but subscription not yet cancelled

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| SUB-01 | Successful first-time subscription | Login as approved shop with no subscription, subscribe with test card | Stripe checkout completes, app returns via deep link, subscription status shows "Active" | High |
| SUB-02 | Subscription status display | After subscribing, check subscription section | Shows: Active status, monthly amount ($500), next payment date, payment history | High |
| SUB-03 | Access features with active subscription | Navigate to services, bookings, customers, analytics | All shop features accessible without restrictions | High |
| SUB-04 | Access features WITHOUT subscription | Login as shop without active subscription | Limited access. Core features (services, bookings management) may be restricted. Purchase history should still be viewable | High |
| SUB-05 | Cancel subscription | Go to subscription settings, cancel subscription | Status changes to "Cancelled". If `cancelAtPeriodEnd` is true, access continues until end of billing period | High |
| SUB-06 | Re-subscribe after cancellation | After cancelling, go through subscription flow again | New Stripe checkout, payment processed, subscription reactivated to "Active" | High |
| SUB-07 | Subscription with declined card | Use Stripe test card `4000 0000 0000 0002` (decline) | Payment fails, subscription not activated, error message shown | High |
| SUB-08 | Subscription with insufficient funds | Use Stripe test card `4000 0000 0000 9995` (insufficient funds) | Payment fails with appropriate error | Medium |
| SUB-09 | Deep link return after payment | Complete Stripe payment, check app behavior | App receives deep link, navigates back to subscription screen with updated status | High |
| SUB-10 | Subscription status after app restart | Subscribe, close app, reopen | Subscription status still shows "Active" | Medium |
| SUB-11 | Pending shop tries to subscribe | Login as an unapproved shop, look for subscription option | Subscription should not be accessible until shop is approved | Medium |
| SUB-12 | View purchase history | Check purchase/payment history section | Shows all past subscription payments with dates and amounts | Low |
| SUB-13 | Subscription paused by admin | Admin pauses subscription from web dashboard | Shop sees "Paused" status with pause reason. `hasActiveSubscription: false` | Medium |

### Stripe Test Cards Reference

| Scenario | Card Number |
|----------|-------------|
| Successful payment | `4242 4242 4242 4242` |
| Declined | `4000 0000 0000 0002` |
| Insufficient funds | `4000 0000 0000 9995` |
| Requires authentication (3D Secure) | `4000 0025 0000 3155` |

---

## 7. Test Area 6: Suspend Customer (Admin)

### Precondition
- An active customer account exists
- Admin access to the web dashboard
- Admin must have `manage_customers` permission

### Admin Action Flow
1. Login to admin web dashboard
2. Navigate to **Customers** management
3. Find the target customer (by name or wallet address)
4. Click **Suspend** on the customer
5. Optionally provide a **reason** for suspension
6. Confirm suspension

### Backend Details
- **Endpoint:** `POST /api/admin/customers/:address/suspend`
- **Auth:** Admin JWT + `manage_customers` permission
- **Body:** `{ reason?: string }`
- **Effect:** Sets `isActive = false`, records `suspendedAt` timestamp and `suspensionReason`

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| SC-01 | Suspend active customer | Admin suspends an active customer with a reason | Customer marked as suspended. `isActive: false`, `suspendedAt` set, `suspensionReason` recorded | High |
| SC-02 | Suspend without reason | Admin suspends customer without providing a reason | Suspension succeeds with reason logged as "No reason provided" | Medium |
| SC-03 | Suspended customer login behavior | Customer logs in after being suspended | Login succeeds (allowed). Response includes `suspended: true`, `suspendedAt`, `suspensionReason` | High |
| SC-04 | Suspended customer sees suspension screen | Suspended customer opens the app | App shows suspension/restricted screen with reason and status | High |
| SC-05 | Suspended customer cannot perform actions | Suspended customer tries to book a service, redeem tokens, etc. | Actions blocked with appropriate error messages | High |
| SC-06 | Suspended customer can request unsuspension | Suspended customer uses "Request Unsuspension" feature | Request submitted with reason. Rate limited to 3 requests per hour | Medium |
| SC-07 | Unsuspend customer | Admin unsuspends a previously suspended customer | Customer reactivated: `isActive: true`, `suspendedAt: null`, `suspensionReason: null` | High |
| SC-08 | Unsuspended customer regains access | Customer logs in after being unsuspended | Full access restored, no suspension indicators, all features work normally | High |
| SC-09 | Suspend non-existent customer | Admin tries to suspend a wallet address that doesn't exist | Error: "Customer not found" | Low |
| SC-10 | Suspend already-suspended customer | Admin tries to suspend a customer that's already suspended | Should handle gracefully (either succeed silently or show already-suspended message) | Low |
| SC-11 | Admin activity logging | After suspension/unsuspension | Admin activity log records: admin address, action type (`customer_suspension`/`customer_unsuspension`), entity ID, reason | Medium |
| SC-12 | Real-time suspension detection (mobile) | Customer is using the app when admin suspends them | App should detect suspension status change and show suspension screen | Medium |
| SC-13 | Non-admin tries to suspend | A shop or customer account tries to call the suspend endpoint | 403 Forbidden - requires admin role and `manage_customers` permission | Low |

---

## 8. Test Area 7: Suspend Shop (Admin)

### Precondition
- An active, verified shop account exists
- Admin access to the web dashboard
- Admin must have `manage_shops` permission

### Admin Action Flow
1. Login to admin web dashboard
2. Navigate to **Shops** management
3. Find the target shop (by name or Shop ID)
4. Click **Suspend** on the shop
5. Optionally provide a **reason** for suspension
6. Confirm suspension

### Backend Details
- **Endpoint:** `POST /api/admin/shops/:shopId/suspend`
- **Auth:** Admin JWT + `manage_shops` permission
- **Body:** `{ reason?: string }`
- **Effect:** Sets `active = false`, records `suspendedAt` and `suspensionReason`. Emits `shop:suspended` event. Sends email notification to shop.

### Test Cases

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| SS-01 | Suspend active shop | Admin suspends an active shop with a reason | Shop marked as suspended. `active: false`, `suspendedAt` set, `suspensionReason` recorded | High |
| SS-02 | Suspend without reason | Admin suspends shop without providing a reason | Suspension succeeds with reason "Suspended by administrator" | Medium |
| SS-03 | Suspended shop login behavior | Shop owner logs in after suspension | Login succeeds. Response includes `suspended: true`, `suspendedAt`, `suspensionReason` | High |
| SS-04 | Suspended shop sees suspension screen | Suspended shop opens the app | App shows suspension/restricted screen with reason | High |
| SS-05 | Suspended shop services hidden from marketplace | Customer browses the marketplace after shop suspension | Suspended shop's services should not appear in marketplace search results | High |
| SS-06 | Suspended shop cannot manage services | Suspended shop tries to create/edit services or manage bookings | Actions blocked - shop must be active | High |
| SS-07 | Email notification on suspension | Admin suspends a shop that has an email address | Shop receives suspension email notification | Medium |
| SS-08 | WebSocket/Event notification | Shop is online when admin suspends them | `shop:suspended` event emitted. App should detect and show suspension screen | Medium |
| SS-09 | Unsuspend shop | Admin unsuspends a previously suspended shop | Shop reactivated: `active: true`, `suspendedAt: null`, `suspensionReason: null` | High |
| SS-10 | Unsuspended shop regains access | Shop logs in after being unsuspended | Full access restored, services visible again in marketplace, all features work | High |
| SS-11 | Email notification on unsuspension | Admin unsuspends shop | Shop receives unsuspension email notification | Medium |
| SS-12 | Suspend non-existent shop | Admin tries to suspend a shop ID that doesn't exist | Error: "Shop not found" | Low |
| SS-13 | Re-approve suspended shop | Admin uses "Approve" action on a suspended shop | Shop re-approved: `verified: true`, `active: true`, suspension fields cleared | Medium |
| SS-14 | Admin activity logging | After suspension/unsuspension | Admin activity log records: admin address, action type (`shop_suspension`/`shop_unsuspension`), shop name, reason | Medium |
| SS-15 | Customer bookings with suspended shop | Customer has an approved booking at a now-suspended shop | Existing bookings should still be visible to the customer but new bookings should be blocked | Medium |
| SS-16 | Non-admin tries to suspend | A shop or customer tries to call the suspend endpoint | 403 Forbidden - requires admin role and `manage_shops` permission | Low |

---

## 9. Test Payment Card

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

## 10. Known Issues & Limitations

| Area | Issue | Status |
|------|-------|--------|
| Registration | Double-tap on register button may fire duplicate requests if debounce fails | Mitigated (debounce applied) |
| Shop Registration | Wallet address may not auto-populate on third slide in some edge cases | Known bug (tracked) |
| Suspension (Mobile) | Real-time suspension detection may not work instantly - may require app refresh/re-login | Known limitation |
| Suspended Shop | Pending approval screen may show instead of suspension screen in some cases | Known bug (tracked) |
| Session | Expired refresh token may not trigger auto-logout cleanly in all cases | Known limitation |
| Subscription | Stripe webhook delivery can be delayed; subscription status may take a few seconds to update after payment | Expected behavior |

---

## Test Execution Checklist

Use this checklist to track Phase 1 testing progress:

- [ ] **CR-01 to CR-14** - Customer Registration (14 cases)
- [ ] **SR-01 to SR-18** - Shop Registration (18 cases)
- [ ] **CL-01 to CL-10** - Customer Login (10 cases)
- [ ] **SL-01 to SL-10** - Shop Login (10 cases)
- [ ] **SUB-01 to SUB-13** - Shop Subscription (13 cases)
- [ ] **SC-01 to SC-13** - Suspend Customer (13 cases)
- [ ] **SS-01 to SS-16** - Suspend Shop (16 cases)

**Total Test Cases: 94**

---

## Reporting Bugs

When reporting a bug found during testing, include:

1. **Test Case ID** (e.g., CR-05)
2. **Platform** (iOS / Android / Both)
3. **Device** (model and OS version)
4. **Steps to Reproduce** (exact steps taken)
5. **Expected Result** (what should happen)
6. **Actual Result** (what actually happened)
7. **Screenshots/Screen Recording** (if applicable)
8. **Severity**: Critical / High / Medium / Low
