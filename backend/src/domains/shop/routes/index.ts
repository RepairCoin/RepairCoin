// backend/src/routes/shops.ts
import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole, requireShopOrAdmin, requireShopOwnership } from '../../../middleware/auth';
import { validateRequired, validateEthereumAddress, validateEmail, validateNumeric } from '../../../middleware/errorHandler';
import { 
  shopRepository, 
  customerRepository, 
  transactionRepository 
} from '../../../repositories';
import { TokenMinter } from '../../../contracts/TokenMinter';
import { TierManager } from '../../../contracts/TierManager';
import { logger } from '../../../utils/logger';
import { RoleValidator } from '../../../utils/roleValidator';
import { validateShopRoleConflict } from '../../../middleware/roleConflictValidator';
import { ReferralService } from '../../../services/ReferralService';

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
  location?: string;
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
          verified: shop.verified,
          crossShopEnabled: shop.crossShopEnabled,
          location: shop.location,
          joinDate: shop.joinDate,
          // Include balance information for display
          purchasedRcnBalance: shop.purchasedRcnBalance,
          totalRcnPurchased: shop.totalRcnPurchased,
          totalTokensIssued: shop.totalTokensIssued
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
        location
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

      // Create new shop data
      const newShop: ShopData = {
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
        location
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

// Get shop transactions
router.get('/:shopId/transactions',
  requireShopOrAdmin,
  requireShopOwnership,
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const { limit = '100', type } = req.query;
      
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      const transactions = await shopRepository.getShopTransactions(shopId, parseInt(limit as string));
      
      // Filter by type if specified
      let filteredTransactions = transactions;
      if (type && ['mint', 'redeem'].includes(type as string)) {
        filteredTransactions = transactions.filter(t => t.type === type);
      }

      res.json({
        success: true,
        data: {
          transactions: filteredTransactions,
          count: filteredTransactions.length,
          shop: {
            shopId: shop.shopId,
            name: shop.name
          }
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
  requireShopOrAdmin,
  requireShopOwnership,
  validateRequired(['customerAddress', 'amount']),
  validateEthereumAddress('customerAddress'),
  validateNumeric('amount', 0.1, 1000),
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const { customerAddress, amount, notes } = req.body;
      
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

      // Process redemption (this would typically burn tokens)
      // For now, we'll record the transaction
      const transactionRecord = {
        id: `redeem_${Date.now()}`,
        type: 'redeem' as const,
        customerAddress: customerAddress.toLowerCase(),
        shopId,
        amount,
        reason: `Redemption at ${shop.name}`,
        transactionHash: '', // Would have actual burn transaction hash
        timestamp: new Date().toISOString(),
        status: 'confirmed' as const,
        metadata: {
          repairAmount: amount,
          referralId: undefined,
          engagementType: 'redemption',
          redemptionLocation: shop.name,
          webhookId: `redeem_${Date.now()}`
        }
      };

      await transactionRepository.recordTransaction(transactionRecord);

      // Update shop statistics
      await shopRepository.updateShop(shopId, {
        totalRedemptions: shop.totalRedemptions + amount,
        lastActivity: new Date().toISOString()
      });

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

      // Check shop has sufficient balance
      const shopBalance = shop.purchasedRcnBalance || 0;
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
      const dailyLimit = 40;
      const monthlyLimit = 500;
      
      if (customer.dailyEarnings + baseReward > dailyLimit) {
        return res.status(400).json({
          success: false,
          error: 'Customer daily earning limit exceeded',
          data: {
            dailyLimit,
            currentDaily: customer.dailyEarnings,
            attempted: baseReward
          }
        });
      }

      if (customer.monthlyEarnings + baseReward > monthlyLimit) {
        return res.status(400).json({
          success: false,
          error: 'Customer monthly earning limit exceeded',
          data: {
            monthlyLimit,
            currentMonthly: customer.monthlyEarnings,
            attempted: baseReward
          }
        });
      }

      // Process the reward using mintRepairTokens
      const tokenMinter = getTokenMinter();
      const mintResult = await tokenMinter.mintRepairTokens(
        customerAddress,
        repairAmount,
        shop.shopId,
        customer
      );

      if (!mintResult.success) {
        return res.status(400).json({
          success: false,
          error: mintResult.message || 'Failed to mint tokens'
        });
      }

      // The actual tokens minted (includes tier bonus already)
      const actualTokensMinted = mintResult.tokensToMint || totalReward;

      // Update shop balance
      await shopRepository.updateShop(shopId, {
        purchasedRcnBalance: shopBalance - actualTokensMinted,
        totalTokensIssued: (shop.totalTokensIssued || 0) + actualTokensMinted
      });

      // Calculate new tier after earning
      const updatedLifetimeEarnings = customer.lifetimeEarnings + actualTokensMinted;
      const newTier = getTierManager().calculateTier(updatedLifetimeEarnings);
      
      // Update customer earnings using the correct method
      await customerRepository.updateCustomerAfterEarning(
        customerAddress,
        actualTokensMinted,
        newTier
      );

      // Log transaction using the correct method
      await transactionRepository.recordTransaction({
        id: `${Date.now()}_${customerAddress}_${shopId}`,
        type: 'mint',
        customerAddress,
        shopId,
        amount: actualTokensMinted,
        reason: `Repair reward - $${repairAmount} repair`,
        transactionHash: mintResult.transactionHash,
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
        totalReward: actualTokensMinted,
        txHash: mintResult.transactionHash || '',
        referralCompleted
      });

      res.json({
        success: true,
        data: {
          baseReward,
          tierBonus: skipTierBonus ? 0 : tierBonus,
          totalReward: actualTokensMinted,
          txHash: mintResult.transactionHash || '',
          customerNewBalance: customer.lifetimeEarnings + actualTokensMinted,
          shopNewBalance: shopBalance - actualTokensMinted,
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

export default router;