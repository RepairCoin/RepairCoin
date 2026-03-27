// backend/src/domains/ShopDomain/controllers/CalendarController.ts
import { Request, Response } from 'express';
import { GoogleCalendarService } from '../../../services/GoogleCalendarService';
import { CalendarRepository } from '../../../repositories/CalendarRepository';
import { logger } from '../../../utils/logger';

export class CalendarController {
  private googleCalendarService: GoogleCalendarService;
  private calendarRepo: CalendarRepository;

  constructor() {
    this.googleCalendarService = new GoogleCalendarService();
    this.calendarRepo = new CalendarRepository();
  }

  /**
   * GET /api/shops/calendar/connect/google
   * Get Google OAuth authorization URL
   */
  connectGoogle = async (req: Request, res: Response): Promise<void> => {
    try {
      const shopId = req.user?.shopId;

      if (!shopId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized - Shop ID not found',
        });
        return;
      }

      // Generate OAuth URL
      const authUrl = await this.googleCalendarService.getAuthorizationUrl(shopId);

      res.status(200).json({
        success: true,
        data: {
          authUrl,
          message: 'Redirect user to this URL to authorize Google Calendar access',
        },
      });
    } catch (error) {
      logger.error('Error in connectGoogle:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate authorization URL',
      });
    }
  };

  /**
   * POST /api/shops/calendar/callback/google
   * Handle OAuth callback from Google
   */
  handleGoogleCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, state } = req.body;
      const shopId = req.user?.shopId || state;

      if (!code || !shopId) {
        res.status(400).json({
          success: false,
          error: 'Missing authorization code or shop ID',
        });
        return;
      }

      // Exchange code for tokens and save connection
      await this.googleCalendarService.handleOAuthCallback(code, shopId);

      res.status(200).json({
        success: true,
        message: 'Google Calendar connected successfully',
      });
    } catch (error) {
      logger.error('Error in handleGoogleCallback:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete Google Calendar connection',
      });
    }
  };

  /**
   * GET /api/shops/calendar/status
   * Get calendar connection status for the shop
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

      // Get all connections for the shop
      const connections = await this.calendarRepo.getShopConnections(shopId);

      // Find active Google connection
      const googleConnection = connections.find(
        conn => conn.provider === 'google' && conn.isActive
      );

      if (!googleConnection) {
        res.status(200).json({
          success: true,
          data: {
            connected: false,
            provider: null,
            email: null,
            lastSync: null,
            syncStatus: null,
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          connected: true,
          provider: googleConnection.provider,
          email: googleConnection.googleAccountEmail,
          lastSync: googleConnection.lastSyncAt,
          syncStatus: googleConnection.lastSyncStatus,
          syncError: googleConnection.syncErrorMessage,
          calendarId: googleConnection.calendarId,
        },
      });
    } catch (error) {
      logger.error('Error in getConnectionStatus:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get calendar connection status',
      });
    }
  };

  /**
   * DELETE /api/shops/calendar/disconnect/:provider
   * Disconnect calendar integration
   */
  disconnectCalendar = async (req: Request, res: Response): Promise<void> => {
    try {
      const shopId = req.user?.shopId;
      const { provider } = req.params;

      if (!shopId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized - Shop ID not found',
        });
        return;
      }

      if (provider !== 'google') {
        res.status(400).json({
          success: false,
          error: 'Invalid provider. Only "google" is supported currently.',
        });
        return;
      }

      // Disconnect calendar
      await this.googleCalendarService.disconnectCalendar(shopId);

      res.status(200).json({
        success: true,
        message: `${provider} calendar disconnected successfully`,
      });
    } catch (error) {
      logger.error('Error in disconnectCalendar:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to disconnect calendar',
      });
    }
  };

  /**
   * POST /api/shops/calendar/test-sync
   * Manually trigger sync for pending orders (for testing)
   */
  testSync = async (req: Request, res: Response): Promise<void> => {
    try {
      const shopId = req.user?.shopId;

      if (!shopId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized - Shop ID not found',
        });
        return;
      }

      // Check if shop has active connection
      const connection = await this.calendarRepo.getActiveConnection(shopId, 'google');

      if (!connection) {
        res.status(400).json({
          success: false,
          error: 'No active calendar connection found',
        });
        return;
      }

      // Get orders needing sync
      const ordersNeedingSync = await this.calendarRepo.getOrdersNeedingSync(shopId);

      if (ordersNeedingSync.length === 0) {
        res.status(200).json({
          success: true,
          message: 'No orders need syncing',
          data: {
            syncedCount: 0,
            failedCount: 0,
          },
        });
        return;
      }

      // Sync each order
      let syncedCount = 0;
      let failedCount = 0;

      for (const order of ordersNeedingSync) {
        try {
          await this.googleCalendarService.createEvent({
            orderId: order.order_id,
            serviceName: order.service_name,
            serviceDescription: order.service_description,
            customerName: order.customer_name,
            customerEmail: order.customer_email,
            customerPhone: order.customer_phone,
            customerAddress: order.customer_address,
            bookingDate: order.booking_date,
            startTime: order.booking_time_slot,
            endTime: order.booking_end_time,
            totalAmount: parseFloat(order.total_amount),
            shopTimezone: 'America/New_York', // TODO: Get from shop settings
          });
          syncedCount++;
        } catch (error) {
          logger.error('Failed to sync order:', {
            orderId: order.order_id,
            error,
          });
          failedCount++;
        }
      }

      res.status(200).json({
        success: true,
        message: `Sync completed: ${syncedCount} succeeded, ${failedCount} failed`,
        data: {
          syncedCount,
          failedCount,
          totalOrders: ordersNeedingSync.length,
        },
      });
    } catch (error) {
      logger.error('Error in testSync:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test sync',
      });
    }
  };

  /**
   * POST /api/shops/calendar/refresh-token
   * Manually refresh access token (for testing)
   */
  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const shopId = req.user?.shopId;

      if (!shopId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized - Shop ID not found',
        });
        return;
      }

      await this.googleCalendarService.refreshAccessToken(shopId);

      res.status(200).json({
        success: true,
        message: 'Access token refreshed successfully',
      });
    } catch (error) {
      logger.error('Error in refreshToken:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to refresh access token',
      });
    }
  };
}
