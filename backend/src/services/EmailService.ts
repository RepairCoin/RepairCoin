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