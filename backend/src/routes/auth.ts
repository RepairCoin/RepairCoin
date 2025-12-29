// backend/src/routes/auth.ts
import { Router, Response, Request } from 'express';
import rateLimit from 'express-rate-limit';
import { customerRepository, shopRepository, adminRepository, refreshTokenRepository } from '../repositories';
import { logger } from '../utils/logger';
import { generateToken, generateAccessToken, generateRefreshToken, authMiddleware } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * Rate limiting for authentication endpoints
 * Prevents brute force attacks and account enumeration
 *
 * Updated to be more permissive for legitimate usage while still preventing abuse:
 * - Allows 20 requests per 5 minutes (increased from 5 per 15 minutes)
 * - Better balance between security and user experience
 * - Supports multiple wallet connections/tab refreshes during development
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 100, // 5 in production, 100 in development
  message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.security('Rate limit exceeded for auth endpoint', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts from this IP, please try again in a few minutes'
    });
  }
});

/**
 * Helper function to set httpOnly cookie with JWT token
 *
 * SUBDOMAIN SETUP (Production):
 * - Frontend: https://repaircoin.ai or https://www.repaircoin.ai
 * - Backend: https://api.repaircoin.ai
 *
 * With subdomain setup, we can use:
 * - domain: '.repaircoin.ai' to share cookies across subdomains
 * - sameSite: 'lax' for better security (instead of 'none')
 * - secure: true for HTTPS only
 */
const setAuthCookie = (res: Response, token: string) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieDomain = process.env.COOKIE_DOMAIN; // e.g., '.repaircoin.ai' for subdomain setup

  // In production with subdomain setup (api.repaircoin.ai), we use:
  // - domain: '.repaircoin.ai' to allow cookies across subdomains
  // - sameSite: 'lax' for better CSRF protection
  // - secure: true for HTTPS only
  //
  // In development (localhost), we don't set domain and use 'lax'
  const cookieOptions: any = {
    httpOnly: true,
    secure: isProduction || process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax' as 'lax', // 'lax' works for subdomain setup and is more secure than 'none'
    maxAge: 2 * 60 * 60 * 1000, // 2 hours (changed from 24h for better security)
    path: '/',
  };

  // Set domain for cookie sharing
  if (isProduction && cookieDomain) {
    cookieOptions.domain = cookieDomain; // e.g., '.repaircoin.ai'
  } else if (!isProduction) {
    // In development, set domain to 'localhost' (without port) so cookies work across different ports
    // This allows frontend (localhost:3001) to send cookies set by backend (localhost:3002)
    cookieOptions.domain = 'localhost';
  }

  res.cookie('auth_token', token, cookieOptions);

  logger.info('Auth cookie set', {
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    httpOnly: cookieOptions.httpOnly,
    maxAge: cookieOptions.maxAge,
    domain: cookieOptions.domain || 'not set (browser default)',
    environment: process.env.NODE_ENV
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

  const isProduction = process.env.NODE_ENV === 'production';
  const cookieDomain = process.env.COOKIE_DOMAIN; // e.g., '.repaircoin.ai' for subdomain setup

  // Cookie options for subdomain authentication
  // With subdomain setup (api.repaircoin.ai), we can use sameSite: 'lax' for better security
  const baseCookieOptions: any = {
    httpOnly: true,
    secure: isProduction || process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax' as 'lax', // 'lax' works for subdomain setup and is more secure than 'none'
    path: '/'
  };

  // Set domain for cookie sharing
  if (isProduction && cookieDomain) {
    baseCookieOptions.domain = cookieDomain; // e.g., '.repaircoin.ai'
  } else if (!isProduction) {
    // In development, set domain to 'localhost' (without port) so cookies work across different ports
    baseCookieOptions.domain = 'localhost';
  }

  // Set access token as httpOnly cookie (15 minutes)
  res.cookie('auth_token', accessToken, {
    ...baseCookieOptions,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  // Set refresh token as httpOnly cookie (7 days)
  res.cookie('refresh_token', refreshToken, {
    ...baseCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  logger.info('Access and refresh tokens generated', {
    address: payload.address,
    role: payload.role,
    shopId: payload.shopId,
    tokenId,
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    cookieSettings: {
      httpOnly: baseCookieOptions.httpOnly,
      secure: baseCookieOptions.secure,
      sameSite: baseCookieOptions.sameSite,
      path: baseCookieOptions.path,
      domain: baseCookieOptions.domain || 'not set (browser default)'
    },
    origin: req.get('origin'),
    referer: req.get('referer'),
    ip: req.ip
  });

  return { accessToken, refreshToken, tokenId };
};

/**
 * Generate JWT token for authenticated users
 * POST /api/auth/token
 */
router.post('/token', async (req, res) => {
  try {
    const { address, email } = req.body;

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
        // Check if user is a shop by wallet
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
          // Shop not found by wallet
        }
      }

      // EMAIL FALLBACK: If still no user found and email provided, try to find shop by email
      // This allows shops registered with MetaMask to login via Google/social login
      if (!userType && email && typeof email === 'string' && email.includes('@')) {
        try {
          const shopByEmail = await shopRepository.getShopByEmail(email);
          if (shopByEmail) {
            logger.info('Shop authenticated via email fallback', {
              email,
              shopId: shopByEmail.shopId,
              originalWallet: shopByEmail.walletAddress,
              connectedWallet: normalizedAddress
            });
            userType = 'shop';
            userData = {
              address: shopByEmail.walletAddress, // Use original wallet for reference
              shopId: shopByEmail.shopId,
              role: 'shop',
              linkedByEmail: true,
              connectedWallet: normalizedAddress // Track the wallet they're using now
            };
          }
        } catch (error) {
          // Shop not found by email either
        }
      }
    }

    if (!userType || !userData) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Generate both access and refresh tokens
    const { accessToken, refreshToken } = await generateAndSetTokens(res, req, userData);

    logger.info('User authenticated successfully', {
      address: normalizedAddress,
      role: userType,
      shopId: userData.shopId,
      ip: req.ip
    });

    return res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60, // 15 minutes in seconds
        address: normalizedAddress,
        role: userType,
        shopId: userData.shopId
      },
      token: accessToken, // Send access token in response for backward compatibility
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
          createdBy: 'SYSTEM'
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

    // Check if user is a shop (by wallet first)
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
      // Shop not found by wallet, continue
      logger.debug('Shop not found for address:', normalizedAddress);
    }

    // EMAIL FALLBACK: If email is provided (social login), try to find shop by email
    // This allows shops registered with MetaMask to also login via Google if email matches
    const { email } = req.body;
    if (email && typeof email === 'string' && email.includes('@')) {
      try {
        const shopByEmail = await shopRepository.getShopByEmail(email);

        if (shopByEmail) {
          logger.info('Shop found by email fallback for social login', {
            email,
            shopId: shopByEmail.shopId,
            originalWallet: shopByEmail.walletAddress,
            connectedWallet: normalizedAddress,
            note: 'NOT updating wallet - RCG tokens remain on original wallet'
          });

          // NOTE: We do NOT update the wallet address here because:
          // 1. The original wallet holds their RCG tokens (determines tier)
          // 2. Changing wallet would affect their tier and token operations
          // The shop can access their dashboard via email, but blockchain operations
          // should use their original MetaMask wallet

          return res.json({
            exists: true,
            type: 'shop',
            linkedByEmail: true, // Flag to indicate this was matched by email
            user: {
              id: shopByEmail.shopId,
              shopId: shopByEmail.shopId,
              address: shopByEmail.walletAddress, // Original wallet (has RCG tokens)
              walletAddress: shopByEmail.walletAddress, // Original wallet for blockchain ops
              connectedWallet: normalizedAddress, // The embedded wallet they're connecting with
              name: shopByEmail.name,
              companyName: shopByEmail.name,
              shopName: shopByEmail.name,
              email: shopByEmail.email,
              phone: shopByEmail.phone,
              active: shopByEmail.active,
              isActive: shopByEmail.active,
              verified: shopByEmail.verified,
              isVerified: shopByEmail.verified,
              createdAt: shopByEmail.joinDate
            }
          });
        }
      } catch (error) {
        logger.debug('Shop not found by email:', email);
      }
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
 * Uses access token from cookie - automatically refreshed by client if needed
 */
router.get('/session', authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.address || !req.user.role) {
      return res.status(401).json({
        isValid: false,
        error: 'Invalid session'
      });
    }

    const { address, role, shopId } = req.user;

    // Fetch full user data based on role
    let userData: any = null;

    if (role === 'admin') {
      const admin = await adminRepository.getAdminByWalletAddress(address);
      if (admin) {
        userData = {
          id: admin.id,
          address: admin.walletAddress,
          walletAddress: admin.walletAddress,
          type: 'admin',
          role: 'admin',
          name: admin.name || 'Administrator',
          email: admin.email,
          active: admin.isActive,
          isSuperAdmin: admin.isSuperAdmin,
          createdAt: admin.createdAt,
          created_at: admin.createdAt
        };
      }
    } else if (role === 'shop' && shopId) {
      const shop = await shopRepository.getShop(shopId);
      if (shop) {
        userData = {
          id: shop.shopId,
          address: shop.walletAddress,
          walletAddress: shop.walletAddress,
          type: 'shop',
          role: 'shop',
          shopName: shop.name,
          name: shop.name,
          email: shop.email,
          active: shop.active,
          shopId: shop.shopId,
          createdAt: shop.joinDate,
          created_at: shop.joinDate
        };
      }
    } else if (role === 'customer') {
      const customer = await customerRepository.getCustomer(address);
      if (customer) {
        userData = {
          id: customer.address, // Use address as ID for customers
          address: customer.address,
          walletAddress: customer.address,
          type: 'customer',
          role: 'customer',
          name: customer.name,
          email: customer.email,
          active: customer.isActive,
          tier: customer.tier,
          createdAt: customer.joinDate,
          created_at: customer.joinDate,
          // Include suspension information if account is suspended
          ...(customer.isActive === false && {
            suspended: true,
            suspendedAt: customer.suspendedAt,
            suspensionReason: customer.suspensionReason
          })
        };
      }
    }

    if (!userData) {
      return res.status(404).json({
        isValid: false,
        error: 'User not found'
      });
    }

    return res.json({
      isValid: true,
      authenticated: true,
      user: userData,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() // Access token expires in 15 minutes
    });

  } catch (error) {
    logger.error('Error validating session:', error);
    return res.status(500).json({
      isValid: false,
      error: 'Internal server error',
      message: 'Error validating session'
    });
  }
});

/**
 * Generate admin JWT token
 * POST /api/auth/admin
 * Rate limited to prevent brute force attacks
 */
router.post('/admin', authLimiter, async (req, res) => {
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
          createdBy: 'SYSTEM'
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

    // Check if user has had tokens revoked recently (prevents immediate re-auth after revocation)
    const recentRevocation = await refreshTokenRepository.hasRecentRevocation(normalizedAddress, 1); // 1 hour cooldown
    if (recentRevocation) {
      logger.security('Login blocked - recent revocation detected', {
        address: normalizedAddress,
        revokedAt: recentRevocation.revokedAt,
        reason: recentRevocation.reason
      });

      return res.status(403).json({
        success: false,
        error: 'Your session was recently revoked. Please wait before logging in again.',
        code: 'RECENT_REVOCATION',
        revokedAt: recentRevocation.revokedAt,
        cooldownMinutes: 60
      });
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
 * Rate limited to prevent brute force attacks
 */
router.post('/customer', authLimiter, async (req, res) => {
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

      // Allow suspended customers to login - they can see their suspension status
      // but will be restricted from certain actions via middleware

      // Check if user has had tokens revoked recently (prevents immediate re-auth after revocation)
      const recentRevocation = await refreshTokenRepository.hasRecentRevocation(normalizedAddress, 1); // 1 hour cooldown
      if (recentRevocation) {
        logger.security('Login blocked - recent revocation detected', {
          address: normalizedAddress,
          revokedAt: recentRevocation.revokedAt,
          reason: recentRevocation.reason
        });

        return res.status(403).json({
          success: false,
          error: 'Your session was recently revoked. Please wait before logging in again.',
          code: 'RECENT_REVOCATION',
          revokedAt: recentRevocation.revokedAt,
          cooldownMinutes: 60
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
          createdAt: customer.joinDate,
          // Include suspension information if account is suspended
          ...(customer.isActive === false && {
            suspended: true,
            suspendedAt: customer.suspendedAt,
            suspensionReason: customer.suspensionReason
          })
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
 * Rate limited to prevent brute force attacks
 */
router.post('/shop', authLimiter, async (req, res) => {
  try {
    const { address, email } = req.body;

    if (!address) {
      return res.status(400).json({
        error: 'Wallet address is required'
      });
    }

    const normalizedAddress = address.toLowerCase();
    let linkedByEmail = false;

    // Check if address belongs to a shop
    try {
      let shop = await shopRepository.getShopByWallet(normalizedAddress);

      // EMAIL FALLBACK: If shop not found by wallet and email provided, try email lookup
      // This allows shops registered with MetaMask to also login via Google/social login
      if (!shop && email && typeof email === 'string' && email.includes('@')) {
        shop = await shopRepository.getShopByEmail(email);
        if (shop) {
          linkedByEmail = true;
          logger.info('Shop authenticated via email fallback (social login)', {
            email,
            shopId: shop.shopId,
            originalWallet: shop.walletAddress,
            connectedWallet: normalizedAddress
          });
        }
      }

      if (!shop) {
        return res.status(403).json({
          error: 'Address not associated with a shop'
        });
      }

      // Check if user has had tokens revoked recently (prevents immediate re-auth after revocation)
      const recentRevocation = await refreshTokenRepository.hasRecentRevocation(normalizedAddress, 1); // 1 hour cooldown
      if (recentRevocation) {
        logger.security('Login blocked - recent revocation detected', {
          address: normalizedAddress,
          revokedAt: recentRevocation.revokedAt,
          reason: recentRevocation.reason
        });

        return res.status(403).json({
          success: false,
          error: 'Your session was recently revoked. Please wait before logging in again.',
          code: 'RECENT_REVOCATION',
          revokedAt: recentRevocation.revokedAt,
          cooldownMinutes: 60
        });
      }

      // Generate access and refresh tokens (allow unverified shops with limited access)
      const { accessToken } = await generateAndSetTokens(res, req, {
        address: normalizedAddress,
        role: 'shop',
        shopId: shop.shopId
      });

      res.json({
        success: true,
        token: accessToken, // Send access token for backward compatibility
        linkedByEmail, // Flag to indicate login was via email fallback
        user: {
          id: shop.shopId,
          shopId: shop.shopId,
          address: shop.walletAddress, // Original registered wallet (has RCG tokens)
          walletAddress: shop.walletAddress,
          connectedWallet: linkedByEmail ? normalizedAddress : shop.walletAddress, // Current session wallet
          name: shop.name,
          role: 'shop',
          active: shop.active,
          verified: shop.verified,
          createdAt: shop.joinDate,
          // Include suspension information if shop is suspended
          ...(shop.suspendedAt && {
            suspended: true,
            suspendedAt: shop.suspendedAt,
            suspensionReason: shop.suspensionReason
          })
        },
        // Include warning if shop is not verified/active
        ...((!shop.active || !shop.verified) && {
          warning: 'Shop is pending verification. Some features may be limited.',
          limitedAccess: true
        }),
        // Include note about email-linked login
        ...(linkedByEmail && {
          note: 'Logged in via email. Your original wallet is preserved for RCG tokens.',
          originalWallet: shop.walletAddress
        })
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

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieDomain = process.env.COOKIE_DOMAIN;

    // Cookie clear options must match the options used when setting the cookie
    const clearOptions: any = {
      httpOnly: true,
      secure: isProduction || process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax' as 'lax',
      path: '/'
    };

    // Set domain if configured (for subdomain setup)
    if (isProduction && cookieDomain) {
      clearOptions.domain = cookieDomain;
    }

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

    // Get refresh token from cookie or body (for mobile apps)
    const refreshTokenCookie = req.cookies?.refresh_token || req.body?.refreshToken;

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

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieDomain = process.env.COOKIE_DOMAIN;

    // Cookie options for subdomain setup
    const cookieOptions: any = {
      httpOnly: true,
      secure: isProduction || process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax' as 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/'
    };

    // Set domain for cookie sharing
    if (isProduction && cookieDomain) {
      cookieOptions.domain = cookieDomain;
    } else if (!isProduction) {
      // In development, set domain to 'localhost' (without port) so cookies work across different ports
      cookieOptions.domain = 'localhost';
    }

    // Set new access token cookie
    res.cookie('auth_token', newAccessToken, cookieOptions);

    logger.info('Access token refreshed', {
      address: decoded.address,
      role: decoded.role,
      tokenId: decoded.tokenId
    });

    // Prepare response data
    const responseData: any = {
      accessToken: newAccessToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
      address: decoded.address,
      role: decoded.role,
      shopId: decoded.shopId
    };

    // For mobile apps (when refresh token sent in body), return it back
    if (req.body?.refreshToken) {
      responseData.refreshToken = refreshTokenCookie;
    }

    res.json({
      success: true,
      data: responseData,
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

/**
 * DIAGNOSTIC ENDPOINT - Test cookie setting
 * GET /api/auth/test-cookie
 *
 * This endpoint helps diagnose cookie issues by:
 * 1. Setting a test cookie with current configuration
 * 2. Returning information about the request context
 * 3. Showing what cookies were received
 */
router.get('/test-cookie', (req, res) => {
  const protocol = req.protocol;
  const isHttps = protocol === 'https' || req.get('x-forwarded-proto') === 'https';
  const origin = req.get('origin') || req.get('referer') || 'unknown';
  const cookies = req.cookies || {};

  const isProduction = process.env.NODE_ENV === 'production';
  const cookieDomain = process.env.COOKIE_DOMAIN;

  // Set a test cookie with subdomain configuration
  const cookieOptions: any = {
    httpOnly: true,
    secure: isProduction || process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax' as 'lax',
    maxAge: 60 * 1000, // 1 minute
    path: '/'
  };

  // Set domain for cookie sharing
  if (isProduction && cookieDomain) {
    cookieOptions.domain = cookieDomain;
  } else if (!isProduction) {
    // In development, set domain to 'localhost' (without port) so cookies work across different ports
    cookieOptions.domain = 'localhost';
  }

  res.cookie('test_cookie', 'test_value_' + Date.now(), cookieOptions);

  // Log for debugging
  logger.info('Test cookie endpoint called', {
    protocol,
    isHttps,
    origin: req.get('origin'),
    referer: req.get('referer'),
    cookieOptions,
    receivedCookies: Object.keys(cookies)
  });

  res.json({
    success: true,
    message: 'Test cookie set',
    diagnostic: {
      protocol,
      isHttps,
      origin,
      host: req.get('host'),
      forwardedProto: req.get('x-forwarded-proto'),
      cookiesReceived: Object.keys(cookies),
      cookieCount: Object.keys(cookies).length,
      hasAuthToken: !!cookies.auth_token,
      hasRefreshToken: !!cookies.refresh_token,
      userAgent: req.get('User-Agent'),
      corsOrigin: req.get('origin'),
      referer: req.get('referer'),
      cookieSettings: {
        httpOnly: cookieOptions.httpOnly,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        maxAge: cookieOptions.maxAge
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        frontendUrl: process.env.FRONTEND_URL
      }
    },
    instructions: 'Check the Set-Cookie header in the response and verify it appears in your browser cookies. Open DevTools > Application > Cookies to see if test_cookie appears.'
  });
});

export default router;