import { adminRepository } from '../repositories';
import { logger } from '../utils/logger';
import { roleToPermissions, AdminRole } from '../config/permissions';

export class AdminSyncService {
  /**
   * Syncs admin addresses from environment variables with the database
   * Automatically creates admin records for new addresses
   * @returns Promise<void>
   */
  async syncAdminsFromEnvironment(): Promise<void> {
    try {
      const adminAddresses = this.parseAdminAddresses();
      const adminNames = this.parseAdminNames();
      
      if (adminAddresses.length === 0) {
        logger.warn('No admin addresses found in ADMIN_ADDRESSES environment variable');
        return;
      }
      
      logger.info(`Syncing ${adminAddresses.length} admin addresses from environment`);
      
      for (let i = 0; i < adminAddresses.length; i++) {
        const address = adminAddresses[i];
        // Use corresponding name if available, otherwise use default or generic name
        const adminName = adminNames[i] || adminNames[0] || `Admin ${i + 1}`;
        await this.syncAdminAddress(address, adminName);
      }
      
      // Clean up admins that were removed from environment
      // Pass false to completely delete them from database
      // Pass true to keep them as regular admins (remove super_admin status only)
      await this.cleanupRemovedAdmins(false);
      
      logger.info('Admin sync completed successfully');
    } catch (error) {
      logger.error('Error syncing admins from environment:', error);
      throw new Error('Failed to sync admin addresses');
    }
  }
  
  /**
   * Parses ADMIN_ADDRESSES environment variable
   * Supports both single address and comma-separated multiple addresses
   * @returns Array of wallet addresses
   */
  private parseAdminAddresses(): string[] {
    const adminAddressesEnv = process.env.ADMIN_ADDRESSES;
    
    if (!adminAddressesEnv) {
      return [];
    }
    
    // Split by comma and clean up each address
    const addresses = adminAddressesEnv
      .split(',')
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0)
      .filter(addr => this.isValidWalletAddress(addr));
    
    return addresses;
  }
  
  /**
   * Parses ADMIN_NAME environment variable
   * Supports both single name and comma-separated multiple names
   * @returns Array of admin names
   */
  private parseAdminNames(): string[] {
    const adminNamesEnv = process.env.ADMIN_NAME || 'System Administrator';
    
    // Split by comma and clean up each name
    const names = adminNamesEnv
      .split(',')
      .map(name => name.trim())
      .filter(name => name.length > 0);
    
    return names;
  }
  
  /**
   * Validates if a string is a valid Ethereum wallet address
   * @param address - The address to validate
   * @returns boolean
   */
  private isValidWalletAddress(address: string): boolean {
    // Check if it starts with 0x and has 40 hex characters after it
    const regex = /^0x[a-fA-F0-9]{40}$/;
    return regex.test(address);
  }
  
  /**
   * Syncs a single admin address with the database
   * Creates a new admin record if it doesn't exist
   * @param walletAddress - The wallet address to sync
   * @param adminName - The name to use for the admin
   */
  private async syncAdminAddress(walletAddress: string, adminName: string): Promise<void> {
    try {
      // Check if admin already exists
      const existingAdmin = await adminRepository.getAdmin(walletAddress);
      
      if (existingAdmin) {
        // Admin exists, check if we need to update super_admin status
        if (!existingAdmin.isSuperAdmin) {
          logger.info(`Updating existing admin ${walletAddress} to super_admin`);
          
          await adminRepository.updateAdmin(walletAddress, {
            isSuperAdmin: true,
            role: AdminRole.SUPER_ADMIN,
            permissions: roleToPermissions(AdminRole.SUPER_ADMIN)
          });
          
          logger.info(`Admin ${walletAddress} updated to super_admin`);
        } else {
          logger.info(`Admin ${walletAddress} already exists as super_admin`);
        }
      } else {
        // Create new super_admin
        logger.info(`Creating new super_admin for address ${walletAddress}`);
        
        const newAdmin = await adminRepository.createAdmin({
          walletAddress,
          name: adminName,
          role: AdminRole.SUPER_ADMIN,
          permissions: roleToPermissions(AdminRole.SUPER_ADMIN),
          isSuperAdmin: true,
          createdBy: 'SYSTEM' // System-created admin
        });
        
        logger.info(`Super admin created successfully for ${walletAddress}`, {
          id: newAdmin.id,
          name: newAdmin.name,
          walletAddress: newAdmin.walletAddress
        });
        
        // Log the admin creation activity
        await adminRepository.logAdminActivity({
          adminAddress: 'SYSTEM',
          actionType: 'admin_creation',
          actionDescription: `System created super_admin from environment: ${adminName}`,
          entityType: 'admin',
          entityId: walletAddress,
          metadata: {
            source: 'environment_sync',
            role: AdminRole.SUPER_ADMIN,
            name: adminName
          }
        });
      }
    } catch (error) {
      logger.error(`Error syncing admin address ${walletAddress}:`, error);
      // Don't throw here to allow other addresses to be processed
      // Just log the error and continue
    }
  }
  
  /**
   * Removes admin privileges from addresses that are no longer in ADMIN_ADDRESSES
   * This ensures that only current environment admins remain as super_admins
   * @param keepActive - If true, keeps them as regular admins; if false, deletes them completely
   */
  async cleanupRemovedAdmins(keepActive: boolean = true): Promise<void> {
    try {
      const envAdminAddresses = this.parseAdminAddresses();
      const allAdmins = await adminRepository.getAllAdmins();
      
      // Find super_admins that are not in the environment anymore
      const adminsToUpdate = allAdmins.filter(admin => 
        admin.isSuperAdmin && 
        !envAdminAddresses.some(envAddr => 
          envAddr.toLowerCase() === admin.walletAddress.toLowerCase()
        )
      );
      
      if (adminsToUpdate.length === 0) {
        logger.info('No admins need to be removed from super_admin role');
        return;
      }
      
      logger.info(`Found ${adminsToUpdate.length} admins to remove from super_admin role`);
      
      for (const admin of adminsToUpdate) {
        if (keepActive) {
          // Downgrade to regular admin
          await adminRepository.updateAdmin(admin.walletAddress, {
            isSuperAdmin: false,
            role: AdminRole.ADMIN,
            permissions: roleToPermissions(AdminRole.ADMIN)
          });
          
          logger.info(`Admin ${admin.walletAddress} downgraded from super_admin to admin`);
          
          // Log the activity
          await adminRepository.logAdminActivity({
            adminAddress: 'SYSTEM',
            actionType: 'admin_update',
            actionDescription: `Removed super_admin privileges (not in environment)`,
            entityType: 'admin',
            entityId: admin.walletAddress,
            metadata: {
              source: 'environment_sync',
              previousRole: AdminRole.SUPER_ADMIN,
              newRole: AdminRole.ADMIN
            }
          });
        } else {
          // Delete the admin completely
          const deleted = await adminRepository.deleteAdmin(admin.walletAddress);
          
          if (deleted) {
            logger.info(`Admin ${admin.walletAddress} deleted (removed from environment)`);
            
            // Log the activity
            await adminRepository.logAdminActivity({
              adminAddress: 'SYSTEM',
              actionType: 'admin_deletion',
              actionDescription: `Deleted admin (removed from environment)`,
              entityType: 'admin',
              entityId: admin.walletAddress,
              metadata: {
                source: 'environment_sync',
                previousRole: AdminRole.SUPER_ADMIN,
                name: admin.name
              }
            });
          } else {
            logger.warn(`Failed to delete admin ${admin.walletAddress}`);
          }
        }
      }
      
      logger.info('Cleanup of removed admins completed');
    } catch (error) {
      logger.error('Error cleaning up removed admins:', error);
      // Don't throw - this is a cleanup operation that shouldn't break the app
    }
  }
  
  /**
   * Gets a summary of the current admin sync status
   * Useful for logging and debugging
   */
  async getSyncStatus(): Promise<{
    envAdmins: string[];
    dbAdmins: Array<{ walletAddress: string; isSuperAdmin: boolean; isActive: boolean }>;
    syncNeeded: string[];
    toRemove: string[];
  }> {
    const envAdmins = this.parseAdminAddresses();
    const allAdmins = await adminRepository.getAllAdmins();
    
    const dbAdmins = allAdmins.map(admin => ({
      walletAddress: admin.walletAddress,
      isSuperAdmin: admin.isSuperAdmin,
      isActive: admin.isActive
    }));
    
    // Find addresses that need to be synced (in env but not in db as super_admin)
    const syncNeeded = envAdmins.filter(envAddr => 
      !allAdmins.some(dbAdmin => 
        dbAdmin.walletAddress.toLowerCase() === envAddr.toLowerCase() && 
        dbAdmin.isSuperAdmin
      )
    );
    
    // Find addresses that should be removed from super_admin
    const toRemove = allAdmins
      .filter(admin => 
        admin.isSuperAdmin && 
        !envAdmins.some(envAddr => 
          envAddr.toLowerCase() === admin.walletAddress.toLowerCase()
        )
      )
      .map(admin => admin.walletAddress);
    
    return {
      envAdmins,
      dbAdmins,
      syncNeeded,
      toRemove
    };
  }
}

// Export a singleton instance
export const adminSyncService = new AdminSyncService();