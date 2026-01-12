// backend/src/domains/token/services/RedemptionSessionService.ts
import crypto from 'crypto';
import { hashMessage, keccak256 } from 'thirdweb/utils';
import { getAddress } from 'thirdweb';
import { recoverMessageAddress } from 'viem';
import { logger } from '../../../utils/logger';
import { customerRepository, shopRepository, redemptionSessionRepository } from '../../../repositories';
import { eventBus } from '../../../events/EventBus';

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
    // Clean up expired sessions every minute (skip if connection tests disabled)
    if (process.env.SKIP_DB_CONNECTION_TESTS !== 'true') {
      setInterval(() => this.cleanupExpiredSessions(), 60 * 1000);
    }
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

    if (!customer.isActive) {
      throw new Error('Cannot create redemption session for suspended customers');
    }

    // Validate customer has sufficient RCN balance
    const customerBalance = await customerRepository.getCustomerBalance(customerAddress);
    if (!customerBalance || customerBalance.totalBalance < amount) {
      const currentBalance = customerBalance?.totalBalance || 0;
      throw new Error(`Insufficient balance. Customer has ${currentBalance.toFixed(2)} RCN, but ${amount} RCN requested for redemption`);
    }

    // Validate shop exists and is active
    const shop = await shopRepository.getShop(shopId);
    if (!shop || !shop.active || !shop.verified) {
      throw new Error('Shop not found or not active');
    }

    // Validate shop has sufficient operational RCN balance to process this redemption
    const shopBalance = shop.purchasedRcnBalance || 0;
    if (shopBalance < amount) {
      throw new Error(`Shop has insufficient RCN balance to process this redemption. Shop available: ${shopBalance} RCN, requested: ${amount} RCN`);
    }

    // Validate cross-shop redemption limit (20% at non-home shops)
    const { verificationService } = await import('./VerificationService');
    const verification = await verificationService.verifyRedemption(customerAddress, shopId, amount);
    if (!verification.canRedeem) {
      throw new Error(verification.message);
    }

    // Check for existing pending sessions
    const existingSession = await redemptionSessionRepository.findPendingSessionForCustomer(customerAddress, shopId);
    if (existingSession) {
      throw new Error('A pending redemption session already exists');
    }

    // Rate limiting: Prevent DoS by limiting session creation frequency
    const RATE_LIMIT_WINDOW_MINUTES = 5;
    const MAX_SESSIONS_PER_WINDOW = 5;

    const recentSessionCount = await redemptionSessionRepository.countRecentSessionsByShopForCustomer(
      shopId,
      customerAddress,
      RATE_LIMIT_WINDOW_MINUTES
    );

    if (recentSessionCount >= MAX_SESSIONS_PER_WINDOW) {
      logger.warn('Rate limit exceeded for session creation', {
        customerAddress,
        shopId,
        recentSessionCount,
        limit: MAX_SESSIONS_PER_WINDOW,
        windowMinutes: RATE_LIMIT_WINDOW_MINUTES
      });
      throw new Error(`Rate limit exceeded. Maximum ${MAX_SESSIONS_PER_WINDOW} sessions per ${RATE_LIMIT_WINDOW_MINUTES} minutes.`);
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

    // Emit event for notification system
    try {
      await eventBus.publish({
        type: 'token:redemption_approval_requested',
        aggregateId: sessionId,
        data: {
          shopAddress: shop.walletAddress,
          customerAddress,
          shopName: shop.name,
          amount,
          redemptionSessionId: sessionId
        },
        timestamp: new Date(),
        source: 'RedemptionSessionService',
        version: 1
      });
    } catch (eventError) {
      logger.error('Failed to emit redemption_approval_requested event:', eventError);
    }

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

    // Verify customer signature for security
    const isValidSignature = await this.verifySignature(session, signature);
    if (!isValidSignature) {
      logger.error('Signature verification failed during approval', {
        sessionId,
        customerAddress: session.customerAddress,
        shopId: session.shopId
      });
      throw new Error('Invalid customer signature. Please ensure you are signing with the correct wallet.');
    }

    logger.info('Signature verification successful', {
      sessionId,
      customerAddress: session.customerAddress
    });

    // Approve session (but don't process redemption yet - let shop handle that)
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

    logger.info('Redemption session approved - waiting for shop to process', {
      sessionId,
      customerAddress,
      shopId: session.shopId,
      amount: session.maxAmount,
      hasTransferTx: !!transactionHash
    });

    // Emit event for notification system
    try {
      const customer = await customerRepository.getCustomer(customerAddress);
      const customerName = customer?.name || 'Customer';

      const shop = await shopRepository.getShop(session.shopId);

      await eventBus.publish({
        type: 'token:redemption_approved',
        aggregateId: sessionId,
        data: {
          customerAddress,
          shopAddress: shop?.walletAddress || session.shopId,
          customerName,
          amount: session.maxAmount,
          redemptionSessionId: sessionId
        },
        timestamp: new Date(),
        source: 'RedemptionSessionService',
        version: 1
      });
    } catch (eventError) {
      logger.error('Failed to emit redemption_approved event:', eventError);
    }

    return session;
  }

  /**
   * Reject a redemption session (customer)
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

    // Create a transaction record for customer visibility (amount = 0 since no balance change)
    const { transactionRepository, shopRepository } = await import('../../../repositories');
    
    // Get shop details for the transaction
    const shop = await shopRepository.getShop(session.shopId);
    
    const rejectionRecord = {
      id: `rejected_${Date.now()}`,
      type: 'rejected_redemption' as const,
      customerAddress: customerAddress.toLowerCase(),
      shopId: session.shopId,
      amount: 0, // No balance change for rejections
      reason: `Rejected redemption request from ${shop?.name || session.shopId}`,
      transactionHash: '',
      timestamp: new Date().toISOString(),
      status: 'confirmed' as const,
      metadata: {
        originalRequestAmount: session.maxAmount,
        requestedAt: session.createdAt.toISOString(),
        rejectedAt: new Date().toISOString(),
        rejectedByCustomer: true,
        sessionId: sessionId,
        engagementType: 'redemption_rejection',
        redemptionLocation: shop?.name || session.shopId,
        webhookId: `reject_${Date.now()}`
      }
    };

    await transactionRepository.recordTransaction(rejectionRecord);

    logger.info('Redemption session rejected and recorded', {
      sessionId,
      customerAddress,
      shopId: session.shopId,
      requestedAmount: session.maxAmount
    });

    // Emit event for notification system
    try {
      const customer = await customerRepository.getCustomer(customerAddress);
      const customerName = customer?.name || 'Customer';

      await eventBus.publish({
        type: 'token:redemption_rejected',
        aggregateId: sessionId,
        data: {
          customerAddress,
          shopAddress: shop?.walletAddress || session.shopId,
          customerName,
          amount: session.maxAmount,
          redemptionSessionId: sessionId
        },
        timestamp: new Date(),
        source: 'RedemptionSessionService',
        version: 1
      });
    } catch (eventError) {
      logger.error('Failed to emit redemption_rejected event:', eventError);
    }
  }

  /**
   * Cancel a redemption session (shop)
   */
  async cancelSession(sessionId: string, shopId: string): Promise<void> {
    const session = await redemptionSessionRepository.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.shopId !== shopId) {
      throw new Error('Session does not belong to this shop');
    }

    if (session.status !== 'pending') {
      throw new Error(`Session is ${session.status}, cannot cancel`);
    }

    // Update session status to rejected with metadata indicating shop cancellation
    await redemptionSessionRepository.updateSessionStatus(sessionId, 'rejected');
    
    // Add metadata to distinguish shop cancellation from customer rejection
    const updatedMetadata = {
      ...session.metadata,
      cancelledByShop: true,
      cancelledAt: new Date().toISOString()
    };
    
    // Store the metadata (assuming you have this method - if not, we'll handle it differently)
    try {
      await redemptionSessionRepository.updateSessionMetadata(sessionId, updatedMetadata);
    } catch (error) {
      // If metadata update fails, still log the cancellation type
      logger.info('Could not update session metadata, but session was cancelled', { sessionId });
    }

    // Create a transaction record for customer visibility (amount = 0 since no balance change)
    const { transactionRepository, shopRepository } = await import('../../../repositories');
    
    // Get shop details for the transaction
    const shop = await shopRepository.getShop(session.shopId);
    
    const cancellationRecord = {
      id: `cancelled_${Date.now()}`,
      type: 'cancelled_redemption' as const,
      customerAddress: session.customerAddress.toLowerCase(),
      shopId: session.shopId,
      amount: 0, // No balance change for cancellations
      reason: `${shop?.name || session.shopId} cancelled redemption request`,
      transactionHash: '',
      timestamp: new Date().toISOString(),
      status: 'confirmed' as const,
      metadata: {
        originalRequestAmount: session.maxAmount,
        requestedAt: session.createdAt.toISOString(),
        cancelledAt: new Date().toISOString(),
        cancelledByShop: true,
        sessionId: sessionId,
        engagementType: 'redemption_cancellation',
        redemptionLocation: shop?.name || session.shopId,
        webhookId: `cancel_${Date.now()}`
      }
    };

    await transactionRepository.recordTransaction(cancellationRecord);

    logger.info('Redemption session cancelled by shop and recorded', {
      sessionId,
      shopId,
      customerAddress: session.customerAddress,
      requestedAmount: session.maxAmount
    });

    // Emit event for notification system
    try {
      await eventBus.publish({
        type: 'token:redemption_cancelled',
        aggregateId: sessionId,
        data: {
          shopAddress: shop?.walletAddress || shopId,
          customerAddress: session.customerAddress,
          shopName: shop?.name || shopId,
          amount: session.maxAmount,
          redemptionSessionId: sessionId
        },
        timestamp: new Date(),
        source: 'RedemptionSessionService',
        version: 1
      });
    } catch (eventError) {
      logger.error('Failed to emit redemption_cancelled event:', eventError);
    }
  }

  /**
   * Validate a session without consuming it (for atomic transaction support)
   * Returns the session if valid, throws error if invalid
   */
  async validateSessionOnly(sessionId: string, shopId: string, amount: number): Promise<RedemptionSession> {
    logger.info('Validating session (without consuming)', {
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

    logger.info('Session validated successfully (not consumed yet)', {
      sessionId,
      shopId,
      amount,
      customerAddress: session.customerAddress
    });

    return session;
  }

  /**
   * Validate and consume a session for redemption
   * Uses atomic database operation to prevent TOCTOU race conditions
   * The expiry check is performed atomically with the consumption in a single UPDATE query
   */
  async validateAndConsumeSession(sessionId: string, shopId: string, amount: number): Promise<RedemptionSession> {
    logger.info('Attempting to validate and consume session atomically', {
      sessionId,
      shopId,
      amount
    });

    // Try atomic consumption first - this validates AND consumes in a single operation
    // Prevents TOCTOU race condition where session could expire between check and consumption
    const consumedSession = await redemptionSessionRepository.atomicConsumeSession(sessionId, shopId, amount);

    if (consumedSession) {
      // Success - session was atomically validated and consumed
      logger.info('Redemption session consumed successfully (atomic)', {
        sessionId,
        shopId,
        amount,
        customerAddress: consumedSession.customerAddress
      });

      return consumedSession;
    }

    // Atomic consumption failed - fetch session to determine specific error
    const session = await redemptionSessionRepository.getSession(sessionId);

    if (!session) {
      logger.error('Session not found during validation', { sessionId });
      throw new Error('Session not found');
    }

    logger.info('Session found but atomic consumption failed, determining reason', {
      sessionId: session.sessionId,
      status: session.status,
      usedAt: session.usedAt,
      expiresAt: session.expiresAt,
      shopId: session.shopId,
      customerAddress: session.customerAddress
    });

    // Determine specific error reason
    if (session.shopId !== shopId) {
      logger.error('Shop mismatch', { sessionShop: session.shopId, requestedShop: shopId });
      throw new Error('Session is for a different shop');
    }

    if (session.status !== 'approved') {
      logger.error('Session status invalid', {
        currentStatus: session.status,
        expectedStatus: 'approved',
        sessionId
      });
      throw new Error(`Session is ${session.status}, not approved`);
    }

    if (session.usedAt) {
      logger.error('Session already used', {
        sessionId,
        usedAt: session.usedAt
      });
      throw new Error('Session has already been used');
    }

    if (session.expiresAt < new Date()) {
      logger.error('Session has expired', {
        sessionId,
        expiresAt: session.expiresAt,
        now: new Date()
      });
      throw new Error('Session has expired');
    }

    if (amount > session.maxAmount) {
      logger.error('Amount exceeds session limit', {
        requestedAmount: amount,
        maxAmount: session.maxAmount,
        sessionId
      });
      throw new Error(`Requested amount ${amount} exceeds session limit ${session.maxAmount}`);
    }

    // If we get here, there may have been a race condition or transient error
    logger.error('Session validation failed for unknown reason', {
      sessionId,
      shopId,
      amount
    });
    throw new Error('Session validation failed');
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
    try {
      const { NotificationService } = await import('../../notification/services/NotificationService');
      const notificationService = new NotificationService();
      const shop = await shopRepository.getShop(session.shopId);

      if (!shop) {
        logger.warn('Cannot send notification: shop not found', {
          sessionId: session.sessionId,
          shopId: session.shopId
        });
        return;
      }

      await notificationService.createNotification({
        senderAddress: shop.walletAddress || session.shopId,
        receiverAddress: session.customerAddress,
        notificationType: 'redemption_approval_request',
        message: `${shop.name} is requesting approval to redeem ${session.maxAmount} RCN from your wallet.`,
        metadata: {
          sessionId: session.sessionId,
          shopId: session.shopId,
          shopName: shop.name,
          amount: session.maxAmount,
          expiresAt: session.expiresAt.toISOString()
        }
      });

      logger.info('Customer notification sent successfully', {
        sessionId: session.sessionId,
        customerAddress: session.customerAddress,
        shopId: session.shopId,
        amount: session.maxAmount
      });
    } catch (error) {
      logger.error('Failed to send customer notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: session.sessionId,
        customerAddress: session.customerAddress
      });
      // Don't throw - notification failure shouldn't block session creation
    }
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

    // Determine redemption strategy: prioritize blockchain tokens over database balance
    let burnSuccessful = false;
    let transactionHash = '';
    let amountFromBlockchain = 0;
    let amountFromDatabase = 0;
    
    try {
      const blockchainEnabled = process.env.ENABLE_BLOCKCHAIN_MINTING === 'true';
      if (blockchainEnabled) {
        const tokenMinter = getTokenMinter();
        const onChainBalance = await tokenMinter.getCustomerBalance(session.customerAddress);
        
        if (onChainBalance && onChainBalance > 0) {
          // Calculate how much to burn from blockchain vs database
          amountFromBlockchain = Math.min(onChainBalance, session.maxAmount);
          amountFromDatabase = session.maxAmount - amountFromBlockchain;
          
          // Burn available blockchain tokens
          const burnResult = await tokenMinter.burnTokensFromCustomer(
            session.customerAddress,
            amountFromBlockchain,
            '0x000000000000000000000000000000000000dEaD' // Burn address
          );
          
          if (burnResult.success) {
            burnSuccessful = true;
            transactionHash = burnResult.transactionHash || '';
            
            logger.info('Tokens burned from blockchain during redemption', {
              customerAddress: session.customerAddress,
              blockchainAmount: amountFromBlockchain,
              databaseAmount: amountFromDatabase,
              totalAmount: session.maxAmount,
              transactionHash
            });
          } else {
            // Burn failed, deduct full amount from database
            amountFromBlockchain = 0;
            amountFromDatabase = session.maxAmount;
            logger.warn('Blockchain burn failed, falling back to database deduction', {
              customerAddress: session.customerAddress,
              amount: session.maxAmount
            });
          }
        } else {
          // No blockchain tokens, deduct from database
          amountFromDatabase = session.maxAmount;
          logger.info('No blockchain tokens available, using database balance', {
            customerAddress: session.customerAddress,
            amount: session.maxAmount,
            onChainBalance: onChainBalance || 0
          });
        }
      } else {
        // Blockchain disabled, use database only
        amountFromDatabase = session.maxAmount;
      }
    } catch (burnError) {
      logger.error('Token burn error during auto-redemption, using database balance', burnError);
      amountFromBlockchain = 0;
      amountFromDatabase = session.maxAmount;
    }

    // Only record database transaction if we're deducting from database balance
    if (amountFromDatabase > 0) {
      const transactionRecord = {
        id: `redeem_${Date.now()}`,
        type: 'redeem' as const,
        customerAddress: session.customerAddress.toLowerCase(),
        shopId: session.shopId,
        amount: amountFromDatabase, // Only deduct the database portion
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
          autoProcessed: true,
          amountFromBlockchain,
          amountFromDatabase,
          redemptionStrategy: amountFromBlockchain > 0 ? 'hybrid' : 'database_only'
        }
      };

      await transactionRepository.recordTransaction(transactionRecord);
    } else {
      // Pure blockchain redemption - no database transaction needed
      logger.info('Pure blockchain redemption completed, no database transaction recorded', {
        sessionId: session.sessionId,
        customerAddress: session.customerAddress,
        amount: session.maxAmount,
        transactionHash
      });
    }

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
      totalAmount: session.maxAmount,
      amountFromBlockchain,
      amountFromDatabase,
      burnSuccessful,
      transactionHash,
      strategy: amountFromBlockchain > 0 ? (amountFromDatabase > 0 ? 'hybrid' : 'blockchain_only') : 'database_only'
    });
  }

  /**
   * Verify customer signature for redemption session approval
   * Uses ECDSA recovery to cryptographically verify the signature against the customer's wallet address
   */
  private async verifySignature(session: RedemptionSession, signatureHex: string): Promise<boolean> {
    try {
      // Validate signature format first
      if (!signatureHex || signatureHex.length < 130) {
        logger.error('Invalid signature format - too short', {
          signatureLength: signatureHex?.length || 0,
          sessionId: session.sessionId
        });
        return false;
      }

      // Ensure proper 0x prefix
      const signature = signatureHex.startsWith('0x') ? signatureHex : '0x' + signatureHex;
      const sigNoPrefix = signature.slice(2);

      // Validate signature length (130 chars = 65 bytes for ECDSA signature)
      if (sigNoPrefix.length !== 130) {
        logger.error('Invalid signature length', {
          expectedLength: 130,
          actualLength: sigNoPrefix.length,
          sessionId: session.sessionId
        });
        return false;
      }

      // Validate signature is valid hex
      if (!/^[0-9a-fA-F]+$/.test(sigNoPrefix)) {
        logger.error('Invalid signature format - not valid hex', {
          sessionId: session.sessionId
        });
        return false;
      }

      // Create the standardized message that should have been signed
      const message = this.createSignatureMessage(session);

      // Recover the address that signed this message using ECDSA recovery
      const recoveredAddress = await recoverMessageAddress({
        message,
        signature: signature as `0x${string}`
      });

      // Verify recovered address matches the customer's address
      const isValid = recoveredAddress.toLowerCase() === session.customerAddress.toLowerCase();

      if (!isValid) {
        logger.error('Signature verification failed - address mismatch', {
          sessionId: session.sessionId,
          expectedAddress: session.customerAddress.toLowerCase(),
          recoveredAddress: recoveredAddress.toLowerCase()
        });
        return false;
      }

      logger.info('Signature verification successful', {
        sessionId: session.sessionId,
        customerAddress: session.customerAddress.toLowerCase(),
        recoveredAddress: recoveredAddress.toLowerCase(),
        messageHash: hashMessage(message).slice(0, 10) + '...'
      });

      return true;

    } catch (error) {
      logger.error('Signature verification failed with error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: session.sessionId,
        customerAddress: session.customerAddress
      });
      return false;
    }
  }

  /**
   * Create the standardized message for signature verification
   * This message format should match what the frontend signs
   */
  private createSignatureMessage(session: RedemptionSession): string {
    return `RepairCoin Redemption Request

Session ID: ${session.sessionId}
Customer: ${session.customerAddress}
Shop: ${session.shopId}
Amount: ${session.maxAmount} RCN
Expires: ${new Date(session.expiresAt).toISOString()}

By signing this message, I approve the redemption of ${session.maxAmount} RCN tokens at the specified shop.`;
  }
}

// Singleton instance
export const redemptionSessionService = new RedemptionSessionService();