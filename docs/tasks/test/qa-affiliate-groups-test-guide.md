# QA Test Guide: Affiliate Shop Groups

## Date: 2026-04-08
## Feature: /shop?tab=groups (Affiliate Groups)
## Category: Comprehensive QA Guide

---

## Feature Overview

Affiliate Groups allow shops to form coalitions with custom tokens. Shops create or join groups, link their services, and customers earn group-specific tokens (in addition to RCN) when booking linked services. Groups have their own token name/symbol, membership management, analytics, and RCN allocation backing.

---

## Complete Workflow

```
Shop creates group (token name, symbol, description)
  → Group created with invite code
  → Other shops join via invite code or browse
  → Admin approves/rejects join requests
  → Members link their services to the group
    → Set reward percentage (0-500%) and bonus multiplier (0-10x)
  → Members allocate RCN to back token issuance
  → Customer books a linked service → completes booking
    → Earns RCN (normal) + group tokens (automatic)
  → Customer sees group token balance on dashboard
  → Shop can also manually issue/redeem tokens
  → Analytics track issuance, redemption, active customers
```

---

## Section 1: Group Creation

### Test 1.1: Create a new group
1. Login as shop → Groups tab → click **"Create Group"**
2. Fill in:
   - Group Name: "Test QA Group"
   - Token Name: "QA Token"
   - Token Symbol: "QAT"
   - Description: "Testing group creation"
   - Select an icon
3. Click Create
4. **Expected**: Group appears in "My Groups" tab with you as admin
5. **Expected**: Invite code is generated

### Test 1.2: Validation
1. Try creating with empty name → **Expected**: Validation error
2. Try creating with symbol > 10 chars → **Expected**: Rejected
3. Try creating without active subscription → **Expected**: Blocked

### Test 1.3: Duplicate prevention
1. Try creating another group with same name
2. **Expected**: Either allowed (groups can share names) or appropriate error

---

## Section 2: Group Discovery & Joining

### Test 2.1: Browse available groups
1. Click **"Discover Groups"** tab
2. **Expected**: Shows all public groups with member count, token info
3. Private groups show limited info

### Test 2.2: Join by invite code
1. Get invite code from another shop's group
2. Click **"Join Group"** → enter invite code
3. **Expected**: Join request submitted (pending or auto-approved based on group settings)

### Test 2.3: Join request approval
1. Login as group admin
2. Go to group → Members tab
3. See pending join request → click **Approve** or **Reject**
4. **Expected**: Member status updates, approved member gains access

### Test 2.4: Remove member
1. As group admin → Members tab → click remove on a member
2. **Expected**: Member removed, loses access to group features

---

## Section 3: Service-Group Linking

### Test 3.1: Link a service to a group
1. Go to a service → Settings or Group Rewards section
2. Select a group to link
3. Set Token Reward Percentage (e.g., 100%)
4. Set Bonus Multiplier (e.g., 1.5x)
5. Click Link/Save
6. **Expected**: Service now shows purple group badge on marketplace

### Test 3.2: Update reward settings
1. Edit linked service → change percentage to 200%, multiplier to 2x
2. Save → **Expected**: New settings applied to future bookings

### Test 3.3: Unlink service from group
1. Remove the service-group link
2. **Expected**: Purple badge disappears from service card
3. **Expected**: Future bookings don't issue group tokens

### Test 3.4: Customer sees group badge
1. Login as customer → Marketplace
2. Find the linked service
3. **Expected**: Purple badge shows token symbol (e.g., "QAT+")
4. **Expected**: Hover/tap shows "Earn QAT tokens when you book"

---

## Section 4: Customer Token Earning (Automatic)

### Test 4.1: Book a linked service → earn group tokens
1. Login as customer → book a service linked to a group
2. Complete payment via Stripe
3. Shop marks order as **"Completed"**
4. **Expected**: Customer earns both RCN AND group tokens automatically
5. **Expected**: Group token amount = price × (rewardPercentage / 100) × bonusMultiplier
6. Example: $100 service, 100% reward, 1.5x multiplier = 150 group tokens

### Test 4.2: Verify token balance
1. Check customer's group token balance via API or dashboard
2. **Expected**: Balance matches calculated amount
3. **Expected**: Transaction recorded in group transaction history

### Test 4.3: Multiple groups on one service
1. Link a service to 2 different groups
2. Customer books and completes the service
3. **Expected**: Tokens issued for BOTH groups simultaneously

---

## Section 5: Manual Token Operations (Shop)

### Test 5.1: Issue tokens manually
1. As group admin → Group Details → Token Operations tab
2. Enter customer wallet address and amount (e.g., 50)
3. Click "Issue Tokens"
4. **Expected**: Customer balance increases by 50
5. **Expected**: Transaction recorded with reason

### Test 5.2: Redeem tokens manually
1. Same tab → enter customer address and redemption amount
2. Click "Redeem"
3. **Expected**: Customer balance decreases
4. **Expected**: Transaction recorded as "redeem" type

### Test 5.3: Insufficient balance redemption
1. Try redeeming more tokens than customer has
2. **Expected**: Error — insufficient balance

### Test 5.4: RCN backing required
1. Try issuing tokens without sufficient RCN allocation
2. **Expected**: Error — insufficient RCN allocation

---

## Section 6: RCN Allocation

### Test 6.1: Allocate RCN to group
1. Group Details → RCN Allocation section
2. Enter amount to allocate (e.g., 100 RCN)
3. **Expected**: RCN deducted from shop balance, added to group allocation
4. **Expected**: Available allocation shows for token issuance

### Test 6.2: Deallocate RCN from group
1. Remove allocation → enter amount to deallocate
2. **Expected**: RCN returned to shop balance
3. **Expected**: Cannot deallocate more than available (minus already used)

### Test 6.3: Allocation limits issuance
1. Allocate only 10 RCN
2. Try issuing 100 group tokens (requires more RCN backing)
3. **Expected**: Error — insufficient allocation

---

## Section 7: Group Analytics

### Test 7.1: Analytics dashboard
1. Group Details → Analytics tab
2. **Expected**: Shows total tokens issued, tokens redeemed, active members, unique customers

### Test 7.2: Member activity stats
1. View member activity breakdown
2. **Expected**: Shows each member's token issuance/redemption contribution

### Test 7.3: Transaction trends
1. View trends chart
2. **Expected**: Shows daily/weekly transaction volume over time

---

## Section 8: Customer Discovery (Marketplace)

### Test 8.1: Discover Group Rewards dropdown
1. Login as customer → Marketplace
2. **Expected**: "Discover Group Rewards" dropdown shows only groups with active linked services
3. Select a group → **Expected**: Filters to show only services linked to that group

### Test 8.2: Group filter shows correct services
1. Select group "CODEBILITY" from dropdown
2. **Expected**: Only CODEBILITY-linked services appear
3. Select "All Services" → full marketplace returns

### Test 8.3: Empty group handling
1. If a group has no linked services
2. **Expected**: Group does NOT appear in dropdown

---

## Section 9: Group Transactions & History

### Test 9.1: View group transactions
1. Group Details → Transactions tab
2. **Expected**: Shows all earn/redeem transactions with customer, amount, date, shop
3. Filter by type (earn/redeem) → works correctly

### Test 9.2: Customer-specific transactions
1. Click a customer → view their transaction history within this group
2. **Expected**: Shows only that customer's transactions

---

## Section 10: Membership & Permissions

### Test 10.1: Admin vs member permissions
1. As group **admin**: can approve/reject members, update group, view analytics
2. As group **member**: can issue/redeem tokens, view transactions, link services
3. As **non-member**: limited view (no token operations, no analytics)

### Test 10.2: Pending member view
1. Request to join a group (status: pending)
2. **Expected**: Can see group overview but restricted from token operations and analytics

### Test 10.3: Private group access
1. View a private group as non-member
2. **Expected**: Limited info shown (no invite code, no token details)

---

## Section 11: Edge Cases

### Test 11.1: Group with no members issuing tokens
1. All members leave a group
2. **Expected**: No one can issue tokens

### Test 11.2: Customer balance across multiple groups
1. Customer earns tokens in Group A and Group B
2. **Expected**: Separate balances maintained per group
3. **Expected**: Customer dashboard shows all group balances

### Test 11.3: Deactivated service still has group link
1. Deactivate a service that's linked to a group
2. **Expected**: Service doesn't appear in marketplace or group filter
3. **Expected**: Existing completed orders still have their tokens

### Test 11.4: Shop subscription expires
1. Shop's subscription expires while being a group member
2. **Expected**: Cannot issue tokens or create groups
3. **Expected**: Existing group data preserved

---

## Smoke Test (Minimum Coverage)

1. **Create group** → verify it appears in My Groups with invite code
2. **Link service** → verify purple badge on marketplace
3. **Customer books linked service** → shop completes → verify group tokens earned
4. **Issue tokens manually** → verify balance updates
5. **Customer marketplace filter** → select group → correct services shown
6. **Analytics** → shows token issuance data
