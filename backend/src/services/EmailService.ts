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