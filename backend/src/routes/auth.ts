// backend/src/routes/auth.ts
import { Router } from 'express';
import { customerRepository, shopRepository } from '../repositories';
import { logger } from '../utils/logger';
import { generateToken } from '../middleware/auth';

const router = Router();

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

    // Check admin addresses first
    const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim());
    if (adminAddresses.includes(normalizedAddress)) {
      return res.json({
        type: 'admin',
        user: {
          id: 'admin_' + normalizedAddress,
          address: normalizedAddress,
          walletAddress: normalizedAddress,
          name: 'Administrator',
          active: true,
          createdAt: new Date().toISOString()
        }
      });
    }

    // Check if user is a customer
    try {
      const customer = await customerRepository.getCustomer(normalizedAddress);
      if (customer) {
        return res.json({
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
      const allShops = await shopRepository.getShopsPaginated({ active: true, page: 1, limit: 1000 });
      const shop = allShops.items.find(s => s.walletAddress?.toLowerCase() === normalizedAddress);
      
      if (shop) {
        return res.json({
          type: 'shop',
          user: {
            id: shop.shopId,
            shopId: shop.shopId,
            address: shop.walletAddress,
            walletAddress: shop.walletAddress,
            name: shop.name,
            shopName: shop.name,
            email: shop.email,
            active: shop.active,
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

    // Check admin first
    const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim());
    if (adminAddresses.includes(normalizedAddress)) {
      return res.json({
        type: 'admin',
        profile: {
          id: 'admin_' + normalizedAddress,
          address: normalizedAddress,
          walletAddress: normalizedAddress,
          name: 'Administrator',
          email: null,
          active: true,
          permissions: ['manage_customers', 'manage_shops', 'manage_admins', 'view_analytics'],
          createdAt: new Date().toISOString()
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
      const allShops = await shopRepository.getShopsPaginated({ active: true, page: 1, limit: 1000 });
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

    // Check if address is in admin list
    const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim());
    if (!adminAddresses.includes(normalizedAddress)) {
      return res.status(403).json({
        error: 'Address not authorized as admin'
      });
    }

    // Generate JWT token for admin
    const token = generateToken({
      address: normalizedAddress,
      role: 'admin'
    });

    res.json({
      success: true,
      token,
      user: {
        id: 'admin_' + normalizedAddress,
        address: normalizedAddress,
        walletAddress: normalizedAddress,
        name: 'Administrator',
        role: 'admin',
        active: true,
        createdAt: new Date().toISOString()
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

      res.json({
        success: true,
        token,
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

export default router;