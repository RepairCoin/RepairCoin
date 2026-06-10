import sgMail from '@sendgrid/mail';
import { logger } from '../utils/logger';
import { resendEmailService } from './ResendEmailService';

interface EmailRecipient {
  email: string;
  fullName: string;
  contactId: string;
}

interface CampaignEmailResult {
  contactId: string;
  email: string;
  status: 'sent' | 'failed';
  errorMessage?: string;
  sentAt?: Date;
}

interface SendCampaignOptions {
  subject: string;
  htmlContent: string;
  textContent?: string;
  recipients: EmailRecipient[];
  fromEmail?: string;
  fromName?: string;
  batchSize?: number;
  delayBetweenBatches?: number;
}

export class CampaignEmailService {
  private sendgridInitialized: boolean = false;
  private useResend: boolean = true; // Primary: Resend, Fallback: SendGrid

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    // Check if Resend is available (primary)
    if (resendEmailService.isReady()) {
      this.useResend = true;
      logger.info('CampaignEmailService initialized with Resend (primary)');
    } else {
      // Fall back to SendGrid
      const apiKey = process.env.SENDGRID_API_KEY;

      if (!apiKey) {
        logger.warn('Neither Resend nor SendGrid API keys configured - campaign emails will not be sent');
        this.sendgridInitialized = false;
        this.useResend = false;
        return;
      }

      sgMail.setApiKey(apiKey);
      this.sendgridInitialized = true;
      this.useResend = false;
      logger.info('CampaignEmailService initialized with SendGrid (fallback)');
    }
  }

  /**
   * Check if the service is properly initialized
   */
  public isReady(): boolean {
    return this.useResend ? resendEmailService.isReady() : this.sendgridInitialized;
  }

  /**
   * Send a test campaign email to a single recipient
   */
  public async sendTestEmail(
    to: string,
    subject: string,
    htmlContent: string,
    textContent?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isReady()) {
      return {
        success: false,
        error: 'Email service is not configured. Please set RESEND_API_KEY or SENDGRID_API_KEY in environment variables.',
      };
    }

    // Use Resend if available
    if (this.useResend) {
      const result = await resendEmailService.sendTestEmail(to, subject, htmlContent, textContent);
      if (result.success) {
        logger.info(`Test email sent successfully to ${to} via Resend`);
      }
      return result;
    }

    // Fall back to SendGrid
    try {
      const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@repaircoin.com';
      const fromName = process.env.SENDGRID_FROM_NAME || 'RepairCoin';

      await sgMail.send({
        to,
        from: { email: fromEmail, name: fromName },
        subject,
        html: htmlContent,
        text: textContent || this.htmlToText(htmlContent),
      });

      logger.info(`Test email sent successfully to ${to} via SendGrid`);
      return { success: true };
    } catch (error: unknown) {
      logger.error('Failed to send test email via SendGrid:', error);

      if (error && typeof error === 'object' && 'response' in error) {
        const sgError = error as { response?: { body?: { errors?: Array<{ message: string }> } } };
        const errorMessage =
          sgError.response?.body?.errors?.[0]?.message || 'Failed to send test email';
        return { success: false, error: errorMessage };
      }

      return { success: false, error: 'Failed to send test email' };
    }
  }

  /**
   * Send bulk campaign emails with batch processing and rate limiting
   */
  public async sendBulkCampaignEmails(
    options: SendCampaignOptions
  ): Promise<CampaignEmailResult[]> {
    if (!this.isReady()) {
      throw new Error(
        'Email service is not configured. Please set RESEND_API_KEY or SENDGRID_API_KEY in environment variables.'
      );
    }

    // Use Resend if available
    if (this.useResend) {
      logger.info('Using Resend for bulk campaign emails');
      return resendEmailService.sendBulkCampaignEmails(options);
    }

    // Fall back to SendGrid
    logger.info('Using SendGrid for bulk campaign emails');
    const {
      subject,
      htmlContent,
      textContent,
      recipients,
      fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@repaircoin.com',
      fromName = process.env.SENDGRID_FROM_NAME || 'RepairCoin',
      batchSize = 100,
      delayBetweenBatches = 1000, // 1 second delay between batches
    } = options;

    const results: CampaignEmailResult[] = [];
    const batches = this.chunkArray(recipients, batchSize);

    logger.info(
      `Starting bulk campaign email send via SendGrid: ${recipients.length} recipients in ${batches.length} batches`
    );

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      logger.info(`Processing batch ${i + 1} of ${batches.length} (${batch.length} recipients)`);

      const batchResults = await this.sendBatch(
        batch,
        subject,
        htmlContent,
        textContent || this.htmlToText(htmlContent),
        fromEmail,
        fromName
      );

      results.push(...batchResults);

      // Add delay between batches to respect rate limits
      if (i < batches.length - 1) {
        await this.delay(delayBetweenBatches);
      }
    }

    const successCount = results.filter((r) => r.status === 'sent').length;
    const failureCount = results.filter((r) => r.status === 'failed').length;

    logger.info(
      `Bulk campaign email send completed: ${successCount} sent, ${failureCount} failed`
    );

    return results;
  }

  /**
   * Send a single batch of emails
   */
  private async sendBatch(
    recipients: EmailRecipient[],
    subject: string,
    htmlContent: string,
    textContent: string,
    fromEmail: string,
    fromName: string
  ): Promise<CampaignEmailResult[]> {
    const results: CampaignEmailResult[] = [];

    // Send emails individually to track per-recipient results
    const sendPromises = recipients.map(async (recipient) => {
      try {
        await sgMail.send({
          to: recipient.email,
          from: { email: fromEmail, name: fromName },
          subject,
          html: htmlContent,
          text: textContent,
        });

        return {
          contactId: recipient.contactId,
          email: recipient.email,
          status: 'sent' as const,
          sentAt: new Date(),
        };
      } catch (error: unknown) {
        logger.error(`Failed to send email to ${recipient.email}:`, error);

        let errorMessage = 'Unknown error';
        if (error && typeof error === 'object' && 'response' in error) {
          const sgError = error as { response?: { body?: { errors?: Array<{ message: string }> } } };
          errorMessage = sgError.response?.body?.errors?.[0]?.message || 'SendGrid error';
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        return {
          contactId: recipient.contactId,
          email: recipient.email,
          status: 'failed' as const,
          errorMessage,
        };
      }
    });

    const batchResults = await Promise.all(sendPromises);
    results.push(...batchResults);

    return results;
  }

  /**
   * Convert HTML to plain text (basic implementation)
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const campaignEmailService = new CampaignEmailService();
