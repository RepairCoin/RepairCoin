# RCG Purchase Options

## Overview

RepairCoin Governance (RCG) tokens can be acquired through multiple channels, not just Uniswap. The system now offers comprehensive purchase options tailored to different needs and investment levels.

## Purchase Methods

### 1. **Uniswap DEX (Open Market)**
- **Best for**: Flexible purchases, any amount
- **Pricing**: Market-based (fluctuates with supply/demand)
- **Execution**: Instant via smart contract
- **Features**:
  - Any purchase amount
  - Market-based pricing
  - Instant execution
  - No KYC required

### 2. **Bulk Purchase (Market + Premium)**
- **Best for**: Shops needing exact tier amounts with convenience
- **Pricing**: Current market price + 5% convenience fee
- **Packages**:
  - Standard Tier: 10,000 RCG
  - Premium Tier: 50,000 RCG
  - Elite Tier: 200,000 RCG
- **Features**:
  - Market-based pricing (no arbitrage)
  - White-glove service included
  - Payment flexibility (USDC, wire, ACH)
  - 24-hour processing
- **Why the premium?**: Covers service costs, slippage protection, and personalized support

### 3. **Private Sale (Volume Discounts)**
- **Best for**: Large purchases over 100,000 RCG
- **Pricing**: Market price MINUS volume discount
  - 100K-499K RCG: 5% discount
  - 500K-999K RCG: 10% discount  
  - 1M+ RCG: 15% discount
- **Requirements**:
  - Vesting schedule (prevents immediate dumping)
  - KYC/AML compliance
  - Minimum 6-month lock-up period
- **Features**:
  - Better pricing than market
  - Dedicated account management
  - Custom payment terms
- **Contact**: rcg-sales@repaircoin.com

### 4. **Commitment Program (Alternative Path)**
- **Best for**: Shops without upfront capital
- **Terms**:
  - No RCG purchase required
  - $500/month commitment for 6 months
  - Total commitment: $3,000
  - Get Standard tier benefits immediately
- **Restrictions**:
  - Cannot hold RCG during commitment period
  - No governance rights
  - Must complete 6-month term

## Implementation Details

### Frontend Components

1. **RCGPurchaseModal** (`/frontend/src/components/shop/RCGPurchaseModal.tsx`)
   - Comprehensive modal showing all purchase options
   - Smart recommendation based on current balance and tier goals
   - Direct integration with each purchase method

2. **RCGBalanceCard** (`/frontend/src/components/shop/RCGBalanceCard.tsx`)
   - Updated to show "Buy RCG Tokens" button
   - Opens purchase modal instead of direct Uniswap link
   - Shows current balance and tier progression

3. **OTC Purchase Page** (`/frontend/src/app/shop/rcg-otc/page.tsx`)
   - Detailed package selection
   - Automatic email generation for purchase requests
   - Clear pricing and benefits comparison

4. **Commitment Program Page** (`/frontend/src/app/shop/commitment-program/page.tsx`)
   - Full program details and comparison
   - Terms acceptance flow
   - Application submission

### Backend Support

1. **RCG Management Routes** (`/backend/src/routes/admin/rcg-management.ts`)
   - `/api/admin/rcg/distribution` - RCG distribution overview
   - `/api/admin/rcg/otc-sale` - Process OTC sales
   - `/api/admin/rcg/otc-requests` - View pending OTC requests
   - `/api/admin/rcg/commitment-enrollments` - Manage commitment program

### Why Multiple Options?

1. **Flexibility**: Different shops have different capital situations
2. **Accessibility**: Commitment program allows participation without large upfront cost
3. **Price Discovery**: DEX provides market pricing while OTC offers fixed rates
4. **Volume Incentives**: Larger purchases get better rates through OTC/private sales
5. **Risk Management**: Shops can choose between market risk (DEX) or fixed pricing (OTC)

## Why Market-Based Pricing for All Options?

**Problem with Fixed Prices**:
- If treasury price < market price → Arbitrage opportunity (buy from treasury, sell on market)
- If treasury price > market price → No one buys from treasury (cheaper on market)
- Creates unfair advantages and market distortions

**Solution: Dynamic Pricing**:
- All non-DEX purchases based on current market price
- Small premiums/discounts justify the service level:
  - Bulk Purchase: +5% for convenience and support
  - Private Sale: -5% to -15% for large volumes with vesting
- Prevents arbitrage while providing value-added services

## Token Economics Impact

- **DEX Trading**: Creates price discovery and liquidity
- **Bulk Purchases**: Premium revenue funds operations
- **Private Sales**: Large volume commitments stabilize price
- **Commitment Program**: Ensures steady RCN demand ($500/month)

## Next Steps

1. **Liquidity Provision**: Deploy initial liquidity to Uniswap
2. **OTC Processing**: Set up payment processing for OTC sales
3. **Commitment Billing**: Implement recurring billing system
4. **Private Sale Terms**: Create detailed term sheets for large investors

## Security Considerations

- OTC sales require manual verification and transfer
- Commitment program requires credit checks
- Private sales require KYC/AML compliance
- All treasury transfers require multi-sig approval