// backend/src/domains/admin/services/management/CustomerManagementService.ts
import { customerRepository, adminRepository } from '../../../../repositories';
import { logger } from '../../../../utils/logger';
import { TierLevel } from '../../../../contracts/TierManager';

export interface PaginationParams {
  page: number;
  limit: number;
  tier?: string;
  active?: boolean;
}

/**
 * CustomerManagementService
 * Handles customer-related administrative operations
 * Extracted from AdminService for better maintainability
 */
export class CustomerManagementService {
  /**
   * Get paginated list of customers with filters
   */
  async getCustomers(params: PaginationParams) {
    try {
      const result = await customerRepository.getCustomersPaginated({
        page: params.page,
        limit: params.limit,
        tier: params.tier as TierLevel,
        active: params.active
      });

      return {
        customers: result.items,
        pagination: {
          page: result.pagination.page,
          limit: result.pagination.limit,
          total: result.pagination.totalItems,
          hasMore: result.pagination.hasMore
        }
      };
    } catch (error) {
      logger.error('Error getting customers:', error);
      throw new Error('Failed to retrieve customers');
    }
  }

  /**
   * Suspend a customer account
   */
  async suspendCustomer(customerAddress: string, reason?: string, adminAddress?: string) {
    try {
      const customer = await customerRepository.getCustomer(customerAddress);
      if (!customer) {
        throw new Error('Customer not found');
      }

      await customerRepository.updateCustomer(customerAddress, {
        isActive: false,
        suspendedAt: new Date().toISOString(),
        suspensionReason: reason
      });

      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: adminAddress || 'system',
        actionType: 'customer_suspension',
        actionDescription: `Suspended customer: ${reason || 'No reason provided'}`,
        entityType: 'customer',
        entityId: customerAddress,
        metadata: { reason }
      });

      logger.info('Customer suspended', { customerAddress, reason, adminAddress });

      return {
        success: true,
        message: 'Customer suspended successfully',
        customer: {
          address: customerAddress,
          isActive: false,
          suspendedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Customer suspension error:', error);
      throw error;
    }
  }

  /**
   * Unsuspend a customer account
   */
  async unsuspendCustomer(customerAddress: string, adminAddress?: string) {
    try {
      const customer = await customerRepository.getCustomer(customerAddress);
      if (!customer) {
        throw new Error('Customer not found');
      }

      await customerRepository.updateCustomer(customerAddress, {
        isActive: true,
        suspendedAt: null,
        suspensionReason: null
      });

      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: adminAddress || 'system',
        actionType: 'customer_unsuspension',
        actionDescription: 'Unsuspended customer',
        entityType: 'customer',
        entityId: customerAddress
      });

      logger.info('Customer unsuspended', { customerAddress, adminAddress });

      return {
        success: true,
        message: 'Customer unsuspended successfully',
        customer: {
          address: customerAddress,
          isActive: true
        }
      };
    } catch (error) {
      logger.error('Customer unsuspension error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const customerManagementService = new CustomerManagementService();
