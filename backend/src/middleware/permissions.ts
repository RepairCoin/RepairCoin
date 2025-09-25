// backend/src/middleware/permissions.ts
import { Request, Response, NextFunction } from 'express';
import { ResponseHelper } from '../utils/responseHelper';
import { adminRepository } from '../repositories';
import { logger } from '../utils/logger';

export const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userAddress = req.user?.address;
      
      if (!userAddress) {
        return ResponseHelper.error(res, 'Authentication required', 401);
      }
      
      // Check if this is a super admin from .env (all addresses in ADMIN_ADDRESSES are super admins)
      const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim()).filter(addr => addr.length > 0);
      
      // Any address in ADMIN_ADDRESSES has all permissions
      if (adminAddresses.includes(userAddress.toLowerCase())) {
        return next();
      }
      
      // Get admin from database
      const admin = await adminRepository.getAdmin(userAddress);
      
      if (!admin) {
        return ResponseHelper.error(res, 'Admin not found', 403);
      }
      
      // Check role-based access
      // Super Admin: All permissions
      // Admin: All permissions except admin management
      // Moderator: Read-only permissions
      
      if (admin.isSuperAdmin || admin.role === 'super_admin') {
        return next(); // Super admin has all permissions
      }
      
      if (admin.role === 'admin') {
        // Admin role has all permissions except admin management
        const adminOnlyPermissions = ['manage_admins', 'create_admin', 'delete_admin', 'update_admin'];
        if (!adminOnlyPermissions.includes(permission)) {
          return next();
        }
      }
      
      if (admin.role === 'moderator') {
        // Moderator has read-only permissions
        const readOnlyPermissions = ['view_customers', 'view_shops', 'view_treasury', 'view_analytics', 'view_admins'];
        if (readOnlyPermissions.includes(permission) || permission.startsWith('view_')) {
          return next();
        }
      }
      
      // Fallback to checking individual permissions for backward compatibility
      if (admin.permissions.includes('*') || admin.permissions.includes(permission)) {
        return next();
      }
      
      return ResponseHelper.error(res, `Permission denied. Required permission: ${permission}`, 403);
    } catch (error) {
      logger.error('Permission check failed:', error);
      return ResponseHelper.error(res, 'Permission check failed', 500);
    }
  };
};

export const requireSuperAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userAddress = req.user?.address;
    
    if (!userAddress) {
      return ResponseHelper.error(res, 'Authentication required', 401);
    }
    
    // Check if this is a super admin from .env (all addresses in ADMIN_ADDRESSES are super admins)
    const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim()).filter(addr => addr.length > 0);
    
    // Any address in ADMIN_ADDRESSES is a super admin
    if (adminAddresses.includes(userAddress.toLowerCase())) {
      return next();
    }
    
    // Check database for super admin status
    const admin = await adminRepository.getAdmin(userAddress);
    
    if (!admin || !admin.isSuperAdmin) {
      return ResponseHelper.error(res, 'Super admin access required', 403);
    }
    
    return next();
  } catch (error) {
    logger.error('Super admin check failed:', error);
    return ResponseHelper.error(res, 'Authorization check failed', 500);
  }
};