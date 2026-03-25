// backend/src/services/GmailService.ts
import { google } from 'googleapis';
import CryptoJS from 'crypto-js';
import { GmailRepository } from '../repositories/GmailRepository';
import { logger } from '../utils/logger';

const ENCRYPTION_KEY = process.env.GMAIL_ENCRYPTION_KEY || process.env.GOOGLE_CALENDAR_ENCRYPTION_KEY || '';
const CLIENT_ID = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:4000/api/shops/gmail/callback';

export interface EmailOptions {
  to: string;
  toName?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  orderId?: string;
  customerAddress?: string;
  emailType: 'booking_confirmation' | 'reminder' | 'promotional' | 'support' | 'manual' | 'cancellation' | 'reschedule';
}

export class GmailService {
  private gmailRepo: GmailRepository;
  private oauth2Client: any;

  constructor() {
    this.gmailRepo = new GmailRepository();
    this.oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  }

  /**
   * Get OAuth authorization URL for Gmail
   */
  async getAuthorizationUrl(shopId: string): Promise<string> {
    try {
      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.compose',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
        ],
        state: shopId,
        prompt: 'consent', // Force consent to get refresh token
      });

      logger.info('Generated Gmail OAuth authorization URL', { shopId });
      return authUrl;
    } catch (error) {
      logger.error('Error generating authorization URL:', error);
      throw new Error('Failed to generate authorization URL');
    }
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleOAuthCallback(code: string, shopId: string): Promise<void> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Missing tokens in OAuth response');
      }

      // Get user email
      this.oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const userInfo = await oauth2.userinfo.get();

      // Calculate token expiry
      const tokenExpiry = new Date();
      tokenExpiry.setSeconds(tokenExpiry.getSeconds() + (tokens.expiry_date || 3600));

      // Encrypt tokens
      const encryptedAccessToken = this.encryptToken(tokens.access_token);
      const encryptedRefreshToken = this.encryptToken(tokens.refresh_token);

      // Save connection
      await this.gmailRepo.saveConnection({
        shopId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiry,
        emailAddress: userInfo.data.email || '',
        displayName: userInfo.data.name || undefined,
      });

      logger.info('Successfully saved Gmail connection', {
        shopId,
        email: userInfo.data.email,
      });
    } catch (error) {
      logger.error('Error handling OAuth callback:', error);
      throw new Error('Failed to complete Gmail connection');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(shopId: string): Promise<void> {
    try {
      const connection = await this.gmailRepo.getActiveConnection(shopId);

      if (!connection) {
        throw new Error('No active Gmail connection found');
      }

      const refreshToken = this.decryptToken(connection.refreshToken);

      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token');
      }

      const tokenExpiry = new Date();
      tokenExpiry.setSeconds(tokenExpiry.getSeconds() + (credentials.expiry_date || 3600));

      const encryptedAccessToken = this.encryptToken(credentials.access_token);
      await this.gmailRepo.updateAccessToken(shopId, encryptedAccessToken, tokenExpiry);

      await this.gmailRepo.updateLastSync(shopId, 'success');

      logger.info('Successfully refreshed access token', { shopId });
    } catch (error) {
      logger.error('Error refreshing access token:', error);
      await this.gmailRepo.updateLastSync(
        shopId,
        'token_expired',
        'Failed to refresh token'
      );
      throw error;
    }
  }

  /**
   * Send email through Gmail API
   */
  async sendEmail(shopId: string, emailOptions: EmailOptions): Promise<string> {
    try {
      const connection = await this.gmailRepo.getActiveConnection(shopId);

      if (!connection) {
        throw new Error('No active Gmail connection found. Please connect your Gmail account.');
      }

      // Check if token needs refresh
      if (connection.tokenExpiry < new Date()) {
        await this.refreshAccessToken(shopId);
        const updatedConnection = await this.gmailRepo.getActiveConnection(shopId);
        if (!updatedConnection) throw new Error('Connection lost after refresh');
        Object.assign(connection, updatedConnection);
      }

      // Decrypt access token
      const accessToken = this.decryptToken(connection.accessToken);
      this.oauth2Client.setCredentials({ access_token: accessToken });

      // Build email
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      const rawMessage = this.createRawEmail(
        connection.emailAddress,
        emailOptions.to,
        emailOptions.subject,
        emailOptions.htmlBody,
        emailOptions.textBody
      );

      // Send email
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: rawMessage,
        },
      });

      if (!response.data.id) {
        throw new Error('No message ID returned from Gmail');
      }

      // Log sent email
      await this.gmailRepo.logSentEmail({
        shopId,
        toEmail: emailOptions.to,
        toName: emailOptions.toName,
        subject: emailOptions.subject,
        bodyPreview: emailOptions.textBody?.substring(0, 200) || emailOptions.htmlBody.substring(0, 200),
        orderId: emailOptions.orderId,
        customerAddress: emailOptions.customerAddress,
        emailType: emailOptions.emailType,
        status: 'sent',
        gmailMessageId: response.data.id,
      });

      // Increment counter
      await this.gmailRepo.incrementEmailCounter(shopId);

      logger.info('Email sent successfully', {
        shopId,
        to: emailOptions.to,
        subject: emailOptions.subject,
        messageId: response.data.id,
      });

      return response.data.id;
    } catch (error) {
      logger.error('Error sending email:', error);

      // Log failed email
      await this.gmailRepo.logSentEmail({
        shopId,
        toEmail: emailOptions.to,
        toName: emailOptions.toName,
        subject: emailOptions.subject,
        bodyPreview: emailOptions.textBody?.substring(0, 200) || emailOptions.htmlBody.substring(0, 200),
        orderId: emailOptions.orderId,
        customerAddress: emailOptions.customerAddress,
        emailType: emailOptions.emailType,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Disconnect Gmail
   */
  async disconnectGmail(shopId: string): Promise<void> {
    try {
      await this.gmailRepo.disconnectGmail(shopId);
      logger.info('Successfully disconnected Gmail', { shopId });
    } catch (error) {
      logger.error('Error disconnecting Gmail:', error);
      throw error;
    }
  }

  /**
   * Create raw email message (RFC 2822 format)
   */
  private createRawEmail(
    from: string,
    to: string,
    subject: string,
    htmlBody: string,
    textBody?: string
  ): string {
    const boundary = '----=_Part_' + Date.now();

    const messageParts = [
      'MIME-Version: 1.0',
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      textBody || this.stripHtml(htmlBody),
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      htmlBody,
      '',
      `--${boundary}--`,
    ];

    const message = messageParts.join('\r\n');
    return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Strip HTML tags for plain text version
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Encrypt token using AES-256-GCM
   */
  private encryptToken(token: string): string {
    if (!ENCRYPTION_KEY) {
      throw new Error('GMAIL_ENCRYPTION_KEY not configured');
    }
    return CryptoJS.AES.encrypt(token, ENCRYPTION_KEY).toString();
  }

  /**
   * Decrypt token using AES-256-GCM
   */
  private decryptToken(encryptedToken: string): string {
    if (!ENCRYPTION_KEY) {
      throw new Error('GMAIL_ENCRYPTION_KEY not configured');
    }
    const bytes = CryptoJS.AES.decrypt(encryptedToken, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}
