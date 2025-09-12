# RepairCoin Token Specifications

**Last Updated**: August 29, 2025  
**RCN Version**: 3.0  
**RCG Version**: 2.0

## Overview

RepairCoin operates a dual-token ecosystem:
- **RCN (RepairCoin)**: Utility token for loyalty rewards (non-tradeable)
- **RCG (RepairCoin Governance)**: Governance token for platform control and revenue sharing

## RCN - Utility Token

### Basic Information
- **Name**: RepairCoin
- **Symbol**: RCN
- **Standard**: ERC-20 (Base Chain)
- **Total Supply**: Unlimited (mint as needed)
- **Contract Address**: `0xBFE793d78B6B83859b528F191bd6F2b8555D951C`
- **Thirdweb Client ID**: `1969ac335e07ba13ad0f8d1a1de4f6ab`

### Token Economics
- **Supply Type**: Unlimited minting capability
- **Minting Authority**: RepairCoin Admin only
- **Fixed Value**: 1 RCN = $0.10 USD at all shops
- **Public Trading**: Not available - internal ecosystem only
- **Token Flow**: Admin → Shops → Customers → Burned on redemption

### Customer Earning
- **Small Repairs ($50-$99)**: 10 RCN base
- **Large Repairs ($100+)**: 25 RCN base
- **Daily Limit**: 50 RCN per customer
- **Monthly Limit**: 500 RCN per customer

### Customer Tiers
- **Bronze (0-199 RCN lifetime)**: +10 RCN bonus
- **Silver (200-999 RCN lifetime)**: +20 RCN bonus
- **Gold (1000+ RCN lifetime)**: +30 RCN bonus

### Referral System
- **Referrer Reward**: 25 RCN after referee's first repair
- **Referee Bonus**: 10 RCN on first repair

### Redemption Rules
- **Home Shop**: 100% of earned balance
- **Cross-Shop**: Maximum 20% of lifetime earned
- **Burn on Use**: Tokens destroyed when redeemed

## RCG - Governance Token

### Basic Information
- **Name**: RepairCoin Governance
- **Symbol**: RCG
- **Standard**: ERC-20 (Base Chain)
- **Total Supply**: 100,000,000 RCG (fixed, never increases)
- **Contract Address**: `0x973D8b27E7CD72270F9C07d94381f522bC9D4304`
- **Thirdweb Client ID**: `99f01d5781fadab9f6a42660090e824b`
- **Public Trading**: Available on DEXs and future CEX listings

### Purpose
- Platform governance and decision making
- Shop tier determination for RCN pricing discounts
- Revenue sharing qualification via staking
- Investment opportunity tied to platform growth

### Token Distribution (100M Total)
- **Team & Founders**: 30M RCG (30%)
  - Miguel Rodriguez (Founder): 18M RCG-B class
  - Zeff (Lead Developer): 8M RCG
  - Team Pool: 4M RCG
- **Private Investors**: 30M RCG (30%)
  - Seed Round: 10M RCG
  - Series A: 10M RCG
  - Strategic: 10M RCG
- **Public Sale**: 20M RCG (20%)
  - IDO Launch: 15M RCG
  - DEX Liquidity: 5M RCG
- **DAO Treasury**: 15M RCG (15%)
- **Staking Rewards**: 5M RCG (5%)

### Vesting Schedules
- **Team & Founders**: 4-year vesting, 1-year cliff
- **Private Investors**: 2-year vesting, 6-month cliff
- **Public Sale**: 20% at TGE, 20% monthly for 4 months
- **DAO Treasury**: Unlocked via governance votes only
- **Staking Rewards**: Linear emission over 4 years

### Shop Requirements & Tier System
- **Minimum Stake**: 10,000 RCG to become partner
- **Lock Period**: 6 months minimum
- **Recovery**: Unlocked after 30-day notice

### Shop Tier Benefits

| Tier | RCG Holdings | RCN Price | Savings | RCG Investment |
|------|--------------|-----------|---------|----------------|
| Standard | 10K-49K | $0.10 | 0% | ~$5,000 |
| Premium | 50K-199K | $0.08 | 20% | ~$25,000 |
| Elite | 200K+ | $0.06 | 40% | ~$100,000 |

**Alternative Qualification**: 6-month purchase commitment
- Standard: $300/month minimum
- Premium: $800/month minimum  
- Elite: $2,000/month minimum

### Revenue Distribution

From each RCN sale to shops:
- **80%**: Platform Operations (development, infrastructure, support)
- **10%**: RCG Stakers (weekly USDC distributions)
- **10%**: DAO Treasury (community-controlled)

### Staking Mechanism
- **Who Can Stake**: Any RCG holder (no minimum)
- **Lock Period**: 30-day minimum commitment
- **Rewards**: Weekly USDC distributions
- **Calculation**: Your stake ÷ Total staked × 10% revenue share
- **Unstaking**: 7-day cooldown period

### Governance System
- **Voting Power**: 1 RCG = 1 vote (RCG-B = 10 votes)
- **Proposal Threshold**: 100,000 RCG required
- **Quorum**: 5% of circulating supply
- **Passing**: 60% majority required
- **Voting Period**: 7 days
- **Dual-Class**: RCG-B (founder class) has 10x voting power

### Value Drivers
1. **Mandatory Shop Holdings**: Every shop needs 10K+ RCG
2. **Cost Savings**: 20-40% discount on RCN purchases
3. **Revenue Sharing**: 10% of platform revenue to stakers
4. **Fixed Supply**: Only 100M RCG ever
5. **Governance Rights**: Control over growing platform

## Governance Parameters

### DAO-Controlled Settings
The following can be adjusted by RCG holder votes:

**Customer Parameters**:
- Earning rates per repair type
- Tier bonus amounts
- Daily/monthly earning limits
- Referral reward amounts

**Shop Parameters**:
- Cross-shop redemption percentage
- Minimum RCG stake requirements
- Tier thresholds and benefits

**Platform Parameters**:
- Revenue distribution percentages
- Security limits and thresholds

## Technical Integration

### Smart Contract Functions
**RCN Contract**:
- `mint(address to, uint256 amount)` - Admin only
- `burn(uint256 amount)` - Anyone (for redemptions)
- `transfer()` - Standard ERC-20
- `balanceOf()` - Check balances

**RCG Contract**:
- Standard ERC-20 functions
- Governance voting (future implementation)
- Staking mechanisms (future implementation)

### API Integration
- Thirdweb SDK v5 compatible
- RESTful API for all operations
- Webhook support for automated minting

## Security Features

### RCN Security
- Admin-only minting
- Burn on redemption prevents reuse
- Daily/monthly limits prevent abuse
- Pattern monitoring for fraud detection

### RCG Security
- Fixed supply prevents dilution
- 6-month lock prevents quick flips
- Public blockchain transparency

## Implementation Status

### Completed ✅
- Basic RCN minting functionality
- Customer earning system (repairs, tiers, referrals)
- Shop registration and management
- Fixed-price RCN purchases ($0.10)
- Admin dashboard with treasury tracking
- Cross-shop verification system
- Referral reward distribution

### Missing/Required 🔴
- **RCG Staking Platform**: For revenue sharing
- **Tier-Based RCN Pricing**: Dynamic pricing based on RCG holdings
- **Revenue Distribution System**: Weekly USDC payments to stakers
- **DAO Governance Interface**: For parameter voting
- **RCG Balance Checking**: In shop registration/purchase flows
- **Vesting Contracts**: For team/investor token locks
- **Burn Mechanism**: On RCN redemption
- **Multi-sig Wallet**: For admin control
- **Purchase Commitment Path**: Alternative to RCG holdings

### In Development ⏳
- Mobile applications (customer & shop)
- Marketing website
- Advanced analytics
- Production infrastructure

## Technical Requirements

### Smart Contracts Needed
1. **RCG Staking Contract**
   - Stake/unstake with 30-day minimum
   - Track staking amounts and duration
   - Calculate revenue share percentages
   
2. **Revenue Distribution Contract**
   - Receive platform revenue in USDC
   - Calculate weekly distributions
   - Send USDC to stakers proportionally
   
3. **Vesting Contract**
   - Lock tokens with cliff/vesting schedules
   - Support different beneficiary types
   - Allow emergency unlocks via governance

4. **DAO Governance Contract**
   - Proposal creation and voting
   - Parameter adjustment execution
   - Treasury management

### Backend Updates Required
1. **RCG Integration Service**
   - Check wallet RCG balance
   - Determine shop tier
   - Calculate dynamic RCN pricing
   
2. **Revenue Tracking System**
   - Track all RCN sales by tier
   - Calculate 10/10/80 split
   - Prepare distribution data

3. **Shop Registration Updates**
   - Validate 10K RCG minimum
   - Support commitment path option
   - Store tier information

## Network Information

**Current Network**: Base Sepolia (Testnet)
**Chain ID**: 84532
**RPC URL**: https://sepolia.base.org
**Block Explorer**: https://sepolia.basescan.org

## Migration to Mainnet

### Pre-Launch Requirements
1. Complete all missing functionality
2. Security audits on all contracts
3. Multi-sig wallet setup
4. Legal/compliance review

### Launch Steps
1. Deploy RCG token and distribute initial allocations
2. Deploy staking and governance contracts
3. Deploy updated RCN contract with burn
4. Migrate existing data and balances
5. Update all integrations