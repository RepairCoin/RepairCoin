# Claude Integration Notes - RCN v3.0 Specifications

This file helps Claude understand the latest RepairCoin (RCN) v3.0 specifications and what needs to be implemented.

## 🚨 Major Updates in RCN v3.0 (August 29, 2025)

### 1. **Dual-Token Architecture**
- **RCN**: Utility token for loyalty rewards (unchanged - $0.10 fixed value)
- **RCG**: NEW governance token required for shop participation
- Shops must stake RCG tokens to join the network

### 2. **Shop Tier System Based on RCG Holdings**
```
Standard Partner: 10,000-49,999 RCG → Pay $0.10 per RCN
Premium Partner: 50,000-199,999 RCG → Pay $0.08 per RCN (20% discount)
Elite Partner: 200,000+ RCG → Pay $0.06 per RCN (40% discount)
```

### 3. **Revenue Distribution Model**
From every RCN sale to shops:
- 80% → Platform operations (development, infrastructure)
- 10% → RCG token stakers (weekly USDC distributions)
- 10% → DAO treasury (community-controlled)

### 4. **Governance Features**
RCG token holders can vote on:
- Customer earning rates
- Tier bonus amounts
- Cross-shop redemption limits
- Revenue distribution percentages
- Platform parameters

## 🔧 Implementation Tasks

### High Priority - Backend Updates

1. **Update Shop Purchase API** (`/api/shops/{shopId}/purchase-rcn`)
   - Add RCG balance checking
   - Implement tiered pricing logic
   - Calculate price based on shop's RCG holdings

2. **Create RCG Integration Service**
   ```typescript
   // New service needed
   class RCGService {
     getShopTier(walletAddress: string): Promise<'standard' | 'premium' | 'elite'>
     getRCNPrice(tier: string): number
     checkMinimumStake(walletAddress: string): Promise<boolean>
   }
   ```

3. **Update Shop Registration**
   - Add RCG balance validation (minimum 10,000)
   - Store shop tier in database
   - Block registration if insufficient RCG

4. **Revenue Distribution System**
   - Track all RCN sales with tier information
   - Calculate 10% for RCG stakers
   - Implement weekly USDC distribution mechanism

### Database Schema Updates

```sql
-- Add to shops table
ALTER TABLE shops ADD COLUMN rcg_tier VARCHAR(20) DEFAULT 'standard';
ALTER TABLE shops ADD COLUMN rcg_balance NUMERIC(18,2) DEFAULT 0;
ALTER TABLE shops ADD COLUMN rcg_staked_at TIMESTAMP;

-- New table for revenue tracking
CREATE TABLE revenue_distributions (
  id SERIAL PRIMARY KEY,
  amount_usdc NUMERIC(18,2),
  rcg_stakers_share NUMERIC(18,2),
  dao_treasury_share NUMERIC(18,2),
  platform_share NUMERIC(18,2),
  distributed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Frontend Updates

1. **Shop Dashboard**
   - Display current RCG tier and benefits
   - Show tier-based RCN pricing
   - Add "Upgrade Tier" call-to-action

2. **Admin Dashboard**
   - Revenue distribution tracking tab
   - RCG staker payments history
   - DAO treasury balance display

3. **Shop Registration**
   - RCG balance check before allowing registration
   - Tier selection based on RCG holdings
   - Educational content about tier benefits

## 📋 Testing Checklist

- [ ] Shop can't register without 10,000 RCG
- [ ] RCN price adjusts based on shop's RCG tier
- [ ] Revenue splits correctly (80/10/10)
- [ ] Shop tier updates when RCG balance changes
- [ ] Weekly distribution calculation works correctly

## 🚫 Breaking Changes

1. **Shop Registration**: Will fail without RCG tokens
2. **RCN Purchases**: Price now variable based on tier
3. **Revenue Model**: Platform keeps 80% instead of 100%

## 💡 Implementation Tips

1. Start with RCG integration service (mock it initially)
2. Update shop purchase flow to check tiers
3. Add revenue tracking before enabling distributions
4. Test tier transitions thoroughly
5. Consider grace period for existing shops

## 🔗 Dependencies

- Need RCG token contract address
- Require RCG balance checking capability
- Must integrate with governance voting system
- Need USDC distribution mechanism

## 📅 Timeline Considerations

- RCG must be deployed BEFORE these changes
- Existing shops need migration plan
- Revenue distribution can be manual initially
- Full automation by end of Phase 2

---

**Remember**: This is a major architectural change. The codebase currently assumes single-token model. All shop-related operations need updates to integrate RCG requirements and tier-based pricing.