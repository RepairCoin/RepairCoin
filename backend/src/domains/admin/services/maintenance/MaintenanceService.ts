// backend/src/domains/admin/services/maintenance/MaintenanceService.ts
import { webhookRepository } from '../../../../repositories';
import { cleanupService } from '../../../../services/CleanupService';
import { logger } from '../../../../utils/logger';

/**
 * MaintenanceService
 * Handles system maintenance operations like cleanup and archiving
 * Extracted from AdminService for better organization
 */
export class MaintenanceService {

  async getFailedWebhooks(limit: number = 20) {
    try {
      const failedWebhooks = await webhookRepository.getFailedWebhooks(limit);

      return {
        webhooks: failedWebhooks,
        count: failedWebhooks.length
      };
    } catch (error) {
      logger.error('Error getting failed webhooks:', error);
      throw new Error('Failed to retrieve failed webhooks');
    }
  }

  async cleanupWebhookLogs(daysOld: number = 30) {
    try {
      logger.info('Webhook cleanup requested', { daysOld });

      // Use CleanupService to clean up old webhook logs
      const deletedCount = await cleanupService.cleanupWebhookLogs(daysOld);

      logger.info('Webhook cleanup completed', { daysOld, deletedCount });

      return {
        success: true,
        message: `Webhook logs older than ${daysOld} days cleaned up`,
        deletedCount
      };
    } catch (error) {
      logger.error('Webhook cleanup error:', error);
      throw new Error('Failed to cleanup webhook logs');
    }
  }

  async archiveTransactions(daysOld: number = 365) {
    try {
      logger.info('Transaction archiving requested', { daysOld });

      // Use CleanupService to archive old transactions
      const archivedCount = await cleanupService.archiveOldTransactions(daysOld);

      logger.info('Transaction archiving completed', { daysOld, archivedCount });

      return {
        success: true,
        message: `Transactions older than ${daysOld} days archived`,
        archivedCount
      };
    } catch (error) {
      logger.error('Transaction archiving error:', error);
      throw new Error('Failed to archive transactions');
    }
  }
}

// Export singleton instance
export const maintenanceService = new MaintenanceService();
