// backend/src/domains/ShopDomain/controllers/GmailController.ts
import { Request, Response } from 'express';
import { GmailService } from '../../../services/GmailService';
import { GmailRepository } from '../../../repositories/GmailRepository';
import { logger } from '../../../utils/logger';

export class GmailController {
  private gmailService: GmailService;
  private gmailRepo: GmailRepository;

  constructor() {
    this.gmailService = new GmailService();
    this.gmailRepo = new GmailRepository();
  }

  /**
   * GET /api/shops/gmail/connect
   * Get Gmail OAuth authorization URL
   */
  connectGmail = async (req: Request, res: Response): Promise<void> => {
    try {
      const shopId = req.user?.shopId;

      if (!shopId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized - Shop ID not found',
        });
        return;
      }

      const authUrl = await this.gmailService.getAuthorizationUrl(shopId);

      res.status(200).json({
        success: true,
        data: {
          authUrl,
          message: 'Redirect user to this URL to authorize Gmail access',
        },
      });
    } catch (error) {
      logger.error('Error in connectGmail:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate authorization URL',
      });
    }
  };

  /**
   * GET/POST /api/shops/gmail/callback
   * Handle OAuth callback from Gmail
   * Accepts both GET (from Google redirect) and POST (from frontend)
   */
  handleGmailCallback = async (req: Request, res: Response): Promise<void> => {
    const isGet = req.method === 'GET';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    try {
      const code = isGet ? (req.query.code as string) : req.body.code;
      const state = isGet ? (req.query.state as string) : req.body.state;
      const shopId = state || req.user?.shopId;

      if (!code || !shopId) {
        if (isGet) {
          res.redirect(`${frontendUrl}/shop/gmail/callback?error=${encodeURIComponent('Missing authorization code or shop ID')}`);
          return;
        }
        res.status(400).json({
          success: false,
          error: 'Missing authorization code or shop ID',
        });
        return;
      }

      await this.gmailService.handleOAuthCallback(code, shopId);

      if (isGet) {
        res.redirect(`${frontendUrl}/shop/gmail/callback?success=true`);
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Gmail connected successfully',
      });
    } catch (error) {
      logger.error('Error in handleGmailCallback:', error);

      if (isGet) {
        const errorMessage = error instanceof Error ? error.message : 'Connection failed';
        res.redirect(`${frontendUrl}/shop/gmail/callback?error=${encodeURIComponent(errorMessage)}`);
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to complete Gmail connection',
      });
    }
  };

  /**
   * GET /api/shops/gmail/status
   * Get Gmail connection status for the shop
   */
  getConnectionStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const shopId = req.user?.shopId;

      if (!shopId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized - Shop ID not found',
        });
        return;
      }

      const connection = await this.gmailRepo.getActiveConnection(shopId);

      if (!connection) {
        res.status(200).json({
          success: true,
          data: {
            connected: false,
            email: null,
            displayName: null,
            totalEmailsSent: 0,
            lastEmailSentAt: null,
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          connected: true,
          email: connection.emailAddress,
          displayName: connection.displayName,
          totalEmailsSent: connection.totalEmailsSent,
          lastEmailSentAt: connection.lastEmailSentAt,
          lastSyncStatus: connection.lastSyncStatus,
          syncError: connection.syncErrorMessage,
        },
      });
    } catch (error) {
      logger.error('Error in getConnectionStatus:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get Gmail connection status',
      });
    }
  };

  /**
   * DELETE /api/shops/gmail/disconnect
   * Disconnect Gmail integration
   */
  disconnectGmail = async (req: Request, res: Response): Promise<void> => {
    try {
      const shopId = req.user?.shopId;

      if (!shopId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized - Shop ID not found',
        });
        return;
      }

      await this.gmailService.disconnectGmail(shopId);

      res.status(200).json({
        success: true,
        message: 'Gmail disconnected successfully',
      });
    } catch (error) {
      logger.error('Error in disconnectGmail:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to disconnect Gmail',
      });
    }
  };

  /**
   * POST /api/shops/gmail/send-test
   * Send a test email (for testing)
   */
  sendTestEmail = async (req: Request, res: Response): Promise<void> => {
    try {
      const shopId = req.user?.shopId;
      const { toEmail } = req.body;

      if (!shopId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized - Shop ID not found',
        });
        return;
      }

      if (!toEmail) {
        res.status(400).json({
          success: false,
          error: 'Missing recipient email address',
        });
        return;
      }

      const messageId = await this.gmailService.sendEmail(shopId, {
        to: toEmail,
        subject: 'Test Email from RepairCoin',
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FFCC00;">Test Email from RepairCoin</h2>
            <p>This is a test email to verify your Gmail integration is working correctly.</p>
            <p>If you received this email, your Gmail connection is configured properly!</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              Sent via RepairCoin Gmail Integration
            </p>
          </div>
        `,
        textBody: 'This is a test email from RepairCoin. Your Gmail integration is working!',
        emailType: 'manual',
      });

      res.status(200).json({
        success: true,
        message: 'Test email sent successfully',
        data: {
          messageId,
        },
      });
    } catch (error) {
      logger.error('Error in sendTestEmail:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send test email',
      });
    }
  };

  /**
   * GET /api/shops/gmail/stats
   * Get email statistics
   */
  getEmailStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const shopId = req.user?.shopId;

      if (!shopId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized - Shop ID not found',
        });
        return;
      }

      const stats = await this.gmailRepo.getEmailStats(shopId);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error in getEmailStats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get email statistics',
      });
    }
  };
}
