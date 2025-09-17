// backend/src/routes/shops.ts
import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole, requireShopOrAdmin, requireShopOwnership } from '../../../middleware/auth';
import { validateRequired, validateEthereumAddress, validateEmail, validateNumeric } from '../../../middleware/errorHandler';
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
import rcgRoutes from './rcg';

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

const router = Router();

// Register sub-routes
router.use('/purchase', purchaseRoutes);
router.use('/tier-bonus', tierBonusRoutes);

// Lazy loading helpers
let tokenMinter: TokenMinter | null = null;
let tierManager: TierManager | null = null;
let referralService: ReferralService | null = null;

const getTokenMinter = (): TokenMinter => {
  if (!tokenMinter) {
    tokenMinter = new TokenMinter();
    console.log('Created new TokenMinter instance:', tokenMinter);
    console.log('transferTokens method exists?', typeof tokenMinter.transferTokens);
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
      address: shop.address,
      phone: shop.phone,
      verified: shop.verified,
      crossShopEnabled: shop.crossShopEnabled,
      location: shop.location,
      joinDate: shop.joinDate
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
        joinDate: shop.joinDate
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
          rcg_balance: shop.rcg_balance
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
        acceptTerms
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
        location: mergedLocation
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

// Update shop information
router.put('/:shopId',
  requireShopOrAdmin,
  requireShopOwnership,
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
        location
      } = req.body;

      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      // Prepare updates
      const updates: Partial<ShopData> = {};
      if (name !== undefined) updates.name = name;
      if (address !== undefined) updates.address = address;
      if (phone !== undefined) updates.phone = phone;
      if (email !== undefined) updates.email = email;
      if (reimbursementAddress !== undefined) updates.reimbursementAddress = reimbursementAddress;
      if (location !== undefined) updates.location = location;
      
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

// Process token redemption at shop
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
      const { customerAddress, amount, notes, sessionId } = req.body;

      // NEW: Require session for redemption
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required. Customer must approve redemption first.'
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

      const customer = await customerRepository.getCustomer(customerAddress);
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      // NEW: Validate and consume redemption session
      const { redemptionSessionService } = await import('../../token/services/RedemptionSessionService');
      try {
        const session = await redemptionSessionService.validateAndConsumeSession(sessionId, shopId, amount);
        logger.info('Redemption session validated', {
          sessionId,
          customerAddress: session.customerAddress,
          shopId,
          amount
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
            earnedBalance: verification.earnedBalance,
            totalBalance: verification.totalBalance,
            maxRedeemable: verification.maxRedeemable,
            isHomeShop: verification.isHomeShop,
            crossShopLimit: verification.crossShopLimit
          }
        });
      }

      // Get current balance for transaction processing
      const currentBalance = await getTokenMinter().getCustomerBalance(customerAddress);
      const isHomeShop = verification.isHomeShop;

      // Attempt to burn tokens on blockchain
      let burnResult;
      let transactionHash = '';
      
      try {
        burnResult = await getTokenMinter().burnTokens(
          customerAddress,
          amount,
          shopId,
          `Redemption at ${shop.name}`
        );
        
        if (burnResult.success && burnResult.transactionHash) {
          transactionHash = burnResult.transactionHash;
          logger.info('Tokens burned on blockchain', { 
            customerAddress, 
            amount, 
            transactionHash 
          });
        } else {
          // If burn fails (e.g., contract doesn't support it), continue with off-chain tracking
          logger.warn('Token burn failed or not supported, tracking redemption off-chain', {
            reason: burnResult.message
          });
        }
      } catch (burnError) {
        // Don't fail the redemption if burn fails - track off-chain
        logger.error('Token burn error, continuing with off-chain tracking', burnError);
      }

      // Record the redemption transaction (whether burn succeeded or not)
      const transactionRecord = {
        id: `redeem_${Date.now()}`,
        type: 'redeem' as const,
        customerAddress: customerAddress.toLowerCase(),
        shopId,
        amount,
        reason: `Redemption at ${shop.name}`,
        transactionHash, // Will be empty if burn failed
        timestamp: new Date().toISOString(),
        status: 'confirmed' as const,
        metadata: {
          repairAmount: amount,
          referralId: undefined,
          engagementType: 'redemption',
          redemptionLocation: shop.name,
          webhookId: `redeem_${Date.now()}`,
          burnSuccessful: !!transactionHash
        }
      };

      await transactionRepository.recordTransaction(transactionRecord);

      // Update shop statistics
      await shopRepository.updateShop(shopId, {
        totalRedemptions: shop.totalRedemptions + amount,
        lastActivity: new Date().toISOString()
      });

      // Update customer redemption total
      await customerRepository.updateCustomerAfterRedemption(customerAddress, amount);

      logger.info('Token redemption processed', {
        shopId,
        customerAddress,
        amount,
        isHomeShop,
        processedBy: req.user?.address
      });

      res.json({
        success: true,
        data: {
          transactionId: transactionRecord.id,
          amount,
          customerTier: customer.tier,
          isHomeShop,
          newBalance: currentBalance - amount,
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
      const { customerAddress, repairAmount, skipTierBonus = false } = req.body;
      
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

      let customer = await customerRepository.getCustomer(customerAddress);
      if (!customer) {
        // Create new customer if they don't exist
        try {
          await customerRepository.createCustomer({
            address: customerAddress.toLowerCase(),
            name: '',
            email: '',
            tier: 'BRONZE',
            lifetimeEarnings: 0,
            dailyEarnings: 0,
            monthlyEarnings: 0,
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
      }

      if (!customer.isActive) {
        return res.status(400).json({
          success: false,
          error: 'Cannot issue rewards to suspended customers'
        });
      }

      // Calculate base reward based on repair amount
      let baseReward = 0;
      if (repairAmount >= 100) {
        baseReward = 25;
      } else if (repairAmount >= 50) {
        baseReward = 10;
      } else {
        return res.status(400).json({
          success: false,
          error: 'Repair amount must be at least $50 to earn rewards'
        });
      }

      // Get tier bonus based on customer tier
      let tierBonus = 0;
      switch (customer.tier) {
        case 'BRONZE':
          tierBonus = 10;
          break;
        case 'SILVER':
          tierBonus = 20;
          break;
        case 'GOLD':
          tierBonus = 30;
          break;
      }
      const totalReward = skipTierBonus ? baseReward : baseReward + tierBonus;

      // Check shop has sufficient balance on blockchain
      let shopBalance = 0;
      try {
        const tokenMinter = getTokenMinter();
        const blockchainBalance = await tokenMinter.getCustomerBalance(shop.walletAddress);
        shopBalance = blockchainBalance || 0;
      } catch (error) {
        logger.error('Error fetching shop blockchain balance:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to check shop balance'
        });
      }
      
      if (shopBalance < totalReward) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient shop RCN balance',
          data: {
            required: totalReward,
            available: shopBalance,
            baseReward,
            tierBonus: skipTierBonus ? 0 : tierBonus
          }
        });
      }

      // Check customer daily/monthly limits
      const dailyLimit = 50;
      const monthlyLimit = 500;
      
      // Check if it's a new day and reset daily earnings accordingly
      const today = new Date().toISOString().split('T')[0];
      const customerLastEarnedDateOnly = customer.lastEarnedDate ? customer.lastEarnedDate.split('T')[0] : '';
      const effectiveDailyEarnings = (customerLastEarnedDateOnly === today) ? customer.dailyEarnings : 0;
      
      if (effectiveDailyEarnings + baseReward > dailyLimit) {
        return res.status(400).json({
          success: false,
          error: 'Customer daily earning limit exceeded',
          data: {
            dailyLimit,
            currentDaily: effectiveDailyEarnings,
            attempted: baseReward
          }
        });
      }

      // Check if it's a new month and reset monthly earnings accordingly
      const currentDate = new Date();
      const lastEarnedDate = new Date(customer.lastEarnedDate);
      const sameMonth = (currentDate.getMonth() === lastEarnedDate.getMonth() && 
                        currentDate.getFullYear() === lastEarnedDate.getFullYear());
      const effectiveMonthlyEarnings = sameMonth ? customer.monthlyEarnings : 0;
      
      if (effectiveMonthlyEarnings + baseReward > monthlyLimit) {
        return res.status(400).json({
          success: false,
          error: 'Customer monthly earning limit exceeded',
          data: {
            monthlyLimit,
            currentMonthly: effectiveMonthlyEarnings,
            attempted: baseReward
          }
        });
      }

      // Process the reward - Shop transfers their RCN to customer
      // For now, we'll use the admin wallet to transfer on behalf of the shop
      // In production, this would be done via shop's own wallet or smart contract
      const tokenMinter = getTokenMinter();
      let transactionHash = '';
      
      try {
        // Transfer tokens from admin wallet to customer
        // The transferTokens method expects: toAddress, amount, reason
        const transferResult = await tokenMinter.transferTokens(
          customerAddress,
          totalReward,
          `Repair reward from ${shop.name} - $${repairAmount} repair`
        );
        
        if (!transferResult.success) {
          throw new Error(transferResult.error || 'Transfer failed');
        }
        
        transactionHash = transferResult.transactionHash || '';
      } catch (transferError) {
        logger.error('Token transfer error:', transferError);
        return res.status(500).json({
          success: false,
          error: 'Failed to transfer reward tokens'
        });
      }

      // Update shop statistics (no balance update needed as it's on blockchain)
      await shopRepository.updateShop(shopId, {
        totalTokensIssued: (shop.totalTokensIssued || 0) + totalReward
      });

      // Calculate new tier after earning
      const updatedLifetimeEarnings = customer.lifetimeEarnings + totalReward;
      const newTier = getTierManager().calculateTier(updatedLifetimeEarnings);
      
      // Update customer earnings using the correct method
      await customerRepository.updateCustomerAfterEarning(
        customerAddress,
        totalReward,
        newTier
      );

      // Log transaction using the correct method
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
          tierBonus: skipTierBonus ? 0 : tierBonus
        }
      });

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
        totalReward: totalReward,
        txHash: transactionHash,
        referralCompleted
      });

      res.json({
        success: true,
        data: {
          baseReward,
          tierBonus: skipTierBonus ? 0 : tierBonus,
          totalReward: totalReward,
          txHash: transactionHash,
          customerNewBalance: customer.lifetimeEarnings + totalReward,
          shopNewBalance: shopBalance - totalReward,
          referralCompleted,
          referralMessage
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
      
      let allTransactions: any[] = [];
      
      // Get regular transactions if not filtering by purchase
      if (type !== 'purchases') {
        const transactions = await transactionRepository.getShopTransactions(shopId, {
          page,
          limit,
          type
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
      }
      
      // Get RCN purchases if showing all or purchases
      if (!type || type === 'all' || type === 'purchases') {
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