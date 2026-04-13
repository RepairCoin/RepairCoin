# Feature: Validate RCN Allocation at Booking Time for Group Tokens

## Status: Fixed

## Priority: High

## Date: 2026-04-13

## Category: Feature - Group Rewards / Customer Protection

## Affects: Customer booking flow, Service marketplace, Group token issuance

---

## Problem

When a customer books a service linked to an affiliate group, they see a purple badge promising group tokens (e.g., "Earn CDV tokens when you book"). However, if the shop's RCN allocation for that group is insufficient to back the token issuance, the customer:

1. Sees the badge and expects to earn group tokens
2. Pays full price and completes the service
3. **Never receives the group tokens** — with no explanation
4. Has no way to know they missed out

The failure is silent from the customer's perspective. Only the shop receives a `group_token_issuance_failed` notification. This is a poor experience because the customer was promised something they didn't get, caused by something entirely outside their control.

---

## Current Behavior

```
Customer sees purple badge → Books service → Pays → Shop completes order
→ earnGroupTokens() called → RCN backing check fails
→ Group tokens NOT issued → Shop gets failure notification
→ Customer gets nothing, sees no error
```

**Root cause:** RCN allocation is only validated at issuance time (`AffiliateShopGroupService.ts:386-398`), not at booking or display time.

### Why this happens

Group tokens require a 1:2 RCN backing ratio (100 tokens need 50 RCN). The RCN pool is consumable — it drains with every completed booking. A shop may have enough RCN when the service is linked but run out after several bookings.

---

## Proposed Solution: Validate at Booking Time

### 1. Pre-calculate required RCN at checkout

Before the customer completes payment, calculate the RCN needed for group token issuance:

```
For each linked group:
  tokensToIssue = servicePrice × (rewardPercentage / 100) × bonusMultiplier
  requiredRcn = tokensToIssue / 2  (1:2 backing ratio)
```

Check if the shop's available RCN allocation covers this amount.

### 2. Handle insufficient RCN gracefully

**On the service card / service details:**

- If shop has sufficient RCN: show purple badge as normal
- If shop has insufficient RCN: hide the purple badge OR show a dimmed badge with "Group tokens temporarily unavailable"

**At checkout:**

- If sufficient: show "You'll earn X CDV + Y AMS tokens"
- If insufficient for a specific group: show "RCN allocation unavailable for [Group Name] — group tokens will not be earned for this booking"
- Customer can still proceed with the booking (they still earn RCN)

### 3. Do NOT block the booking

The customer should always be able to book the service. Group tokens are a bonus, not a requirement. The fix is about **honest communication**, not blocking transactions.

---

## Files to Modify

### Backend

| File                                                               | Change                                                                                                |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `backend/src/domains/ServiceDomain/controllers/OrderController.ts` | Add RCN validation check before/during checkout                                                       |
| `backend/src/services/AffiliateShopGroupService.ts`                | Add `validateRcnAvailability(serviceId, shopId)` method that returns which groups have sufficient RCN |
| `backend/src/repositories/ServiceRepository.ts`                    | Possibly add query to check RCN availability per service-group link                                   |
| New or existing API endpoint                                       | Expose RCN availability check for frontend to call at checkout                                        |

### Frontend

| File                                                            | Change                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------- |
| `frontend/src/components/customer/ServiceCard.tsx`              | Conditionally show/dim purple badge based on RCN availability |
| `frontend/src/components/service/ServiceCheckoutClient.tsx`     | Show which group tokens will/won't be earned before payment   |
| `frontend/src/components/customer/ServiceMarketplaceClient.tsx` | Filter or annotate group badges based on RCN availability     |

---

## API Design

### Option A: Add to existing service endpoint

Extend `GET /api/services/:serviceId` response to include group token availability:

```json
{
  "serviceId": "srv_xxx",
  "groupRewards": [
    {
      "groupId": "grp_xxx",
      "groupName": "CODEBILITY",
      "tokenSymbol": "CDV",
      "rewardPercentage": 100,
      "bonusMultiplier": 1,
      "estimatedTokens": 69.0,
      "available": true
    },
    {
      "groupId": "grp_yyy",
      "groupName": "Amazing Resto",
      "tokenSymbol": "AMS",
      "rewardPercentage": 50,
      "bonusMultiplier": 1,
      "estimatedTokens": 34.5,
      "available": false,
      "reason": "Insufficient RCN allocation"
    }
  ]
}
```

### Option B: Separate validation endpoint

```
GET /api/services/:serviceId/group-rewards/availability
```

---

## Edge Cases

- **RCN runs out between checkout and completion**: The validation at booking time is a best-effort check. If another booking drains the RCN between this customer's payment and order completion, the issuance still fails. This is acceptable — the window is small, and the current notification-to-shop behavior handles it.
- **Shop replenishes RCN**: Badges should automatically reappear once RCN is topped up. No manual re-linking needed.
- **Multiple groups on one service**: Validate each group independently. One group may have sufficient RCN while another doesn't.
- **Service price varies (discounts, RCN redemption)**: Use the `totalAmount` (final price) for calculation, not the listed `priceUsd`.

---

## QA Test Plan

### Sufficient RCN

1. Shop allocates plenty of RCN to a group
2. Customer views service → purple badge visible
3. Customer books → checkout shows "You'll earn X tokens"
4. Order completed → tokens issued

### Insufficient RCN

1. Shop has 0 available RCN for a group
2. Customer views service → purple badge hidden or dimmed
3. Customer books → checkout shows "Group tokens unavailable for [Group]"
4. Customer can still book → earns RCN but no group tokens
5. Shop receives failure notification

### RCN replenished

1. Start with insufficient RCN (badge hidden)
2. Shop allocates more RCN
3. Customer refreshes → badge reappears
4. Booking now earns group tokens

### Multiple groups, mixed availability

1. Service linked to 2 groups: Group A has RCN, Group B doesn't
2. Customer sees badge only for Group A
3. Checkout shows: "You'll earn X GroupA tokens. GroupB tokens unavailable."
4. Order completed → only Group A tokens issued
