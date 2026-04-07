// backend/src/domains/ServiceDomain/controllers/EmailPreferencesController.ts
import { Request, Response } from 'express';
import { EmailPreferencesService, EmailPreferences } from '../../../services/EmailPreferencesService';
import { logger } from '../../../utils/logger';

export class EmailPreferencesController {
  private emailPreferencesService: EmailPreferencesService;

  constructor() {
    this.emailPreferencesService = new EmailPreferencesService();
  }

  /**
   * GET /api/services/shops/:shopId/email-preferences
   * Get shop's email notification preferences
   */
  async getShopPreferences(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;

      // Authorization: Only shop owner or admin can view preferences
      const userAddress = req.user?.address?.toLowerCase();
      const userRole = req.user?.role;

      if (userRole !== 'admin') {
        // Verify shop ownership
        const { shopRepository } = await import('../../../repositories');
        const shop = await shopRepository.getShop(shopId);

        if (!shop) {
          res.status(404).json({
            success: false,
            error: 'Shop not found'
          });
          return;
        }

        if (shop.walletAddress.toLowerCase() !== userAddress) {
          res.status(403).json({
            success: false,
            error: 'Unauthorized: You can only view your own email preferences'
          });
          return;
        }
      }

      const preferences = await this.emailPreferencesService.getShopPreferences(shopId);

      logger.info('Shop email preferences retrieved', {
        shopId,
        requestedBy: userAddress
      });

      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      console.error('❌ [EmailPreferences] ERROR:', error);
      console.error('❌ [EmailPreferences] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

      logger.error('Error getting shop email preferences', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        shopId: req.params.shopId
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get email preferences'
      });
    }
  }

  /**
   * PUT /api/services/shops/:shopId/email-preferences
   * Update shop's email notification preferences
   */
  async updateShopPreferences(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const preferencesUpdates: Partial<EmailPreferences> = req.body;

      // Authorization: Only shop owner or admin can update preferences
      const userAddress = req.user?.address?.toLowerCase();
      const userRole = req.user?.role;

      if (userRole !== 'admin') {
        // Verify shop ownership
        const { shopRepository } = await import('../../../repositories');
        const shop = await shopRepository.getShop(shopId);

        if (!shop) {
          res.status(404).json({
            success: false,
            error: 'Shop not found'
          });
          return;
        }

        if (shop.walletAddress.toLowerCase() !== userAddress) {
          res.status(403).json({
            success: false,
            error: 'Unauthorized: You can only update your own email preferences'
          });
          return;
        }
      }

      // Validate preferences updates
      const validationError = this.validatePreferencesUpdates(preferencesUpdates);
      if (validationError) {
        res.status(400).json({
          success: false,
          error: validationError
        });
        return;
      }

      // Don't allow updating shopId through this endpoint
      delete preferencesUpdates.shopId;

      const updatedPreferences = await this.emailPreferencesService.updateShopPreferences(
        shopId,
        preferencesUpdates
      );

      logger.info('Shop email preferences updated', {
        shopId,
        updatedBy: userAddress,
        changes: Object.keys(preferencesUpdates)
      });

      res.json({
        success: true,
        data: updatedPreferences,
        message: 'Email preferences updated successfully'
      });
    } catch (error) {
      logger.error('Error updating shop email preferences', {
        error: error instanceof Error ? error.message : String(error),
        shopId: req.params.shopId
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update email preferences'
      });
    }
  }

  /**
   * Validate preference update values
   */
  private validatePreferencesUpdates(preferences: Partial<EmailPreferences>): string | null {
    // Validate digest time
    if (preferences.digestTime !== undefined) {
      const validTimes = ['morning', 'afternoon', 'evening'];
      if (!validTimes.includes(preferences.digestTime)) {
        return `Digest time must be one of: ${validTimes.join(', ')}`;
      }
    }

    // Validate weekly report day
    if (preferences.weeklyReportDay !== undefined) {
      const validDays = ['monday', 'friday'];
      if (!validDays.includes(preferences.weeklyReportDay)) {
        return `Weekly report day must be one of: ${validDays.join(', ')}`;
      }
    }

    // Validate monthly report day
    if (preferences.monthlyReportDay !== undefined) {
      if (
        !Number.isInteger(preferences.monthlyReportDay) ||
        preferences.monthlyReportDay < 1 ||
        preferences.monthlyReportDay > 28
      ) {
        return 'Monthly report day must be an integer between 1 and 28';
      }
    }

    // Validate boolean fields
    const booleanFields: (keyof EmailPreferences)[] = [
      'newBooking',
      'bookingCancellation',
      'bookingReschedule',
      'appointmentReminder',
      'noShowAlert',
      'newCustomer',
      'customerReview',
      'customerMessage',
      'paymentReceived',
      'refundProcessed',
      'subscriptionRenewal',
      'subscriptionExpiring',
      'marketingUpdates',
      'featureAnnouncements',
      'platformNews',
      'dailyDigest',
      'weeklyReport',
      'monthlyReport'
    ];

    for (const field of booleanFields) {
      const value = preferences[field];
      if (value !== undefined && typeof value !== 'boolean') {
        return `Field "${field}" must be a boolean value`;
      }
    }

    return null;
  }
}

export default new EmailPreferencesController();
