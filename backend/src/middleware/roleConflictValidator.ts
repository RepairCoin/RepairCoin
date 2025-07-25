// backend/src/middleware/roleConflictValidator.ts
import { Request, Response, NextFunction } from 'express';
import { RoleValidator } from '../utils/roleValidator';
import { logger } from '../utils/logger';

/**
 * Middleware to validate role conflicts during customer registration
 */
export const validateCustomerRoleConflict = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return next(); // Let other validators handle missing walletAddress
    }

    const roleValidation = await RoleValidator.validateCustomerRegistration(walletAddress);
    
    if (!roleValidation.isValid) {
      return res.status(409).json({
        success: false,
        error: roleValidation.message,
        conflictingRole: roleValidation.conflictingRole
      });
    }

    next();
  } catch (error) {
    logger.error('Error in customer role conflict validation middleware:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to validate registration permissions'
    });
  }
};

/**
 * Middleware to validate role conflicts during shop registration
 */
export const validateShopRoleConflict = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return next(); // Let other validators handle missing walletAddress
    }

    const roleValidation = await RoleValidator.validateShopRegistration(walletAddress);
    
    if (!roleValidation.isValid) {
      return res.status(409).json({
        success: false,
        error: roleValidation.message,
        conflictingRole: roleValidation.conflictingRole
      });
    }

    next();
  } catch (error) {
    logger.error('Error in shop role conflict validation middleware:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to validate registration permissions'
    });
  }
};

/**
 * Generic middleware to check current role of a wallet address
 */
export const getCurrentUserRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { walletAddress } = req.body;
    const { address } = req.params;
    
    const addressToCheck = walletAddress || address;
    
    if (!addressToCheck) {
      return next();
    }

    const currentRole = await RoleValidator.getCurrentRole(addressToCheck);
    
    // Attach role information to request for use in subsequent middleware/controllers
    (req as any).currentUserRole = currentRole;
    
    next();
  } catch (error) {
    logger.error('Error getting current user role:', error);
    // Don't fail the request, just continue without role info
    next();
  }
};