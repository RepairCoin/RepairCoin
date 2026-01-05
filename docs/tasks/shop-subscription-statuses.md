# Shop Subscription Statuses

This document describes all possible shop subscription statuses, their requirements, limitations, and feature access.

## Overview

RepairCoin uses Stripe for subscription management. Shops must maintain an active subscription ($500/month) OR hold 10K+ RCG tokens to access platform features.

## Subscription Statuses

### Active (`active`)

**Description**: Subscription is current and fully operational.

**Requirements**:
- Payment method on file
- Successful recurring payment

**Feature Access**:
| Feature | Access |
|---------|--------|
| Issue RCN rewards | Yes |
| Process redemptions | Yes |
| Service management | Yes |
| Customer lookup | Yes |
| Purchase RCN | Yes |
| View analytics | Yes |
| View purchase history | Yes |

**Limitations**: None

---

### Past Due (`past_due`)

**Description**: Most recent payment attempt failed, but Stripe is still attempting to collect.

**Requirements**:
- Update payment method to resolve

**Feature Access**:
| Feature | Access |
|---------|--------|
| Issue RCN rewards | Yes (within grace period) |
| Process redemptions | Yes (within grace period) |
| Service management | Yes (within grace period) |
| Customer lookup | Yes |
| Purchase RCN | No |
| View analytics | Yes |
| View purchase history | Yes |

**Limitations**:
- 14-day grace period before restrictions apply
- Warning notifications sent at 3-day intervals (max 3 warnings)
- Cannot purchase additional RCN
- After grace period: auto-cancellation

**Grace Period Details**:
```
Day 0: Payment fails → Status changes to past_due
Day 3: First warning notification
Day 6: Second warning notification
Day 9: Third warning notification
Day 14: Auto-cancellation if not resolved
```

---

### Unpaid (`unpaid`)

**Description**: All payment retry attempts exhausted. Subscription remains but no access.

**Requirements**:
- Update payment method and manually reactivate

**Feature Access**:
| Feature | Access |
|---------|--------|
| Issue RCN rewards | No |
| Process redemptions | No |
| Service management | No |
| Customer lookup | Read-only |
| Purchase RCN | No |
| View analytics | Yes |
| View purchase history | Yes |

**Limitations**:
- Most features restricted
- Must manually reactivate subscription
- Outstanding balance may need to be paid

---

### Incomplete (`incomplete`)

**Description**: Initial subscription creation started but payment not yet completed (e.g., requires authentication, 3D Secure).

**Requirements**:
- Complete payment authentication
- Resolve within ~23 hours

**Feature Access**:
| Feature | Access |
|---------|--------|
| Issue RCN rewards | No |
| Process redemptions | No |
| Service management | No |
| Customer lookup | No |
| Purchase RCN | No |
| View analytics | No |
| View purchase history | No |

**Limitations**:
- No platform features until payment completes
- Stripe automatically expires after ~23 hours if not completed

---

### Incomplete Expired (`incomplete_expired`)

**Description**: Initial subscription payment was not completed within the allowed time window (~23 hours).

**Requirements**:
- Start new subscription from scratch

**Feature Access**:
| Feature | Access |
|---------|--------|
| Issue RCN rewards | No |
| Process redemptions | No |
| Service management | No |
| Customer lookup | No |
| Purchase RCN | No |
| View analytics | No |
| View purchase history | No |

**Limitations**:
- Cannot recover this subscription
- Must create entirely new subscription
- Previous payment intent is invalid

**Note**: This status is automatically set by Stripe when an `incomplete` subscription times out. The system treats this as effectively having no subscription.

---

### Paused (`paused`)

**Description**: Subscription temporarily suspended (usually by admin or shop request).

**Requirements**:
- Contact support to resume
- Or reactivate via dashboard (if self-service enabled)

**Feature Access**:
| Feature | Access |
|---------|--------|
| Issue RCN rewards | No |
| Process redemptions | No |
| Service management | Read-only |
| Customer lookup | Read-only |
| Purchase RCN | No |
| View analytics | Yes |
| View purchase history | Yes |

**Limitations**:
- Cannot process any RCN transactions
- Services remain visible but inactive
- Billing paused during this period

---

### Canceled (`canceled`)

**Description**: Subscription has been terminated (by shop, admin, or auto-cancellation).

**Important**: Cancellation follows a **"cancel at period end"** model. When cancelled, the shop retains full access until the **"SUBSCRIBED TILL"** date (end of current billing period). This applies whether the shop cancels themselves or an admin cancels the subscription.

**Two Phases**:

#### Phase 1: Cancellation Pending (Before SUBSCRIBED TILL date)

**Status Display**: Shows "Cancelled" but shop can still operate

**Feature Access**:
| Feature | Access |
|---------|--------|
| Issue RCN rewards | Yes (until period ends) |
| Process redemptions | Yes (until period ends) |
| Service management | Yes (until period ends) |
| Customer lookup | Yes (until period ends) |
| Purchase RCN | Yes (until period ends) |
| View analytics | Yes |
| View purchase history | Yes |

**What the shop sees**:
- Subscription page shows "Cancelled" status with cancellation reason
- Warning message indicating access ends on SUBSCRIBED TILL date
- Option to resubscribe before access expires

#### Phase 2: Fully Canceled (After SUBSCRIBED TILL date)

**Status Display**: Cancelled - No access

**Feature Access**:
| Feature | Access |
|---------|--------|
| Issue RCN rewards | No |
| Process redemptions | No |
| Service management | No |
| Customer lookup | No |
| Purchase RCN | No |
| View analytics | Limited |
| View purchase history | Yes |

**Requirements to restore access**:
- Create new subscription
- Or acquire 10K+ RCG tokens

**Limitations**:
- No platform features
- Must start fresh subscription
- Historical data preserved but read-only

---

## RCG Qualification Exception

Shops holding **10,000+ RCG tokens** bypass subscription requirements entirely.

**Benefits**:
- Full platform access without monthly fee
- All features available regardless of subscription status
- No grace period concerns

**Verification**:
- System checks on-chain RCG balance
- Verified at each feature access attempt
- Real-time balance check (no caching)

**Code Reference**: `backend/src/services/SubscriptionEnforcementService.ts`

---

## Cancellation Behavior

### Who Can Cancel

| Actor | Method | Effect |
|-------|--------|--------|
| **Shop Owner** | Dashboard → Subscription → Cancel | Cancel at period end |
| **Admin** | Admin Dashboard → Subscriptions → Cancel | Cancel at period end |
| **System** | Auto-cancellation after 14-day grace period | Immediate cancellation |

### Cancel at Period End (Default)

When a shop or admin cancels a subscription:

1. **Immediate**: Status changes to "Cancelled" in the UI
2. **Billing**: No future charges will occur
3. **Access**: Shop retains full platform access until SUBSCRIBED TILL date
4. **After Period Ends**: All features are blocked

```
Day 0: Cancellation requested
       ├── Status: "Cancelled"
       ├── Can still: Issue rewards, process redemptions, manage services
       └── Billing: Stopped (no renewal)

SUBSCRIBED TILL date reached:
       ├── Status: "Cancelled - No Access"
       ├── Cannot: Issue rewards, process redemptions, purchase RCN
       └── Must resubscribe to restore access
```

### Why Cancel at Period End?

- Shop has already paid for the current billing period
- Allows shop to transition customers/operations gracefully
- Follows standard SaaS cancellation practices (similar to Stripe's behavior)
- Prevents disputes over partial refunds

---

## Status Transitions

```
                    ┌─────────────────┐
                    │   incomplete    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌─────────────────┐ ┌─────────┐ ┌──────────────────────┐
    │     active      │ │ canceled│ │ incomplete_expired   │
    └────────┬────────┘ └─────────┘ └──────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌─────────┐     ┌─────────┐
│ past_due│────▶│  unpaid │────▶ canceled (immediate)
└─────────┘     └─────────┘
    │
    ▼
┌─────────┐
│ paused  │
└─────────┘

Note: Manual cancellation (by shop or admin) = cancel at period end
      Auto-cancellation (grace period expired) = immediate cancellation
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/shops/subscription/status` | GET | Get current subscription status |
| `/api/shops/subscription/subscribe` | POST | Create new subscription |
| `/api/shops/subscription/cancel` | POST | Cancel subscription |
| `/api/shops/subscription/reactivate` | POST | Reactivate canceled subscription |
| `/api/shops/subscription/sync` | POST | Sync with Stripe |

---

## Configuration

Grace period settings in `SubscriptionEnforcementService.ts`:

```typescript
private config = {
  gracePeriodDays: 14,        // Days before auto-cancel
  maxWarnings: 3,             // Maximum warning notifications
  warningIntervalDays: 3,     // Days between warnings
  rcgQualificationAmount: 10000  // RCG tokens to bypass subscription
};
```

---

## Related Files

- `backend/src/domains/shop/routes/subscription.ts` - Subscription routes
- `backend/src/services/SubscriptionService.ts` - Subscription management
- `backend/src/services/SubscriptionEnforcementService.ts` - Grace period & enforcement
- `frontend/src/services/api/subscription.ts` - Frontend API client
