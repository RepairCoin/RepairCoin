// backend/src/routes/shops.ts
import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole, requireShopOrAdmin, requireShopOwnership } from '../../../middleware/auth';
import { validateRequired, validateEthereumAddress, validateEmail, validateNumeric } from '../../../middleware/errorHandler';
import { validateShopUniqueness } from '../../../middleware/validation';
import { 
  shopRepository, 
  customerRepository, 
  transactionRepository,
  redemptionSessionRepository 
} from '../../../repositories';
import { TokenMinter } from '../../../contracts/TokenMinter';
import { TierManager } from '../../../contracts/TierManager';
import { logger } from '../../../utils/logger';
import { RoleValidator } from '../../../utils/roleValidator';
import { validateShopRoleConflict } from '../../../middleware/roleConflictValidator';
import { ReferralService } from '../../../services/ReferralService';
import { PromoCodeService } from '../../../services/PromoCodeService';
import rcgRoutes from './rcg';
import { eventBus } from '../../../events/EventBus';

interface ShopData {
  shopId: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  walletAddress: string;
  reimbursementAddress?: string;
  verified: boolean;
  active: boolean;
  crossShopEnabled: boolean;
  totalTokensIssued: number;
  totalRedemptions: number;
  totalReimbursements: number;
  joinDate: string;
  lastActivity: string;
  fixflowShopId?: string;
  location?: string | {
    city?: string;
    state?: string;
    zipCode?: string;
    lat?: number;
    lng?: number;
  };
  purchasedRcnBalance?: number;
  totalRcnPurchased?: number;
}

// Import new route modules
import purchaseRoutes from './purchase';
import tierBonusRoutes from './tierBonus';
import depositRoutes from './deposit';
import purchaseSyncRoutes from './purchase-sync';

const router = Router();

// Register sub-routes (protected by auth)
router.use('/purchase', authMiddleware, requireRole(['shop']), purchaseRoutes);
router.use('/tier-bonus', authMiddleware, requireRole(['shop']), tierBonusRoutes);
router.use('/deposit', authMiddleware, requireRole(['shop']), depositRoutes); // RCN deposit routes
router.use('/purchase-sync', authMiddleware, requireRole(['shop']), purchaseSyncRoutes); // Payment sync routes

// Lazy loading helpers
let tokenMinter: TokenMinter | null = null;
let tierManager: TierManager | null = null;
let referralService: ReferralService | null = null;

const getTokenMinter = (): TokenMinter => {
  if (!tokenMinter) {
    // Import getTokenMinter from the module to use singleton
    const { getTokenMinter: getTokenMinterInstance } = require('../../../contracts/TokenMinter');
    tokenMinter = getTokenMinterInstance();
  }
  return tokenMinter;
};

const getTierManager = (): TierManager => {
  if (!tierManager) {
    tierManager = new TierManager();
  }
  return tierManager;
};

const getReferralService = (): ReferralService => {
  if (!referralService) {
    referralService = new ReferralService();
  }
  return referralService;
};

// Get all active shops (public endpoint)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { verified = 'true', crossShopEnabled } = req.query;
    
    let shops = await shopRepository.getActiveShops();
    
    // Apply filters
    if (verified === 'false') {
      shops = shops.filter(shop => !shop.verified);
    }
    
    if (crossShopEnabled === 'true') {
      shops = shops.filter(shop => shop.crossShopEnabled);
    } else if (crossShopEnabled === 'false') {
      shops = shops.filter(shop => !shop.crossShopEnabled);
    }

    // Remove sensitive information for public endpoint
    const publicShops = shops.map(shop => ({
      shopId: shop.shopId,
      name: shop.name,
      email: shop.email,
      active: shop.active,
      address: shop.address,
      phone: shop.phone,
      verified: shop.verified,
      crossShopEnabled: shop.crossShopEnabled,
      joinDate: shop.joinDate,
      location: {
        lat: shop.locationLat,
        lng: shop.locationLng,
        city: shop.locationCity,
        state: shop.locationState,
        zipCode: shop.locationZipCode
      },
      website: shop.website,
      firstName: shop.firstName,
      lastName: shop.lastName,
      companySize: shop.companySize,
      monthlyRevenue: shop.monthlyRevenue,
      referral: shop.referral,
      acceptTerms: shop.acceptTerms,
      country: shop.country,
      facebook: shop.facebook,
      twitter: shop.twitter,
      instagram: shop.instagram,
      category: shop.category
    }));

    res.json({
      success: true,
      data: {
        shops: publicShops,
        count: publicShops.length
      }
    });

  } catch (error: any) {
    logger.error('Error getting shops:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve shops'
    });
  }
});

// Get shop by ID
router.get('/:shopId', async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    
    const shop = await shopRepository.getShop(shopId);
    if (!shop) {
      return res.status(404).json({
        success: false,
        error: 'Shop not found'
      });
    }

    // Different data based on user role
    let shopData;
    if (req.user?.role === 'admin' || (req.user?.role === 'shop' && req.user.shopId === shopId)) {
      // Full data for admin or shop owner
      shopData = shop;
    } else {
      // Limited data for others
      shopData = {
        shopId: shop.shopId,
        name: shop.name,
        address: shop.address,
        phone: shop.phone,
        verified: shop.verified,
        crossShopEnabled: shop.crossShopEnabled,
        location: shop.location,
        joinDate: shop.joinDate,
        website: shop.website,
        firstName: shop.firstName,
        lastName: shop.lastName,
        companySize: shop.companySize,
        monthlyRevenue: shop.monthlyRevenue,
        referral: shop.referral,
        acceptTerms: shop.acceptTerms,
        country: shop.country,
        facebook: shop.facebook,
        twitter: shop.twitter,
        instagram: shop.instagram,
        category: shop.category
      };
    }

    res.json({
      success: true,
      data: shopData
    });

  } catch (error: any) {
    logger.error('Error getting shop:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve shop'
    });
  }
});

// Get shop by wallet address
router.get('/wallet/:address', 
  async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      
      // Validate Ethereum address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Ethereum address format'
        });
      }
      
      const shop = await shopRepository.getShopByWallet(address);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      // Different data based on user role
      let shopData;
      if (req.user?.role === 'admin' || (req.user?.role === 'shop' && req.user.shopId === shop.shopId)) {
        // Full data for admin or shop owner
        shopData = shop;
      } else {
        // Limited data for others, but include balance info for frontend display
        shopData = {
          shopId: shop.shopId,
          name: shop.name,
          address: shop.address,
          phone: shop.phone,
          email: shop.email,
          walletAddress: shop.walletAddress,
          verified: shop.verified,
          active: shop.active,
          crossShopEnabled: shop.crossShopEnabled,
          location: shop.location,
          joinDate: shop.joinDate,
          // Include balance information for display
          purchasedRcnBalance: shop.purchasedRcnBalance,
          totalRcnPurchased: shop.totalRcnPurchased,
          totalTokensIssued: shop.totalTokensIssued,
          totalRedemptions: shop.totalRedemptions,
          // Include operational status
          operational_status: shop.operational_status,
          rcg_tier: shop.rcg_tier,
          rcg_balance: shop.rcg_balance,
          // Include subscription status
          subscriptionActive: shop.subscriptionActive,
          // Include social media fields
          facebook: shop.facebook,
          twitter: shop.twitter,
          instagram: shop.instagram,
          // Add other fields as needed
          website: shop.website,
          firstName: shop.firstName,
          lastName: shop.lastName,
          companySize: shop.companySize,
          monthlyRevenue: shop.monthlyRevenue,
          referral: shop.referral,
          acceptTerms: shop.acceptTerms,
          country: shop.country,
        };
      }

      res.json({
        success: true,
        data: shopData
      });

    } catch (error: any) {
      logger.error('Error getting shop by wallet:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve shop by wallet address'
      });
    }
  }
);

// Register new shop
router.post('/register',
  validateRequired(['shopId', 'name', 'address', 'phone', 'email', 'walletAddress']),
  validateEthereumAddress('walletAddress'),
  validateEmail('email'),
  validateShopUniqueness({ email: true, wallet: true }),
  validateShopRoleConflict,
  async (req: Request, res: Response) => {
    try {
      const {
        shopId,
        name,
        address,
        phone,
        email,
        walletAddress,
        reimbursementAddress,
        fixflowShopId,
        location,
        firstName,
        lastName,
        city,
        country,
        companySize,
        monthlyRevenue,
        website,
        referral,
        facebook,
        twitter,
        instagram,
        acceptTerms,
        category
      } = req.body;

      // Check if shop already exists
      const existingShop = await shopRepository.getShop(shopId);
      if (existingShop) {
        return res.status(409).json({
          success: false,
          error: 'Shop ID already registered'
        });
      }

      // Check if wallet is already used by another shop
      const existingShopByWallet = await shopRepository.getShopByWallet(walletAddress);
      if (existingShopByWallet) {
        return res.status(409).json({
          success: false,
          error: `This wallet address is already registered to shop: ${existingShopByWallet.name}`,
          conflictingRole: 'shop'
        });
      }

      // Merge location data from both root level and nested location object
      const mergedLocation = {
        city: city || location?.city,
        state: location?.state,
        zipCode: location?.zipCode,
        lat: location?.lat,
        lng: location?.lng
      };

      // Create new shop data
      const newShop = {
        shopId,
        name,
        address,
        phone,
        email,
        walletAddress: walletAddress.toLowerCase(),
        reimbursementAddress: reimbursementAddress || walletAddress.toLowerCase(),
        verified: false, // Requires admin approval
        active: false,   // Activated after verification
        crossShopEnabled: false, // Default to false, can be enabled later
        totalTokensIssued: 0,
        totalRedemptions: 0,
        totalReimbursements: 0,
        joinDate: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        fixflowShopId,
        location: mergedLocation,
        firstName,
        lastName,
        companySize,
        monthlyRevenue,
        website,
        referral,
        facebook,
        twitter,
        instagram,
        acceptTerms,
        country,
        category
      };

      await shopRepository.createShop(newShop);

      logger.info('New shop registered', {
        shopId,
        name,
        walletAddress,
        email
      });

      res.status(201).json({
        success: true,
        message: 'Shop registered successfully. Awaiting admin verification.',
        data: {
          shopId: newShop.shopId,
          name: newShop.name,
          verified: newShop.verified,
          active: newShop.active
        }
      });

    } catch (error: any) {
      logger.error('Shop registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to register shop'
      });
    }
  }
);

// Update shop details (shop owner endpoint)
router.put('/:shopId/details',
  authMiddleware,
  requireRole(['shop']),
  requireShopOwnership,
  validateEmail('email'),
  validateShopUniqueness({ email: true, wallet: false, excludeField: 'shopId' }),
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const {
        name,
        email,
        phone,
        address,
        website,
        openingHours,
        ownerName,
        location,
        facebook,
        twitter,
        instagram,
        firstName,
        lastName,
      } = req.body;

      logger.info('Shop details update request received:', {
        shopId,
        requestBody: req.body,
        userId: req.user?.address
      });

      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      // Prepare updates
      const updates: Partial<ShopData & { 
        website?: string; 
        openingHours?: string; 
        ownerName?: string;
        locationLat?: number;
        locationLng?: number;
        locationCity?: string;
        locationState?: string;
        locationZipCode?: string;
        facebook?: string;
        twitter?: string;
        instagram?: string;
        firstName?: string;
        lastName?: string;
     }> = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (address !== undefined) updates.address = address;
      if (website !== undefined) updates.website = website;
      if (openingHours !== undefined) updates.openingHours = openingHours;
      if (ownerName !== undefined) updates.ownerName = ownerName;
      if (facebook !== undefined) updates.facebook = facebook;
      if (twitter !== undefined) updates.twitter = twitter;
      if (instagram !== undefined) updates.instagram = instagram;
      if (firstName !== undefined) updates.firstName = firstName;
      if (lastName !== undefined) updates.lastName = lastName;
            
      // Handle location updates - coordinates are stored in separate database columns
      if (location !== undefined) {
        // Validate and set coordinates if provided
        if (location.lat !== undefined) {
          const lat = typeof location.lat === 'string' ? parseFloat(location.lat) : location.lat;
          if (isNaN(lat) || lat < -90 || lat > 90) {
            throw new Error(`Invalid latitude value: ${location.lat}. Must be a number between -90 and 90.`);
          }
          updates.locationLat = lat;
        }
        
        if (location.lng !== undefined) {
          const lng = typeof location.lng === 'string' ? parseFloat(location.lng) : location.lng;
          if (isNaN(lng) || lng < -180 || lng > 180) {
            throw new Error(`Invalid longitude value: ${location.lng}. Must be a number between -180 and 180.`);
          }
          updates.locationLng = lng;
        }

        // Set other location fields
        if (location.city !== undefined) {
          updates.locationCity = location.city;
        }
        
        if (location.state !== undefined) {
          updates.locationState = location.state;
        }
        
        if (location.zipCode !== undefined) {
          updates.locationZipCode = location.zipCode;
        }
        
        logger.info('Location updates prepared for details endpoint', {
          shopId,
          locationData: {
            lat: updates.locationLat,
            lng: updates.locationLng,
            city: updates.locationCity,
            state: updates.locationState,
            zipCode: updates.locationZipCode
          }
        });
      }

      await shopRepository.updateShop(shopId, updates);

      logger.info('Shop details updated', {
        shopId,
        updatedBy: req.user?.address,
        updates
      });

      res.json({
        success: true,
        message: 'Shop details updated successfully'
      });

    } catch (error: any) {
      logger.error('Shop details update error:', {
        error: error.message,
        stack: error.stack,
        shopId: req.params.shopId,
        requestBody: req.body,
        userId: req.user?.address
      });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update shop details',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// Update shop information
router.put('/:shopId',
  requireShopOrAdmin,
  requireShopOwnership,
  validateEmail('email'),
  validateShopUniqueness({ email: true, wallet: false, excludeField: 'shopId' }),
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const {
        name,
        address,
        phone,
        email,
        reimbursementAddress,
        crossShopEnabled,
        location,
        website,
        openingHours,
        ownerName,
        facebook,
        twitter,
        instagram
      } = req.body;

      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      // Prepare updates
      const updates: Partial<ShopData & { website?: string; openingHours?: string; ownerName?: string; facebook?: string; twitter?: string; instagram?: string }> = {};
      if (name !== undefined) updates.name = name;
      if (address !== undefined) updates.address = address;
      if (phone !== undefined) updates.phone = phone;
      if (email !== undefined) updates.email = email;
      if (reimbursementAddress !== undefined) updates.reimbursementAddress = reimbursementAddress;
      if (location !== undefined) updates.location = location;
      if (website !== undefined) updates.website = website;
      if (openingHours !== undefined) updates.openingHours = openingHours;
      if (ownerName !== undefined) updates.ownerName = ownerName;
      if (facebook !== undefined) updates.facebook = facebook;
      if (twitter !== undefined) updates.twitter = twitter;
      if (instagram !== undefined) updates.instagram = instagram;
      
      // Only admin can change verification and cross-shop settings
      if (req.user?.role === 'admin') {
        if (crossShopEnabled !== undefined) updates.crossShopEnabled = crossShopEnabled;
      }

      await shopRepository.updateShop(shopId, updates);

      logger.info('Shop updated', {
        shopId,
        updatedBy: req.user?.address,
        updates
      });

      res.json({
        success: true,
        message: 'Shop updated successfully'
      });

    } catch (error: any) {
      logger.error('Shop update error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update shop'
      });
    }
  }
);

// Get shop analytics
router.get('/:shopId/analytics',
  authMiddleware,
  requireShopOrAdmin,
  requireShopOwnership,
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      const analytics = await shopRepository.getShopAnalytics(shopId);
      
      res.json({
        success: true,
        data: {
          shop: {
            shopId: shop.shopId,
            name: shop.name,
            verified: shop.verified,
            joinDate: shop.joinDate
          },
          analytics
        }
      });

    } catch (error: any) {
      logger.error('Error getting shop analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve shop analytics'
      });
    }
  }
);

// Get shop transactions - REMOVED (duplicate endpoint)

// Enable/disable cross-shop redemption (admin only)
router.post('/:shopId/cross-shop',
  requireRole(['admin']),
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const { enabled } = req.body;
      
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      if (!shop.verified) {
        return res.status(400).json({
          success: false,
          error: 'Shop must be verified before enabling cross-shop redemption'
        });
      }

      await shopRepository.updateShop(shopId, {
        crossShopEnabled: enabled
      });

      logger.info('Cross-shop redemption updated', {
        shopId,
        enabled,
        adminAddress: req.user?.address
      });

      res.json({
        success: true,
        message: `Cross-shop redemption ${enabled ? 'enabled' : 'disabled'} for shop ${shopId}`
      });

    } catch (error: any) {
      logger.error('Cross-shop toggle error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update cross-shop redemption setting'
      });
    }
  }
);

// Verify shop (admin only)
router.post('/:shopId/verify',
  requireRole(['admin']),
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      if (shop.verified) {
        return res.status(400).json({
          success: false,
          error: 'Shop already verified'
        });
      }

      await shopRepository.updateShop(shopId, {
        verified: true,
        active: true,
        lastActivity: new Date().toISOString()
      });

      logger.info('Shop verified', {
        shopId,
        adminAddress: req.user?.address
      });

      res.json({
        success: true,
        message: 'Shop verified and activated successfully'
      });

    } catch (error: any) {
      logger.error('Shop verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify shop'
      });
    }
  }
);

// Deactivate shop (admin only)
router.post('/:shopId/deactivate',
  requireRole(['admin']),
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const { reason } = req.body;
      
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      if (!shop.active) {
        return res.status(400).json({
          success: false,
          error: 'Shop already inactive'
        });
      }

      await shopRepository.updateShop(shopId, {
        active: false
      });

      logger.info('Shop deactivated', {
        shopId,
        adminAddress: req.user?.address,
        reason
      });

      res.json({
        success: true,
        message: 'Shop deactivated successfully'
      });

    } catch (error: any) {
      logger.error('Shop deactivation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to deactivate shop'
      });
    }
  }
);

// Get pending shop registrations (admin only)
router.get('/admin/pending',
  requireRole(['admin']),
  async (req: Request, res: Response) => {
    try {
      const allShops = await shopRepository.getActiveShops();
      const pendingShops = allShops.filter(shop => !shop.verified);

      res.json({
        success: true,
        data: {
          shops: pendingShops,
          count: pendingShops.length
        }
      });

    } catch (error: any) {
      logger.error('Error getting pending shops:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve pending shops'
      });
    }
  }
);

// Get shop dashboard data (shop owner or admin)
router.get('/:shopId/dashboard',
  requireShopOrAdmin,
  requireShopOwnership,
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      const [analytics, recentTransactions] = await Promise.all([
        shopRepository.getShopAnalytics(shopId),
        shopRepository.getShopTransactions(shopId, 10)
      ]);

      const dashboardData = {
        shop: {
          shopId: shop.shopId,
          name: shop.name,
          verified: shop.verified,
          active: shop.active,
          crossShopEnabled: shop.crossShopEnabled,
          totalTokensIssued: shop.totalTokensIssued,
          totalRedemptions: shop.totalRedemptions,
          joinDate: shop.joinDate,
          lastActivity: shop.lastActivity
        },
        analytics,
        recentTransactions: recentTransactions.slice(0, 5), // Last 5 transactions
        summary: {
          totalRevenue: shop.totalTokensIssued || 0,
          totalRedemptions: shop.totalRedemptions || 0,
          activeCustomers: analytics.totalCustomersServed || 0,
          averageRepairValue: analytics.averageTransactionAmount || 0
        }
      };

      res.json({
        success: true,
        data: dashboardData
      });

    } catch (error: any) {
      logger.error('Error getting shop dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve shop dashboard data'
      });
    }
  }
);

/**
 * @swagger
 * /api/shops/{shopId}/redeem:
 *   post:
 *     summary: Process token redemption at shop
 *     description: Process RCN token redemption after customer approval. All redemptions require a valid session ID for security.
 *     tags: [Shop Operations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *         description: The shop ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerAddress
 *               - amount
 *               - sessionId
 *             properties:
 *               customerAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 description: Customer's wallet address
 *               amount:
 *                 type: number
 *                 minimum: 0.1
 *                 maximum: 1000
 *                 description: Amount of RCN to redeem
 *               sessionId:
 *                 type: string
 *                 description: Required session ID from customer approval
 *               customerPresent:
 *                 type: boolean
 *                 description: Optional flag to indicate customer is present at shop
 *               notes:
 *                 type: string
 *                 description: Optional notes about the redemption
 *           examples:
 *             customer-present:
 *               summary: Customer present redemption (still requires approval)
 *               value:
 *                 customerAddress: "0x1234567890123456789012345678901234567890"
 *                 amount: 50
 *                 sessionId: "session-uuid-12345"
 *                 customerPresent: true
 *                 notes: "Customer present at shop counter"
 *             remote:
 *               summary: Remote redemption
 *               value:
 *                 customerAddress: "0x1234567890123456789012345678901234567890"
 *                 amount: 50
 *                 sessionId: "session-uuid-12345"
 *     responses:
 *       200:
 *         description: Redemption processed successfully
 *       400:
 *         description: Invalid request or insufficient balance
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Shop or customer not found
 */
router.post('/:shopId/redeem',
  authMiddleware,
  requireShopOrAdmin,
  requireShopOwnership,
  validateRequired(['customerAddress', 'amount']),
  validateEthereumAddress('customerAddress'),
  validateNumeric('amount', 0.1, 1000),
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const { customerAddress, amount, notes, sessionId, immediateRedeem, customerPresent } = req.body;

      // SECURITY: All redemptions require customer approval via session
      // No immediate redemptions allowed - customer must always approve
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required. Customer must approve all redemptions for security.'
        });
      }
      
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      if (!shop.active || !shop.verified) {
        return res.status(400).json({
          success: false,
          error: 'Shop must be active and verified to process redemptions'
        });
      }

      // Prevent shop from redeeming from their own wallet
      if (shop.walletAddress.toLowerCase() === customerAddress.toLowerCase()) {
        return res.status(400).json({
          success: false,
          error: 'Cannot process redemption from your own wallet address'
        });
      }

      const customer = await customerRepository.getCustomer(customerAddress);
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      // Validate and consume redemption session (required for all redemptions)
      const { redemptionSessionService } = await import('../../token/services/RedemptionSessionService');
      let consumedSession;
      try {
        consumedSession = await redemptionSessionService.validateAndConsumeSession(sessionId, shopId, amount);
        logger.info('Redemption session validated and consumed', {
          sessionId,
          customerAddress: consumedSession.customerAddress,
          shopId,
          amount,
          processedBy: req.user?.address
        });
      } catch (sessionError) {
        return res.status(400).json({
          success: false,
          error: sessionError instanceof Error ? sessionError.message : 'Invalid or expired session'
        });
      }

      // Use centralized verification service to check if redemption is allowed
      // This prevents market-bought RCN from being redeemed at shops
      const { verificationService } = await import('../../token/services/VerificationService');
      const verification = await verificationService.verifyRedemption(
        customerAddress,
        shopId,
        amount
      );

      if (!verification.canRedeem) {
        return res.status(400).json({
          success: false,
          error: verification.message,
          data: {
            availableBalance: verification.availableBalance,
            maxRedeemable: verification.maxRedeemable,
            isHomeShop: verification.isHomeShop,
            crossShopLimit: verification.crossShopLimit
          }
        });
      }

      // Now process the actual redemption with smart token prioritization
      let amountFromBlockchain = 0;
      let amountFromDatabase = 0;
      let transactionHash = '';
      let burnSuccessful = false;
      
      try {
        const blockchainEnabled = process.env.ENABLE_BLOCKCHAIN_MINTING === 'true';
        if (blockchainEnabled) {
          const onChainBalance = await getTokenMinter().getCustomerBalance(customerAddress);
          
          if (onChainBalance && onChainBalance > 0) {
            // Calculate how much to burn from blockchain vs database
            amountFromBlockchain = Math.min(onChainBalance, amount);
            amountFromDatabase = amount - amountFromBlockchain;
            
            // Burn available blockchain tokens
            const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
            const burnResult = await getTokenMinter().burnTokensFromCustomer(
              customerAddress,
              amountFromBlockchain,
              BURN_ADDRESS,
              `Redemption at ${shop.name}`
            );
            
            if (burnResult.success) {
              burnSuccessful = true;
              transactionHash = burnResult.transactionHash || '';
              
              logger.info('Tokens burned from blockchain during redemption', {
                customerAddress,
                blockchainAmount: amountFromBlockchain,
                databaseAmount: amountFromDatabase,
                totalAmount: amount,
                transactionHash
              });
            } else {
              // Burn failed, deduct full amount from database
              amountFromBlockchain = 0;
              amountFromDatabase = amount;
              logger.warn('Blockchain burn failed, falling back to database deduction', {
                customerAddress,
                amount
              });
            }
          } else {
            // No blockchain tokens, deduct from database
            amountFromDatabase = amount;
            logger.info('No blockchain tokens available, using database balance', {
              customerAddress,
              amount,
              onChainBalance: onChainBalance || 0
            });
          }
        } else {
          // Blockchain disabled, use database only
          amountFromDatabase = amount;
        }
      } catch (burnError) {
        logger.error('Token burn error during redemption, using database balance', burnError);
        amountFromBlockchain = 0;
        amountFromDatabase = amount;
      }

      // Only record database transaction if we're deducting from database balance
      if (amountFromDatabase > 0) {
        const transactionRecord = {
          id: `redeem_${Date.now()}`,
          type: 'redeem' as const,
          customerAddress: customerAddress.toLowerCase(),
          shopId,
          amount: amountFromDatabase, // Only deduct the database portion
          reason: `Redemption at ${shop.name}`,
          transactionHash,
          timestamp: new Date().toISOString(),
          status: 'confirmed' as const,
          metadata: {
            repairAmount: amount,
            referralId: undefined,
            engagementType: 'redemption',
            redemptionLocation: shop.name,
            webhookId: `redeem_${Date.now()}`,
            burnSuccessful,
            notes: notes || undefined,
            redemptionFlow: 'session-based',
            customerPresent: customerPresent === true,
            sessionId: sessionId,
            amountFromBlockchain,
            amountFromDatabase,
            redemptionStrategy: amountFromBlockchain > 0 ? (amountFromDatabase > 0 ? 'hybrid' : 'blockchain_only') : 'database_only'
          }
        };

        await transactionRepository.recordTransaction(transactionRecord);
      } else {
        // Pure blockchain redemption - no database transaction needed
        logger.info('Pure blockchain redemption completed, no database transaction recorded', {
          sessionId,
          customerAddress,
          amount,
          transactionHash
        });
      }

      // Update shop statistics (statistics update is still needed for shop analytics)
      await shopRepository.updateShop(shopId, {
        totalRedemptions: shop.totalRedemptions + amount,
        lastActivity: new Date().toISOString()
      });

      // Customer balance is updated via the transaction record above
      
      logger.info('Token redemption processed', {
        shopId,
        totalAmount: amount,
        amountFromBlockchain,
        amountFromDatabase,
        burnSuccessful,
        transactionHash,
        strategy: amountFromBlockchain > 0 ? (amountFromDatabase > 0 ? 'hybrid' : 'blockchain_only') : 'database_only',
        customerAddress,
        processedBy: req.user?.address
      });

      res.json({
        success: true,
        data: {
          transactionId: amountFromDatabase > 0 ? `redeem_${Date.now()}` : null,
          amount,
          customerTier: customer.tier,
          isHomeShop: verification.isHomeShop,
          amountFromBlockchain,
          amountFromDatabase,
          burnSuccessful,
          transactionHash,
          redemptionStrategy: amountFromBlockchain > 0 ? (amountFromDatabase > 0 ? 'hybrid' : 'blockchain_only') : 'database_only',
          shop: {
            name: shop.name,
            shopId
          }
        },
        message: `Successfully redeemed ${amount} RCN at ${shop.name}`
      });

    } catch (error: any) {
      logger.error('Redemption processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process redemption'
      });
    }
  }
);

// Get customers who have earned from this shop
router.get('/:shopId/customers',
  authMiddleware,
  requireShopOrAdmin,
  requireShopOwnership,
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const { page = 1, limit = 50, search = '' } = req.query;
      
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      // Get customers who have earned from this shop
      const customers = await shopRepository.getShopCustomers(
        shopId,
        {
          page: Number(page),
          limit: Number(limit),
          search: search as string
        }
      );

      res.json({
        success: true,
        data: customers
      });

    } catch (error) {
      logger.error('Get shop customers error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get shop customers'
      });
    }
  }
);

// Get customer growth statistics
router.get('/:shopId/customer-growth',
  authMiddleware,
  requireShopOrAdmin,
  requireShopOwnership,
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const { period = '7d' } = req.query; // 7d, 30d, 90d
      
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      // Calculate growth statistics
      const growthStats = await shopRepository.getCustomerGrowthStats(shopId, period as string);

      res.json({
        success: true,
        data: growthStats
      });

    } catch (error) {
      logger.error('Get customer growth stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get customer growth statistics'
      });
    }
  }
);

// Get pending redemption sessions for a shop
router.get('/:shopId/pending-sessions',
  authMiddleware,
  requireShopOrAdmin,
  requireShopOwnership,
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      
      // Get all pending sessions for this shop
      const sessions = await redemptionSessionRepository.getShopPendingSessions(shopId);

      res.json({
        success: true,
        data: {
          sessions: sessions.map(session => ({
            sessionId: session.sessionId,
            customerAddress: session.customerAddress,
            maxAmount: session.maxAmount,
            status: session.status,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt
          }))
        }
      });

    } catch (error) {
      logger.error('Get pending sessions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get pending sessions'
      });
    }
  }
);

// Get shop QR code for redemptions (shop owner or admin)
router.get('/:shopId/qr-code',
  requireShopOrAdmin,
  requireShopOwnership,
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      // Generate QR code data for redemption
      const qrData = {
        type: 'repaircoin_redemption',
        shopId: shop.shopId,
        shopName: shop.name,
        timestamp: new Date().toISOString(),
        signature: `shop_${shopId}_${Date.now()}` // Simple signature for demo
      };

      res.json({
        success: true,
        data: {
          qrData: JSON.stringify(qrData),
          shop: {
            shopId: shop.shopId,
            name: shop.name,
            verified: shop.verified,
            crossShopEnabled: shop.crossShopEnabled
          }
        }
      });

    } catch (error: any) {
      logger.error('QR code generation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate QR code'
      });
    }
  }
);

// Update shop reimbursement address
router.put('/:shopId/reimbursement-address',
  requireShopOrAdmin,
  requireShopOwnership,
  validateRequired(['reimbursementAddress']),
  validateEthereumAddress('reimbursementAddress'),
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const { reimbursementAddress } = req.body;
      
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      await shopRepository.updateShop(shopId, {
        reimbursementAddress: reimbursementAddress.toLowerCase()
      });

      logger.info('Shop reimbursement address updated', {
        shopId,
        oldAddress: shop.reimbursementAddress,
        newAddress: reimbursementAddress,
        updatedBy: req.user?.address
      });

      res.json({
        success: true,
        message: 'Reimbursement address updated successfully'
      });

    } catch (error: any) {
      logger.error('Reimbursement address update error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update reimbursement address'
      });
    }
  }
);

// Issue reward to customer
router.post('/:shopId/issue-reward',
  authMiddleware,
  requireShopOrAdmin,
  requireShopOwnership,
  validateRequired(['customerAddress', 'repairAmount']),
  validateEthereumAddress('customerAddress'),
  validateNumeric('repairAmount', 1, 100000),
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const { customerAddress, repairAmount, skipTierBonus = false, customBaseReward, promoCode } = req.body;
      
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      if (!shop.active || !shop.verified) {
        return res.status(400).json({
          success: false,
          error: 'Shop must be active and verified to issue rewards'
        });
      }

      // Prevent shop from issuing rewards to themselves
      if (shop.walletAddress.toLowerCase() === customerAddress.toLowerCase()) {
        return res.status(400).json({
          success: false,
          error: 'Cannot issue rewards to your own wallet address'
        });
      }

      const customer = await customerRepository.getCustomer(customerAddress);
      if (!customer) {
        // Customer not found - require registration before issuing rewards
        // NOTE: Auto-creation disabled - customers must register first
        /* COMMENTED OUT - Auto-creation of customers
        try {
          await customerRepository.createCustomer({
            address: customerAddress.toLowerCase(),
            name: '',
            email: '',
            tier: 'BRONZE',
            lifetimeEarnings: 0,
            referralCount: 0,
            referralCode: `REF_${customerAddress.slice(-8).toUpperCase()}`,
            joinDate: new Date().toISOString(),
            lastEarnedDate: new Date().toISOString(),
            isActive: true
          });

          customer = await customerRepository.getCustomer(customerAddress);
          if (!customer) {
            throw new Error('Failed to create customer');
          }

          logger.info('Created new customer for reward', { customerAddress });
        } catch (createError) {
          logger.error('Failed to create customer:', createError);
          return res.status(500).json({
            success: false,
            error: 'Failed to create customer account'
          });
        }
        */
        return res.status(404).json({
          success: false,
          error: 'Customer not found. Customer must be registered before receiving rewards.'
        });
      }

      if (!customer.isActive) {
        return res.status(400).json({
          success: false,
          error: 'Cannot issue rewards to suspended customers'
        });
      }

      // Calculate base reward - use custom if provided, otherwise calculate based on repair amount
      let baseReward = 0;
      if (customBaseReward !== undefined && customBaseReward >= 0) {
        // Use custom base reward (can be any non-negative value)
        baseReward = customBaseReward;
      } else {
        // Standard calculation based on repair amount
        if (repairAmount >= 100) {
          baseReward = 15;
        } else if (repairAmount >= 50) {
          baseReward = 10;
        } else if (repairAmount >= 30) {
          baseReward = 5;
        } else {
          baseReward = 0; // Allow any repair amount, just no reward for under $30
        }
      }

      // Get tier bonus based on customer tier - updated values
      let tierBonus = 0;
      switch (customer.tier) {
        case 'BRONZE':
          tierBonus = 0;  // No bonus for Bronze
          break;
        case 'SILVER':
          tierBonus = 2;  // +2 RCN for Silver
          break;
        case 'GOLD':
          tierBonus = 5;  // +5 RCN for Gold
          break;
      }

      // Calculate promo code bonus if provided
      let promoBonus = 0;
      let promoCodeRecord = null;
      if (promoCode && promoCode.trim()) {
        try {
          const promoCodeService = new PromoCodeService();
          
          // Validate the promo code
          const validation = await promoCodeService.validatePromoCode(promoCode.trim(), shopId, customerAddress);
          if (validation.is_valid) {
            promoCodeRecord = { id: validation.promo_code_id, bonus_type: validation.bonus_type, bonus_value: validation.bonus_value };
            // Calculate bonus based on base reward + tier bonus
            const rewardBeforePromo = skipTierBonus ? baseReward : baseReward + tierBonus;
            const bonusResult = await promoCodeService.calculatePromoBonus(promoCode.trim(), shopId, customerAddress, rewardBeforePromo);
            promoBonus = bonusResult.bonusAmount;
            logger.info('Promo code applied', { 
              promoCode: promoCode.trim(), 
              promoBonus, 
              customerAddress, 
              shopId 
            });
          } else {
            logger.warn('Invalid promo code attempted', { 
              promoCode: promoCode.trim(), 
              reason: validation.error_message, 
              customerAddress, 
              shopId 
            });
            return res.status(400).json({
              success: false,
              error: `Invalid promo code: ${validation.error_message}`
            });
          }
        } catch (promoError: any) {
          logger.error('Promo code processing error:', {
            error: promoError.message,
            stack: promoError.stack,
            promoCode: promoCode?.trim(),
            shopId,
            customerAddress
          });
          
          // Provide detailed error message
          const errorDetails = promoError.message || 'Unknown error during promo code validation';
          
          return res.status(400).json({
            success: false,
            error: 'Failed to process promo code',
            details: errorDetails,
            promoCode: promoCode?.trim(),
            shopId
          });
        }
      }

      const totalReward = skipTierBonus ? baseReward + promoBonus : baseReward + tierBonus + promoBonus;

      // Check shop has sufficient purchased RCN balance (off-chain balance from database)
      const shopBalance = shop.purchasedRcnBalance || 0;
      
      // Debug logging
      logger.info('Balance check:', {
        shopId,
        shopBalance,
        totalReward,
        baseReward,
        tierBonus: skipTierBonus ? 0 : tierBonus,
        promoBonus,
        promoCode: promoCode || null,
        shopData: {
          purchasedRcnBalance: shop.purchasedRcnBalance,
          totalTokensIssued: shop.totalTokensIssued
        }
      });
      
      if (shopBalance < totalReward) {
        logger.warn('Insufficient shop balance', {
          shopId,
          required: totalReward,
          available: shopBalance
        });
        
        return res.status(400).json({
          success: false,
          error: 'Insufficient shop RCN balance',
          data: {
            required: totalReward,
            available: shopBalance,
            baseReward,
            tierBonus: skipTierBonus ? 0 : tierBonus,
            promoBonus,
            promoCode: promoCode || null
          }
        });
      }

      // No earning limits - customers can earn unlimited RCN

      // Process the reward - Transfer tokens on-chain AND deduct from shop's balance
      let transactionHash = `offchain_${Date.now()}`;
      let onChainSuccess = false;
      
      try {
        // Check if blockchain minting is enabled and attempt to mint
        const blockchainEnabled = process.env.ENABLE_BLOCKCHAIN_MINTING === 'true';
        
        if (blockchainEnabled) {
          try {
            const tokenMinter = getTokenMinter();
            
            // First try to transfer from admin wallet
            logger.info('Attempting token transfer from admin wallet...', {
              customerAddress,
              amount: totalReward
            });
            
            const transferResult = await tokenMinter.transferTokens(
              customerAddress,
              totalReward,
              `Shop ${shop.name} reward - $${repairAmount} repair`
            );
            
            if (transferResult.success && transferResult.transactionHash) {
              transactionHash = transferResult.transactionHash;
              onChainSuccess = true;
              logger.info('✅ On-chain token transfer successful', {
                customerAddress,
                amount: totalReward,
                txHash: transactionHash,
                method: 'transfer'
              });
            } else {
              // If transfer fails, try minting new tokens as fallback
              logger.warn('Transfer failed, attempting to mint new tokens...', {
                transferError: transferResult.error
              });
              
              const mintResult = await tokenMinter.adminMintTokens(
                customerAddress,
                totalReward,
                `Shop ${shop.name} reward - $${repairAmount} repair (mint fallback)`
              );
              
              if (mintResult.success && mintResult.transactionHash) {
                transactionHash = mintResult.transactionHash;
                onChainSuccess = true;
                logger.info('✅ On-chain token mint successful (fallback)', {
                  customerAddress,
                  amount: totalReward,
                  txHash: transactionHash,
                  method: 'mint'
                });
              } else {
                logger.error('❌ Both transfer and mint failed', {
                  transferError: transferResult.error,
                  mintError: mintResult.error,
                  customerAddress,
                  amount: totalReward
                });
              }
            }
          } catch (error) {
            logger.error('On-chain operation error, continuing with off-chain only', {
              error: error instanceof Error ? error.message : error,
              customerAddress,
              amount: totalReward
            });
          }
        } else {
          logger.info('Blockchain minting disabled - tracking tokens in database only', {
            customerAddress,
            amount: totalReward
          });
        }
        
        // Update shop's balance and statistics atomically
        await shopRepository.updateShop(shopId, {
          purchasedRcnBalance: shopBalance - totalReward,
          totalTokensIssued: (shop.totalTokensIssued || 0) + totalReward
        });
        
        logger.info('Shop balance updated after issuing reward', {
          shopId,
          previousBalance: shopBalance,
          rewardIssued: totalReward,
          newBalance: shopBalance - totalReward,
          onChainTransfer: onChainSuccess
        });
      } catch (updateError) {
        logger.error('Failed to update shop balance:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to process reward'
        });
      }

      // Calculate new tier after earning
      const updatedLifetimeEarnings = customer.lifetimeEarnings + totalReward;
      const newTier = getTierManager().calculateTier(updatedLifetimeEarnings);
      
      // Update customer earnings using the correct method
      await customerRepository.updateCustomerAfterEarning(
        customerAddress,
        totalReward,
        newTier
      );

      // Log transaction - wrap in try-catch to not fail the entire reward if logging fails
      try {
        await transactionRepository.recordTransaction({
          id: `${Date.now()}_${customerAddress}_${shopId}`,
          type: 'mint',
          customerAddress,
          shopId,
          amount: totalReward,
          reason: `Repair reward - $${repairAmount} repair`,
          transactionHash: transactionHash,
          timestamp: new Date().toISOString(),
          status: 'confirmed',
          metadata: {
            repairAmount,
            baseReward,
            tierBonus: skipTierBonus ? 0 : tierBonus,
            promoBonus,
            promoCode: promoCode || null
          }
        });
        logger.info('Transaction recorded successfully');

        // Record promo code usage if promo code was used
        if (promoCodeRecord && promoBonus > 0) {
          try {
            const promoCodeService = new PromoCodeService();
            const rewardBeforePromo = skipTierBonus ? baseReward : baseReward + tierBonus;
            
            await promoCodeService.recordPromoCodeUse(
              promoCodeRecord.id,
              customerAddress,
              shopId,
              rewardBeforePromo,
              promoBonus
            );
            logger.info('Promo code usage recorded successfully', { 
              promoCodeId: promoCodeRecord.id, 
              customerAddress, 
              promoBonus 
            });
          } catch (promoRecordError) {
            logger.error('Failed to record promo code usage:', promoRecordError);
            // Don't fail the transaction, just log the error
          }
        }
      } catch (txError) {
        // Log error but don't fail the reward since it was already processed
        logger.error('Failed to record transaction in database:', txError);
        logger.error('Transaction details that failed to record:', {
          id: `${Date.now()}_${customerAddress}_${shopId}`,
          transactionHash,
          amount: totalReward
        });
        // Continue execution - the reward was still issued successfully
      }

      // Tier update is already handled in updateCustomerAfterEarning

      // Check if this completes a referral (first repair for referred customer)
      let referralCompleted = false;
      let referralMessage = '';
      try {
        const referralResult = await getReferralService().completeReferralOnFirstRepair(
          customerAddress,
          shopId,
          repairAmount
        );
        referralCompleted = referralResult.referralCompleted || false;
        if (referralCompleted) {
          referralMessage = 'Referral bonus distributed! Referrer received 25 RCN, customer received additional 10 RCN.';
          logger.info('Referral completed on first repair', {
            customerAddress,
            shopId,
            repairAmount
          });
        }
      } catch (referralError) {
        // Log error but don't fail the repair reward
        logger.error('Error checking referral completion:', referralError);
      }

      logger.info('Reward issued successfully', {
        shopId,
        customerAddress,
        repairAmount,
        baseReward,
        tierBonus: skipTierBonus ? 0 : tierBonus,
        promoBonus,
        promoCode: promoCode || null,
        totalReward: totalReward,
        txHash: transactionHash,
        referralCompleted
      });

      // Emit event for notification system
      try {
        await eventBus.publish({
          type: 'shop:reward_issued',
          aggregateId: shopId,
          data: {
            shopAddress: shop.walletAddress,
            customerAddress,
            shopName: shop.name,
            amount: totalReward,
            transactionId: transactionHash
          },
          timestamp: new Date(),
          source: 'ShopRoutes',
          version: 1
        });
      } catch (eventError) {
        logger.error('Failed to emit reward_issued event:', eventError);
      }

      res.json({
        success: true,
        data: {
          baseReward,
          tierBonus: skipTierBonus ? 0 : tierBonus,
          promoBonus,
          promoCode: promoCode || null,
          totalReward: totalReward,
          txHash: transactionHash,
          onChainTransfer: onChainSuccess,
          customerNewBalance: customer.lifetimeEarnings + totalReward,
          shopNewBalance: shopBalance - totalReward,
          referralCompleted,
          referralMessage,
          message: onChainSuccess
            ? `Successfully issued ${totalReward} RCN tokens to customer wallet`
            : `Reward recorded (${totalReward} RCN) - tokens will be distributed later`
        }
      });

    } catch (error: any) {
      logger.error('Issue reward error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to issue reward'
      });
    }
  }
);

// Get shop purchases with date filtering
router.get('/:shopId/purchases',
  authMiddleware,
  requireShopOrAdmin,
  requireShopOwnership,
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 1000; // High limit for chart data
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const purchaseHistory = await shopRepository.getShopPurchaseHistory(shopId, {
        page,
        limit,
        orderBy: 'created_at',
        orderDirection: 'desc',
        startDate,
        endDate
      });

      res.json({
        success: true,
        data: {
          items: purchaseHistory.items,
          pagination: {
            page: purchaseHistory.page,
            limit: purchaseHistory.limit,
            totalItems: purchaseHistory.total,
            totalPages: purchaseHistory.totalPages,
            hasMore: purchaseHistory.hasMore
          }
        }
      });
    } catch (error: any) {
      logger.error('Error getting shop purchases:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve purchase history'
      });
    }
  }
);

// Get shop transactions
router.get('/:shopId/transactions',
  authMiddleware,
  requireShopOrAdmin,
  requireShopOwnership,
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const type = req.query.type as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      
      let allTransactions: any[] = [];
      
      // Get regular transactions if not filtering by purchase
      if (type !== 'purchases') {
        try {
          const transactions = await transactionRepository.getShopTransactions(shopId, {
            page,
            limit,
            type,
            startDate,
            endDate
          });
          
          // Transform to match frontend expectations
          const transformedTransactions = transactions.items.map((t: any) => ({
            id: t.id,
            type: t.type === 'mint' ? 'reward' : t.type === 'redeem' ? 'redemption' : t.type,
            amount: parseFloat(t.amount),
            customerAddress: t.customer_address,
            customerName: t.customer_name,
            repairAmount: t.metadata?.repairAmount,
            status: t.status || 'completed',
            createdAt: t.timestamp || t.created_at,
            failureReason: t.error_message,
            is_tier_bonus: t.metadata?.tierBonus > 0
          }));
          
          allTransactions = [...transformedTransactions];
        } catch (error: any) {
          // If transactions table doesn't exist or has missing columns, return empty array
          logger.warn(`Could not fetch transactions for shop ${shopId}:`, error.message);
          allTransactions = [];
        }
      }
      
      // Get RCN purchases if showing all or purchases
      if (!type || type === 'all' || type === 'purchases') {
        try {
          const purchaseHistory = await shopRepository.getShopPurchaseHistory(shopId, {
            page: 1,
            limit: 100,
            orderBy: 'created_at',
            orderDirection: 'desc'
          });
          
          // Transform purchases to match transaction format
          const purchaseTransactions = purchaseHistory.items.map((p: any) => ({
            id: p.id,
            type: 'purchase',
            amount: parseFloat(p.amount),
            customerAddress: null,
            customerName: 'RCN Purchase',
            repairAmount: null,
            status: p.status,
            createdAt: p.created_at,
            failureReason: null,
            is_tier_bonus: false,
            totalCost: parseFloat(p.total_cost),
            paymentMethod: p.payment_method,
            paymentReference: p.payment_reference
          }));
          
          allTransactions = [...allTransactions, ...purchaseTransactions];
        } catch (error: any) {
          // If shop_rcn_purchases table doesn't exist, continue without purchase history
          logger.warn(`Could not fetch purchase history for shop ${shopId}:`, error.message);
        }
      }
      
      // Sort all transactions by date
      allTransactions.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // Newest first
      });
      
      // Apply pagination
      const startIndex = (page - 1) * limit;
      const paginatedTransactions = allTransactions.slice(startIndex, startIndex + limit);
      const totalItems = allTransactions.length;
      const totalPages = Math.ceil(totalItems / limit);
      
      res.json({
        success: true,
        data: {
          transactions: paginatedTransactions,
          total: totalItems,
          totalPages: totalPages,
          page: page
        }
      });

    } catch (error: any) {
      logger.error('Error getting shop transactions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve shop transactions'
      });
    }
  }
);

// Mount RCG routes
router.use('/', rcgRoutes);

// Mount subscription routes
import subscriptionRoutes, { publicRouter as subscriptionPublicRoutes } from './subscription';
router.use('/', subscriptionPublicRoutes); // Mount public routes first (no auth)
router.use('/', subscriptionRoutes); // Then mount authenticated routes

// Mount webhook routes - MUST BE PUBLIC FOR STRIPE
import webhookRoutes from './webhooks';

// Create a public router for webhooks (no auth)
const publicRouter = Router();
publicRouter.use('/webhooks', webhookRoutes);

// Mount promo code routes
import promoCodeRoutes from './promoCodes';
router.use('/', promoCodeRoutes);

// Export both routers
export default router;
export { publicRouter };