# Service-Group Connection Implementation Guide
Date: December 17, 2024
Developer: Zeff

## Overview
This document provides step-by-step instructions to complete the service-affiliate group connection feature, allowing services to earn multiple group tokens and enabling group-exclusive services.

---

## ✅ COMPLETED (Already Done)

### 1. Database Migration ✅
**Status:** COMPLETE
**Tables Created:**
- Added columns to `shop_services`: `group_id`, `group_exclusive`, `group_token_reward_percentage`, `group_bonus_multiplier`
- Created `service_group_availability` table (many-to-many)
- Created all necessary indexes

### 2. ServiceRepository Updates ✅
**Status:** COMPLETE
**File:** `/backend/src/repositories/ServiceRepository.ts`
**Methods Added:**
- `linkServiceToGroup()` - Link service to affiliate group
- `unlinkServiceFromGroup()` - Remove service from group
- `getServiceGroups()` - Get all groups for a service
- `getServicesByGroup()` - Get all services in a group
- `updateServiceGroupRewards()` - Update reward settings
- `mapServiceGroupAvailabilityRow()` - Map database rows

**Interfaces Added:**
- `ServiceGroupAvailability` interface
- Updated `ShopService` interface with group fields
- Updated `ServiceFilters` with group filters

---

## 🚧 TODO: Backend Implementation

### Step 3: Create ServiceGroupController
**File:** `/backend/src/domains/ServiceDomain/controllers/ServiceGroupController.ts`

```typescript
// backend/src/domains/ServiceDomain/controllers/ServiceGroupController.ts
import { Request, Response } from 'express';
import { ServiceRepository } from '../../../repositories/ServiceRepository';
import { AffiliateShopGroupRepository } from '../../../repositories/AffiliateShopGroupRepository';
import { logger } from '../../../utils/logger';

export class ServiceGroupController {
  private serviceRepository: ServiceRepository;
  private groupRepository: AffiliateShopGroupRepository;

  constructor() {
    this.serviceRepository = new ServiceRepository();
    this.groupRepository = new AffiliateShopGroupRepository();
  }

  /**
   * Link a service to an affiliate group
   * POST /api/services/:serviceId/groups/:groupId
   */
  async linkServiceToGroup(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId, groupId } = req.params;
      const { tokenRewardPercentage, bonusMultiplier } = req.body;

      // Verify service exists and belongs to requesting shop
      const service = await this.serviceRepository.getServiceById(serviceId);
      if (!service) {
        res.status(404).json({ success: false, error: 'Service not found' });
        return;
      }

      // Verify shop is member of the group
      const membership = await this.groupRepository.getShopMembership(service.shopId, groupId);
      if (!membership || membership.status !== 'active') {
        res.status(403).json({
          success: false,
          error: 'Shop must be an active member of the group to link services'
        });
        return;
      }

      // Link the service
      const link = await this.serviceRepository.linkServiceToGroup(
        serviceId,
        groupId,
        tokenRewardPercentage || 100,
        bonusMultiplier || 1.0
      );

      logger.info('Service linked to group', { serviceId, groupId, shopId: service.shopId });
      res.status(201).json({ success: true, data: link });
    } catch (error: any) {
      logger.error('Error linking service to group', { error });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Unlink a service from a group
   * DELETE /api/services/:serviceId/groups/:groupId
   */
  async unlinkServiceFromGroup(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId, groupId } = req.params;

      // Verify service exists and belongs to requesting shop
      const service = await this.serviceRepository.getServiceById(serviceId);
      if (!service) {
        res.status(404).json({ success: false, error: 'Service not found' });
        return;
      }

      await this.serviceRepository.unlinkServiceFromGroup(serviceId, groupId);

      logger.info('Service unlinked from group', { serviceId, groupId });
      res.json({ success: true, message: 'Service unlinked from group successfully' });
    } catch (error: any) {
      logger.error('Error unlinking service from group', { error });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Get all groups a service is linked to
   * GET /api/services/:serviceId/groups
   */
  async getServiceGroups(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId } = req.params;

      const groups = await this.serviceRepository.getServiceGroups(serviceId);

      res.json({ success: true, data: groups });
    } catch (error: any) {
      logger.error('Error getting service groups', { error });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Update group reward settings for a service
   * PUT /api/services/:serviceId/groups/:groupId/rewards
   */
  async updateGroupRewards(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId, groupId } = req.params;
      const { tokenRewardPercentage, bonusMultiplier } = req.body;

      // Verify service exists and belongs to requesting shop
      const service = await this.serviceRepository.getServiceById(serviceId);
      if (!service) {
        res.status(404).json({ success: false, error: 'Service not found' });
        return;
      }

      const updated = await this.serviceRepository.updateServiceGroupRewards(
        serviceId,
        groupId,
        tokenRewardPercentage,
        bonusMultiplier
      );

      logger.info('Service group rewards updated', { serviceId, groupId });
      res.json({ success: true, data: updated });
    } catch (error: any) {
      logger.error('Error updating service group rewards', { error });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Get all services in a group (public endpoint for customers)
   * GET /api/groups/:groupId/services
   */
  async getGroupServices(req: Request, res: Response): Promise<void> {
    try {
      const { groupId } = req.params;
      const { category, minPrice, maxPrice, search } = req.query;

      const filters = {
        category: category as string,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
        search: search as string
      };

      const services = await this.serviceRepository.getServicesByGroup(groupId, filters);

      res.json({
        success: true,
        data: {
          services,
          count: services.length
        }
      });
    } catch (error: any) {
      logger.error('Error getting group services', { error });
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
```

---

### Step 4: Add Routes to ServiceDomain
**File:** `/backend/src/domains/ServiceDomain/routes.ts`

Add these routes (find the appropriate place in the existing routes file):

```typescript
import { ServiceGroupController } from './controllers/ServiceGroupController';

const serviceGroupController = new ServiceGroupController();

// Shop endpoints - Manage service-group links (require shop role + ownership)
router.post('/services/:serviceId/groups/:groupId',
  authMiddleware,
  requireRole(['shop']),
  asyncHandler(async (req: Request, res: Response) => {
    await serviceGroupController.linkServiceToGroup(req, res);
  })
);

router.delete('/services/:serviceId/groups/:groupId',
  authMiddleware,
  requireRole(['shop']),
  asyncHandler(async (req: Request, res: Response) => {
    await serviceGroupController.unlinkServiceFromGroup(req, res);
  })
);

router.put('/services/:serviceId/groups/:groupId/rewards',
  authMiddleware,
  requireRole(['shop']),
  asyncHandler(async (req: Request, res: Response) => {
    await serviceGroupController.updateGroupRewards(req, res);
  })
);

router.get('/services/:serviceId/groups',
  asyncHandler(async (req: Request, res: Response) => {
    await serviceGroupController.getServiceGroups(req, res);
  })
);

// Public endpoint - Browse services by group
router.get('/groups/:groupId/services',
  asyncHandler(async (req: Request, res: Response) => {
    await serviceGroupController.getGroupServices(req, res);
  })
);
```

---

### Step 5: Update Order Processing to Issue Group Tokens
**File:** `/backend/src/domains/ServiceDomain/controllers/OrderController.ts`

Find the `completeOrder()` or order completion logic and add:

```typescript
// After issuing RCN tokens, check for group token rewards
async function issueGroupTokensForService(orderId: string, serviceId: string, customerAddress: string, orderAmount: number) {
  try {
    const serviceRepository = new ServiceRepository();
    const groupTokenService = new GroupTokenController(); // You have this already

    // Get all groups this service is linked to
    const serviceGroups = await serviceRepository.getServiceGroups(serviceId);

    for (const groupLink of serviceGroups) {
      // Calculate group token amount
      const baseAmount = orderAmount * (groupLink.tokenRewardPercentage / 100);
      const finalAmount = baseAmount * groupLink.bonusMultiplier;

      // Issue group tokens
      await groupTokenService.issueGroupTokens({
        groupId: groupLink.groupId,
        customerAddress,
        amount: finalAmount,
        shopId: service.shopId,
        reason: `Service completed: ${service.serviceName}`,
        metadata: {
          orderId,
          serviceId,
          rewardPercentage: groupLink.tokenRewardPercentage,
          bonusMultiplier: groupLink.bonusMultiplier
        }
      });

      logger.info('Group tokens issued for service', {
        groupId: groupLink.groupId,
        customerAddress,
        amount: finalAmount,
        tokenSymbol: groupLink.customTokenSymbol
      });
    }
  } catch (error) {
    logger.error('Error issuing group tokens for service', { error, orderId, serviceId });
    // Don't throw - log and continue (group tokens are bonus, not critical)
  }
}

// Call this function after order completion:
await issueGroupTokensForService(order.orderId, order.serviceId, order.customerAddress, order.totalAmount);
```

---

## 🎨 TODO: Frontend Implementation

### Step 6: Create Frontend API Service
**File:** `/frontend/src/services/api/serviceGroups.ts`

```typescript
// frontend/src/services/api/serviceGroups.ts
import apiClient from './client';

export interface ServiceGroupLink {
  id: number;
  serviceId: string;
  groupId: string;
  tokenRewardPercentage: number;
  bonusMultiplier: number;
  active: boolean;
  groupName?: string;
  customTokenName?: string;
  customTokenSymbol?: string;
  icon?: string;
}

/**
 * Link a service to an affiliate group
 */
export async function linkServiceToGroup(
  serviceId: string,
  groupId: string,
  tokenRewardPercentage: number = 100,
  bonusMultiplier: number = 1.0
): Promise<ServiceGroupLink> {
  const response = await apiClient.post(
    `/services/${serviceId}/groups/${groupId}`,
    { tokenRewardPercentage, bonusMultiplier }
  );
  return response.data;
}

/**
 * Unlink service from group
 */
export async function unlinkServiceFromGroup(
  serviceId: string,
  groupId: string
): Promise<void> {
  await apiClient.delete(`/services/${serviceId}/groups/${groupId}`);
}

/**
 * Get all groups a service is linked to
 */
export async function getServiceGroups(serviceId: string): Promise<ServiceGroupLink[]> {
  const response = await apiClient.get(`/services/${serviceId}/groups`);
  return response.data || [];
}

/**
 * Update group reward settings
 */
export async function updateServiceGroupRewards(
  serviceId: string,
  groupId: string,
  tokenRewardPercentage?: number,
  bonusMultiplier?: number
): Promise<ServiceGroupLink> {
  const response = await apiClient.put(
    `/services/${serviceId}/groups/${groupId}/rewards`,
    { tokenRewardPercentage, bonusMultiplier }
  );
  return response.data;
}

/**
 * Get all services in a group
 */
export async function getGroupServices(
  groupId: string,
  filters?: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
  }
): Promise<any[]> {
  const response = await apiClient.get(`/groups/${groupId}/services`, { params: filters });
  return response.data?.services || [];
}

export const serviceGroupApi = {
  linkServiceToGroup,
  unlinkServiceFromGroup,
  getServiceGroups,
  updateServiceGroupRewards,
  getGroupServices
};
```

---

### Step 7: Add Group Settings to Service Management UI
**File:** `/frontend/src/components/shop/ServiceGroupSettings.tsx` (NEW)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { serviceGroupApi } from '@/services/api/serviceGroups';
import { useShopStore } from '@/stores/shopStore'; // Or wherever you store shop data

interface ServiceGroupSettingsProps {
  serviceId: string;
  onUpdate?: () => void;
}

export function ServiceGroupSettings({ serviceId, onUpdate }: ServiceGroupSettingsProps) {
  const { shopGroups } = useShopStore(); // Get groups this shop belongs to
  const [linkedGroups, setLinkedGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadServiceGroups();
  }, [serviceId]);

  const loadServiceGroups = async () => {
    try {
      const groups = await serviceGroupApi.getServiceGroups(serviceId);
      setLinkedGroups(groups);
    } catch (error) {
      console.error('Error loading service groups:', error);
    }
  };

  const handleLinkGroup = async (groupId: string) => {
    setLoading(true);
    try {
      await serviceGroupApi.linkServiceToGroup(serviceId, groupId, 100, 1.0);
      await loadServiceGroups();
      onUpdate?.();
    } catch (error) {
      console.error('Error linking group:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkGroup = async (groupId: string) => {
    setLoading(true);
    try {
      await serviceGroupApi.unlinkServiceFromGroup(serviceId, groupId);
      await loadServiceGroups();
      onUpdate?.();
    } catch (error) {
      console.error('Error unlinking group:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRewards = async (groupId: string, percentage: number, multiplier: number) => {
    try {
      await serviceGroupApi.updateServiceGroupRewards(serviceId, groupId, percentage, multiplier);
      await loadServiceGroups();
      onUpdate?.();
    } catch (error) {
      console.error('Error updating rewards:', error);
    }
  };

  const isLinked = (groupId: string) => linkedGroups.some(g => g.groupId === groupId);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Affiliate Group Rewards</h3>
        <p className="text-sm text-gray-600 mb-4">
          Link this service to your affiliate groups to issue custom group tokens when customers book.
        </p>
      </div>

      {/* Available Groups */}
      <div className="space-y-3">
        {shopGroups.map(group => {
          const link = linkedGroups.find(l => l.groupId === group.groupId);
          const linked = isLinked(group.groupId);

          return (
            <div key={group.groupId} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{group.icon}</span>
                  <div>
                    <h4 className="font-medium">{group.groupName}</h4>
                    <p className="text-sm text-gray-500">
                      Earn {group.customTokenSymbol} ({group.customTokenName})
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => linked ? handleUnlinkGroup(group.groupId) : handleLinkGroup(group.groupId)}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    linked
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {linked ? 'Unlink' : 'Link Service'}
                </button>
              </div>

              {linked && link && (
                <div className="space-y-3 mt-4 pt-4 border-t">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Token Reward (% of service price)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="500"
                      value={link.tokenRewardPercentage}
                      onChange={(e) => handleUpdateRewards(group.groupId, parseFloat(e.target.value), link.bonusMultiplier)}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      100% = customer earns {group.customTokenSymbol} equal to service price
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Bonus Multiplier
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={link.bonusMultiplier}
                      onChange={(e) => handleUpdateRewards(group.groupId, link.tokenRewardPercentage, parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      1.0 = standard, 2.0 = double rewards, 0.5 = half rewards
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {shopGroups.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>You're not a member of any affiliate groups yet.</p>
          <p className="text-sm mt-2">Join a group to start offering group-specific rewards!</p>
        </div>
      )}
    </div>
  );
}
```

**Integration:** Add this component to your service edit/create modal

---

### Step 8: Add Group Filter to Customer Marketplace
**File:** Modify `/frontend/src/components/customer/ServiceMarketplaceClient.tsx`

Add to filters section:

```typescript
// Add to state
const [selectedGroupId, setSelectedGroupId] = useState<string>('');
const { customerGroups } = useCustomerStore(); // Get groups customer belongs to

// Add to filter UI
<div className="filter-group">
  <label>Filter by Affiliate Group</label>
  <select
    value={selectedGroupId}
    onChange={(e) => setSelectedGroupId(e.target.value)}
  >
    <option value="">All Services</option>
    {customerGroups.map(group => (
      <option key={group.groupId} value={group.groupId}>
        {group.icon} {group.groupName} (Earn {group.customTokenSymbol})
      </option>
    ))}
  </select>
</div>

// Update fetch logic
useEffect(() => {
  if (selectedGroupId) {
    // Fetch group-specific services
    serviceGroupApi.getGroupServices(selectedGroupId, { /* filters */ })
      .then(setServices);
  } else {
    // Fetch all services (existing logic)
  }
}, [selectedGroupId, otherFilters]);
```

---

### Step 9: Update Service Cards to Show Group Badges
**File:** Modify service card component

```typescript
// Add to ServiceCard component
{service.groups?.map(group => (
  <div key={group.groupId} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
    <span>{group.icon}</span>
    <span>Earn {group.customTokenSymbol}</span>
  </div>
))}
```

---

## 🧪 Testing Checklist

### Backend Tests
- [ ] Link service to group (success)
- [ ] Link service to group (shop not member - fail)
- [ ] Unlink service from group
- [ ] Get service groups
- [ ] Get group services with filters
- [ ] Update group rewards
- [ ] Order completion issues group tokens
- [ ] Multiple groups for one service

### Frontend Tests
- [ ] Shop can link services to their groups
- [ ] Shop can configure reward percentages
- [ ] Shop can unlink services from groups
- [ ] Customer can filter services by group
- [ ] Service cards show group badges
- [ ] Booking service earns both RCN and group tokens
- [ ] Customer sees group token balance increase

---

## 📝 API Documentation (Swagger)

Add to `/backend/src/docs/swagger.ts`:

```typescript
/**
 * @swagger
 * /api/services/{serviceId}/groups/{groupId}:
 *   post:
 *     tags: [Services]
 *     summary: Link service to affiliate group
 *     parameters:
 *       - in: path
 *         name: serviceId
 *       - in: path
 *         name: groupId
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tokenRewardPercentage:
 *                 type: number
 *               bonusMultiplier:
 *                 type: number
 */
```

---

## 🎯 Next Session: Complete These Steps

1. ✅ Database migration (DONE)
2. ✅ ServiceRepository updates (DONE)
3. ⏳ Create ServiceGroupController
4. ⏳ Add routes to ServiceDomain
5. ⏳ Update order processing
6. ⏳ Create frontend API service
7. ⏳ Add UI components
8. ⏳ Test end-to-end

---

## 📊 Expected Outcome

**Shop Experience:**
- Shop owner goes to service management
- Opens service edit modal
- New tab: "Group Rewards"
- Toggles which groups service belongs to
- Configures reward percentages and multipliers
- Saves settings

**Customer Experience:**
- Customer filters marketplace by group
- Sees services with group badges
- Books service
- Receives RCN + group tokens
- Can use group tokens at any shop in that group

**Token Flow:**
```
Customer books "$50 Personal Training"
  ↓
Shop completes order
  ↓
System issues:
  - 5 RCN (platform standard)
  - 50 FitPoints (Fitness Alliance - 100% of price)
  - 25 HealthTokens (Wellness Network - 50% of price)
  ↓
Customer can redeem tokens at respective group shops
```

---

**Status:** Ready for implementation in next session
**Estimated Time:** 2-3 hours to complete all steps
**Priority:** High - Enables key coalition feature
