# RepairCoin Missing Features & Implementation Roadmap

**Last Updated**: August 29, 2025  
**Current Status**: Single-token RCN system implemented  
**Target State**: Dual-token RCN+RCG ecosystem  

## 🚨 Executive Summary

The RepairCoin platform currently operates with RCN (utility token) only. The new specifications require integration of RCG (governance token) which fundamentally changes the business model:

- **Current**: Shops pay fixed $0.10 per RCN
- **Required**: Shops pay $0.10/$0.08/$0.06 based on RCG holdings
- **Revenue**: Must implement 80/10/10 split (operations/stakers/DAO)
- **Governance**: RCG holders control platform parameters

## 🔴 Critical Missing Features

### 1. RCG Token Infrastructure

#### Smart Contracts Not Deployed
| Contract | Purpose | Priority | Complexity |
|----------|---------|----------|------------|
| RCG Token | ERC-20 governance token (100M supply) | CRITICAL | Medium |
| Staking Contract | 30-day lock, USDC rewards | CRITICAL | High |
| Revenue Distribution | Weekly USDC payments | CRITICAL | High |
| DAO Governance | Voting and proposals | HIGH | High |
| Vesting Contract | Team/investor locks | HIGH | Medium |
| Multi-sig Wallet | Admin controls | CRITICAL | Low |

#### Backend Services Needed
```typescript
// Required but not implemented:
interface RCGService {
  getBalance(address: string): Promise<number>
  getShopTier(address: string): Promise<'standard'|'premium'|'elite'>
  calculateRCNPrice(tier: string): number
  validateMinimumStake(address: string): Promise<boolean>
  checkCommitmentPath(shopId: string): Promise<boolean>
}

interface RevenueService {
  trackSale(shopId: string, amount: number, tier: string): void
  calculateDistribution(): {stakers: number, dao: number, ops: number}
  distributeWeeklyRewards(): Promise<void>
  getStakerShare(address: string): number
}
```

### 2. Shop System Updates

#### Current vs Required
| Feature | Current Implementation | Required Implementation |
|---------|----------------------|------------------------|
| Registration | No token requirement | 10,000 RCG minimum or commitment |
| RCN Pricing | Fixed $0.10 | $0.10/$0.08/$0.06 by tier |
| Tier System | Not implemented | Standard/Premium/Elite |
| Revenue | 100% to platform | 80/10/10 split |

#### Missing API Endpoints
```javascript
// Shop tier management
POST   /api/shops/{shopId}/validate-rcg
GET    /api/shops/{shopId}/tier
POST   /api/shops/{shopId}/commitment-path
PUT    /api/shops/{shopId}/update-tier

// Revenue distribution
GET    /api/revenue/current-week
POST   /api/revenue/calculate-distribution
GET    /api/revenue/staker-rewards/{address}
POST   /api/revenue/distribute-weekly

// RCG staking
POST   /api/staking/stake
POST   /api/staking/unstake
GET    /api/staking/balance/{address}
GET    /api/staking/apr
```

### 3. Database Schema Updates

```sql
-- Missing tables
CREATE TABLE rcg_holdings (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE,
  balance NUMERIC(18,2),
  last_updated TIMESTAMP,
  is_staked BOOLEAN DEFAULT FALSE
);

CREATE TABLE shop_tiers (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER REFERENCES shops(id),
  tier VARCHAR(20) NOT NULL, -- 'standard', 'premium', 'elite'
  rcg_balance NUMERIC(18,2),
  commitment_path BOOLEAN DEFAULT FALSE,
  commitment_amount NUMERIC(10,2),
  tier_updated_at TIMESTAMP
);

CREATE TABLE revenue_distributions (
  id SERIAL PRIMARY KEY,
  week_start DATE,
  total_rcn_sold NUMERIC(18,2),
  total_revenue_usd NUMERIC(18,2),
  stakers_share NUMERIC(18,2),
  dao_share NUMERIC(18,2),
  operations_share NUMERIC(18,2),
  distributed BOOLEAN DEFAULT FALSE,
  distributed_at TIMESTAMP
);

CREATE TABLE staking_records (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42),
  amount_staked NUMERIC(18,2),
  staked_at TIMESTAMP,
  unlock_date TIMESTAMP,
  rewards_claimed NUMERIC(18,2) DEFAULT 0
);

CREATE TABLE dao_proposals (
  id SERIAL PRIMARY KEY,
  proposal_id VARCHAR(100),
  proposer_address VARCHAR(42),
  title VARCHAR(500),
  description TEXT,
  parameter_changes JSONB,
  votes_for NUMERIC(18,2) DEFAULT 0,
  votes_against NUMERIC(18,2) DEFAULT 0,
  status VARCHAR(20), -- 'active', 'passed', 'rejected', 'executed'
  created_at TIMESTAMP,
  voting_ends_at TIMESTAMP
);
```

### 4. Frontend Components Missing

#### Admin Dashboard
- [ ] RCG Token Distribution Manager
- [ ] Staking Analytics Dashboard
- [ ] Revenue Distribution Monitor
- [ ] DAO Treasury Manager
- [ ] Vesting Schedule Viewer

#### Shop Dashboard
- [ ] RCG Tier Status Display
- [ ] Tier Upgrade Prompt
- [ ] Dynamic Pricing Calculator
- [ ] Commitment Path Option

#### New Pages Needed
- [ ] `/staking` - RCG staking interface
- [ ] `/governance` - DAO voting portal
- [ ] `/treasury` - Community fund management
- [ ] `/vesting` - Token unlock schedules

### 5. Mobile App Features

#### Customer App (Not Started)
- [ ] Basic wallet and balance view
- [ ] RCN earning and redemption
- [ ] Shop discovery with tiers
- [ ] Referral system
- [ ] RCG balance display
- [ ] Staking interface

#### Shop App (Not Started)
- [ ] Staff authentication
- [ ] QR code scanner
- [ ] RCN reward issuance
- [ ] Tier status display
- [ ] Purchase RCN interface
- [ ] Transaction history

### 6. Infrastructure & DevOps

#### Missing Components
- [ ] RCG token deployment scripts
- [ ] Liquidity pool deployment
- [ ] Multi-sig wallet setup
- [ ] Mainnet migration plan
- [ ] Monitoring for dual-token system
- [ ] Security audit preparation

## 🟡 Features Requiring Updates

### 1. Shop Registration Flow
**Current**: Simple form with business info  
**Needed**: 
- RCG balance check
- Tier selection
- Commitment path option
- Wallet validation

### 2. Shop RCN Purchase
**Current**: Fixed $0.10 price  
**Needed**:
- Tier detection
- Dynamic pricing
- Revenue split calculation
- Distribution tracking

### 3. Treasury Management
**Current**: Simple tracking  
**Needed**:
- Connected to revenue flow
- DAO control mechanisms
- Multi-sig integration

## 📋 Implementation Phases

### Phase 1: Foundation (Week 1-2)
```
1. Deploy RCG token contract
2. Create RCG balance checking service
3. Add database schema updates
4. Update shop registration validation
5. Implement tier detection logic
```

### Phase 2: Pricing Integration (Week 3-4)
```
1. Update shop purchase endpoint
2. Implement dynamic pricing
3. Add revenue tracking
4. Create tier management UI
5. Test tier transitions
```

### Phase 3: Staking & Revenue (Week 5-6)
```
1. Deploy staking contract
2. Build staking interface
3. Implement distribution calculation
4. Create USDC payment system
5. Launch staking dashboard
```

### Phase 4: Governance (Week 7-8)
```
1. Deploy DAO contracts
2. Build voting interface
3. Connect parameters to votes
4. Implement proposal system
5. Launch governance portal
```

### Phase 5: Trading & Liquidity (Week 9-10)
```
1. Prepare DEX listings
2. Deploy liquidity pools
3. Setup market making
4. Apply for CEX listings
5. Launch public trading
```

## 🚧 Technical Debt to Address

1. **Contract Interactions**: Need Web3 service for RCG
2. **Price Oracle**: For real-time RCG/USD pricing
3. **Event System**: For tier changes and distributions
4. **Caching Layer**: For RCG balances and tiers
5. **Background Jobs**: For weekly distributions

## ⚠️ Risks & Blockers

1. **Smart Contract Security**: Needs professional audit
2. **Regulatory Compliance**: RCG as investment token
3. **Liquidity Requirements**: $1.25M USDC needed
4. **Technical Complexity**: Dual-token adds significant complexity
5. **Migration Risk**: Existing shops need smooth transition

## 📊 Success Metrics

- [ ] RCG token deployed and distributed
- [ ] 50+ shops migrated to tier system
- [ ] First weekly distribution completed
- [ ] DAO proposal voted and executed
- [ ] $1M+ in DEX liquidity
- [ ] 1000+ RCG holders

## 🔗 Dependencies

1. **Legal**: Securities compliance review
2. **Financial**: Funding for liquidity
3. **Technical**: Audit completion
4. **Business**: Shop education on new model
5. **Marketing**: RCG value proposition

## 💡 Quick Start for Developers

```bash
# Check current status
npm run check:features

# Run integration tests (when implemented)
npm run test:rcg-integration

# Deploy contracts (when ready)
npm run deploy:rcg-contracts

# Start with mock RCG service
npm run dev:mock-rcg
```

## 📝 Notes

- Current system assumes single token model
- All prices hardcoded to $0.10
- No governance infrastructure exists
- Revenue goes 100% to platform
- Database needs significant updates

**Remember**: RCG integration is not just adding a token - it's a fundamental business model change requiring updates throughout the entire codebase.