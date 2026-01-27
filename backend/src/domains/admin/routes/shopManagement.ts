import { Router, Request, Response } from 'express';
import { ShopRepository } from '../../../repositories/ShopRepository';
import jwt from 'jsonwebtoken';
import { logger } from '../../../utils/logger';

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
        let operationalStatus: 'pending' | 'rcg_qualified' | 'subscription_qualified' | 'not_qualified' | 'paused' = 'not_qualified';
        if (rcgBalance >= 10000) {
            operationalStatus = 'rcg_qualified';
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
        logger.error('Error updating shop RCG balance:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update shop RCG balance',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Update all shops with NULL category to default value
router.post('/shops/update-null-categories', verifyAdminToken, async (req: Request, res: Response) => {
    try {
        const shopRepo = new ShopRepository();

        // Get shops with NULL category using raw query
        const { pool } = require('../../../config/database-pool');

        // Check how many shops have NULL category
        const checkResult = await pool.query(
            'SELECT COUNT(*) as count FROM shops WHERE category IS NULL'
        );
        const nullCount = parseInt(checkResult.rows[0].count);

        logger.info(`Found ${nullCount} shops with NULL category`);

        if (nullCount === 0) {
            return res.json({
                success: true,
                message: 'All shops already have categories assigned',
                data: {
                    updatedCount: 0,
                    remainingNullCount: 0
                }
            });
        }

        // Update all shops with NULL category to 'Repairs and Tech'
        const updateResult = await pool.query(
            `UPDATE shops
             SET category = 'Repairs and Tech'
             WHERE category IS NULL
             RETURNING shop_id, name, category`
        );

        logger.info(`Updated ${updateResult.rows.length} shops to 'Repairs and Tech'`);

        // Verify the update
        const verifyResult = await pool.query(
            'SELECT COUNT(*) as count FROM shops WHERE category IS NULL'
        );
        const remainingNull = parseInt(verifyResult.rows[0].count);

        res.json({
            success: true,
            message: `Successfully updated ${updateResult.rows.length} shops to 'Repairs and Tech'`,
            data: {
                updatedCount: updateResult.rows.length,
                remainingNullCount: remainingNull,
                updatedShops: updateResult.rows.map((row: any) => ({
                    shopId: row.shop_id,
                    name: row.name,
                    category: row.category
                }))
            }
        });
    } catch (error) {
        logger.error('Error updating shop categories:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update shop categories',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;