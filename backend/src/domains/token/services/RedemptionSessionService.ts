// backend/src/domains/token/services/RedemptionSessionService.ts
import crypto from 'crypto';
import { logger } from '../../../utils/logger';
import { customerRepository, shopRepository, redemptionSessionRepository } from '../../../repositories';

export interface RedemptionSession {
  sessionId: string;
  customerAddress: string;
  shopId: string;
  maxAmount: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'used';
  createdAt: Date;
  expiresAt: Date;
  approvedAt?: Date;
  usedAt?: Date;
  signature?: string;
  metadata?: any;
}

export interface CreateSessionParams {
  customerAddress: string;
  shopId: string;
  amount: number;
}

export interface ApproveSessionParams {
  sessionId: string;
  customerAddress: string;
  signature: string;
  transactionHash?: string; // Optional: hash of transfer transaction if customer transferred tokens
}

export class RedemptionSessionService {
  private readonly SESSION_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Clean up expired sessions every minute
    setInterval(() => this.cleanupExpiredSessions(), 60 * 1000);
  }

  /**
   * Create a redemption session (initiated by shop)
   */
  async createRedemptionSession(params: CreateSessionParams): Promise<RedemptionSession> {
    const { customerAddress, shopId, amount } = params;

    // Validate customer exists
    const customer = await customerRepository.getCustomer(customerAddress);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Validate shop exists and is active
    const shop = await shopRepository.getShop(shopId);
    if (!shop || !shop.active || !shop.verified) {
      throw new Error('Shop not found or not active');
    }

    // Check for existing pending sessions
    const existingSession = await redemptionSessionRepository.findPendingSessionForCustomer(customerAddress, shopId);
    if (existingSession) {
      throw new Error('A pending redemption session already exists');
    }

    // Create new session
    const sessionId = crypto.randomUUID();
    const session: RedemptionSession = {
      sessionId,
      customerAddress: customerAddress.toLowerCase(),
      shopId,
      maxAmount: amount,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.SESSION_DURATION)
    };

    // Store session in database
    await redemptionSessionRepository.createSession(session);

    logger.info('Redemption session created', {
      sessionId,
      customerAddress,
      shopId,
      amount
    });

    // TODO: Send notification to customer app/email
    this.notifyCustomer(session);

    return session;
  }


  /**
   * Customer approves a redemption session
   */
  async approveSession(params: ApproveSessionParams): Promise<RedemptionSession> {
    const { sessionId, customerAddress, signature, transactionHash } = params;

    const session = await redemptionSessionRepository.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Verify session belongs to customer
    if (session.customerAddress.toLowerCase() !== customerAddress.toLowerCase()) {
      throw new Error('Session does not belong to this customer');
    }

    // Check session status
    if (session.status !== 'pending') {
      throw new Error(`Session is ${session.status}, cannot approve`);
    }

    // Check expiry
    if (session.expiresAt < new Date()) {
      session.status = 'expired';
      throw new Error('Session has expired');
    }

    // Verify customer has sufficient balance
    const { verificationService } = await import('./VerificationService');
    const verification = await verificationService.verifyRedemption(
      customerAddress,
      session.shopId,
      session.maxAmount
    );

    if (!verification.canRedeem) {
      logger.warn('Customer attempted to approve redemption with insufficient balance', {
        sessionId,
        customerAddress,
        requestedAmount: session.maxAmount,
        availableBalance: verification.availableBalance,
        message: verification.message
      });
      throw new Error(`Cannot approve redemption: ${verification.message}`);
    }

    // TODO: Verify signature
    // const isValidSignature = await this.verifySignature(session, signature);
    // if (!isValidSignature) {
    //   throw new Error('Invalid signature');
    // }

    // Approve session and immediately process redemption
    await redemptionSessionRepository.updateSessionStatus(sessionId, 'approved', signature);
    
    // Update local object
    session.status = 'approved';
    session.approvedAt = new Date();
    session.signature = signature;
    
    // Store transaction hash if provided (indicates customer transferred tokens)
    if (transactionHash) {
      session.metadata = {
        ...session.metadata,
        transferTransactionHash: transactionHash
      };
    }

    logger.info('Redemption session approved, processing redemption immediately', {
      sessionId,
      customerAddress,
      shopId: session.shopId,
      amount: session.maxAmount,
      hasTransferTx: !!transactionHash
    });

    // Immediately process the redemption
    try {
      await this.processApprovedRedemption(session);
      
      // Mark session as used (completed)
      await redemptionSessionRepository.updateSessionStatus(sessionId, 'used');
      session.status = 'used';
      session.usedAt = new Date();
      
      logger.info('Redemption automatically completed after approval', {
        sessionId,
        customerAddress,
        shopId: session.shopId,
        amount: session.maxAmount
      });
    } catch (error) {
      logger.error('Failed to process redemption after approval', {
        sessionId,
        customerAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Don't throw - session is still approved, shop can try to process later
    }

    return session;
  }

  /**
   * Reject a redemption session
   */
  async rejectSession(sessionId: string, customerAddress: string): Promise<void> {
    const session = await redemptionSessionRepository.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.customerAddress.toLowerCase() !== customerAddress.toLowerCase()) {
      throw new Error('Session does not belong to this customer');
    }

    if (session.status !== 'pending') {
      throw new Error(`Session is ${session.status}, cannot reject`);
    }

    // Update session in database
    await redemptionSessionRepository.updateSessionStatus(sessionId, 'rejected');

    logger.info('Redemption session rejected', {
      sessionId,
      customerAddress,
      shopId: session.shopId
    });
  }

  /**
   * Validate and consume a session for redemption
   */
  async validateAndConsumeSession(sessionId: string, shopId: string, amount: number): Promise<RedemptionSession> {
    logger.info('Attempting to validate and consume session', {
      sessionId,
      shopId,
      amount
    });

    const session = await redemptionSessionRepository.getSession(sessionId);
    if (!session) {
      logger.error('Session not found during validation', { sessionId });
      throw new Error('Session not found');
    }

    logger.info('Session found with details', {
      sessionId: session.sessionId,
      status: session.status,
      usedAt: session.usedAt,
      expiresAt: session.expiresAt,
      shopId: session.shopId,
      customerAddress: session.customerAddress
    });

    // Verify shop matches
    if (session.shopId !== shopId) {
      logger.error('Shop mismatch', { sessionShop: session.shopId, requestedShop: shopId });
      throw new Error('Session is for a different shop');
    }

    // Check status
    if (session.status !== 'approved') {
      logger.error('Session status invalid', { 
        currentStatus: session.status,
        expectedStatus: 'approved',
        sessionId
      });
      throw new Error(`Session is ${session.status}, not approved`);
    }

    // Check if already used
    if (session.usedAt) {
      logger.error('Session already used', { 
        sessionId,
        usedAt: session.usedAt
      });
      throw new Error('Session has already been used');
    }

    // Check expiry
    if (session.expiresAt < new Date()) {
      session.status = 'expired';
      logger.error('Session has expired', {
        sessionId,
        expiresAt: session.expiresAt,
        now: new Date()
      });
      throw new Error('Session has expired');
    }

    // Check amount
    if (amount > session.maxAmount) {
      logger.error('Amount exceeds session limit', {
        requestedAmount: amount,
        maxAmount: session.maxAmount,
        sessionId
      });
      throw new Error(`Requested amount ${amount} exceeds session limit ${session.maxAmount}`);
    }

    // Mark as used in database
    logger.info('Marking session as used', { sessionId });
    await redemptionSessionRepository.updateSessionStatus(sessionId, 'used');
    
    // Update local object
    session.status = 'used';
    session.usedAt = new Date();

    logger.info('Redemption session consumed successfully', {
      sessionId,
      shopId,
      amount,
      customerAddress: session.customerAddress
    });

    return session;
  }

  /**
   * Get active sessions for a customer
   */
  async getCustomerSessions(customerAddress: string): Promise<RedemptionSession[]> {
    return await redemptionSessionRepository.getActiveCustomerSessions(customerAddress);
  }

  /**
   * Get a specific session by ID
   */
  async getSession(sessionId: string): Promise<RedemptionSession | null> {
    return await redemptionSessionRepository.getSession(sessionId);
  }


  /**
   * Clean up expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const expiredCount = await redemptionSessionRepository.expireOldSessions();
      if (expiredCount > 0) {
        logger.info(`Cleaned up ${expiredCount} expired redemption sessions`);
      }
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error);
    }
  }

  /**
   * Send notification to customer about pending redemption
   */
  private async notifyCustomer(session: RedemptionSession): Promise<void> {
    // TODO: Implement actual notification
    // - Push notification to mobile app
    // - Email notification
    // - SMS notification
    logger.info('Customer notification sent (mock)', {
      sessionId: session.sessionId,
      customerAddress: session.customerAddress,
      shopId: session.shopId,
      amount: session.maxAmount
    });
  }

  /**
   * Process an approved redemption immediately
   * This replicates the redemption logic from shop routes
   */
  private async processApprovedRedemption(session: RedemptionSession): Promise<void> {
    const { customerRepository, shopRepository, transactionRepository } = await import('../../../repositories');
    const { getTokenMinter } = await import('../../../contracts/TokenMinter');
    
    // Get shop data
    const shop = await shopRepository.getShop(session.shopId);
    if (!shop) {
      throw new Error('Shop not found');
    }

    // Attempt to burn tokens from customer's wallet (if blockchain enabled)
    let burnSuccessful = false;
    let transactionHash = '';
    
    try {
      const blockchainEnabled = process.env.ENABLE_BLOCKCHAIN_MINTING === 'true';
      if (blockchainEnabled) {
        const tokenMinter = getTokenMinter();
        const onChainBalance = await tokenMinter.getCustomerBalance(session.customerAddress);
        
        if (onChainBalance && onChainBalance >= session.maxAmount) {
          // Burn tokens from customer wallet
        const burnResult = await tokenMinter.burnTokensFromCustomer(
            session.customerAddress,
            session.maxAmount,
            '0x000000000000000000000000000000000000dEaD' // Burn address
          );
          
          if (burnResult.success) {
            burnSuccessful = true;
            transactionHash = burnResult.transactionHash || '';
            
            logger.info('Tokens burned successfully during auto-redemption', {
              customerAddress: session.customerAddress,
              amount: session.maxAmount,
              transactionHash
            });
          }
        } else {
          logger.info('Insufficient on-chain balance for burn, tracking off-chain only', {
            customerAddress: session.customerAddress,
            required: session.maxAmount,
            available: onChainBalance || 0
          });
        }
      }
    } catch (burnError) {
      logger.error('Token burn error during auto-redemption, continuing with off-chain tracking', burnError);
    }

    // Record the redemption transaction (whether burn succeeded or not)
    const transactionRecord = {
      id: `redeem_${Date.now()}`,
      type: 'redeem' as const,
      customerAddress: session.customerAddress.toLowerCase(),
      shopId: session.shopId,
      amount: session.maxAmount,
      reason: `Auto-redemption at ${shop.name}`,
      transactionHash,
      timestamp: new Date().toISOString(),
      status: 'confirmed' as const,
      metadata: {
        repairAmount: session.maxAmount,
        referralId: undefined,
        engagementType: 'redemption',
        redemptionLocation: shop.name,
        webhookId: `auto_redeem_${Date.now()}`,
        burnSuccessful,
        sessionId: session.sessionId,
        autoProcessed: true
      }
    };

    await transactionRepository.recordTransaction(transactionRecord);

    // Update shop statistics
    await shopRepository.updateShop(session.shopId, {
      totalRedemptions: shop.totalRedemptions + session.maxAmount,
      lastActivity: new Date().toISOString()
    });

    // Customer balance calculation is handled via transactions table
    // No need to update customer record directly

    logger.info('Auto-redemption processed successfully', {
      sessionId: session.sessionId,
      customerAddress: session.customerAddress,
      shopId: session.shopId,
      amount: session.maxAmount,
      burnSuccessful,
      transactionHash
    });
  }
}

// Singleton instance
export const redemptionSessionService = new RedemptionSessionService();