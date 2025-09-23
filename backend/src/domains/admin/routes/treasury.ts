import { Router, Request, Response } from 'express';
import { TokenMinter } from '../../../contracts/TokenMinter';
import { TreasuryRepository } from '../../../repositories/TreasuryRepository';
import { ShopRepository } from '../../../repositories/ShopRepository';
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
        // Calculate total sold from shop_rcn_purchases table
        const shopPurchases = await treasuryRepo.query(`
            SELECT 
                COALESCE(SUM(amount), 0) as total_sold,
                COALESCE(SUM(total_cost), 0) as total_revenue
            FROM shop_rcn_purchases
            WHERE status = 'completed'
        `);
        
        const treasuryData = {
          totalSupply: 'unlimited', // Unlimited supply as per v3.0 spec
          totalSold: parseFloat(shopPurchases.rows[0]?.total_sold || '0'),
          totalRevenue: parseFloat(shopPurchases.rows[0]?.total_revenue || '0'),
          lastUpdated: new Date()
        };
        
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
        const topBuyersQuery = await treasuryRepo.query(`
            SELECT 
                s.shop_id,
                s.name as shop_name,
                COALESCE(SUM(p.amount), 0) as total_purchased,
                COALESCE(SUM(p.total_cost), 0) as total_spent,
                COUNT(p.id) as purchase_count,
                MAX(p.created_at) as last_purchase
            FROM shops s
            LEFT JOIN shop_rcn_purchases p ON s.shop_id = p.shop_id AND p.status = 'completed'
            GROUP BY s.shop_id, s.name
            HAVING COALESCE(SUM(p.amount), 0) > 0
            ORDER BY total_purchased DESC
            LIMIT 10
        `);
        const topBuyers = topBuyersQuery.rows;
        
        // Get recent RCN purchases
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
            WHERE p.status = 'completed'
            ORDER BY p.created_at DESC
            LIMIT 20
        `);
        const recentPurchases = recentPurchasesQuery.rows;
        
        // With unlimited supply, we can't calculate percentage sold
        // Instead, show circulating supply info
        const percentageSold = circulatingSupply > 0 && treasuryData.totalSold > 0
            ? (treasuryData.totalSold / circulatingSupply) * 100
            : 0;
        
        res.json({
            success: true,
            data: {
                totalSupply: treasuryData.totalSupply, // "unlimited"
                availableSupply: 'unlimited', // Unlimited minting capability
                totalSold: treasuryData.totalSold,
                totalRevenue: treasuryData.totalRevenue,
                percentageSold: 'N/A', // Can't calculate percentage of infinity
                lastUpdated: treasuryData.lastUpdated,
                topBuyers,
                recentPurchases,
                // Additional info about blockchain state
                circulatingSupply: circulatingSupply,
                mintedRewards: circulatingSupply // All minted tokens are rewards
            }
        });
    } catch (error) {
        console.error('Treasury stats error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch treasury data',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Get RCG metrics for treasury
router.get('/treasury/rcg', async (req: Request, res: Response) => {
    try {
        const rcgService = getRCGService();
        const rcgMetrics = await rcgService.getRCGMetrics();
        
        res.json({
            success: true,
            data: rcgMetrics
        });
    } catch (error) {
        console.error('RCG metrics error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch RCG metrics',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Update shop tier based on current RCG balance
router.post('/treasury/update-shop-tier/:shopId', async (req: Request, res: Response) => {
    try {
        const { shopId } = req.params;
        const rcgService = getRCGService();
        
        await rcgService.updateShopTier(parseInt(shopId));
        const tierInfo = await rcgService.getShopTierInfo(parseInt(shopId));
        
        res.json({
            success: true,
            data: tierInfo
        });
    } catch (error) {
        console.error('Update shop tier error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update shop tier',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Update treasury calculations
router.post('/treasury/update', async (req: Request, res: Response) => {
    try {
        const treasuryRepo = new TreasuryRepository();
        
        // TODO: Implement treasury repository methods
        // First, update total supply from blockchain
        try {
            const contractStats = await getTokenMinter().getContractStats();
            if (contractStats && contractStats.totalSupplyReadable > 0) {
                // await treasuryRepository.updateTreasuryTotalSupply(contractStats.totalSupplyReadable);
            }
        } catch (error) {
            console.warn('Could not update total supply from blockchain:', error);
        }
        
        // Calculate revenue distribution for current period
        const rcgService = getRCGService();
        const revenueMetrics = await rcgService.calculateRevenueByTier();
        const distribution = rcgService.getRCGTokenReader().calculateDistribution(revenueMetrics.totalRevenue);
        
        // Store revenue distribution record
        // First, calculate the total RCN sold this week
        const weeklyRcnQuery = await treasuryRepo.query(`
            SELECT COALESCE(SUM(amount), 0) as weekly_rcn_sold
            FROM shop_rcn_purchases
            WHERE status = 'completed'
            AND created_at >= date_trunc('week', CURRENT_DATE)
            AND created_at < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
        `);
        const weeklyRcnSold = parseFloat(weeklyRcnQuery.rows[0]?.weekly_rcn_sold || '0');
        
        await treasuryRepo.query(`
            INSERT INTO revenue_distributions (
                week_start, week_end, total_rcn_sold, total_revenue_usd,
                operations_share, stakers_share, dao_treasury_share
            ) VALUES (
                date_trunc('week', CURRENT_DATE),
                date_trunc('week', CURRENT_DATE) + INTERVAL '6 days',
                $1, $2, $3, $4, $5
            ) ON CONFLICT (week_start, week_end) DO UPDATE SET
                total_rcn_sold = EXCLUDED.total_rcn_sold,
                total_revenue_usd = EXCLUDED.total_revenue_usd,
                operations_share = EXCLUDED.operations_share,
                stakers_share = EXCLUDED.stakers_share,
                dao_treasury_share = EXCLUDED.dao_treasury_share,
                created_at = NOW()
        `, [
            weeklyRcnSold,
            revenueMetrics.totalRevenue,
            distribution.operations,
            distribution.stakers,
            distribution.daoTreasury
        ]);
        
        // Get updated treasury data
        const treasuryData = {
            totalSupply: 'unlimited',
            totalSold: 0,
            totalRevenue: revenueMetrics.totalRevenue,
            distribution,
            lastUpdated: new Date()
        };
        
        res.json({
            success: true,
            message: 'Treasury data updated successfully',
            data: treasuryData
        });
    } catch (error) {
        console.error('Treasury update error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update treasury data',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;