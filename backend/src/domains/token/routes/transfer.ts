import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { ResponseHelper } from '../../../utils/responseHelper';
import { TokenService } from '../services/TokenService';
import { TransactionRepository } from '../../../repositories/TransactionRepository';
import { CustomerRepository } from '../../../repositories/CustomerRepository';
import { logger } from '../../../utils/logger';
import { eventBus } from '../../../events/EventBus';

const router = Router();
const tokenService = new TokenService();
const transactionRepository = new TransactionRepository();
const customerRepository = new CustomerRepository();

interface TransferTokensRequest {
  fromAddress: string;
  toAddress: string;
  amount: number;
  message?: string;
  transactionHash: string; // Hash of the on-chain transfer
}

/**
 * @swagger
 * /api/tokens/transfer:
 *   post:
 *     summary: Transfer RCN tokens between customers
 *     description: Transfer RCN tokens from one customer to another (gift tokens)
 *     tags: [Tokens]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromAddress
 *               - toAddress
 *               - amount
 *               - transactionHash
 *             properties:
 *               fromAddress:
 *                 type: string
 *                 description: Sender's wallet address
 *                 example: "0x1234567890123456789012345678901234567890"
 *               toAddress:
 *                 type: string
 *                 description: Recipient's wallet address
 *                 example: "0x0987654321098765432109876543210987654321"
 *               amount:
 *                 type: number
 *                 description: Amount of RCN tokens to transfer
 *                 example: 50
 *               message:
 *                 type: string
 *                 description: Optional message to include with the transfer
 *                 example: "Happy Birthday!"
 *               transactionHash:
 *                 type: string
 *                 description: Hash of the completed blockchain transaction
 *                 example: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
 *     responses:
 *       200:
 *         description: Transfer completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     transferId:
 *                       type: string
 *                       example: "12345"
 *                     fromAddress:
 *                       type: string
 *                       example: "0x1234567890123456789012345678901234567890"
 *                     toAddress:
 *                       type: string
 *                       example: "0x0987654321098765432109876543210987654321"
 *                     amount:
 *                       type: number
 *                       example: 50
 *                     transactionHash:
 *                       type: string
 *                       example: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
 *                     timestamp:
 *                       type: string
 *                       example: "2025-10-11T12:00:00Z"
 *       400:
 *         description: Invalid transfer request
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Transfer failed
 */
router.post('/transfer', asyncHandler(async (req: Request, res: Response) => {
  const { fromAddress, toAddress, amount, message, transactionHash }: TransferTokensRequest = req.body;

  // Validate required fields
  if (!fromAddress || !toAddress || !amount || !transactionHash) {
    return ResponseHelper.badRequest(res, 'Missing required fields: fromAddress, toAddress, amount, transactionHash');
  }

  // Validate addresses are different
  if (fromAddress.toLowerCase() === toAddress.toLowerCase()) {
    return ResponseHelper.badRequest(res, 'Cannot transfer tokens to yourself');
  }

  // Validate amount is positive
  if (amount <= 0) {
    return ResponseHelper.badRequest(res, 'Transfer amount must be positive');
  }

  // Validate Ethereum addresses
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!ethAddressRegex.test(fromAddress) || !ethAddressRegex.test(toAddress)) {
    return ResponseHelper.badRequest(res, 'Invalid wallet address format');
  }

  try {
    logger.info('Processing token transfer', {
      fromAddress,
      toAddress,
      amount,
      transactionHash
    });

    // Check if sender exists and has sufficient balance
    const senderBalance = await customerRepository.getCustomerBalance(fromAddress);
    if (!senderBalance || senderBalance.totalBalance < amount) {
      return ResponseHelper.badRequest(res, 'Insufficient balance for transfer');
    }

    // Verify transaction hash hasn't been used before
    const existingTransfer = await transactionRepository.getByTransactionHash(transactionHash);
    if (existingTransfer) {
      return ResponseHelper.badRequest(res, 'Transaction hash already used');
    }

    // Check if recipient exists, if not create a basic customer record
    let recipientExists = true;
    try {
      await customerRepository.getCustomer(toAddress);
    } catch (error) {
      recipientExists = false;
      logger.info('Creating new customer record for transfer recipient', { toAddress });
      
      // Create basic customer record for recipient
      await customerRepository.createCustomer({
        address: toAddress,
        email: '', // Empty email for wallet-only accounts
        tier: 'BRONZE',
        isActive: true,
        lifetimeEarnings: 0,
        currentBalance: 0,
        lastEarnedDate: new Date().toISOString(),
        joinDate: new Date().toISOString(),
        referralCount: 0
      });
    }

    // Record the transfer in transactions table
    const transferTransaction = await transactionRepository.create({
      customerAddress: fromAddress,
      shopId: null, // No shop involved in customer-to-customer transfers
      type: 'transfer_out',
      amount: -amount, // Negative for sender
      reason: `Token transfer to ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`,
      transactionHash,
      timestamp: new Date().toISOString(),
      status: 'completed',
      metadata: {
        transferType: 'gift',
        recipientAddress: toAddress,
        message: message || null,
        isRecipientNew: !recipientExists
      }
    });

    // Record the receipt for the recipient
    await transactionRepository.create({
      customerAddress: toAddress,
      shopId: null,
      type: 'transfer_in',
      amount: amount, // Positive for recipient
      reason: `Token transfer from ${fromAddress.slice(0, 6)}...${fromAddress.slice(-4)}`,
      transactionHash,
      timestamp: new Date().toISOString(),
      status: 'completed',
      metadata: {
        transferType: 'gift',
        senderAddress: fromAddress,
        message: message || null,
        isNewCustomer: !recipientExists
      }
    });

    // Update customer balances
    await customerRepository.updateBalanceAfterTransfer(fromAddress, -amount);
    await customerRepository.updateBalanceAfterTransfer(toAddress, amount);

    logger.info('Token transfer completed successfully', {
      transferId: transferTransaction.id,
      fromAddress,
      toAddress,
      amount,
      transactionHash
    });

    // Emit event for notification system
    try {
      const sender = await customerRepository.getCustomer(fromAddress);
      const senderName = sender?.name || fromAddress.slice(0, 6) + '...' + fromAddress.slice(-4);

      await eventBus.publish({
        type: 'customer:token_gifted',
        aggregateId: transactionHash,
        data: {
          fromCustomerAddress: fromAddress,
          toCustomerAddress: toAddress,
          fromCustomerName: senderName,
          amount,
          transactionId: transactionHash
        },
        timestamp: new Date(),
        source: 'TokenTransferRoutes',
        version: 1
      });
    } catch (eventError) {
      logger.error('Failed to emit token_gifted event:', eventError);
    }

    ResponseHelper.success(res, {
      transferId: transferTransaction.id,
      fromAddress,
      toAddress,
      amount,
      message,
      transactionHash,
      timestamp: transferTransaction.createdAt,
      recipientWasNew: !recipientExists
    });

  } catch (error) {
    logger.error('Token transfer failed:', error);
    ResponseHelper.internalServerError(res, 'Failed to process token transfer');
  }
}));

/**
 * @swagger
 * /api/tokens/transfer-history/{address}:
 *   get:
 *     summary: Get transfer history for a customer
 *     description: Retrieve all token transfers (sent and received) for a specific customer
 *     tags: [Tokens]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer wallet address
 *         example: "0x1234567890123456789012345678901234567890"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 50
 *         description: Maximum number of transfers to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: number
 *           default: 0
 *         description: Number of transfers to skip
 *     responses:
 *       200:
 *         description: Transfer history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     transfers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "12345"
 *                           type:
 *                             type: string
 *                             enum: [transfer_in, transfer_out]
 *                             example: "transfer_out"
 *                           amount:
 *                             type: number
 *                             example: 50
 *                           otherParty:
 *                             type: string
 *                             example: "0x0987654321098765432109876543210987654321"
 *                           message:
 *                             type: string
 *                             example: "Happy Birthday!"
 *                           transactionHash:
 *                             type: string
 *                             example: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
 *                           timestamp:
 *                             type: string
 *                             example: "2025-10-11T12:00:00Z"
 *                     total:
 *                       type: number
 *                       example: 25
 *                     limit:
 *                       type: number
 *                       example: 50
 *                     offset:
 *                       type: number
 *                       example: 0
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Failed to retrieve transfer history
 */
router.get('/transfer-history/:address', asyncHandler(async (req: Request, res: Response) => {
  const { address } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  // Validate address format
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!ethAddressRegex.test(address)) {
    return ResponseHelper.badRequest(res, 'Invalid wallet address format');
  }

  try {
    // Check if customer exists
    await customerRepository.getCustomer(address);

    // Get transfer transactions
    const transfers = await transactionRepository.getTransferHistory(
      address, 
      parseInt(limit as string), 
      parseInt(offset as string)
    );

    const total = await transactionRepository.getTransferHistoryCount(address);

    // Format the transfers for response
    const formattedTransfers = transfers.map(transfer => ({
      id: transfer.id,
      type: transfer.type,
      amount: Math.abs(transfer.amount), // Always show positive amount
      direction: transfer.type === 'transfer_out' ? 'sent' : 'received',
      otherParty: transfer.type === 'transfer_out' 
        ? transfer.metadata?.recipientAddress 
        : transfer.metadata?.senderAddress,
      message: transfer.metadata?.message,
      transactionHash: transfer.transactionHash,
      timestamp: transfer.createdAt,
      status: transfer.status
    }));

    ResponseHelper.success(res, {
      transfers: formattedTransfers,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

  } catch (error) {
    if (error.message === 'Customer not found') {
      return ResponseHelper.notFound(res, 'Customer not found');
    }
    logger.error('Failed to retrieve transfer history:', error);
    ResponseHelper.internalServerError(res, 'Failed to retrieve transfer history');
  }
}));

/**
 * @swagger
 * /api/tokens/validate-transfer:
 *   post:
 *     summary: Validate a potential token transfer
 *     description: Check if a token transfer is valid before executing it
 *     tags: [Tokens]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromAddress
 *               - toAddress
 *               - amount
 *             properties:
 *               fromAddress:
 *                 type: string
 *                 example: "0x1234567890123456789012345678901234567890"
 *               toAddress:
 *                 type: string
 *                 example: "0x0987654321098765432109876543210987654321"
 *               amount:
 *                 type: number
 *                 example: 50
 *     responses:
 *       200:
 *         description: Transfer validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     valid:
 *                       type: boolean
 *                       example: true
 *                     senderBalance:
 *                       type: number
 *                       example: 100
 *                     recipientExists:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: "Transfer is valid"
 *       400:
 *         description: Invalid request parameters
 */
router.post('/validate-transfer', asyncHandler(async (req: Request, res: Response) => {
  const { fromAddress, toAddress, amount } = req.body;

  // Validate required fields
  if (!fromAddress || !toAddress || !amount) {
    return ResponseHelper.badRequest(res, 'Missing required fields: fromAddress, toAddress, amount');
  }

  // Validate amount is positive
  if (amount <= 0) {
    return ResponseHelper.badRequest(res, 'Transfer amount must be positive');
  }

  // Validate addresses are different
  if (fromAddress.toLowerCase() === toAddress.toLowerCase()) {
    return ResponseHelper.success(res, {
      valid: false,
      message: 'Cannot transfer tokens to yourself'
    });
  }

  // Validate Ethereum addresses
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!ethAddressRegex.test(fromAddress) || !ethAddressRegex.test(toAddress)) {
    return ResponseHelper.badRequest(res, 'Invalid wallet address format');
  }

  try {
    // Check sender balance
    const senderBalance = await customerRepository.getCustomerBalance(fromAddress);
    if (!senderBalance) {
      return ResponseHelper.success(res, {
        valid: false,
        message: 'Sender not found',
        senderBalance: 0,
        recipientExists: false
      });
    }

    if (senderBalance.totalBalance < amount) {
      return ResponseHelper.success(res, {
        valid: false,
        message: 'Insufficient balance',
        senderBalance: senderBalance.totalBalance,
        recipientExists: false
      });
    }

    // Check if recipient exists
    let recipientExists = true;
    try {
      await customerRepository.getCustomer(toAddress);
    } catch (error) {
      recipientExists = false;
    }

    ResponseHelper.success(res, {
      valid: true,
      message: recipientExists ? 'Transfer is valid' : 'Transfer is valid (new recipient will be created)',
      senderBalance: senderBalance.totalBalance,
      recipientExists
    });

  } catch (error) {
    logger.error('Transfer validation failed:', error);
    ResponseHelper.internalServerError(res, 'Failed to validate transfer');
  }
}));

export default router;