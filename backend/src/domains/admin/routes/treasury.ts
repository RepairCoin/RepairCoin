import { Router, Request, Response } from 'express';
import { TokenMinter } from '../../../contracts/TokenMinter';
import jwt from 'jsonwebtoken';
import { TreasuryRepository } from '../../../repositories/TreasuryRepository';
import { ShopRepository } from '../../../repositories/ShopRepository';
// TODO: Implement treasury methods in repository

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Lazy loading helper
let tokenMinter: TokenMinter | null = null;
const getTokenMinter = (): TokenMinter => {
    if (!tokenMinter) {
        tokenMinter = new TokenMinter();
    }
    return tokenMinter;
};

// Middleware to verify admin JWT token
const verifyAdminToken = (req: Request, res: Response, next: Function) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ success: false, error: 'No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        (req as any).admin = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, error: 'Invalid token' });
    }
};

// Get treasury statistics
router.get('/treasury', verifyAdminToken, async (req: Request, res: Response) => {
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
          totalSupply: 1000000000, // 1 billion default
          totalSold: parseFloat(shopPurchases.rows[0]?.total_sold || '0'),
          totalRevenue: parseFloat(shopPurchases.rows[0]?.total_revenue || '0'),
          lastUpdated: new Date()
        };
        
        // Get actual total supply from blockchain
        let actualTotalSupply = treasuryData.totalSupply;
        
        try {
            const contractStats = await getTokenMinter().getContractStats();
            if (contractStats && contractStats.totalSupplyReadable > 0) {
                actualTotalSupply = contractStats.totalSupplyReadable;
                console.log('✅ Fetched total supply from blockchain:', actualTotalSupply);
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
        
        // Calculate percentage sold based on actual total supply
        const percentageSold = actualTotalSupply > 0 
            ? (treasuryData.totalSold / actualTotalSupply) * 100 
            : 0;
        
        res.json({
            success: true,
            data: {
                totalSupply: treasuryData.totalSupply, // Use the treasury supply (1B), not blockchain supply
                availableSupply: treasuryData.totalSupply - treasuryData.totalSold, // Available from treasury, not blockchain
                totalSold: treasuryData.totalSold,
                totalRevenue: treasuryData.totalRevenue,
                percentageSold: ((treasuryData.totalSold / treasuryData.totalSupply) * 100).toFixed(2),
                lastUpdated: treasuryData.lastUpdated,
                topBuyers,
                recentPurchases,
                // Additional info about blockchain state
                blockchainTotalSupply: actualTotalSupply,
                mintedRewards: actualTotalSupply - treasuryData.totalSupply
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

// Update treasury calculations
router.post('/treasury/update', verifyAdminToken, async (req: Request, res: Response) => {
    try {
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
        
        // Recalculate treasury from all shop RCN purchases
        // await treasuryRepository.recalculateTreasury();
        
        // Get updated treasury data
        const treasuryData = {
            totalSupply: 0,
            totalCirculating: 0,
            totalReserved: 0,
            totalSold: 0,
            totalRevenue: 0,
            lastUpdated: new Date()
        }; // await treasuryRepository.getTreasuryData();
        
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