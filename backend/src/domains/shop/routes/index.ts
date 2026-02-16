// backend/src/routes/shops.ts
import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole, requireShopOrAdmin, requireShopOwnership, requireActiveSubscription } from '../../../middleware/auth';
import { optionalAuthMiddleware } from '../../../middleware/optionalAuth';
import { validateRequired, validateEthereumAddress, validateEmail, validateNumeric, validateStringType } from '../../../middleware/errorHandler';
import { validateShopUniqueness } from '../../../middleware/validation';
import { verifyCaptchaRegister } from '../../../middleware/captcha';
import {
  shopRepository,
  customerRepository,
  transactionRepository,
  redemptionSessionRepository
} from '../../../repositories';
import { idempotencyRepository } from '../../../repositories/IdempotencyRepository';
import { TokenMinter } from '../../../contracts/TokenMinter';
import { TierManager } from '../../../contracts/TierManager';
import { logger } from '../../../utils/logger';
import { DatabaseService } from '../../../services/DatabaseService';
import { RoleValidator } from '../../../utils/roleValidator';
import { validateShopRoleConflict } from '../../../middleware/roleConflictValidator';
import { ReferralService } from '../../../services/ReferralService';
import { PromoCodeService } from '../../../services/PromoCodeService';
import { PromoCodeRepository } from '../../../repositories/PromoCodeRepository';
import rcgRoutes from './rcg';
import { eventBus } from '../../../events/EventBus';
import { getSharedPool } from '../../../utils/database-pool';

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
  avgRating?: number;
  totalReviews?: number;
}

// Import new route modules
import purchaseRoutes from './purchase';
import tierBonusRoutes from './tierBonus';
import depositRoutes from './deposit';
import purchaseSyncRoutes from './purchase-sync';

const router = Router();

// Register sub-routes (protected by auth)
// Purchase routes - auth required, but subscription only for purchase operations (not viewing history/balance)
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
      category: shop.category,
      logoUrl: shop.logoUrl,
      bannerUrl: shop.bannerUrl,
      aboutText: shop.aboutText,
      avgRating: shop.avgRating || 0,
      totalReviews: shop.totalReviews || 0
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
router.get('/:shopId', optionalAuthMiddleware, async (req: Request, res: Response) => {
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
        category: shop.category,
        logoUrl: shop.logoUrl,
        bannerUrl: shop.bannerUrl,
        aboutText: shop.aboutText
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

// Get shop by wallet address (with email fallback for social login)
router.get('/wallet/:address',
  async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const { email } = req.query; // Optional email for social login fallback

      // Validate Ethereum address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Ethereum address format'
        });
      }

      let shop = await shopRepository.getShopByWallet(address);
      let linkedByEmail = false;

      // EMAIL FALLBACK: If not found by wallet but email provided, try email lookup
      // This enables shops registered with MetaMask to login via Google/social auth
      if (!shop && email && typeof email === 'string' && email.includes('@')) {
        shop = await shopRepository.getShopByEmail(email);
        if (shop) {
          linkedByEmail = true;
          logger.info('Shop found by email fallback', {
            email,
            shopId: shop.shopId,
            originalWallet: shop.walletAddress,
            requestedWallet: address
          });
        }
      }

      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      // Fetch subscription status from shop_subscriptions table
      const db = DatabaseService.getInstance();
      const subQuery = await db.query(
        'SELECT status FROM shop_subscriptions WHERE shop_id = $1 ORDER BY enrolled_at DESC LIMIT 1',
        [shop.shopId]
      );
      const subscriptionStatus = subQuery.rows.length > 0 ? subQuery.rows[0].status : null;

      // Check Stripe subscription and ensure operational_status is correct
      // This fixes cases where operational_status gets out of sync with actual subscription
      const stripeSubQuery = await db.query(
        `SELECT status FROM stripe_subscriptions
         WHERE shop_id = $1 AND status IN ('active', 'past_due', 'unpaid')
         ORDER BY created_at DESC LIMIT 1`,
        [shop.shopId]
      );

      const hasActiveStripeSubscription = stripeSubQuery.rows.length > 0;

      // Get actual on-chain RCG balance (not cached database value)
      // This ensures operational_status is based on real blockchain holdings
      let rcgBalance = shop.rcg_balance || 0;
      if (shop.walletAddress) {
        try {
          const { RCGTokenReader } = await import('../../../contracts/RCGTokenReader');
          const rcgReader = new RCGTokenReader();
          const onChainBalance = await rcgReader.getBalance(shop.walletAddress);
          rcgBalance = parseFloat(onChainBalance) || 0;

          // Update cached balance in database if different
          if (rcgBalance !== (shop.rcg_balance || 0)) {
            await db.query(
              `UPDATE shops SET rcg_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE shop_id = $2`,
              [rcgBalance, shop.shopId]
            );
            shop.rcg_balance = rcgBalance;
            logger.info('Synced RCG balance from blockchain', {
              shopId: shop.shopId,
              oldBalance: shop.rcg_balance,
              newBalance: rcgBalance
            });
          }
        } catch (rcgError) {
          logger.warn('Failed to fetch on-chain RCG balance, using cached value', {
            shopId: shop.shopId,
            error: rcgError instanceof Error ? rcgError.message : 'Unknown error'
          });
        }
      }

      const expectedOperationalStatus = hasActiveStripeSubscription
        ? 'subscription_qualified'
        : (rcgBalance >= 10000 ? 'rcg_qualified' : 'not_qualified');

      // If operational_status is out of sync, update it
      // Don't override 'paused' status (admin manually paused)
      const currentStatus = shop.operational_status as string;
      if (currentStatus !== expectedOperationalStatus &&
          currentStatus !== 'paused') {
        const oldStatus = shop.operational_status;
        await db.query(
          `UPDATE shops SET operational_status = $1, updated_at = CURRENT_TIMESTAMP WHERE shop_id = $2`,
          [expectedOperationalStatus, shop.shopId]
        );
        shop.operational_status = expectedOperationalStatus;

        logger.info('Fixed operational_status mismatch on shop data fetch', {
          shopId: shop.shopId,
          oldStatus,
          newStatus: expectedOperationalStatus,
          hasActiveStripeSubscription,
          rcgBalance
        });
      }

      // Construct proper location object with coordinates
      const locationData = {
        lat: shop.locationLat,
        lng: shop.locationLng,
        city: shop.locationCity,
        state: shop.locationState,
        zipCode: shop.locationZipCode
      };

      // Different data based on user role
      let shopData;
      if (req.user?.role === 'admin' || (req.user?.role === 'shop' && req.user.shopId === shop.shopId)) {
        // Full data for admin or shop owner
        shopData = {
          ...shop,
          location: locationData,
          subscriptionStatus
        };
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
          location: locationData,
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
          subscriptionStatus,
          // Include suspension information (needed for frontend modal)
          suspendedAt: shop.suspendedAt,
          suspensionReason: shop.suspensionReason,
          // Include social media fields
          facebook: shop.facebook,
          twitter: shop.twitter,
          instagram: shop.instagram,
          // Add other fields as needed
          website: shop.website,
          logoUrl: shop.logoUrl,
          bannerUrl: shop.bannerUrl,
          aboutText: shop.aboutText,
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
        linkedByEmail, // True if shop was found via email fallback (social login)
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
  verifyCaptchaRegister, // CAPTCHA verification
  validateRequired(['shopId', 'name', 'address', 'phone', 'email', 'walletAddress']),
  validateStringType('shopId'),
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
        reimbursementAddress: (reimbursementAddress || walletAddress).toLowerCase(),
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
        logoUrl,
        bannerUrl,
      } = req.body;

      logger.info('Shop details update request received:', {
        shopId,
        requestBody: req.body,
        userId: req.user?.address,
        logoUrl: logoUrl,
        bannerUrl: bannerUrl
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
        logoUrl?: string;
        bannerUrl?: string;
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
      if (logoUrl !== undefined) updates.logoUrl = logoUrl;
      if (bannerUrl !== undefined) updates.bannerUrl = bannerUrl;

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
  requireActiveSubscription(), // Enforce subscription for processing redemptions
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

      if (!customer.isActive) {
        return res.status(400).json({
          success: false,
          error: 'Cannot process redemption for suspended customers'
        });
      }

      // STEP 1: Validate session ONLY (don't consume yet - we'll do that atomically)
      const { redemptionSessionService } = await import('../../token/services/RedemptionSessionService');
      let validatedSession;
      try {
        validatedSession = await redemptionSessionService.validateSessionOnly(sessionId, shopId, amount);
        logger.info('Redemption session validated (not consumed yet)', {
          sessionId,
          customerAddress: validatedSession.customerAddress,
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

      // STEP 2: Use centralized verification service to check if redemption is allowed
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

      // STEP 3: Process blockchain operations with intent recording for atomicity
      // We record intent BEFORE blockchain burn so that if DB fails after burn, we can recover
      let amountFromBlockchain = 0;
      let amountFromDatabase = 0;
      let transactionHash = '';
      let burnSuccessful = false;
      let pendingTransactionId: string | number | null = null;

      try {
        const blockchainEnabled = process.env.ENABLE_BLOCKCHAIN_MINTING === 'true';
        if (blockchainEnabled) {
          const onChainBalance = await getTokenMinter().getCustomerBalance(customerAddress);

          if (onChainBalance && onChainBalance > 0) {
            // Calculate how much to burn from blockchain vs database
            amountFromBlockchain = Math.min(onChainBalance, amount);
            amountFromDatabase = amount - amountFromBlockchain;

            // CRITICAL: Record intent BEFORE blockchain burn
            // This ensures we have a record even if DB fails after burn
            const pendingTx = await transactionRepository.createPendingTransaction({
              type: 'redeem' as const,
              customerAddress: customerAddress.toLowerCase(),
              shopId,
              amount: amountFromBlockchain,
              reason: `Blockchain redemption at ${shop.name}`,
              timestamp: new Date().toISOString(),
              status: 'pending' as const,
              metadata: {
                sessionId,
                redemptionLocation: shop.name,
                engagementType: 'blockchain_redemption',
                amountFromBlockchain,
                amountFromDatabase,
                requiresReconciliation: true, // Flag for recovery if DB fails
                burnAttemptedAt: new Date().toISOString()
              }
            });
            pendingTransactionId = pendingTx.id!;

            logger.info('Pending blockchain burn transaction recorded', {
              transactionId: pendingTransactionId,
              customerAddress,
              amountFromBlockchain,
              sessionId
            });

            // Now attempt blockchain burn
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

              // Update pending transaction with burn result
              await transactionRepository.confirmTransaction(pendingTransactionId, {
                transactionHash,
                metadata: {
                  burnSuccessful: true,
                  burnCompletedAt: new Date().toISOString(),
                  requiresReconciliation: false // Burn succeeded, clear flag
                }
              });

              logger.info('Tokens burned from blockchain during redemption', {
                transactionId: pendingTransactionId,
                customerAddress,
                blockchainAmount: amountFromBlockchain,
                databaseAmount: amountFromDatabase,
                totalAmount: amount,
                transactionHash
              });
            } else {
              // Burn failed, mark transaction as failed and fall back to database
              await transactionRepository.failTransaction(
                pendingTransactionId,
                'Blockchain burn failed, falling back to database deduction'
              );
              amountFromBlockchain = 0;
              amountFromDatabase = amount;
              pendingTransactionId = null; // Clear so we don't try to update it later
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
        // If we recorded a pending transaction, mark it as failed
        if (pendingTransactionId) {
          try {
            await transactionRepository.failTransaction(
              pendingTransactionId,
              burnError instanceof Error ? burnError.message : 'Unknown blockchain error'
            );
          } catch (failError) {
            logger.error('Failed to mark pending transaction as failed', {
              transactionId: pendingTransactionId,
              error: failError
            });
          }
        }
        logger.error('Token burn error during redemption, using database balance', burnError);
        amountFromBlockchain = 0;
        amountFromDatabase = amount;
        pendingTransactionId = null;
      }

      // STEP 4: ATOMIC TRANSACTION - Record transaction, update shop stats, and mark session as used
      // All these operations happen together or none of them do
      const pool = getSharedPool();
      const dbClient = await pool.connect();

      try {
        await dbClient.query('BEGIN');

        logger.info('Starting atomic redemption transaction', {
          sessionId,
          customerAddress,
          shopId,
          amount,
          amountFromDatabase,
          amountFromBlockchain
        });

        // 4a. Record the redemption transaction (ALWAYS record for history, regardless of source)
        const transactionRecord = {
          id: `redeem_${Date.now()}`,
          type: 'redeem' as const,
          customerAddress: customerAddress.toLowerCase(),
          shopId,
          amount: amount, // Record the TOTAL amount redeemed (for history purposes)
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

        await transactionRepository.recordTransaction(transactionRecord, dbClient);
        logger.info('Transaction recorded within atomic transaction', { sessionId, totalAmount: amount });

        // 4b. Update shop statistics
        const previousShopBalance = shop.purchasedRcnBalance || 0;
        const newShopBalance = previousShopBalance + amount;

        await shopRepository.updateShop(shopId, {
          totalRedemptions: (shop.totalRedemptions || 0) + amount,
          purchasedRcnBalance: newShopBalance,
          lastActivity: new Date().toISOString()
        }, dbClient);

        logger.info('Shop statistics updated within atomic transaction', {
          shopId,
          previousBalance: previousShopBalance,
          newBalance: newShopBalance
        });

        // 4c. Mark session as used ONLY after transaction and stats are recorded
        await redemptionSessionRepository.updateSessionStatus(sessionId, 'used', undefined, dbClient);
        logger.info('Session marked as used within atomic transaction', { sessionId });

        // COMMIT the transaction - all operations succeed together
        await dbClient.query('COMMIT');

        logger.info('Atomic redemption transaction committed successfully', {
          sessionId,
          customerAddress,
          shopId,
          amount
        });

      } catch (atomicError) {
        // ROLLBACK - if any operation fails, none of them take effect
        await dbClient.query('ROLLBACK');

        logger.error('Atomic redemption transaction failed, rolling back', {
          sessionId,
          customerAddress,
          shopId,
          amount,
          error: atomicError instanceof Error ? atomicError.message : 'Unknown error'
        });

        // If blockchain burn succeeded but database failed, update the pending transaction
        // to mark it as requiring reconciliation (the burn is already recorded there)
        if (burnSuccessful && amountFromBlockchain > 0 && pendingTransactionId) {
          logger.error('CRITICAL: Blockchain burn succeeded but database transaction failed', {
            sessionId,
            customerAddress,
            amountBurned: amountFromBlockchain,
            transactionHash,
            pendingTransactionId,
            recoveryAction: 'Transaction already recorded as pending with requiresReconciliation flag'
          });

          // Update the pending transaction to indicate DB failure
          // This allows admin to reconcile later
          try {
            await transactionRepository.confirmTransaction(pendingTransactionId, {
              transactionHash,
              metadata: {
                burnSuccessful: true,
                requiresReconciliation: true,
                dbFailedAt: new Date().toISOString(),
                dbFailureReason: atomicError instanceof Error ? atomicError.message : 'Unknown error',
                shopStatsPending: true,
                sessionMarkPending: true
              }
            });
            logger.info('Pending transaction updated with reconciliation data', {
              pendingTransactionId,
              transactionHash
            });
          } catch (updateError) {
            logger.error('Failed to update pending transaction for reconciliation', {
              pendingTransactionId,
              error: updateError
            });
          }
        }

        throw atomicError;
      } finally {
        dbClient.release();
      }

      logger.info('Shop balance credited from redemption', {
        shopId,
        previousBalance: shop.purchasedRcnBalance || 0,
        creditedAmount: amount,
        newBalance: (shop.purchasedRcnBalance || 0) + amount
      });

      // Note: Customer is automatically added to shop's customer list via the redeem transaction
      // The getShopCustomers query now includes customers who have earned OR redeemed at the shop

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
  requireActiveSubscription(), // Enforce subscription for issuing rewards
  validateRequired(['customerAddress', 'repairAmount']),
  validateEthereumAddress('customerAddress'),
  validateNumeric('repairAmount', 1, 100000),
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const { customerAddress, repairAmount, skipTierBonus = false, customBaseReward, promoCode } = req.body;

      // Check for idempotency key to prevent duplicate rewards
      const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;
      if (idempotencyKey) {
        const idempotencyCheck = await idempotencyRepository.checkIdempotencyKey(
          idempotencyKey,
          shopId,
          req.body,
          'issue-reward'
        );

        if (idempotencyCheck.exists) {
          if (idempotencyCheck.hashMismatch) {
            // Same idempotency key but different request body - this is an error
            return res.status(422).json({
              success: false,
              error: 'Idempotency key already used with different request parameters'
            });
          }

          // Return cached response (duplicate request)
          logger.info('Returning cached idempotency response', { idempotencyKey, shopId });
          return res.status(idempotencyCheck.response!.status).json(idempotencyCheck.response!.body);
        }
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
      // Uses atomic validation + reservation to prevent race conditions (Bug #4 fix)
      let promoBonus = 0;
      let promoReservation: { promoCodeId: number; reservationId: number; bonusAmount: number } | null = null;
      if (promoCode && promoCode.trim()) {
        try {
          const promoCodeRepo = new PromoCodeRepository();

          // Calculate base reward before promo for percentage calculations
          const rewardBeforePromo = skipTierBonus ? baseReward : baseReward + tierBonus;

          // ATOMIC: Validate AND reserve promo code in single transaction
          // This prevents race conditions where concurrent requests could use the same single-use code
          const atomicResult = await promoCodeRepo.validateAndReserveAtomic(
            promoCode.trim(),
            shopId,
            customerAddress,
            rewardBeforePromo
          );

          if (atomicResult.isValid) {
            promoBonus = atomicResult.bonusAmount;
            promoReservation = {
              promoCodeId: atomicResult.promoCodeId!,
              reservationId: atomicResult.reservationId!,
              bonusAmount: atomicResult.bonusAmount
            };
            logger.info('Promo code validated and reserved atomically', {
              promoCode: promoCode.trim(),
              promoBonus,
              reservationId: atomicResult.reservationId,
              customerAddress,
              shopId
            });
          } else {
            logger.warn('Invalid promo code attempted', {
              promoCode: promoCode.trim(),
              reason: atomicResult.errorMessage,
              customerAddress,
              shopId
            });
            return res.status(400).json({
              success: false,
              error: `Invalid promo code: ${atomicResult.errorMessage}`
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

      // No earning limits - customers can earn unlimited RCN

      // Calculate new tier after earning (needed for atomic operation)
      const updatedLifetimeEarnings = customer.lifetimeEarnings + totalReward;
      const newTier = getTierManager().calculateTier(updatedLifetimeEarnings);

      // Debug logging before reward issuance
      logger.info('Attempting reward issuance:', {
        shopId,
        totalReward,
        baseReward,
        tierBonus: skipTierBonus ? 0 : tierBonus,
        promoBonus,
        promoCode: promoCode || null
      });

      // STEP 1: Process blockchain operations FIRST (before any DB changes)
      // This way, if blockchain fails, we haven't modified any DB state
      let transactionHash = `offchain_${Date.now()}`;
      let onChainSuccess = false;

      try {
        const blockchainEnabled = process.env.ENABLE_BLOCKCHAIN_MINTING === 'true';

        if (blockchainEnabled) {
          try {
            const tokenMinter = getTokenMinter();

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
      } catch (blockchainError) {
        // Blockchain operations failed - continue with off-chain tracking
        logger.error('Blockchain operation failed:', blockchainError);
      }

      // STEP 2: ATOMIC DATABASE OPERATIONS
      // All DB changes (shop balance deduction, customer credit, transaction record)
      // happen in a single transaction - if any fails, ALL are rolled back
      let atomicResult: {
        success: boolean;
        shopPreviousBalance: number;
        shopNewBalance: number;
        customerPreviousBalance: number;
        customerNewBalance: number;
        transactionId: string;
      };

      try {
        atomicResult = await shopRepository.issueRewardAtomic(
          shopId,
          customerAddress,
          totalReward,
          {
            transactionHash,
            repairAmount,
            baseReward,
            tierBonus: skipTierBonus ? 0 : tierBonus,
            promoBonus,
            promoCode: promoCode || null,
            newTier
          }
        );

        logger.info('Atomic reward issuance completed', {
          shopId,
          customerAddress,
          shopPreviousBalance: atomicResult.shopPreviousBalance,
          shopNewBalance: atomicResult.shopNewBalance,
          customerPreviousBalance: atomicResult.customerPreviousBalance,
          customerNewBalance: atomicResult.customerNewBalance,
          transactionId: atomicResult.transactionId,
          totalReward,
          onChainTransfer: onChainSuccess
        });
      } catch (atomicError: any) {
        // Rollback promo code reservation if reward issuance failed
        if (promoReservation) {
          try {
            const promoCodeRepo = new PromoCodeRepository();
            await promoCodeRepo.rollbackReservation(
              promoReservation.reservationId,
              promoReservation.promoCodeId,
              promoReservation.bonusAmount
            );
            logger.info('Promo code reservation rolled back due to reward failure', {
              reservationId: promoReservation.reservationId,
              promoCodeId: promoReservation.promoCodeId
            });
          } catch (rollbackError) {
            logger.error('Failed to rollback promo code reservation:', rollbackError);
          }
        }

        // Check if it's an insufficient balance error
        if (atomicError.message && atomicError.message.includes('Insufficient balance')) {
          logger.warn('Insufficient shop balance (atomic check)', {
            shopId,
            required: totalReward,
            error: atomicError.message
          });

          const availableMatch = atomicError.message.match(/available (\d+\.?\d*)/);
          const available = availableMatch ? parseFloat(availableMatch[1]) : 0;

          return res.status(400).json({
            success: false,
            error: 'Insufficient shop RCN balance',
            data: {
              required: totalReward,
              available: available,
              baseReward,
              tierBonus: skipTierBonus ? 0 : tierBonus,
              promoBonus,
              promoCode: promoCode || null
            }
          });
        }

        // Customer not found error
        if (atomicError.message && atomicError.message.includes('Customer not found')) {
          logger.error('Customer not found during atomic reward:', atomicError);
          return res.status(404).json({
            success: false,
            error: 'Customer not found'
          });
        }

        // Shop not found error
        if (atomicError.message && atomicError.message.includes('Shop not found')) {
          logger.error('Shop not found during atomic reward:', atomicError);
          return res.status(404).json({
            success: false,
            error: 'Shop not found'
          });
        }

        // Other database errors - ALL changes rolled back
        logger.error('Atomic reward issuance failed - ALL changes rolled back:', atomicError);
        return res.status(500).json({
          success: false,
          error: 'Failed to process reward - database error (no changes made)'
        });
      }

      // Note: Promo code usage is now recorded atomically during validateAndReserveAtomic()
      // No separate recordPromoCodeUse call needed (Bug #4 fix)

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

      const successResponse = {
        success: true,
        data: {
          baseReward,
          tierBonus: skipTierBonus ? 0 : tierBonus,
          promoBonus,
          promoCode: promoCode || null,
          totalReward: totalReward,
          txHash: transactionHash,
          onChainTransfer: onChainSuccess,
          customerNewBalance: atomicResult.customerNewBalance,
          shopNewBalance: atomicResult.shopNewBalance,
          referralCompleted,
          referralMessage,
          message: onChainSuccess
            ? `Successfully issued ${totalReward} RCN tokens to customer wallet`
            : `Reward recorded (${totalReward} RCN) - tokens will be distributed later`
        }
      };

      // Store idempotency response if key was provided
      if (idempotencyKey) {
        await idempotencyRepository.storeResponse(
          idempotencyKey,
          shopId,
          req.body,
          200,
          successResponse,
          'issue-reward'
        );
      }

      res.json(successResponse);

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

// ========== SHOP PROFILE ENHANCEMENTS ==========

// Update shop profile (banner, about, logo)
router.put('/:shopId/profile',
  authMiddleware,
  requireRole(['shop']),
  requireShopOwnership,
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const { bannerUrl, aboutText, logoUrl } = req.body;

      const updates: any = {};
      if (bannerUrl !== undefined) updates.bannerUrl = bannerUrl;
      if (aboutText !== undefined) {
        // Validate about text length (max 2000 characters)
        if (aboutText && aboutText.length > 2000) {
          return res.status(400).json({
            success: false,
            error: 'About text cannot exceed 2000 characters'
          });
        }
        updates.aboutText = aboutText;
      }
      if (logoUrl !== undefined) updates.logoUrl = logoUrl;

      await shopRepository.updateShop(shopId, updates);

      logger.info('Shop profile updated', { shopId, updates });

      res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error: any) {
      logger.error('Profile update error:', error);
      res.status(500).json({ success: false, error: 'Failed to update profile' });
    }
  }
);

// Get shop gallery photos (public)
router.get('/:shopId/gallery',
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const photos = await shopRepository.getGalleryPhotos(shopId);

      res.json({ success: true, data: photos });
    } catch (error: any) {
      logger.error('Get gallery error:', error);
      res.status(500).json({ success: false, error: 'Failed to get gallery' });
    }
  }
);

// Add gallery photo (shop owner only)
router.post('/:shopId/gallery',
  authMiddleware,
  requireRole(['shop']),
  requireShopOwnership,
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const { photoUrl, caption } = req.body;

      if (!photoUrl) {
        return res.status(400).json({ success: false, error: 'Photo URL is required' });
      }

      // Validate caption length if provided
      if (caption && caption.length > 200) {
        return res.status(400).json({
          success: false,
          error: 'Caption cannot exceed 200 characters'
        });
      }

      const result = await shopRepository.addGalleryPhoto(shopId, photoUrl, caption);

      logger.info('Gallery photo added', { shopId, photoId: result.id });

      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Add gallery photo error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to add photo' });
    }
  }
);

// Delete gallery photo
router.delete('/:shopId/gallery/:photoId',
  authMiddleware,
  requireRole(['shop']),
  requireShopOwnership,
  async (req: Request, res: Response) => {
    try {
      const { shopId, photoId } = req.params;

      await shopRepository.deleteGalleryPhoto(shopId, parseInt(photoId));

      logger.info('Gallery photo deleted', { shopId, photoId });

      res.json({ success: true, message: 'Photo deleted successfully' });
    } catch (error: any) {
      logger.error('Delete gallery photo error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to delete photo' });
    }
  }
);

// Update gallery photo caption
router.put('/:shopId/gallery/:photoId/caption',
  authMiddleware,
  requireRole(['shop']),
  requireShopOwnership,
  async (req: Request, res: Response) => {
    try {
      const { shopId, photoId } = req.params;
      const { caption } = req.body;

      // Validate caption length
      if (caption && caption.length > 200) {
        return res.status(400).json({
          success: false,
          error: 'Caption cannot exceed 200 characters'
        });
      }

      await shopRepository.updateGalleryPhotoCaption(shopId, parseInt(photoId), caption);

      logger.info('Gallery photo caption updated', { shopId, photoId });

      res.json({ success: true, message: 'Caption updated successfully' });
    } catch (error: any) {
      logger.error('Update caption error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to update caption' });
    }
  }
);

// Reorder gallery photos
router.put('/:shopId/gallery/:photoId/order',
  authMiddleware,
  requireRole(['shop']),
  requireShopOwnership,
  async (req: Request, res: Response) => {
    try {
      const { shopId, photoId } = req.params;
      const { displayOrder } = req.body;

      if (displayOrder === undefined || displayOrder < 0) {
        return res.status(400).json({
          success: false,
          error: 'Display order must be a non-negative number'
        });
      }

      await shopRepository.updateGalleryPhotoOrder(shopId, parseInt(photoId), displayOrder);

      logger.info('Gallery photo order updated', { shopId, photoId, displayOrder });

      res.json({ success: true, message: 'Photo order updated successfully' });
    } catch (error: any) {
      logger.error('Update photo order error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to update order' });
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