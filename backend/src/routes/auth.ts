// backend/src/routes/auth.ts
import { Router, Response } from 'express';
import { customerRepository, shopRepository, adminRepository } from '../repositories';
import { logger } from '../utils/logger';
import { generateToken, authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * Helper function to set httpOnly cookie with JWT token
 * For cross-origin deployments (frontend on Vercel, backend on Digital Ocean),
 * we need sameSite: 'none' with secure: true
 */
const setAuthCookie = (res: Response, token: string) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: true, // Always true - required for sameSite: 'none' and for production HTTPS
    sameSite: 'none' as const, // Allow cross-site cookies (Vercel <-> Digital Ocean)
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/'
  };

  res.cookie('auth_token', token, cookieOptions);
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
          // Don't filter by active status - check all shops
          const allShops = await shopRepository.getShopsPaginated({ page: 1, limit: 1000 });
          const shop = allShops.items.find(s => s.walletAddress?.toLowerCase() === normalizedAddress);
          
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
      // Get shop by wallet address - we need to find the shop with this wallet
      // Don't filter by active status here - we need to check if the shop exists first
      const allShops = await shopRepository.getShopsPaginated({ page: 1, limit: 1000 });
      const shop = allShops.items.find(s => s.walletAddress?.toLowerCase() === normalizedAddress);
      
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
      // Don't filter by active status - check all shops
      const allShops = await shopRepository.getShopsPaginated({ page: 1, limit: 1000 });
      const shop = allShops.items.find(s => s.walletAddress?.toLowerCase() === normalizedAddress);
      
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

    // Generate JWT token for admin
    const token = generateToken({
      address: normalizedAddress,
      role: 'admin'
    });

    // Set httpOnly cookie
    setAuthCookie(res, token);

    res.json({
      success: true,
      token, // Still send in response for backward compatibility
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

      // Generate JWT token for customer
      const token = generateToken({
        address: normalizedAddress,
        role: 'customer'
      });

      // Set httpOnly cookie
      setAuthCookie(res, token);

      res.json({
        success: true,
        token, // Still send in response for backward compatibility
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
      const allShops = await shopRepository.getShopsPaginated({ active: true, page: 1, limit: 1000 });
      const shop = allShops.items.find(s => s.walletAddress?.toLowerCase() === normalizedAddress);
      
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

      // Generate JWT token for shop
      const token = generateToken({
        address: normalizedAddress,
        role: 'shop',
        shopId: shop.shopId
      });

      // Set httpOnly cookie
      setAuthCookie(res, token);

      res.json({
        success: true,
        token, // Still send in response for backward compatibility
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
router.post('/logout', (req, res) => {
  try {
    // Clear the auth cookie
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/'
    });

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
 * Refresh token - Generate new token for authenticated user
 * POST /api/auth/refresh
 */
router.post('/refresh', authMiddleware, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Generate new token with same payload
    const newToken = generateToken({
      address: req.user.address,
      role: req.user.role as any,
      shopId: req.user.shopId
    });

    // Set new cookie
    setAuthCookie(res, newToken);

    res.json({
      success: true,
      token: newToken, // Also send in response for backward compatibility
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
});

export default router;