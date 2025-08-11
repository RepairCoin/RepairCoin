# RepairCoin Database Overview

## Core Tables and Their Purpose

### 🧑 Customer Management
- **customers**: Store customer profiles, wallet addresses, tier status, and earning limits
- **customer_rcn_sources**: Track where each customer earned their RCN tokens
- **referrals**: Manage customer referral relationships and rewards

### 🏪 Shop Management  
- **shops**: Store shop profiles, verification status, and RCN balance management
- **shop_rcn_purchases**: Track shops buying RCN tokens from the platform

### 💰 Token & Transaction Management
- **transactions**: Record all RCN token movements (mint, redeem, transfer)
- **redemption_sessions**: Temporary approval sessions for customer redemptions

### 🔧 System Administration
- **admin_treasury**: Track platform-wide token supply and revenue
- **admin_activity_logs**: Audit trail of all admin actions
- **admin_alerts**: System alerts and notifications
- **unsuspend_requests**: Handle appeals for suspended accounts

### 🔗 Integration & Logging
- **webhook_logs**: Track external system integrations (e.g., FixFlow)

## Key Relationships

```
┌─────────────┐         ┌─────────────┐         ┌──────────────┐
│  CUSTOMERS  │ ──1:N── │TRANSACTIONS │ ──N:1── │    SHOPS     │
└─────────────┘         └─────────────┘         └──────────────┘
       │                                                │
       │ 1:N                                           │ 1:N
       ▼                                               ▼
┌─────────────┐                              ┌──────────────────┐
│  REFERRALS  │                              │ SHOP_PURCHASES   │
└─────────────┘                              └──────────────────┘
       │                                               
       │ 1:N                                          
       ▼                                              
┌─────────────────┐                          
│ RCN_SOURCES     │                          
└─────────────────┘                          
```

## Business Logic in Database

### Customer Tiers
- **BRONZE**: 0-199 lifetime RCN earned
- **SILVER**: 200-999 lifetime RCN earned  
- **GOLD**: 1000+ lifetime RCN earned

### Token Economics
- Shops purchase RCN at $0.10 per token
- Customers redeem RCN at $1.00 value within shop network
- 20% of earned balance usable at non-home shops

### Anti-Arbitrage System
- `customer_rcn_sources` tracks token origin
- Only "earned" tokens (not market-bought) can be redeemed at shops
- `is_redeemable` flag determines redemption eligibility

### Referral System
- Automatic 6-character code generation
- 25 RCN reward to referrer after referee's first repair
- 10 RCN bonus to referee on first repair

## Database Statistics

To view current database statistics, you can query the `system_health` view:

```sql
SELECT * FROM system_health;
```

This provides counts for all major tables and helps monitor system growth.