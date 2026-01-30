# Realistic RCG Staking Scenarios - Early Stage Analysis

## Executive Summary

This document provides realistic staking calculations for RepairCoin's early launch phase with actual achievable numbers, plus recommendations for optimal lock periods.

---

## 1. Lock Period Recommendations

### Current Lock Period: 7 Days ❌ TOO SHORT

**Problems:**
- No commitment from stakers
- High churn rate (stake/unstake frequently)
- Mercenary capital seeking short-term gains
- No real skin in the game

### Recommended Lock Periods: Tiered System

```typescript
{
  flexible: {
    lockPeriod: 30 days,
    rewardMultiplier: 1.0x,
    apy: "Base APR"
  },
  committed: {
    lockPeriod: 90 days,
    rewardMultiplier: 1.5x,
    apy: "Base APR × 1.5"
  },
  longTerm: {
    lockPeriod: 180 days,
    rewardMultiplier: 2.0x,
    apy: "Base APR × 2.0"
  },
  diamond: {
    lockPeriod: 365 days,
    rewardMultiplier: 3.0x,
    apy: "Base APR × 3.0"
  }
}
```

### Why Longer Locks Matter

**Benefits:**
1. **Price Stability** - Less RCG dumping on market
2. **True Believers** - Attracts long-term holders
3. **Network Security** - Committed governance participants
4. **Better APR** - Reward loyalty with multipliers
5. **Marketing** - "Stake for 1 year, earn 3x rewards" is compelling

**Recommendation:** Start with **90-day minimum** lock period

---

## 2. Realistic Early Stage Scenario

### Your Actual Numbers: 100 Customers, 2 Shops

Let's calculate what this REALLY looks like:

#### Shop & Customer Breakdown

**Shop A: Auto Repair Shop**
- Monthly customers: 60
- Average repair cost: $300
- RCN issued per repair: 30 RCN ($3 reward at $0.10 cost)
- Total RCN issued/month: 1,800 RCN
- Cost to shop: $180/month

**Shop B: Phone Repair Shop**
- Monthly customers: 40
- Average repair cost: $150
- RCN issued per repair: 15 RCN ($1.50 reward)
- Total RCN issued/month: 600 RCN
- Cost to shop: $60/month

**Total Platform Activity:**
- Total RCN issued: 2,400 RCN/month
- Total RCN purchases: $240/month
- **Annual RCN sales: $2,880/year**

#### Revenue Distribution

```
Total Annual Revenue: $2,880
├── Operations (80%): $2,304
├── Stakers (10%): $288/year
└── DAO Treasury (10%): $288/year
```

**Annual Staker Pool: $288**

---

## 3. Staking Calculations - Reality Check

### Scenario A: Conservative Staking (10% of supply)

**Assumptions:**
- Total RCG Supply: 100M
- Total Staked: 10M RCG (10%)
- RCG Price: $0.50 (early stage, low liquidity)
- Total Staked Value: $5M
- Annual Staker Revenue: $288

**APR Calculation:**
```
APR = ($288 / $5,000,000) × 100 = 0.00576% APR
```

**Reality: THIS IS TERRIBLE** ❌

---

### Scenario B: High Staking (50% of supply)

**Assumptions:**
- Total RCG Supply: 100M
- Total Staked: 50M RCG (50% - very optimistic)
- RCG Price: $0.50
- Total Staked Value: $25M
- Annual Staker Revenue: $288

**APR Calculation:**
```
APR = ($288 / $25,000,000) × 100 = 0.00115% APR
```

**Reality: EVEN WORSE** ❌❌

---

### Scenario C: What If ONLY the 2 Shops Stake?

**Assumptions:**
- Shop A holds: 15,000 RCG (Premium tier candidate)
- Shop B holds: 12,000 RCG (Standard tier, trying to reach Premium)
- Total Staked: 27,000 RCG
- RCG Price: $0.50
- Total Staked Value: $13,500
- Annual Staker Revenue: $288

**APR Calculation:**
```
APR = ($288 / $13,500) × 100 = 2.13% APR
```

**Individual Shop Returns:**

**Shop A (15,000 RCG staked):**
- Share: 15,000 / 27,000 = 55.56%
- Annual reward: $288 × 55.56% = **$160/year**
- Monthly reward: **$13.33/month**

**Shop B (12,000 RCG staked):**
- Share: 12,000 / 27,000 = 44.44%
- Annual reward: $288 × 44.44% = **$128/year**
- Monthly reward: **$10.67/month**

**Reality: STILL NOT ATTRACTIVE** ⚠️

---

## 4. What Would Actually Work?

### The Brutal Truth

With only 2 shops and 100 customers, staking rewards are essentially **zero**.

**You need ONE of these to make staking viable:**

### Option 1: Massive Liquidity Mining Subsidy

**Inject external rewards to bootstrap:**

```
Platform Revenue: $288/year (10% = $28.80 to stakers)
Liquidity Mining Bonus: $50,000/year (from DAO treasury or investors)
Total Staker Rewards: $50,288/year
```

**With 27,000 RCG staked:**
```
APR = ($50,288 / $13,500) × 100 = 372% APR ✅
```

**This works, but you're burning $50K/year to subsidize**

---

### Option 2: Much Higher Platform Activity

**Minimum Viable Scale:**

To achieve 10% APR with organic revenue:
```
Desired APR: 10%
Staked Value: $13,500 (27,000 RCG @ $0.50)
Required Annual Staker Revenue: $1,350
Required Total Platform Revenue: $13,500 (stakers get 10%)
Required Monthly Revenue: $1,125
```

**What this means in RCN sales:**
```
$1,125/month ÷ $0.08 (avg price) = 14,063 RCN/month
```

**Translation: You need shops to be buying ~14,000 RCN/month**

**Current:** 2,400 RCN/month
**Needed:** 14,063 RCN/month
**Gap:** 5.9x more activity needed

---

### Option 3: Realistic Growth Timeline

**Month 1-3: Launch (2 shops, 100 customers)**
- Platform revenue: $240/month
- Staker pool: $24/month ($288/year)
- **Liquidity mining subsidy needed: $4,000/month**
- Effective APR with subsidy: **350%**

**Month 4-6: Early Growth (10 shops, 500 customers)**
- Platform revenue: $1,200/month
- Staker pool: $120/month ($1,440/year)
- Staked value: ~$50,000 (100K RCG @ $0.50)
- Organic APR: 2.88%
- **Liquidity mining subsidy: $2,000/month**
- Effective APR with subsidy: **50%**

**Month 7-12: Growth Phase (50 shops, 2,500 customers)**
- Platform revenue: $6,000/month
- Staker pool: $600/month ($7,200/year)
- Staked value: ~$150,000 (300K RCG @ $0.50)
- Organic APR: 4.8%
- **Liquidity mining subsidy: $1,000/month**
- Effective APR with subsidy: **12%**

**Year 2: Sustainable (200 shops, 10,000 customers)**
- Platform revenue: $24,000/month
- Staker pool: $2,400/month ($28,800/year)
- Staked value: ~$500,000 (1M RCG @ $0.50)
- **Organic APR: 5.76%**
- Liquidity mining can end
- **NO SUBSIDY NEEDED** ✅

---

## 5. Recommended Staking Model - REVISED

### Minimum Requirements (Updated)

```typescript
{
  minimumStake: 1,000 RCG,  // Raised from 100
  lockPeriod: 90 days,       // Raised from 7 days
  unstakeCooldown: 14 days,  // Raised from 7 days
  rewardDistribution: "weekly", // Changed from continuous
  emergencyUnstake: true,    // New: Can unstake early with 25% penalty
}
```

**Rationale:**
- **1,000 RCG minimum** - Serious stakers only, reduces admin overhead
- **90-day lock** - Aligns with quarterly planning, shows commitment
- **14-day cooldown** - Prevents gaming, gives time for governance
- **Weekly distribution** - Gas efficient, easier to track
- **Emergency unstake** - Safety valve (but you lose 25% of stake)

### Tiered Lock System (RECOMMENDED)

```typescript
stakingTiers = {
  bronze: {
    minStake: 1,000 RCG,
    lockPeriod: 90 days,
    multiplier: 1.0x,
    description: "3-month commitment"
  },
  silver: {
    minStake: 5,000 RCG,
    lockPeriod: 180 days,
    multiplier: 1.75x,
    description: "6-month commitment"
  },
  gold: {
    minStake: 10,000 RCG,
    lockPeriod: 365 days,
    multiplier: 2.5x,
    description: "1-year commitment"
  },
  platinum: {
    minStake: 50,000 RCG,
    lockPeriod: 730 days,
    multiplier: 4.0x,
    description: "2-year commitment, reserved for Premium+ tier shops"
  }
}
```

**Example with Tiered System:**

Platform revenue: $6,000/month ($72,000/year)
Staker pool: $7,200/year (10%)

**Distribution with multipliers:**

| Tier | Staked | Lock | Multiplier | Weighted | Share | Annual Reward | APR |
|------|--------|------|------------|----------|-------|---------------|-----|
| Bronze | 10K | 90d | 1.0x | 10K | 8.7% | $626 | 6.3% |
| Silver | 20K | 180d | 1.75x | 35K | 30.4% | $2,189 | 10.9% |
| Gold | 30K | 365d | 2.5x | 75K | 65.2% | $4,697 | 15.7% |
| **Total** | **60K** | - | - | **115K** | **100%** | **$7,200** | - |

**Notice:** Gold tier (1-year lock) gets 15.7% APR vs Bronze (90-day) at 6.3% APR

---

## 6. Realistic Launch Strategy

### Phase 0: Pre-Launch (You are here)

**Current State:**
- 2 shops, 100 customers
- $240/month platform revenue
- Staking would yield 0.001% APR (worthless)

**Actions:**
1. **DON'T launch staking yet** ❌
2. **DO secure liquidity mining fund:**
   - Allocate 5M RCG (5% of supply)
   - Or raise $50-100K from investors/DAO
3. **DO focus on shop acquisition:**
   - Get to 20+ shops minimum
   - Target $2K+/month platform revenue

### Phase 1: Soft Launch (20 shops, 1,000 customers)

**Targets:**
- Platform revenue: $2,400/month
- Staker pool: $240/month ($2,880/year) organic
- Liquidity mining: $3,000/month subsidy
- **Total staker pool: $38,880/year**

**Expected staking:**
- 20 shops × 10,000 RCG avg = 200,000 RCG staked
- Staked value: $100,000 (@ $0.50)
- **Effective APR: 38.9%** ✅ ATTRACTIVE

**Timeline:** Months 1-6

### Phase 2: Growth Launch (100 shops, 5,000 customers)

**Targets:**
- Platform revenue: $12,000/month
- Staker pool: $1,200/month ($14,400/year) organic
- Liquidity mining: $1,500/month subsidy
- **Total staker pool: $32,400/year**

**Expected staking:**
- 100 shops × 12,000 RCG avg = 1.2M RCG staked
- Staked value: $600,000 (@ $0.50, or $1M if price rises)
- **Effective APR: 5.4% organic + subsidy boost = ~10-12%** ✅

**Timeline:** Months 7-18

### Phase 3: Self-Sustaining (500+ shops, 25,000+ customers)

**Targets:**
- Platform revenue: $60,000/month
- Staker pool: $6,000/month ($72,000/year) organic
- **NO liquidity mining needed**

**Expected staking:**
- 500 shops × 15,000 RCG avg = 7.5M RCG staked
- Staked value: $3.75M (@ $0.50) or higher
- **Organic APR: 10-15% sustainable** ✅✅

**Timeline:** Year 2+

---

## 7. Capital Requirements for Liquidity Mining

### 18-Month Bootstrap Budget

```
Phase 1 (Months 1-6): $3,000/month × 6 = $18,000
Phase 2 (Months 7-12): $1,500/month × 6 = $9,000
Phase 2.5 (Months 13-18): $750/month × 6 = $4,500

Total Liquidity Mining Budget: $31,500
```

**How to fund this:**

**Option A: RCG Allocation (Preferred)**
- Mint/Allocate 5M RCG for rewards
- Vesting schedule: 278K RCG/month for 18 months
- At $0.50/RCG = $139K/month equivalent (way more than $3K needed)
- Can stretch this to 5+ years if needed

**Option B: Cash Subsidy**
- Raise $32K from investors/founders
- Use to buy RCG from market and distribute
- Supports RCG price while rewarding stakers

**Option C: Hybrid**
- 50% RCG allocation (2.5M RCG)
- 50% cash subsidy ($16K)
- Best of both worlds

---

## 8. Updated Economic Model - Realistic

### Minimum Viable Product (MVP) Staking

**Don't launch staking until:**
- ✅ 20+ active shops
- ✅ 1,000+ registered customers
- ✅ $2,000+/month platform revenue
- ✅ Liquidity mining fund secured (5M RCG or $30K cash)
- ✅ Smart contract audited
- ✅ 90-day minimum lock period implemented

**Launch checklist item:** NOT "Launch Day 1"

### Sustainable Staking Threshold

**Organic staking becomes attractive (no subsidy) at:**
- 500+ shops
- 25,000+ customers
- $60,000+/month platform revenue
- $72,000+/year to staker pool
- 10-15% organic APR

**Timeline to sustainability:** 18-24 months with aggressive growth

---

## 9. Revised Staking Parameters

### BEFORE (Original Plan) ❌

```typescript
{
  minimumStake: 100 RCG,      // Too low
  lockPeriod: 7 days,          // Way too short
  unstakeCooldown: 7 days,     // Too short
  rewardDistribution: "continuous" // Gas inefficient
}
```

### AFTER (Recommended) ✅

```typescript
{
  minimumStake: 1,000 RCG,     // Serious stakers only
  lockPeriod: 90 days,          // Quarterly commitment (or tiered)
  unstakeCooldown: 14 days,     // Prevents gaming
  rewardDistribution: "weekly", // Gas efficient
  emergencyUnstake: {
    enabled: true,
    penalty: 25%                // 25% of stake goes to remaining stakers
  },
  tieredSystem: {
    bronze: { lock: 90, multiplier: 1.0 },
    silver: { lock: 180, multiplier: 1.75 },
    gold: { lock: 365, multiplier: 2.5 },
    platinum: { lock: 730, multiplier: 4.0 }
  }
}
```

---

## 10. Conclusion & Recommendations

### The Hard Truth

With 2 shops and 100 customers:
- **Organic staking APR: 0.001% (essentially zero)**
- **You CANNOT launch staking profitably yet**

### What You Should Do Instead

**Priority Order:**

1. **Focus on shop acquisition** (Target: 20-50 shops)
2. **Build liquidity mining fund** (5M RCG or $30-50K)
3. **Implement tiered lock periods** (90/180/365 days)
4. **Raise minimum stake** (1,000 RCG minimum)
5. **Launch staking when ready** (20+ shops, $2K/month revenue)

### Launch Timeline

```
Now (2 shops):        DON'T launch staking ❌
Month 3 (10 shops):   MAYBE soft launch with heavy subsidies ⚠️
Month 6 (20 shops):   LAUNCH with liquidity mining ✅
Month 18 (100 shops): Reduce subsidies ✅
Year 2 (500 shops):   Self-sustaining, no subsidies needed ✅✅
```

### Final Recommendation

**WAIT to launch staking until you have:**
- Minimum 20 shops
- $2,000+/month platform revenue
- Secured liquidity mining fund
- Implemented 90-day+ lock periods

Launching staking too early with terrible APR will:
- ❌ Damage reputation ("This is a scam, 0.001% APR")
- ❌ Waste development resources
- ❌ Create bad precedent
- ❌ Confuse/disappoint early shops

**Be patient. Build the platform first. Staking second.**

---

**Last Updated:** January 21, 2026
**Status:** ⚠️ DO NOT LAUNCH YET - Need 20+ shops minimum
**Next Review:** When platform reaches 20 shops or $2K/month revenue
