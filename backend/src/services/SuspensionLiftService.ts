// backend/src/services/SuspensionLiftService.ts
import { logger } from '../utils/logger';
import { NotificationService } from '../domains/notification/services/NotificationService';
import { getSharedPool } from '../utils/database-pool';

export interface SuspensionLiftReport {
  timestamp: Date;
  customersLifted: number;
  notificationsSent: number;
  errors: string[];
}

interface LiftedCustomerRow {
  address: string;
  no_show_count: number;
  no_show_tier: string;
}

export class SuspensionLiftService {
  private notificationService: NotificationService;
  private scheduledIntervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastRunAt: Date | null = null;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Find customers whose suspension has expired, downgrade them to the
   * appropriate tier, and notify them. The UPDATE is atomic and idempotent —
   * running it twice in a row produces zero rows on the second run.
   *
   * Tier cascade after lift (default thresholds from NoShowPolicyService.getDefaultPolicy):
   *   no_show_count >= 3 → deposit_required
   *   no_show_count = 2  → caution
   *   no_show_count = 1  → warning
   *   no_show_count = 0  → normal
   */
  async processSuspensionLifts(): Promise<SuspensionLiftReport> {
    const report: SuspensionLiftReport = {
      timestamp: new Date(),
      customersLifted: 0,
      notificationsSent: 0,
      errors: []
    };

    try {
      const result = await getSharedPool().query<LiftedCustomerRow>(`
        UPDATE customers
        SET
          no_show_tier = CASE
            WHEN no_show_count >= 3 THEN 'deposit_required'
            WHEN no_show_count >= 2 THEN 'caution'
            WHEN no_show_count = 1 THEN 'warning'
            ELSE 'normal'
          END,
          deposit_required = (no_show_count >= 3),
          booking_suspended_until = NULL,
          successful_appointments_since_tier3 = 0,
          updated_at = NOW()
        WHERE no_show_tier = 'suspended'
          AND booking_suspended_until IS NOT NULL
          AND booking_suspended_until <= NOW()
        RETURNING address, no_show_count, no_show_tier
      `);

      report.customersLifted = result.rows.length;

      if (report.customersLifted === 0) {
        return report;
      }

      logger.info(`Lifted ${report.customersLifted} no-show suspension(s)`);

      for (const row of result.rows) {
        try {
          const message = this.notificationService.buildMessage('suspension_lifted', {
            newTier: row.no_show_tier
          });
          await this.notificationService.createNotification({
            senderAddress: 'SYSTEM',
            receiverAddress: row.address,
            notificationType: 'suspension_lifted',
            message,
            metadata: {
              previousTier: 'suspended',
              newTier: row.no_show_tier,
              noShowCount: row.no_show_count,
              depositRequired: row.no_show_tier === 'deposit_required'
            }
          });
          report.notificationsSent += 1;
        } catch (notifError: any) {
          const errMsg = `Failed to notify ${row.address} of suspension lift: ${notifError?.message ?? notifError}`;
          logger.error(errMsg, notifError);
          report.errors.push(errMsg);
        }
      }
    } catch (error: any) {
      const errMsg = `Suspension lift query failed: ${error?.message ?? error}`;
      logger.error(errMsg, error);
      report.errors.push(errMsg);
    }

    this.lastRunAt = report.timestamp;
    return report;
  }

  /**
   * Start the scheduled suspension-lift service. Runs once immediately, then
   * every 15 minutes. Suspension deadlines are not cron-aligned, so a
   * sub-hour interval keeps the reconciliation lag small.
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Suspension lift service is already running');
      return;
    }

    logger.info('Starting suspension lift service...');
    this.isRunning = true;

    this.processSuspensionLifts().catch(error => {
      logger.error('Error in initial suspension lift run:', error);
    });

    const INTERVAL_MS = 15 * 60 * 1000;
    this.scheduledIntervalId = setInterval(async () => {
      try {
        await this.processSuspensionLifts();
      } catch (error) {
        logger.error('Error in scheduled suspension lift run:', error);
      }
    }, INTERVAL_MS);

    logger.info('Suspension lift service started. Running every 15 minutes.');
  }

  stop(): void {
    if (!this.isRunning) {
      logger.warn('Suspension lift service is not running');
      return;
    }

    if (this.scheduledIntervalId) {
      clearInterval(this.scheduledIntervalId);
      this.scheduledIntervalId = null;
    }

    this.isRunning = false;
    logger.info('Suspension lift service stopped');
  }

  getStatus(): { isRunning: boolean; lastRunAt?: Date; nextRunEstimate?: Date } {
    const INTERVAL_MS = 15 * 60 * 1000;
    if (!this.isRunning) {
      return { isRunning: false };
    }
    return {
      isRunning: true,
      lastRunAt: this.lastRunAt ?? undefined,
      nextRunEstimate: this.lastRunAt
        ? new Date(this.lastRunAt.getTime() + INTERVAL_MS)
        : undefined
    };
  }
}

let suspensionLiftServiceInstance: SuspensionLiftService | null = null;

export const getSuspensionLiftService = (): SuspensionLiftService => {
  if (!suspensionLiftServiceInstance) {
    suspensionLiftServiceInstance = new SuspensionLiftService();
  }
  return suspensionLiftServiceInstance;
};
