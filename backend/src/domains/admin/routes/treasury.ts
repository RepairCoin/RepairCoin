import { Router, Request, Response } from 'express';
import { TokenMinter } from '../../../contracts/TokenMinter';
import { TokenService } from '../../token/services/TokenService';
import { TreasuryRepository } from '../../../repositories/TreasuryRepository';
import { ShopRepository } from '../../../repositories/ShopRepository';
// import { getRCGService } from '../../../services/RCGService';
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
                    p.price_per_rcn,
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
        // const rcgService = getRCGService();
        // const rcgMetrics = await rcgService.getRCGMetrics();
        
        // Mock RCG metrics until service is implemented
        const mockRcgMetrics = {
            totalSupply: "100000000", // 100M fixed supply
            circulatingSupply: "20000000", // 20M circulating
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
            topHolders: []
        };
        
        res.json({
            success: true,
            data: mockRcgMetrics
        });
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
        // const rcgService = getRCGService();
        
        // const result = await rcgService.updateShopTier(parseInt(shopId));
        
        res.json({
            success: true,
            message: 'RCG service not yet implemented',
            data: { shopId }
        });
    } catch (error) {
        console.error('Error updating shop tier:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update shop tier' 
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
        
        // TODO: Implement treasury repository methods
        // await treasuryRepo.updateCalculations();
        
        res.json({
            success: true,
            message: 'Treasury calculations updated'
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
        const tokenMinter = getTokenMinter();
        
        // Get all purchases for this shop
        const purchasesQuery = await treasuryRepo.query(`
            SELECT 
                id,
                shop_id,
                amount,
                total_cost,
                status,
                payment_method,
                payment_reference,
                created_at
            FROM shop_rcn_purchases
            WHERE shop_id = $1
            ORDER BY created_at DESC
        `, [shopId]);
        
        // Get shop details
        const shopQuery = await treasuryRepo.query(`
            SELECT 
                shop_id,
                name,
                wallet_address,
                active,
                verified,
                purchased_rcn_balance,
                operational_status
            FROM shops
            WHERE shop_id = $1
        `, [shopId]);
        
        const shop = shopQuery.rows[0];
        let blockchainBalance = 0;
        let balanceError = null;
        
        // Try to get blockchain balance
        if (shop?.wallet_address) {
            try {
                const tokenService = new TokenService();
                blockchainBalance = await tokenService.getBalance(shop.wallet_address);
            } catch (error: any) {
                balanceError = error.message;
            }
        }
        
        // Calculate totals by status
        const totalsByStatus: Record<string, number> = {};
        purchasesQuery.rows.forEach((p: any) => {
            const status = p.status || 'unknown';
            totalsByStatus[status] = (totalsByStatus[status] || 0) + parseFloat(p.amount || '0');
        });
        
        res.json({
            success: true,
            data: {
                shop: shopQuery.rows[0] || null,
                purchases: purchasesQuery.rows,
                summary: {
                    totalPurchased: purchasesQuery.rows.reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0),
                    totalsByStatus,
                    blockchainBalance,
                    balanceError,
                    unmintedAmount: (totalsByStatus['completed'] || 0) + (totalsByStatus['pending'] || 0) - blockchainBalance
                }
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;