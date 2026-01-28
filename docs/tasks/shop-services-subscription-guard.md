# Shop Services Subscription Guard

## Status: Done

## Priority: High

## Type: Enhancement / Security

## Summary
Prevent shops with paused/expired subscriptions from creating, editing, or deleting services. Both backend middleware and frontend UI blocking are implemented.

## Parent Task
This is part of the broader [Shop Subscription Validation & Enforcement](./shop-subscription-validation-enforcement.md) initiative.

---

## Implementation

### Backend Changes

**File: `backend/src/domains/ServiceDomain/routes.ts`**

Applied `requireActiveSubscription` middleware to protected routes:

```typescript
import { requireActiveSubscription } from '../../middleware/subscriptionGuard';

// Protected routes - require active subscription
router.post('/', authMiddleware, requireRole(['shop']), requireActiveSubscription(), serviceController.createService);
router.put('/:id', authMiddleware, requireRole(['shop']), requireActiveSubscription(), serviceController.updateService);
router.delete('/:id', authMiddleware, requireRole(['shop']), requireActiveSubscription(), serviceController.deleteService);
```

**Protected Endpoints:**
| Method | Route | Action |
|--------|-------|--------|
| POST | `/api/services` | Create service |
| PUT | `/api/services/:id` | Update service |
| DELETE | `/api/services/:id` | Delete service |

**Error Response (403):**
```json
{
  "success": false,
  "error": "Your subscription is paused by the administrator",
  "code": "SUBSCRIPTION_PAUSED",
  "details": {
    "status": "paused",
    "message": "Your subscription has been temporarily paused. Please contact support or resume your subscription to continue operations."
  }
}
```

### Frontend Changes

**File: `frontend/src/components/shop/tabs/ServicesTab.tsx`**

1. **Import and use subscription status hook:**
```typescript
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";

const subscriptionStatus = useSubscriptionStatus(shopData);
const isBlocked = !subscriptionStatus.canPerformOperations;
```

2. **Warning banner when blocked:**
```typescript
{!subscriptionStatus.canPerformOperations && subscriptionStatus.statusMessage && (
  <div className={`border-2 rounded-xl p-4 ${
    subscriptionStatus.isPaused
      ? 'bg-orange-900/20 border-orange-500/50'
      : 'bg-red-900/20 border-red-500/50'
  }`}>
    <AlertTriangle className={subscriptionStatus.isPaused ? 'text-orange-400' : 'text-red-400'} />
    <h4>{subscriptionStatus.isPaused ? 'Subscription Paused' : 'Subscription Required'}</h4>
    <p>{subscriptionStatus.statusMessage}</p>
  </div>
)}
```

3. **Disabled Add Service button:**
```typescript
<button
  onClick={() => setShowCreateModal(true)}
  disabled={isBlocked}
  className={isBlocked
    ? "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50"
    : "bg-[#FFCC00] text-black hover:bg-[#FFD700]"
  }
>
  <Plus /> Add Service
</button>
```

4. **Disabled Edit button on service cards:**
```typescript
<button
  onClick={() => openEditModal(service)}
  disabled={isBlocked}
  className={isBlocked ? "opacity-50 cursor-not-allowed" : ""}
  title={isBlocked ? "Cannot edit - subscription blocked" : "Edit service"}
>
  <Edit2 />
</button>
```

5. **Disabled Delete button on service cards:**
```typescript
<button
  onClick={() => handleDeleteService(service.id)}
  disabled={isBlocked}
  className={isBlocked ? "opacity-50 cursor-not-allowed" : ""}
  title={isBlocked ? "Cannot delete - subscription blocked" : "Delete service"}
>
  <Trash2 />
</button>
```

6. **Disabled Toggle Active switch:**
```typescript
<button
  onClick={() => toggleServiceActive(service)}
  disabled={isBlocked}
  className={isBlocked ? "opacity-50 cursor-not-allowed" : ""}
  title={isBlocked ? "Cannot toggle - subscription blocked" : "Toggle active status"}
>
  {service.is_active ? <ToggleRight /> : <ToggleLeft />}
</button>
```

---

## User Experience

### When Subscription is Paused
- Orange warning banner at the top of Services tab
- All action buttons (Add, Edit, Delete, Toggle) are disabled with reduced opacity
- Hover shows tooltip explaining why action is blocked
- Services remain visible for reference

### When Subscription is Expired
- Red warning banner at the top of Services tab
- All action buttons disabled
- Message prompts user to resubscribe

### Visual Feedback
| State | Banner Color | Button Style |
|-------|--------------|--------------|
| Active | None | Yellow background, black text |
| Paused | Orange | Gray background, 50% opacity |
| Expired | Red | Gray background, 50% opacity |
| Not Qualified | Red | Gray background, 50% opacity |

---

## Testing Checklist

- [x] Backend returns 403 when creating service with paused subscription
- [x] Backend returns 403 when editing service with paused subscription
- [x] Backend returns 403 when deleting service with paused subscription
- [x] Frontend shows orange warning for paused subscription
- [x] Frontend shows red warning for expired subscription
- [x] Add Service button is disabled when blocked
- [x] Edit button is disabled when blocked
- [x] Delete button is disabled when blocked
- [x] Toggle active button is disabled when blocked
- [x] Services list is still visible when blocked
- [x] RCG qualified shops (10K+) can still manage services

---

## Files Modified

- `backend/src/domains/ServiceDomain/routes.ts` - Applied middleware
- `frontend/src/components/shop/tabs/ServicesTab.tsx` - Added UI blocking

---

## Related Tasks

- [Shop Subscription Validation & Enforcement](./shop-subscription-validation-enforcement.md) - Parent task
- [Shop Issue Rewards Subscription Guard](./shop-issue-rewards-subscription-guard.md) - Issue rewards protection
