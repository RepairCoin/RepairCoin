// backend/src/services/AdminService.ts
import { 
  customerRepository, 
  shopRepository, 
  transactionRepository, 
  adminRepository,
  webhookRepository,
  treasuryRepository 
} from '../../../repositories';
import { TokenMinter } from '../../../contracts/TokenMinter';
import { TierManager, CustomerData, TierLevel } from '../../../contracts/TierManager';
import { logger } from '../../../utils/logger';

export interface AdminStats {
  totalCustomers: number;
  totalShops: number;
  totalTransactions: number;
  totalTokensIssued: number;
  totalRedemptions: number;
  totalSupply: number;
  totalTokensInCirculation: number;
  recentActivity: {
    newCustomersToday: number;
    transactionsToday: number;
    tokensIssuedToday: number;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  tier?: string;
  active?: boolean;
}

export interface ShopFilters {
  active?: boolean;
  verified?: boolean;
}

export interface ManualMintParams {
  customerAddress: string;
  amount: number;
  reason: string;
  adminAddress?: string;
}

export class AdminService {
  private tokenMinter: TokenMinter | null = null;
  private tierManager: TierManager | null = null;

  private getTokenMinterInstance(): TokenMinter {
    if (!this.tokenMinter) {
      this.tokenMinter = new TokenMinter();
    }
    return this.tokenMinter;
  }

  private getTierManager(): TierManager {
    if (!this.tierManager) {
      this.tierManager = new TierManager();
    }
    return this.tierManager;
  }

  async getPlatformStatistics(): Promise<AdminStats> {
    try {
      // Get basic counts from database
      const totalCustomers = await this.getTotalCustomersCount();
      const totalShops = await this.getTotalShopsCount();
      const totalTransactions = await this.getTotalTransactionsCount();
      
      // Get total tokens minted from database
      const totalTokensIssued = await this.getTotalTokensMinted();
      const totalRedemptions = await this.getTotalRedemptions();
      
      // Get blockchain stats
      let totalSupply = 0;
      try {
        const contractStats = await this.getTokenMinterInstance().getContractStats();
        if (contractStats && contractStats.totalSupplyReadable > 0) {
          totalSupply = contractStats.totalSupplyReadable;
        }
      } catch (error) {
        logger.warn('Could not fetch contract stats:', error);
      }
      
      const recentActivity = {
        newCustomersToday: await this.getNewCustomersToday(),
        transactionsToday: await this.getTransactionsToday(),
        tokensIssuedToday: await this.getTokensIssuedToday()
      };

      const stats = {
        totalCustomers,
        totalShops,
        totalTransactions,
        totalTokensIssued,
        totalRedemptions,
        totalSupply,
        totalTokensInCirculation: totalTokensIssued,
        recentActivity
      };

      return stats;
    } catch (error) {
      logger.error('Error getting platform statistics:', error);
      throw new Error('Failed to retrieve platform statistics');
    }
  }

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

  async getShops(filters: ShopFilters) {
    try {
      const result = await shopRepository.getShopsPaginated({
        page: 1,
        limit: 1000, // Get all shops for admin
        active: filters.active,
        verified: filters.verified
      });

      return {
        shops: result.items,
        count: result.items.length
      };
    } catch (error) {
      logger.error('Error getting shops:', error);
      throw new Error('Failed to retrieve shops');
    }
  }

  async manualMint(params: ManualMintParams) {
    try {
      // Validate customer exists
      const customer = await customerRepository.getCustomer(params.customerAddress);
      if (!customer) {
        throw new Error('Customer not found');
      }

      logger.info('Admin manual token mint', {
        adminAddress: params.adminAddress,
        customerAddress: params.customerAddress,
        amount: params.amount,
        reason: params.reason
      });

      // TODO: Implement actual token minting when TokenMinter is ready
      // For now, return mock success
      const mockTransactionHash = `mock_mint_${Date.now()}`;

      // Update customer data
      const newTier = this.getTierManager().calculateTier(customer.lifetimeEarnings + params.amount);
      await customerRepository.updateCustomerAfterEarning(params.customerAddress, params.amount, newTier);

      // Record transaction
      await transactionRepository.recordTransaction({
        id: `admin_mint_${Date.now()}`,
        type: 'mint',
        customerAddress: params.customerAddress.toLowerCase(),
        shopId: 'admin_system',
        amount: params.amount,
        reason: `Admin mint: ${params.reason}`,
        transactionHash: mockTransactionHash,
        timestamp: new Date().toISOString(),
        status: 'confirmed',
        metadata: {
          repairAmount: params.amount,
          referralId: undefined,
          engagementType: 'admin_mint',
          redemptionLocation: undefined,
          webhookId: `admin_${Date.now()}`
        }
      });

      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: params.adminAddress || 'system',
        actionType: 'manual_mint',
        actionDescription: `Minted ${params.amount} RCN to customer: ${params.reason}`,
        entityType: 'customer',
        entityId: params.customerAddress,
        metadata: {
          amount: params.amount,
          reason: params.reason,
          transactionHash: mockTransactionHash
        }
      });

      return {
        success: true,
        transactionHash: mockTransactionHash,
        amount: params.amount,
        newTier,
        message: `Successfully minted ${params.amount} RCN to customer`
      };
    } catch (error) {
      logger.error('Manual mint error:', error);
      throw error;
    }
  }

  async pauseContract(adminAddress?: string) {
    try {
      logger.info('Contract pause requested', { adminAddress });
      
      // TODO: Implement actual contract pausing when TokenMinter is ready
      // const result = await this.tokenMinter.pause();
      
      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: adminAddress || 'system',
        actionType: 'contract_pause',
        actionDescription: 'Paused RepairCoin contract',
        entityType: 'contract',
        entityId: 'repaircoin',
        metadata: {
          action: 'pause'
        }
      });
      
      return {
        success: true,
        transactionHash: `mock_pause_${Date.now()}`,
        message: 'Contract paused successfully'
      };
    } catch (error) {
      logger.error('Contract pause error:', error);
      throw new Error('Failed to pause contract');
    }
  }

  async unpauseContract(adminAddress?: string) {
    try {
      logger.info('Contract unpause requested', { adminAddress });
      
      // TODO: Implement actual contract unpausing when TokenMinter is ready
      // const result = await this.tokenMinter.unpause();
      
      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: adminAddress || 'system',
        actionType: 'contract_unpause',
        actionDescription: 'Unpaused RepairCoin contract',
        entityType: 'contract',
        entityId: 'repaircoin',
        metadata: {
          action: 'unpause'
        }
      });
      
      return {
        success: true,
        transactionHash: `mock_unpause_${Date.now()}`,
        message: 'Contract unpaused successfully'
      };
    } catch (error) {
      logger.error('Contract unpause error:', error);
      throw new Error('Failed to unpause contract');
    }
  }

  async approveShop(shopId: string, adminAddress?: string) {
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
        active: true,
        lastActivity: new Date().toISOString()
      });

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

  async getFailedWebhooks(limit: number = 20) {
    try {
      const failedWebhooks = await webhookRepository.getFailedWebhooks(limit);
      
      return {
        webhooks: failedWebhooks,
        count: failedWebhooks.length
      };
    } catch (error) {
      logger.error('Error getting failed webhooks:', error);
      throw new Error('Failed to retrieve failed webhooks');
    }
  }

  async cleanupWebhookLogs(daysOld: number = 30) {
    try {
      // TODO: Implement webhook cleanup in DatabaseService
      logger.info('Webhook cleanup requested', { daysOld });
      
      return {
        success: true,
        message: `Webhook logs older than ${daysOld} days cleaned up`,
        deletedCount: 0 // Mock for now
      };
    } catch (error) {
      logger.error('Webhook cleanup error:', error);
      throw new Error('Failed to cleanup webhook logs');
    }
  }

  async archiveTransactions(daysOld: number = 365) {
    try {
      // TODO: Implement transaction archiving in DatabaseService
      logger.info('Transaction archiving requested', { daysOld });
      
      return {
        success: true,
        message: `Transactions older than ${daysOld} days archived`,
        archivedCount: 0 // Mock for now
      };
    } catch (error) {
      logger.error('Transaction archiving error:', error);
      throw new Error('Failed to archive transactions');
    }
  }

  // Helper methods for getting counts
  private async getTotalCustomersCount(): Promise<number> {
    try {
      const result = await customerRepository.getCustomersPaginated({
        page: 1,
        limit: 1
      });
      return result.pagination.totalItems || 0;
    } catch (error) {
      return 0;
    }
  }

  private async getTotalShopsCount(): Promise<number> {
    try {
      // Count only active and verified shops (matching Active Shops tab)
      const result = await shopRepository.getShopsPaginated({
        page: 1,
        limit: 1,
        active: true,
        verified: true
      });
      return result.pagination.totalItems || 0;
    } catch (error) {
      return 0;
    }
  }

  private async getTotalTransactionsCount(): Promise<number> {
    try {
      // TODO: Implement transaction count query in DatabaseService
      return 0; // Mock for now
    } catch (error) {
      return 0;
    }
  }

  private async getNewCustomersToday(): Promise<number> {
    try {
      // TODO: Implement today's customer count query
      return 0; // Mock for now
    } catch (error) {
      return 0;
    }
  }

  private async getTransactionsToday(): Promise<number> {
    try {
      // TODO: Implement today's transaction count query
      return 0; // Mock for now
    } catch (error) {
      return 0;
    }
  }

  private async getTokensIssuedToday(): Promise<number> {
    try {
      // TODO: Implement today's token issuance query
      return 0; // Mock for now
    } catch (error) {
      return 0;
    }
  }

  private async getTotalTokensMinted(): Promise<number> {
    try {
      // Use a method from databaseService or create a new one
      const stats = await adminRepository.getPlatformStatistics();
      return stats.totalTokensIssued || 0;
    } catch (error) {
      logger.error('Error getting total tokens minted:', error);
      return 0;
    }
  }

  private async getTotalRedemptions(): Promise<number> {
    try {
      const stats = await adminRepository.getPlatformStatistics();
      return stats.totalRedemptions || 0;
    } catch (error) {
      logger.error('Error getting total redemptions:', error);
      return 0;
    }
  }

    async updatePlatformMetrics(eventType: string, amount?: number): Promise<void> {
    try {
      // In a real implementation, you might update a metrics database
      // or send to analytics service like DataDog, New Relic, etc.
      
      logger.info('Platform metric updated', {
        eventType,
        amount,
        timestamp: new Date().toISOString()
      });

      // Example: Could store in Redis or send to analytics service
      // await metricsService.increment(`platform.${eventType}`, amount);
      
      // For now, we'll just log and potentially store in database
      // You could add a metrics table to track these events over time
      
    } catch (error) {
      logger.error('Failed to update platform metrics:', error);
    }
  }
async alertOnWebhookFailure(failureData: any): Promise<void> {
    try {
      logger.warn('Webhook failure detected by admin domain', failureData);

      // In production, this might:
      // - Send Slack/Discord notification
      // - Create PagerDuty incident
      // - Send email alert
      // - Update monitoring dashboard
      // - Store in alerts table

      // For now, just log at warn level with structured data
      
      // Future: Could implement actual alerting
      // await this.sendSlackAlert(failureData);
      // await this.createIncident(failureData);
      
    } catch (error) {
      logger.error('Failed to send webhook failure alert:', error);
    }
  }

  // ADD: System health monitoring (called by admin domain)
  async checkSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    try {
      // Check various system components
      const dbHealth = await customerRepository.healthCheck();
      
      // Could check other services too:
      // - Redis connectivity
      // - External API health
      // - Blockchain connectivity
      // - Token contract status

      const isHealthy = dbHealth.status === 'healthy';
      
      return {
        status: isHealthy ? 'healthy' : 'degraded',
        details: {
          database: dbHealth,
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
          }
        }
      };
    } catch (error) {
      logger.error('System health check failed:', error);
      return {
        status: 'unhealthy',
        details: { error: error.message }
      };
    }
  }

  // ADD: Real-time platform statistics (enhanced version)
  async getRealTimePlatformStats(): Promise<{
    totalCustomers: number;
    totalShops: number;
    totalTransactions: number;
    systemHealth: any;
    recentEvents: any[];
  }> {
    try {
      const [basicStats, systemHealth] = await Promise.all([
        this.getPlatformStatistics(),
        this.checkSystemHealth()
      ]);

      return {
        ...basicStats,
        systemHealth,
        recentEvents: [] // Could get from event bus history
      };
    } catch (error) {
      logger.error('Failed to get real-time platform stats:', error);
      throw error;
    }
  }

  // ADD: Alert management
  async getRecentAlerts(limit: number = 50): Promise<any[]> {
    try {
      // In a real system, you'd query an alerts table
      // For now, return recent failed webhooks as alerts
      const failedWebhooks = await this.getFailedWebhooks(limit);
      
      return failedWebhooks.webhooks.map(webhook => ({
        id: webhook.id,
        type: 'webhook_failure',
        severity: 'warning',
        message: `Webhook ${webhook.event} failed`,
        timestamp: webhook.timestamp,
        data: webhook
      }));
    } catch (error) {
      logger.error('Failed to get recent alerts:', error);
      return [];
    }
  }

  // ADD: Performance metrics
  async getPerformanceMetrics(): Promise<{
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
    systemLoad: any;
  }> {
    try {
      // In a real system, you'd get these from monitoring services
      // For now, return mock/basic data
      
      return {
        averageResponseTime: 245, // ms
        errorRate: 2.1, // percentage
        throughput: 150, // requests per minute
        systemLoad: {
          cpu: process.cpuUsage(),
          memory: process.memoryUsage(),
          uptime: process.uptime()
        }
      };
    } catch (error) {
      logger.error('Failed to get performance metrics:', error);
      throw error;
    }
  }

  async createShop(shopData: any) {
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

  async createAdmin(adminData: { walletAddress: string; name?: string; email?: string; permissions: string[] }) {
    try {
      logger.info('Creating new admin', { walletAddress: adminData.walletAddress });

      // Note: For now, admin management is done via .env file
      // In a real system, you'd probably have an admins table
      // This is a placeholder implementation

      // Check if address is already an admin
      const currentAdmins = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim());
      if (currentAdmins.includes(adminData.walletAddress.toLowerCase())) {
        throw new Error('Address is already an admin');
      }

      // In a real implementation, you would:
      // 1. Store admin in database table
      // 2. Update environment configuration
      // 3. Notify other services of new admin

      logger.warn('Admin creation requested but not fully implemented', {
        note: 'Currently admins are managed via ADMIN_ADDRESSES environment variable',
        requestedAdmin: adminData
      });

      return {
        success: true,
        message: 'Admin creation logged. Please manually add the address to ADMIN_ADDRESSES environment variable.',
        admin: {
          walletAddress: adminData.walletAddress,
          name: adminData.name,
          permissions: adminData.permissions
        }
      };
    } catch (error) {
      logger.error('Admin creation error:', error);
      throw error;
    }
  }

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

  async updateShop(shopId: string, updates: any, adminAddress?: string) {
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
        await this.unsuspendCustomer(request.entityId, adminAddress);
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
        message: `Unsuspend request rejected`,
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

  async mintShopBalance(shopId: string) {
    try {
      // Get shop data
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        throw new Error('Shop not found');
      }

      // Check if shop has unminted balance
      const unmintedBalance = shop.purchasedRcnBalance || 0;
      if (unmintedBalance <= 0) {
        throw new Error('No balance to mint');
      }

      // Get shop wallet address
      const shopWallet = await shopRepository.getShopByWallet(shop.walletAddress);
      if (!shopWallet) {
        throw new Error('Shop wallet not found');
      }

      // Transfer tokens from admin wallet to shop wallet
      const tokenMinter = new TokenMinter();
      const transferResult = await tokenMinter.batchTransferTokens([{
        address: shop.walletAddress,
        amount: unmintedBalance,
        reason: `Transferring purchased RCN balance to shop ${shopId}`
      }]);
      
      const result = transferResult[0]; // Get first result from batch

      if (!result || !result.success) {
        throw new Error(`Transfer failed: ${result?.error || 'Unknown error'}`);
      }

      // Reset the shop's purchased balance to 0 after successful transfer
      await shopRepository.updateShop(shopId, {
        purchasedRcnBalance: 0
      });
      
      logger.info('Shop balance transferred and reset', { 
        shopId, 
        amount: unmintedBalance,
        walletAddress: shop.walletAddress
      });

      // Update shop's minted status (optional - you might want to track this)
      logger.info('Shop balance minted successfully', { 
        shopId, 
        amount: unmintedBalance,
        transactionHash: result.transactionHash,
        walletAddress: shop.walletAddress
      });

      return {
        success: true,
        message: `Successfully transferred ${unmintedBalance} RCN to shop wallet`,
        data: {
          shopId,
          shopName: shop.name,
          amountTransferred: unmintedBalance,
          walletAddress: shop.walletAddress,
          transactionHash: result.transactionHash
        }
      };
    } catch (error) {
      logger.error('Error transferring shop balance:', error);
      throw error;
    }
  }
}