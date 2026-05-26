import sgMail from '@sendgrid/mail';
import { logger } from '../utils/logger';

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
  private initialized: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const apiKey = process.env.SENDGRID_API_KEY;

    if (!apiKey) {
      logger.warn('SendGrid API key not configured - campaign emails will not be sent');
      this.initialized = false;
      return;
    }

    sgMail.setApiKey(apiKey);
    this.initialized = true;
    logger.info('CampaignEmailService initialized successfully');
  }

  /**
   * Check if the service is properly initialized
   */
  public isReady(): boolean {
    return this.initialized;
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
    if (!this.initialized) {
      return {
        success: false,
        error: 'SendGrid is not configured. Please set SENDGRID_API_KEY in environment variables.',
      };
    }

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

      logger.info(`Test email sent successfully to ${to}`);
      return { success: true };
    } catch (error: unknown) {
      logger.error('Failed to send test email:', error);

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
    if (!this.initialized) {
      throw new Error(
        'SendGrid is not configured. Please set SENDGRID_API_KEY in environment variables.'
      );
    }

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
      `Starting bulk campaign email send: ${recipients.length} recipients in ${batches.length} batches`
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
   * Generate unsubscribe token for a contact
   */
  public generateUnsubscribeToken(contactId: string, shopId: string): string {
    // Simple base64 encoding for now - in production, use JWT or encrypted tokens
    const payload = JSON.stringify({ contactId, shopId, timestamp: Date.now() });
    return Buffer.from(payload).toString('base64url');
  }

  /**
   * Add unsubscribe footer to email HTML content
   */
  public addUnsubscribeFooter(htmlContent: string, unsubscribeToken: string): string {
    const unsubscribeUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/api/marketing/unsubscribe/${unsubscribeToken}`;

    const footer = `
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center;">
        <p>You received this email because you are a customer of our shop.</p>
        <p>
          <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">
            Unsubscribe from future emails
          </a>
        </p>
      </div>
    `;

    // Insert before closing body tag, or append if no body tag
    if (htmlContent.includes('</body>')) {
      return htmlContent.replace('</body>', `${footer}</body>`);
    }

    return htmlContent + footer;
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
