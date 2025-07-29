import { Router, Request, Response } from 'express';
import { databaseService } from '../../../services/DatabaseService';
import { TokenMinter } from '../../../../../contracts/TokenMinter';
import jwt from 'jsonwebtoken';

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
        const db = databaseService;
        
        // Get treasury data from database
        const treasuryData = await db.getTreasuryData();
        
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
        const topBuyers = await db.getTopRCNBuyers(10);
        
        // Get recent RCN purchases
        const recentPurchases = await db.getRecentRCNPurchases(20);
        
        // Calculate percentage sold based on actual total supply
        const percentageSold = actualTotalSupply > 0 
            ? (treasuryData.totalSold / actualTotalSupply) * 100 
            : 0;
        
        res.json({
            success: true,
            data: {
                totalSupply: actualTotalSupply,
                availableSupply: actualTotalSupply - treasuryData.totalSold,
                totalSold: treasuryData.totalSold,
                totalRevenue: treasuryData.totalRevenue,
                percentageSold: percentageSold.toFixed(2),
                lastUpdated: treasuryData.lastUpdated,
                topBuyers,
                recentPurchases
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
        const db = databaseService;
        
        // First, update total supply from blockchain
        try {
            const contractStats = await getTokenMinter().getContractStats();
            if (contractStats && contractStats.totalSupplyReadable > 0) {
                await db.updateTreasuryTotalSupply(contractStats.totalSupplyReadable);
            }
        } catch (error) {
            console.warn('Could not update total supply from blockchain:', error);
        }
        
        // Recalculate treasury from all shop RCN purchases
        await db.recalculateTreasury();
        
        // Get updated treasury data
        const treasuryData = await db.getTreasuryData();
        
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