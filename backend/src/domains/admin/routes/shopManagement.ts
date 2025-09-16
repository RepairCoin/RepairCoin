import { Router, Request, Response } from 'express';
import { ShopRepository } from '../../../repositories/ShopRepository';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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

// Manually update shop RCG balance (for testing/correction)
router.post('/shops/:shopId/update-rcg-balance', verifyAdminToken, async (req: Request, res: Response) => {
    try {
        const { shopId } = req.params;
        const { rcgBalance } = req.body;
        
        if (typeof rcgBalance !== 'number' || rcgBalance < 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid RCG balance. Must be a non-negative number.' 
            });
        }
        
        const shopRepo = new ShopRepository();
        
        // Get current shop data
        const shop = await shopRepo.getShop(shopId);
        if (!shop) {
            return res.status(404).json({ success: false, error: 'Shop not found' });
        }
        
        // Determine tier based on balance
        let tier: 'none' | 'standard' | 'premium' | 'elite' = 'none';
        if (rcgBalance >= 200000) {
            tier = 'elite';
        } else if (rcgBalance >= 50000) {
            tier = 'premium';
        } else if (rcgBalance >= 10000) {
            tier = 'standard';
        }
        
        // Determine operational status
        let operationalStatus: 'pending' | 'rcg_qualified' | 'commitment_qualified' | 'not_qualified' = 'not_qualified';
        if (rcgBalance >= 10000) {
            operationalStatus = 'rcg_qualified';
        } else if (shop.commitment_enrolled) {
            operationalStatus = 'commitment_qualified';
        }
        
        // Update shop
        await shopRepo.updateShop(shopId, {
            rcg_balance: rcgBalance,
            rcg_tier: tier,
            tier_updated_at: new Date().toISOString(),
            operational_status: operationalStatus
        });
        
        // Get updated shop data
        const updatedShop = await shopRepo.getShop(shopId);
        
        res.json({
            success: true,
            message: 'Shop RCG balance updated successfully',
            data: {
                shopId: updatedShop?.shopId,
                name: updatedShop?.name,
                rcg_balance: updatedShop?.rcg_balance,
                rcg_tier: updatedShop?.rcg_tier,
                operational_status: updatedShop?.operational_status,
                tier_updated_at: updatedShop?.tier_updated_at
            }
        });
    } catch (error) {
        console.error('Error updating shop RCG balance:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update shop RCG balance',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;