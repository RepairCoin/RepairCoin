import { Router, Request, Response } from 'express';
import { TokenMinter } from '../../../contracts/TokenMinter';
import { TokenService } from '../../token/services/TokenService';
import { TreasuryRepository } from '../../../repositories/TreasuryRepository';
import { ShopRepository } from '../../../repositories/ShopRepository';
import { transactionRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';
import { validateRequired, validateEthereumAddress, validateNumeric } from '../../../middleware/errorHandler';
import { getRCGService } from '../../../services/RCGService';
// TODO: Implement treasury methods in repository

const router = Router();

// Lazy loading helper
let tokenMinter: TokenMinter | null = null;
const getTokenMinter = (): TokenMinter => {
    if (!tokenMinter) {
        tokenMinter = new TokenMinter();
    }
    return tokenMinter;
};

// Get treasury statistics
// Note: Authentication is already handled by the admin router middleware
router.get('/treasury', async (req: Request, res: Response) => {
    try {
        const treasuryRepo = new TreasuryRepository();
        const shopRepo = new ShopRepository();
        
        // Get treasury data from database
        // Calculate total sold from shop_rcn_purchases table (if it exists)
        let treasuryData = {
          totalSupply: 'unlimited', // Unlimited supply as per v3.0 spec
          availableSupply: 'unlimited', // Also unlimited
          totalSold: 0,
          totalRevenue: 0,
          lastUpdated: new Date()
        };

        try {
            const shopPurchases = await treasuryRepo.query(`
                SELECT 
                    COALESCE(SUM(amount), 0) as total_sold,
                    COALESCE(SUM(total_cost), 0) as total_revenue
                FROM shop_rcn_purchases
                WHERE status IN ('completed', 'pending')
            `);
            
            treasuryData.totalSold = parseFloat(shopPurchases.rows[0]?.total_sold || '0');
            treasuryData.totalRevenue = parseFloat(shopPurchases.rows[0]?.total_revenue || '0');
        } catch (error) {
            console.warn('shop_rcn_purchases table not found, using default values:', error);
        }
        
        // Get actual circulating supply from blockchain
        let circulatingSupply = 0;
        
        try {
            const contractStats = await getTokenMinter().getContractStats();
            if (contractStats && contractStats.totalSupplyReadable > 0) {
                circulatingSupply = contractStats.totalSupplyReadable;
                console.log('✅ Fetched circulating supply from blockchain:', circulatingSupply);
            }
        } catch (error) {
            console.warn('Could not fetch contract stats, using database value:', error);
        }
        
        // Get top RCN buyers (shops with most purchases)
        let topBuyers = [];
        try {
            const topBuyersQuery = await treasuryRepo.query(`
                SELECT 
                    s.shop_id,
                    s.name as shop_name,
                    COALESCE(SUM(p.amount), 0) as total_purchased,
                    COALESCE(SUM(p.total_cost), 0) as total_spent,
                    COUNT(p.id) as purchase_count,
                    MAX(p.created_at) as last_purchase
                FROM shops s
                LEFT JOIN shop_rcn_purchases p ON s.shop_id = p.shop_id AND p.status IN ('completed', 'pending')
                GROUP BY s.shop_id, s.name
                HAVING COALESCE(SUM(p.amount), 0) > 0
                ORDER BY total_purchased DESC
                LIMIT 10
            `);
            topBuyers = topBuyersQuery.rows;
        } catch (error) {
            console.warn('Error fetching top buyers, using empty list:', error);
        }
        
        // Get recent RCN purchases
        let recentPurchases = [];
        try {
            const recentPurchasesQuery = await treasuryRepo.query(`
                SELECT 
                    p.id,
                    p.shop_id,
                    s.name as shop_name,
                    p.amount as rcn_amount,
                    p.total_cost,
                    p.payment_method,
                    p.payment_reference,
                    p.created_at as purchase_date
                FROM shop_rcn_purchases p
                JOIN shops s ON s.shop_id = p.shop_id
                WHERE p.status IN ('completed', 'pending')
                ORDER BY p.created_at DESC
                LIMIT 20
            `);
            recentPurchases = recentPurchasesQuery.rows;
        } catch (error) {
            console.warn('Error fetching recent purchases, using empty list:', error);
        }
        
        // With unlimited supply, we can't calculate percentage sold
        // Instead, show circulating supply info
        const percentageSold = circulatingSupply > 0 && treasuryData.totalSold > 0
            ? (treasuryData.totalSold / circulatingSupply) * 100
            : 0;
        
        // Calculate remaining treasury (for display purposes only)
        const remainingInTreasury = circulatingSupply > 0 
            ? circulatingSupply - treasuryData.totalSold
            : 0;
        
        const data = {
            ...treasuryData,
            circulatingSupply,
            percentageSold,
            remainingInTreasury,
            topBuyers,
            recentPurchases
        };
        
        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Treasury stats error:', error);
        
        // Check if it's a database table missing error
        if (error.message?.includes('does not exist')) {
            res.status(500).json({ 
                success: false, 
                error: 'Database tables not initialized. Please run migrations.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: 'Failed to fetch treasury data',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
});

// Get RCG metrics for treasury
router.get('/treasury/rcg', async (req: Request, res: Response) => {
    try {
        const rcgService = getRCGService();
        
        try {
            const rcgMetrics = await rcgService.getRCGMetrics();
            
            res.json({
                success: true,
                data: rcgMetrics
            });
        } catch (blockchainError) {
            // If blockchain connection fails, return mock data with warning
            logger.warn('Failed to fetch real RCG metrics, using fallback data:', blockchainError);
            
            const fallbackRcgMetrics = {
                totalSupply: "100000000", // 100M fixed supply
                circulatingSupply: "20000000", // 20M circulating (estimate)
                allocations: {
                    team: "30000000", // 30%
                    investors: "30000000", // 30%
                    publicSale: "20000000", // 20%
                    daoTreasury: "15000000", // 15%
                    stakingRewards: "5000000" // 5%
                },
                shopTierDistribution: {
                    standard: 0,
                    premium: 0,
                    elite: 0,
                    none: 0,
                    total: 0
                },
                revenueImpact: {
                    standardRevenue: 0,
                    premiumRevenue: 0,
                    eliteRevenue: 0,
                    totalRevenue: 0,
                    discountsGiven: 0
                },
                topHolders: [],
                _warning: 'Blockchain connection failed, showing fallback data'
            };
            
            res.json({
                success: true,
                data: fallbackRcgMetrics,
                warning: 'Real-time blockchain data unavailable'
            });
        }
    } catch (error) {
        console.error('Error fetching RCG metrics:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch RCG metrics' 
        });
    }
});

// Update shop tier based on current RCG balance
router.post('/treasury/update-shop-tier/:shopId', async (req: Request, res: Response) => {
    try {
        const { shopId } = req.params;
        const rcgService = getRCGService();
        
        // Get shop info first to validate
        const shopRepo = new ShopRepository();
        const shop = await shopRepo.getShop(shopId);
        
        if (!shop) {
            return res.status(404).json({
                success: false,
                error: 'Shop not found'
            });
        }
        
        if (!shop.walletAddress) {
            return res.status(400).json({
                success: false,
                error: 'Shop does not have a wallet address configured'
            });
        }
        
        // Update the shop tier
        await rcgService.updateShopTier(parseInt(shop.shopId));
        
        // Get updated tier info
        const tierInfo = await rcgService.getShopTierInfo(parseInt(shop.shopId));
        
        res.json({
            success: true,
            message: 'Shop tier updated successfully',
            data: {
                shopId,
                tierInfo
            }
        });
    } catch (error) {
        console.error('Error updating shop tier:', error);
        res.status(500).json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to update shop tier'
        });
    }
});

// Get admin wallet info
router.get('/treasury/admin-wallet', async (req: Request, res: Response) => {
    try {
        const tokenMinter = getTokenMinter();
        const account = (tokenMinter as any).account;
        const walletAddress = account?.address || 'Not configured';
        
        res.json({
            success: true,
            data: {
                adminWallet: walletAddress,
                contractAddress: process.env.RCN_CONTRACT_ADDRESS || '0xd92ced7c3f4D8E42C05A4c558F37dA6DC731d5f5',
                chainId: 84532,
                chainName: 'Base Sepolia',
                message: 'This wallet needs MINTER_ROLE on the RCN contract to mint tokens'
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: 'Failed to get admin wallet info'
        });
    }
});

// Update treasury calculations
router.post('/treasury/update', async (req: Request, res: Response) => {
    try {
        const treasuryRepo = new TreasuryRepository();
        const rcgService = getRCGService();
        
        // Update all shop tiers based on current RCG balances
        const shopsResult = await treasuryRepo.query(`
            SELECT id, shop_id, wallet_address 
            FROM shops 
            WHERE active = true AND verified = true AND wallet_address IS NOT NULL
        `);
        
        let updatedShops = 0;
        const errors = [];
        
        for (const shop of shopsResult.rows) {
            try {
                await rcgService.updateShopTier(parseInt(shop.id));
                updatedShops++;
            } catch (error) {
                errors.push({
                    shopId: shop.shop_id,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        
        // Recalculate revenue metrics
        const revenueMetrics = await rcgService.calculateRevenueByTier();
        
        res.json({
            success: true,
            message: 'Treasury calculations updated',
            data: {
                updatedShops,
                totalShops: shopsResult.rows.length,
                errors: errors.length > 0 ? errors : undefined,
                revenueMetrics
            }
        });
    } catch (error) {
        console.error('Error updating treasury calculations:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update treasury calculations' 
        });
    }
});

// Debug endpoint to check purchases for a specific shop
router.get('/treasury/debug/:shopId', async (req: Request, res: Response) => {
    try {
        const { shopId } = req.params;
        const treasuryRepo = new TreasuryRepository();
        
        // Get debug info from repository
        const debugInfo = await treasuryRepo.getShopPurchaseDebugInfo(shopId);
        
        // Try to get blockchain balance if shop has wallet
        if (debugInfo.shop?.wallet_address) {
            try {
                const tokenService = new TokenService();
                debugInfo.summary.blockchainBalance = await tokenService.getBalance(debugInfo.shop.wallet_address);
                debugInfo.summary.unmintedAmount = 
                    (debugInfo.summary.totalsByStatus['completed'] || 0) + 
                    (debugInfo.summary.totalsByStatus['pending'] || 0) - 
                    debugInfo.summary.blockchainBalance;
            } catch (error: any) {
                debugInfo.summary.balanceError = error.message;
            }
        }
        
        res.json({
            success: true,
            data: debugInfo
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get customers with token discrepancies  
router.get('/treasury/discrepancies', async (req: Request, res: Response) => {
    try {
        const treasuryRepo = new TreasuryRepository();
        
        const discrepancies = await treasuryRepo.getCustomerDiscrepancies();
        
        const summary = {
            totalCustomers: discrepancies.length,
            customersNeedingTokens: discrepancies.filter((d: any) => d.needsTokenTransfer).length,
            totalMissingTokens: discrepancies
                .filter((d: any) => d.needsTokenTransfer)
                .reduce((sum: number, d: any) => sum + d.expectedBalance, 0)
        };
        
        res.json({
            success: true,
            data: {
                discrepancies,
                summary
            }
        });
        
    } catch (error: any) {
        logger.error('Error fetching discrepancies:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch discrepancies'
        });
    }
});

// Manual token transfer to fix discrepancies
router.post('/treasury/manual-transfer',
    validateRequired(['customerAddress', 'amount', 'reason']),
    validateEthereumAddress('customerAddress'),
    validateNumeric('amount', 0.01, 10000),
    async (req: Request, res: Response) => {
        try {
            const { customerAddress, amount, reason } = req.body;
            
            const minter = getTokenMinter();
            
            // Check current balance
            const currentBalance = await minter.getCustomerBalance(customerAddress) || 0;
            
            // Transfer tokens
            const result = await minter.transferTokens(
                customerAddress,
                amount,
                `Admin manual transfer: ${reason}`
            );
            
            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    error: result.error || 'Transfer failed'
                });
            }
            
            // Record in database - use any type to bypass the id requirement since it's auto-generated
            await transactionRepository.recordTransaction({
                type: 'mint',
                customerAddress: customerAddress.toLowerCase(),
                shopId: null,
                amount,
                reason: `Admin manual transfer: ${reason}`,
                transactionHash: result.transactionHash || '',
                timestamp: new Date().toISOString(),
                status: 'confirmed',
                metadata: {
                    manual: true,
                    adminAddress: req.user?.address,
                    reason,
                    previousBalance: currentBalance,
                    source: 'admin_manual_transfer'
                }
            } as any);
            
            // Wait for confirmation and check new balance
            await new Promise(resolve => setTimeout(resolve, 3000));
            const newBalance = await minter.getCustomerBalance(customerAddress) || 0;
            
            logger.info('Admin manual token transfer completed', {
                customerAddress,
                amount,
                reason,
                txHash: result.transactionHash,
                adminAddress: req.user?.address
            });
            
            res.json({
                success: true,
                data: {
                    transactionHash: result.transactionHash,
                    amount,
                    customerAddress,
                    previousBalance: currentBalance,
                    newBalance,
                    reason
                }
            });
            
        } catch (error: any) {
            logger.error('Manual transfer error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process manual transfer'
            });
        }
    }
);

// Get treasury stats with discrepancy warnings
router.get('/treasury/stats-with-warnings', async (req: Request, res: Response) => {
    try {
        const treasuryRepo = new TreasuryRepository();
        const minter = getTokenMinter();
        const adminAddress = '0x761E5E59485ec6feb263320f5d636042bD9EBc8c';
        
        // Get existing treasury stats
        const existingStats = await treasuryRepo.query(`
            SELECT 
                COALESCE(SUM(amount), 0) as total_sold,
                COALESCE(SUM(total_cost), 0) as total_revenue
            FROM shop_rcn_purchases
            WHERE status IN ('completed', 'pending')
        `);
        
        // Get total minted to customers (excluding admin manual transfers)
        const mintedStats = await treasuryRepo.query(`
            SELECT 
                SUM(CASE WHEN type = 'mint' AND shop_id IS NOT NULL THEN amount ELSE 0 END) as total_issued_by_shops,
                SUM(CASE WHEN type = 'mint' AND shop_id IS NOT NULL THEN amount ELSE 0 END) as total_minted
            FROM transactions
            WHERE status = 'confirmed'
            AND LOWER(customer_address) != LOWER($1)
        `, [adminAddress]);
        
        // Check for customers with positive expected balances (excluding admin transfers)
        const discrepancyCheck = await treasuryRepo.query(`
            WITH customer_balances AS (
                SELECT 
                    customer_address,
                    SUM(CASE WHEN type = 'mint' AND shop_id IS NOT NULL THEN amount ELSE 0 END) as shop_rewards,
                    SUM(CASE WHEN type = 'redeem' THEN amount ELSE 0 END) as redeemed,
                    SUM(CASE WHEN type = 'mint' AND shop_id IS NULL AND metadata::text LIKE '%admin_manual_transfer%' THEN amount ELSE 0 END) as admin_transfers
                FROM transactions
                WHERE status = 'confirmed'
                AND LOWER(customer_address) != LOWER($1)
                GROUP BY customer_address
                HAVING SUM(CASE WHEN type = 'mint' AND shop_id IS NOT NULL THEN amount ELSE 0 END) > 0
            )
            SELECT 
                COUNT(*) as customers_with_positive_balance,
                COALESCE(SUM(GREATEST(shop_rewards - redeemed - admin_transfers, 0)), 0) as total_expected_balance
            FROM customer_balances
            WHERE shop_rewards - redeemed - admin_transfers > 0
        `, [adminAddress]);
        
        const adminBalance = await minter.getCustomerBalance(adminAddress) || 0;
        const contractStats = await minter.getContractStats();
        
        const totalPurchasedByShops = parseFloat(existingStats.rows[0]?.total_sold || '0');
        const totalIssuedByShops = parseFloat(mintedStats.rows[0]?.total_issued_by_shops || '0');
        const totalMinted = parseFloat(mintedStats.rows[0]?.total_minted || '0');
        const expectedAdminBalance = totalPurchasedByShops - totalIssuedByShops;
        
        const hasDiscrepancies = parseInt(discrepancyCheck.rows[0]?.customers_with_positive_balance || '0') > 0;
        
        res.json({
            success: true,
            data: {
                treasury: {
                    totalSupply: contractStats.totalSupplyReadable || 0,
                    totalSold: totalPurchasedByShops,
                    totalRevenue: parseFloat(existingStats.rows[0]?.total_revenue || '0'),
                    totalMinted: totalMinted,
                    totalIssuedByShops: totalIssuedByShops
                },
                adminWallet: {
                    address: adminAddress,
                    onChainBalance: adminBalance,
                    expectedBalance: expectedAdminBalance,
                    discrepancy: adminBalance - expectedAdminBalance
                },
                warnings: {
                    hasDiscrepancies,
                    customersWithMissingTokens: parseInt(discrepancyCheck.rows[0]?.customers_with_positive_balance || '0'),
                    totalMissingTokens: parseFloat(discrepancyCheck.rows[0]?.total_expected_balance || '0'),
                    message: hasDiscrepancies 
                        ? `${discrepancyCheck.rows[0].customers_with_positive_balance} customers may be missing tokens. Check discrepancies tab.`
                        : 'All customers have received their tokens on-chain'
                }
            }
        });
        
    } catch (error: any) {
        logger.error('Error getting treasury stats with warnings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve treasury statistics'
        });
    }
});

// New Advanced Treasury Management Endpoints

// Bulk token minting for campaigns
router.post('/treasury/mint-bulk',
    validateRequired(['recipients', 'amount', 'reason']),
    validateNumeric('amount', 0.01, 100000),
    async (req: Request, res: Response) => {
        try {
            const { recipients, amount, reason } = req.body;
            
            if (!Array.isArray(recipients) || recipients.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Recipients must be a non-empty array'
                });
            }
            
            if (recipients.length > 100) {
                return res.status(400).json({
                    success: false,
                    error: 'Maximum 100 recipients per batch'
                });
            }
            
            const minter = getTokenMinter();
            const results = [];
            let successCount = 0;
            let failCount = 0;
            
            for (const recipient of recipients) {
                try {
                    const result = await minter.transferTokens(
                        recipient,
                        amount,
                        `Bulk campaign: ${reason}`
                    );
                    
                    if (result.success) {
                        // Record in database
                        await transactionRepository.recordTransaction({
                            type: 'mint',
                            customerAddress: recipient.toLowerCase(),
                            shopId: null,
                            amount,
                            reason: `Bulk campaign: ${reason}`,
                            transactionHash: result.transactionHash || '',
                            timestamp: new Date().toISOString(),
                            status: 'confirmed',
                            metadata: {
                                bulk: true,
                                campaign: true,
                                adminAddress: req.user?.address,
                                reason
                            }
                        } as any);
                        
                        successCount++;
                        results.push({
                            recipient,
                            success: true,
                            transactionHash: result.transactionHash,
                            amount
                        });
                    } else {
                        failCount++;
                        results.push({
                            recipient,
                            success: false,
                            error: result.error,
                            amount
                        });
                    }
                } catch (error) {
                    failCount++;
                    results.push({
                        recipient,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        amount
                    });
                }
            }
            
            logger.info('Bulk token minting completed', {
                totalRecipients: recipients.length,
                successCount,
                failCount,
                amount,
                reason,
                adminAddress: req.user?.address
            });
            
            res.json({
                success: true,
                data: {
                    totalRecipients: recipients.length,
                    successCount,
                    failCount,
                    amount,
                    reason,
                    results
                }
            });
            
        } catch (error) {
            logger.error('Bulk minting error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process bulk minting'
            });
        }
    }
);

// Financial analytics dashboard data
router.get('/treasury/analytics', async (req: Request, res: Response) => {
    try {
        const { period = '30d' } = req.query;
        const treasuryRepo = new TreasuryRepository();
        const rcgService = getRCGService();
        
        // Calculate date range
        let daysBack = 30;
        if (period === '7d') daysBack = 7;
        else if (period === '60d') daysBack = 60;
        else if (period === '90d') daysBack = 90;
        
        // Get analytics data from repository
        const analyticsData = await treasuryRepo.getAnalyticsData(daysBack);
        
        // Current metrics
        const currentMetrics = await rcgService.calculateRevenueByTier();
        const tierDistribution = await rcgService.getShopTierDistribution();
        
        res.json({
            success: true,
            data: {
                period,
                daysBack,
                ...analyticsData,
                currentMetrics,
                tierDistribution
            }
        });
        
    } catch (error) {
        logger.error('Error fetching treasury analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch treasury analytics'
        });
    }
});

// Token price adjustment controls
router.post('/treasury/adjust-pricing',
    validateRequired(['tier', 'newPrice', 'reason']),
    validateNumeric('newPrice', 0.01, 1.00),
    async (req: Request, res: Response) => {
        try {
            const { tier, newPrice, reason } = req.body;
            const adminAddress = req.user?.address || 'unknown';
            
            if (!['standard', 'premium', 'elite'].includes(tier)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid tier. Must be: standard, premium, or elite'
                });
            }
            
            // Dynamic import to avoid circular dependency
            const { getPricingService } = await import('../../../services/PricingService');
            const pricingService = getPricingService();
            
            // Initialize pricing tables if needed
            await pricingService.initializePricingTables();
            
            // Get current pricing for comparison
            const currentPrice = await pricingService.getTierPricing(tier);
            
            // Update pricing
            await pricingService.updateTierPricing(tier, newPrice, adminAddress, reason);
            
            // Get updated pricing to confirm
            const allPricing = await pricingService.getAllTierPricing();
            
            logger.info('Token pricing adjustment completed', {
                tier,
                oldPrice: currentPrice,
                newPrice,
                reason,
                adminAddress,
                timestamp: new Date().toISOString()
            });
            
            res.json({
                success: true,
                message: 'Pricing updated successfully',
                data: {
                    tier,
                    oldPrice: currentPrice,
                    newPrice,
                    reason,
                    updatedAt: new Date().toISOString(),
                    allPricing
                }
            });
            
        } catch (error) {
            logger.error('Error adjusting token pricing:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to adjust token pricing'
            });
        }
    }
);

// Get current tier pricing
router.get('/treasury/pricing', async (req: Request, res: Response) => {
    try {
        // Dynamic import to avoid circular dependency
        const { getPricingService } = await import('../../../services/PricingService');
        const pricingService = getPricingService();
        
        // Initialize pricing tables if needed
        await pricingService.initializePricingTables();
        
        // Get all current pricing
        const allPricing = await pricingService.getAllTierPricing();
        
        res.json({
            success: true,
            data: allPricing
        });
        
    } catch (error) {
        logger.error('Error fetching tier pricing:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch tier pricing'
        });
    }
});

// Get pricing history
router.get('/treasury/pricing/history', async (req: Request, res: Response) => {
    try {
        const { tier, limit = '50' } = req.query;
        
        // Dynamic import to avoid circular dependency
        const { getPricingService } = await import('../../../services/PricingService');
        const pricingService = getPricingService();
        
        const history = await pricingService.getPricingHistory(
            tier as 'standard' | 'premium' | 'elite' | undefined,
            parseInt(limit as string)
        );
        
        res.json({
            success: true,
            data: history
        });
        
    } catch (error) {
        logger.error('Error fetching pricing history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch pricing history'
        });
    }
});

// Emergency treasury controls
router.post('/treasury/emergency-freeze',
    validateRequired(['reason']),
    async (req: Request, res: Response) => {
        try {
            const { reason } = req.body;
            const adminAddress = req.user?.address;
            
            // Log emergency action
            logger.error('EMERGENCY: Treasury freeze initiated', {
                reason,
                adminAddress,
                timestamp: new Date().toISOString()
            });
            
            // This would typically:
            // 1. Pause token minting contracts
            // 2. Disable new purchases
            // 3. Alert all administrators
            // 4. Create audit trail
            
            res.json({
                success: true,
                message: 'Emergency freeze logged - manual intervention required',
                data: {
                    action: 'emergency_freeze',
                    reason,
                    adminAddress,
                    timestamp: new Date().toISOString(),
                    implementationNote: 'This would trigger contract pausing in production'
                }
            });
            
        } catch (error) {
            logger.error('Error processing emergency freeze:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process emergency freeze'
            });
        }
    }
);

export default router;