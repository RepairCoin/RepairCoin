# Shop Onboarding Flow

## IMPORTANT: Shops Must Have RCG or Commitment to Operate!

Since shops need to buy RCN tokens from RepairCoin admin, they MUST either:
1. Hold RCG tokens (minimum 10,000) OR
2. Join the Commitment Program ($500/month)

## Correct Flow:

```
┌─────────────────────┐
│ 1. Shop Registration│
│   (Free to join)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 2. Admin Approval   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 3. Dashboard Access │ ← VIEW ONLY! Can't operate yet
│   (Read-only mode)  │
└──────────┬──────────┘
           │
           ▼
    ╔═══════════════════════╗
    ║ MUST CHOOSE TO OPERATE:║
    ╚═══════════════════════╝
           │
     ┌─────┴─────┐
     ▼           ▼
┌─────────┐ ┌──────────┐
│Buy RCG  │ │Commitment│
│Min 10K  │ │ Program  │
│$2,500+  │ │$500/month│
└────┬────┘ └────┬─────┘
     │           │
     └─────┬─────┘
           ▼
┌─────────────────────┐
│ 4. Now Can Operate: │
│ • Buy RCN tokens    │
│ • Issue rewards     │
│ • Process redemption│
└─────────────────────┘
```

## Step-by-Step Process:

### 1. **Shop Registration** (NO RCG REQUIRED)
- Visit `/shop/register`
- Fill out business information
- Connect wallet
- Submit application
- **Cost: $0**

### 2. **Admin Approval**
- Admin reviews application
- Approves/verifies shop
- Shop gets dashboard access

### 3. **Shop MUST Choose Path to Operate**
Without RCG or Commitment, shops can only VIEW dashboard but cannot:
- Buy RCN tokens (no access to admin sales)
- Issue rewards to customers
- Process redemptions

**Option A: Buy RCG Tokens** (One-time investment)
- Minimum 10,000 RCG (~$2,500)
- Unlocks ability to buy RCN from admin
- Standard (10K): $0.10/RCN
- Premium (50K): $0.08/RCN  
- Elite (200K): $0.06/RCN

**Option B: Commitment Program** (Monthly payments)
- No RCG purchase needed
- $500/month for 6 months
- Can buy RCN immediately
- Pay Standard tier price ($0.10/RCN)

**❌ No Option C**: Cannot operate without RCG or Commitment!

## Why This Requirement Exists:

1. **Business Model**: RepairCoin makes money by selling RCN to shops
2. **No Free Riders**: Shops must invest to participate
3. **Quality Control**: Ensures only serious shops join
4. **Revenue Protection**: Prevents shops from getting free RCN

## Implementation Status:

✅ **Shop Registration**: Working (no RCG check)
✅ **Dashboard Access**: Working for all registered shops
✅ **RCG Purchase Options**: UI implemented
✅ **Tier Detection**: Automatic based on RCG holdings
✅ **Commitment Program**: UI ready, backend pending

## Shop Dashboard Features by Status:

### Without RCG or Commitment (View-Only):
- ✅ View dashboard layout
- ✅ See features preview
- ❌ Cannot buy RCN tokens
- ❌ Cannot issue rewards
- ❌ Cannot process redemptions
- ❌ Cannot access transaction history

### With RCG (Operational + Benefits):
- ✅ Buy RCN from admin
- ✅ Issue rewards to customers
- ✅ Process redemptions
- ✅ Full transaction history
- ✅ Tier-based RCN pricing
- ✅ Tier badge display
- 🔄 Priority support (planned)
- 🔄 Premium listings (planned)

### With Commitment Program (Operational):
- ✅ Buy RCN from admin ($500/month)
- ✅ Issue rewards to customers
- ✅ Process redemptions
- ✅ Full transaction history
- ❌ No RCG ownership
- ❌ No governance rights
- ❌ Standard pricing only

## Next Steps for New Shops:

1. **Register** → No cost, no RCG needed
2. **Get Approved** → Admin verifies business
3. **Access Dashboard** → Start exploring
4. **See RCG Benefits** → Understand tier advantages
5. **Make Decision** → Buy RCG, join commitment, or stay basic

This flow ensures shops can participate regardless of their initial capital!