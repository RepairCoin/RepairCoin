// backend/src/domains/shop/routes/purchase.ts
import { Router, Request, Response } from 'express';
import { shopPurchaseService, PurchaseRequest } from '../services/ShopPurchaseService';
import { logger } from '../../../utils/logger';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     PurchaseRequest:
 *       type: object
 *       required:
 *         - shopId
 *         - amount
 *         - paymentMethod
 *       properties:
 *         shopId:
 *           type: string
 *           description: Shop identifier
 *         amount:
 *           type: number
 *           minimum: 100
 *           description: Amount of RCN to purchase (minimum 100)
 *         paymentMethod:
 *           type: string
 *           enum: [credit_card, bank_transfer, usdc]
 *           description: Payment method for purchase
 *         paymentReference:
 *           type: string
 *           description: Optional payment reference number
 *     PurchaseResponse:
 *       type: object
 *       properties:
 *         purchaseId:
 *           type: string
 *           description: Unique purchase identifier
 *         totalCost:
 *           type: number
 *           description: Total cost in USD
 *         status:
 *           type: string
 *           enum: [pending, completed, failed]
 *           description: Purchase status
 *         message:
 *           type: string
 *           description: Human-readable status message
 */

/**
 * @swagger
 * /api/shops/purchase/initiate:
 *   post:
 *     summary: Initiate shop RCN purchase
 *     tags: [Shop Purchase]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PurchaseRequest'
 *     responses:
 *       200:
 *         description: Purchase initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PurchaseResponse'
 *       400:
 *         description: Invalid purchase request
 *       404:
 *         description: Shop not found
 *       500:
 *         description: Internal server error
 */
router.post('/initiate', async (req: Request, res: Response) => {
  try {
    const purchaseData: PurchaseRequest = {
      shopId: req.body.shopId,
      amount: req.body.amount,
      paymentMethod: req.body.paymentMethod,
      paymentReference: req.body.paymentReference
    };

    const result = await shopPurchaseService.purchaseRcn(purchaseData);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error initiating shop purchase:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate purchase'
    });
  }
});

/**
 * @swagger
 * /api/shops/purchase/complete:
 *   post:
 *     summary: Complete shop RCN purchase
 *     tags: [Shop Purchase]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - purchaseId
 *             properties:
 *               purchaseId:
 *                 type: string
 *                 description: Purchase ID from initiate request
 *               paymentReference:
 *                 type: string
 *                 description: Payment confirmation reference
 *     responses:
 *       200:
 *         description: Purchase completed successfully
 *       400:
 *         description: Invalid completion request
 *       404:
 *         description: Purchase not found
 *       500:
 *         description: Internal server error
 */
router.post('/complete', async (req: Request, res: Response) => {
  try {
    const { purchaseId, paymentReference } = req.body;

    if (!purchaseId) {
      return res.status(400).json({
        success: false,
        error: 'Purchase ID is required'
      });
    }

    const result = await shopPurchaseService.completePurchase(purchaseId, paymentReference);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error completing shop purchase:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete purchase'
    });
  }
});

/**
 * @swagger
 * /api/shops/purchase/balance/{shopId}:
 *   get:
 *     summary: Get shop RCN balance and statistics
 *     tags: [Shop Purchase]
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *         description: Shop identifier
 *     responses:
 *       200:
 *         description: Shop balance information
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
 *                     currentBalance:
 *                       type: number
 *                       description: Current RCN balance
 *                     totalPurchased:
 *                       type: number
 *                       description: Total RCN purchased all time
 *                     totalDistributed:
 *                       type: number
 *                       description: Total RCN distributed to customers
 *                     lastPurchaseDate:
 *                       type: string
 *                       format: date-time
 *                       description: Date of last purchase
 *                     recommendedPurchase:
 *                       type: number
 *                       description: Recommended next purchase amount
 *       404:
 *         description: Shop not found
 *       500:
 *         description: Internal server error
 */
router.get('/balance/:shopId', async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const balance = await shopPurchaseService.getShopBalance(shopId);

    res.json({
      success: true,
      data: balance
    });

  } catch (error) {
    logger.error('Error getting shop balance:', error);
    res.status(404).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve shop balance'
    });
  }
});

/**
 * @swagger
 * /api/shops/purchase/history/{shopId}:
 *   get:
 *     summary: Get shop RCN purchase history
 *     tags: [Shop Purchase]
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *         description: Shop identifier
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Purchase history retrieved successfully
 *       404:
 *         description: Shop not found
 *       500:
 *         description: Internal server error
 */
router.get('/history/:shopId', async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const history = await shopPurchaseService.getPurchaseHistory(shopId, page, limit);

    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    logger.error('Error getting purchase history:', error);
    res.status(404).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve purchase history'
    });
  }
});

export default router;