// backend/src/domains/admin/services/AdminService.ts
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
import { eventBus, createDomainEvent } from '../../../events/EventBus';
import { TokenService } from '../../token/services/TokenService';
import { AdminRoleConflictService } from '../../../services/AdminRoleConflictService';

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

export interface SellRcnParams {
  shopId: string;
  amount: number;
  pricePerToken: number;
  paymentMethod: string;
  paymentReference?: string;
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

      // Mint tokens using TokenMinter
      const tokenMinter = this.getTokenMinterInstance();
      const mintResult = await tokenMinter.adminMintTokens(
        params.customerAddress,
        params.amount,
        params.reason
      );

      if (!mintResult.success || !mintResult.transactionHash) {
        throw new Error(mintResult.error || 'Failed to mint tokens');
      }

      const transactionHash = mintResult.transactionHash;

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
        transactionHash: transactionHash,
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
          transactionHash: transactionHash
        }
      });

      return {
        success: true,
        transactionHash: transactionHash,
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
      
      // Check if already paused
      const isPaused = await this.getTokenMinterInstance().isContractPaused();
      if (isPaused) {
        return {
          success: false,
          message: 'Contract is already paused'
        };
      }

      // Pause the contract
      const result = await this.getTokenMinterInstance().pauseContract();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to pause contract');
      }
      
      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: adminAddress || 'system',
        actionType: 'contract_pause',
        actionDescription: 'Paused RepairCoin contract',
        entityType: 'contract',
        entityId: 'repaircoin',
        metadata: {
          action: 'pause',
          transactionHash: result.transactionHash
        }
      });
      
      logger.info('Contract paused successfully', {
        adminAddress,
        transactionHash: result.transactionHash
      });
      
      return {
        success: true,
        transactionHash: result.transactionHash,
        message: 'Contract paused successfully - All token operations are now disabled'
      };
    } catch (error) {
      logger.error('Contract pause error:', error);
      throw new Error(`Failed to pause contract: ${error.message}`);
    }
  }

  async unpauseContract(adminAddress?: string) {
    try {
      logger.info('Contract unpause requested', { adminAddress });
      
      // Check if already unpaused
      const isPaused = await this.getTokenMinterInstance().isContractPaused();
      if (!isPaused) {
        return {
          success: false,
          message: 'Contract is already unpaused'
        };
      }

      // Unpause the contract
      const result = await this.getTokenMinterInstance().unpauseContract();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to unpause contract');
      }
      
      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: adminAddress || 'system',
        actionType: 'contract_unpause',
        actionDescription: 'Unpaused RepairCoin contract',
        entityType: 'contract',
        entityId: 'repaircoin',
        metadata: {
          action: 'unpause',
          transactionHash: result.transactionHash
        }
      });
      
      logger.info('Contract unpaused successfully', {
        adminAddress,
        transactionHash: result.transactionHash
      });
      
      return {
        success: true,
        transactionHash: result.transactionHash,
        message: 'Contract unpaused successfully - Token operations are now enabled'
      };
    } catch (error) {
      logger.error('Contract unpause error:', error);
      throw new Error(`Failed to unpause contract: ${error.message}`);
    }
  }

  async getContractStatus() {
    try {
      const tokenMinter = this.getTokenMinterInstance();
      
      // Get contract pause status
      const isPaused = await tokenMinter.isContractPaused();
      
      // Get contract statistics
      const contractStats = await tokenMinter.getContractStats();
      
      return {
        success: true,
        status: {
          isPaused,
          contractAddress: contractStats?.contractAddress || 'Unknown',
          totalSupply: contractStats?.totalSupplyReadable || 0,
          lastChecked: new Date().toISOString()
        },
        message: `Contract is ${isPaused ? 'PAUSED' : 'ACTIVE'}`
      };
    } catch (error) {
      logger.error('Error getting contract status:', error);
      return {
        success: false,
        error: error.message,
        status: {
          isPaused: null,
          contractAddress: 'Error',
          totalSupply: 0,
          lastChecked: new Date().toISOString()
        }
      };
    }
  }

  async emergencyStop(adminAddress?: string, reason?: string) {
    try {
      logger.warn('EMERGENCY STOP requested', { 
        adminAddress, 
        reason: reason || 'Emergency stop activated by admin' 
      });

      // Check if already paused
      const isPaused = await this.getTokenMinterInstance().isContractPaused();
      if (isPaused) {
        return {
          success: false,
          message: 'Contract is already in emergency stop (paused) state'
        };
      }

      // Pause the contract
      const result = await this.getTokenMinterInstance().pauseContract();
      
      if (!result.success) {
        throw new Error(result.error || 'Emergency stop failed');
      }
      
      // Log emergency activity with high priority
      await adminRepository.logAdminActivity({
        adminAddress: adminAddress || 'system',
        actionType: 'emergency_stop',
        actionDescription: `EMERGENCY STOP: ${reason || 'Contract paused immediately'}`,
        entityType: 'contract',
        entityId: 'repaircoin',
        metadata: {
          action: 'emergency_stop',
          reason: reason || 'Emergency stop activated',
          transactionHash: result.transactionHash,
          timestamp: new Date().toISOString()
        }
      });
      
      logger.error('EMERGENCY STOP ACTIVATED', {
        adminAddress,
        reason,
        transactionHash: result.transactionHash
      });
      
      return {
        success: true,
        transactionHash: result.transactionHash,
        message: '🚨 EMERGENCY STOP ACTIVATED - All token operations are immediately disabled'
      };
    } catch (error) {
      logger.error('Emergency stop error:', error);
      throw new Error(`Emergency stop failed: ${error.message}`);
    }
  }

  async processManualRedemption(params: {
    customerAddress: string;
    amount: number;
    shopId: string;
    adminAddress?: string;
    reason?: string;
    forceProcess?: boolean;
  }) {
    try {
      const { customerAddress, amount, shopId, adminAddress, reason } = params;
      
      logger.info('Manual redemption requested', { customerAddress, amount, shopId, adminAddress });
      
      // Validate customer exists
      const customer = await customerRepository.getCustomer(customerAddress);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Validate shop exists
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        throw new Error('Shop not found');
      }

      // Check customer balance
      const currentBalance = await this.getTokenMinterInstance().getCustomerBalance(customerAddress);
      if (!currentBalance || currentBalance < amount) {
        throw new Error(`Insufficient balance. Customer has ${currentBalance || 0} RCN, requested ${amount} RCN`);
      }

      // Process the redemption by burning tokens
      const burnResult = await this.getTokenMinterInstance().burnTokensFromCustomer(
        customerAddress,
        amount,
        '0x000000000000000000000000000000000000dEaD',
        'Manual admin redemption'
      );

      if (!burnResult.success) {
        throw new Error(burnResult.error || 'Failed to process redemption');
      }

      // Record transaction
      await transactionRepository.recordTransaction({
        id: `manual_redemption_${Date.now()}`,
        type: 'redeem',
        customerAddress: customerAddress.toLowerCase(),
        shopId,
        amount,
        reason: `Manual redemption: ${reason || 'Admin processed'}`,
        transactionHash: burnResult.transactionHash || '',
        timestamp: new Date().toISOString(),
        status: 'confirmed',
        metadata: {
          processedBy: adminAddress || 'admin',
          manual: true,
          adminReason: reason || 'Manual processing'
        }
      });

      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: adminAddress || 'system',
        actionType: 'manual_redemption',
        actionDescription: `Manually processed redemption of ${amount} RCN for customer ${customerAddress}`,
        entityType: 'transaction',
        entityId: `manual_redemption_${Date.now()}`,
        metadata: {
          customerAddress,
          shopId,
          amount,
          reason,
          transactionHash: burnResult.transactionHash
        }
      });

      logger.info('Manual redemption processed successfully', {
        customerAddress,
        amount,
        shopId,
        transactionHash: burnResult.transactionHash
      });

      return {
        success: true,
        transactionHash: burnResult.transactionHash,
        message: `Successfully processed manual redemption of ${amount} RCN`,
        details: {
          customerAddress,
          shopId: shop.shopId,
          shopName: shop.name,
          amount,
          newBalance: (currentBalance - amount)
        }
      };
    } catch (error) {
      logger.error('Manual redemption error:', error);
      throw new Error(`Manual redemption failed: ${error.message}`);
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

      // Publish event for shop approval
      await eventBus.publish(createDomainEvent(
        'shop.approved',
        shopId,
        {
          shopId,
          shopName: shop.name,
          approvedBy: adminAddress
        },
        'AdminService'
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

  async sellRcnToShop(params: SellRcnParams) {
    try {
      // Validate shop exists and is active
      const shop = await shopRepository.getShop(params.shopId);
      if (!shop) {
        throw new Error('Shop not found');
      }
      if (!shop.active) {
        throw new Error('Shop is not active');
      }
      if (!shop.verified) {
        throw new Error('Shop is not verified');
      }

      logger.info('Processing RCN sale to shop', {
        shopId: params.shopId,
        amount: params.amount,
        pricePerToken: params.pricePerToken,
        totalCost: params.amount * params.pricePerToken
      });

      // Record the purchase in the database
      const purchase = await shopRepository.createShopPurchase({
        shopId: params.shopId,
        amount: params.amount,
        pricePerRcn: params.pricePerToken,
        totalCost: params.amount * params.pricePerToken,
        paymentMethod: params.paymentMethod,
        paymentReference: params.paymentReference || `ADMIN-${Date.now()}`,
        status: 'completed'
      });

      // Update shop's purchased RCN balance
      await shopRepository.updateShopRcnBalance(params.shopId, params.amount);

      // Update treasury
      await treasuryRepository.updateTreasuryAfterSale(params.amount, params.amount * params.pricePerToken);

      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: params.adminAddress || 'system',
        actionType: 'rcn_sale',
        actionDescription: `Sold ${params.amount} RCN to shop ${shop.name} at $${params.pricePerToken} per token`,
        entityType: 'shop',
        entityId: params.shopId,
        metadata: {
          amount: params.amount,
          pricePerToken: params.pricePerToken,
          totalCost: params.amount * params.pricePerToken,
          paymentMethod: params.paymentMethod,
          paymentReference: params.paymentReference
        }
      });

      return {
        success: true,
        message: `Successfully sold ${params.amount} RCN to shop`,
        purchase: {
          id: purchase.id,
          amount: params.amount,
          totalCost: params.amount * params.pricePerToken,
          newBalance: shop.purchasedRcnBalance + params.amount
        }
      };
    } catch (error) {
      logger.error('Error selling RCN to shop:', error);
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
      const result = await treasuryRepository.query(`
        SELECT COUNT(*) as total_count 
        FROM transactions
      `);
      return parseInt(result.rows[0]?.total_count || '0');
    } catch (error) {
      logger.error('Error getting total transactions count:', error);
      return 0;
    }
  }

  private async getNewCustomersToday(): Promise<number> {
    try {
      const result = await treasuryRepository.query(`
        SELECT COUNT(*) as new_customers
        FROM customers 
        WHERE DATE(created_at) = CURRENT_DATE
      `);
      return parseInt(result.rows[0]?.new_customers || '0');
    } catch (error) {
      logger.error('Error getting new customers today:', error);
      return 0;
    }
  }

  private async getTransactionsToday(): Promise<number> {
    try {
      const result = await treasuryRepository.query(`
        SELECT COUNT(*) as transactions_today
        FROM transactions 
        WHERE DATE(created_at) = CURRENT_DATE
      `);
      return parseInt(result.rows[0]?.transactions_today || '0');
    } catch (error) {
      logger.error('Error getting transactions today:', error);
      return 0;
    }
  }

  private async getTokensIssuedToday(): Promise<number> {
    try {
      const result = await treasuryRepository.query(`
        SELECT COALESCE(SUM(amount), 0) as tokens_issued_today
        FROM transactions 
        WHERE DATE(created_at) = CURRENT_DATE
          AND type IN ('repair_reward', 'referral_reward', 'tier_bonus', 'admin_mint')
          AND amount > 0
      `);
      return parseFloat(result.rows[0]?.tokens_issued_today || '0');
    } catch (error) {
      logger.error('Error getting tokens issued today:', error);
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

  async createAdmin(adminData: { 
    walletAddress: string; 
    name?: string; 
    email?: string; 
    role?: string;
    permissions?: string[];
    createdBy?: string 
  }) {
    try {
      logger.info('Creating new admin', { 
        walletAddress: adminData.walletAddress,
        role: adminData.role 
      });

      // Check if address is already an admin in database
      const existingAdmin = await adminRepository.getAdmin(adminData.walletAddress);
      if (existingAdmin) {
        throw new Error('Address is already an admin');
      }

      // Check if address is already an admin in environment variables (legacy check)
      const envAdmins = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim());
      if (envAdmins.includes(adminData.walletAddress.toLowerCase())) {
        throw new Error('Cannot create admin for address that is in ADMIN_ADDRESSES env variable');
      }

      // Import permissions config
      const permissionsModule = await import('../../../config/permissions');
      const { roleToPermissions } = permissionsModule;
      
      // Determine role and permissions
      let role = adminData.role || 'admin';
      let permissions = adminData.permissions;
      
      // If role is provided, use role-based permissions
      if (role) {
        // Validate role
        const validRoles = ['admin', 'moderator'];
        if (!validRoles.includes(role)) {
          throw new Error(`Invalid role. Valid roles are: ${validRoles.join(', ')}`);
        }
        
        // Get permissions for the role
        permissions = roleToPermissions(role as any);
      } else if (!permissions || permissions.length === 0) {
        // Default to admin role if no role or permissions provided
        role = 'admin';
        permissions = roleToPermissions('admin' as any);
      }

      // Prevent creating super admin through this method
      if (role === 'super_admin') {
        throw new Error('Super admin can only be set through ADMIN_ADDRESSES environment variable');
      }

      // Store admin in database
      const newAdmin = await adminRepository.createAdmin({
        walletAddress: adminData.walletAddress,
        name: adminData.name,
        email: adminData.email,
        role: role,
        permissions: permissions,
        isSuperAdmin: false, // Only env can create super admins
        createdBy: adminData.createdBy
      });

      // Log the admin creation activity
      await adminRepository.logAdminActivity({
        adminAddress: adminData.createdBy || 'system',
        actionType: 'admin_creation',
        actionDescription: `Created new ${role}: ${adminData.name || adminData.walletAddress}`,
        entityType: 'admin',
        entityId: adminData.walletAddress,
        metadata: {
          name: adminData.name,
          email: adminData.email,
          role: role,
          permissions: permissions
        }
      });

      // Notify other services of new admin via event bus
      await eventBus.publish(createDomainEvent(
        'admin.created',
        newAdmin.walletAddress,
        {
          adminId: newAdmin.id,
          walletAddress: newAdmin.walletAddress,
          name: newAdmin.name,
          email: newAdmin.email,
          role: newAdmin.role,
          permissions: newAdmin.permissions,
          createdBy: adminData.createdBy
        },
        'AdminService'
      ));

      logger.info('Admin successfully created in database and event published', {
        walletAddress: adminData.walletAddress,
        name: adminData.name,
        role: newAdmin.role
      });

      return {
        success: true,
        message: `${role} created successfully`,
        admin: {
          id: newAdmin.id,
          walletAddress: newAdmin.walletAddress,
          name: newAdmin.name,
          email: newAdmin.email,
          role: newAdmin.role,
          permissions: newAdmin.permissions,
          isActive: newAdmin.isActive,
          isSuperAdmin: newAdmin.isSuperAdmin
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

  async getAdmins() {
    try {
      const admins = await adminRepository.getAllAdmins();
      
      // Filter out inactive admins unless specifically requested
      const activeAdmins = admins.filter(admin => admin.isActive);
      
      return {
        success: true,
        admins: activeAdmins,
        count: activeAdmins.length
      };
    } catch (error) {
      logger.error('Error getting admins:', error);
      throw new Error('Failed to retrieve admins');
    }
  }

  async updateAdminPermissions(walletAddress: string, permissions: string[], updatedBy?: string) {
    try {
      const admin = await adminRepository.getAdmin(walletAddress);
      if (!admin) {
        throw new Error('Admin not found');
      }

      const updatedAdmin = await adminRepository.updateAdmin(walletAddress, {
        permissions
      });

      // Log the activity
      await adminRepository.logAdminActivity({
        adminAddress: updatedBy || 'system',
        actionType: 'admin_permissions_update',
        actionDescription: `Updated permissions for admin ${admin.name || walletAddress}`,
        entityType: 'admin',
        entityId: walletAddress,
        metadata: {
          oldPermissions: admin.permissions,
          newPermissions: permissions
        }
      });

      // Publish event for permission update
      await eventBus.publish(createDomainEvent(
        'admin.permissions_updated',
        walletAddress,
        {
          adminId: admin.id,
          walletAddress,
          oldPermissions: admin.permissions,
          newPermissions: permissions,
          updatedBy
        },
        'AdminService'
      ));

      logger.info('Admin permissions updated', {
        walletAddress,
        permissions,
        updatedBy
      });

      return {
        success: true,
        message: 'Admin permissions updated successfully',
        admin: updatedAdmin
      };
    } catch (error) {
      logger.error('Error updating admin permissions:', error);
      throw error;
    }
  }

  async checkAdminAccess(walletAddress: string): Promise<boolean> {
    try {
      const normalizedAddress = walletAddress.toLowerCase();
      
      // Check if adminRepository is available and has the required method
      if (adminRepository && typeof adminRepository.isAdmin === 'function') {
        // Check if this is a super admin from .env (all addresses in ADMIN_ADDRESSES are super admins)
        const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim()).filter(addr => addr.length > 0);
        const isSuperAdminFromEnv = adminAddresses.includes(normalizedAddress);
        
        // Get admin data from database
        const adminData = await adminRepository.getAdminByWalletAddress(normalizedAddress);
        
        if (adminData) {
          // Update last login time
          await adminRepository.updateAdminLastLogin(normalizedAddress);
          
          // Sync super admin status with .env configuration
          if (isSuperAdminFromEnv) {
            // If this is the super admin from env but doesn't have super admin status, update it
            if (!adminData.isSuperAdmin) {
              // First, remove super admin status from all other admins
              const allAdmins = await adminRepository.getAllAdmins();
              for (const admin of allAdmins) {
                if (admin.isSuperAdmin && admin.walletAddress.toLowerCase() !== normalizedAddress) {
                  await adminRepository.updateAdmin(admin.walletAddress, { isSuperAdmin: false });
                  logger.info('Removed super admin status from:', admin.walletAddress);
                }
              }
              
              // Then grant super admin status to the current admin
              await adminRepository.updateAdmin(normalizedAddress, { isSuperAdmin: true });
              logger.info('Granted super admin status to env admin:', normalizedAddress);
            }
          } else if (adminData.isSuperAdmin) {
            // If this admin has super admin status but is NOT in env list, remove it
            await adminRepository.updateAdmin(normalizedAddress, { isSuperAdmin: false });
            logger.info('Removed super admin status (not in env) from:', normalizedAddress);
          }
          
          return true;
        }
        
        // If not in database but is super admin from env, auto-create with conflict checking
        if (isSuperAdminFromEnv && typeof adminRepository.createAdmin === 'function') {
          logger.info('Auto-migrating super admin from environment to database', { walletAddress });
          
          // Check for role conflicts before auto-creating
          const conflictService = new AdminRoleConflictService();
          const skipConflictCheck = process.env.ADMIN_SKIP_CONFLICT_CHECK === 'true';
          
          if (!skipConflictCheck) {
            try {
              const conflict = await conflictService.checkRoleConflict(normalizedAddress);
              if (conflict.hasConflict) {
                logger.error('🚫 Admin auto-creation blocked due to role conflict', {
                  walletAddress: normalizedAddress,
                  existingRole: conflict.existingRole,
                  existingData: conflict.existingData
                });
                logger.error('   Resolution options:');
                logger.error('   1. Remove address from ADMIN_ADDRESSES');
                logger.error('   2. Use CLI: npm run admin:promote <address> --action deactivate|preserve');
                logger.error('   3. Set ADMIN_SKIP_CONFLICT_CHECK=true to bypass (not recommended)');
                return false;
              }
            } catch (conflictError) {
              logger.error('Error checking admin role conflicts during auto-creation:', conflictError);
              // Don't block if conflict check fails, but log it
            }
          } else {
            logger.warn('⚠️ Admin role conflict check bypassed by ADMIN_SKIP_CONFLICT_CHECK=true');
          }
          
          try {
            // First, remove super admin status from all existing admins
            const allAdmins = await adminRepository.getAllAdmins();
            for (const admin of allAdmins) {
              if (admin.isSuperAdmin) {
                await adminRepository.updateAdmin(admin.walletAddress, { isSuperAdmin: false });
                logger.info('Removed super admin status from:', admin.walletAddress);
              }
            }
            
            // Create the new super admin
            await adminRepository.createAdmin({
              walletAddress: normalizedAddress,
              name: 'Super Administrator',
              permissions: ['all'],
              isSuperAdmin: true,
              createdBy: 'system'
            });
            
            // Log the admin creation for audit purposes
            logger.info('✅ Admin auto-created successfully', {
              walletAddress: normalizedAddress,
              action: 'admin_auto_creation',
              skipConflictCheck
            });
            
            return true;
          } catch (migrationError: any) {
            // Admin might already exist, just log and continue
            logger.debug('Super admin migration failed', { 
              walletAddress: normalizedAddress,
              error: migrationError.message 
            });
          }
        }
        
        return isSuperAdminFromEnv;
      } else {
        // Fallback to env check if adminRepository not available
        logger.warn('AdminRepository not available, falling back to env check');
        const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim()).filter(addr => addr.length > 0);
        // All addresses in ADMIN_ADDRESSES are super admins
        return adminAddresses.includes(normalizedAddress);
      }
    } catch (error) {
      logger.error('Error checking admin access:', error);
      // In case of database error, fallback to env check
      const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim()).filter(addr => addr.length > 0);
      // All addresses in ADMIN_ADDRESSES are super admins
      return adminAddresses.includes(walletAddress.toLowerCase());
    }
  }

  // Admin Management Methods
  
  async getAllAdmins() {
    try {
      const admins = await adminRepository.getAllAdmins();
      
      // Get env super admins to mark them as protected
      const envAdminAddresses = (process.env.ADMIN_ADDRESSES || '')
        .split(',')
        .map(addr => addr.toLowerCase().trim())
        .filter(addr => addr.length > 0);
      
      // Add protected status and ensure role is correct for env super admins
      return admins.map(admin => {
        const isEnvSuperAdmin = envAdminAddresses.includes(admin.walletAddress.toLowerCase());
        return {
          ...admin,
          isProtected: isEnvSuperAdmin,
          // Ensure env super admins show as super_admin role
          role: isEnvSuperAdmin ? 'super_admin' : (admin.role || 'admin'),
          // Ensure isSuperAdmin flag is set for env admins
          isSuperAdmin: isEnvSuperAdmin || admin.isSuperAdmin
        };
      });
    } catch (error) {
      logger.error('Error getting all admins:', error);
      throw error;
    }
  }

  async getAdminById(adminId: string) {
    try {
      // AdminRepository doesn't have getAdminById, need to get all and filter
      const admins = await adminRepository.getAllAdmins();
      return admins.find(a => a.id.toString() === adminId) || null;
    } catch (error) {
      logger.error('Error getting admin by ID:', error);
      throw error;
    }
  }

  async getAdminByWalletAddress(walletAddress: string) {
    try {
      return await adminRepository.getAdminByWalletAddress(walletAddress);
    } catch (error) {
      logger.error('Error getting admin by wallet address:', error);
      throw error;
    }
  }

  async updateAdmin(adminId: string, updateData: any) {
    try {
      // Get the admin first to get their wallet address
      const admin = await this.getAdminById(adminId);
      if (!admin) {
        throw new Error('Admin not found');
      }
      
      // Prevent updating super admin flag for env super admin
      const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim());
      if (admin?.walletAddress?.toLowerCase() === adminAddresses[0]) {
        delete updateData.isSuperAdmin;
      }
      
      // AdminRepository.updateAdmin expects walletAddress, not adminId
      return await adminRepository.updateAdmin(admin.walletAddress, updateData);
    } catch (error) {
      logger.error('Error updating admin:', error);
      throw error;
    }
  }

  async deleteAdmin(adminId: string) {
    try {
      // Prevent deletion of super admin from env
      const admin = await this.getAdminById(adminId);
      if (!admin) {
        throw new Error('Admin not found');
      }
      
      const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim());
      if (admin?.walletAddress?.toLowerCase() === adminAddresses[0]) {
        throw new Error('Cannot delete the primary super admin');
      }
      
      // AdminRepository.deleteAdmin expects walletAddress, not adminId
      return await adminRepository.deleteAdmin(admin.walletAddress);
    } catch (error) {
      logger.error('Error deleting admin:', error);
      throw error;
    }
  }

  async getAdminProfile(walletAddress: string) {
    try {
      // First check if this is a super admin from .env
      const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim()).filter(addr => addr.length > 0);
      const isSuperAdminFromEnv = adminAddresses.includes(walletAddress.toLowerCase());
      
      if (isSuperAdminFromEnv) {
        // Return super admin profile even if not in database
        const envAddress = adminAddresses.find(addr => addr === walletAddress.toLowerCase()) || walletAddress.toLowerCase();
        return {
          id: 0,
          walletAddress: envAddress,
          name: 'Super Admin',
          email: null,
          role: 'super_admin',
          permissions: ['*'], // All permissions
          isActive: true,
          isSuperAdmin: true,
          isProtected: true, // Mark as protected since it's from env
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
      
      // Get admin from database
      const admin = await this.getAdminByWalletAddress(walletAddress);
      if (!admin) {
        throw new Error('Admin not found');
      }
      
      // Add protected status if this admin is in env list
      return {
        ...admin,
        isProtected: adminAddresses.includes(admin.walletAddress.toLowerCase()),
        role: adminAddresses.includes(admin.walletAddress.toLowerCase()) ? 'super_admin' : (admin.role || 'admin')
      };
    } catch (error) {
      logger.error('Error getting admin profile:', error);
      throw error;
    }
  }

  async getShopsWithPendingMints() {
    try {
      console.log('[PENDING_MINTS_DEBUG] Starting optimized getShopsWithPendingMints');
      
      // First, get all shops with completed purchases in a single query
      let shopsWithPurchasesQuery;
      let usingMintedAt = false;
      
      try {
        // Try with minted_at column first - single query for all shops
        shopsWithPurchasesQuery = await treasuryRepository.query(`
          SELECT 
            s.shop_id,
            s.name,
            s.wallet_address,
            COALESCE(SUM(p.amount), 0) as total_purchased,
            COUNT(p.id) as purchase_count
          FROM shops s
          INNER JOIN shop_rcn_purchases p ON s.shop_id = p.shop_id
          WHERE p.status = 'completed' AND p.minted_at IS NULL
          GROUP BY s.shop_id, s.name, s.wallet_address
          HAVING COALESCE(SUM(p.amount), 0) > 0
        `);
        usingMintedAt = true;
        console.log('[PENDING_MINTS_DEBUG] Using minted_at column for query');
      } catch (error: any) {
        // Fallback if minted_at column doesn't exist
        console.log('[PENDING_MINTS_DEBUG] minted_at column not available, using fallback');
        if (error.message?.includes('minted_at')) {
          shopsWithPurchasesQuery = await treasuryRepository.query(`
            SELECT 
              s.shop_id,
              s.name,
              s.wallet_address,
              COALESCE(SUM(p.amount), 0) as total_purchased,
              COUNT(p.id) as purchase_count
            FROM shops s
            INNER JOIN shop_rcn_purchases p ON s.shop_id = p.shop_id
            WHERE p.status = 'completed'
            GROUP BY s.shop_id, s.name, s.wallet_address
            HAVING COALESCE(SUM(p.amount), 0) > 0
          `);
        } else {
          throw error;
        }
      }
      
      console.log(`[PENDING_MINTS_DEBUG] Found ${shopsWithPurchasesQuery.rows.length} shops with completed purchases`);
      
      // Now check blockchain balances only for shops with purchases
      const shopsWithPendingMints = [];
      const tokenService = new TokenService();
      
      // Check balances in parallel for better performance
      const balanceChecks = shopsWithPurchasesQuery.rows.map(async (shop) => {
        try {
          const totalPurchased = parseFloat(shop.total_purchased);
          const blockchainBalance = await tokenService.getBalance(shop.wallet_address);
          const pendingAmount = totalPurchased - blockchainBalance;
          
          console.log(`[PENDING_MINTS_DEBUG] Shop ${shop.shop_id}: purchased=${totalPurchased}, blockchain=${blockchainBalance}, pending=${pendingAmount}`);
          
          if (pendingAmount > 0) {
            return {
              shop_id: shop.shop_id,
              name: shop.name,
              wallet_address: shop.wallet_address,
              purchased_rcn_balance: totalPurchased,
              blockchain_balance: blockchainBalance,
              pending_mint_amount: pendingAmount
            };
          }
          return null;
        } catch (error) {
          console.error(`[PENDING_MINTS_DEBUG] Error checking balance for shop ${shop.shop_id}:`, error);
          return null;
        }
      });
      
      const results = await Promise.all(balanceChecks);
      const validResults = results.filter(result => result !== null);
      
      console.log(`[PENDING_MINTS_DEBUG] Final result: ${validResults.length} shops with pending mints`);
      console.log('[PENDING_MINTS_DEBUG] Shops with pending mints:', JSON.stringify(validResults, null, 2));
      
      logger.info('Retrieved shops with pending mints', { 
        count: validResults.length 
      });
      
      return validResults;
    } catch (error) {
      console.error('[PENDING_MINTS_DEBUG] Error in getShopsWithPendingMints:', error);
      logger.error('Error getting shops with pending mints:', error);
      throw error;
    }
  }

  async mintShopBalance(shopId: string) {
    const db = treasuryRepository;
    
    // Start atomic transaction to prevent race conditions
    await db.query('BEGIN');
    
    try {
      // Get shop data with row lock to prevent concurrent modifications
      const shopQuery = await db.query(`
        SELECT shop_id, name, wallet_address, active, verified
        FROM shops 
        WHERE shop_id = $1 
        FOR UPDATE
      `, [shopId]);
      
      if (shopQuery.rowCount === 0) {
        throw new Error('Shop not found');
      }
      
      const shop = shopQuery.rows[0];
      
      if (!shop.active || !shop.verified) {
        throw new Error('Shop must be active and verified to mint tokens');
      }

      // Get purchases to mint with row locks to prevent concurrent minting
      let purchasesToMint;
      let hasMintedAtColumn = true;
      
      try {
        // Try with minted_at column first
        purchasesToMint = await db.query(`
          SELECT id, amount, created_at
          FROM shop_rcn_purchases 
          WHERE shop_id = $1 
            AND status = 'completed'
            AND minted_at IS NULL
          FOR UPDATE
        `, [shopId]);
      } catch (error: any) {
        // Fallback if minted_at column doesn't exist
        if (error.message?.includes('minted_at') || error.message?.includes('column')) {
          hasMintedAtColumn = false;
          purchasesToMint = await db.query(`
            SELECT id, amount, created_at
            FROM shop_rcn_purchases 
            WHERE shop_id = $1 
              AND status = 'completed'
            FOR UPDATE
          `, [shopId]);
        } else {
          throw error;
        }
      }
      
      if (purchasesToMint.rowCount === 0) {
        throw new Error('No balance to mint');
      }
      
      const totalToMint = purchasesToMint.rows.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      
      // Get current blockchain balance for verification
      let blockchainBalance = 0;
      try {
        const tokenService = new TokenService();
        blockchainBalance = await tokenService.getBalance(shop.wallet_address);
      } catch (balanceError) {
        logger.warn('Could not fetch blockchain balance for verification', {
          shopId,
          walletAddress: shop.wallet_address,
          error: balanceError
        });
      }
      
      logger.info('Atomic mint operation starting', {
        shopId,
        walletAddress: shop.wallet_address,
        totalToMint,
        purchaseCount: purchasesToMint.rowCount,
        currentBlockchainBalance: blockchainBalance,
        hasMintedAtColumn
      });

      // Mint tokens directly to shop wallet
      const tokenMinter = new TokenMinter();
      const mintResult = await tokenMinter.adminMintTokens(
        shop.wallet_address,
        totalToMint,
        `Shop purchase mint: ${shopId} - ${purchasesToMint.rowCount} purchases`
      );

      if (!mintResult || !mintResult.success) {
        throw new Error(`Minting failed: ${mintResult?.error || 'Unknown error'}`);
      }

      // Mark specific purchases as minted (atomic operation)
      const purchaseIds = purchasesToMint.rows.map(p => p.id);
      
      if (hasMintedAtColumn) {
        // Update with minted_at timestamp and transaction hash
        await db.query(`
          UPDATE shop_rcn_purchases 
          SET 
            minted_at = NOW(),
            transaction_hash = $2
          WHERE 
            id = ANY($1)
            AND shop_id = $3
            AND status = 'completed'
        `, [purchaseIds, mintResult.transactionHash, shopId]);
      } else {
        // Fallback: update status to 'minted'
        await db.query(`
          UPDATE shop_rcn_purchases 
          SET status = 'minted'
          WHERE 
            id = ANY($1)
            AND shop_id = $2
        `, [purchaseIds, shopId]);
      }
      
      // Verify the update affected the expected number of rows
      const verifyQuery = await db.query(`
        SELECT COUNT(*) as updated_count
        FROM shop_rcn_purchases 
        WHERE id = ANY($1)
          AND shop_id = $2
          AND (${hasMintedAtColumn ? 'minted_at IS NOT NULL' : "status = 'minted'"})
      `, [purchaseIds, shopId]);
      
      const updatedCount = parseInt(verifyQuery.rows[0]?.updated_count || '0');
      if (updatedCount !== purchaseIds.length) {
        throw new Error(`Database update verification failed: expected ${purchaseIds.length}, got ${updatedCount}`);
      }

      // Commit the transaction
      await db.query('COMMIT');
      
      logger.info('Atomic mint operation completed successfully', {
        shopId,
        transactionHash: mintResult.transactionHash,
        amountMinted: totalToMint,
        purchasesProcessed: purchaseIds.length,
        newBlockchainBalance: blockchainBalance + totalToMint
      });

      return {
        success: true,
        message: `Successfully minted ${totalToMint} RCN to shop wallet`,
        data: {
          shopId,
          shopName: shop.name,
          amountMinted: totalToMint,
          walletAddress: shop.wallet_address,
          transactionHash: mintResult.transactionHash,
          purchasesProcessed: purchaseIds.length,
          atomicOperation: true
        }
      };
      
    } catch (error) {
      // Rollback transaction on any error
      await db.query('ROLLBACK');
      
      logger.error('Atomic mint operation failed - transaction rolled back:', {
        shopId,
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
}
