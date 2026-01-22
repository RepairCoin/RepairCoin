# RCG Staking Plan & Economic Sustainability Model

## Executive Summary

RCG staking creates a sustainable economic flywheel where shops are incentivized to hold and stake governance tokens, earning passive income from platform revenue while strengthening the RepairCoin ecosystem.

---

## 1. Current Tokenomics Overview

### Dual-Token System

**RCN (Utility Token)**
- Purpose: Customer rewards and shop redemptions
- Distribution: Shops issue to customers for repairs
- Value: $0.10 purchase price, $1.00 redemption value (10x multiplier)
- Flow: Admin → Shops (purchase) → Customers (earn) → Shops (redeem)

**RCG (Governance Token)**
- Purpose: Shop tier qualification and platform governance
- Supply: 100M fixed supply
- Tiers: Standard (10K), Premium (50K), Elite (200K+ RCG)
- Benefits: Better RCN pricing, revenue sharing, voting rights

### Revenue Distribution Model

From every RCN purchase by shops:
- **80%** → Operations (platform maintenance, development)
- **10%** → RCG Stakers (passive income for token holders)
- **10%** → DAO Treasury (community governance fund)

---

## 2. Staking Mechanism Design

### Staking Parameters

```typescript
{
  minimumStake: 100 RCG,
  lockPeriod: 7 days,
  rewardDistribution: "continuous", // accrues per block/day
  unstakeCooldown: 7 days,
  compounding: "optional" // auto-compound or manual claim
}
```

### How Staking Works

1. **Stake RCG Tokens**
   - Shop locks minimum 100 RCG in staking contract
   - Tokens enter 7-day lock period
   - Begins earning rewards immediately

2. **Earn Rewards**
   - 10% of all platform RCN sales distributed to stakers
   - Rewards proportional to stake size vs total staked
   - Accrues continuously (daily distribution)

3. **Claim/Compound**
   - Claim rewards anytime (no minimum)
   - Optional: Auto-compound rewards back into stake
   - Gas fees paid by staker

4. **Unstake**
   - Request unstake anytime after lock period
   - 7-day cooldown period begins
   - Tokens returned after cooldown
   - Stops earning rewards immediately

---

## 3. Economic Sustainability Analysis

### Revenue Sources (Platform Income)

**Primary Revenue: RCN Token Sales**

Shop purchase RCN at tiered pricing:
- Standard tier: $0.10/RCN (10K RCG required)
- Premium tier: $0.08/RCN (50K RCG required, 20% discount)
- Elite tier: $0.06/RCN (200K+ RCG, 40% discount)

**Example Monthly Revenue Calculation:**

Assume 100 active shops purchasing RCN monthly:
- 40 Standard shops: 10,000 RCN/month @ $0.10 = $40,000
- 40 Premium shops: 15,000 RCN/month @ $0.08 = $48,000
- 20 Elite shops: 25,000 RCN/month @ $0.06 = $30,000

**Total Monthly Revenue: $118,000**

Distribution:
- Operations (80%): $94,400
- Stakers (10%): $11,800/month
- DAO Treasury (10%): $11,800/month

**Annual Staker Pool: $141,600**

---

## 4. Staking Economics & APR Calculations

### APR (Annual Percentage Rate) Formula

```
APR = (Annual Staker Revenue / Total RCG Staked Value) × 100
```

### Scenario Analysis

#### Scenario 1: Conservative (30% of RCG Staked)

**Assumptions:**
- Total RCG Supply: 100M
- Total Staked: 30M RCG (30%)
- RCG Market Price: $1.00
- Annual Staker Revenue: $141,600 (from example above)

**APR Calculation:**
```
APR = ($141,600 / $30,000,000) × 100 = 0.47% APR
```

**Reality Check:** This APR is too low to be attractive. Platform needs higher volume.

---

#### Scenario 2: Moderate Growth (500 Active Shops)

**Assumptions:**
- 500 shops (5x growth)
- Average 12,000 RCN purchased/shop/month
- Average price: $0.08/RCN
- Monthly Revenue: $480,000
- Annual Staker Revenue: $576,000 (10% of $5.76M)
- Total Staked: 30M RCG @ $1.00

**APR Calculation:**
```
APR = ($576,000 / $30,000,000) × 100 = 1.92% APR
```

---

#### Scenario 3: Aggressive Growth (2,000 Active Shops)

**Assumptions:**
- 2,000 shops (20x growth)
- Average 15,000 RCN purchased/shop/month
- Average price: $0.075/RCN (mix of tiers)
- Monthly Revenue: $2,250,000
- Annual Revenue: $27M
- Annual Staker Revenue: $2.7M (10%)
- Total Staked: 40M RCG @ $1.00

**APR Calculation:**
```
APR = ($2,700,000 / $40,000,000) × 100 = 6.75% APR
```

---

#### Scenario 4: Mature Platform (10,000 Shops)

**Assumptions:**
- 10,000 shops nationwide
- Average 20,000 RCN purchased/shop/month
- Average price: $0.07/RCN
- Monthly Revenue: $14M
- Annual Revenue: $168M
- Annual Staker Revenue: $16.8M (10%)
- Total Staked: 50M RCG @ $2.00 (RCG appreciates)

**APR Calculation:**
```
APR = ($16,800,000 / $100,000,000) × 100 = 16.8% APR
```

---

## 5. Staking APR Summary Table

| Stage | Shops | Monthly Rev | Annual Staker Pool | Staked RCG | RCG Price | APR |
|-------|-------|-------------|-------------------|------------|-----------|-----|
| Launch | 100 | $118K | $142K | 30M | $1.00 | **0.47%** |
| Early Growth | 500 | $480K | $576K | 30M | $1.00 | **1.92%** |
| Growth | 2,000 | $2.25M | $2.7M | 40M | $1.00 | **6.75%** |
| Mature | 10,000 | $14M | $16.8M | 50M | $2.00 | **16.8%** |

---

## 6. Economic Sustainability Mechanisms

### 6.1 Value Accrual to RCG Token

**Demand Drivers:**

1. **Tier Requirements**
   - Shops MUST hold RCG to qualify for tiers
   - Higher tiers = better RCN pricing (20-40% discount)
   - Creates sustained buy pressure

2. **Staking Rewards**
   - Direct cash flow to RCG holders
   - Incentivizes long-term holding (7-day lock)
   - Reduces circulating supply

3. **Governance Rights**
   - Vote on protocol upgrades
   - Treasury allocation decisions
   - Platform fee adjustments

4. **Network Effects**
   - More shops → More RCN sales → Higher staking APR
   - Higher APR → More RCG demand → Price appreciation
   - Price appreciation → More shops want RCG → Cycle repeats

### 6.2 RCN Token Sink Mechanisms

**Problem:** RCN has 10x redemption multiplier ($0.10 buy, $1.00 redeem)
**Solution:** Multiple burn/sink mechanisms

1. **Cross-Shop Redemption Fee**
   - 80% burn when redeeming at different shop
   - Example: Customer earned 100 RCN at Shop A, redeems at Shop B
   - Customer gets: 20 RCN worth ($20 value)
   - Burned: 80 RCN (removed from circulation)

2. **Expiration (Optional)**
   - RCN expires after 12 months if unused
   - Creates urgency to redeem
   - Reduces future liability

3. **Redemption Caps**
   - Shops can set max RCN acceptance per transaction
   - Example: $50 max RCN per $200 purchase (25% limit)
   - Prevents over-reliance on RCN

4. **Affiliate Group Pools**
   - Shop groups create custom point systems
   - RCN locked in group pools
   - Reduces overall RCN velocity

### 6.3 Platform Revenue Growth Drivers

1. **Subscription Revenue**
   - Shops pay $500/month subscription
   - 100 shops = $50K/month = $600K/year
   - 1,000 shops = $6M/year (pure profit)

2. **RCN Sales Volume**
   - Grows with shop count and customer adoption
   - Tiered pricing incentivizes RCG accumulation
   - High-volume shops need more RCN

3. **Service Marketplace**
   - 10% platform fee on service bookings
   - Additional revenue stream
   - Cross-selling opportunities

4. **Data & Analytics (Future)**
   - Premium analytics for shops
   - Industry reports
   - B2B SaaS model

---

## 7. Economic Risks & Mitigation

### Risk 1: Low Initial APR

**Problem:** 0.47% APR at launch is unattractive

**Mitigation:**
1. **Liquidity Mining Program**
   - Allocate 5M RCG (5% of supply) for early staker rewards
   - Bonus 2x rewards for first 6 months
   - Vesting schedule: 10% monthly over 10 months

2. **Reduced Minimum Stake**
   - Lower to 50 RCG for launch phase
   - Increase to 100 RCG after 10,000 total stakers

3. **DAO Treasury Contribution**
   - During bootstrap phase, DAO contributes extra 5% to staker pool
   - Total staker share: 15% (10% base + 5% DAO boost)
   - Time-limited: First 12 months

**Enhanced Launch APR:**
```
Base: 0.47% + Liquidity Mining Bonus: ~4-6% = 4.5-6.5% APR
```

### Risk 2: RCN Redemption Liability

**Problem:** If too many customers hold RCN, redemption costs explode

**Mitigation:**
1. **Dynamic Issuance Limits**
   - Shops limited to issuing based on RCN balance
   - Must maintain 20% reserve (can't issue more than 5x balance)

2. **Treasury Reserve**
   - Platform maintains 10M RCN emergency reserve
   - Backs extreme redemption events

3. **Staggered Vesting**
   - Large RCN rewards (>1,000 RCN) vest over 30 days
   - Prevents bank run scenarios

### Risk 3: RCG Price Volatility

**Problem:** Shops may not want to hold volatile asset

**Mitigation:**
1. **Tier Averaging**
   - Tier calculated on 30-day average RCG holdings
   - Prevents flash crashes from affecting tier status

2. **RCG Stability Pool**
   - DAO uses treasury to buy RCG during price crashes
   - Provides floor price support

3. **Hedging Products (Future)**
   - Options for shops to hedge RCG exposure
   - Locked tier status for 12 months

### Risk 4: Insufficient Platform Revenue

**Problem:** Can't sustain staking rewards if revenue drops

**Mitigation:**
1. **Diversified Revenue**
   - Subscriptions + RCN sales + marketplace fees
   - Not dependent on single revenue stream

2. **Cost Management**
   - 80% to operations includes reinvestment
   - Able to reduce to 70% if needed (give 10% more to stakers)

3. **Dynamic Fee Adjustment**
   - DAO can vote to adjust revenue split
   - Emergency reserve usage

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Months 1-3)
- ✅ Deploy RCG staking smart contract
- ✅ Launch staking UI (completed today)
- ✅ Integrate with shop dashboard
- 🔄 Implement liquidity mining rewards
- 🔄 Set up staking analytics dashboard

### Phase 2: Incentivization (Months 3-6)
- Launch liquidity mining program
- 2x staking rewards for early adopters
- Marketing campaign to shops
- Partnership with RCG liquidity providers
- Tier status promotion (hold RCG for 90 days → bonus)

### Phase 3: Optimization (Months 6-12)
- Introduce auto-compounding feature
- Add governance voting system
- Launch RCG stability pool
- Implement dynamic APR display
- Create staking leaderboard

### Phase 4: Expansion (Year 2)
- Cross-chain staking (Ethereum, Polygon)
- Institutional staking program
- Locked staking tiers (higher APR for longer locks)
- RCG lending/borrowing market
- Staking derivatives (liquid staking tokens)

---

## 9. Success Metrics & KPIs

### Key Performance Indicators

**Staking Adoption:**
- % of circulating RCG staked (Target: 30-50%)
- Number of unique stakers (Target: 500+ in Year 1)
- Average stake size (Target: 50K RCG)

**Economic Health:**
- Average APR (Target: 6-12% sustainable)
- Total staking rewards distributed (Track monthly)
- Staking duration (Target: 180+ days average)

**Platform Growth:**
- Monthly active shops (Target: 2,000 by Year 2)
- RCN purchase volume (Target: $2M+/month)
- Customer redemption rate (Target: 60-70%)

**Token Metrics:**
- RCG price stability (Target: <20% volatility)
- RCG market cap (Track vs revenue multiple)
- RCN burn rate (Target: 40% of issued RCN burned)

---

## 10. Long-Term Economic Vision

### Year 1-2: Bootstrapping
- Focus on shop acquisition
- Subsidize staking APR if needed
- Build network effects

### Year 3-5: Growth Phase
- 5,000-10,000 shops
- Self-sustaining 8-12% APR
- RCG becomes valuable asset class

### Year 5+: Mature Platform
- 50,000+ shops nationwide
- 15-20% APR from organic revenue
- RCG governance becomes primary value driver
- Platform worth $500M-$1B

### Exit Strategy Options

1. **Token Buyback Program**
   - Use DAO treasury to buy & burn RCG
   - Increases scarcity and value

2. **Revenue Share NFTs**
   - Convert staking to perpetual revenue NFTs
   - Secondary market for locked revenue streams

3. **Acquisition/IPO**
   - RCG holders receive equity/acquisition value
   - DAO votes on terms

---

## 11. Conclusion

### Sustainability Summary

The RCG staking model is economically sustainable IF:

✅ **Platform achieves 500+ active shops** (realistic within 12-18 months)
✅ **Average shop purchases 10K+ RCN/month** (tied to customer adoption)
✅ **30-40% of RCG supply is staked** (reduces sell pressure)
✅ **RCN sink mechanisms work effectively** (80% cross-shop burn is key)

### Flywheel Effect

```
More Shops → More RCN Sales → Higher Staking APR → More RCG Demand
     ↑                                                        ↓
Higher RCG Price ← More Shops Want Higher Tiers ← Higher RCG Price
```

### Critical Success Factors

1. **Rapid shop onboarding** (first 500 shops critical)
2. **Customer adoption** (shops need customers to issue RCN to)
3. **Tier incentive clarity** (shops must understand RCG value)
4. **Liquidity mining execution** (boost early APR)
5. **Regulatory compliance** (staking must be legal structure)

---

## 12. Next Steps

### Immediate Actions Required

1. **Deploy Staking Smart Contract**
   - Audit contract code
   - Test on testnet
   - Mainnet deployment

2. **Set Up Reward Distribution**
   - Automate daily reward calculations
   - Build backend API for reward tracking
   - Connect to staking UI

3. **Configure Parameters**
   - Set minimum stake (100 RCG)
   - Set lock period (7 days)
   - Initialize liquidity mining pool (5M RCG)

4. **Launch Marketing Campaign**
   - Educate shops on staking benefits
   - Create staking tutorials
   - Announce launch incentives

5. **Monitor & Iterate**
   - Track APR weekly
   - Adjust parameters as needed
   - Gather shop feedback

---

**Last Updated:** January 21, 2026
**Version:** 1.0
**Status:** Planning & UI Complete, Smart Contract Pending
