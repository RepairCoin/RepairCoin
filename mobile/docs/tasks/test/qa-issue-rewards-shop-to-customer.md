# QA Test Guide: Issue Rewards — Shop to Customer

## Date: 2026-04-16
## Feature: RCN Reward Issuance (Shop issues RCN to customer after repair)
## Platform: Mobile (React Native / Expo)
## Category: Comprehensive QA Guide

---

## Issue Rewards Flow Overview

```
SHOP                                         CUSTOMER
────                                         ────────
1. Enter/scan customer wallet address
2. (Optional) Enter promo code
3. Select repair type or custom amount
4. Review reward breakdown
5. Tap "Issue Reward" → Confirm in modal
   → POST /shops/{shopId}/issue-reward
   → Backend validates, calculates, processes
   → Atomic DB: deduct shop balance, credit customer
   → Blockchain: transfer/mint tokens (if enabled)
                                              6. Receives push notification
                                              7. Balance updates immediately
                                              8. Transaction in history
                                              (No approval needed)
```

**Key difference from Redemption:** Rewards are **instant** — no approval session. Shop submits, backend processes, customer receives immediately.

---

## Prerequisites

| Item | Details |
|------|---------|
| Shop account | Active + verified. Must have purchased RCN balance > 0. Qualifies via Stripe subscription (`subscription_qualified`) or 10K+ RCG holdings (`rcg_qualified`). |
| Customer account | Registered customer with wallet address. Any tier (Bronze/Silver/Gold). |
| Shop RCN balance | Shop must have purchased RCN tokens to issue. Check via shop dashboard. |
| Devices | Two devices — one for shop, one for customer. Or use web + mobile. |
| Promo codes (optional) | Pre-create promo codes via shop dashboard for promo code tests. |

---

## Reward Calculation Formula

```
Total Reward = Base Reward + Tier Bonus + Promo Bonus
```

| Component | Source |
|-----------|--------|
| **Base Reward** | Repair type preset (5/10/15 RCN) or custom amount |
| **Tier Bonus** | Bronze: +0, Silver: +2, Gold: +5 RCN |
| **Promo Bonus** | Fixed: exact amount, Percentage: % of (base + tier), capped at `max_bonus` |

### Repair Type Presets

| Type | RCN | Repair Value | Description |
|------|-----|--------------|-------------|
| XS Repair (minor) | 5 RCN | $30-$50 | Small repairs |
| Small Repair | 10 RCN | $50-$99 | Standard repairs |
| Large Repair | 15 RCN | $100+ | Major repairs |
| Custom | User-defined | User-defined | Any amount (1-10,000 RCN) |

---

## Section 1: Customer Address Entry

**Screen:** Shop → Issue Rewards
**Component:** CustomerDetailsSection

### Test 1.1: Manual address entry

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open Issue Rewards screen | Customer Details section with wallet input visible |
| 2 | Type partial address (< 42 chars) | No lookup triggered |
| 3 | Type invalid address (not 0x format) | No lookup triggered |
| 4 | Type valid registered customer address (42 chars) | Customer lookup triggers, name/tier displayed |
| 5 | Type valid format but unregistered address | "Customer not found" error |
| 6 | Type shop's own wallet address | "Cannot issue rewards to your own wallet" error |

### Test 1.2: QR code scanning

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Tap QR scanner icon | Camera opens with scan overlay |
| 2 | Scan customer's QR code | Address auto-populates, lookup triggers |
| 3 | Scan invalid QR (non-address) | Validation error |
| 4 | Deny camera permission | Permission denied message shown |

### Test 1.3: Customer info display

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter Bronze tier customer | Tier badge shows "Bronze" |
| 2 | Enter Silver tier customer | Tier badge shows "Silver", +2 RCN bonus noted |
| 3 | Enter Gold tier customer | Tier badge shows "Gold", +5 RCN bonus noted |

---

## Section 2: Promo Code (Optional)

### Test 2.1: Valid promo code

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter valid active promo code | Code validates (green check), bonus details shown |
| 2 | Check bonus display | Shows bonus type (fixed/percentage) and amount |
| 3 | Clear promo code field | Bonus removed from calculation |

### Test 2.2: Invalid promo codes

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter non-existent code | "Invalid promo code" error |
| 2 | Enter expired code (past end_date) | "Promo code has expired" error |
| 3 | Enter code that exceeded total_usage_limit | "Promo code usage limit reached" error |
| 4 | Enter code customer already used (per_customer_limit) | "Customer has already used this code" error |
| 5 | Enter code not yet active (before start_date) | "Promo code is not yet active" error |

### Test 2.3: Promo code dropdown

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Tap promo code input | Shows dropdown of shop's active promo codes |
| 2 | Type to filter | Dropdown filters matching codes |
| 3 | Select code from dropdown | Code populates, validates automatically |

### Test 2.4: Promo bonus calculation

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Fixed promo (bonus_value=5) + 10 RCN base + Silver tier | Total = 10 + 2 + 5 = 17 RCN |
| 2 | Percentage promo (20%) + 10 RCN base + Silver tier | Promo = (10+2) × 0.20 = 2.4, Total = 10 + 2 + 2.4 = 14.4 RCN |
| 3 | Percentage promo (50%) with max_bonus=5 + 15 base | Promo = min(15 × 0.50, 5) = 5, Total = 15 + 0 + 5 = 20 RCN |

---

## Section 3: Select Repair Type

### Test 3.1: Preset repair types

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Select "XS Repair (minor)" | Base reward shows 5 RCN |
| 2 | Select "Small Repair" | Base reward shows 10 RCN |
| 3 | Select "Large Repair" | Base reward shows 15 RCN |
| 4 | Switch between types | Reward updates, previous selection cleared |

### Test 3.2: Custom amount

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Select "Custom" | Custom input fields appear (repair amount + RCN reward) |
| 2 | Enter repair amount $75, RCN 10 | Summary shows 10 RCN base reward |
| 3 | Enter repair amount $0 | Validation error — minimum $1 |
| 4 | Enter RCN 0 | Validation error — minimum 1 RCN |
| 5 | Enter RCN 10,001 | Validation error — maximum 10,000 RCN |
| 6 | Enter repair amount $100,001 | Validation error — maximum $100,000 |
| 7 | Enter decimal values ($75.50, 10.5 RCN) | Accepted |
| 8 | Switch from custom back to preset | Custom inputs cleared, preset selected |

---

## Section 4: Reward Summary & Confirmation

### Test 4.1: Reward breakdown display

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Select Small Repair + Silver customer + no promo | Base: 10, Tier: +2, Promo: 0, Total: 12 RCN |
| 2 | Select Large Repair + Gold customer + fixed promo 5 | Base: 15, Tier: +5, Promo: +5, Total: 25 RCN |
| 3 | Select Custom 20 RCN + Bronze + percentage promo 10% | Base: 20, Tier: 0, Promo: +2, Total: 22 RCN |

### Test 4.2: Issue Reward button states

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | No customer address entered | Button disabled |
| 2 | Customer entered but no repair type | Button disabled |
| 3 | Valid customer + valid repair type | Button enabled |
| 4 | Reward exceeds shop's RCN balance | Button disabled, insufficient balance error |

### Test 4.3: Confirmation modal

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Tap "Issue Reward" | Confirmation modal appears |
| 2 | Check modal details | Shows: customer address, tier, base reward, tier bonus, promo bonus, total |
| 3 | Tap "Cancel" | Modal closes, no reward issued |
| 4 | Tap "Confirm" | Reward processes, loading spinner shown |
| 5 | Wait for completion | Success toast, modal closes, form resets |

---

## Section 5: Full Issue Rewards Flow (Both Roles)

**Requires:** Two devices — one as shop, one as customer

### Test 5.1: Happy path — preset repair type

| Step | Role | Action | Expected Result |
|------|------|--------|----------------|
| 1 | Shop | Note current shop RCN balance (e.g., 500 RCN) | — |
| 2 | Customer | Note current customer RCN balance (e.g., 161 RCN) | — |
| 3 | Customer | Show QR code | QR displayed |
| 4 | Shop | Scan customer QR code | Address populated, customer details loaded |
| 5 | Shop | Select "Small Repair" (10 RCN) | Summary: Base 10 + Tier bonus |
| 6 | Shop | Tap "Issue Reward" → Confirm | Processing... → Success toast |
| 7 | Shop | Check shop balance | Decreased by total reward (e.g., 500 → 488 for 12 RCN with Silver tier) |
| 8 | Shop | Check Recent Rewards | New entry at top of list |
| 9 | Customer | Check notification | "Shop issued you 12 RCN" notification received |
| 10 | Customer | Check balance on home screen | Increased by 12 RCN (e.g., 161 → 173) |
| 11 | Customer | Check transaction history | New "Earned" entry with shop name and amount |

### Test 5.2: Happy path — custom amount with promo code

| Step | Role | Action | Expected Result |
|------|------|--------|----------------|
| 1 | Shop | Enter customer address manually | Customer loaded |
| 2 | Shop | Enter valid promo code (e.g., 20% bonus) | Code validates, bonus shown |
| 3 | Shop | Select "Custom", enter 20 RCN | Summary: Base 20 + Tier + Promo |
| 4 | Shop | Verify breakdown | E.g., 20 + 2 (Silver) + 4.4 (20% of 22) = 26.4 RCN |
| 5 | Shop | Confirm and issue | Success |
| 6 | Customer | Verify balance increased by exact total | Matches breakdown |

### Test 5.3: Tier bonus verification

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Issue 10 RCN to Bronze customer | Total: 10 RCN (no bonus) |
| 2 | Issue 10 RCN to Silver customer | Total: 12 RCN (+2 bonus) |
| 3 | Issue 10 RCN to Gold customer | Total: 15 RCN (+5 bonus) |
| 4 | Compare all three in transaction history | Correct amounts for each |

---

## Section 6: Recent Rewards

### Test 6.1: Recent rewards display

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open Issue Rewards after issuing rewards | "Recent Rewards" section shows last 5 |
| 2 | Check each entry | Shows: customer name, amount (e.g., "+12 RCN"), relative time |
| 3 | Tap "Last 5" badge | — (display only, shows count) |
| 4 | Issue a new reward | New entry appears at top of Recent Rewards |
| 5 | Pull to refresh | Recent Rewards refreshes |

### Test 6.2: Empty state

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | New shop with no rewards issued | Recent Rewards shows empty state or "No recent rewards" |

---

## Section 7: Error Handling & Edge Cases

### Test 7.1: Insufficient shop balance

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Shop has 5 RCN balance, try to issue 10 RCN | Error: "Insufficient shop RCN balance" |
| 2 | Issue Reward button | Disabled with error message |
| 3 | Shop has exactly 10 RCN, issue 10 RCN to Bronze | Succeeds (exactly enough) |
| 4 | Shop has 0 RCN | All repair types disabled or button permanently disabled |

### Test 7.2: Self-reward prevention

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Shop enters their own wallet address | Error: "Cannot issue rewards to your own wallet" |
| 2 | Issue Reward button | Disabled |

### Test 7.3: Inactive/suspended customer

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter suspended customer address | Backend rejects: "Customer is not active" |

### Test 7.4: Duplicate submission (idempotency)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Issue reward successfully | Success |
| 2 | Rapidly tap confirm again (same request) | Returns cached response, no double-issue |
| 3 | Check customer balance | Only one reward credited |

### Test 7.5: Network errors

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Disconnect internet, tap Issue Reward | Error toast — network failure |
| 2 | Reconnect, retry | Succeeds normally |

### Test 7.6: Inactive subscription

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Shop without active subscription tries to issue | Backend rejects: requires active subscription |
| 2 | Error displayed to shop | Clear message about subscription requirement |

### Test 7.7: Concurrent promo code usage

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Create promo with total_usage_limit=1 | — |
| 2 | Two shops (or same shop twice) try to use it simultaneously | One succeeds, one gets "usage limit reached" |
| 3 | Check promo usage count | Exactly 1 use recorded |

---

## Section 8: Data Integrity

### Test 8.1: Balance consistency

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Note shop balance before (e.g., 500 RCN) | — |
| 2 | Note customer balance before (e.g., 161 RCN) | — |
| 3 | Issue 12 RCN reward (10 base + 2 tier) | Success |
| 4 | Shop balance after | 488 RCN (500 - 12) |
| 5 | Customer balance after (mobile) | 173 RCN (161 + 12) |
| 6 | Customer balance after (web) | 173 RCN (matches mobile) |
| 7 | Database: shop `purchased_rcn_balance` | 488 |
| 8 | Database: customer `current_rcn_balance` | 173 |
| 9 | Database: transaction record exists | Type: reward/earn, amount: 12, shop_id correct |

### Test 8.2: Referral trigger on first reward

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Customer registered with referral code | — |
| 2 | Issue first-ever reward to this customer | Referral bonus triggered (25 RCN to referrer, 10 to referee) |
| 3 | Issue second reward | No referral bonus (only triggers on first) |
| 4 | Check referrer's balance | Increased by 25 RCN |

### Test 8.3: Tier upgrade trigger

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Customer near tier threshold (e.g., Bronze → Silver at some earning milestone) | — |
| 2 | Issue reward that pushes past threshold | Customer tier upgrades |
| 3 | Check customer profile | New tier reflected |
| 4 | Next reward | Includes new tier bonus |

### Test 8.4: Atomic rollback

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | If backend partially fails during processing | All changes rolled back |
| 2 | Shop balance unchanged | Not deducted |
| 3 | Customer balance unchanged | Not credited |
| 4 | Promo usage not recorded | Code still available |

---

## Section 9: Web vs Mobile Parity

### Test 9.1: Compare reward amounts

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Issue same reward from web and mobile (same customer, same type) | Same total RCN |
| 2 | Same promo code on web vs mobile | Same bonus calculation |
| 3 | Compare transaction records | Identical amounts in database |

### Test 9.2: Compare UI elements

| Feature | Web | Mobile | Match? |
|---------|-----|--------|--------|
| Customer lookup | ✅ | ✅ | Verify same data shown |
| Tier badge display | ✅ | ✅ | Same tier, same bonus |
| Promo code validation | ✅ | ✅ | Same validation messages |
| Repair type options | ✅ | ✅ | Same presets available |
| Custom amount | ✅ | ✅ | Same min/max limits |
| Recent rewards | ✅ | ✅ | Same entries |
| Error messages | ✅ | ✅ | Same error wording |

---

## Backend Endpoints Reference

| Endpoint | Method | Purpose | Called By |
|----------|--------|---------|-----------|
| `POST /shops/{shopId}/issue-reward` | POST | Issue RCN reward to customer | Shop |
| `POST /shops/{shopId}/promo-codes/validate` | POST | Validate promo code | Shop (real-time) |
| `GET /shops/{shopId}/promo-codes` | GET | List shop's promo codes | Shop |
| `POST /shops/{shopId}/promo-codes` | POST | Create new promo code | Shop |
| `GET /shops/{shopId}/transactions?type=reward&limit=5` | GET | Recent rewards list | Shop |
| `GET /customers/{address}` | GET | Customer profile lookup | Shop |
| `GET /customers/{address}/transactions` | GET | Customer transaction history | Customer |

---

## Promo Code Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | Unique code string (e.g., "SUMMER20") |
| `name` | string | Display name |
| `bonus_type` | "fixed" / "percentage" | How bonus is calculated |
| `bonus_value` | number | Fixed amount or percentage value |
| `max_bonus` | number (optional) | Cap on bonus amount |
| `start_date` | date | When code becomes active |
| `end_date` | date | When code expires |
| `total_usage_limit` | number | Max total uses across all customers |
| `per_customer_limit` | number | Max uses per individual customer |
| `is_active` | boolean | Whether code is currently enabled |
