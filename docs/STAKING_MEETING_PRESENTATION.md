# RCG Staking Plan - Meeting Discussion
**Date:** January 22, 2026
**Prepared by:** Development Team
**Status:** Planning & Analysis Complete

---

## 📋 Agenda

1. Current Situation Assessment
2. Staking Mechanism Overview
3. Economic Reality Check
4. Lock Period Recommendations
5. Launch Strategy & Timeline
6. Liquidity Mining Requirements
7. Decision Points

---

## 1. Current Situation Assessment

### Platform Status (Today)
- **Shops:** 2 active
- **Customers:** 100 registered
- **Monthly Activity:** 2,400 RCN issued
- **Monthly Revenue:** $240 from RCN sales
- **Annual Revenue:** $2,880

### What This Means for Staking
- Annual staker pool (10% of revenue): **$288**
- Current platform scale: **Too small for viable staking**

---

## 2. Staking Mechanism Overview

### How RCG Staking Works

**Who Stakes:** Shops (RCG token holders)

**What Gets Staked:** RCG governance tokens

**What You Earn:** USD/cash from platform revenue
- 10% of all RCN sales goes to stakers
- Your share = (Your RCG / Total RCG Staked) × Staker Pool

**Example:**
```
Platform makes $100K from RCN sales
→ $10K distributed to RCG stakers
→ You staked 10% of total RCG
→ You earn $1,000
```

### Current UI Implementation ✅
- Staking tab added to shop dashboard
- Stats dashboard (balance, rewards, APR)
- Stake/unstake forms with validation
- Lock period enforcement
- Reward claiming interface

---

## 3. Economic Reality Check

### Scenario: Current Scale (2 shops, 100 customers)

**Assumptions:**
- Shop A & B each stake ~13,000 RCG
- Total staked: 27,000 RCG
- RCG price: $0.50
- Annual staker pool: $288

**Results:**
```
Shop A Rewards:
- Annual: $160
- Monthly: $13.33
- APR: 2.13%

Shop B Rewards:
- Annual: $128
- Monthly: $10.67
- APR: 2.13%
```

**Problem:** This APR is NOT attractive enough to:
- Incentivize long-term holding
- Compete with other DeFi yields
- Justify the lock period risk

---

## 4. Lock Period Analysis

### Current Plan: 7 Days ❌

**Problems:**
- No real commitment required
- High churn (stake/unstake frequently)
- Mercenary capital seeking quick profits
- No stability for governance

### Recommended: Tiered Lock System ✅

| Tier | Min Stake | Lock Period | Reward Multiplier | Target Audience |
|------|-----------|-------------|-------------------|-----------------|
| **Bronze** | 1,000 RCG | 90 days | 1.0x | Testing/new shops |
| **Silver** | 5,000 RCG | 180 days | 1.75x | Committed shops |
| **Gold** | 10,000 RCG | 365 days | 2.5x | Premium tier shops |
| **Platinum** | 50,000 RCG | 730 days | 4.0x | Elite tier shops |

**Benefits:**
- Longer locks = Higher rewards (fair incentive)
- Price stability (less dumping)
- True believers get rewarded
- Flexible options for different risk appetites

**Emergency Unstake Option:**
- Can unstake early with 25% penalty
- Penalty goes to remaining stakers
- Safety valve for liquidity needs

---

## 5. What Scale Do We Need?

### Minimum Viable Staking

**To achieve 10% organic APR:**
- Required monthly revenue: $1,125
- Required RCN sales: ~14,000 RCN/month
- **Current gap:** 5.9x more activity needed

**Translation:**
- Need: **20+ shops** minimum
- Need: **1,000+ active customers**
- Need: **$2,000+/month platform revenue**

### Growth Projections

| Stage | Shops | Revenue/Month | Staker Pool/Year | Organic APR* |
|-------|-------|---------------|------------------|--------------|
| **Now** | 2 | $240 | $288 | **2.1%** ❌ |
| **Phase 1** | 20 | $2,400 | $2,880 | **~5%** ⚠️ |
| **Phase 2** | 100 | $12,000 | $14,400 | **~8%** ✅ |
| **Phase 3** | 500 | $60,000 | $72,000 | **12-15%** ✅✅ |

*Assuming reasonable amount of RCG staked

---

## 6. Liquidity Mining Solution

### The Problem
At current scale (2 shops), staking rewards are essentially zero.

### The Solution
**Subsidize rewards during bootstrap phase with liquidity mining program**

#### Program Structure

**Total Allocation:** 5M RCG (5% of total supply)

**Distribution Schedule:**
```
Phase 1 (Months 1-6): $3,000/month subsidy
Phase 2 (Months 7-12): $1,500/month subsidy
Phase 3 (Months 13-18): $750/month subsidy
Phase 4 (Months 19+): Phase out, organic only

Total Budget: ~$32K over 18 months
```

**Expected Results with Liquidity Mining:**

| Phase | Shops | Organic APR | + Subsidy | Effective APR |
|-------|-------|-------------|-----------|---------------|
| 1 | 20 | ~5% | $3K/mo | **35-40%** ✅ |
| 2 | 100 | ~8% | $1.5K/mo | **12-15%** ✅ |
| 3 | 500+ | 12-15% | None | **12-15%** ✅ |

---

## 7. Launch Strategy Recommendation

### ⚠️ DON'T Launch Staking Yet

**Why:**
- 2.1% APR will damage reputation
- "This is a scam" perception
- Waste of development resources
- Better to wait for scale

### Recommended Timeline

#### **Phase 0: Now - Month 3** (Pre-Launch)
**Focus:** Platform Growth
- ❌ Don't launch staking
- ✅ Secure liquidity mining fund (5M RCG)
- ✅ Continue shop acquisition
- ✅ Get to 20+ shops minimum
- ✅ Smart contract development & audit

**Target Before Launch:**
- 20+ shops
- 1,000+ customers
- $2,000+/month revenue
- Liquidity mining fund ready

---

#### **Phase 1: Month 3-6** (Soft Launch)
**Status:** 20 shops, $2.4K/month revenue

**Staking Program:**
- Minimum stake: 1,000 RCG
- Lock period: 90 days (Bronze tier)
- Organic APR: ~5%
- With subsidy: **35-40% APR**

**Budget:** $3,000/month subsidy

---

#### **Phase 2: Month 7-18** (Growth)
**Status:** 100 shops, $12K/month revenue

**Staking Program:**
- All tiers available (Bronze/Silver/Gold)
- Organic APR: ~8%
- With subsidy: **12-15% APR**

**Budget:** $1,500/month subsidy (reducing)

---

#### **Phase 3: Year 2+** (Sustainable)
**Status:** 500+ shops, $60K/month revenue

**Staking Program:**
- Organic APR: **12-15%**
- NO subsidy needed ✅
- Self-sustaining model
- Platinum tier (2-year locks) available

---

## 8. Updated Staking Parameters

### Before (Original Concept)
```
Minimum Stake: 100 RCG
Lock Period: 7 days
Unstake Cooldown: 7 days
Distribution: Continuous
```

### After (Recommended)
```
Minimum Stake: 1,000 RCG
Lock Period: 90 days (Bronze) to 730 days (Platinum)
Unstake Cooldown: 14 days
Distribution: Weekly
Emergency Unstake: Yes (25% penalty)
Tiered Multipliers: 1x to 4x based on lock duration
```

---

## 9. Capital Requirements

### Liquidity Mining Budget

**18-Month Bootstrap Plan:**
```
Months 1-6:   $3,000/month × 6  = $18,000
Months 7-12:  $1,500/month × 6  = $9,000
Months 13-18: $750/month × 6    = $4,500
────────────────────────────────────────
Total:                            $31,500
```

### Funding Options

**Option A: RCG Allocation** (Recommended)
- Allocate 5M RCG from treasury/team allocation
- Vesting: ~278K RCG/month for 18 months
- Value at $0.50: $139K/month equivalent
- Can extend to 5+ years if needed
- **Cost:** Dilution only, no cash needed

**Option B: Cash Subsidy**
- Raise $32K from investors/founders
- Buy RCG from market and distribute
- Supports RCG price
- **Cost:** $32K cash

**Option C: Hybrid** (Most Balanced)
- 50% RCG allocation (2.5M RCG)
- 50% cash subsidy ($16K)
- **Cost:** $16K cash + dilution

---

## 10. Risk Assessment

### Risks of Launching Too Early (Now)

| Risk | Impact | Probability |
|------|--------|-------------|
| Reputation damage ("0.001% APR scam") | High | Very High |
| No staking adoption | High | High |
| Wasted development time | Medium | High |
| Bad precedent set | Medium | Medium |

**Recommendation:** ❌ Don't launch until 20+ shops

---

### Risks of Waiting

| Risk | Impact | Probability |
|------|--------|-------------|
| Competitors launch first | Low | Low |
| Shops ask "where's staking?" | Low | Medium |
| Development delay | Low | Low |

**Recommendation:** ✅ Wait is safer

---

### Risks of Liquidity Mining

| Risk | Impact | Mitigation |
|------|--------|-----------|
| 5M RCG dilution | Medium | Vesting schedule, only 5% of supply |
| Mercenary farmers dump | Medium | 90-day minimum lock, tiered system |
| Budget overrun | Low | Fixed cap, reduce if needed |
| Subsidy dependency | Medium | Gradual phase-out plan |

**Recommendation:** ✅ Manageable with proper execution

---

## 11. Decision Points for Tomorrow's Meeting

### Key Questions to Decide

#### 1. Launch Timing
- [ ] **Option A:** Launch now with current 2 shops (NOT recommended)
- [ ] **Option B:** Launch when we hit 20 shops (~3 months)
- [ ] **Option C:** Launch when we hit 50 shops (~6 months)

**Recommendation:** Option B - 20 shops minimum

---

#### 2. Lock Period
- [ ] **Option A:** Keep 7 days (original plan)
- [ ] **Option B:** Single 90-day lock for all
- [ ] **Option C:** Tiered system (90/180/365/730 days)

**Recommendation:** Option C - Tiered system

---

#### 3. Minimum Stake
- [ ] **Option A:** 100 RCG (original)
- [ ] **Option B:** 1,000 RCG
- [ ] **Option C:** 5,000 RCG

**Recommendation:** Option B - 1,000 RCG

---

#### 4. Liquidity Mining
- [ ] **Option A:** No subsidy, organic only
- [ ] **Option B:** 5M RCG allocation over 18 months
- [ ] **Option C:** $32K cash subsidy
- [ ] **Option D:** Hybrid (2.5M RCG + $16K)

**Recommendation:** Option B or D

---

#### 5. Smart Contract Priority
- [ ] **Option A:** Start development now
- [ ] **Option B:** Wait until we have 20 shops
- [ ] **Option C:** Start audit process now, deploy later

**Recommendation:** Option C - Start now, deploy when ready

---

## 12. Action Items (If Approved)

### Immediate (This Week)
- [ ] Finalize staking parameters decision
- [ ] Secure liquidity mining budget approval
- [ ] Begin smart contract development
- [ ] Update UI with final lock periods

### Short-term (Month 1-3)
- [ ] Complete smart contract audit
- [ ] Acquire 20+ shops (sales/marketing focus)
- [ ] Prepare staking launch marketing
- [ ] Set up reward distribution backend

### Medium-term (Month 3-6)
- [ ] Launch staking (if 20+ shops achieved)
- [ ] Monitor APR and adjust subsidies
- [ ] Gather shop feedback
- [ ] Iterate on parameters

### Long-term (Month 6+)
- [ ] Reduce subsidies as platform grows
- [ ] Add governance voting features
- [ ] Expand to additional tiers
- [ ] Achieve self-sustainability

---

## 13. Success Metrics

### Key Performance Indicators (KPIs)

**Staking Adoption:**
- Target: 30-50% of circulating RCG staked
- Target: 100+ unique stakers by Month 12
- Target: Average stake duration >180 days

**Economic Health:**
- Target: 8-15% sustainable APR by Year 2
- Target: $2K+/month organic staker pool by Month 12
- Target: Zero subsidy needed by Month 24

**Platform Growth:**
- Target: 20 shops by Month 3 (staking launch)
- Target: 100 shops by Month 12
- Target: 500 shops by Year 2

---

## 14. Summary & Recommendation

### Current Reality
✅ **Staking UI:** Complete and ready
✅ **Economic Model:** Analyzed and documented
❌ **Platform Scale:** Too small (only 2 shops)
❌ **Organic APR:** Only 2.1% (not attractive)

### Critical Path Forward

1. **DON'T launch staking now** (will fail)
2. **DO secure liquidity mining fund** (5M RCG or $32K)
3. **DO focus on shop acquisition** (get to 20+ shops)
4. **DO implement tiered locks** (90/180/365/730 days)
5. **DO launch when ready** (20+ shops, $2K/month revenue)

### Timeline to Viability
```
Today:        2 shops, can't launch ❌
Month 3:      20 shops, can soft launch with subsidy ✅
Month 12:     100 shops, reducing subsidy ✅
Year 2:       500+ shops, self-sustainable ✅✅
```

### The Ask
**Approve:**
- [ ] 90-day minimum lock period (tiered system)
- [ ] 1,000 RCG minimum stake
- [ ] 5M RCG liquidity mining allocation
- [ ] Delay launch until 20+ shops acquired
- [ ] Begin smart contract development now

**Expected Outcome:**
- Successful staking launch in 3-6 months
- 35-40% APR at launch (with subsidy)
- Sustainable 12-15% APR by Year 2
- Platform credibility maintained

---

## 15. Questions for Discussion

1. **Are we comfortable waiting 3-6 months to launch staking?**
   - Alternative: Launch now but expect poor adoption

2. **Can we secure 5M RCG for liquidity mining?**
   - From where: Team allocation? DAO treasury? New mint?

3. **What if we don't reach 20 shops in 3 months?**
   - Contingency: Keep waiting or reduce target to 10 shops?

4. **Should we announce staking now or wait until launch?**
   - Marketing consideration: Build hype vs manage expectations

5. **Who manages the liquidity mining program?**
   - Automated smart contract or manual distribution?

---

## Appendix: Detailed Calculations

### Scenario Analysis

**Current (2 shops):**
```
Monthly RCN: 2,400
Platform Revenue: $240/month
Annual Staker Pool: $288
Staked RCG: 27,000
APR: 2.13%
```

**Phase 1 Launch (20 shops):**
```
Monthly RCN: 24,000
Platform Revenue: $2,400/month
Annual Staker Pool: $2,880 organic + $36,000 subsidy = $38,880
Staked RCG: 200,000
APR: 38.9%
```

**Phase 2 Growth (100 shops):**
```
Monthly RCN: 120,000
Platform Revenue: $12,000/month
Annual Staker Pool: $14,400 organic + $18,000 subsidy = $32,400
Staked RCG: 1,200,000
APR: 12-15%
```

**Phase 3 Sustainable (500 shops):**
```
Monthly RCN: 600,000
Platform Revenue: $60,000/month
Annual Staker Pool: $72,000 organic
Staked RCG: 7,500,000
APR: 12-15% (no subsidy needed)
```

---

**End of Document**

**Next Steps:** Review in meeting, make decisions, execute plan

**Contact:** Development team for technical questions
**Timeline:** Decisions needed by end of week to maintain momentum
