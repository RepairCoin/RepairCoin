// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { databaseService } from '../services/DatabaseService';

interface JWTPayload {
  address: string;
  role: 'admin' | 'shop' | 'customer';
  shopId?: string;
  iat: number;
  exp: number;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        address: string;
        role: string;
        shopId?: string;
      };
    }
  }
}

// Main authentication middleware
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      logger.security('Authentication attempt without authorization header', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      return res.status(401).json({
        success: false,
        error: 'Authorization header required',
        code: 'MISSING_AUTH_HEADER'
      });
    }
    
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;
    
    if (!token) {
      logger.security('Authentication attempt with malformed authorization header', {
        ip: req.ip,
        authHeader: authHeader.substring(0, 20) + '...'
      });
      
      return res.status(401).json({
        success: false,
        error: 'Bearer token required',
        code: 'MALFORMED_AUTH_HEADER'
      });
    }
    
    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET not configured');
      return res.status(500).json({
        success: false,
        error: 'Authentication service not configured',
        code: 'AUTH_SERVICE_ERROR'
      });
    }
    
    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    } catch (jwtError: any) {
      logger.security('Invalid JWT token', {
        ip: req.ip,
        error: jwtError.message,
        tokenLength: token.length
      });
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    // Validate token payload
    if (!decoded.address || !decoded.role) {
      logger.security('JWT token missing required fields', {
        ip: req.ip,
        tokenPayload: { address: !!decoded.address, role: !!decoded.role }
      });
      
      return res.status(401).json({
        success: false,
        error: 'Invalid token payload',
        code: 'INVALID_TOKEN_PAYLOAD'
      });
    }
    
    // Additional validation based on role
    if (decoded.role === 'shop' && !decoded.shopId) {
      logger.security('Shop role token missing shopId', {
        ip: req.ip,
        address: decoded.address
      });
      
      return res.status(401).json({
        success: false,
        error: 'Shop token missing shop ID',
        code: 'MISSING_SHOP_ID'
      });
    }
    
    // Verify user/shop exists in database
    const isValid = await validateUserInDatabase(decoded);
    if (!isValid) {
      logger.security('Token for non-existent or inactive user', {
        ip: req.ip,
        address: decoded.address,
        role: decoded.role,
        shopId: decoded.shopId
      });
      
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Set user in request object
    req.user = {
      address: decoded.address,
      role: decoded.role,
      shopId: decoded.shopId
    };
    
    logger.info(`Authenticated ${decoded.role}: ${decoded.address}`, {
      path: req.path,
      method: req.method,
      shopId: decoded.shopId
    });
    
    next();
    
  } catch (error: any) {
    logger.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
};

// Role-based authorization middleware
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      logger.security('Insufficient permissions', {
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        address: req.user.address,
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: allowedRoles,
        current: req.user.role
      });
    }
    
    next();
  };
};

// Admin-only middleware
export const requireAdmin = requireRole(['admin']);

// Shop or admin middleware
export const requireShopOrAdmin = requireRole(['shop', 'admin']);

// Validate shop ownership for shop-specific operations
export const requireShopOwnership = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  // Admin can access any shop
  if (req.user.role === 'admin') {
    return next();
  }
  
  // For shop role, check if they own the shop
  if (req.user.role === 'shop') {
    const requestedShopId = req.params.shopId || req.body.shopId;
    
    if (!requestedShopId) {
      return res.status(400).json({
        success: false,
        error: 'Shop ID required',
        code: 'SHOP_ID_REQUIRED'
      });
    }
    
    if (req.user.shopId !== requestedShopId) {
      logger.security('Shop attempting to access another shop\'s data', {
        userShopId: req.user.shopId,
        requestedShopId,
        address: req.user.address,
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
        error: 'Cannot access other shop\'s data',
        code: 'SHOP_ACCESS_DENIED'
      });
    }
  }
  
  next();
};

// Rate limiting for sensitive operations
export const sensitiveOperationLimit = (req: Request, res: Response, next: NextFunction) => {
  // This would integrate with Redis or in-memory store for rate limiting
  // For now, just log sensitive operations
  logger.security('Sensitive operation attempted', {
    user: req.user?.address,
    role: req.user?.role,
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  
  next();
};

// Validate user exists in database
async function validateUserInDatabase(tokenPayload: JWTPayload): Promise<boolean> {
  try {
    switch (tokenPayload.role) {
      case 'admin':
        // Check if address is in admin list (could be environment variable or database)
        const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim());
        return adminAddresses.includes(tokenPayload.address.toLowerCase());
        
      case 'shop':
        if (!tokenPayload.shopId) return false;
        const shop = await databaseService.getShop(tokenPayload.shopId);
        return shop !== null && 
               shop.active && 
               shop.verified && 
               shop.walletAddress.toLowerCase() === tokenPayload.address.toLowerCase();
        
      case 'customer':
        const customer = await databaseService.getCustomer(tokenPayload.address);
        return customer !== null && customer.isActive;
        
      default:
        return false;
    }
  } catch (error) {
    logger.error('Error validating user in database:', error);
    return false;
  }
}

// JWT token generation utility
export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }
  
  return jwt.sign(payload, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    issuer: 'repaircoin-api',
    audience: 'repaircoin-users'
  } as jwt.SignOptions);
};

// Token refresh utility
export const refreshToken = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required for token refresh',
      code: 'AUTH_REQUIRED'
    });
  }
  
  try {
    const newToken = generateToken({
      address: req.user.address,
      role: req.user.role as any,
      shopId: req.user.shopId
    });
    
    res.json({
      success: true,
      token: newToken,
      user: req.user
    });
  } catch (error: any) {
    logger.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Token refresh failed',
      code: 'TOKEN_REFRESH_ERROR'
    });
  }
};