/**
 * Admin Management Routes
 * Handles creation, updating, and deletion of admin accounts
 * with proper permission checks based on role hierarchy
 */

import { Router, Request, Response } from 'express';
import { adminRepository } from '../../../repositories';
import { AdminService } from '../services/AdminService';
import { logger } from '../../../utils/logger';
import { 
  AdminRole, 
  Permission, 
  hasPermission, 
  getRoleFromPermissions,
  roleToPermissions 
} from '../../../config/permissions';

const router = Router();
const adminService = new AdminService();

/**
 * Get all admins
 * Required permission: VIEW_ADMINS (all roles can view)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const currentAdmin = await adminRepository.getAdminByWalletAddress(req.user?.address);
    
    if (!currentAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const userRole = currentAdmin.role || getRoleFromPermissions(currentAdmin.permissions, currentAdmin.isSuperAdmin);
    
    if (!hasPermission(userRole, Permission.VIEW_ADMINS)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: Permission.VIEW_ADMINS 
      });
    }
    
    const admins = await adminRepository.getAllAdmins();
    
    // Filter sensitive data for non-super admins
    const sanitizedAdmins = admins.map(admin => ({
      id: admin.id,
      walletAddress: admin.walletAddress,
      name: admin.name,
      email: admin.email,
      role: admin.role || (admin.isSuperAdmin ? AdminRole.SUPER_ADMIN : AdminRole.ADMIN),
      isActive: admin.isActive,
      isSuperAdmin: admin.isSuperAdmin,
      createdAt: admin.createdAt,
      lastLogin: admin.lastLogin
    }));
    
    res.json({
      success: true,
      admins: sanitizedAdmins,
      count: sanitizedAdmins.length
    });
  } catch (error) {
    logger.error('Error fetching admins:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

/**
 * Create a new admin
 * Required permission: CREATE_ADMIN (super admin only)
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const currentAdmin = await adminRepository.getAdminByWalletAddress(req.user?.address);
    
    if (!currentAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const userRole = currentAdmin.role || getRoleFromPermissions(currentAdmin.permissions, currentAdmin.isSuperAdmin);
    
    if (!hasPermission(userRole, Permission.CREATE_ADMIN)) {
      return res.status(403).json({ 
        error: 'Only super admins can create new admins',
        required: Permission.CREATE_ADMIN,
        userRole 
      });
    }
    
    const { walletAddress, name, email, role } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }
    
    // Validate role
    const validRoles = [AdminRole.ADMIN, AdminRole.MODERATOR];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role. Valid roles are: admin, moderator',
        note: 'Only the system can create super_admin through .env configuration'
      });
    }
    
    // Check if admin already exists
    const existingAdmin = await adminRepository.getAdmin(walletAddress);
    if (existingAdmin) {
      return res.status(409).json({ error: 'Admin already exists' });
    }
    
    // Create the admin with appropriate permissions
    const adminRole = role || AdminRole.ADMIN;
    const permissions = roleToPermissions(adminRole as AdminRole);
    
    const newAdmin = await adminRepository.createAdmin({
      walletAddress,
      name: name || 'Administrator',
      email,
      role: adminRole,
      permissions,
      isSuperAdmin: false, // Only env can create super admins
      createdBy: currentAdmin.walletAddress
    });
    
    // Log the activity
    await adminRepository.logAdminActivity({
      adminAddress: currentAdmin.walletAddress,
      actionType: 'admin_creation',
      actionDescription: `Created new ${adminRole}: ${name || walletAddress}`,
      entityType: 'admin',
      entityId: walletAddress,
      metadata: { role: adminRole, name, email }
    });
    
    logger.info('Admin created', {
      createdBy: currentAdmin.walletAddress,
      newAdmin: walletAddress,
      role: adminRole
    });
    
    res.json({
      success: true,
      message: `${adminRole} created successfully`,
      admin: {
        id: newAdmin.id,
        walletAddress: newAdmin.walletAddress,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role,
        isActive: newAdmin.isActive
      }
    });
  } catch (error) {
    logger.error('Error creating admin:', error);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

/**
 * Update an admin
 * Required permission: UPDATE_ADMIN (super admin and admin)
 */
router.put('/:walletAddress', async (req: Request, res: Response) => {
  try {
    const currentAdmin = await adminRepository.getAdminByWalletAddress(req.user?.address);
    const targetAddress = req.params.walletAddress;
    
    if (!currentAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const userRole = currentAdmin.role || getRoleFromPermissions(currentAdmin.permissions, currentAdmin.isSuperAdmin);
    
    if (!hasPermission(userRole, Permission.UPDATE_ADMIN)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions to update admin',
        required: Permission.UPDATE_ADMIN,
        userRole 
      });
    }
    
    // Get target admin
    const targetAdmin = await adminRepository.getAdmin(targetAddress);
    if (!targetAdmin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    
    const { name, email, role, isActive } = req.body;
    
    // Only super admins can change roles
    if (role && userRole !== AdminRole.SUPER_ADMIN) {
      return res.status(403).json({ 
        error: 'Only super admins can change roles' 
      });
    }
    
    // Prevent changing super admin role
    if (targetAdmin.isSuperAdmin && role && role !== AdminRole.SUPER_ADMIN) {
      return res.status(403).json({ 
        error: 'Cannot change super admin role. Super admin is controlled by .env configuration' 
      });
    }
    
    // Prevent creating super admin through update
    if (role === AdminRole.SUPER_ADMIN && !targetAdmin.isSuperAdmin) {
      return res.status(403).json({ 
        error: 'Cannot promote to super admin. Super admin is controlled by .env configuration' 
      });
    }
    
    // Build update object
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (isActive !== undefined) updates.isActive = isActive;
    
    if (role && role !== targetAdmin.role) {
      updates.role = role;
      updates.permissions = roleToPermissions(role as AdminRole);
    }
    
    const updatedAdmin = await adminRepository.updateAdmin(targetAddress, updates);
    
    // Log the activity
    await adminRepository.logAdminActivity({
      adminAddress: currentAdmin.walletAddress,
      actionType: 'admin_update',
      actionDescription: `Updated admin: ${targetAdmin.name || targetAddress}`,
      entityType: 'admin',
      entityId: targetAddress,
      metadata: updates
    });
    
    logger.info('Admin updated', {
      updatedBy: currentAdmin.walletAddress,
      targetAdmin: targetAddress,
      updates
    });
    
    res.json({
      success: true,
      message: 'Admin updated successfully',
      admin: updatedAdmin
    });
  } catch (error) {
    logger.error('Error updating admin:', error);
    res.status(500).json({ error: 'Failed to update admin' });
  }
});

/**
 * Delete an admin
 * Required permission: DELETE_ADMIN (super admin only)
 */
router.delete('/:walletAddress', async (req: Request, res: Response) => {
  try {
    const currentAdmin = await adminRepository.getAdminByWalletAddress(req.user?.address);
    const targetAddress = req.params.walletAddress;
    
    if (!currentAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const userRole = currentAdmin.role || getRoleFromPermissions(currentAdmin.permissions, currentAdmin.isSuperAdmin);
    
    if (!hasPermission(userRole, Permission.DELETE_ADMIN)) {
      return res.status(403).json({ 
        error: 'Only super admins can delete admins',
        required: Permission.DELETE_ADMIN,
        userRole 
      });
    }
    
    // Prevent self-deletion
    if (currentAdmin.walletAddress.toLowerCase() === targetAddress.toLowerCase()) {
      return res.status(400).json({ error: 'Cannot delete your own admin account' });
    }
    
    // Get target admin
    const targetAdmin = await adminRepository.getAdmin(targetAddress);
    if (!targetAdmin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    
    // Prevent deleting super admin
    if (targetAdmin.isSuperAdmin) {
      return res.status(403).json({ 
        error: 'Cannot delete super admin. Super admin is controlled by .env configuration' 
      });
    }
    
    // Delete the admin
    const deleted = await adminRepository.deleteAdmin(targetAddress);
    
    if (!deleted) {
      return res.status(500).json({ error: 'Failed to delete admin' });
    }
    
    // Log the activity
    await adminRepository.logAdminActivity({
      adminAddress: currentAdmin.walletAddress,
      actionType: 'admin_deletion',
      actionDescription: `Deleted admin: ${targetAdmin.name || targetAddress}`,
      entityType: 'admin',
      entityId: targetAddress,
      metadata: {
        deletedAdmin: {
          name: targetAdmin.name,
          role: targetAdmin.role,
          email: targetAdmin.email
        }
      }
    });
    
    logger.info('Admin deleted', {
      deletedBy: currentAdmin.walletAddress,
      targetAdmin: targetAddress
    });
    
    res.json({
      success: true,
      message: 'Admin deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting admin:', error);
    res.status(500).json({ error: 'Failed to delete admin' });
  }
});

/**
 * Update admin role (convenience endpoint)
 * Required permission: CREATE_ADMIN (super admin only)
 */
router.patch('/:walletAddress/role', async (req: Request, res: Response) => {
  try {
    const currentAdmin = await adminRepository.getAdminByWalletAddress(req.user?.address);
    const targetAddress = req.params.walletAddress;
    const { role } = req.body;
    
    if (!currentAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const userRole = currentAdmin.role || getRoleFromPermissions(currentAdmin.permissions, currentAdmin.isSuperAdmin);
    
    // Only super admin can change roles
    if (userRole !== AdminRole.SUPER_ADMIN) {
      return res.status(403).json({ 
        error: 'Only super admins can change admin roles',
        userRole 
      });
    }
    
    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }
    
    const validRoles = [AdminRole.ADMIN, AdminRole.MODERATOR];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role. Valid roles are: admin, moderator' 
      });
    }
    
    // Get target admin
    const targetAdmin = await adminRepository.getAdmin(targetAddress);
    if (!targetAdmin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    
    // Prevent changing super admin role
    if (targetAdmin.isSuperAdmin) {
      return res.status(403).json({ 
        error: 'Cannot change super admin role' 
      });
    }
    
    // Update role and permissions
    const permissions = roleToPermissions(role as AdminRole);
    const updatedAdmin = await adminRepository.updateAdmin(targetAddress, {
      role,
      permissions
    });
    
    // Log the activity
    await adminRepository.logAdminActivity({
      adminAddress: currentAdmin.walletAddress,
      actionType: 'role_change',
      actionDescription: `Changed role from ${targetAdmin.role} to ${role} for ${targetAdmin.name || targetAddress}`,
      entityType: 'admin',
      entityId: targetAddress,
      metadata: {
        oldRole: targetAdmin.role,
        newRole: role
      }
    });
    
    logger.info('Admin role changed', {
      changedBy: currentAdmin.walletAddress,
      targetAdmin: targetAddress,
      oldRole: targetAdmin.role,
      newRole: role
    });
    
    res.json({
      success: true,
      message: `Role changed to ${role} successfully`,
      admin: updatedAdmin
    });
  } catch (error) {
    logger.error('Error changing admin role:', error);
    res.status(500).json({ error: 'Failed to change admin role' });
  }
});

export default router;