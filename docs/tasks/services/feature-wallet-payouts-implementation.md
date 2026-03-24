# Feature: Wallet & Payouts — Full Implementation

## Status: Open
## Priority: High
## Date: 2026-03-24
## Category: Feature - Payments
## Current State: Frontend UI exists with mock data, no backend

---

## Overview

The Wallet & Payouts tab (`/shop?tab=wallet-payouts`) currently displays hardcoded mock data. This task implements the full backend and integrates the frontend to make payouts functional.

**Goal:** Allow shop owners to view their earnings, manage payout methods, and withdraw funds.

---

## Current State (Mock)

| Feature | Status |
|---------|--------|
| Overview stats (balance, earnings) | Mock data ($1,250 hardcoded) |
| Payout methods (bank, crypto) | Mock data (Chase Bank hardcoded) |
| Payout history | Mock data (3 fake transactions) |
| Copy wallet address | Working (uses real wallet from auth) |
| Add/edit/delete payout method | UI only, doesn't persist |
| Request payout | Not implemented |

---

## Implementation Plan

### Phase 1: Database Schema

**New migration:** `XXX_create_payout_system.sql`

```sql
-- Shop earnings tracking
CREATE TABLE IF NOT EXISTS shop_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(100) NOT NULL REFERENCES shops(shop_id),
  order_id VARCHAR(255) REFERENCES service_orders(order_id),
  amount NUMERIC(12,2) NOT NULL,
  fee_amount NUMERIC(12,2) DEFAULT 0,
  net_amount NUMERIC(12,2) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'service_booking', 'rcn_redemption', 'subscription_refund'
  status VARCHAR(20) DEFAULT 'available', -- 'available', 'pending_payout', 'paid_out'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payout methods
CREATE TABLE IF NOT EXISTS shop_payout_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(100) NOT NULL REFERENCES shops(shop_id),
  type VARCHAR(20) NOT NULL, -- 'bank_account', 'crypto_wallet'
  label VARCHAR(100) NOT NULL,
  details JSONB NOT NULL, -- bank: {bankName, accountLast4, routingNumber} | crypto: {address, network}
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payout transactions
CREATE TABLE IF NOT EXISTS shop_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(100) NOT NULL REFERENCES shops(shop_id),
  payout_method_id UUID REFERENCES shop_payout_methods(id),
  amount NUMERIC(12,2) NOT NULL,
  fee NUMERIC(12,2) DEFAULT 0,
  net_amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
  stripe_payout_id VARCHAR(255), -- If using Stripe Connect
  transaction_hash VARCHAR(255), -- If crypto payout
  failure_reason TEXT,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_shop_earnings_shop ON shop_earnings(shop_id, status);
CREATE INDEX idx_shop_payouts_shop ON shop_payouts(shop_id, status);
CREATE INDEX idx_shop_payout_methods_shop ON shop_payout_methods(shop_id, is_active);
```

---

### Phase 2: Backend API Endpoints

**Base path:** `/api/shops/payouts`

#### Earnings & Balance
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/balance` | Get available balance, pending, total earnings |
| GET | `/earnings` | Get earnings history (paginated, date filter) |

#### Payout Methods
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/methods` | List payout methods |
| POST | `/methods` | Add payout method (bank or crypto) |
| PUT | `/methods/:id` | Update payout method |
| DELETE | `/methods/:id` | Remove payout method |
| POST | `/methods/:id/set-default` | Set as default |

#### Payouts
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/request` | Request a payout |
| GET | `/history` | Get payout history (paginated) |
| GET | `/:id` | Get payout details |
| POST | `/:id/cancel` | Cancel pending payout |

---

### Phase 3: Balance Calculation

The available balance is calculated from:

```
Available Balance = SUM(service_orders WHERE status='completed' AND shop_id=X)
                  - SUM(platform_fees)
                  - SUM(payouts WHERE status IN ('pending','processing','completed'))
```

**Revenue sources:**
- Service bookings (customer pays via Stripe → shop earns service amount minus platform fee)
- RCN redemptions (customer redeems RCN at shop → shop gets reimbursed)

**Platform fee:** Configurable percentage (e.g., 10% of each booking)

**Minimum payout:** $50.00 (configurable)

---

### Phase 4: Payout Processing

#### Option A: Stripe Connect (Recommended)
- Shop onboards via Stripe Connect Express
- Payouts processed automatically by Stripe
- Supports bank transfers in 40+ countries
- Handles tax reporting (1099-K)
- 2-7 business day settlement

#### Option B: Manual Bank Transfer
- Shop provides bank details
- Admin reviews and approves payouts
- Manual ACH/wire transfer
- Higher operational overhead

#### Option C: Crypto Payout
- Shop provides ETH/USDC wallet address
- Automatic on-chain transfer
- Instant settlement
- Gas fees deducted from payout

**Recommendation:** Start with Stripe Connect (Option A) for bank payouts + Option C for crypto payouts.

---

### Phase 5: Frontend Integration

**File:** `frontend/src/components/shop/tabs/WalletPayoutsTab.tsx`

Replace mock data with real API calls:

```typescript
// Replace useState mock with API calls
const [walletStats, setWalletStats] = useState<WalletStats | null>(null);

useEffect(() => {
  const loadData = async () => {
    const balance = await payoutsApi.getBalance();
    setWalletStats(balance);
    // ... load methods and history
  };
  loadData();
}, []);
```

**New API service:** `frontend/src/services/api/payouts.ts`

---

### Phase 6: Stripe Connect Onboarding

New onboarding flow:
1. Shop clicks "Set up payouts" → redirected to Stripe Connect Express
2. Stripe collects bank details, identity verification, tax info
3. On completion → redirect back to RepairCoin
4. Shop account marked as payout-enabled
5. Automatic payouts begin based on schedule (daily/weekly/monthly)

---

## Earnings Tracking Integration

When an order is completed, record the earning:

```typescript
// In OrderController.updateOrderStatus (on completion)
if (status === 'completed') {
  const platformFee = order.totalAmount * 0.10; // 10% fee
  await earningsRepository.recordEarning({
    shopId: order.shopId,
    orderId: order.orderId,
    amount: order.totalAmount,
    feeAmount: platformFee,
    netAmount: order.totalAmount - platformFee,
    type: 'service_booking'
  });
}
```

---

## Security Considerations

- Payout requests require active subscription
- Minimum payout threshold ($50)
- Rate limit: max 1 payout request per day
- Bank account verification (micro-deposits or Stripe Connect)
- Two-factor confirmation for large payouts (>$1,000)
- Admin dashboard to monitor and flag suspicious payouts
- Fraud detection: unusual payout patterns, rapid account changes

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `backend/migrations/XXX_create_payout_system.sql` | Create — DB schema |
| `backend/src/repositories/PayoutRepository.ts` | Create — data access |
| `backend/src/services/PayoutService.ts` | Create — business logic |
| `backend/src/domains/shop/routes/payouts.ts` | Create — API routes |
| `backend/src/domains/shop/routes/index.ts` | Modify — mount payout routes |
| `backend/src/domains/ServiceDomain/controllers/OrderController.ts` | Modify — record earnings on completion |
| `frontend/src/services/api/payouts.ts` | Create — API client |
| `frontend/src/components/shop/tabs/WalletPayoutsTab.tsx` | Modify — replace mock with real API |

---

## Implementation Priority

1. **Phase 1-2:** Database + API endpoints (foundation)
2. **Phase 3:** Balance calculation from existing orders
3. **Phase 5:** Frontend integration (remove mock data)
4. **Phase 4:** Stripe Connect onboarding
5. **Phase 6:** Automated payout processing

---

## Verification Checklist

- [ ] Balance shows real earnings from completed orders
- [ ] Shop can add bank account payout method
- [ ] Shop can add crypto wallet payout method
- [ ] Shop can set default payout method
- [ ] Shop can request payout (above minimum)
- [ ] Payout processes via Stripe Connect / crypto
- [ ] Payout history shows real transactions
- [ ] Platform fee deducted correctly
- [ ] Minimum payout threshold enforced
- [ ] Subscription required for payouts
- [ ] Admin can view all payout activity
