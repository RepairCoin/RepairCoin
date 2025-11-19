// backend/src/domains/admin/services/management/ShopManagementService.ts
import { shopRepository, adminRepository, customerRepository } from '../../../../repositories';
import { logger } from '../../../../utils/logger';
import { eventBus, createDomainEvent } from '../../../../events/EventBus';

export interface ShopFilters {
  active?: boolean;
  verified?: boolean;
}

/**
 * ShopManagementService
 * Handles all shop-related administrative operations
 * Extracted from AdminService for better maintainability
 */
export class ShopManagementService {

  async getShops(filters: ShopFilters) {
    try {
      const result = await shopRepository.getShopsPaginated({
        page: 1,
        limit: 1000, // Get all shops for admin
        active: filters.active,
        verified: filters.verified
      });

      // Add pending mint amount to each shop
      const { tokenOperationsService } = await import('../operations/TokenOperationsService');
      const shopsWithPendingMints = await Promise.all(
        result.items.map(async (shop) => {
          try {
            const pendingMintAmount = await tokenOperationsService.getShopPendingMintAmount(shop.shopId);
            return {
              ...shop,
              pendingMintAmount
            };
          } catch (error) {
            logger.error(`Error getting pending mint amount for shop ${shop.shopId}:`, error);
            return {
              ...shop,
              pendingMintAmount: 0
            };
          }
        })
      );

      return {
        shops: shopsWithPendingMints,
        count: shopsWithPendingMints.length
      };
    } catch (error) {
      logger.error('Error getting shops:', error);
      throw new Error('Failed to retrieve shops');
    }
  }

  async approveShop(shopId: string, adminAddress?: string) {
    try {
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        throw new Error('Shop not found');
      }

      // Only block approval if shop is BOTH verified AND active (already operational)
      // Allow re-approval of rejected/suspended shops
      if (shop.verified && shop.active && !shop.suspendedAt) {
        throw new Error('Shop already verified and active');
      }

      // Clear suspension fields if this is a re-approval
      const updateData: Record<string, unknown> = {
        verified: true,
        active: true,
        lastActivity: new Date().toISOString()
      };

      if (shop.suspendedAt) {
        updateData.suspendedAt = null;
        updateData.suspensionReason = null;
      }

      await shopRepository.updateShop(shopId, updateData);

      // Publish event for shop approval
      await eventBus.publish(createDomainEvent(
        'shop.approved',
        shopId,
        {
          shopId,
          shopName: shop.name,
          approvedBy: adminAddress
        },
        'ShopManagementService'
      ));

      logger.info('Shop approved', {
        shopId,
        adminAddress
      });

      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: adminAddress || 'system',
        actionType: 'shop_approval',
        actionDescription: `Approved shop: ${shop.name}`,
        entityType: 'shop',
        entityId: shopId,
        metadata: {
          shopName: shop.name,
          shopWallet: shop.walletAddress
        }
      });

      return {
        success: true,
        message: 'Shop approved and activated successfully',
        shop: {
          shopId: shop.shopId,
          name: shop.name,
          verified: true,
          active: true
        }
      };
    } catch (error) {
      logger.error('Shop approval error:', error);
      throw error;
    }
  }

  async createShop(shopData: {
    shopId: string;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    walletAddress: string;
    reimbursementAddress?: string;
    verified: boolean;
    active: boolean;
    crossShopEnabled?: boolean;
    fixflowShopId?: string;
    location?: string | {
      lat?: number;
      lng?: number;
      city?: string;
      state?: string;
      zipCode?: string;
    };
  }) {
    try {
      logger.info('Admin creating shop', { shopId: shopData.shopId });

      // Check if shop ID already exists
      const existingShop = await shopRepository.getShop(shopData.shopId);
      if (existingShop) {
        throw new Error('Shop ID already exists');
      }

      // Check if wallet address is already used
      const existingShops = await shopRepository.getShopsPaginated({ page: 1, limit: 1000 });
      const shopWithWallet = existingShops.items.find(s =>
        s.walletAddress?.toLowerCase() === shopData.walletAddress.toLowerCase()
      );
      if (shopWithWallet) {
        throw new Error('Wallet address already registered to another shop');
      }

      // Create shop with proper database field mapping
      const dbShopData = {
        shopId: shopData.shopId,
        name: shopData.name,
        address: shopData.address,
        phone: shopData.phone,
        email: shopData.email,
        walletAddress: shopData.walletAddress,
        reimbursementAddress: shopData.reimbursementAddress,
        verified: shopData.verified,
        active: shopData.active,
        crossShopEnabled: shopData.crossShopEnabled,
        totalTokensIssued: 0,
        totalRedemptions: 0,
        totalReimbursements: 0,
        joinDate: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        fixflowShopId: shopData.fixflowShopId,
        location: shopData.location
      };

      const result = await shopRepository.createShop(dbShopData);

      logger.info('Shop created by admin', {
        shopId: shopData.shopId,
        result: result
      });

      return {
        success: true,
        shopId: result.id,
        message: 'Shop created successfully',
        shop: {
          shopId: shopData.shopId,
          name: shopData.name,
          verified: shopData.verified,
          active: shopData.active
        }
      };
    } catch (error) {
      logger.error('Shop creation error:', error);
      throw error;
    }
  }

  async suspendShop(shopId: string, reason?: string, adminAddress?: string) {
    try {
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        throw new Error('Shop not found');
      }

      await shopRepository.updateShop(shopId, {
        active: false,
        suspendedAt: new Date().toISOString(),
        suspensionReason: reason
      });

      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: adminAddress || 'system',
        actionType: 'shop_suspension',
        actionDescription: `Suspended shop: ${reason || 'No reason provided'}`,
        entityType: 'shop',
        entityId: shopId,
        metadata: {
          shopName: shop.name,
          reason
        }
      });

      logger.info('Shop suspended', { shopId, reason, adminAddress });

      return {
        success: true,
        message: 'Shop suspended successfully',
        shop: {
          shopId,
          active: false,
          suspendedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Shop suspension error:', error);
      throw error;
    }
  }

  async unsuspendShop(shopId: string, adminAddress?: string) {
    try {
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        throw new Error('Shop not found');
      }

      await shopRepository.updateShop(shopId, {
        active: true,
        suspendedAt: null,
        suspensionReason: null
      });

      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: adminAddress || 'system',
        actionType: 'shop_unsuspension',
        actionDescription: 'Unsuspended shop',
        entityType: 'shop',
        entityId: shopId,
        metadata: { shopName: shop.name }
      });

      logger.info('Shop unsuspended', { shopId, adminAddress });

      return {
        success: true,
        message: 'Shop unsuspended successfully',
        shop: {
          shopId,
          active: true
        }
      };
    } catch (error) {
      logger.error('Shop unsuspension error:', error);
      throw error;
    }
  }

  async updateShop(shopId: string, updates: Record<string, unknown>, adminAddress?: string) {
    try {
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        throw new Error('Shop not found');
      }

      // Filter out protected fields that shouldn't be updated directly
      const { shopId: _, walletAddress: __, ...safeUpdates } = updates;

      await shopRepository.updateShop(shopId, safeUpdates);

      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: adminAddress || 'system',
        actionType: 'shop_update',
        actionDescription: 'Updated shop details',
        entityType: 'shop',
        entityId: shopId,
        metadata: {
          shopName: shop.name,
          updates: safeUpdates
        }
      });

      logger.info('Shop updated', { shopId, updates: safeUpdates, adminAddress });

      const updatedShop = await shopRepository.getShop(shopId);
      return {
        success: true,
        message: 'Shop updated successfully',
        shop: updatedShop
      };
    } catch (error) {
      logger.error('Shop update error:', error);
      throw error;
    }
  }

  async verifyShop(shopId: string, adminAddress?: string) {
    try {
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        throw new Error('Shop not found');
      }

      if (shop.verified) {
        throw new Error('Shop already verified');
      }

      await shopRepository.updateShop(shopId, {
        verified: true,
        verifiedAt: new Date().toISOString(),
        verifiedBy: adminAddress
      });

      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: adminAddress || 'system',
        actionType: 'shop_verification',
        actionDescription: 'Verified shop',
        entityType: 'shop',
        entityId: shopId,
        metadata: { shopName: shop.name }
      });

      logger.info('Shop verified', { shopId, adminAddress });

      return {
        success: true,
        message: 'Shop verified successfully',
        shop: {
          shopId,
          name: shop.name,
          verified: true,
          verifiedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Shop verification error:', error);
      throw error;
    }
  }

  async getUnsuspendRequests(filters: { status?: string; entityType?: string }) {
    try {
      const requests = await adminRepository.getUnsuspendRequests(filters);

      // Enrich with entity details
      const enrichedRequests = await Promise.all(
        requests.map(async (request) => {
          let entityDetails = null;

          if (request.entityType === 'customer') {
            const customer = await customerRepository.getCustomer(request.entityId);
            entityDetails = customer ? {
              name: customer.name,
              email: customer.email,
              address: customer.address
            } : null;
          } else if (request.entityType === 'shop') {
            const shop = await shopRepository.getShop(request.entityId);
            entityDetails = shop ? {
              name: shop.name,
              email: shop.email,
              shopId: shop.shopId
            } : null;
          }

          return {
            ...request,
            entityDetails
          };
        })
      );

      return {
        requests: enrichedRequests,
        count: enrichedRequests.length
      };
    } catch (error) {
      logger.error('Error getting unsuspend requests:', error);
      throw new Error('Failed to retrieve unsuspend requests');
    }
  }

  async approveUnsuspendRequest(requestId: number, adminAddress?: string, notes?: string) {
    try {
      const request = await adminRepository.getUnsuspendRequest(requestId);
      if (!request) {
        throw new Error('Request not found');
      }

      if (request.status !== 'pending') {
        throw new Error('Request has already been processed');
      }

      // Update request status
      await adminRepository.updateUnsuspendRequest(requestId, {
        status: 'approved',
        reviewedAt: new Date().toISOString(),
        reviewedBy: adminAddress,
        reviewNotes: notes
      });

      // Unsuspend the entity
      if (request.entityType === 'customer') {
        const { customerManagementService } = await import('./CustomerManagementService');
        await customerManagementService.unsuspendCustomer(request.entityId, adminAddress);
      } else if (request.entityType === 'shop') {
        await this.unsuspendShop(request.entityId, adminAddress);
      }

      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: adminAddress || 'system',
        actionType: 'unsuspend_request_approved',
        actionDescription: `Approved unsuspend request for ${request.entityType}`,
        entityType: 'unsuspend_request',
        entityId: requestId.toString(),
        metadata: {
          entityType: request.entityType,
          entityId: request.entityId,
          notes
        }
      });

      logger.info('Unsuspend request approved', { requestId, adminAddress });

      return {
        success: true,
        message: `${request.entityType} unsuspension approved`,
        request: {
          id: requestId,
          entityType: request.entityType,
          entityId: request.entityId,
          status: 'approved'
        }
      };
    } catch (error) {
      logger.error('Error approving unsuspend request:', error);
      throw error;
    }
  }

  async rejectUnsuspendRequest(requestId: number, adminAddress?: string, notes?: string) {
    try {
      const request = await adminRepository.getUnsuspendRequest(requestId);
      if (!request) {
        throw new Error('Request not found');
      }

      if (request.status !== 'pending') {
        throw new Error('Request has already been processed');
      }

      // Update request status
      await adminRepository.updateUnsuspendRequest(requestId, {
        status: 'rejected',
        reviewedAt: new Date().toISOString(),
        reviewedBy: adminAddress,
        reviewNotes: notes
      });

      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: adminAddress || 'system',
        actionType: 'unsuspend_request_rejected',
        actionDescription: `Rejected unsuspend request for ${request.entityType}`,
        entityType: 'unsuspend_request',
        entityId: requestId.toString(),
        metadata: {
          entityType: request.entityType,
          entityId: request.entityId,
          notes
        }
      });

      logger.info('Unsuspend request rejected', { requestId, adminAddress });

      return {
        success: true,
        message: 'Unsuspend request rejected',
        request: {
          id: requestId,
          entityType: request.entityType,
          entityId: request.entityId,
          status: 'rejected'
        }
      };
    } catch (error) {
      logger.error('Error rejecting unsuspend request:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const shopManagementService = new ShopManagementService();
