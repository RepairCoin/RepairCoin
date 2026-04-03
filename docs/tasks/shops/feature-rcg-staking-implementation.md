# Feature: RCG Staking — Full Implementation

## Status: Open
## Priority: Medium
## Date: 2026-03-24
## Category: Feature - Blockchain / DeFi
## Current State: Frontend UI exists with mock data, no smart contract or backend

---

## Overview

The Staking tab (`/shop?tab=staking`) currently displays a UI with hardcoded mock data. Users can see the interface but cannot actually stake, unstake, or earn rewards. This task implements the full staking system: smart contract, backend tracking, and frontend integration.

**Goal:** Allow RCG token holders to stake tokens, earn revenue share rewards (12.5% APR from 10% platform revenue), and determine shop tier status.

---

## Current State (Mock)

| Feature | Status |
|---------|--------|
| RCG balance readout from blockchain | Working (real) |
| Stake input with validation | UI only (toast message, no tx) |
| Unstake input with validation | UI only (toast message, no tx) |
| APR display (12.5%) | Hardcoded |
| Staked amount display | Mock (resets on refresh) |
| Rewards display | Mock (always 0) |
| Lock period tracking | Mock |
| Shop tier from staking | Not connected |

---

## Implementation Plan

### Phase 1: Smart Contract

**Deploy RCG Staking Contract on Base Sepolia**

```solidity
// Core functions needed:
contract RCGStaking {
    // Stake RCG tokens (transfers from user to contract)
    function stake(uint256 amount) external;

    // Unstake RCG tokens (after lock period)
    function unstake(uint256 amount) external;

    // Claim accumulated rewards
    function claimRewards() external;

    // View functions
    function getStakedBalance(address user) external view returns (uint256);
    function getPendingRewards(address user) external view returns (uint256);
    function getStakeInfo(address user) external view returns (
        uint256 stakedAmount,
        uint256 pendingRewards,
        uint256 stakeTimestamp,
        uint256 lockEndTimestamp
    );
    function getTotalStaked() external view returns (uint256);

    // Admin functions
    function depositRewards(uint256 amount) external; // Platform deposits revenue share
    function setLockPeriod(uint256 days) external;
    function setMinStake(uint256 amount) external;
}
```

**Key parameters:**
- Minimum stake: 1,000 RCG
- Lock period: configurable (default 30 days)
- Reward distribution: proportional to stake weight
- Emergency unstake: possible with penalty (e.g., 10% fee)

---

### Phase 2: Database Schema

**New migration:** `XXX_create_staking_system.sql`

```sql
-- Track staking positions (mirror of on-chain data for fast queries)
CREATE TABLE IF NOT EXISTS rcg_staking_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(100) NOT NULL,
  shop_id VARCHAR(100) REFERENCES shops(shop_id),
  staked_amount NUMERIC(30,18) NOT NULL DEFAULT 0,
  pending_rewards NUMERIC(30,18) NOT NULL DEFAULT 0,
  total_rewards_claimed NUMERIC(30,18) NOT NULL DEFAULT 0,
  stake_timestamp TIMESTAMP,
  lock_end_timestamp TIMESTAMP,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Track staking events (deposits, withdrawals, claims)
CREATE TABLE IF NOT EXISTS rcg_staking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(100) NOT NULL,
  event_type VARCHAR(20) NOT NULL, -- 'stake', 'unstake', 'claim', 'reward_deposit'
  amount NUMERIC(30,18) NOT NULL,
  transaction_hash VARCHAR(255),
  block_number BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Track revenue share deposits
CREATE TABLE IF NOT EXISTS rcg_revenue_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  total_platform_revenue NUMERIC(12,2) NOT NULL,
  staker_share_percent NUMERIC(5,2) DEFAULT 10.00,
  total_reward_amount NUMERIC(30,18) NOT NULL,
  total_staked_at_time NUMERIC(30,18) NOT NULL,
  transaction_hash VARCHAR(255),
  deposited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_staking_positions_wallet ON rcg_staking_positions(wallet_address);
CREATE INDEX idx_staking_events_wallet ON rcg_staking_events(wallet_address, event_type);
```

---

### Phase 3: Backend API Endpoints

**Base path:** `/api/staking`

#### Staking Information
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/info` | Get global staking stats (total staked, APR, lock period) |
| GET | `/position/:address` | Get user's staking position |
| GET | `/rewards/:address` | Get pending rewards for user |
| GET | `/history/:address` | Get staking event history |

#### Staking Actions (initiate on-chain tx)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/stake` | Prepare stake transaction (returns unsigned tx) |
| POST | `/unstake` | Prepare unstake transaction |
| POST | `/claim` | Prepare claim rewards transaction |
| POST | `/sync/:address` | Sync on-chain position to DB |

#### Admin / Revenue
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/admin/deposit-rewards` | Deposit platform revenue as rewards |
| GET | `/admin/stats` | Get staking platform statistics |
| GET | `/admin/deposits` | Get revenue deposit history |

---

### Phase 4: Revenue Share System

**How rewards are funded:**

1. Platform collects revenue from:
   - Subscription fees ($500/month per shop)
   - Service booking platform fees (if implemented)
   - RCN purchase margins

2. Monthly (or weekly), admin triggers reward distribution:
   - Calculate total platform revenue for period
   - 10% allocated to stakers
   - 10% allocated to DAO treasury
   - Deposit reward tokens to staking contract

3. Rewards distributed proportionally:
   ```
   User Reward = (User Staked / Total Staked) × Period Reward Pool
   ```

**Example:**
- Platform revenue: $50,000/month
- Staker share: $5,000 (10%)
- Total RCG staked: 1,000,000 RCG
- User staked: 50,000 RCG (5%)
- User reward: $250/month worth of RCG

**APR calculation:**
```
APR = (Annual Reward Pool / Total Staked Value) × 100
```
The 12.5% APR is a target — actual APR varies with total staked amount and platform revenue.

---

### Phase 5: Shop Tier Integration

Staked RCG determines shop tier and pricing:

| Tier | Staked RCG | RCN Purchase Price | Benefits |
|------|-----------|-------------------|----------|
| Standard | 10,000+ | $0.08/RCN | Basic features |
| Premium | 50,000+ | $0.07/RCN | Priority support, lower fees |
| Elite | 200,000+ | $0.06/RCN | All features, lowest fees |

**Integration point:** The existing `ShopPurchaseService` checks RCG holdings for tier pricing. This should be updated to check **staked** RCG (not just wallet balance) so staking contributes to tier status.

```typescript
// Current: reads wallet balance
const rcgBalance = await rcgTokenReader.getBalance(shopWallet);

// Updated: reads wallet balance + staked amount
const rcgBalance = await rcgTokenReader.getBalance(shopWallet);
const stakedAmount = await stakingContract.getStakedBalance(shopWallet);
const effectiveRcg = rcgBalance + stakedAmount;
```

---

### Phase 6: Frontend Integration

**File:** `frontend/src/components/shop/tabs/StakingTab.tsx`

Replace mock data with real contract calls:

```typescript
// Read staked balance from contract
const { data: stakedBalance } = useReadContract({
  contract: stakingContract,
  method: "function getStakedBalance(address) view returns (uint256)",
  params: [account?.address],
});

// Read pending rewards
const { data: pendingRewards } = useReadContract({
  contract: stakingContract,
  method: "function getPendingRewards(address) view returns (uint256)",
  params: [account?.address],
});

// Stake action (real transaction)
const handleStake = async () => {
  // 1. Approve staking contract to spend RCG
  const approveTx = prepareContractCall({
    contract: rcgContract,
    method: "function approve(address,uint256)",
    params: [STAKING_CONTRACT_ADDRESS, parseEther(stakeAmount)],
  });
  await sendTransaction({ transaction: approveTx, account });

  // 2. Call stake on staking contract
  const stakeTx = prepareContractCall({
    contract: stakingContract,
    method: "function stake(uint256)",
    params: [parseEther(stakeAmount)],
  });
  await sendTransaction({ transaction: stakeTx, account });
};
```

---

## Security Considerations

- Smart contract audited before mainnet deployment
- Timelock on admin functions (reward deposits, parameter changes)
- Emergency pause mechanism
- Reentrancy guards on stake/unstake/claim
- Maximum stake cap per user (optional, prevents whale domination)
- Lock period cannot be changed for existing stakes
- Reward calculations overflow-safe (use SafeMath or Solidity 0.8+)

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `contracts/RCGStaking.sol` | Create — staking smart contract |
| `backend/migrations/XXX_create_staking_system.sql` | Create — DB schema |
| `backend/src/repositories/StakingRepository.ts` | Create — data access |
| `backend/src/services/StakingService.ts` | Create — business logic |
| `backend/src/domains/staking/routes.ts` | Create — API routes |
| `backend/src/contracts/StakingContractReader.ts` | Create — on-chain reads |
| `frontend/src/config/contracts.ts` | Modify — add staking contract address |
| `frontend/src/components/shop/tabs/StakingTab.tsx` | Modify — replace mock with real |
| `backend/src/domains/shop/services/ShopPurchaseService.ts` | Modify — tier check includes staked |

---

## Implementation Priority

1. **Phase 1:** Smart contract development + testing on testnet
2. **Phase 2:** Database schema
3. **Phase 3:** Backend API endpoints
4. **Phase 6:** Frontend integration (connect to contract)
5. **Phase 5:** Shop tier integration
6. **Phase 4:** Revenue share system (requires real revenue data)

---

## Dependencies

- RCG token contract already deployed: `0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D`
- Thirdweb SDK v5 for contract interactions
- Base Sepolia testnet for development
- Solidity compiler (0.8.x)
- Hardhat or Foundry for contract testing

---

## Verification Checklist

- [ ] Staking contract deployed on Base Sepolia
- [ ] User can stake RCG (token transferred to contract)
- [ ] Staked balance shows correctly
- [ ] Lock period enforced (can't unstake early)
- [ ] Rewards accumulate over time
- [ ] User can claim rewards
- [ ] User can unstake after lock period
- [ ] Shop tier calculated from wallet + staked balance
- [ ] APR updates based on total staked and reward pool
- [ ] Admin can deposit revenue share rewards
- [ ] Staking events tracked in DB
- [ ] Frontend shows real data (not mock)
