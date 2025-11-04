# Shop Groups (Off-Chain) - User Flow & Technical Specification

## Overview
Shop Groups allow multiple shops to form coalitions (e.g., "Downtown Bistros", "West Side Auto Shops") and create custom loyalty tokens/points that customers can earn and redeem exclusively within that group. This implementation uses **off-chain tracking** for faster development and lower gas costs.

---

## Business Rules

### Group Tokens
- Each group can create a custom token with:
  - Custom name (e.g., "Downtown Points", "Bistro Bucks")
  - Custom symbol (e.g., "DTP", "BBX")
  - Custom value/exchange rate (optional: 1 group token = X RCN)
- Group tokens are **virtual** - tracked in database, not on blockchain
- Group tokens are **separate** from RCN - customers have both RCN balance AND group token balances

### Group Membership
- Any verified shop can create a group
- Group creator becomes "admin" with management permissions
- Other shops can request to join or be invited
- Group admin can approve/reject join requests
- Shops can be members of multiple groups simultaneously

### Earning Group Tokens
- Customers earn group tokens when serviced at **any member shop** in the group
- Each shop in the group sets their own reward rates for group tokens
- Customers can earn both RCN (platform tokens) AND group tokens in same transaction
- Example: Customer gets car repair at Shop A (member of "Downtown Auto Group")
  - Earns: 50 RCN (platform tokens) + 100 Downtown Points (group tokens)

### Redeeming Group Tokens
- Customers can redeem group tokens at **any member shop** in the group
- Redemption rate is set by the individual shop (e.g., 100 group tokens = $10 off)
- Group tokens cannot be redeemed outside their group
- Redemption does NOT affect customer's RCN balance

### Group Economics
- Group token balances are tracked per customer per group
- No limits on earning/redemption (unless group admin sets rules)
- No blockchain gas fees (all off-chain)
- Groups can set optional treasury rules for revenue sharing

---

## User Flows

### Flow 1: Shop Creates a Group

**Actor:** Shop Owner (Shop A)

**Prerequisites:**
- Shop must be verified and active
- Shop has active subscription

**Steps:**
1. Shop A logs into shop dashboard
2. Navigates to "Groups" or "Partnerships" section
3. Clicks "Create New Group"
4. Fills out group creation form:
   ```
   Group Name: Downtown Bistros
   Description: A coalition of downtown restaurants offering shared rewards
   Custom Token Name: Bistro Bucks
   Custom Token Symbol: BBX
   Initial Token Value: Optional (1 BBX = $0.10)
   Group Logo: Upload image
   Group Type: Public (anyone can request to join) / Private (invite-only)
   ```
5. Reviews terms and conditions for group creation
6. Submits form
7. System creates group with Shop A as admin
8. Shop A sees confirmation: "Group created successfully! Share invite code with other shops."
9. Dashboard shows:
   - Group invite code/link
   - Member management panel (currently just Shop A)
   - Group token analytics (currently 0)

**Success Criteria:**
- Group record created in database
- Shop A listed as admin and member
- Unique invite code generated
- Group token configuration saved

---

### Flow 2: Shop Joins an Existing Group

**Actor:** Shop Owner (Shop B)

**Prerequisites:**
- Shop B is verified and active
- Shop B has invite code/link OR group is public

**Steps:**

#### Option A: Join via Invite Code
1. Shop B receives invite code from Shop A (e.g., "DT-BISTRO-2024")
2. Shop B logs into dashboard
3. Navigates to "Groups" section
4. Clicks "Join Group"
5. Enters invite code: DT-BISTRO-2024
6. System displays group details:
   ```
   Group: Downtown Bistros
   Members: 1 shop (Shop A)
   Token: Bistro Bucks (BBX)
   Type: Private
   ```
7. Shop B clicks "Request to Join"
8. Shop B adds optional message: "We're located downtown and would love to participate!"
9. Submits request
10. Shop B sees: "Request sent! Waiting for admin approval."

#### Option B: Browse Public Groups
1. Shop B navigates to "Groups" > "Discover Groups"
2. Browses list of public groups with filters:
   - Location (city, zip code)
   - Industry (auto repair, restaurants, retail)
   - Number of members
3. Clicks on "Downtown Bistros" group
4. Reviews group details and member list
5. Clicks "Request to Join"
6. (Continue from step 8 above)

**Notification to Group Admin (Shop A):**
- Email: "Shop B requested to join Downtown Bistros"
- Dashboard notification badge
- Details: Shop B name, location, join message

**Admin Approval (Shop A):**
1. Shop A sees notification in dashboard
2. Clicks to review join request
3. Sees Shop B details:
   - Shop name, location, rating
   - Request message
   - Profile link
4. Shop A chooses:
   - **Approve**: Shop B immediately becomes member
   - **Reject**: Shop B receives rejection notification
   - **Request More Info**: Send message to Shop B

**Success Criteria:**
- Join request created in database with "pending" status
- Admin notified
- Upon approval: Shop B becomes active member
- Shop B can now issue and accept group tokens

---

### Flow 3: Customer Earns Group Tokens

**Actor:** Customer (Jane)

**Prerequisites:**
- Jane has RepairCoin customer account
- Jane gets service at a shop that's member of a group

**Steps:**
1. Jane brings her car to Shop A (member of "Downtown Bistros")
2. Shop A employee enters repair details in their dashboard:
   ```
   Customer: Jane (wallet: 0x123...)
   Service: Oil change
   Amount: $50
   ```
3. Shop A employee sets rewards:
   ```
   RCN Tokens: 50 (platform tokens)
   Bistro Bucks: 100 (group tokens)
   ```
4. Shop A clicks "Issue Rewards"
5. System processes transaction:
   - Mints 50 RCN to Jane's wallet (on-chain)
   - Credits 100 BBX to Jane's Downtown Bistros balance (off-chain, database)
6. Shop A sees confirmation
7. Jane receives notification:
   ```
   You earned rewards!
   - 50 RCN tokens
   - 100 Bistro Bucks (Downtown Bistros)

   Your new balances:
   - RCN: 250 tokens
   - Bistro Bucks: 100 tokens
   ```

**In Customer Dashboard:**
1. Jane logs into RepairCoin app
2. Dashboard shows multiple balances:
   ```
   Platform Tokens (RCN): 250

   Group Tokens:
   - Downtown Bistros (BBX): 100 tokens
   - West Side Auto (WSA): 50 tokens
   ```
3. Jane can tap on each group to see:
   - Group name and logo
   - Token balance
   - Member shops (where she can redeem)
   - Recent transactions

**Success Criteria:**
- Off-chain group token balance updated in database
- On-chain RCN tokens minted (existing flow)
- Customer notified via app/email
- Transaction recorded with group_id reference

---

### Flow 4: Customer Redeems Group Tokens

**Actor:** Customer (Jane)

**Prerequisites:**
- Jane has group token balance > 0
- Jane visits a member shop of that group

**Steps:**
1. Jane visits Shop B (also member of "Downtown Bistros")
2. Jane's total bill: $80
3. Jane wants to redeem Bistro Bucks
4. Shop B employee opens redemption interface:
   ```
   Customer: Jane (wallet: 0x123...)
   ```
5. System displays Jane's group token balances:
   ```
   Downtown Bistros (BBX): 100 tokens
   Status: ✓ Eligible (Shop B is member)
   Value: ~$10.00 (at Shop B's rate)
   ```
6. Shop B employee enters redemption:
   ```
   Redeem Amount: 100 BBX
   Cash Value: $10.00
   Final Bill: $70.00
   ```
7. System validates:
   - Jane has sufficient BBX balance ✓
   - Shop B is active member of group ✓
   - Redemption within limits ✓
8. Shop B clicks "Process Redemption"
9. System processes:
   - Deducts 100 BBX from Jane's Downtown Bistros balance (off-chain)
   - Records redemption transaction
   - Updates Shop B's group statistics
10. Jane receives confirmation:
   ```
   Redemption successful!
   - Redeemed: 100 Bistro Bucks
   - Value: $10.00 discount

   New balance:
   - Bistro Bucks: 0 tokens
   ```

**Shop B Dashboard Updates:**
- Total group redemptions: +1
- Total BBX redeemed: +100
- Group analytics updated

**Success Criteria:**
- Customer's group token balance decremented
- Shop's redemption counter incremented
- Transaction recorded with correct group reference
- No blockchain transaction needed (all off-chain)

---

### Flow 5: Customer Tries to Redeem at Non-Member Shop (Error Case)

**Actor:** Customer (Jane)

**Prerequisites:**
- Jane has Downtown Bistros tokens
- Jane visits Shop C (NOT a member of Downtown Bistros)

**Steps:**
1. Jane visits Shop C for service
2. Shop C employee opens redemption interface
3. Employee enters Jane's wallet address
4. System displays:
   ```
   Customer: Jane

   Available Tokens:
   - RCN (Platform): 250 tokens ✓ Can redeem here
   - Downtown Bistros (BBX): 100 tokens ✗ Cannot redeem here

   Reason: Shop C is not a member of Downtown Bistros group
   ```
5. Employee can only process RCN redemption
6. System prevents BBX redemption with clear error message

**Success Criteria:**
- System correctly validates group membership
- Clear error message displayed
- Employee can still process RCN redemption
- No confusing experience for customer

---

### Flow 6: Group Admin Manages Group

**Actor:** Group Admin (Shop A)

**Prerequisites:**
- Shop A is admin of "Downtown Bistros" group

**Admin Dashboard Sections:**

#### A. Member Management
```
Current Members (3):
- Shop A (You) - Admin - Joined Jan 1, 2024
- Shop B - Member - Joined Jan 5, 2024
- Shop D - Member - Joined Jan 10, 2024

Pending Requests (1):
- Shop E - Requested Jan 12, 2024
  [Approve] [Reject] [View Details]

[Invite New Shop]
```

Actions:
- Approve/reject join requests
- Remove members (with confirmation)
- Generate new invite codes
- Promote members to co-admin
- View member activity stats

#### B. Group Token Settings
```
Token Information:
- Name: Bistro Bucks
- Symbol: BBX
- Total Issued: 15,420 BBX
- Total Redeemed: 8,230 BBX
- Active Customer Balances: 7,190 BBX

Recommended Exchange Rate: 1 BBX = $0.10
(Each shop sets their own redemption rate)

[Edit Token Details]
```

Actions:
- Update token name/symbol (if needed)
- Set suggested exchange rate
- View token circulation stats

#### C. Group Analytics
```
Group Performance:
- Total Customers: 245
- Active Customers (last 30 days): 89
- Total Transactions: 1,432
- Total Value Issued: 15,420 BBX (~$1,542)
- Total Value Redeemed: 8,230 BBX (~$823)

Top Performing Shops:
1. Shop B - 6,200 BBX issued
2. Shop A - 5,100 BBX issued
3. Shop D - 4,120 BBX issued

Customer Engagement:
- Repeat customers: 62%
- Cross-shop redemptions: 45%
```

#### D. Group Rules & Settings
```
Group Settings:
- Group Type: [Public / Private]
- Auto-approve requests: [Yes / No]
- Require minimum spend for earning: [Yes / No]
- Daily earning limit per customer: [None / Set Limit]
- Redemption restrictions: [None / Minimum / Maximum]

[Save Settings]
```

---

### Flow 7: Customer Views Group Token Portfolio

**Actor:** Customer (Jane)

**Customer Dashboard:**

```
MY BALANCES

Platform Tokens:
RCN Balance: 250 tokens (~$25.00)
[Redeem at any shop]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

My Group Tokens:

┌─────────────────────────────────┐
│ Downtown Bistros                │
│ 100 BBX (~$10.00)              │
│ 3 member shops nearby           │
│ [View Shops] [Redeem]          │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ West Side Auto                  │
│ 50 WSA (~$5.00)                │
│ 5 member shops nearby           │
│ [View Shops] [Redeem]          │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Eco-Friendly Network            │
│ 200 ECO (~$15.00)              │
│ 8 member shops nearby           │
│ [View Shops] [Redeem]          │
└─────────────────────────────────┘

[Discover More Groups]
```

**Clicking "View Shops" for Downtown Bistros:**
```
DOWNTOWN BISTROS - MEMBER SHOPS

Where you can redeem your 100 BBX:

• Bistro A (Shop A)
  123 Main St, Downtown
  2.5 miles away
  Redemption rate: 1 BBX = $0.10
  [Get Directions] [Call]

• Restaurant B (Shop B)
  456 Oak Ave, Downtown
  3.1 miles away
  Redemption rate: 1 BBX = $0.12
  [Get Directions] [Call]

• Cafe D (Shop D)
  789 Elm St, Downtown
  1.8 miles away
  Redemption rate: 1 BBX = $0.09
  [Get Directions] [Call]

[Back to Balances]
```

---

## Technical Implementation Summary

### Database Schema (New Tables)

```sql
-- Shop groups table
CREATE TABLE shop_groups (
  group_id VARCHAR(100) PRIMARY KEY,
  group_name VARCHAR(255) NOT NULL,
  description TEXT,
  custom_token_name VARCHAR(100) NOT NULL,
  custom_token_symbol VARCHAR(10) NOT NULL,
  token_value_usd NUMERIC(10,4), -- suggested value
  created_by_shop_id VARCHAR(100) REFERENCES shops(shop_id),
  group_type VARCHAR(20) DEFAULT 'public', -- public or private
  logo_url TEXT,
  invite_code VARCHAR(50) UNIQUE,
  auto_approve_requests BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shop group memberships
CREATE TABLE shop_group_members (
  id SERIAL PRIMARY KEY,
  group_id VARCHAR(100) REFERENCES shop_groups(group_id),
  shop_id VARCHAR(100) REFERENCES shops(shop_id),
  role VARCHAR(20) DEFAULT 'member', -- admin, member
  status VARCHAR(20) DEFAULT 'active', -- active, pending, rejected, removed
  joined_at TIMESTAMP,
  request_message TEXT,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_by_shop_id VARCHAR(100) REFERENCES shops(shop_id),
  approved_at TIMESTAMP,
  UNIQUE(group_id, shop_id)
);

-- Customer group token balances (off-chain tracking)
CREATE TABLE customer_group_balances (
  id SERIAL PRIMARY KEY,
  customer_address VARCHAR(42) NOT NULL,
  group_id VARCHAR(100) REFERENCES shop_groups(group_id),
  balance NUMERIC(20,8) DEFAULT 0,
  lifetime_earned NUMERIC(20,8) DEFAULT 0,
  lifetime_redeemed NUMERIC(20,8) DEFAULT 0,
  last_transaction_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_address, group_id)
);

-- Group token transactions
CREATE TABLE group_token_transactions (
  id VARCHAR(100) PRIMARY KEY,
  group_id VARCHAR(100) REFERENCES shop_groups(group_id),
  customer_address VARCHAR(42) NOT NULL,
  shop_id VARCHAR(100) REFERENCES shops(shop_id),
  type VARCHAR(20) NOT NULL, -- earn, redeem
  amount NUMERIC(20,8) NOT NULL,
  balance_before NUMERIC(20,8),
  balance_after NUMERIC(20,8),
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Group settings and rules
CREATE TABLE shop_group_settings (
  group_id VARCHAR(100) PRIMARY KEY REFERENCES shop_groups(group_id),
  daily_earning_limit NUMERIC(20,8),
  minimum_redemption NUMERIC(20,8),
  maximum_redemption NUMERIC(20,8),
  require_minimum_spend BOOLEAN DEFAULT false,
  minimum_spend_amount NUMERIC(10,2),
  settings_json JSONB DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_group_members_shop ON shop_group_members(shop_id);
CREATE INDEX idx_group_members_group ON shop_group_members(group_id);
CREATE INDEX idx_customer_group_balances_customer ON customer_group_balances(customer_address);
CREATE INDEX idx_customer_group_balances_group ON customer_group_balances(group_id);
CREATE INDEX idx_group_transactions_customer ON group_token_transactions(customer_address);
CREATE INDEX idx_group_transactions_group ON group_token_transactions(group_id);
CREATE INDEX idx_group_transactions_shop ON group_token_transactions(shop_id);
```

### Backend Structure

```
backend/src/domains/ShopGroupDomain/
├── index.ts                      # Domain entry point
├── routes.ts                     # API routes
├── controllers/
│   ├── GroupController.ts        # Group CRUD operations
│   ├── MembershipController.ts   # Join/leave/manage members
│   └── GroupTokenController.ts   # Earn/redeem group tokens
├── services/
│   ├── GroupService.ts           # Business logic for groups
│   ├── GroupTokenService.ts      # Token earning/redemption logic
│   └── GroupAnalyticsService.ts  # Group statistics
└── repositories/
    └── ShopGroupRepository.ts    # Database operations
```

### API Endpoints

```
POST   /api/shop-groups                    # Create new group
GET    /api/shop-groups                    # List all public groups
GET    /api/shop-groups/:groupId           # Get group details
PUT    /api/shop-groups/:groupId           # Update group (admin only)
DELETE /api/shop-groups/:groupId           # Delete group (admin only)

POST   /api/shop-groups/:groupId/join      # Request to join group
GET    /api/shop-groups/:groupId/members   # List group members
POST   /api/shop-groups/:groupId/members/:shopId/approve   # Approve member
DELETE /api/shop-groups/:groupId/members/:shopId           # Remove member

POST   /api/shop-groups/tokens/earn        # Issue group tokens to customer
POST   /api/shop-groups/tokens/redeem      # Redeem group tokens
GET    /api/shop-groups/tokens/balance/:customerAddress   # Get customer's all group balances

GET    /api/shop-groups/:groupId/analytics # Get group statistics
GET    /api/shop-groups/:groupId/transactions  # Get group transactions
```

### Key Advantages of Off-Chain Approach

1. **Fast Implementation**: 4-6 weeks vs 13-18 weeks for on-chain
2. **No Gas Fees**: All transactions are database operations
3. **Flexible Rules**: Easy to update group rules without smart contract updates
4. **Better UX**: Instant transactions, no wallet confirmations needed
5. **Lower Cost**: No blockchain deployment or gas costs
6. **Easy Testing**: Standard database testing, no need for testnet
7. **Scalable**: Can handle high transaction volumes

### Potential Concerns & Mitigations

**Concern:** "Is off-chain less secure?"
- **Mitigation**: Same database security as existing RCN purchase tracking. Add audit logs for all group token transactions.

**Concern:** "Can customers transfer group tokens?"
- **Answer**: No, group tokens are non-transferable (like store gift cards). Only earn at member shops, redeem at member shops.

**Concern:** "What if a shop leaves the group?"
- **Mitigation**: Existing customer balances remain. Former member can no longer issue tokens but customers can still redeem at remaining members.

**Concern:** "Can this convert to on-chain later?"
- **Answer**: Yes, if needed. Can deploy ERC20 contracts and migrate balances. Off-chain is MVP.

---

## Development Timeline (Off-Chain)

**Week 1-2:** Database schema + migrations
**Week 3-4:** Backend domain + repositories + API endpoints
**Week 5:** Shop dashboard UI (create/manage groups)
**Week 6:** Customer dashboard UI (view/redeem group tokens)
**Week 7:** Testing + bug fixes
**Week 8:** Production deployment + documentation

**Total: 8 weeks** for full off-chain implementation

---

## Success Metrics

After launch, track:
- Number of groups created
- Average group size (members per group)
- Group token transaction volume
- Customer engagement (% using group tokens vs RCN only)
- Cross-shop redemption rate within groups
- Shop satisfaction with group feature

---

## Future Enhancements (Post-MVP)

1. **Group-to-Group Exchange**: Allow customers to swap tokens between groups
2. **Group Partnerships**: Two groups can have redemption agreements
3. **Tiered Memberships**: Premium vs standard group memberships with different benefits
4. **On-Chain Migration**: Deploy actual ERC20 contracts for groups that want blockchain
5. **Group Governance**: Token-weighted voting for group decisions
6. **Revenue Sharing**: Automated treasury management for group earnings
7. **Group Challenges**: Collaborative goals across member shops with bonus rewards

---

## Questions for Stakeholder Review

1. Should group admins be able to set earning/redemption limits?
2. Can shops be in multiple groups simultaneously? (Suggested: Yes)
3. Should customers see all groups or only groups they have tokens in?
4. Do we need group approval workflow or auto-join for public groups?
5. Should there be a fee for creating groups or joining as a member?
6. What happens to customer balances if a group is dissolved?
7. Should group tokens have expiration dates?

---

**Document Version:** 1.0
**Last Updated:** 2025-11-03
**Status:** Draft for Review
