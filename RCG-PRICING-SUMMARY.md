# RCG Pricing Summary

## Market-Based Pricing Model

All RCG purchase options are tied to the current market price to prevent arbitrage and ensure fairness.

```
                    MARKET PRICE (Uniswap)
                           $X.XX
                             |
        ┌────────────────────┼────────────────────┐
        |                    |                    |
     DEX Trading         Bulk Purchase      Private Sale
   Market Price         Market + 5%        Market - 5-15%
        |                    |                    |
   Instant              White-glove          Volume-based
   Any amount           Service              100K+ minimum
   No support           Full support         Vesting required
```

## Pricing Examples (Assuming $0.25 market price)

| Purchase Method | Amount | Market Price | Your Price | Total Cost | Notes |
|----------------|---------|--------------|------------|------------|--------|
| **Uniswap DEX** | Any | $0.25 | $0.25 | Varies | Instant, no support |
| **Bulk Purchase** | 10,000 | $0.25 | $0.2625 | $2,625 | +5% premium |
| **Bulk Purchase** | 50,000 | $0.25 | $0.2625 | $13,125 | +5% premium |
| **Bulk Purchase** | 200,000 | $0.25 | $0.2625 | $52,500 | +5% premium |
| **Private Sale** | 100,000 | $0.25 | $0.2375 | $23,750 | -5% discount |
| **Private Sale** | 500,000 | $0.25 | $0.225 | $112,500 | -10% discount |
| **Private Sale** | 1,000,000 | $0.25 | $0.2125 | $212,500 | -15% discount |

## Why This Model Works

### 1. **No Arbitrage**
- Can't buy cheap from treasury and sell high on market
- Can't buy from market to fulfill private sales

### 2. **Value Justification**
- **Bulk Premium (+5%)**: Pays for service, support, and convenience
- **Private Discount (-5% to -15%)**: Rewards large commitments with vesting

### 3. **Market Efficiency**
- All prices adjust with market movement
- No fixed prices that become stale
- Incentivizes organic price discovery

## Alternative: Commitment Program

For shops without capital for RCG purchases:
- **No RCG purchase required**
- **$500/month for 6 months**
- **Total: $3,000 (goes toward RCN purchases)**
- **Get Standard tier benefits immediately**

## Price Update Frequency

- **DEX**: Real-time
- **Bulk Purchase**: Every 15 minutes
- **Private Sale**: Quoted at time of agreement
- **Commitment**: Fixed monthly payment

## Implementation Notes

1. **Price Oracle**: Integrate Uniswap V3 TWAP oracle for accurate pricing
2. **Slippage Protection**: Bulk purchases include 2% slippage buffer
3. **Gas Optimization**: Bulk transfers save on gas vs multiple small buys
4. **Payment Methods**: 
   - DEX: Crypto only
   - Bulk: USDC, wire, ACH
   - Private: Flexible terms
   - Commitment: Monthly billing