# RCG Token (RepairCoin Governance) - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Tokenomics](#tokenomics)
3. [Current Implementation Status](#current-implementation-status)
4. [Missing Features](#missing-features)
5. [Technical Architecture](#technical-architecture)
6. [Implementation Roadmap](#implementation-roadmap)
7. [Smart Contracts Required](#smart-contracts-required)
8. [API Endpoints](#api-endpoints)
9. [Database Schema](#database-schema)
10. [Quick Wins](#quick-wins)

---

## Overview

**RCG (RepairCoin Governance)** is the governance and utility token for the RepairCoin ecosystem. It provides:

- **Shop Tier Benefits**: Discounted RCN purchasing based on RCG holdings
- **Staking Rewards**: 10% of platform revenue distributed to RCG stakers
- **Governance Rights**: Vote on platform decisions and treasury allocation
- **Revenue Sharing**: Participate in platform growth

### Key Metrics
- **Total Supply**: 100,000,000 RCG (fixed)
- **Contract Address (Base Sepolia)**: `0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D`
- **Token Standard**: ERC-20
- **Network**: Base Mainnet / Base Sepolia (testnet)

---

## Tokenomics

### Supply Allocation (Proposed)

```
Total Supply: 100,000,000 RCG (100M)

Allocation Breakdown:
├─ Team & Advisors: 15M RCG (15%)
│  └─ 3-year vesting with 1-year cliff
├─ Investors: 20M RCG (20%)
│  └─ 2-year vesting with 6-month cliff
├─ Public Sale: 25M RCG (25%)
│  └─ Immediate unlock
├─ DAO Treasury: 20M RCG (20%)
│  └─ Controlled by governance
├─ Staking Rewards: 15M RCG (15%)
│  └─ Released over 5 years
└─ Ecosystem & Partners: 5M RCG (5%)
   └─ Strategic partnerships and ecosystem growth
```

### Revenue Distribution Model

**Every RCN purchase by shops generates revenue split 3 ways:**

```
Total Revenue (100%)
├─ Operations: 80% - Company operations and growth
├─ Stakers: 10% - Distributed to RCG stakers proportionally
└─ DAO Treasury: 10% - Community-controlled funds
```

### Shop Tier System

RCG holdings determine shop tier and RCN purchase pricing:

| Tier | RCG Required | RCN Price | Discount | Annual Benefit* |
|------|--------------|-----------|----------|----------------|
| **Standard** | 10,000 - 49,999 | $0.10 | 0% | Base pricing |
| **Premium** | 50,000 - 199,999 | $0.08 | 20% | $2,000/year |
| **Elite** | 200,000+ | $0.06 | 40% | $4,000/year |

*Based on 100,000 RCN purchases/year at $0.10 base price

---

## Current Implementation Status

### ✅ What's Already Implemented

#### 1. Backend Services

**RCGService** (`backend/src/services/RCGService.ts`)
- Get shop tier info based on RCG balance
- Calculate tier distribution across all shops
- Get RCG metrics (supply, holders, revenue impact)
- Update shop tiers automatically

**RevenueDistributionService** (`backend/src/services/RevenueDistributionService.ts`)
- Calculate 80/10/10 revenue split
- Tier pricing calculation
- Projected staker revenue calculator
- Revenue report generation

**RCGTokenReader** (`backend/src/contracts/RCGTokenReader.ts`)
- Read RCG balances from blockchain
- Get shop tier from RCG balance
- Contract stats (supply, allocations)

#### 2. Database Schema

**Tables Created:**
```sql
-- Shops table (RCG columns)
shops.rcg_tier              VARCHAR(20)     -- Shop tier: standard/premium/elite
shops.rcg_balance           NUMERIC(20,8)   -- Current RCG balance
shops.rcg_staked_at         TIMESTAMP       -- When RCG was staked
shops.tier_updated_at       TIMESTAMP       -- Last tier update

-- Revenue tracking
revenue_distributions (
  week_start, week_end,
  total_rcn_sold, total_revenue_usd,
  operations_share, stakers_share, dao_treasury_share,
  distributed, distributed_at
)

-- Staking records (ready but empty)
rcg_staking (
  wallet_address, staked_amount,
  staked_at, unlock_date,
  rewards_claimed, last_claim_at
)
```

**Database Triggers:**
- `update_shop_tier_trigger` - Auto-updates shop tier when RCG balance changes

#### 3. Smart Contracts

**Deployed Contracts:**
- RCG Token (ERC-20): `0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D`
  - Fixed 100M supply
  - Standard ERC-20 functionality
  - Ownership controls

#### 4. Backend Integration

**Shop Purchase Flow:**
```typescript
// When shop purchases RCN:
1. Check shop's RCG balance from blockchain
2. Determine tier (Standard/Premium/Elite)
3. Calculate price based on tier
4. Process payment
5. Calculate 80/10/10 revenue split
6. Record in database
```

**API Endpoints (Existing):**
- `GET /api/shops/:shopId/rcg/tier-info` - Get shop tier and benefits
- `GET /api/admin/rcg/metrics` - RCG platform metrics
- `GET /api/admin/rcg/tier-distribution` - Shop tier breakdown
- `GET /api/shops/:shopId/rcg/balance` - Shop RCG balance

---

## Missing Features

### ❌ Critical Missing Features

#### 1. RCG Staking System
**Status**: ⭕ NOT IMPLEMENTED

**What's Needed:**
- **Smart Contract**: Staking20 contract for RCG
  - Stake RCG tokens
  - Lock periods: 30/60/90/180 days
  - APR multipliers based on lock period
  - Emergency unstake (with penalty)

- **Backend APIs**:
  - `POST /api/rcg/stake` - Stake RCG tokens
  - `POST /api/rcg/unstake` - Unstake RCG tokens
  - `POST /api/rcg/claim-rewards` - Claim staking rewards
  - `GET /api/rcg/staking-info/:address` - Get staking details
  - `GET /api/rcg/rewards/:address` - Calculate pending rewards

- **Frontend UI**:
  - Staking dashboard page
  - Stake/unstake modals
  - Rewards display
  - Lock period selection
  - APR calculator

**Business Logic:**
```typescript
Staking Tiers:
├─ 30 days lock → 5% APR
├─ 60 days lock → 8% APR
├─ 90 days lock → 12% APR
└─ 180 days lock → 20% APR

Rewards Pool: 10% of all RCN purchase revenue
Distribution: Weekly or monthly to all stakers proportionally
```

**Priority**: 🔴 CRITICAL

---

#### 2. DAO Governance System
**Status**: ⭕ NOT IMPLEMENTED

**What's Needed:**
- **Smart Contract**: Governance contract
  - Create proposals
  - Vote on proposals (1 RCG = 1 vote)
  - Execute approved proposals
  - Timelock for security

- **Backend APIs**:
  - `POST /api/governance/proposals` - Create proposal
  - `GET /api/governance/proposals` - List proposals
  - `POST /api/governance/vote` - Vote on proposal
  - `POST /api/governance/execute` - Execute approved proposal
  - `GET /api/governance/voting-power/:address` - Get voting power

- **Database Tables**:
```sql
governance_proposals (
  id, title, description, proposer_address,
  voting_starts, voting_ends,
  for_votes, against_votes, abstain_votes,
  quorum_required, execution_data,
  status, executed_at
)

governance_votes (
  proposal_id, voter_address,
  vote_type, voting_power,
  voted_at
)
```

- **Frontend UI**:
  - Governance portal
  - Proposal creation form
  - Voting interface
  - Proposal history
  - Voting power display

**Proposal Types:**
```typescript
1. Treasury Allocation
   - Spend DAO treasury funds
   - Requires majority vote

2. Platform Parameters
   - Change RCN pricing
   - Adjust revenue split
   - Modify tier thresholds

3. Feature Funding
   - Vote on new features
   - Allocate development budget

4. Emergency Actions
   - Pause contracts
   - Security responses
```

**Priority**: 🟡 MEDIUM

---

#### 3. RCG Token Distribution
**Status**: ⭕ NOT IMPLEMENTED

**What's Needed:**
- **Vesting Contracts**:
  - Team vesting (3 years, 1-year cliff)
  - Investor vesting (2 years, 6-month cliff)
  - Linear unlock schedules

- **Claim Portal**:
  - Check vested amount
  - Claim available tokens
  - View vesting schedule

- **Initial Distribution**:
  - Airdrop to early users
  - Public sale mechanism
  - Liquidity pool seeding

**Backend APIs**:
- `GET /api/rcg/vesting/:address` - Check vesting schedule
- `POST /api/rcg/claim-vested` - Claim vested tokens
- `GET /api/rcg/allocation/:address` - Check total allocation

**Priority**: 🔴 CRITICAL (before mainnet)

---

#### 4. Automated Revenue Distribution
**Status**: ⭕ NOT IMPLEMENTED

**What's Needed:**
- **Cron Jobs**:
```typescript
Weekly/Monthly Job:
1. Query all shop RCN purchases for period
2. Calculate total revenue by tier
3. Calculate 80/10/10 split
4. Distribute 10% to stakers proportionally
5. Transfer 10% to DAO treasury
6. Update revenue_distributions table
7. Emit staker notification events
```

- **Backend Services**:
  - `RevenueDistributionService.distributeRewards()`
  - Gas optimization for batch transfers
  - Failed distribution retry logic

- **Notification System**:
  - Email stakers when rewards available
  - Discord/Telegram notifications
  - In-app notifications

**Priority**: 🟠 HIGH

---

#### 5. Frontend RCG Features
**Status**: ⭕ NOT IMPLEMENTED

**Missing Pages:**

**A. Shop Dashboard - RCG Section**
- Display current tier badge
- Show RCG balance
- List tier benefits
- "Upgrade Tier" CTA with calculator
- RCN pricing preview

**B. Staking Portal** (`/staking`)
- Stake RCG interface
- Current staked amount
- Pending rewards
- Claim rewards button
- Lock period selection
- APR calculator
- Staking history

**C. Governance Portal** (`/governance`)
- Active proposals list
- Vote on proposals
- Create proposal (if qualified)
- Voting history
- DAO treasury balance
- Governance stats

**D. RCG Info Page** (`/rcg`)
- What is RCG?
- Tokenomics breakdown
- Tier benefits
- Staking rewards
- Governance rights
- How to acquire RCG

**E. Admin - RCG Metrics**
- Total supply metrics
- Circulating supply
- Top holders
- Tier distribution chart
- Revenue by tier
- Staker reward history
- DAO treasury transactions

**Priority**: 🔴 CRITICAL

---

#### 6. RCG Marketplace/Liquidity
**Status**: ⭕ NOT IMPLEMENTED

**What's Needed:**
- **DEX Listing**:
  - Create Uniswap V3 pool (RCG/USDC)
  - Add initial liquidity ($50k-100k)
  - Set price discovery mechanisms

- **Frontend Integration**:
  - Swap widget (buy RCG directly in app)
  - Price chart
  - Liquidity pool stats
  - Provide liquidity interface

- **Price Oracle**:
  - Chainlink price feed integration
  - TWAP calculation for governance
  - Price history API

**Backend APIs**:
- `GET /api/rcg/price` - Current RCG price
- `GET /api/rcg/liquidity` - Pool stats
- `GET /api/rcg/price-history` - Historical prices

**Priority**: 🟡 MEDIUM

---

#### 7. Multi-Sig Treasury Management
**Status**: 🟢 PARTIALLY IMPLEMENTED

**What's Done:**
- Gnosis Safe created: `0x35b4bA3c4B9A8D1E495cF49264Ce72514B7070B8`
- 2-of-4 multi-sig configured
- Safe has ADMIN role on contracts

**What's Missing:**
- Automated 10% revenue deposits to Safe
- Governance-triggered treasury operations
- Treasury reporting dashboard
- Safe transaction history integration

**Priority**: 🟠 HIGH

---

## Technical Architecture

### Smart Contract Stack

```
RCG Ecosystem Contracts:

┌─────────────────────────────────────────────┐
│  RCG Token (ERC-20)                         │
│  0xdaFC...9D (Base Sepolia)                 │
│  - 100M fixed supply                        │
│  - Transfer, approve, etc.                  │
└─────────────────────────────────────────────┘
            │
            ├─────────────────────────────────┐
            │                                 │
            ▼                                 ▼
┌───────────────────────┐      ┌──────────────────────────┐
│  Staking Contract     │      │  Governance Contract     │
│  (Staking20)          │      │  (Governor)              │
│                       │      │                          │
│  - Stake RCG          │      │  - Create proposals      │
│  - Lock periods       │      │  - Vote (1 RCG = 1 vote) │
│  - Claim rewards      │      │  - Execute proposals     │
│  - APR multipliers    │      │  - Timelock              │
└───────────────────────┘      └──────────────────────────┘
            │                                 │
            └────────┬────────────────────────┘
                     ▼
        ┌─────────────────────────┐
        │  Treasury (Gnosis Safe) │
        │  Multi-sig Wallet       │
        │                         │
        │  - 10% revenue deposits │
        │  - Governance-controlled│
        │  - 2-of-4 signatures    │
        └─────────────────────────┘
```

### Backend Architecture

```typescript
// Domain Structure
backend/src/
├── contracts/
│   ├── RCGTokenReader.ts        // Read RCG balances (✅)
│   ├── RCGStakingContract.ts    // Staking operations (❌)
│   └── GovernanceContract.ts    // Governance operations (❌)
│
├── services/
│   ├── RCGService.ts                    // RCG core logic (✅)
│   ├── RevenueDistributionService.ts    // Revenue calc (✅)
│   ├── StakingService.ts                // Staking logic (❌)
│   ├── GovernanceService.ts             // Governance logic (❌)
│   └── RewardDistributionService.ts     // Auto-rewards (❌)
│
├── repositories/
│   ├── RCGStakingRepository.ts     // Staking DB ops (❌)
│   ├── GovernanceRepository.ts     // Governance DB ops (❌)
│   └── RevenueRepository.ts        // Revenue tracking (✅)
│
└── domains/
    └── rcg/
        ├── routes/
        │   ├── staking.ts       // Staking endpoints (❌)
        │   ├── governance.ts    // Governance endpoints (❌)
        │   └── metrics.ts       // Metrics endpoints (✅)
        │
        └── controllers/
            ├── StakingController.ts      (❌)
            ├── GovernanceController.ts   (❌)
            └── MetricsController.ts      (✅)
```

### Frontend Architecture

```typescript
frontend/src/
├── app/
│   ├── staking/
│   │   └── page.tsx             // Staking portal (❌)
│   ├── governance/
│   │   └── page.tsx             // Governance portal (❌)
│   └── rcg/
│       └── page.tsx             // RCG info page (❌)
│
├── components/
│   ├── rcg/
│   │   ├── StakingCard.tsx      // Stake interface (❌)
│   │   ├── GovernanceCard.tsx   // Governance UI (❌)
│   │   ├── TierBadge.tsx        // Shop tier display (❌)
│   │   └── RCGPriceWidget.tsx   // Price display (❌)
│   │
│   └── shop/
│       └── RCGTierSection.tsx   // Shop dashboard tier (❌)
│
└── stores/
    ├── rcgStore.ts              // RCG state (❌)
    ├── stakingStore.ts          // Staking state (❌)
    └── governanceStore.ts       // Governance state (❌)
```

---

## Implementation Roadmap

### Phase 1: Smart Contract Development (4-6 weeks)
**Priority**: 🔴 CRITICAL

**Tasks:**
1. **Week 1-2: Staking Contract**
   - [ ] Deploy Staking20 contract on Base Sepolia
   - [ ] Implement lock periods (30/60/90/180 days)
   - [ ] Add APR multipliers
   - [ ] Test stake/unstake/claim flows
   - [ ] Security audit (internal)

2. **Week 3-4: Governance Contract**
   - [ ] Deploy Governor contract
   - [ ] Implement proposal creation
   - [ ] Add voting mechanism (1 RCG = 1 vote)
   - [ ] Implement timelock
   - [ ] Test proposal lifecycle

3. **Week 5-6: Vesting & Treasury**
   - [ ] Deploy vesting contracts for team/investors
   - [ ] Configure Gnosis Safe as DAO treasury
   - [ ] Add Safe as ADMIN on all contracts
   - [ ] Test multi-sig flows
   - [ ] Prepare for external audit

**Deliverables:**
- Deployed and tested contracts on Base Sepolia
- Contract documentation
- Security audit report
- Admin guides

---

### Phase 2: Staking System (3-4 weeks)
**Priority**: 🔴 CRITICAL

**Tasks:**
1. **Week 1: Backend Services**
   - [ ] Create StakingService
   - [ ] Build StakingRepository
   - [ ] Add staking API endpoints
   - [ ] Implement reward calculation logic
   - [ ] Add transaction monitoring

2. **Week 2-3: Frontend**
   - [ ] Build staking dashboard page
   - [ ] Create stake/unstake modals
   - [ ] Add rewards display
   - [ ] Implement lock period selector
   - [ ] Add APR calculator
   - [ ] Build staking history view

3. **Week 4: Testing & Launch**
   - [ ] End-to-end testing
   - [ ] Load testing
   - [ ] User acceptance testing
   - [ ] Deploy to production
   - [ ] Monitor and fix issues

**Deliverables:**
- Fully functional staking system
- User documentation
- Analytics dashboard
- Support runbook

---

### Phase 3: Revenue Distribution (2 weeks)
**Priority**: 🟠 HIGH

**Tasks:**
1. **Week 1: Automation**
   - [ ] Build automated distribution service
   - [ ] Create cron job for weekly payouts
   - [ ] Add gas optimization
   - [ ] Implement retry logic
   - [ ] Add monitoring/alerting

2. **Week 2: Reporting**
   - [ ] Build distribution dashboard
   - [ ] Add staker notifications
   - [ ] Create revenue reports
   - [ ] Add historical data views
   - [ ] Launch and monitor

**Deliverables:**
- Automated weekly staker rewards
- Distribution reports
- Notification system
- Admin monitoring tools

---

### Phase 4: Governance System (3-4 weeks)
**Priority**: 🟡 MEDIUM

**Tasks:**
1. **Week 1: Backend**
   - [ ] GovernanceService implementation
   - [ ] Database schema for proposals/votes
   - [ ] API endpoints
   - [ ] Proposal execution logic

2. **Week 2-3: Frontend**
   - [ ] Governance portal page
   - [ ] Proposal creation form
   - [ ] Voting interface
   - [ ] Results visualization
   - [ ] History and stats

3. **Week 4: Testing & Launch**
   - [ ] Test with mock proposals
   - [ ] Community testing
   - [ ] Launch first real proposal
   - [ ] Document governance process

**Deliverables:**
- Working governance system
- Community guidelines
- Proposal templates
- Governance documentation

---

### Phase 5: Token Distribution (2-3 weeks)
**Priority**: 🔴 CRITICAL (before mainnet)

**Tasks:**
1. **Week 1: Vesting Portal**
   - [ ] Build claim interface
   - [ ] Add vesting schedule display
   - [ ] Implement claim functionality
   - [ ] Add notifications

2. **Week 2: Initial Distribution**
   - [ ] Distribute to team/investors
   - [ ] Public sale (if applicable)
   - [ ] Seed liquidity pools
   - [ ] Airdrop to early users

3. **Week 3: Monitoring**
   - [ ] Track claims
   - [ ] Monitor for issues
   - [ ] Provide support
   - [ ] Generate reports

**Deliverables:**
- Token distribution complete
- Vesting portal live
- Distribution reports
- Support documentation

---

### Phase 6: DEX Listing & Liquidity (1-2 weeks)
**Priority**: 🟡 MEDIUM

**Tasks:**
1. **Week 1: DEX Setup**
   - [ ] Create Uniswap V3 pool
   - [ ] Add initial liquidity ($50k-100k)
   - [ ] Configure fee tiers
   - [ ] Set price ranges

2. **Week 2: Integration**
   - [ ] Add swap widget to frontend
   - [ ] Integrate price feeds
   - [ ] Add liquidity provider interface
   - [ ] Launch marketing campaign

**Deliverables:**
- Live DEX listing
- Integrated swap functionality
- Price discovery
- Liquidity incentives

---

## Smart Contracts Required

### 1. RCG Staking Contract
**Template**: Thirdweb Staking20 or custom

```solidity
contract RCGStaking {
    // Stake RCG tokens with lock period
    function stake(uint256 amount, uint256 lockPeriod) external;

    // Unstake after lock period ends
    function unstake(uint256 stakeId) external;

    // Emergency unstake with penalty
    function emergencyUnstake(uint256 stakeId) external;

    // Claim accumulated rewards
    function claimRewards() external;

    // View staking info
    function getStakeInfo(address user) external view returns (StakeInfo);

    // Calculate pending rewards
    function getPendingRewards(address user) external view returns (uint256);

    // Admin: Deposit rewards
    function depositRewards(uint256 amount) external onlyAdmin;
}

struct StakeInfo {
    uint256 amount;
    uint256 stakedAt;
    uint256 unlockAt;
    uint256 rewardsClaimed;
    uint256 lockPeriod; // 30/60/90/180 days
    uint256 aprMultiplier; // 5%/8%/12%/20%
}
```

**Key Features:**
- Multiple lock periods with different APRs
- Proportional reward distribution
- Emergency unstake (50% penalty)
- Gas-optimized batch operations

---

### 2. Governance Contract
**Template**: OpenZeppelin Governor

```solidity
contract RCGGovernance is Governor {
    // Create proposal
    function propose(
        address[] targets,
        uint256[] values,
        bytes[] calldatas,
        string description
    ) external returns (uint256 proposalId);

    // Vote on proposal
    function castVote(uint256 proposalId, uint8 support) external;

    // Execute approved proposal
    function execute(
        address[] targets,
        uint256[] values,
        bytes[] calldatas,
        bytes32 descriptionHash
    ) external payable;

    // Voting power based on RCG holdings
    function getVotes(address account) public view returns (uint256);
}

struct Proposal {
    uint256 id;
    address proposer;
    string description;
    uint256 forVotes;
    uint256 againstVotes;
    uint256 abstainVotes;
    uint256 votingStarts;
    uint256 votingEnds;
    bool executed;
}
```

**Key Features:**
- 1 RCG = 1 vote
- 7-day voting period
- 10% quorum requirement
- 48-hour timelock before execution
- Proposal types for treasury, params, features

---

### 3. Vesting Contract
**Template**: OpenZeppelin VestingWallet

```solidity
contract RCGVesting {
    // Set up vesting schedule
    function createVestingSchedule(
        address beneficiary,
        uint256 totalAmount,
        uint256 cliff,
        uint256 duration
    ) external onlyAdmin;

    // Claim vested tokens
    function claim() external;

    // Check vested amount
    function getVestedAmount(address beneficiary) external view returns (uint256);

    // Check claimable amount
    function getClaimableAmount(address beneficiary) external view returns (uint256);
}

struct VestingSchedule {
    uint256 totalAmount;
    uint256 startTime;
    uint256 cliff;
    uint256 duration;
    uint256 claimed;
}
```

**Vesting Schedules:**
- Team: 3-year linear, 1-year cliff
- Investors: 2-year linear, 6-month cliff
- Advisors: 2-year linear, 3-month cliff

---

### 4. Treasury (Gnosis Safe)
**Already Created**: `0x35b4bA3c4B9A8D1E495cF49264Ce72514B7070B8`

**Configuration:**
- 2-of-4 multi-sig
- Controlled by governance for major decisions
- Receives 10% of platform revenue automatically
- Used for:
  - Ecosystem grants
  - Marketing campaigns
  - Development funding
  - Emergency reserves

---

## API Endpoints

### Staking Endpoints (To Build)

```typescript
// Stake RCG tokens
POST /api/rcg/stake
Body: {
  amount: number,
  lockPeriod: 30 | 60 | 90 | 180  // days
}
Response: {
  stakeId: string,
  txHash: string,
  unlockDate: string,
  apr: number
}

// Unstake RCG tokens
POST /api/rcg/unstake
Body: {
  stakeId: string,
  emergency: boolean  // false = normal, true = emergency (penalty)
}
Response: {
  amount: number,
  penalty: number,
  txHash: string
}

// Claim staking rewards
POST /api/rcg/claim-rewards
Response: {
  amount: number,
  txHash: string
}

// Get staking info
GET /api/rcg/staking/:address
Response: {
  totalStaked: number,
  activeStakes: StakeInfo[],
  pendingRewards: number,
  totalRewardsClaimed: number,
  averageAPR: number
}

// Get staking statistics
GET /api/rcg/staking/stats
Response: {
  totalStaked: number,
  totalStakers: number,
  averageAPR: number,
  totalRewardsDistributed: number,
  nextDistribution: string
}
```

---

### Governance Endpoints (To Build)

```typescript
// Create proposal
POST /api/governance/proposals
Body: {
  title: string,
  description: string,
  type: 'treasury' | 'parameter' | 'feature',
  actions: ProposalAction[]
}
Response: {
  proposalId: string,
  votingStarts: string,
  votingEnds: string
}

// Vote on proposal
POST /api/governance/vote
Body: {
  proposalId: string,
  vote: 'for' | 'against' | 'abstain'
}
Response: {
  txHash: string,
  votingPower: number
}

// Get proposals
GET /api/governance/proposals?status=active&page=1&limit=10
Response: {
  proposals: Proposal[],
  total: number,
  page: number
}

// Get proposal details
GET /api/governance/proposals/:id
Response: {
  proposal: Proposal,
  votes: Vote[],
  canExecute: boolean
}

// Execute proposal
POST /api/governance/execute/:id
Response: {
  txHash: string,
  executedAt: string
}

// Get voting power
GET /api/governance/voting-power/:address
Response: {
  votingPower: number,
  rcgBalance: number,
  delegatedTo: string | null
}
```

---

### Metrics Endpoints (Existing)

```typescript
// Get RCG metrics (✅ Exists)
GET /api/admin/rcg/metrics
Response: {
  totalSupply: string,
  circulatingSupply: string,
  allocations: {...},
  shopTierDistribution: {...},
  topHolders: [...],
  revenueImpact: {...}
}

// Get shop tier info (✅ Exists)
GET /api/shops/:shopId/rcg/tier-info
Response: {
  shopId: number,
  walletAddress: string,
  rcgBalance: string,
  tier: string,
  rcnPrice: number,
  tierBenefits: string[]
}

// Get tier distribution (✅ Exists)
GET /api/admin/rcg/tier-distribution
Response: {
  standard: number,
  premium: number,
  elite: number,
  none: number,
  total: number
}
```

---

## Database Schema

### Existing Tables

```sql
-- Shops table (RCG columns)
CREATE TABLE shops (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42),
  rcg_tier VARCHAR(20) DEFAULT 'STANDARD',
  rcg_balance NUMERIC(20,8) DEFAULT 0,
  rcg_staked_at TIMESTAMP,
  tier_updated_at TIMESTAMP,
  operational_status VARCHAR(50)
);

-- Revenue distributions
CREATE TABLE revenue_distributions (
  id SERIAL PRIMARY KEY,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  total_rcn_sold NUMERIC(18,2) NOT NULL,
  total_revenue_usd NUMERIC(18,2) NOT NULL,
  operations_share NUMERIC(18,2) NOT NULL,
  stakers_share NUMERIC(18,2) NOT NULL,
  dao_treasury_share NUMERIC(18,2) NOT NULL,
  distributed BOOLEAN DEFAULT FALSE,
  distributed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RCG staking (ready but empty)
CREATE TABLE rcg_staking (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  staked_amount NUMERIC(18,2) NOT NULL,
  staked_at TIMESTAMP NOT NULL,
  unlock_date TIMESTAMP NOT NULL,
  unstake_requested_at TIMESTAMP,
  rewards_claimed NUMERIC(18,2) DEFAULT 0,
  last_claim_at TIMESTAMP,
  lock_period INTEGER, -- days
  apr_rate NUMERIC(5,2), -- percentage
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tables to Create

```sql
-- Governance proposals
CREATE TABLE governance_proposals (
  id VARCHAR(66) PRIMARY KEY, -- proposal hash
  proposal_number SERIAL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  proposer_address VARCHAR(42) NOT NULL,
  proposal_type VARCHAR(50) NOT NULL, -- treasury/parameter/feature
  voting_starts TIMESTAMP NOT NULL,
  voting_ends TIMESTAMP NOT NULL,
  for_votes NUMERIC(20,8) DEFAULT 0,
  against_votes NUMERIC(20,8) DEFAULT 0,
  abstain_votes NUMERIC(20,8) DEFAULT 0,
  quorum_required NUMERIC(20,8) NOT NULL,
  status VARCHAR(50) NOT NULL, -- pending/active/succeeded/defeated/executed
  executed_at TIMESTAMP,
  execution_tx_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Governance votes
CREATE TABLE governance_votes (
  id SERIAL PRIMARY KEY,
  proposal_id VARCHAR(66) REFERENCES governance_proposals(id),
  voter_address VARCHAR(42) NOT NULL,
  vote_type VARCHAR(20) NOT NULL, -- for/against/abstain
  voting_power NUMERIC(20,8) NOT NULL,
  tx_hash VARCHAR(66),
  voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(proposal_id, voter_address)
);

-- Vesting schedules
CREATE TABLE vesting_schedules (
  id SERIAL PRIMARY KEY,
  beneficiary_address VARCHAR(42) NOT NULL,
  category VARCHAR(50) NOT NULL, -- team/investor/advisor
  total_amount NUMERIC(20,8) NOT NULL,
  start_date TIMESTAMP NOT NULL,
  cliff_duration INTEGER NOT NULL, -- days
  total_duration INTEGER NOT NULL, -- days
  claimed_amount NUMERIC(20,8) DEFAULT 0,
  last_claim_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RCG price history
CREATE TABLE rcg_price_history (
  id SERIAL PRIMARY KEY,
  price_usd NUMERIC(18,8) NOT NULL,
  volume_24h NUMERIC(18,2),
  market_cap NUMERIC(18,2),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staking rewards distribution
CREATE TABLE staking_rewards (
  id SERIAL PRIMARY KEY,
  distribution_period_start DATE NOT NULL,
  distribution_period_end DATE NOT NULL,
  total_revenue NUMERIC(18,2) NOT NULL,
  stakers_share NUMERIC(18,2) NOT NULL,
  total_staked_rcg NUMERIC(20,8) NOT NULL,
  total_recipients INTEGER NOT NULL,
  distributed BOOLEAN DEFAULT FALSE,
  distributed_at TIMESTAMP,
  tx_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual staker rewards
CREATE TABLE staker_rewards (
  id SERIAL PRIMARY KEY,
  distribution_id INTEGER REFERENCES staking_rewards(id),
  wallet_address VARCHAR(42) NOT NULL,
  staked_amount NUMERIC(20,8) NOT NULL,
  reward_amount NUMERIC(18,8) NOT NULL,
  claimed BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMP,
  tx_hash VARCHAR(66)
);
```

---

## Quick Wins

### 1. Shop Tier Display (1-2 days)
**What to Build:**
- Add tier badge to shop dashboard
- Display current RCG balance
- Show tier benefits list
- Add "Upgrade Tier" CTA

**Files to Create:**
```typescript
frontend/src/components/shop/RCGTierSection.tsx
frontend/src/components/rcg/TierBadge.tsx
```

**API Usage:**
```typescript
GET /api/shops/:shopId/rcg/tier-info
```

---

### 2. RCG Info Page (1-2 days)
**What to Build:**
- Static landing page explaining RCG
- Tokenomics breakdown
- Tier benefits comparison table
- "Coming Soon" sections for staking/governance

**File to Create:**
```typescript
frontend/src/app/rcg/page.tsx
```

---

### 3. Admin RCG Metrics Dashboard (2-3 days)
**What to Build:**
- Tier distribution chart
- Revenue by tier
- Top RCG holders
- Platform statistics

**File to Create:**
```typescript
frontend/src/components/admin/tabs/RCGMetricsTab.tsx
```

**API Usage:**
```typescript
GET /api/admin/rcg/metrics
GET /api/admin/rcg/tier-distribution
```

---

## Next Steps Checklist

### Immediate (This Week)
- [ ] Finalize RCG tokenomics allocation
- [ ] Research staking contract templates (Thirdweb/OpenZeppelin)
- [ ] Create project plan for Phase 1 (Smart Contracts)
- [ ] Set up testnet development environment
- [ ] Quick Win: Build Shop Tier Display

### Short-term (Next 2-4 Weeks)
- [ ] Deploy Staking contract on Base Sepolia
- [ ] Build basic staking backend service
- [ ] Create staking frontend UI
- [ ] Test staking flow end-to-end
- [ ] Quick Win: RCG Info Page
- [ ] Quick Win: Admin RCG Metrics

### Medium-term (1-3 Months)
- [ ] Deploy Governance contract
- [ ] Build governance backend
- [ ] Create governance frontend
- [ ] Launch automated revenue distribution
- [ ] Deploy vesting contracts
- [ ] Execute initial token distribution

### Long-term (3-6 Months)
- [ ] External security audit
- [ ] Deploy to Base Mainnet
- [ ] List on DEX (Uniswap)
- [ ] Launch marketing campaign
- [ ] Scale staking rewards
- [ ] Activate DAO governance

---

## Resources

### Smart Contract Templates
- **Thirdweb**: https://thirdweb.com/explore/staking
- **OpenZeppelin**: https://docs.openzeppelin.com/contracts/governance
- **Gnosis Safe**: https://safe.global/

### Documentation
- **Base Network**: https://docs.base.org/
- **ERC-20 Standard**: https://eips.ethereum.org/EIPS/eip-20
- **Governor Standard**: https://docs.openzeppelin.com/contracts/governance

### Tools
- **Remix IDE**: https://remix.ethereum.org/ (contract development)
- **Tenderly**: https://tenderly.co/ (debugging)
- **Etherscan (Base)**: https://basescan.org/

---

## Questions & Decisions Needed

### Tokenomics
- [ ] Confirm allocation percentages
- [ ] Set vesting schedules
- [ ] Define public sale price (if applicable)
- [ ] Initial liquidity amount

### Staking
- [ ] Lock periods (30/60/90/180 ok?)
- [ ] APR rates (5%/8%/12%/20% ok?)
- [ ] Emergency unstake penalty (50% ok?)
- [ ] Distribution frequency (weekly/monthly?)

### Governance
- [ ] Voting period duration (7 days ok?)
- [ ] Quorum requirement (10% ok?)
- [ ] Proposal creation threshold (100k RCG ok?)
- [ ] Timelock duration (48h ok?)

### Treasury
- [ ] Initial Safe signers
- [ ] Signature threshold (2-of-4 ok?)
- [ ] Treasury spending limits
- [ ] Emergency procedures

---

## Contact & Support

For questions about RCG implementation:
- **Technical Lead**: [Your Name]
- **Smart Contract Dev**: [Developer Name]
- **Project Manager**: [PM Name]

---

**Last Updated**: October 31, 2025
**Document Version**: 1.0
**Status**: Planning Phase
