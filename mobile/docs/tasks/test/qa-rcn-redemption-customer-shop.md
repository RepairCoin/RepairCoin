# QA Test Guide: RCN Redemption Between Customer & Shop

## Date: 2026-04-16
## Feature: RCN Token Redemption (Customer approval + Shop processing)
## Platform: Mobile (React Native / Expo)
## Category: Comprehensive QA Guide

---

## Redemption Flow Overview

```
SHOP                                         CUSTOMER
────                                         ────────
1. Enter/scan customer address
2. Lookup customer balance & limits
3. Enter redemption amount
4. Tap "Process Redemption"
   → Creates session (POST /tokens/redemption-session/create)
   → Shows processing modal (waiting)
                                              5. Receives notification
                                              6. Sees pending request card
                                              7. Taps Accept → signs message
                                                 → POST /tokens/redemption-session/approve
8. Polling detects "approved"
   → Calls POST /shops/{shopId}/redeem
   → RCN deducted from customer balance
   → Session marked "used"
9. Shows "Redemption Completed"
                                              10. Balance updated
```

**Session timeout:** 5 minutes
**Polling intervals:** Shop = 2s, Customer = 5s
**RCN rate:** $0.10 per RCN

---

## Prerequisites

| Item | Details |
|------|---------|
| Customer account | Must have RCN balance > 0 (e.g., use a customer who has earned RCN) |
| Shop account | Must be active + verified. Qualifies via either: (1) active Stripe subscription (`subscription_qualified`), or (2) holding 10K+ RCG tokens (`rcg_qualified`). Backend checks `shop.active && shop.verified` — not operational_status directly. |
| Devices | Two devices/emulators — one for customer, one for shop (or use web + mobile) |
| Backend | Running and connected to database |

**Test accounts suggestion:**
- Customer with balance at Shop A (home shop) — for 100% redemption tests
- Same customer at Shop B (cross-shop) — for 20% limit tests
- Customer with 0 balance — for error state tests

---

## Section 1: Customer Redeem Screen

**Navigation:** Customer dashboard → Redeem (bottom quick action or sidebar)
**Screen:** "Redeem RCN"

### Test 1.1: Balance display

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open Redeem RCN screen | Screen loads with balance card |
| 2 | Check "Available to Redeem" | Shows current RCN balance (e.g., 161 RCN) |
| 3 | Check USD value | Shows correct conversion (161 RCN = $16.10) |
| 4 | Check "Total Redeemed" | Shows lifetime redemption total |
| 5 | Check "Redemption Rate" | Shows "$0.10 per RCN" |

### Test 1.2: QR code display

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Tap "Show QR Code" | Navigates to QR code screen |
| 2 | Verify QR content | QR code encodes customer wallet address (0x...) |
| 3 | Verify address display | Wallet address shown below QR code |
| 4 | Tap copy button | Address copied to clipboard, toast confirmation |
| 5 | Tap back | Returns to Redeem screen |

### Test 1.3: Pending requests — empty state

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open Redeem screen with no pending requests | Shows "No pending requests" |
| 2 | Check subtitle | Shows "Visit a shop to request a redemption" |

### Test 1.4: History button

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Tap "History" | Navigates to history screen |
| 2 | Check transactions | Shows redemption history filtered by type |
| 3 | Tap back | Returns to Redeem screen |

---

## Section 2: Shop Process Redemption Screen

**Navigation:** Shop dashboard → Redeem tab or menu
**Screen:** "Process Redemption"

### Test 2.1: Manual address entry

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open Process Redemption screen | Shows Customer Details section with wallet input |
| 2 | Enter invalid address (e.g., "abc") | No customer lookup triggered |
| 3 | Enter valid format but non-existent address | Shows "Customer Not Found" error |
| 4 | Enter valid registered customer address | Customer details load (name, balance, tier) |
| 5 | Enter shop's own wallet address | Shows "Cannot Process Own Redemption" error |

### Test 2.2: QR code scanning

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Tap QR scanner icon (top-right of Customer Details) | Camera opens with QR scan overlay |
| 2 | Deny camera permission | Shows permission denied message |
| 3 | Grant camera permission | Camera activates with scan area |
| 4 | Scan customer's QR code | Address populates in input field, customer lookup triggers |
| 5 | Scan invalid QR (non-address) | Shows validation error |

### Test 2.3: Customer lookup results — home shop

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter address of customer who earned RCN at this shop | Customer details load |
| 2 | Check badge | Shows "Home Shop" badge (green styling) |
| 3 | Check max redeemable | Shows 100% of customer balance |
| 4 | Check message | "100% redemption allowed (X RCN available)" |

### Test 2.4: Customer lookup results — cross-shop

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter address of customer who earned RCN at a different shop | Customer details load |
| 2 | Check badge | Shows "Cross-Shop Redemption" badge (amber styling) |
| 3 | Check max redeemable | Shows min(balance, 20% of lifetime earnings) |
| 4 | Check message | "Max X RCN (20% cross-shop limit)" |

### Test 2.5: Redemption amount — quick buttons

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Customer has 161 RCN (home shop) | All buttons enabled: 10, 25, 50, 100 RCN |
| 2 | Tap "10 RCN" | Amount input shows 10, summary shows 10 RCN / $1.00 |
| 3 | Tap "25 RCN" | Amount updates to 25, summary updates |
| 4 | Tap "50 RCN" | Amount updates to 50, summary updates |
| 5 | Tap "100 RCN" | Amount updates to 100, summary updates |
| 6 | Customer has 15 RCN max (cross-shop) | 25, 50, 100 buttons disabled (dimmed), only 10 enabled |
| 7 | Tap disabled button | Nothing happens |

### Test 2.6: Redemption amount — MAX button

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Customer has 161 RCN (home shop) | Tap MAX → amount set to 161 |
| 2 | Customer has 32 RCN max (cross-shop) | Tap MAX → amount set to 32 |
| 3 | Check summary | USD value updates correctly ($0.10 × amount) |

### Test 2.7: Redemption amount — manual input

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Type "0" | Process Redemption button disabled |
| 2 | Type amount within limit | Button enabled, summary updates |
| 3 | Type amount exceeding balance | Error message, button disabled |
| 4 | Type amount exceeding cross-shop limit | Cross-shop limit error message |
| 5 | Type negative number | Rejected or treated as 0 |
| 6 | Type decimal (e.g., "10.5") | Accepted if within limit |

### Test 2.8: Redemption summary

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter valid amount (e.g., 25 RCN) | Summary shows: Amount = 25 RCN, USD Value = $2.50, Total Deduction = -25 RCN |
| 2 | Change amount | Summary updates in real-time |
| 3 | No amount entered | Summary shows 0 RCN / $0.00 |

### Test 2.9: Process Redemption button states

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | No customer address entered | Button disabled (gray) |
| 2 | Customer loaded but amount = 0 | Button disabled |
| 3 | Valid customer + valid amount | Button enabled (red) |
| 4 | Tap enabled button | Processing modal appears |

---

## Section 3: Full Redemption Flow (Both Roles)

**Requires:** Two devices — one logged in as shop, one as customer

### Test 3.1: Happy path — home shop full redemption

| Step | Role | Action | Expected Result |
|------|------|--------|----------------|
| 1 | Customer | Open Redeem screen, tap "Show QR Code" | QR code displayed |
| 2 | Shop | Open Process Redemption, scan QR code | Customer address populated, details loaded |
| 3 | Shop | Verify "Home Shop" badge shown | Green badge, 100% max |
| 4 | Shop | Enter 25 RCN, tap "Process Redemption" | Processing modal appears — "Waiting for Customer Approval" |
| 5 | Shop | Verify countdown timer | Timer counting down from ~5:00 |
| 6 | Customer | Check Redeem screen | Pending request card appears with 25 RCN from shop |
| 7 | Customer | Tap "Accept" | Signature prompt → signs message → request approved |
| 8 | Shop | Observe processing modal | Status transitions: "Waiting" → "Processing" → "Completed" |
| 9 | Shop | Verify success message | "Redemption Successfully Processed!" |
| 10 | Shop | Tap "Process Another Redemption" | Form resets to empty state |
| 11 | Customer | Check balance | Balance decreased by 25 RCN |
| 12 | Customer | Check history | New redemption entry visible |

### Test 3.2: Happy path — cross-shop redemption

| Step | Role | Action | Expected Result |
|------|------|--------|----------------|
| 1 | Shop | Enter customer address (who earned at different shop) | "Cross-Shop Redemption" badge (amber) |
| 2 | Shop | Note max redeemable | Shows 20% of lifetime earnings |
| 3 | Shop | Enter amount within cross-shop limit | Summary shows correct values |
| 4 | Shop | Tap "Process Redemption" | Processing modal — waiting |
| 5 | Customer | Accept request | Signature signed and submitted |
| 6 | Shop | Wait for completion | "Redemption Completed" |
| 7 | Customer | Verify balance decreased | Correct amount deducted |

### Test 3.3: Customer rejects redemption

| Step | Role | Action | Expected Result |
|------|------|--------|----------------|
| 1 | Shop | Create redemption session (25 RCN) | Processing modal — "Waiting for Customer Approval" |
| 2 | Customer | See pending request | Request card visible with amount and shop |
| 3 | Customer | Tap "Reject" | Request disappears from pending list |
| 4 | Shop | Observe processing modal | Returns to idle state, session rejected |
| 5 | Customer | Check balance | Balance unchanged |

### Test 3.4: Session expiration (5-minute timeout)

| Step | Role | Action | Expected Result |
|------|------|--------|----------------|
| 1 | Shop | Create redemption session | Processing modal with countdown timer |
| 2 | Customer | Do NOT accept or reject | Let timer run down |
| 3 | Shop | Wait for 5 minutes | Timer reaches 0:00, session expires |
| 4 | Shop | Verify modal state | Shows expiration message, returns to idle |
| 5 | Customer | Check pending requests | Expired request removed from list |
| 6 | Customer | Check balance | Balance unchanged |

### Test 3.5: Shop cancels pending request

| Step | Role | Action | Expected Result |
|------|------|--------|----------------|
| 1 | Shop | Create redemption session | Processing modal — "Waiting" |
| 2 | Shop | Tap "Cancel Request" | Session cancelled, modal closes |
| 3 | Customer | Check pending requests | Request removed (or marked cancelled) |
| 4 | Customer | Check balance | Balance unchanged |

---

## Section 4: Cross-Shop Limit Enforcement

### Test 4.1: 20% limit calculation

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Customer has 500 RCN balance, 1000 lifetime earnings, at cross-shop | Max = min(500, 1000 × 0.20) = 200 RCN |
| 2 | Customer has 100 RCN balance, 200 lifetime earnings, at cross-shop | Max = min(100, 200 × 0.20) = 40 RCN |
| 3 | Customer has 50 RCN balance, 1000 lifetime earnings, at cross-shop | Max = min(50, 1000 × 0.20) = 50 RCN (balance is lower) |
| 4 | Same customer at home shop | Max = full balance (no cross-shop limit) |

### Test 4.2: Cross-shop limit in UI

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter cross-shop customer, try amount above limit | Error: "This customer can only redeem up to X RCN at your shop (20% cross-shop limit)" |
| 2 | Quick buttons above limit | Disabled (dimmed, not tappable) |
| 3 | MAX button | Sets to cross-shop max (not full balance) |
| 4 | Backend enforcement | Even if UI bypassed, backend rejects over-limit amount |

---

## Section 5: Error States & Edge Cases

### Test 5.1: Insufficient balance

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Customer has 5 RCN, shop enters 10 RCN | Error message — insufficient balance |
| 2 | Quick buttons 10, 25, 50, 100 all disabled | Only amounts ≤ 5 allowed |
| 3 | Shop types 5 in input | Accepted, process enabled |

### Test 5.2: Zero balance customer

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter address of customer with 0 RCN | Customer loads but balance shows 0 |
| 2 | All quick buttons | Disabled |
| 3 | Process Redemption button | Disabled |

### Test 5.3: Self-redemption prevention

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Shop enters their own wallet address | Error: "Cannot Process Own Redemption" |
| 2 | Amount section | Not shown or disabled |

### Test 5.4: Customer not found

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter valid Ethereum address format but unregistered | "Customer Not Found" error |
| 2 | Amount section | Not shown |

### Test 5.5: Network errors

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Disconnect internet, try to create session | Error toast — network/connection failure |
| 2 | Disconnect during polling | Polling pauses, resumes on reconnect |
| 3 | Customer disconnects during approval | Signature fails, error shown |

### Test 5.6: App backgrounding during session

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Shop creates session, background the app | Polling pauses |
| 2 | Customer approves while shop app is backgrounded | — |
| 3 | Shop returns to app | Polling resumes, picks up approved status, processes redemption |
| 4 | Customer has pending request, backgrounds app | Polling pauses |
| 5 | Customer returns to app | Polling resumes, pending requests refresh |

### Test 5.7: Wallet disconnected during signature

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Customer taps "Accept" but wallet session expired | Attempts auto-reconnect (Google auth) |
| 2 | Auto-reconnect succeeds | Signs message and continues |
| 3 | Auto-reconnect fails (external wallet like MetaMask) | Error message — wallet disconnected |

---

## Section 6: Data Integrity Checks

### Test 6.1: Balance consistency

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Note customer balance before redemption (e.g., 161 RCN) | — |
| 2 | Complete redemption of 25 RCN | — |
| 3 | Check customer balance on mobile | 136 RCN |
| 4 | Check customer balance on web | 136 RCN (matches mobile) |
| 5 | Check database `current_rcn_balance` | 136 (matches both) |

### Test 6.2: Multiple rapid redemptions

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Complete redemption #1 (25 RCN) from 161 → 136 | Success |
| 2 | Immediately start redemption #2 (25 RCN) | Balance shows 136, max updated |
| 3 | Complete redemption #2 | Balance now 111 |
| 4 | Verify no double-deduction | Database balance = 111 |

### Test 6.3: Concurrent session prevention

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Shop A creates session for customer (pending) | Session created |
| 2 | Shop B tries to create session for same customer | Should show error or queue (check behavior) |

---

## Section 7: UI/UX Verification

### Test 7.1: Processing modal states

| State | Status Dot | Text | Timer | Button |
|-------|-----------|------|-------|--------|
| Waiting | Yellow | "Waiting for Customer Approval" | MM:SS counting down | "Cancel Request" |
| Processing | Blue | "Processing Redemption" | Continues | "Cancel Request" |
| Completed | Green | "Redemption Completed" | Hidden | "Process Another Redemption" |

### Test 7.2: Request card on customer side

| Element | Expected |
|---------|----------|
| Shop name/ID | Correct shop that initiated |
| Amount | Matches what shop entered |
| Timestamp | Correct creation time |
| Accept button | Visible, tappable |
| Reject button | Visible, tappable |

### Test 7.3: Responsive feedback

| Action | Expected Feedback |
|--------|-------------------|
| Session created | Processing modal appears immediately |
| Customer accepts | Shop modal transitions within 2-4 seconds |
| Customer rejects | Shop modal closes within 2-4 seconds |
| Redemption completes | Success message with green indicator |
| Error occurs | Red toast notification at top of screen |

---

## Backend Endpoints Reference

| Endpoint | Method | Purpose | Called By |
|----------|--------|---------|-----------|
| `POST /tokens/redemption-session/create` | POST | Create redemption request | Shop |
| `GET /tokens/redemption-session/status/{id}` | GET | Poll session status | Shop (every 2s) |
| `POST /tokens/redemption-session/approve` | POST | Approve with signature | Customer |
| `POST /tokens/redemption-session/reject` | POST | Reject request | Customer |
| `POST /tokens/redemption-session/cancel` | POST | Cancel pending request | Shop |
| `GET /tokens/redemption-session/my-sessions` | GET | Fetch pending sessions | Customer (every 5s) |
| `POST /shops/{shopId}/redeem` | POST | Process final redemption | Shop |
| `GET /customers/balance/{address}` | GET | Get customer balance | Shop |
| `GET /customers/cross-shop-balance/{address}` | GET | Get cross-shop limits | Shop |
