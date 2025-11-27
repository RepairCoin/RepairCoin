// backend/src/domains/admin/services/management/AdminManagementService.ts
import { adminRepository } from '../../../../repositories';
import { logger } from '../../../../utils/logger';
import { eventBus, createDomainEvent } from '../../../../events/EventBus';
import { AdminRoleConflictService } from '../../../../services/AdminRoleConflictService';

/**
 * AdminManagementService
 * Handles all admin role and permission management operations
 * Extracted from AdminService for better maintainability
 */
export class AdminManagementService {

  /**
   * Create a new admin
   */
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
      const permissionsModule = await import('../../../../config/permissions');
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
        permissions = roleToPermissions(role as never);
      } else if (!permissions || permissions.length === 0) {
        // Default to admin role if no role or permissions provided
        role = 'admin';
        permissions = roleToPermissions('admin' as never);
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
        'AdminManagementService'
      ));

      logger.info('Admin created successfully', {
        walletAddress: newAdmin.walletAddress,
        role: newAdmin.role
      });

      return {
        success: true,
        message: 'Admin created successfully',
        admin: {
          id: newAdmin.id,
          walletAddress: newAdmin.walletAddress,
          name: newAdmin.name,
          email: newAdmin.email,
          role: newAdmin.role,
          permissions: newAdmin.permissions,
          isActive: newAdmin.isActive,
          createdAt: newAdmin.createdAt
        }
      };
    } catch (error) {
      logger.error('Admin creation error:', error);
      throw error;
    }
  }

  /**
   * Get all admins with active filter
   */
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

  /**
   * Update admin permissions
   */
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
        'AdminManagementService'
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

  /**
   * Check admin access and sync super admin status with environment
   */
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
          }

          try {
            // Auto-create super admin from env
            await adminRepository.createAdmin({
              walletAddress: normalizedAddress,
              name: 'Super Admin',
              role: 'super_admin',
              permissions: ['*'], // All permissions
              isSuperAdmin: true,
              createdBy: 'SYSTEM'
            });

            logger.info('✅ Super admin auto-created from environment', { walletAddress: normalizedAddress });
            return true;
          } catch (createError) {
            logger.error('Failed to auto-create super admin:', createError);
            return false;
          }
        }

        return false;
      }

      // Fallback to environment variable check if repository not available
      const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim());
      return adminAddresses.includes(normalizedAddress);
    } catch (error) {
      logger.error('Error checking admin access:', error);
      return false;
    }
  }

  /**
   * Get all admins including protected status
   */
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

  /**
   * Get admin by ID
   */
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

  /**
   * Get admin by wallet address
   */
  async getAdminByWalletAddress(walletAddress: string) {
    try {
      return await adminRepository.getAdminByWalletAddress(walletAddress);
    } catch (error) {
      logger.error('Error getting admin by wallet address:', error);
      throw error;
    }
  }

  /**
   * Update admin details
   */
  async updateAdmin(adminId: string, updateData: Record<string, unknown>) {
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

  /**
   * Delete admin
   */
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

  /**
   * Get admin profile with protected status
   */
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
}

// Export singleton instance
export const adminManagementService = new AdminManagementService();
