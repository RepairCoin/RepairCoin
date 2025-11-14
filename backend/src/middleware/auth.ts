// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { customerRepository, shopRepository, adminRepository } from '../repositories';
import { AdminService } from '../domains/admin/services/AdminService';
import { RefreshTokenRepository } from '../repositories/RefreshTokenRepository';

interface BaseJWTPayload {
  address: string;
  role: 'admin' | 'shop' | 'customer';
  shopId?: string;
  iat: number;
  exp: number;
}

interface AccessTokenPayload extends BaseJWTPayload {
  type: 'access';
}

interface RefreshTokenPayload extends BaseJWTPayload {
  type: 'refresh';
  tokenId: string; // Unique identifier for revocation
}

type JWTPayload = AccessTokenPayload | RefreshTokenPayload;

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
    // Try to get token from cookies first (preferred method)
    let token = req.cookies?.auth_token;

    // Fallback to Authorization header for backward compatibility
    if (!token) {
      const authHeader = req.headers.authorization;

      if (authHeader) {
        token = authHeader.startsWith('Bearer ')
          ? authHeader.slice(7)
          : authHeader;
      }
    }

    // If no token found in either location
    if (!token) {
      logger.security('Authentication attempt without token', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        hasCookie: !!req.cookies?.auth_token,
        hasAuthHeader: !!req.headers.authorization,
        // Additional debugging info for cookie issues
        origin: req.get('origin'),
        referer: req.get('referer'),
        cookieHeader: req.get('cookie'),
        allCookies: req.cookies,
        hasRefreshToken: !!req.cookies?.refresh_token
      });

      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'MISSING_AUTH_TOKEN'
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

      // If access token is expired, attempt to refresh it automatically
      if (jwtError.name === 'TokenExpiredError') {
        logger.info('Access token expired, attempting automatic refresh...');

        // Check if refresh token exists
        const refreshToken = req.cookies?.refresh_token;

        if (!refreshToken) {
          logger.info('No refresh token found, cannot auto-refresh');
          return res.status(401).json({
            success: false,
            error: 'Token expired',
            code: 'TOKEN_EXPIRED'
          });
        }

        try {
          // Decode refresh token (without verification to get tokenId)
          const refreshDecoded = jwt.decode(refreshToken) as RefreshTokenPayload;

          if (!refreshDecoded || !refreshDecoded.tokenId || refreshDecoded.type !== 'refresh') {
            logger.warn('Invalid refresh token format');
            return res.status(401).json({
              success: false,
              error: 'Token expired',
              code: 'TOKEN_EXPIRED'
            });
          }

          // Verify refresh token signature
          jwt.verify(refreshToken, jwtSecret);

          // Validate refresh token in database
          const refreshTokenRepo = new RefreshTokenRepository();
          const validRefreshToken = await refreshTokenRepo.validateRefreshToken(
            refreshDecoded.tokenId,
            refreshToken
          );

          if (!validRefreshToken) {
            logger.warn('Refresh token not found or revoked', { tokenId: refreshDecoded.tokenId });
            return res.status(401).json({
              success: false,
              error: 'Session expired. Please login again.',
              code: 'REFRESH_TOKEN_INVALID'
            });
          }

          // Generate new access token
          const newAccessToken = generateAccessToken({
            address: refreshDecoded.address,
            role: refreshDecoded.role,
            shopId: refreshDecoded.shopId
          });

          // Set new access token in cookie
          res.cookie('auth_token', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 15 * 60 * 1000, // 15 minutes
            path: '/'
          });

          // Update last used timestamp
          await refreshTokenRepo.updateLastUsed(refreshDecoded.tokenId);

          logger.info('Access token auto-refreshed successfully', {
            address: refreshDecoded.address,
            role: refreshDecoded.role
          });

          // Decode the new token and set user in request
          decoded = jwt.verify(newAccessToken, jwtSecret) as JWTPayload;
        } catch (refreshError: any) {
          logger.error('Auto-refresh failed:', refreshError);
          return res.status(401).json({
            success: false,
            error: 'Token expired',
            code: 'TOKEN_EXPIRED'
          });
        }
      } else {
        // Other JWT errors (invalid signature, malformed, etc.)
        return res.status(401).json({
          success: false,
          error: 'Invalid token',
          code: 'INVALID_TOKEN'
        });
      }
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

    // Check token type - only accept access tokens for API calls
    // Legacy tokens without 'type' field are accepted for backward compatibility
    if ('type' in decoded && decoded.type !== 'access') {
      logger.security('Attempt to use non-access token for API call', {
        ip: req.ip,
        address: decoded.address,
        tokenType: decoded.type
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid token type. Use access token for API calls.',
        code: 'INVALID_TOKEN_TYPE'
      });
    }

    // NOTE: Refresh token validation removed from here for performance
    // Validation happens at /auth/refresh endpoint when access token expires
    // This is more efficient than checking database on every API call
    // Max time for revoked user to stay logged in: 15 minutes (access token lifetime)

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
        // Use AdminService to check admin access (database + env fallback)
        const adminService = new AdminService();
        return await adminService.checkAdminAccess(tokenPayload.address);
        
      case 'shop':
        if (!tokenPayload.shopId) {
          logger.warn('Shop token missing shopId', { address: tokenPayload.address });
          return false;
        }
        const shop = await shopRepository.getShop(tokenPayload.shopId);
        if (!shop) {
          logger.warn('Shop not found', { shopId: tokenPayload.shopId });
          return false;
        }
        // Allow unverified/inactive shops to access dashboard with limited features
        // Individual endpoints can enforce stricter checks if needed
        if (shop.walletAddress.toLowerCase() !== tokenPayload.address.toLowerCase()) {
          logger.warn('Shop wallet address mismatch', {
            shopId: tokenPayload.shopId,
            shopWallet: shop.walletAddress.toLowerCase(),
            tokenWallet: tokenPayload.address.toLowerCase()
          });
          return false;
        }
        return true;
        
      case 'customer':
        const customer = await customerRepository.getCustomer(tokenPayload.address);
        return customer !== null && customer.isActive;
        
      default:
        return false;
    }
  } catch (error) {
    logger.error('Error validating user in database:', error);
    return false;
  }
}

// Legacy JWT token generation utility (for backward compatibility during migration)
export const generateToken = (payload: Omit<BaseJWTPayload, 'iat' | 'exp'>): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign(payload, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '2h', // Changed from 24h to 2h for better security
    issuer: 'repaircoin-api',
    audience: 'repaircoin-users'
  } as jwt.SignOptions);
};

// Generate short-lived access token (15 minutes)
export const generateAccessToken = (payload: Omit<BaseJWTPayload, 'iat' | 'exp'>): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  const accessPayload: Omit<AccessTokenPayload, 'iat' | 'exp'> = {
    ...payload,
    type: 'access'
  };

  return jwt.sign(accessPayload, jwtSecret, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
    issuer: 'repaircoin-api',
    audience: 'repaircoin-users'
  } as jwt.SignOptions);
};

// Generate long-lived refresh token (7 days)
export const generateRefreshToken = (
  payload: Omit<BaseJWTPayload, 'iat' | 'exp'>,
  tokenId: string
): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  const refreshPayload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
    ...payload,
    type: 'refresh',
    tokenId
  };

  return jwt.sign(refreshPayload, jwtSecret, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
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