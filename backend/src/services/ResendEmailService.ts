import { Resend } from 'resend';
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

interface SimpleEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: {
    email: string;
    name: string;
  };
}

export class ResendEmailService {
  private client: Resend | null = null;
  private initialized: boolean = false;
  private defaultFrom: { email: string; name: string };

  constructor() {
    this.defaultFrom = {
      email: process.env.RESEND_FROM_EMAIL || 'noreply@repaircoin.com',
      name: process.env.RESEND_FROM_NAME || 'RepairCoin',
    };
    this.initialize();
  }

  private initialize(): void {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      logger.warn('Resend API key not configured - emails will fall back to Gmail SMTP');
      this.initialized = false;
      return;
    }

    try {
      this.client = new Resend(apiKey);
      this.initialized = true;
      logger.info('ResendEmailService initialized successfully');
    } catch (error: unknown) {
      logger.error('Failed to initialize Resend client:', error);
      this.initialized = false;
    }
  }

  /**
   * Check if the service is properly initialized
   */
  public isReady(): boolean {
    return this.initialized && this.client !== null;
  }

  /**
   * Send a simple email to a single recipient
   */
  public async sendEmail(options: SimpleEmailOptions): Promise<{ success: boolean; error?: string; messageId?: string }> {
    if (!this.isReady()) {
      return {
        success: false,
        error: 'Resend is not configured. Please set RESEND_API_KEY in environment variables.',
      };
    }

    try {
      const fromAddress = options.from || this.defaultFrom;

      const result = await this.client!.emails.send({
        from: `${fromAddress.name} <${fromAddress.email}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.htmlToText(options.html),
      });

      if (result.error) {
        logger.error('Resend API returned error:', result.error);
        return {
          success: false,
          error: result.error.message || 'Failed to send email',
        };
      }

      logger.info(`Email sent successfully to ${options.to}`, { messageId: result.data?.id });
      return {
        success: true,
        messageId: result.data?.id,
      };
    } catch (error: unknown) {
      logger.error('Failed to send email via Resend:', error);

      let errorMessage = 'Failed to send email';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send a test campaign email to a single recipient
   */
  public async sendTestEmail(
    to: string,
    subject: string,
    htmlContent: string,
    textContent?: string
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    return this.sendEmail({
      to,
      subject,
      html: htmlContent,
      text: textContent,
    });
  }

  /**
   * Send bulk campaign emails with batch processing and rate limiting
   */
  public async sendBulkCampaignEmails(
    options: SendCampaignOptions
  ): Promise<CampaignEmailResult[]> {
    if (!this.isReady()) {
      throw new Error(
        'Resend is not configured. Please set RESEND_API_KEY in environment variables.'
      );
    }

    const {
      subject,
      htmlContent,
      textContent,
      recipients,
      fromEmail = this.defaultFrom.email,
      fromName = this.defaultFrom.name,
      batchSize = 100,
      delayBetweenBatches = 1000, // 1 second delay between batches
    } = options;

    const results: CampaignEmailResult[] = [];
    const batches = this.chunkArray(recipients, batchSize);

    logger.info(
      `Starting bulk campaign email send via Resend: ${recipients.length} recipients in ${batches.length} batches`
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
        const result = await this.client!.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: recipient.email,
          subject,
          html: htmlContent,
          text: textContent,
        });

        if (result.error) {
          logger.error(`Resend API error for ${recipient.email}:`, result.error);
          return {
            contactId: recipient.contactId,
            email: recipient.email,
            status: 'failed' as const,
            errorMessage: result.error.message || 'Resend API error',
          };
        }

        return {
          contactId: recipient.contactId,
          email: recipient.email,
          status: 'sent' as const,
          sentAt: new Date(),
        };
      } catch (error: unknown) {
        logger.error(`Failed to send email to ${recipient.email}:`, error);

        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (error && typeof error === 'object' && 'message' in error) {
          errorMessage = String(error.message);
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
export const resendEmailService = new ResendEmailService();
