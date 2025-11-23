// domains/customer/routes/balance.ts
import { Router } from 'express';
import { customerBalanceService } from '../services/CustomerBalanceService';
import { logger } from '../../../utils/logger';

const router = Router();

/**
 * @swagger
 * /api/customers/balance/{address}:
 *   get:
 *     summary: Get customer's enhanced balance information
 *     description: Returns comprehensive balance data including database balance, pending mints, and blockchain sync status
 *     tags: [Customer Balance]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer wallet address
 *     responses:
 *       200:
 *         description: Customer balance information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     address:
 *                       type: string
 *                     databaseBalance:
 *                       type: number
 *                       description: Current RCN balance in database (available for redemption)
 *                     pendingMintBalance:
 *                       type: number
 *                       description: RCN tokens queued for blockchain minting
 *                     totalBalance:
 *                       type: number
 *                       description: Total balance (database + pending)
 *                     lifetimeEarnings:
 *                       type: number
 *                     totalRedemptions:
 *                       type: number
 *                     lastBlockchainSync:
 *                       type: string
 *                       nullable: true
 *                     balanceSynced:
 *                       type: boolean
 *                     tier:
 *                       type: string
 *                       enum: [BRONZE, SILVER, GOLD]
 *                     canMintToWallet:
 *                       type: boolean
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Server error
 */
router.get('/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format'
      });
    }

    const balanceInfo = await customerBalanceService.getCustomerBalanceInfo(address);
    
    if (!balanceInfo) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    res.json({
      success: true,
      data: balanceInfo
    });
  } catch (error) {
    logger.error('Error getting customer balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get customer balance'
    });
  }
});

/**
 * @swagger
 * /api/customers/balance/{address}/queue-mint:
 *   post:
 *     summary: Queue customer balance for minting to wallet
 *     description: Move RCN tokens from database balance to pending mint queue for blockchain minting
 *     tags: [Customer Balance]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer wallet address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0.00000001
 *                 description: Amount of RCN to queue for minting
 *             required:
 *               - amount
 *     responses:
 *       200:
 *         description: Successfully queued for minting
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     customerAddress:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     requestedAt:
 *                       type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request or insufficient balance
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Server error
 */
router.post('/:address/queue-mint', async (req, res) => {
  try {
    const { address } = req.params;
    const { amount } = req.body;

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format'
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount. Must be greater than zero.'
      });
    }

    // Validate mint request
    const validation = await customerBalanceService.validateMintRequest(address, amount);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.reason,
        maxAllowed: validation.maxAllowed
      });
    }

    // Queue for minting
    const mintRequest = await customerBalanceService.queueForMinting(address, amount);

    res.json({
      success: true,
      data: mintRequest,
      message: `Successfully queued ${amount} RCN for minting to wallet`
    });
  } catch (error) {
    logger.error('Error queueing mint request:', error);
    
    if (error instanceof Error && error.message.includes('Insufficient')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to queue mint request'
    });
  }
});

/**
 * @swagger
 * /api/customers/balance/{address}/sync:
 *   post:
 *     summary: Sync customer balance with transaction history
 *     description: Recalculate customer balance from transaction data (maintenance operation)
 *     tags: [Customer Balance]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer wallet address
 *     responses:
 *       200:
 *         description: Balance synchronized successfully
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Server error
 */
router.post('/:address/sync', async (req, res) => {
  try {
    const { address } = req.params;

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format'
      });
    }

    const balanceInfo = await customerBalanceService.syncCustomerBalance(address);

    res.json({
      success: true,
      data: balanceInfo,
      message: 'Customer balance synchronized successfully'
    });
  } catch (error) {
    logger.error('Error syncing customer balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync customer balance'
    });
  }
});

/**
 * @swagger
 * /api/customers/balance/pending-mints:
 *   get:
 *     summary: Get customers with pending mint requests
 *     description: Returns list of customers who have tokens queued for blockchain minting
 *     tags: [Customer Balance]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *         description: Maximum number of customers to return
 *     responses:
 *       200:
 *         description: List of customers with pending mints
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       customerAddress:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       requestedAt:
 *                         type: string
 *       500:
 *         description: Server error
 */
router.get('/pending-mints', async (req, res) => {
  try {
    const rawLimit = req.query.limit;
    const limit = rawLimit !== undefined ? parseInt(rawLimit as string) : 100;

    if (limit > 1000 || limit < 1) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be between 1 and 1000'
      });
    }

    const pendingMints = await customerBalanceService.getPendingMints(limit);

    res.json({
      success: true,
      data: pendingMints
    });
  } catch (error) {
    logger.error('Error getting pending mints:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pending mints'
    });
  }
});

/**
 * @swagger
 * /api/customers/balance/statistics:
 *   get:
 *     summary: Get balance statistics
 *     description: Returns aggregate statistics about customer balances across the platform
 *     tags: [Customer Balance]
 *     responses:
 *       200:
 *         description: Balance statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalDatabaseBalance:
 *                       type: number
 *                       description: Total RCN in customer database balances
 *                     totalPendingMints:
 *                       type: number
 *                       description: Total RCN queued for minting
 *                     totalCustomersWithBalance:
 *                       type: number
 *                       description: Number of customers with positive balance
 *                     averageBalance:
 *                       type: number
 *                       description: Average balance per customer (excluding zero balances)
 *       500:
 *         description: Server error
 */
router.get('/statistics', async (req, res) => {
  try {
    const statistics = await customerBalanceService.getBalanceStatistics();

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    logger.error('Error getting balance statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get balance statistics'
    });
  }
});

export default router;