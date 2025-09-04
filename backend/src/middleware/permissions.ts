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
      
      // Check if this is the super admin from .env (first address in ADMIN_ADDRESSES)
      const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim());
      const superAdminAddress = adminAddresses[0];
      
      // Super admin has all permissions
      if (superAdminAddress === userAddress.toLowerCase()) {
        return next();
      }
      
      // Get admin from database
      const admin = await adminRepository.getAdmin(userAddress);
      
      if (!admin) {
        return ResponseHelper.error(res, 'Admin not found', 403);
      }
      
      // Check if admin is super admin or has the required permission
      if (admin.isSuperAdmin || admin.permissions.includes('*') || admin.permissions.includes(permission)) {
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
    
    // Check if this is the super admin from .env
    const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim());
    const superAdminAddress = adminAddresses[0];
    
    if (superAdminAddress === userAddress.toLowerCase()) {
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