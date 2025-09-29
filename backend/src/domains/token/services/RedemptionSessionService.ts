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
  qrCode?: string;
  signature?: string;
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
  private readonly QR_EXPIRY = 60 * 1000; // 1 minute for QR codes

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
   * Generate QR code for customer-initiated redemption
   */
  async generateRedemptionQR(customerAddress: string, shopId: string, amount: number): Promise<string> {
    // Validate customer
    const customer = await customerRepository.getCustomer(customerAddress);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Create QR data with short expiry
    const qrData = {
      type: 'repaircoin_redemption_request',
      sessionId: crypto.randomUUID(),
      customerAddress: customerAddress.toLowerCase(),
      shopId,
      amount,
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.QR_EXPIRY).toISOString(),
      nonce: crypto.randomBytes(16).toString('hex')
    };

    // Create a pre-approved session for QR redemptions
    const session: RedemptionSession = {
      sessionId: qrData.sessionId,
      customerAddress: customerAddress.toLowerCase(),
      shopId,
      maxAmount: amount,
      status: 'approved', // Pre-approved for QR
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.QR_EXPIRY),
      approvedAt: new Date(),
      qrCode: JSON.stringify(qrData)
    } as any; // Cast to include metadata field

    // Store session in database
    await redemptionSessionRepository.createSession(session);

    logger.info('QR redemption session created', {
      sessionId: session.sessionId,
      customerAddress,
      shopId,
      amount
    });

    return JSON.stringify(qrData);
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

    // TODO: Verify signature
    // const isValidSignature = await this.verifySignature(session, signature);
    // if (!isValidSignature) {
    //   throw new Error('Invalid signature');
    // }

    // Approve session
    // Update session in database
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

    logger.info('Redemption session approved', {
      sessionId,
      customerAddress,
      shopId: session.shopId,
      hasTransferTx: !!transactionHash
    });

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
    const session = await redemptionSessionRepository.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Verify shop matches
    if (session.shopId !== shopId) {
      throw new Error('Session is for a different shop');
    }

    // Check status
    if (session.status !== 'approved') {
      throw new Error(`Session is ${session.status}, not approved`);
    }

    // Check if already used
    if (session.usedAt) {
      throw new Error('Session has already been used');
    }

    // Check expiry
    if (session.expiresAt < new Date()) {
      session.status = 'expired';
      throw new Error('Session has expired');
    }

    // Check amount
    if (amount > session.maxAmount) {
      throw new Error(`Requested amount ${amount} exceeds session limit ${session.maxAmount}`);
    }

    // Mark as used in database
    await redemptionSessionRepository.updateSessionStatus(sessionId, 'used');
    
    // Update local object
    session.status = 'used';
    session.usedAt = new Date();

    logger.info('Redemption session consumed', {
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
   * Validate QR code data
   */
  async validateQRCode(qrData: string): Promise<RedemptionSession> {
    try {
      const data = JSON.parse(qrData);
      
      if (data.type !== 'repaircoin_redemption_request') {
        throw new Error('Invalid QR code type');
      }

      const session = await redemptionSessionRepository.getSessionByQRCode(qrData);
      if (!session) {
        throw new Error('Session not found or QR code invalid');
      }

      if (new Date(data.expiresAt) < new Date()) {
        throw new Error('QR code has expired');
      }

      return session;
    } catch (error) {
      logger.error('QR validation error:', error);
      throw new Error('Invalid QR code');
    }
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
}

// Singleton instance
export const redemptionSessionService = new RedemptionSessionService();