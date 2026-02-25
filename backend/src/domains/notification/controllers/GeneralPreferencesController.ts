import { Request, Response } from 'express';
import {
  generalNotificationPreferencesRepository,
  UpdatePreferencesParams
} from '../../../repositories/GeneralNotificationPreferencesRepository';
import { logger } from '../../../utils/logger';

export class GeneralPreferencesController {
  /**
   * GET /api/notifications/preferences/general
   * Get general notification preferences for authenticated user
   */
  async getPreferences(req: Request, res: Response): Promise<void> {
    try {
      const walletAddress = req.user?.address;
      const userRole = req.user?.role;

      if (!walletAddress || !userRole) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Map role to user type
      const userType = userRole === 'customer' ? 'customer' :
                       userRole === 'shop' ? 'shop' :
                       userRole === 'admin' ? 'admin' : 'customer';

      // Get or create default preferences
      const preferences = await generalNotificationPreferencesRepository.getOrCreatePreferences(
        walletAddress,
        userType
      );

      res.json({
        success: true,
        data: preferences
      });
    } catch (error: any) {
      logger.error('Error fetching general notification preferences:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch notification preferences'
      });
    }
  }

  /**
   * PUT /api/notifications/preferences/general
   * Update general notification preferences
   */
  async updatePreferences(req: Request, res: Response): Promise<void> {
    try {
      const walletAddress = req.user?.address;
      const userRole = req.user?.role;

      if (!walletAddress || !userRole) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Map role to user type
      const userType = userRole === 'customer' ? 'customer' :
                       userRole === 'shop' ? 'shop' :
                       userRole === 'admin' ? 'admin' : 'customer';

      const updates: UpdatePreferencesParams = req.body;

      // Validate that only valid fields are being updated
      const validFields = [
        'platformUpdates', 'maintenanceAlerts', 'newFeatures',
        'securityAlerts', 'loginNotifications', 'passwordChanges',
        'tokenReceived', 'tokenRedeemed', 'rewardsEarned',
        'orderUpdates', 'serviceApproved', 'reviewRequests',
        'newOrders', 'customerMessages', 'lowTokenBalance', 'subscriptionReminders',
        'systemAlerts', 'userReports', 'treasuryChanges',
        'promotions', 'newsletter', 'surveys'
      ];

      const hasInvalidFields = Object.keys(updates).some(
        key => !validFields.includes(key)
      );

      if (hasInvalidFields) {
        res.status(400).json({
          success: false,
          error: 'Invalid preference field(s) provided'
        });
        return;
      }

      // Update preferences
      const preferences = await generalNotificationPreferencesRepository.updatePreferences(
        walletAddress,
        userType,
        updates
      );

      logger.info('General notification preferences updated:', {
        walletAddress,
        userType,
        updatedFields: Object.keys(updates)
      });

      res.json({
        success: true,
        data: preferences,
        message: 'Notification preferences updated successfully'
      });
    } catch (error: any) {
      logger.error('Error updating general notification preferences:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update notification preferences'
      });
    }
  }

  /**
   * POST /api/notifications/preferences/general/reset
   * Reset to default preferences
   */
  async resetToDefaults(req: Request, res: Response): Promise<void> {
    try {
      const walletAddress = req.user?.address;
      const userRole = req.user?.role;

      if (!walletAddress || !userRole) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Map role to user type
      const userType = userRole === 'customer' ? 'customer' :
                       userRole === 'shop' ? 'shop' :
                       userRole === 'admin' ? 'admin' : 'customer';

      // Create new default preferences (will replace existing)
      const preferences = await generalNotificationPreferencesRepository.createDefaultPreferences(
        walletAddress,
        userType
      );

      logger.info('General notification preferences reset to defaults:', {
        walletAddress,
        userType
      });

      res.json({
        success: true,
        data: preferences,
        message: 'Notification preferences reset to defaults'
      });
    } catch (error: any) {
      logger.error('Error resetting general notification preferences:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to reset notification preferences'
      });
    }
  }
}
