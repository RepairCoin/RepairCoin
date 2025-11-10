// backend/src/routes/auth.ts
import { Router, Response, Request } from 'express';
import { customerRepository, shopRepository, adminRepository, refreshTokenRepository } from '../repositories';
import { logger } from '../utils/logger';
import { generateToken, generateAccessToken, generateRefreshToken, authMiddleware } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * Helper function to set httpOnly cookie with JWT token
 * For cross-origin deployments (frontend: www.repaircoin.ai on Vercel,
 * backend: *.ondigitalocean.app), we need sameSite: 'none' with secure: true.
 *
 * IMPORTANT: Do NOT set domain attribute for cross-origin cookies - let browser handle it
 */
const setAuthCookie = (res: Response, token: string) => {
  const isProduction = process.env.NODE_ENV === 'production';

  const cookieOptions = {
    httpOnly: true,
    secure: true, // Required for sameSite: 'none'
    sameSite: 'none' as const, // Required for cross-origin (different domains)
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
    // Do NOT set domain for cross-origin cookies - it will prevent them from working
  };

  res.cookie('auth_token', token, cookieOptions);

  logger.info('Auth cookie set', {
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    httpOnly: cookieOptions.httpOnly,
    maxAge: cookieOptions.maxAge
  });
};

/**
 * Helper to generate and set both access and refresh tokens
 * Returns both tokens for response
 */
const generateAndSetTokens = async (
  res: Response,
  req: Request,
  payload: { address: string; role: 'admin' | 'shop' | 'customer'; shopId?: string }
): Promise<{ accessToken: string; refreshToken: string; tokenId: string }> => {
  // Generate unique token ID for refresh token
  const tokenId = uuidv4();

  // Generate both tokens
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload, tokenId);

  // Store refresh token in database
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await refreshTokenRepository.createRefreshToken({
    tokenId,
    userAddress: payload.address,
    userRole: payload.role,
    shopId: payload.shopId,
    token: refreshToken,
    expiresAt,
    userAgent: req.get('User-Agent'),
    ipAddress: req.ip
  });

  // Set access token as httpOnly cookie (15 minutes)
  res.cookie('auth_token', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none' as const,
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/'
  });

  // Set refresh token as httpOnly cookie (7 days)
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/'
  });

  logger.info('Access and refresh tokens generated', {
    address: payload.address,
    role: payload.role,
    tokenId,
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d'
  });

  return { accessToken, refreshToken, tokenId };
};

/**
 * Generate JWT token for authenticated users
 * POST /api/auth/token
 */
router.post('/token', async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        error: 'Wallet address is required'
      });
    }

    const normalizedAddress = address.toLowerCase();
    let userType: string | null = null;
    let userData: any = null;

    // Check admin addresses using database only
    const adminData = await adminRepository.getAdminByWalletAddress(normalizedAddress);
    
    if (adminData) {
      userType = 'admin';
      userData = {
        address: normalizedAddress,
        role: 'admin'
      };
    } else {
      // Check if user is a customer
      try {
        const customer = await customerRepository.getCustomer(normalizedAddress);
        if (customer) {
          userType = 'customer';
          userData = {
            address: customer.address,
            role: 'customer'
          };
        }
      } catch (error) {
        // Continue to check shop
      }

      if (!userType) {
        // Check if user is a shop
        try {
          const shop = await shopRepository.getShopByWallet(normalizedAddress);

          if (shop) {
            userType = 'shop';
            userData = {
              address: shop.walletAddress,
              shopId: shop.shopId,
              role: 'shop'
            };
          }
        } catch (error) {
          // Shop not found
        }
      }
    }

    if (!userType || !userData) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Generate JWT token
    const token = generateToken(userData);

    // Set httpOnly cookie
    setAuthCookie(res, token);

    return res.json({
      success: true,
      token, // Still send in response for backward compatibility
      userType,
      address: normalizedAddress
    });

  } catch (error) {
    logger.error('Error generating token:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * Check if a user exists and return their type and basic info
 * POST /api/auth/check-user
 */
router.post('/check-user', async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        error: 'Wallet address is required'
      });
    }

    const normalizedAddress = address.toLowerCase();

    // Check if this is a super admin from .env (all addresses in ADMIN_ADDRESSES are super admins)
    const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => {
      const trimmed = addr.trim();
      // Keep the original case for addresses from env to match database constraint
      return trimmed;
    }).filter(addr => addr.length > 0);
    
    // All addresses in ADMIN_ADDRESSES are super admins
    const isSuperAdminFromEnv = adminAddresses.some(addr => addr.toLowerCase() === normalizedAddress);
    const envSuperAdminAddress = adminAddresses.find(addr => addr.toLowerCase() === normalizedAddress) || adminAddresses[0];
    
    // Check admin in database
    let adminData = await adminRepository.getAdminByWalletAddress(normalizedAddress);
    
    // If this is a super admin from .env and not in database, auto-create
    if (isSuperAdminFromEnv && !adminData) {
      try {
        await adminRepository.createAdmin({
          walletAddress: envSuperAdminAddress, // Use original case from env
          name: 'Super Administrator',
          permissions: ['all'],
          isSuperAdmin: true,
          createdBy: 'system'
        });
        adminData = await adminRepository.getAdminByWalletAddress(normalizedAddress);
        logger.info('Auto-created super admin from env:', normalizedAddress);
      } catch (error) {
        logger.error('Failed to auto-create super admin:', error);
        // Even if DB creation fails, allow super admin from env to proceed
        adminData = {
          id: 0,
          walletAddress: normalizedAddress,
          name: 'Super Administrator',
          permissions: ['all'],
          isActive: true,
          isSuperAdmin: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as any;
      }
    }
    
    // If admin exists in database or is super admin from env
    if (adminData) {
      // Update last login
      await adminRepository.updateAdminLastLogin(normalizedAddress);
      
      // Sync super admin status with .env configuration
      if (isSuperAdminFromEnv) {
        // If this is a super admin from env but doesn't have super admin status, update it
        if (!adminData.isSuperAdmin || adminData.role !== 'super_admin') {
          // Grant super admin status and role to this admin from env
          await adminRepository.updateAdmin(adminData.walletAddress, { 
            isSuperAdmin: true,
            role: 'super_admin'
          });
          adminData.isSuperAdmin = true;
          adminData.role = 'super_admin';
          logger.info('Granted super admin status to env admin:', normalizedAddress);
        }
      } else if (adminData.isSuperAdmin) {
        // If this admin has super admin status but is NOT in env list
        // Remove super admin status since they're not in the env list
        await adminRepository.updateAdmin(normalizedAddress, { 
          isSuperAdmin: false,
          role: 'admin' 
        });
        adminData.isSuperAdmin = false;
        adminData.role = 'admin';
        logger.info('Removed super admin status (not in env) from:', normalizedAddress);
      }
      
      return res.json({
        exists: true,
        type: 'admin',
        user: {
          id: adminData.id.toString(),
          address: normalizedAddress,
          walletAddress: normalizedAddress,
          name: adminData.name || 'Administrator',
          email: adminData.email,
          role: adminData.role || (adminData.isSuperAdmin ? 'super_admin' : 'admin'),
          permissions: isSuperAdminFromEnv ? ['all'] : adminData.permissions,
          isSuperAdmin: isSuperAdminFromEnv || adminData.isSuperAdmin,
          active: adminData.isActive,
          createdAt: adminData.createdAt || new Date().toISOString()
        }
      });
    }

    // Check if user is a customer
    try {
      const customer = await customerRepository.getCustomer(normalizedAddress);
      if (customer) {
        return res.json({
          exists: true,
          type: 'customer',
          user: {
            id: customer.address, // Use address as ID since that's the primary identifier
            address: customer.address,
            walletAddress: customer.address,
            name: customer.name || 'Customer',
            email: customer.email,
            tier: customer.tier,
            active: customer.isActive,
            createdAt: customer.joinDate
          }
        });
      }
    } catch (error) {
      // Customer not found, continue checking
      logger.debug('Customer not found for address:', normalizedAddress);
    }

    // Check if user is a shop
    try {
      const shop = await shopRepository.getShopByWallet(normalizedAddress);

      if (shop) {
        return res.json({
          exists: true,
          type: 'shop',
          user: {
            id: shop.shopId,
            shopId: shop.shopId,
            address: shop.walletAddress,
            walletAddress: shop.walletAddress,
            name: shop.name,
            companyName: shop.name,
            shopName: shop.name,
            email: shop.email,
            phone: shop.phone,
            active: shop.active,
            isActive: shop.active,
            verified: shop.verified,
            isVerified: shop.verified,
            createdAt: shop.joinDate
          }
        });
      }
    } catch (error) {
      // Shop not found, continue
      logger.debug('Shop not found for address:', normalizedAddress);
    }

    // User not found in any category
    return res.status(404).json({
      exists: false,
      error: 'User not found',
      message: 'No user found with this wallet address'
    });

  } catch (error) {
    logger.error('Error checking user:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error checking user existence'
    });
  }
});

/**
 * Get current user profile with detailed information
 * POST /api/auth/profile
 */
router.post('/profile', async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        error: 'Wallet address is required'
      });
    }

    const normalizedAddress = address.toLowerCase();

    // Check if this is a super admin from .env (all addresses in ADMIN_ADDRESSES are super admins)
    const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => {
      const trimmed = addr.trim();
      // Keep the original case for addresses from env to match database constraint
      return trimmed;
    }).filter(addr => addr.length > 0);
    
    // All addresses in ADMIN_ADDRESSES are super admins
    const isSuperAdminFromEnv = adminAddresses.some(addr => addr.toLowerCase() === normalizedAddress);
    
    // Check admin first from database
    const adminData = await adminRepository.getAdminByWalletAddress(normalizedAddress);
    if (adminData || isSuperAdminFromEnv) {
      return res.json({
        type: 'admin',
        profile: {
          id: adminData?.id?.toString() || 'super_admin',
          address: normalizedAddress,
          walletAddress: normalizedAddress,
          name: adminData?.name || 'Super Administrator',
          email: adminData?.email,
          active: adminData?.isActive !== false,
          permissions: isSuperAdminFromEnv ? ['all'] : (adminData?.permissions || []),
          isSuperAdmin: isSuperAdminFromEnv || adminData?.isSuperAdmin,
          createdAt: adminData?.createdAt || new Date().toISOString()
        }
      });
    }

    // Check customer
    try {
      const customer = await customerRepository.getCustomer(normalizedAddress);
      if (customer) {
        return res.json({
          type: 'customer',
          profile: {
            id: customer.address,
            address: customer.address,
            walletAddress: customer.address,
            name: customer.name,
            email: customer.email,
            tier: customer.tier,
            active: customer.isActive,
            createdAt: customer.joinDate,
            stats: {
              totalTokensEarned: customer.lifetimeEarnings || 0,
              totalTokensRedeemed: 0,
              totalRepairs: 0,
              favoriteShops: []
            }
          }
        });
      }
    } catch (error) {
      logger.debug('Customer not found for profile:', normalizedAddress);
    }

    // Check shop
    try {
      const shop = await shopRepository.getShopByWallet(normalizedAddress);

      if (shop) {
        return res.json({
          type: 'shop',
          profile: {
            id: shop.shopId,
            shopId: shop.shopId,
            address: shop.walletAddress,
            walletAddress: shop.walletAddress,
            name: shop.name,
            shopName: shop.name,
            email: shop.email,
            phone: shop.phone,
            businessAddress: shop.address,
            active: shop.active,
            verified: shop.verified,
            createdAt: shop.joinDate,
            location: shop.location,
            balance: {
              purchased: shop.purchasedRcnBalance || 0,
              earned: 0,
              total: shop.purchasedRcnBalance || 0
            }
          }
        });
      }
    } catch (error) {
      logger.debug('Shop not found for profile:', normalizedAddress);
    }

    return res.status(404).json({
      error: 'User not found',
      message: 'No profile found for this wallet address'
    });

  } catch (error) {
    logger.error('Error fetching user profile:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error fetching user profile'
    });
  }
});

/**
 * Validate session and return user info
 * GET /api/auth/session
 */
router.get('/session', async (req, res) => {
  try {
    const { authorization } = req.headers;
    
    if (!authorization) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    // Extract wallet address from JWT or session token
    // For now, we'll expect the address to be passed in the Authorization header
    const address = authorization.replace('Bearer ', '');
    
    if (!address || !address.startsWith('0x')) {
      return res.status(401).json({ error: 'Invalid authorization format' });
    }

    // For now, we'll implement a simple admin check since we don't have full session management yet
    const normalizedAddress = address.toLowerCase();
    const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim());
    
    if (adminAddresses.includes(normalizedAddress)) {
      return res.json({
        authenticated: true,
        user: {
          type: 'admin',
          user: {
            id: 'admin_' + normalizedAddress,
            address: normalizedAddress,
            walletAddress: normalizedAddress,
            name: 'Administrator',
            active: true,
            createdAt: new Date().toISOString()
          }
        }
      });
    }

    // Check user existence by calling our own endpoint
    try {
      const checkResponse = await fetch(`${req.protocol}://${req.get('host')}/api/auth/check-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });

      if (checkResponse.ok) {
        const userData = await checkResponse.json();
        return res.json({
          authenticated: true,
          user: userData
        });
      } else {
        return res.status(401).json({
          authenticated: false,
          error: 'User not found'
        });
      }
    } catch (fetchError) {
      logger.error('Error checking user during session validation:', fetchError);
      return res.status(500).json({
        authenticated: false,
        error: 'Internal server error'
      });
    }

  } catch (error) {
    logger.error('Error validating session:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error validating session'
    });
  }
});

/**
 * Generate admin JWT token
 * POST /api/auth/admin
 */
router.post('/admin', async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        error: 'Wallet address is required'
      });
    }

    const normalizedAddress = address.toLowerCase();

    // Check if this is a super admin from .env (all addresses in ADMIN_ADDRESSES are super admins)
    const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => {
      const trimmed = addr.trim();
      // Keep the original case for addresses from env to match database constraint
      return trimmed;
    }).filter(addr => addr.length > 0);
    
    // All addresses in ADMIN_ADDRESSES are super admins
    const isSuperAdminFromEnv = adminAddresses.some(addr => addr.toLowerCase() === normalizedAddress);
    const envSuperAdminAddress = adminAddresses.find(addr => addr.toLowerCase() === normalizedAddress) || adminAddresses[0];
    
    // Check admin in database
    let adminData = await adminRepository.getAdminByWalletAddress(normalizedAddress);
    
    // If this is a super admin from .env and not in database, auto-create
    if (isSuperAdminFromEnv && !adminData) {
      try {
        await adminRepository.createAdmin({
          walletAddress: envSuperAdminAddress, // Use original case from env
          name: 'Super Administrator',
          permissions: ['all'],
          isSuperAdmin: true,
          createdBy: 'system'
        });
        adminData = await adminRepository.getAdminByWalletAddress(normalizedAddress);
        logger.info('Auto-created super admin from env:', normalizedAddress);
      } catch (error) {
        logger.error('Failed to auto-create super admin:', error);
        // Even if DB creation fails, allow super admin from env to proceed
        adminData = {
          id: 0,
          walletAddress: normalizedAddress,
          name: 'Super Administrator',
          permissions: ['all'],
          isActive: true,
          isSuperAdmin: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as any;
      }
    }
    
    // Check if user is authorized
    if (!adminData && !isSuperAdminFromEnv) {
      return res.status(403).json({
        error: 'Address not authorized as admin'
      });
    }

    // Update last login and sync super admin status
    if (adminData && adminData.id !== 0) {
      await adminRepository.updateAdminLastLogin(normalizedAddress);
      
      // Sync super admin status with .env configuration
      if (isSuperAdminFromEnv) {
        // If this is a super admin from env but doesn't have super admin status, update it
        if (!adminData.isSuperAdmin || adminData.role !== 'super_admin') {
          // Grant super admin status and role to this admin from env
          await adminRepository.updateAdmin(adminData.walletAddress, { 
            isSuperAdmin: true,
            role: 'super_admin'
          });
          adminData.isSuperAdmin = true;
          adminData.role = 'super_admin';
          logger.info('Granted super admin status to env admin:', normalizedAddress);
        }
      } else if (adminData.isSuperAdmin) {
        // If this admin has super admin status but is NOT in env list
        // Remove super admin status since they're not in the env list
        await adminRepository.updateAdmin(normalizedAddress, { 
          isSuperAdmin: false,
          role: 'admin' 
        });
        adminData.isSuperAdmin = false;
        adminData.role = 'admin';
        logger.info('Removed super admin status (not in env) from:', normalizedAddress);
      }
    }

    // Generate access and refresh tokens
    const { accessToken } = await generateAndSetTokens(res, req, {
      address: normalizedAddress,
      role: 'admin'
    });

    res.json({
      success: true,
      token: accessToken, // Send access token for backward compatibility
      user: {
        id: adminData?.id?.toString() || 'super_admin',
        address: normalizedAddress,
        walletAddress: normalizedAddress,
        name: adminData?.name || 'Super Administrator',
        email: adminData?.email,
        role: 'admin',
        permissions: isSuperAdminFromEnv ? ['all'] : (adminData?.permissions || []),
        isSuperAdmin: isSuperAdminFromEnv || adminData?.isSuperAdmin,
        active: adminData?.isActive !== false,
        createdAt: adminData?.createdAt || new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error generating admin token:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error generating admin token'
    });
  }
});

/**
 * Generate customer JWT token
 * POST /api/auth/customer
 */
router.post('/customer', async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        error: 'Wallet address is required'
      });
    }

    const normalizedAddress = address.toLowerCase();

    // Check if address belongs to a customer
    try {
      const customer = await customerRepository.getCustomer(normalizedAddress);
      
      if (!customer) {
        return res.status(403).json({
          error: 'Address not associated with a customer'
        });
      }

      if (!customer.isActive) {
        return res.status(403).json({
          error: 'Customer account is not active'
        });
      }

      // Generate access and refresh tokens
      const { accessToken } = await generateAndSetTokens(res, req, {
        address: normalizedAddress,
        role: 'customer'
      });

      res.json({
        success: true,
        token: accessToken, // Send access token for backward compatibility
        user: {
          id: customer.address,
          address: customer.address,
          walletAddress: customer.address,
          name: customer.name || 'Customer',
          role: 'customer',
          tier: customer.tier,
          active: customer.isActive,
          createdAt: customer.joinDate
        }
      });

    } catch (error) {
      logger.error('Customer authentication error:', error);
      return res.status(403).json({
        error: 'Authentication failed'
      });
    }

  } catch (error) {
    logger.error('Customer auth error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error authenticating customer'
    });
  }
});

/**
 * Generate shop JWT token
 * POST /api/auth/shop
 */
router.post('/shop', async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        error: 'Wallet address is required'
      });
    }

    const normalizedAddress = address.toLowerCase();

    // Check if address belongs to a shop
    try {
      const shop = await shopRepository.getShopByWallet(normalizedAddress);

      if (!shop) {
        return res.status(403).json({
          error: 'Address not associated with a shop'
        });
      }

      if (!shop.active || !shop.verified) {
        return res.status(403).json({
          error: 'Shop must be active and verified to authenticate'
        });
      }

      // Generate access and refresh tokens
      const { accessToken } = await generateAndSetTokens(res, req, {
        address: normalizedAddress,
        role: 'shop',
        shopId: shop.shopId
      });

      res.json({
        success: true,
        token: accessToken, // Send access token for backward compatibility
        user: {
          id: shop.shopId,
          shopId: shop.shopId,
          address: shop.walletAddress,
          walletAddress: shop.walletAddress,
          name: shop.name,
          role: 'shop',
          active: shop.active,
          verified: shop.verified,
          createdAt: shop.joinDate
        }
      });

    } catch (error) {
      logger.error('Error checking shop:', error);
      return res.status(500).json({
        error: 'Failed to verify shop'
      });
    }

  } catch (error) {
    logger.error('Error generating shop token:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error generating shop token'
    });
  }
});

/**
 * Logout - Clear auth cookie
 * POST /api/auth/logout
 */
router.post('/logout', async (req, res) => {
  try {
    // Extract refresh token from cookie to revoke it
    const refreshTokenCookie = req.cookies?.refresh_token;

    if (refreshTokenCookie) {
      try {
        // Decode refresh token to get tokenId
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(refreshTokenCookie, process.env.JWT_SECRET || '') as any;

        if (decoded.tokenId) {
          // Revoke refresh token in database
          await refreshTokenRepository.revokeToken(decoded.tokenId, 'User logout');
          logger.info('Refresh token revoked on logout', { tokenId: decoded.tokenId });
        }
      } catch (error) {
        // If token can't be decoded/verified, just continue with cookie clearing
        logger.warn('Could not revoke refresh token on logout:', error);
      }
    }

    // Cookie clear options must match the options used when setting the cookie
    const clearOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      path: '/'
      // Do NOT set domain for cross-origin cookies
    };

    // Clear both auth cookies
    res.clearCookie('auth_token', clearOptions);
    res.clearCookie('refresh_token', clearOptions);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error during logout'
    });
  }
});

/**
 * Refresh token - Use refresh token to get new access token
 * POST /api/auth/refresh
 *
 * This endpoint does NOT require authMiddleware since the access token may be expired.
 * Instead, it validates the refresh token from the cookie.
 */
router.post('/refresh', async (req, res) => {
  try {
    const jwt = require('jsonwebtoken');

    // Get refresh token from cookie
    const refreshTokenCookie = req.cookies?.refresh_token;

    if (!refreshTokenCookie) {
      return res.status(401).json({
        success: false,
        error: 'No refresh token provided',
        code: 'NO_REFRESH_TOKEN'
      });
    }

    // Verify and decode refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(refreshTokenCookie, process.env.JWT_SECRET || '');
    } catch (error: any) {
      logger.security('Invalid refresh token', {
        error: error.message,
        ip: req.ip
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    // Validate token type
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type for refresh',
        code: 'INVALID_TOKEN_TYPE'
      });
    }

    // Validate refresh token in database
    const storedToken = await refreshTokenRepository.validateRefreshToken(
      decoded.tokenId,
      refreshTokenCookie
    );

    if (!storedToken) {
      logger.security('Refresh token not found or revoked', {
        tokenId: decoded.tokenId,
        address: decoded.address,
        ip: req.ip
      });

      return res.status(401).json({
        success: false,
        error: 'Refresh token invalid or revoked',
        code: 'TOKEN_REVOKED'
      });
    }

    // Update last used timestamp
    await refreshTokenRepository.updateLastUsed(decoded.tokenId);

    // Generate new access token (refresh token stays the same)
    const newAccessToken = generateAccessToken({
      address: decoded.address,
      role: decoded.role,
      shopId: decoded.shopId
    });

    // Set new access token cookie
    res.cookie('auth_token', newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/'
    });

    logger.info('Access token refreshed', {
      address: decoded.address,
      role: decoded.role,
      tokenId: decoded.tokenId
    });

    res.json({
      success: true,
      token: newAccessToken, // Send for backward compatibility
      user: {
        address: decoded.address,
        role: decoded.role,
        shopId: decoded.shopId
      }
    });
  } catch (error: any) {
    logger.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Token refresh failed',
      code: 'TOKEN_REFRESH_ERROR'
    });
  }
});

export default router;