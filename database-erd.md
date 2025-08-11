# RepairCoin Database ERD

## Entity Relationship Diagram

```mermaid
erDiagram
    CUSTOMERS ||--o{ TRANSACTIONS : has
    CUSTOMERS ||--o{ REFERRALS : refers
    CUSTOMERS ||--o{ CUSTOMER_RCN_SOURCES : earns
    CUSTOMERS ||--o{ REDEMPTION_SESSIONS : creates
    CUSTOMERS ||--o{ UNSUSPEND_REQUESTS : requests
    CUSTOMERS }o--|| SHOPS : "home_shop"
    
    SHOPS ||--o{ TRANSACTIONS : processes
    SHOPS ||--o{ SHOP_RCN_PURCHASES : buys
    SHOPS ||--o{ CUSTOMER_RCN_SOURCES : "source_of"
    SHOPS ||--o{ REDEMPTION_SESSIONS : approves
    SHOPS ||--o{ UNSUSPEND_REQUESTS : requests
    
    TRANSACTIONS }o--|| SHOPS : "redemption_shop"
    
    REFERRALS }o--|| CUSTOMERS : "referrer"
    REFERRALS }o--|| CUSTOMERS : "referee"
    
    WEBHOOK_LOGS }o--|| SHOPS : "related_to"
    WEBHOOK_LOGS }o--|| CUSTOMERS : "related_to"
    
    ADMIN_ACTIVITY_LOGS }o--|| CUSTOMERS : "affects"
    ADMIN_ACTIVITY_LOGS }o--|| SHOPS : "affects"

    CUSTOMERS {
        string address PK
        string name
        string email
        string phone
        enum tier "BRONZE|SILVER|GOLD"
        decimal lifetime_earnings
        decimal daily_earnings
        decimal monthly_earnings
        date last_earned_date
        string referral_code UK
        string referred_by FK
        string home_shop_id FK
        int referral_count
        boolean is_active
        timestamp suspended_at
        string suspension_reason
        timestamp join_date
        timestamp updated_at
    }

    SHOPS {
        string shop_id PK
        string name
        string address
        string phone
        string email
        string wallet_address UK
        string reimbursement_address
        boolean verified
        boolean active
        boolean cross_shop_enabled
        decimal purchased_rcn_balance
        decimal total_rcn_purchased
        timestamp last_purchase_date
        decimal total_tokens_issued
        int total_redemptions
        decimal total_reimbursements
        decimal location_lat
        decimal location_lng
        string location_city
        string location_state
        string location_zip_code
        timestamp join_date
        timestamp verified_date
        timestamp updated_at
    }

    TRANSACTIONS {
        uuid id PK
        enum type "mint|redeem|transfer|tier_bonus|shop_purchase"
        string customer_address FK
        string shop_id FK
        string redemption_shop_id FK
        decimal amount
        decimal base_amount
        decimal tier_bonus_amount
        string transaction_hash
        bigint block_number
        enum status "pending|confirmed|failed"
        string notes
        enum token_source "earned|purchased|tier_bonus"
        boolean is_cross_shop
        timestamp created_at
        timestamp confirmed_at
    }

    REFERRALS {
        uuid id PK
        string referral_code FK
        string referrer_address FK
        string referee_address FK
        enum status "pending|completed|expired"
        decimal reward_amount
        string reward_transaction_id
        timestamp created_at
        timestamp completed_at
        timestamp expires_at
    }

    CUSTOMER_RCN_SOURCES {
        uuid id PK
        string customer_address FK
        string source_shop_id FK
        enum source_type "shop_repair|referral_bonus|tier_bonus|promotion|market_purchase"
        decimal amount
        string transaction_id
        string description
        boolean is_redeemable
        timestamp created_at
    }

    SHOP_RCN_PURCHASES {
        uuid id PK
        string shop_id FK
        decimal amount
        decimal price_per_rcn
        decimal total_cost
        string transaction_hash
        enum payment_method "crypto|bank_transfer|credit_card"
        string payment_reference
        enum status "pending|completed|failed"
        timestamp created_at
        timestamp completed_at
    }

    WEBHOOK_LOGS {
        uuid id PK
        enum source "fixflow|admin|customer"
        string event
        jsonb payload
        boolean processed
        jsonb result
        int retry_count
        string related_shop_id FK
        string related_customer_address FK
        timestamp created_at
        timestamp processed_at
    }

    REDEMPTION_SESSIONS {
        uuid id PK
        string session_id UK
        string customer_address FK
        string shop_id FK
        decimal max_amount
        enum status "pending|approved|rejected|expired|used"
        string qr_code
        string signature
        decimal amount_used
        string transaction_id
        timestamp created_at
        timestamp expires_at
        timestamp used_at
    }

    ADMIN_TREASURY {
        int id PK "always 1"
        decimal total_supply
        decimal available_supply
        decimal total_sold
        decimal total_revenue
        timestamp last_updated
    }

    ADMIN_ACTIVITY_LOGS {
        uuid id PK
        string admin_address
        enum action_type "shop_approve|customer_suspend|token_mint|etc"
        string entity_type
        string entity_id
        jsonb old_values
        jsonb new_values
        string ip_address
        string user_agent
        jsonb metadata
        timestamp created_at
    }

    ADMIN_ALERTS {
        uuid id PK
        enum alert_type "system|security|business|compliance"
        enum severity "low|medium|high|critical"
        string title
        text message
        jsonb metadata
        boolean is_read
        boolean is_resolved
        string read_by
        string resolved_by
        timestamp created_at
        timestamp read_at
        timestamp resolved_at
    }

    UNSUSPEND_REQUESTS {
        uuid id PK
        enum entity_type "customer|shop"
        string entity_id
        text reason
        enum status "pending|approved|rejected"
        string reviewed_by
        text review_notes
        timestamp created_at
        timestamp reviewed_at
    }
```

## Table Relationships Summary

### Primary Relationships:
1. **Customer → Shop**: Each customer has a home shop where they primarily earn RCN
2. **Customer → Transactions**: Customers have multiple token transactions (mint, redeem, transfer)
3. **Shop → Transactions**: Shops process customer transactions
4. **Customer → Referrals**: Customers can refer others and be referred
5. **Shop → Shop RCN Purchases**: Shops buy RCN tokens from the platform
6. **Customer → Customer RCN Sources**: Tracks where customers earned their tokens
7. **Customer/Shop → Redemption Sessions**: Temporary approval sessions for redemptions

### Key Business Rules Encoded:
- Customers progress through tiers (Bronze → Silver → Gold) based on lifetime earnings
- Shops must purchase RCN tokens at $0.10 each to distribute to customers
- Customers can use 20% of earned balance at non-home shops (cross-shop)
- Only earned tokens (not market-bought) can be redeemed at shops
- Referral rewards are distributed after referee completes first repair

## Database Design Principles

1. **Normalization**: Tables are properly normalized to avoid data redundancy
2. **Audit Trail**: All major entities have created_at and updated_at timestamps
3. **Soft Deletes**: Uses is_active/suspended flags instead of hard deletes
4. **Financial Accuracy**: Uses decimal types for all monetary values
5. **Blockchain Integration**: Stores transaction hashes and block numbers
6. **Extensibility**: JSONB fields for metadata allow flexible data storage