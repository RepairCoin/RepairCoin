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
import { cleanupService } from '../../../services/CleanupService';
import { metricsService } from './analytics/MetricsService';
import { platformAnalyticsService } from './analytics/PlatformAnalyticsService';
import { customerManagementService } from './management/CustomerManagementService';
import { shopManagementService } from './management/ShopManagementService';
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
    location?: string;
  }) {
    return shopManagementService.createShop(shopData);
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

  /**
   * Suspend a customer
   * @delegatesTo CustomerManagementService.suspendCustomer
   */
  async suspendCustomer(customerAddress: string, reason?: string, adminAddress?: string) {
    return customerManagementService.suspendCustomer(customerAddress, reason, adminAddress);
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
    return shopManagementService.suspendShop(shopId, reason, adminAddress);
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
