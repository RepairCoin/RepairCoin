import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../../../middleware/auth';
import { asyncHandler, validateEthereumAddress } from '../../../middleware/errorHandler';
import {
  notificationPreferencesRepository,
  NotificationPreferencesInput
} from '../../../repositories/NotificationPreferencesRepository';
import { logger } from '../../../utils/logger';

const router = Router();

/**
 * GET /api/customers/:address/notification-preferences
 * Get notification preferences for a customer
 */
router.get('/:address/notification-preferences',
  authMiddleware,
  requireRole(['customer', 'admin']),
  validateEthereumAddress('address'),
  asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;
    const userAddress = (req as any).user?.address?.toLowerCase();
    const userRole = (req as any).user?.role;

    // Customers can only view their own preferences
    if (userRole === 'customer' && userAddress !== address.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'You can only view your own notification preferences'
      });
    }

    try {
      const preferences = await notificationPreferencesRepository.getByCustomerAddress(address);

      res.json({
        success: true,
        data: preferences
      });
    } catch (error: any) {
      logger.error('Error fetching notification preferences:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch notification preferences'
      });
    }
  })
);

/**
 * PUT /api/customers/:address/notification-preferences
 * Update notification preferences for a customer
 */
router.put('/:address/notification-preferences',
  authMiddleware,
  requireRole(['customer', 'admin']),
  validateEthereumAddress('address'),
  asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;
    const userAddress = (req as any).user?.address?.toLowerCase();
    const userRole = (req as any).user?.role;

    // Customers can only update their own preferences
    if (userRole === 'customer' && userAddress !== address.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'You can only update your own notification preferences'
      });
    }

    try {
      const {
        emailEnabled,
        smsEnabled,
        inAppEnabled,
        reminder24hEnabled,
        reminder2hEnabled,
        reminder30mEnabled,
        quietHoursEnabled,
        quietHoursStart,
        quietHoursEnd
      } = req.body;

      // Validate at least one notification channel is enabled
      // Only validate if all three channel fields are explicitly provided (full update)
      // This allows partial updates while still enforcing the rule on complete saves
      if (
        emailEnabled !== undefined &&
        smsEnabled !== undefined &&
        inAppEnabled !== undefined
      ) {
        if (!emailEnabled && !smsEnabled && !inAppEnabled) {
          return res.status(400).json({
            success: false,
            error: 'At least one notification channel must be enabled (Email, SMS, or In-App)'
          });
        }
      }

      // Validate quiet hours format if provided
      if (quietHoursStart && !isValidTimeFormat(quietHoursStart)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid quiet hours start time format. Use HH:MM format (e.g., 22:00)'
        });
      }

      if (quietHoursEnd && !isValidTimeFormat(quietHoursEnd)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid quiet hours end time format. Use HH:MM format (e.g., 08:00)'
        });
      }

      const preferencesInput: NotificationPreferencesInput = {
        emailEnabled,
        smsEnabled,
        inAppEnabled,
        reminder24hEnabled,
        reminder2hEnabled,
        reminder30mEnabled,
        quietHoursEnabled,
        quietHoursStart: quietHoursStart || null,
        quietHoursEnd: quietHoursEnd || null
      };

      const preferences = await notificationPreferencesRepository.upsert(address, preferencesInput);

      logger.info('Notification preferences updated:', {
        customerAddress: address.toLowerCase(),
        updatedBy: userAddress
      });

      res.json({
        success: true,
        data: preferences,
        message: 'Notification preferences updated successfully'
      });
    } catch (error: any) {
      logger.error('Error updating notification preferences:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update notification preferences'
      });
    }
  })
);

/**
 * DELETE /api/customers/:address/notification-preferences
 * Reset notification preferences to defaults (admin only)
 */
router.delete('/:address/notification-preferences',
  authMiddleware,
  requireRole(['admin']),
  validateEthereumAddress('address'),
  asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;

    try {
      const deleted = await notificationPreferencesRepository.delete(address);

      if (deleted) {
        logger.info('Notification preferences reset:', { customerAddress: address.toLowerCase() });
        res.json({
          success: true,
          message: 'Notification preferences reset to defaults'
        });
      } else {
        res.json({
          success: true,
          message: 'No preferences found to reset'
        });
      }
    } catch (error: any) {
      logger.error('Error resetting notification preferences:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to reset notification preferences'
      });
    }
  })
);

/**
 * Validate time format (HH:MM)
 */
function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  return timeRegex.test(time);
}

export default router;
