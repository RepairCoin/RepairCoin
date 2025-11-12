// backend/src/domains/admin/services/AdminService.ts
import {
  customerRepository,
  shopRepository,
  transactionRepository,
  adminRepository,
  webhookRepository,
  treasuryRepository,
  refreshTokenRepository
} from '../../../repositories';
import { TokenMinter } from '../../../contracts/TokenMinter';
import { TierManager, CustomerData, TierLevel } from '../../../contracts/TierManager';
import { logger } from '../../../utils/logger';
import { eventBus, createDomainEvent } from '../../../events/EventBus';
import { TokenService } from '../../token/services/TokenService';
import { AdminRoleConflictService } from '../../../services/AdminRoleConflictService';
import { cleanupService } from '../../../services/CleanupService';
import { metricsService } from './analytics/MetricsService';
import { platformAnalyticsService } from './analytics/PlatformAnalyticsService';
import { customerManagementService } from './management/CustomerManagementService';
import { shopManagementService } from './management/ShopManagementService';
import { adminManagementService } from './management/AdminManagementService';
import { tokenOperationsService } from './operations/TokenOperationsService';
import { contractOperationsService } from './operations/ContractOperationsService';
import { maintenanceService } from './maintenance/MaintenanceService';

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

  /**
   * Get customers with pagination
   * @delegatesTo CustomerManagementService.getCustomers
   */
  async getCustomers(params: PaginationParams) {
    return customerManagementService.getCustomers(params);
  }

  /**
   * Get shops with pagination
   * @delegatesTo ShopManagementService.getShops
   */
  async getShops(filters: ShopFilters) {
    return shopManagementService.getShops(filters);
  }

  /**
   * Manually mint tokens to a customer
   * @delegatesTo TokenOperationsService.manualMint
   */
  async manualMint(params: ManualMintParams) {
    return tokenOperationsService.manualMint(params);
  }

  /**
   * Pause the contract
   * @delegatesTo ContractOperationsService.pauseContract
   */
  async pauseContract(adminAddress?: string) {
    return contractOperationsService.pauseContract(adminAddress);
  }

  /**
   * Unpause the contract
   * @delegatesTo ContractOperationsService.unpauseContract
   */
  async unpauseContract(adminAddress?: string) {
    return contractOperationsService.unpauseContract(adminAddress);
  }

  /**
   * Get contract status
   * @delegatesTo ContractOperationsService.getContractStatus
   */
  async getContractStatus() {
    return contractOperationsService.getContractStatus();
  }

  /**
   * Emergency stop - immediately pause the contract
   * @delegatesTo ContractOperationsService.emergencyStop
   */
  async emergencyStop(adminAddress?: string, reason?: string) {
    return contractOperationsService.emergencyStop(adminAddress, reason);
  }

  /**
   * Process manual redemption
   * @delegatesTo TokenOperationsService.processManualRedemption
   */
  async processManualRedemption(params: {
    customerAddress: string;
    amount: number;
    shopId: string;
    adminAddress?: string;
    reason?: string;
    forceProcess?: boolean;
  }) {
    return tokenOperationsService.processManualRedemption(params);
  }

  /**
   * Approve a shop
   * @delegatesTo ShopManagementService.approveShop
   */
  async approveShop(shopId: string, adminAddress?: string) {
    return shopManagementService.approveShop(shopId, adminAddress);
  }

  /**
   * Sell RCN tokens to a shop
   * @delegatesTo TokenOperationsService.sellRcnToShop
   */
  async sellRcnToShop(params: SellRcnParams) {
    return tokenOperationsService.sellRcnToShop(params);
  }

  /**
   * Get failed webhooks
   * @delegatesTo MaintenanceService.getFailedWebhooks
   */
  async getFailedWebhooks(limit: number = 20) {
    return maintenanceService.getFailedWebhooks(limit);
  }

  /**
   * Cleanup webhook logs
   * @delegatesTo MaintenanceService.cleanupWebhookLogs
   */
  async cleanupWebhookLogs(daysOld: number = 30) {
    return maintenanceService.cleanupWebhookLogs(daysOld);
  }

  /**
   * Archive old transactions
   * @delegatesTo MaintenanceService.archiveTransactions
   */
  async archiveTransactions(daysOld: number = 365) {
    return maintenanceService.archiveTransactions(daysOld);
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

  /**
   * Check system health monitoring
   * @delegatesTo PlatformAnalyticsService.checkSystemHealth
   */
  async checkSystemHealth() {
    return platformAnalyticsService.checkSystemHealth();
  }

  /**
   * Get real-time platform statistics with system health
   * @delegatesTo PlatformAnalyticsService.getRealTimePlatformStats
   */
  async getRealTimePlatformStats() {
    return platformAnalyticsService.getRealTimePlatformStats(
      () => this.getPlatformStatistics()
    );
  }

  /**
   * Get recent system alerts
   * @delegatesTo PlatformAnalyticsService.getRecentAlerts
   */
  async getRecentAlerts(limit: number = 50) {
    return platformAnalyticsService.getRecentAlerts(limit);
  }

  /**
   * Get system performance metrics
   * @delegatesTo PlatformAnalyticsService.getPerformanceMetrics
   */
  async getPerformanceMetrics() {
    return platformAnalyticsService.getPerformanceMetrics();
  }

  /**
   * Create a new shop
   * @delegatesTo ShopManagementService.createShop
   */
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
    return shopManagementService.createShop(shopData);
  }

  /**
   * Create a new admin
   * @delegatesTo AdminManagementService.createAdmin
   */
  async createAdmin(adminData: {
    walletAddress: string;
    name?: string;
    email?: string;
    role?: string;
    permissions?: string[];
    createdBy?: string
  }) {
    return adminManagementService.createAdmin(adminData);
  }

  /**
   * Suspend a customer
   * @delegatesTo CustomerManagementService.suspendCustomer
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

      // Revoke all active sessions for this customer
      const revokedCount = await refreshTokenRepository.revokeAllUserTokens(
        customerAddress,
        `Customer suspended: ${reason || 'No reason provided'}`,
        true // revokedByAdmin flag
      );

      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: adminAddress || 'system',
        actionType: 'customer_suspension',
        actionDescription: `Suspended customer: ${reason || 'No reason provided'}`,
        entityType: 'customer',
        entityId: customerAddress,
        metadata: { reason, sessionsRevoked: revokedCount }
      });

      logger.info('Customer suspended', { customerAddress, reason, adminAddress, sessionsRevoked: revokedCount });
      await customerManagementService.suspendCustomer(customerAddress, reason, adminAddress);

      return {
        success: true,
        message: 'Customer suspended successfully',
        customer: {
          address: customerAddress,
          isActive: false,
          suspendedAt: new Date().toISOString()
        },
        sessionsRevoked: revokedCount
      };
    } catch (error) {
      logger.error('Customer suspension error:', error);
      throw error;
    }
  }

  /**
   * Unsuspend a customer
   * @delegatesTo CustomerManagementService.unsuspendCustomer
   */
  async unsuspendCustomer(customerAddress: string, adminAddress?: string) {
    return customerManagementService.unsuspendCustomer(customerAddress, adminAddress);
  }

  /**
   * Suspend a shop
   * @delegatesTo ShopManagementService.suspendShop
   */
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

      // Revoke all active sessions for this shop
      const revokedCount = await refreshTokenRepository.revokeAllShopTokens(
        shopId,
        `Shop suspended: ${reason || 'No reason provided'}`,
        true // revokedByAdmin flag (default is already true, but being explicit)
      );

      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: adminAddress || 'system',
        actionType: 'shop_suspension',
        actionDescription: `Suspended shop: ${reason || 'No reason provided'}`,
        entityType: 'shop',
        entityId: shopId,
        metadata: {
          shopName: shop.name,
          reason,
          sessionsRevoked: revokedCount
        }
      });

      logger.info('Shop suspended', { shopId, reason, adminAddress, sessionsRevoked: revokedCount });
      await shopManagementService.suspendShop(shopId, reason, adminAddress);
      return {
        success: true,
        message: 'Shop suspended successfully',
        shop: {
          shopId,
          active: false,
          suspendedAt: new Date().toISOString()
        },
        sessionsRevoked: revokedCount
      };
    } catch (error) {
      logger.error('Shop suspension error:', error);
      throw error;
    }

  }

  /**
   * Unsuspend a shop
   * @delegatesTo ShopManagementService.unsuspendShop
   */
  async unsuspendShop(shopId: string, adminAddress?: string) {
    return shopManagementService.unsuspendShop(shopId, adminAddress);
  }

  /**
   * Update shop details
   * @delegatesTo ShopManagementService.updateShop
   */
  async updateShop(shopId: string, updates: Record<string, unknown>, adminAddress?: string) {
    return shopManagementService.updateShop(shopId, updates, adminAddress);
  }

  /**
   * Verify a shop
   * @delegatesTo ShopManagementService.verifyShop
   */
  async verifyShop(shopId: string, adminAddress?: string) {
    return shopManagementService.verifyShop(shopId, adminAddress);
  }

  /**
   * Get unsuspend requests
   * @delegatesTo ShopManagementService.getUnsuspendRequests
   */
  async getUnsuspendRequests(filters: { status?: string; entityType?: string }) {
    return shopManagementService.getUnsuspendRequests(filters);
  }

  /**
   * Approve unsuspend request
   * @delegatesTo ShopManagementService.approveUnsuspendRequest
   */
  async approveUnsuspendRequest(requestId: number, adminAddress?: string, notes?: string) {
    return shopManagementService.approveUnsuspendRequest(requestId, adminAddress, notes);
  }

  /**
   * Reject unsuspend request
   * @delegatesTo ShopManagementService.rejectUnsuspendRequest
   */
  async rejectUnsuspendRequest(requestId: number, adminAddress?: string, notes?: string) {
    return shopManagementService.rejectUnsuspendRequest(requestId, adminAddress, notes);
  }

  /**
   * Get all admins with active filter
   * @delegatesTo AdminManagementService.getAdmins
   */
  async getAdmins() {
    return adminManagementService.getAdmins();
  }

  /**
 * Update admin permissions
 * @delegatesTo AdminManagementService.updateAdminPermissions
 */
  async updateAdminPermissions(walletAddress: string, permissions: string[], updatedBy?: string) {
    return adminManagementService.updateAdminPermissions(walletAddress, permissions, updatedBy);
  }

  /**
 * Check admin access
 * @delegatesTo AdminManagementService.checkAdminAccess
 */
  async checkAdminAccess(walletAddress: string): Promise<boolean> {
    return adminManagementService.checkAdminAccess(walletAddress);
  }

  // Admin Management Methods

  /**
   * Get all admins including protected status
   * @delegatesTo AdminManagementService.getAllAdmins
   */
  async getAllAdmins() {
    return adminManagementService.getAllAdmins();
  }

  /**
   * Get admin by ID
   * @delegatesTo AdminManagementService.getAdminById
   */
  async getAdminById(adminId: string) {
    return adminManagementService.getAdminById(adminId);
  }

  /**
   * Get admin by wallet address
   * @delegatesTo AdminManagementService.getAdminByWalletAddress
   */
  async getAdminByWalletAddress(walletAddress: string) {
    return adminManagementService.getAdminByWalletAddress(walletAddress);
  }

  /**
   * Update admin details
   * @delegatesTo AdminManagementService.updateAdmin
   */
  async updateAdmin(adminId: string, updateData: Record<string, unknown>) {
    return adminManagementService.updateAdmin(adminId, updateData);
  }

  /**
   * Delete admin
   * @delegatesTo AdminManagementService.deleteAdmin
   */
  async deleteAdmin(adminId: string) {
    return adminManagementService.deleteAdmin(adminId);
  }

  /**
   * Get admin profile with protected status
   * @delegatesTo AdminManagementService.getAdminProfile
   */
  async getAdminProfile(walletAddress: string) {
    return adminManagementService.getAdminProfile(walletAddress);
  }

  /**
   * Get shops with pending mints
   * @delegatesTo TokenOperationsService.getShopsWithPendingMints
   */
  async getShopsWithPendingMints() {
    return tokenOperationsService.getShopsWithPendingMints();
  }

  /**
   * Mint shop balance
   * @delegatesTo TokenOperationsService.mintShopBalance
   */
  async mintShopBalance(shopId: string) {
    return tokenOperationsService.mintShopBalance(shopId);
  }

  // ============================================================================
  // Enhanced Analytics Methods (Delegated to MetricsService)
  // ============================================================================

  /**
   * Get comprehensive shop metrics including tier distribution and growth
   * @delegatesTo MetricsService.getShopMetrics
   */
  async getShopMetrics() {
    return metricsService.getShopMetrics();
  }

  /**
   * Get comprehensive customer metrics including tier distribution, referrals, and activity
   * @delegatesTo MetricsService.getCustomerMetrics
   */
  async getCustomerMetrics() {
    return metricsService.getCustomerMetrics();
  }

  /**
   * Get revenue metrics from RCN sales and subscriptions
   * @delegatesTo MetricsService.getRevenueMetrics
   */
  async getRevenueMetrics() {
    return metricsService.getRevenueMetrics();
  }

  /**
   * Get token metrics including circulation, minting, and redemption data
   * @delegatesTo MetricsService.getTokenMetrics
   */
  async getTokenMetrics() {
    return metricsService.getTokenMetrics();
  }
}
