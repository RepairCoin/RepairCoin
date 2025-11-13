# RepairCoin (RCN) - Utility Token Specifications v3.0

**Document Version:** 3.0  
**Date:** August 29, 2025  
**Token Type:** Pure Utility Token (Loyalty Rewards)  
**Governance Integration:** RepairCoin Governance (RCG) Required

## Quick Reference

### Token Basics
- **Name:** RepairCoin (RCN)
- **Symbol:** RCN
- **Standard:** ERC-20 (Base Chain)
- **Supply:** Unlimited (mint as needed)
- **Trading:** Not available - Internal ecosystem only
- **Value:** Fixed $0.10 USD redemption at shops
- **Contract:** TBD (deployment pending)

### Governance Token (RCG)
- **Purpose:** Platform governance and shop participation
- **Shop Requirement:** Minimum 10,000 RCG stake
- **Tier Benefits:** Better RCN pricing for higher RCG holdings
- **Revenue Share:** 10% of RCN sales to RCG stakers

## Key Changes in v3.0

1. **RCG Integration Required**: Shops must stake RCG tokens to participate
2. **Tiered Pricing Model**: RCN purchase price varies by shop's RCG holdings
3. **Revenue Distribution**: 80% operations, 10% RCG stakers, 10% DAO treasury
4. **Governance Control**: RCG holders vote on earning rates and platform parameters
5. **No Public Trading**: RCN remains purely internal utility token
6. **Universal Redemption**: Customers can redeem 20% of tokens at any participating shop
7. **No Earning Limits**: Removed daily and monthly earning caps

## Shop Tier System

| Tier | RCG Required | RCN Price | Investment | Benefits |
|------|--------------|-----------|------------|----------|
| Standard | 10,000 - 49,999 | $0.10 | ~$5,000 | Basic platform access |
| Premium | 50,000 - 199,999 | $0.08 | ~$25,000 | Advanced analytics, priority support |
| Elite | 200,000+ | $0.06 | ~$100,000 | VIP status, dedicated account manager |

## Customer Earning Structure

### Base Earnings
- **Small Repairs ($50-$99):** 10 RCN
- **Large Repairs ($100+):** 25 RCN
- **No Daily or Monthly Limits**

### Tier Bonuses (Auto-applied)
- **Bronze (0-199 RCN):** No bonus
- **Silver (200-999 RCN):** +2 RCN per repair
- **Gold (1000+ RCN):** +5 RCN per repair

### Referral System
- **Referrer Reward:** 25 RCN (after referee's first repair)
- **Referee Bonus:** 10 RCN on first repair

### Redemption Rules
- **Base Redemption:** 20% of earned tokens can be redeemed at any participating shop
- **Home Shop:** 100% of tokens earned at a specific shop can be redeemed there
- **No restrictions on which shop's tokens can be redeemed**

## Technical Integration

### Smart Contract Functions
```solidity
mint(address to, uint256 amount) // Admin only
burn(uint256 amount) // On redemption
transfer(address to, uint256 amount) // Standard ERC-20
balanceOf(address account) // Check balance
```

### FixFlow CRM Webhooks
- `repair_completed` - Triggers RCN earning
- `referral_verified` - Processes referral rewards
- `tier_bonus_applied` - Adds tier bonuses

### API Endpoints (Backend Implementation)
- `POST /api/tokens/mint` - Mint RCN to customer
- `POST /api/tokens/verify-redemption` - Validate redemption
- `GET /api/tokens/earned-balance/{address}` - Get earned balance
- `POST /api/shops/{shopId}/purchase-rcn` - Shop buys RCN

## Revenue Model

### From RCN Sales to Shops
```
Total Revenue (100%)
├─ Platform Operations (80%)
│   ├─ Development
│   ├─ Infrastructure
│   └─ Support
├─ RCG Stakers (10%)
│   └─ Weekly USDC distributions
└─ DAO Treasury (10%)
    ├─ Marketing campaigns
    ├─ Feature development
    └─ Security audits
```

## Governance Parameters (RCG DAO Controlled)

- Earning rates per repair size
- Tier bonus amounts
- Base redemption percentage (currently 20% at all shops)
- Shop onboarding requirements
- Revenue distribution percentages

## Implementation Status

### ✅ Already Implemented
- Admin dashboard with shop management
- Customer registration and wallet system
- Shop registration with tier tracking
- Token minting and burning functions
- Referral system backend
- Cross-shop verification API
- Treasury management system

### 🔴 Pending Implementation
- RCG token deployment and staking
- Shop tier pricing integration
- RCG holder revenue distribution
- DAO governance voting system
- Updated shop purchase flow with tiers
- Mobile apps (customer and shop)

## Development Priorities

### Phase 1: RCG Foundation (Next 3 months)
1. Deploy RCG governance token
2. Implement staking platform
3. Create DAO voting system
4. Set up revenue distribution

### Phase 2: RCN Integration (Months 4-6)
1. Update shop purchase API for tier pricing
2. Integrate RCG requirements in shop registration
3. Implement automated revenue distribution
4. Deploy production RCN contract

### Phase 3: Full Launch (Months 7-9)
1. Mobile app deployment
2. Marketing website
3. Shop onboarding campaign
4. Customer acquisition

## Security Considerations

- Multi-sig wallet for admin minting control
- Smart contract audits before mainnet
- Rate limiting on all endpoints
- Fraud detection for earning patterns
- Emergency pause functionality

## API Integration Guide

### For Developers
```javascript
// Check shop's RCG tier
const tier = await getShopTier(shopAddress);

// Calculate RCN purchase price
const price = tierPrices[tier]; // 0.10, 0.08, or 0.06

// Process shop RCN purchase
await processShopPurchase(shopId, rcnAmount, tier);

// Distribute earnings to RCG stakers
await distributeRevenue(totalRevenue);
```

## Next Steps

1. **Immediate:** Update CLAUDE.md with RCG integration requirements
2. **This Week:** Plan RCG token deployment specifications
3. **This Month:** Begin Phase 1 implementation
4. **Q4 2025:** Complete dual-token ecosystem launch

---

**Note:** This document supersedes previous RCN specifications. All development should follow the dual-token model with RCG governance integration.