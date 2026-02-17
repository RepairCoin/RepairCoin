import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

export interface EmailConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  from?: string;
}

export interface PaymentReminderData {
  shopEmail: string;
  shopName: string;
  amountDue: number;
  dueDate: Date;
  daysUntilDue: number;
}

export interface PaymentOverdueData {
  shopEmail: string;
  shopName: string;
  amountDue: number;
  daysOverdue: number;
  gracePeriodRemaining: number;
  suspensionDate: Date;
}

export interface SubscriptionDefaultedData {
  shopEmail: string;
  shopName: string;
  amountDue: number;
  daysPastDue: number;
}

export interface SubscriptionReactivatedData {
  shopEmail: string;
  shopName: string;
  monthlyAmount: number;
  nextPaymentDate: Date;
}

export interface SubscriptionCancelledByAdminData {
  shopEmail: string;
  shopName: string;
  reason?: string;
  effectiveDate: Date;
}

export interface BookingCancelledByShopData {
  customerEmail: string;
  customerName: string;
  shopName: string;
  serviceName: string;
  bookingDate?: string;
  bookingTime?: string;
  cancellationReason?: string;
  rcnRefunded: number;
  stripeRefunded: number;
}

export interface BookingCancelledByCustomerData {
  customerEmail: string;
  customerName: string;
  shopName: string;
  serviceName: string;
  bookingDate?: string;
  bookingTime?: string;
  cancellationReason?: string;
  rcnRefunded: number;
  stripeRefunded: number;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig;
  private isConfigured: boolean = false;

  constructor(config?: EmailConfig) {
    this.config = config || this.loadConfigFromEnv();
    this.initializeTransporter();
  }

  private loadConfigFromEnv(): EmailConfig {
    return {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: process.env.EMAIL_USER ? {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS || ''
      } : undefined,
      from: process.env.EMAIL_FROM || 'RepairCoin <noreply@repaircoin.com>'
    };
  }

  private initializeTransporter() {
    logger.debug('Initializing email service with config:', {
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      hasAuth: !!this.config.auth?.user,
      from: this.config.from,
    });

    if (!this.config.auth?.user) {
      logger.warn('Email service not configured - emails will be logged only. Set EMAIL_USER env variable.');
      this.isConfigured = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth
      });

      this.isConfigured = true;
      logger.info('Email service initialized successfully', {
        host: this.config.host,
        port: this.config.port,
        user: this.config.auth.user,
      });
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Send payment reminder email
   */
  async sendPaymentReminder(data: PaymentReminderData): Promise<boolean> {
    const subject = `Payment Reminder: $${data.amountDue} due in ${data.daysUntilDue} days`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Payment Reminder</h2>
        
        <p>Dear ${data.shopName},</p>
        
        <p>This is a friendly reminder that your RepairCoin monthly subscription payment is coming up:</p>
        
        <div style="background-color: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Amount Due:</strong> $${data.amountDue}</p>
          <p style="margin: 5px 0;"><strong>Due Date:</strong> ${data.dueDate.toLocaleDateString()}</p>
          <p style="margin: 5px 0;"><strong>Days Until Due:</strong> ${data.daysUntilDue} days</p>
        </div>
        
        <p>Please ensure your payment method is up to date to avoid any interruption in service.</p>
        
        <p>If you have any questions or need to update your payment information, please contact our support team.</p>
        
        <hr style="border: 1px solid #ddd; margin: 30px 0;">
        
        <p style="color: #666; font-size: 12px;">
          This is an automated message from RepairCoin. Please do not reply to this email.
        </p>
      </div>
    `;

    return this.sendEmail(data.shopEmail, subject, html);
  }

  /**
   * Send payment overdue notice
   */
  async sendPaymentOverdue(data: PaymentOverdueData): Promise<boolean> {
    const subject = `⚠️ Payment Overdue: Action Required`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">Payment Overdue Notice</h2>
        
        <p>Dear ${data.shopName},</p>
        
        <p style="color: #d32f2f;"><strong>Your RepairCoin subscription payment is overdue.</strong></p>
        
        <div style="background-color: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d32f2f;">
          <p style="margin: 5px 0;"><strong>Amount Due:</strong> $${data.amountDue}</p>
          <p style="margin: 5px 0;"><strong>Days Overdue:</strong> ${data.daysOverdue} days</p>
          <p style="margin: 5px 0;"><strong>Grace Period Remaining:</strong> ${data.gracePeriodRemaining} days</p>
          <p style="margin: 5px 0;"><strong>Service Suspension Date:</strong> ${data.suspensionDate.toLocaleDateString()}</p>
        </div>
        
        <p><strong>Important:</strong> If payment is not received within the grace period, your shop will lose operational status and you will not be able to:</p>
        
        <ul>
          <li>Issue RCN rewards to customers</li>
          <li>Process RCN redemptions</li>
          <li>Purchase additional RCN tokens</li>
        </ul>
        
        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>To avoid service interruption, please make your payment immediately.</strong></p>
        </div>
        
        <p>If you've already made this payment, please disregard this notice. If you're experiencing difficulties, please contact our support team immediately.</p>
        
        <hr style="border: 1px solid #ddd; margin: 30px 0;">
        
        <p style="color: #666; font-size: 12px;">
          This is an automated message from RepairCoin. For support, please contact support@repaircoin.com
        </p>
      </div>
    `;

    return this.sendEmail(data.shopEmail, subject, html);
  }

  /**
   * Send subscription defaulted notice
   */
  async sendSubscriptionDefaulted(data: SubscriptionDefaultedData): Promise<boolean> {
    const subject = '❌ Subscription Cancelled Due to Non-Payment';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">Subscription Cancelled</h2>
        
        <p>Dear ${data.shopName},</p>
        
        <p>We regret to inform you that your RepairCoin subscription has been cancelled due to non-payment.</p>
        
        <div style="background-color: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Outstanding Amount:</strong> $${data.amountDue}</p>
          <p style="margin: 5px 0;"><strong>Days Past Due:</strong> ${data.daysPastDue} days</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> Subscription Cancelled</p>
        </div>
        
        <p><strong>As a result of this cancellation:</strong></p>
        
        <ul>
          <li>Your shop has lost operational status</li>
          <li>You cannot issue RCN rewards to customers</li>
          <li>You cannot process RCN redemptions</li>
          <li>You cannot purchase additional RCN tokens</li>
        </ul>
        
        <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Good news:</strong> You can reactivate your subscription at any time by visiting your shop dashboard and subscribing again.</p>
        </div>
        
        <p>We value your partnership and hope to see you back soon. If you have any questions or concerns, please don't hesitate to contact our support team.</p>
        
        <hr style="border: 1px solid #ddd; margin: 30px 0;">
        
        <p style="color: #666; font-size: 12px;">
          This is an automated message from RepairCoin. For support, please contact support@repaircoin.com
        </p>
      </div>
    `;

    return this.sendEmail(data.shopEmail, subject, html);
  }

  /**
   * Send subscription reactivated notice
   */
  async sendSubscriptionReactivated(data: SubscriptionReactivatedData): Promise<boolean> {
    const subject = '✅ Welcome Back! Your Subscription is Active';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #388e3c;">Subscription Reactivated!</h2>
        
        <p>Dear ${data.shopName},</p>
        
        <p>Great news! Your RepairCoin subscription has been successfully reactivated.</p>
        
        <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Monthly Amount:</strong> $${data.monthlyAmount}</p>
          <p style="margin: 5px 0;"><strong>Next Payment Date:</strong> ${data.nextPaymentDate.toLocaleDateString()}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> Active ✅</p>
        </div>
        
        <p><strong>You can now:</strong></p>
        
        <ul>
          <li>Issue RCN rewards to customers</li>
          <li>Process RCN redemptions</li>
          <li>Purchase RCN tokens at $0.10 each</li>
          <li>Access all shop dashboard features</li>
        </ul>
        
        <p>Thank you for continuing your partnership with RepairCoin. We're excited to help you grow your business!</p>
        
        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Tip:</strong> Set up automatic payments to ensure uninterrupted service.</p>
        </div>
        
        <hr style="border: 1px solid #ddd; margin: 30px 0;">
        
        <p style="color: #666; font-size: 12px;">
          This is an automated message from RepairCoin. For support, please contact support@repaircoin.com
        </p>
      </div>
    `;

    return this.sendEmail(data.shopEmail, subject, html);
  }

  /**
   * Send subscription cancelled by admin notice
   */
  async sendSubscriptionCancelledByAdmin(data: SubscriptionCancelledByAdminData): Promise<boolean> {
    const subject = '⚠️ Your RepairCoin Subscription Has Been Cancelled';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f57c00;">Subscription Cancelled</h2>

        <p>Dear ${data.shopName},</p>

        <p>Your RepairCoin subscription has been cancelled by an administrator.</p>

        <div style="background-color: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f57c00;">
          <p style="margin: 5px 0;"><strong>Status:</strong> Cancelled</p>
          <p style="margin: 5px 0;"><strong>Reason:</strong> ${data.reason || 'Not specified'}</p>
          <p style="margin: 5px 0;"><strong>Full Access Until:</strong> ${data.effectiveDate.toLocaleDateString()}</p>
        </div>

        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Good news:</strong> You retain <strong>full platform access</strong> until ${data.effectiveDate.toLocaleDateString()}. During this period, you can continue to issue rewards, process redemptions, and manage your services as normal.</p>
        </div>

        <p><strong>After ${data.effectiveDate.toLocaleDateString()}, you will no longer be able to:</strong></p>

        <ul>
          <li>Issue RCN rewards to customers</li>
          <li>Process RCN redemptions</li>
          <li>Manage services in the marketplace</li>
          <li>Look up customer information</li>
          <li>Purchase additional RCN tokens</li>
        </ul>

        <p style="color: #666;"><em>Note: You will still be able to view your purchase history and limited analytics.</em></p>

        <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Want to continue using RepairCoin?</strong></p>
          <p style="margin: 0;">You can resubscribe at any time by visiting your shop dashboard. Alternatively, holding 10,000+ RCG tokens grants you full platform access without a monthly subscription.</p>
        </div>

        <p>If you believe this cancellation was made in error or have questions, please contact our support team immediately.</p>

        <hr style="border: 1px solid #ddd; margin: 30px 0;">

        <p style="color: #666; font-size: 12px;">
          This is an automated message from RepairCoin. For support, please contact support@repaircoin.com
        </p>
      </div>
    `;

    return this.sendEmail(data.shopEmail, subject, html);
  }

  /**
   * Send subscription paused by admin notice
   */
  async sendSubscriptionPausedByAdmin(shopEmail: string, shopName: string, reason?: string): Promise<boolean> {
    const subject = '⏸️ Your RepairCoin Subscription Has Been Paused';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">Subscription Paused</h2>

        <p>Dear ${shopName},</p>

        <p>Your RepairCoin subscription has been temporarily paused by an administrator.</p>

        <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 5px 0;"><strong>Status:</strong> Paused</p>
          <p style="margin: 5px 0;"><strong>Reason:</strong> ${reason || 'Not specified'}</p>
        </div>

        <p><strong>While your subscription is paused, you will not be able to:</strong></p>

        <ul>
          <li>Issue RCN rewards to customers</li>
          <li>Process RCN redemptions</li>
          <li>Manage services in the marketplace</li>
          <li>Look up customer information</li>
          <li>Purchase additional RCN tokens</li>
        </ul>

        <p style="color: #666;"><em>Note: You will still be able to view your purchase history and limited analytics.</em></p>

        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;">Your subscription will remain paused until an administrator resumes it. If you have questions or believe this was done in error, please contact our support team.</p>
        </div>

        <hr style="border: 1px solid #ddd; margin: 30px 0;">

        <p style="color: #666; font-size: 12px;">
          This is an automated message from RepairCoin. For support, please contact support@repaircoin.com
        </p>
      </div>
    `;

    return this.sendEmail(shopEmail, subject, html);
  }

  /**
   * Send subscription resumed by admin notice
   */
  async sendSubscriptionResumedByAdmin(shopEmail: string, shopName: string): Promise<boolean> {
    const subject = '▶️ Your RepairCoin Subscription Has Been Resumed';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Subscription Resumed</h2>

        <p>Dear ${shopName},</p>

        <p>Great news! Your RepairCoin subscription has been resumed by an administrator.</p>

        <div style="background-color: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <p style="margin: 5px 0;"><strong>Status:</strong> Active</p>
          <p style="margin: 0;"><strong>All platform features are now available.</strong></p>
        </div>

        <p><strong>You can now:</strong></p>

        <ul>
          <li>Issue RCN rewards to customers</li>
          <li>Process RCN redemptions</li>
          <li>Manage services in the marketplace</li>
          <li>Look up customer information</li>
          <li>Purchase RCN tokens at $0.10 each</li>
        </ul>

        <p>Thank you for your patience. If you have any questions, please don't hesitate to contact our support team.</p>

        <hr style="border: 1px solid #ddd; margin: 30px 0;">

        <p style="color: #666; font-size: 12px;">
          This is an automated message from RepairCoin. For support, please contact support@repaircoin.com
        </p>
      </div>
    `;

    return this.sendEmail(shopEmail, subject, html);
  }

  /**
   * Send subscription reactivated by admin notice (for cancelled subscriptions that are reactivated)
   */
  async sendSubscriptionReactivatedByAdmin(shopEmail: string, shopName: string): Promise<boolean> {
    const subject = '✅ Your RepairCoin Subscription Has Been Reactivated';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Subscription Reactivated!</h2>

        <p>Dear ${shopName},</p>

        <p>Great news! Your RepairCoin subscription has been reactivated by an administrator. Your scheduled cancellation has been reversed.</p>

        <div style="background-color: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <p style="margin: 5px 0;"><strong>Status:</strong> Active ✅</p>
          <p style="margin: 0;"><strong>All platform features are now fully available.</strong></p>
        </div>

        <p><strong>You can now continue to:</strong></p>

        <ul>
          <li>Issue RCN rewards to customers</li>
          <li>Process RCN redemptions</li>
          <li>Manage services in the marketplace</li>
          <li>Look up customer information</li>
          <li>Purchase RCN tokens at $0.10 each</li>
        </ul>

        <p>Your subscription will continue as normal with no interruption to your service.</p>

        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Tip:</strong> Ensure your payment method is up to date to avoid any future interruptions.</p>
        </div>

        <p>Thank you for being a valued RepairCoin partner. If you have any questions, please don't hesitate to contact our support team.</p>

        <hr style="border: 1px solid #ddd; margin: 30px 0;">

        <p style="color: #666; font-size: 12px;">
          This is an automated message from RepairCoin. For support, please contact support@repaircoin.com
        </p>
      </div>
    `;

    return this.sendEmail(shopEmail, subject, html);
  }

  /**
   * Send subscription cancelled by shop confirmation email
   */
  async sendSubscriptionCancelledByShop(
    shopEmail: string,
    shopName: string,
    reason: string | undefined,
    effectiveDate: Date
  ): Promise<boolean> {
    const subject = '📋 Subscription Cancellation Confirmed';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6b7280;">Subscription Cancellation Confirmed</h2>

        <p>Dear ${shopName},</p>

        <p>This email confirms that you have cancelled your RepairCoin subscription.</p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6b7280;">
          <p style="margin: 5px 0;"><strong>Status:</strong> Cancellation Scheduled</p>
          ${reason ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${reason}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Full Access Until:</strong> ${effectiveDate.toLocaleDateString()}</p>
        </div>

        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Good news:</strong> You retain <strong>full platform access</strong> until ${effectiveDate.toLocaleDateString()}. During this period, you can continue to issue rewards, process redemptions, and manage your services as normal.</p>
        </div>

        <p><strong>After ${effectiveDate.toLocaleDateString()}, you will no longer be able to:</strong></p>

        <ul>
          <li>Issue RCN rewards to customers</li>
          <li>Process RCN redemptions</li>
          <li>Manage services in the marketplace</li>
          <li>Look up customer information</li>
          <li>Purchase additional RCN tokens</li>
        </ul>

        <p style="color: #666;"><em>Note: You will still be able to view your purchase history and limited analytics.</em></p>

        <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Changed your mind?</strong></p>
          <p style="margin: 0;">You can reactivate your subscription at any time before the cancellation date by visiting your shop dashboard. After cancellation, you can resubscribe to restore full access.</p>
        </div>

        <p>We're sorry to see you go. If there's anything we could have done better, please let us know by replying to this email.</p>

        <hr style="border: 1px solid #ddd; margin: 30px 0;">

        <p style="color: #666; font-size: 12px;">
          This is an automated message from RepairCoin. For support, please contact support@repaircoin.com
        </p>
      </div>
    `;

    return this.sendEmail(shopEmail, subject, html);
  }

  /**
   * Send shop suspended by admin notice
   */
  async sendShopSuspendedByAdmin(shopEmail: string, shopName: string, reason?: string): Promise<boolean> {
    const subject = '🚫 Your RepairCoin Shop Has Been Suspended';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Shop Suspended</h2>

        <p>Dear ${shopName},</p>

        <p>Your RepairCoin shop has been suspended by an administrator.</p>

        <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <p style="margin: 5px 0;"><strong>Status:</strong> Suspended</p>
          <p style="margin: 5px 0;"><strong>Reason:</strong> ${reason || 'Not specified'}</p>
        </div>

        <p><strong>While your shop is suspended, you will not be able to:</strong></p>

        <ul>
          <li>Issue RCN rewards to customers</li>
          <li>Process RCN redemptions</li>
          <li>Manage services in the marketplace</li>
          <li>Look up customer information</li>
          <li>Purchase additional RCN tokens</li>
        </ul>

        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Important:</strong> Your subscription billing will continue during the suspension period. If you believe this suspension was made in error, please contact our support team immediately to resolve the issue.</p>
        </div>

        <p style="color: #666;"><em>Note: You will still be able to view your purchase history and limited analytics.</em></p>

        <hr style="border: 1px solid #ddd; margin: 30px 0;">

        <p style="color: #666; font-size: 12px;">
          This is an automated message from RepairCoin. For support, please contact support@repaircoin.com
        </p>
      </div>
    `;

    return this.sendEmail(shopEmail, subject, html);
  }

  /**
   * Send shop unsuspended by admin notice
   */
  async sendShopUnsuspendedByAdmin(shopEmail: string, shopName: string): Promise<boolean> {
    const subject = '✅ Your RepairCoin Shop Has Been Unsuspended';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Shop Unsuspended</h2>

        <p>Dear ${shopName},</p>

        <p>Great news! Your RepairCoin shop has been unsuspended by an administrator.</p>

        <div style="background-color: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <p style="margin: 5px 0;"><strong>Status:</strong> Active</p>
          <p style="margin: 0;"><strong>All platform features are now available.</strong></p>
        </div>

        <p><strong>You can now:</strong></p>

        <ul>
          <li>Issue RCN rewards to customers</li>
          <li>Process RCN redemptions</li>
          <li>Manage services in the marketplace</li>
          <li>Look up customer information</li>
          <li>Purchase RCN tokens at $0.10 each</li>
        </ul>

        <p>Thank you for your patience. We apologize for any inconvenience caused during the suspension period.</p>

        <p>If you have any questions, please don't hesitate to contact our support team.</p>

        <hr style="border: 1px solid #ddd; margin: 30px 0;">

        <p style="color: #666; font-size: 12px;">
          This is an automated message from RepairCoin. For support, please contact support@repaircoin.com
        </p>
      </div>
    `;

    return this.sendEmail(shopEmail, subject, html);
  }

  /**
   * Send welcome email for new trial subscription
   */
  async sendTrialWelcome(shopEmail: string, shopName: string, trialDays: number): Promise<boolean> {
    const subject = '🎉 Welcome to RepairCoin - Your Free Trial Has Started!';
    
    const trialEndDate = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Welcome to RepairCoin!</h2>
        
        <p>Dear ${shopName},</p>
        
        <p>Congratulations! Your ${trialDays}-day free trial has been activated.</p>
        
        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Trial Period:</strong> ${trialDays} days</p>
          <p style="margin: 5px 0;"><strong>Trial Ends:</strong> ${trialEndDate.toLocaleDateString()}</p>
          <p style="margin: 5px 0;"><strong>Monthly Price After Trial:</strong> $500/month</p>
        </div>
        
        <p><strong>During your trial, you have full access to:</strong></p>
        
        <ul>
          <li>Issue RCN rewards to your customers</li>
          <li>Process RCN redemptions</li>
          <li>Purchase RCN tokens at $0.10 each</li>
          <li>Customer analytics and insights</li>
          <li>Cross-shop network benefits</li>
        </ul>
        
        <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>No credit card required during trial!</strong> You'll only be asked for payment information when you're ready to continue after your trial.</p>
        </div>
        
        <p>We're here to help you succeed. If you have any questions or need assistance, our support team is ready to help.</p>
        
        <hr style="border: 1px solid #ddd; margin: 30px 0;">
        
        <p style="color: #666; font-size: 12px;">
          This is an automated message from RepairCoin. For support, please contact support@repaircoin.com
        </p>
      </div>
    `;

    return this.sendEmail(shopEmail, subject, html);
  }

  /**
   * Send appointment confirmation for manual booking
   */
  async sendAppointmentConfirmation(
    customerEmail: string,
    customerName: string,
    shopName: string,
    serviceName: string,
    bookingDate: Date,
    bookingTime: string,
    paymentStatus: string
  ): Promise<boolean> {
    const subject = `Appointment Confirmed at ${shopName}`;

    const dateFormatted = bookingDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const paymentStatusText = paymentStatus === 'paid'
      ? 'Payment collected'
      : paymentStatus === 'pending'
      ? 'Payment pending'
      : 'Payment not yet collected';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #FFCC00; padding: 20px; text-align: center;">
          <h1 style="color: #000; margin: 0;">Appointment Confirmed</h1>
        </div>

        <div style="padding: 20px;">
          <p>Hi ${customerName || 'there'},</p>

          <p>Your appointment at <strong>${shopName}</strong> has been successfully booked!</p>

          <div style="background-color: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <p style="margin: 5px 0; color: #155724;"><strong>📅 Date & Time:</strong></p>
            <p style="margin: 5px 0; font-size: 18px; color: #155724;">
              <strong>${dateFormatted}</strong><br>
              <strong>${bookingTime}</strong>
            </p>
          </div>

          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Service:</strong> ${serviceName}</p>
            <p style="margin: 5px 0;"><strong>Shop:</strong> ${shopName}</p>
            <p style="margin: 5px 0;"><strong>Payment Status:</strong> ${paymentStatusText}</p>
          </div>

          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 5px 0; color: #856404;"><strong>⏰ Please arrive on time</strong></p>
            <p style="margin: 5px 0; color: #856404;">
              If you need to cancel or reschedule, please contact the shop as soon as possible.
            </p>
          </div>

          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            Thank you for booking with RepairCoin!<br>
            The RepairCoin Team
          </p>
        </div>

        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>This is an automated message from RepairCoin</p>
        </div>
      </div>
    `;

    return this.sendEmail(customerEmail, subject, html);
  }

  /**
   * Send appointment reschedule notification to customer
   */
  async sendAppointmentRescheduledByShop(data: {
    customerEmail: string;
    customerName: string;
    shopName: string;
    serviceName: string;
    originalDate: string;
    originalTime: string;
    newDate: string;
    newTime: string;
    reason?: string;
  }): Promise<boolean> {
    const subject = `Your appointment at ${data.shopName} has been rescheduled`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #FFCC00; padding: 20px; text-align: center;">
          <h1 style="color: #000; margin: 0;">Appointment Rescheduled</h1>
        </div>

        <div style="padding: 20px;">
          <p>Hi ${data.customerName || 'there'},</p>

          <p><strong>${data.shopName}</strong> has rescheduled your appointment:</p>

          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 5px 0; color: #856404;"><strong>Previous Time:</strong></p>
            <p style="margin: 5px 0; text-decoration: line-through; color: #6c757d;">
              ${data.originalDate} at ${data.originalTime}
            </p>
          </div>

          <div style="background-color: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <p style="margin: 5px 0; color: #155724;"><strong>New Time:</strong></p>
            <p style="margin: 5px 0; font-size: 18px; color: #155724;">
              <strong>${data.newDate} at ${data.newTime}</strong>
            </p>
          </div>

          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Service:</strong> ${data.serviceName}</p>
            <p style="margin: 5px 0;"><strong>Shop:</strong> ${data.shopName}</p>
            ${data.reason ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${data.reason}</p>` : ''}
          </div>

          <p>If this new time doesn't work for you, please contact the shop directly to discuss alternatives.</p>

          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            Thank you for your understanding!<br>
            The RepairCoin Team
          </p>
        </div>

        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>This is an automated message from RepairCoin</p>
        </div>
      </div>
    `;

    return this.sendEmail(data.customerEmail, subject, html);
  }

  /**
   * Send booking cancelled by shop notification to customer
   */
  async sendBookingCancelledByShop(data: BookingCancelledByShopData): Promise<boolean> {
    const subject = `Your booking at ${data.shopName} has been cancelled`;

    // Build refund details string
    const refundParts: string[] = [];
    if (data.rcnRefunded > 0) {
      refundParts.push(`${data.rcnRefunded} RCN tokens`);
    }
    if (data.stripeRefunded > 0) {
      refundParts.push(`$${data.stripeRefunded.toFixed(2)}`);
    }
    const refundText = refundParts.length > 0
      ? refundParts.join(' and ') + ' will be refunded to your account'
      : 'No refund was required for this booking';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #FFCC00; padding: 20px; text-align: center;">
          <h1 style="color: #000; margin: 0;">Booking Cancelled</h1>
        </div>

        <div style="padding: 20px;">
          <p>Hi ${data.customerName || 'there'},</p>

          <p>We're sorry to inform you that <strong>${data.shopName}</strong> has cancelled your booking.</p>

          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Service:</strong> ${data.serviceName}</p>
            ${data.bookingDate ? `<p style="margin: 5px 0;"><strong>Date:</strong> ${data.bookingDate}</p>` : ''}
            ${data.bookingTime ? `<p style="margin: 5px 0;"><strong>Time:</strong> ${data.bookingTime}</p>` : ''}
            ${data.cancellationReason ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${data.cancellationReason}</p>` : ''}
          </div>

          <div style="background-color: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <p style="margin: 0; color: #155724;"><strong>Refund Information:</strong></p>
            <p style="margin: 5px 0 0 0; color: #155724;">${refundText}</p>
            ${data.stripeRefunded > 0 ? '<p style="margin: 5px 0 0 0; color: #155724; font-size: 12px;">Card refunds typically take 5-10 business days to appear.</p>' : ''}
          </div>

          <p>We apologize for any inconvenience this may have caused. Feel free to browse other services on RepairCoin or rebook with this shop at a different time.</p>

          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            Thank you for using RepairCoin!<br>
            The RepairCoin Team
          </p>
        </div>

        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>This is an automated message from RepairCoin. For support, contact support@repaircoin.com</p>
        </div>
      </div>
    `;

    return this.sendEmail(data.customerEmail, subject, html);
  }

  /**
   * Send booking cancelled by customer confirmation email
   */
  async sendBookingCancelledByCustomer(data: BookingCancelledByCustomerData): Promise<boolean> {
    const subject = `Booking Cancellation Confirmed - ${data.serviceName}`;

    // Build refund details string
    const refundParts: string[] = [];
    if (data.rcnRefunded > 0) {
      refundParts.push(`${data.rcnRefunded} RCN tokens`);
    }
    if (data.stripeRefunded > 0) {
      refundParts.push(`$${data.stripeRefunded.toFixed(2)}`);
    }
    const refundText = refundParts.length > 0
      ? refundParts.join(' and ') + ' will be refunded to your account'
      : 'No refund was required for this booking';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #FFCC00; padding: 20px; text-align: center;">
          <h1 style="color: #000; margin: 0;">Cancellation Confirmed</h1>
        </div>

        <div style="padding: 20px;">
          <p>Hi ${data.customerName || 'there'},</p>

          <p>Your booking has been successfully cancelled as requested.</p>

          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Service:</strong> ${data.serviceName}</p>
            <p style="margin: 5px 0;"><strong>Shop:</strong> ${data.shopName}</p>
            ${data.bookingDate ? `<p style="margin: 5px 0;"><strong>Date:</strong> ${data.bookingDate}</p>` : ''}
            ${data.bookingTime ? `<p style="margin: 5px 0;"><strong>Time:</strong> ${data.bookingTime}</p>` : ''}
            ${data.cancellationReason ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${data.cancellationReason}</p>` : ''}
          </div>

          <div style="background-color: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <p style="margin: 0; color: #155724;"><strong>Refund Information:</strong></p>
            <p style="margin: 5px 0 0 0; color: #155724;">${refundText}</p>
            ${data.stripeRefunded > 0 ? '<p style="margin: 5px 0 0 0; color: #155724; font-size: 12px;">Card refunds typically take 5-10 business days to appear.</p>' : ''}
          </div>

          <p>Need to book again? Browse services on RepairCoin anytime!</p>

          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            Thank you for using RepairCoin!<br>
            The RepairCoin Team
          </p>
        </div>

        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>This is an automated message from RepairCoin. For support, contact support@repaircoin.com</p>
        </div>
      </div>
    `;

    return this.sendEmail(data.customerEmail, subject, html);
  }

  /**
   * Send no-show tier 1 warning email (1st offense)
   */
  async sendNoShowTier1Warning(data: {
    customerEmail: string;
    customerName: string;
    shopName: string;
    serviceName: string;
    appointmentDate: string;
    noShowCount: number;
  }): Promise<boolean> {
    const subject = 'Missed Appointment Notice - Please Read';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #fff3cd; padding: 20px; text-align: center; border-left: 4px solid #ffc107;">
          <h2 style="color: #856404; margin: 0;">Missed Appointment Notice</h2>
        </div>

        <div style="padding: 20px;">
          <p>Hi ${data.customerName || 'there'},</p>

          <p>We noticed that you missed your scheduled appointment at <strong>${data.shopName}</strong>.</p>

          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Service:</strong> ${data.serviceName}</p>
            <p style="margin: 5px 0;"><strong>Scheduled Date:</strong> ${data.appointmentDate}</p>
            <p style="margin: 5px 0;"><strong>Shop:</strong> ${data.shopName}</p>
          </div>

          <p><strong>We understand that unexpected things happen!</strong> This is just a friendly reminder that missed appointments impact local businesses.</p>

          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Your Account Status:</strong></p>
            <p style="margin: 5px 0 0 0;">Total No-Shows: ${data.noShowCount}</p>
            <p style="margin: 5px 0 0 0;">Current Tier: Warning (No Restrictions)</p>
          </div>

          <p><strong>Tips for Future Bookings:</strong></p>
          <ul>
            <li>Cancel at least 4 hours in advance if you can't make it</li>
            <li>Set reminders on your phone for appointments</li>
            <li>Contact the shop directly if you're running late</li>
          </ul>

          <p>You can continue booking services normally. Thank you for being a valued RepairCoin customer!</p>

          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            The RepairCoin Team
          </p>
        </div>

        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>This is an automated message from RepairCoin</p>
        </div>
      </div>
    `;

    return this.sendEmail(data.customerEmail, subject, html);
  }

  /**
   * Send no-show tier 2 caution email (2nd offense)
   */
  async sendNoShowTier2Caution(data: {
    customerEmail: string;
    customerName: string;
    shopName: string;
    serviceName: string;
    appointmentDate: string;
    noShowCount: number;
    minimumAdvanceHours: number;
  }): Promise<boolean> {
    const subject = '⚠️ Important: Account Restrictions Applied - Multiple No-Shows';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #fff3cd; padding: 20px; text-align: center; border-left: 4px solid #ff9800;">
          <h2 style="color: #e65100; margin: 0;">⚠️ Account Restrictions Applied</h2>
        </div>

        <div style="padding: 20px;">
          <p>Hi ${data.customerName || 'there'},</p>

          <p>You were marked as no-show for another appointment at <strong>${data.shopName}</strong>.</p>

          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Service:</strong> ${data.serviceName}</p>
            <p style="margin: 5px 0;"><strong>Scheduled Date:</strong> ${data.appointmentDate}</p>
            <p style="margin: 5px 0;"><strong>Shop:</strong> ${data.shopName}</p>
          </div>

          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
            <p style="margin: 0; color: #e65100;"><strong>⚠️ Your Account Status:</strong></p>
            <p style="margin: 5px 0 0 0; color: #e65100;">Total No-Shows: ${data.noShowCount}</p>
            <p style="margin: 5px 0 0 0; color: #e65100;">Current Tier: Caution</p>
          </div>

          <p><strong>Due to multiple no-shows, the following restriction now applies:</strong></p>

          <div style="background-color: #ffebee; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #c62828;"><strong>📅 Advance Booking Required:</strong></p>
            <p style="margin: 5px 0 0 0;">You must book at least <strong>${data.minimumAdvanceHours} hours in advance</strong></p>
          </div>

          <p><strong>Why This Matters:</strong></p>
          <p>No-shows hurt local repair businesses and prevent other customers from getting appointments. We appreciate your understanding.</p>

          <p><strong>How to Avoid Further Restrictions:</strong></p>
          <ul>
            <li>Always cancel at least 4 hours before your appointment</li>
            <li>Show up on time (or call if you'll be late)</li>
            <li>Set calendar reminders for your bookings</li>
          </ul>

          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            Questions? Contact support@repaircoin.com<br>
            The RepairCoin Team
          </p>
        </div>

        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>This is an automated message from RepairCoin</p>
        </div>
      </div>
    `;

    return this.sendEmail(data.customerEmail, subject, html);
  }

  /**
   * Send no-show tier 3 deposit required email (3rd offense)
   */
  async sendNoShowTier3DepositRequired(data: {
    customerEmail: string;
    customerName: string;
    shopName: string;
    serviceName: string;
    appointmentDate: string;
    noShowCount: number;
    depositAmount: number;
    minimumAdvanceHours: number;
    maxRcnRedemptionPercent: number;
    resetAfterSuccessful: number;
  }): Promise<boolean> {
    const subject = '🚨 Critical: Deposit Now Required - Multiple No-Shows';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #ffebee; padding: 20px; text-align: center; border-left: 4px solid #d32f2f;">
          <h2 style="color: #c62828; margin: 0;">🚨 Deposit Required</h2>
        </div>

        <div style="padding: 20px;">
          <p>Hi ${data.customerName || 'there'},</p>

          <p><strong>You were marked as no-show for another appointment.</strong> Due to repeated missed appointments, we must now require a refundable deposit for future bookings.</p>

          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Latest Missed Service:</strong> ${data.serviceName}</p>
            <p style="margin: 5px 0;"><strong>Scheduled Date:</strong> ${data.appointmentDate}</p>
            <p style="margin: 5px 0;"><strong>Shop:</strong> ${data.shopName}</p>
          </div>

          <div style="background-color: #ffebee; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d32f2f;">
            <p style="margin: 0; color: #c62828;"><strong>🚨 Your Account Status:</strong></p>
            <p style="margin: 5px 0 0 0; color: #c62828;">Total No-Shows: ${data.noShowCount}</p>
            <p style="margin: 5px 0 0 0; color: #c62828;">Current Tier: Deposit Required</p>
          </div>

          <p><strong>New Booking Requirements:</strong></p>

          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>💰 Refundable Deposit:</strong> $${data.depositAmount.toFixed(2)}</p>
            <p style="margin: 5px 0 0 0; font-size: 12px;">Fully refunded when you show up for your appointment</p>
          </div>

          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>📅 Advance Booking:</strong> ${data.minimumAdvanceHours} hours minimum</p>
            <p style="margin: 5px 0 0 0;"><strong>🪙 RCN Redemption:</strong> Limited to ${data.maxRcnRedemptionPercent}% of service cost</p>
          </div>

          <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50;">
            <p style="margin: 0; color: #2e7d32;"><strong>✨ Good News - You Can Restore Your Account!</strong></p>
            <p style="margin: 5px 0 0 0;">Show up for <strong>${data.resetAfterSuccessful} successful appointments</strong> and we'll remove these restrictions.</p>
          </div>

          <p><strong>Important Information:</strong></p>
          <ul>
            <li>Deposits are charged when you book and fully refunded when you show up</li>
            <li>If you no-show again, the deposit is forfeited</li>
            <li>Always cancel at least 4 hours in advance to get your deposit back</li>
          </ul>

          <p style="color: #666; font-size: 14px;">We understand life happens, but repeated no-shows significantly impact small businesses. Thank you for your cooperation.</p>

          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            Questions? Contact support@repaircoin.com<br>
            The RepairCoin Team
          </p>
        </div>

        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>This is an automated message from RepairCoin</p>
        </div>
      </div>
    `;

    return this.sendEmail(data.customerEmail, subject, html);
  }

  /**
   * Send no-show tier 4 suspended email (5th offense)
   */
  async sendNoShowTier4Suspended(data: {
    customerEmail: string;
    customerName: string;
    shopName: string;
    serviceName: string;
    appointmentDate: string;
    noShowCount: number;
    suspensionEndDate: string;
    suspensionDays: number;
  }): Promise<boolean> {
    const subject = '🛑 Account Suspended - Multiple No-Shows';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f44336; padding: 20px; text-align: center;">
          <h2 style="color: #ffffff; margin: 0;">🛑 Account Suspended</h2>
        </div>

        <div style="padding: 20px;">
          <p>Hi ${data.customerName || 'there'},</p>

          <p><strong style="color: #d32f2f;">Your RepairCoin account has been temporarily suspended due to repeated no-shows.</strong></p>

          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Latest Missed Service:</strong> ${data.serviceName}</p>
            <p style="margin: 5px 0;"><strong>Scheduled Date:</strong> ${data.appointmentDate}</p>
            <p style="margin: 5px 0;"><strong>Shop:</strong> ${data.shopName}</p>
          </div>

          <div style="background-color: #ffebee; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f44336;">
            <p style="margin: 0; color: #b71c1c;"><strong>🛑 Account Status:</strong></p>
            <p style="margin: 5px 0 0 0; color: #b71c1c;">Total No-Shows: ${data.noShowCount}</p>
            <p style="margin: 5px 0 0 0; color: #b71c1c;">Current Tier: Suspended</p>
            <p style="margin: 5px 0 0 0; color: #b71c1c;"><strong>Suspension Until: ${data.suspensionEndDate}</strong></p>
          </div>

          <p><strong>What This Means:</strong></p>

          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>❌ You cannot book any services for ${data.suspensionDays} days</strong></p>
            <p style="margin: 5px 0 0 0; font-size: 12px;">Suspension automatically lifts on ${data.suspensionEndDate}</p>
          </div>

          <p><strong>Why This Happened:</strong></p>
          <p>Repeated no-shows cause significant harm to local businesses by preventing other customers from booking and wasting business resources. We take this seriously to protect our shop partners.</p>

          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>📅 After Suspension Ends:</strong></p>
            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
              <li>You'll be able to book again with a refundable deposit</li>
              <li>48-hour advance booking will be required</li>
              <li>RCN redemption will be limited to 80%</li>
              <li>Complete successful appointments to restore your account</li>
            </ul>
          </div>

          <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>💡 Tips to Rebuild Trust:</strong></p>
            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
              <li>Always cancel at least 4 hours in advance</li>
              <li>Set multiple reminders for appointments</li>
              <li>Only book when you're confident you can attend</li>
              <li>Contact shops directly if you're running late</li>
            </ul>
          </div>

          <p style="color: #666; font-size: 14px;">We value all our customers and look forward to serving you again after the suspension period. Please use this time to reflect on the importance of honoring appointments.</p>

          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            Questions about your suspension? Contact support@repaircoin.com<br>
            The RepairCoin Team
          </p>
        </div>

        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>This is an automated message from RepairCoin</p>
        </div>
      </div>
    `;

    return this.sendEmail(data.customerEmail, subject, html);
  }

  /**
   * Send email when customer dispute is submitted
   */
  async sendDisputeSubmitted(data: {
    customerEmail: string;
    customerName: string;
    shopName: string;
    appointmentDate: Date;
    disputeReason: string;
    autoApproved: boolean;
  }): Promise<boolean> {
    const subject = data.autoApproved
      ? `Your dispute has been approved - ${data.shopName}`
      : `Dispute submitted for review - ${data.shopName}`;

    const appointmentDateStr = data.appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #1a1a1a; color: #ffffff; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #d97706, #f59e0b); padding: 32px; text-align: center;">
          <h1 style="color: #000; margin: 0; font-size: 24px;">
            ${data.autoApproved ? '✅ Dispute Approved' : '📋 Dispute Submitted'}
          </h1>
        </div>
        <div style="padding: 32px;">
          <p style="color: #d1d5db;">Hi ${data.customerName || 'Customer'},</p>
          ${data.autoApproved ? `
            <p style="color: #d1d5db;">Great news! Your no-show dispute for your appointment on <strong style="color: #ffffff;">${appointmentDateStr}</strong> at <strong style="color: #ffffff;">${data.shopName}</strong> has been <strong style="color: #10b981;">automatically approved</strong>.</p>
            <p style="color: #d1d5db;">The no-show penalty has been reversed and your account standing has been updated.</p>
          ` : `
            <p style="color: #d1d5db;">Your dispute for your appointment on <strong style="color: #ffffff;">${appointmentDateStr}</strong> at <strong style="color: #ffffff;">${data.shopName}</strong> has been submitted and is <strong style="color: #f59e0b;">pending review</strong>.</p>
            <div style="background: #2a2a2a; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="color: #9ca3af; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase;">Your Reason</p>
              <p style="color: #ffffff; margin: 0;">${data.disputeReason}</p>
            </div>
            <p style="color: #d1d5db;">The shop will review your dispute within their specified timeframe. You'll receive an email when a decision is made.</p>
          `}
          <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">RepairCoin — The Repair Shop Loyalty Platform</p>
        </div>
      </div>
    `;

    return this.sendEmail(data.customerEmail, subject, html);
  }

  /**
   * Send email when shop resolves a dispute
   */
  async sendDisputeResolved(data: {
    customerEmail: string;
    customerName: string;
    shopName: string;
    appointmentDate: Date;
    resolution: 'approved' | 'rejected';
    resolutionNotes?: string;
  }): Promise<boolean> {
    const subject = data.resolution === 'approved'
      ? `Your dispute has been approved - ${data.shopName}`
      : `Your dispute decision - ${data.shopName}`;

    const appointmentDateStr = data.appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #1a1a1a; color: #ffffff; border-radius: 12px; overflow: hidden;">
        <div style="background: ${data.resolution === 'approved' ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #dc2626, #ef4444)'}; padding: 32px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">
            ${data.resolution === 'approved' ? '✅ Dispute Approved' : '❌ Dispute Decision'}
          </h1>
        </div>
        <div style="padding: 32px;">
          <p style="color: #d1d5db;">Hi ${data.customerName || 'Customer'},</p>
          ${data.resolution === 'approved' ? `
            <p style="color: #d1d5db;"><strong style="color: #ffffff;">${data.shopName}</strong> has reviewed your dispute for your appointment on <strong style="color: #ffffff;">${appointmentDateStr}</strong> and has <strong style="color: #10b981;">approved</strong> your request.</p>
            <p style="color: #d1d5db;">The no-show penalty has been reversed and your account standing has been updated.</p>
          ` : `
            <p style="color: #d1d5db;"><strong style="color: #ffffff;">${data.shopName}</strong> has reviewed your dispute for your appointment on <strong style="color: #ffffff;">${appointmentDateStr}</strong> and has <strong style="color: #ef4444;">upheld the no-show record</strong>.</p>
            <p style="color: #d1d5db;">The no-show penalty remains in effect on your account.</p>
          `}
          ${data.resolutionNotes ? `
            <div style="background: #2a2a2a; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="color: #9ca3af; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase;">Shop Notes</p>
              <p style="color: #ffffff; margin: 0;">${data.resolutionNotes}</p>
            </div>
          ` : ''}
          ${data.resolution === 'rejected' ? `<p style="color: #d1d5db;">If you believe this decision is incorrect, please contact platform support.</p>` : ''}
          <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">RepairCoin — The Repair Shop Loyalty Platform</p>
        </div>
      </div>
    `;

    return this.sendEmail(data.customerEmail, subject, html);
  }

  /**
   * Core email sending method
   */
  private async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      // Log email content if not configured
      logger.info('Email Service - Mock Send (not configured):', {
        to,
        subject,
        isConfigured: this.isConfigured,
        hasTransporter: !!this.transporter,
        preview: html.substring(0, 200) + '...'
      });
      return true;
    }

    try {
      logger.debug('Attempting to send email:', {
        to,
        subject,
        from: this.config.from,
      });

      const info = await this.transporter.sendMail({
        from: this.config.from,
        to,
        subject,
        html
      });

      logger.info('Email sent successfully:', {
        to,
        subject,
        messageId: info.messageId
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to send email:', {
        to,
        subject,
        errorMessage: error.message,
        errorCode: error.code,
        errorResponse: error.response,
      });
      return false;
    }
  }
}