# RepairCoin Token Specifications

## Overview

RepairCoin operates a dual-token ecosystem:
- **RCN (RepairCoin)**: Utility token for loyalty rewards
- **RCG (RepairCoin Governance)**: Governance token for platform control

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
- **Total Supply**: 100,000,000 RCG (fixed)
- **Contract Address**: `0x973D8b27E7CD72270F9C07d94381f522bC9D4304`
- **Thirdweb Client ID**: `99f01d5781fadab9f6a42660090e824b`

### Purpose
- Platform governance and decision making
- Shop tier determination
- Revenue sharing qualification

### Shop Requirements
- **Minimum Stake**: 10,000 RCG to become partner
- **Lock Period**: 6 months minimum
- **Recovery**: Unlocked after 30-day notice

### Shop Tier Benefits

| Tier | RCG Stake | RCN Price | Savings | Investment |
|------|-----------|-----------|---------|------------|
| Standard | 10K-49K | $0.10 | 0% | ~$5,000 |
| Premium | 50K-199K | $0.08 | 20% | ~$25,000 |
| Elite | 200K+ | $0.06 | 40% | ~$100,000 |

### Revenue Distribution

From each RCN sale to shops:
- **80%**: Platform Operations (development, infrastructure)
- **10%**: RCG Stakers (weekly USDC distributions)
- **10%**: DAO Treasury (community-controlled)

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
- Both token contracts deployed
- Basic minting functionality
- Customer earning system
- Shop purchase mechanism
- Referral system

### In Progress ⏳
- Burn mechanism integration
- RCG staking platform
- Tier-based pricing system
- Revenue distribution

### Planned 📋
- DAO governance interface
- Automated parameter adjustment
- Advanced analytics
- Mobile applications

## Network Information

**Current Network**: Base Sepolia (Testnet)
**Chain ID**: 84532
**RPC URL**: https://sepolia.base.org
**Block Explorer**: https://sepolia.basescan.org

## Migration to Mainnet

When ready for production:
1. Deploy new contracts on Base Mainnet
2. Update all contract addresses
3. Migrate user balances if needed
4. Update environment configurations