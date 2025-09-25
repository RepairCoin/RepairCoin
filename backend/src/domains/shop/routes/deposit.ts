import { Router, Request, Response } from 'express';
import { ShopRepository } from '../../../repositories/ShopRepository';
import { TokenService } from '../../token/services/TokenService';
import { DatabaseService } from '../../../services/DatabaseService';
import { logger } from '../../../utils/logger';

const router = Router();
const shopRepository = new ShopRepository();
const tokenService = new TokenService();
const db = DatabaseService.getInstance();

interface AuthenticatedRequest extends Request {
  walletAddress?: string;
  body: any;
  query: any;
}

// Get deposit information (wallet balance vs operational balance)
router.get('/info', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const walletAddress = req.walletAddress;
    if (!walletAddress) {
      return res.status(401).json({ success: false, error: 'Wallet address not found' });
    }

    // Get shop data
    const shop = await shopRepository.getShopByWallet(walletAddress);
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    // Get blockchain balance
    const blockchainBalance = await tokenService.getRCNBalance(walletAddress);

    // Get pending deposits (if any)
    const pendingQuery = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as pending_amount
      FROM shop_deposits
      WHERE shop_id = $1 AND status = 'pending'
    `, [shop.shopId]);
    const pendingDeposits = parseFloat(pendingQuery.rows[0]?.pending_amount || '0');

    // Calculate available to deposit (blockchain balance - pending deposits)
    const availableToDeposit = Math.max(0, blockchainBalance - pendingDeposits);

    res.json({
      success: true,
      data: {
        shopId: shop.shopId,
        walletAddress: shop.walletAddress,
        operationalBalance: shop.purchasedRcnBalance || 0,
        blockchainBalance: blockchainBalance,
        pendingDeposits: pendingDeposits,
        availableToDeposit: availableToDeposit
      }
    });
  } catch (error) {
    logger.error('Error fetching deposit info:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch deposit information' });
  }
});

// Create deposit request
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const walletAddress = req.walletAddress;
    const { amount } = req.body;

    if (!walletAddress) {
      return res.status(401).json({ success: false, error: 'Wallet address not found' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid deposit amount' });
    }

    // Get shop data
    const shop = await shopRepository.getShopByWallet(walletAddress);
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    // Verify shop has sufficient blockchain balance
    const blockchainBalance = await tokenService.getRCNBalance(walletAddress);
    if (blockchainBalance < amount) {
      return res.status(400).json({ 
        success: false, 
        error: 'Insufficient blockchain balance',
        data: {
          requested: amount,
          available: blockchainBalance
        }
      });
    }

    // Check for existing pending deposits
    const pendingCheck = await db.query(`
      SELECT COUNT(*) as count
      FROM shop_deposits
      WHERE shop_id = $1 AND status = 'pending'
    `, [shop.shopId]);

    if (parseInt(pendingCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'You have a pending deposit. Please wait for it to complete.' 
      });
    }

    // Create deposit record
    const insertResult = await db.query(`
      INSERT INTO shop_deposits (
        shop_id,
        amount,
        wallet_address,
        status,
        created_at,
        deposit_type
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      shop.shopId,
      amount,
      shop.walletAddress,
      'pending',
      new Date().toISOString(),
      'wallet_to_operational'
    ]);

    const deposit = insertResult.rows[0];

    // Note: In a production system, this would trigger a blockchain transaction
    // For now, we'll auto-approve after verification
    
    // Auto-approve the deposit (in production, this would be after blockchain confirmation)
    await db.query(`BEGIN`);
    
    try {
      // Update deposit status
      await db.query(`
        UPDATE shop_deposits 
        SET status = 'completed', 
            completed_at = $1,
            transaction_note = $2
        WHERE id = $3
      `, [
        new Date().toISOString(),
        'Auto-approved for testing',
        deposit.id
      ]);

      // Update shop operational balance
      await db.query(`
        UPDATE shops 
        SET purchased_rcn_balance = COALESCE(purchased_rcn_balance, 0) + $1
        WHERE shop_id = $2
      `, [amount, shop.shopId]);

      await db.query(`COMMIT`);

      // Get updated shop data
      const updatedShop = await shopRepository.getShopByWallet(walletAddress);

      res.json({
        success: true,
        message: 'Deposit completed successfully',
        data: {
          depositId: deposit.id,
          amount: amount,
          newOperationalBalance: updatedShop?.purchasedRcnBalance || 0,
          status: 'completed'
        }
      });
    } catch (error) {
      await db.query(`ROLLBACK`);
      throw error;
    }
  } catch (error) {
    logger.error('Error processing deposit:', error);
    res.status(500).json({ success: false, error: 'Failed to process deposit' });
  }
});

// Get deposit history
router.get('/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const walletAddress = req.walletAddress;
    if (!walletAddress) {
      return res.status(401).json({ success: false, error: 'Wallet address not found' });
    }

    const shop = await shopRepository.getShopByWallet(walletAddress);
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const historyQuery = await db.query(`
      SELECT 
        id,
        amount,
        status,
        created_at,
        completed_at,
        transaction_note,
        deposit_type
      FROM shop_deposits
      WHERE shop_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [shop.shopId, Number(limit), offset]);

    const countQuery = await db.query(`
      SELECT COUNT(*) as total
      FROM shop_deposits
      WHERE shop_id = $1
    `, [shop.shopId]);

    const total = parseInt(countQuery.rows[0].total);

    res.json({
      success: true,
      data: {
        deposits: historyQuery.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching deposit history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch deposit history' });
  }
});

export default router;