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
      console.log('[CalendarController] 🔄 connectGoogle called');
      console.log('[CalendarController] 👤 req.user:', req.user);

      const shopId = req.user?.shopId;
      console.log('[CalendarController] 🏪 shopId extracted:', shopId);

      if (!shopId) {
        console.error('[CalendarController] ❌ No shopId found in req.user');
        res.status(401).json({
          success: false,
          error: 'Unauthorized - Shop ID not found',
        });
        return;
      }

      // Generate OAuth URL
      console.log('[CalendarController] 📡 Calling googleCalendarService.getAuthorizationUrl with shopId:', shopId);
      const authUrl = await this.googleCalendarService.getAuthorizationUrl(shopId);
      console.log('[CalendarController] 🔗 Authorization URL generated:', authUrl);

      const responsePayload = {
        success: true,
        data: {
          authUrl,
          message: 'Redirect user to this URL to authorize Google Calendar access',
        },
      };
      console.log('[CalendarController] ✅ Sending 200 response:', responsePayload);

      res.status(200).json(responsePayload);
    } catch (error) {
      console.error('[CalendarController] ❌ Error in connectGoogle:', {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: typeof error
      });
      logger.error('Error in connectGoogle:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate authorization URL',
      });
    }
  };

  /**
   * GET/POST /api/shops/calendar/callback/google
   * Handle OAuth callback from Google
   * Accepts both GET (from Google redirect) and POST (from frontend)
   */
  handleGoogleCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      console.log('[CalendarController] 🔄 handleGoogleCallback called');
      console.log('[CalendarController] 📥 Request method:', req.method);
      console.log('[CalendarController] 📥 Query params:', req.query);
      console.log('[CalendarController] 📥 Body params:', req.body);

      // Support both GET (query params) and POST (body params)
      const code = req.method === 'GET' ? (req.query.code as string) : req.body.code;
      const state = req.method === 'GET' ? (req.query.state as string) : req.body.state;

      // shopId comes from state parameter (set during authorization URL generation)
      const shopId = state;

      console.log('[CalendarController] 📋 Extracted params:', { code: code?.substring(0, 20) + '...', state, shopId });

      if (!code || !shopId) {
        console.error('[CalendarController] ❌ Missing required params:', { hasCode: !!code, hasShopId: !!shopId });
        res.status(400).json({
          success: false,
          error: 'Missing authorization code or shop ID',
        });
        return;
      }

      console.log('[CalendarController] 📡 Calling googleCalendarService.handleOAuthCallback...');
      // Exchange code for tokens and save connection
      await this.googleCalendarService.handleOAuthCallback(code, shopId);

      console.log('[CalendarController] ✅ OAuth callback completed successfully');

      // For GET requests (from Google), redirect to frontend callback page
      if (req.method === 'GET') {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        const redirectUrl = `${frontendUrl}/shop/calendar/callback?success=true`;
        console.log('[CalendarController] 🔀 Redirecting to frontend:', redirectUrl);
        res.redirect(redirectUrl);
        return;
      }

      // For POST requests (from frontend), return JSON
      res.status(200).json({
        success: true,
        message: 'Google Calendar connected successfully',
      });
    } catch (error) {
      console.error('[CalendarController] ❌ Error in handleGoogleCallback:', {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      });
      logger.error('Error in handleGoogleCallback:', error);

      // For GET requests, redirect to callback page with error
      if (req.method === 'GET') {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        const errorMessage = error instanceof Error ? error.message : 'Connection failed';
        const redirectUrl = `${frontendUrl}/shop/calendar/callback?error=${encodeURIComponent(errorMessage)}`;
        res.redirect(redirectUrl);
        return;
      }

      // For POST requests, return JSON error
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
