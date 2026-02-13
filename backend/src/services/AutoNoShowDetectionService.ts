// backend/src/services/AutoNoShowDetectionService.ts
import { logger } from '../utils/logger';
import { EmailService } from './EmailService';
import { NotificationService } from '../domains/notification/services/NotificationService';
import { NoShowPolicyService } from './NoShowPolicyService';
import { OrderRepository } from '../repositories/OrderRepository';
import { ShopRepository } from '../repositories/ShopRepository';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { ServiceRepository } from '../repositories/ServiceRepository';
import { getSharedPool } from '../utils/database-pool';
import { shopRepository, customerRepository } from '../repositories';

export interface AutoDetectionReport {
  timestamp: Date;
  ordersChecked: number;
  ordersMarked: number;
  customerNotificationsSent: number;
  shopNotificationsSent: number;
  emailsSent: number;
  errors: string[];
  shopsProcessed: string[];
}

export interface EligibleOrder {
  orderId: string;
  customerAddress: string;
  customerEmail?: string;
  customerName?: string;
  shopId: string;
  shopName: string;
  shopEmail?: string;
  serviceId: string;
  serviceName: string;
  bookingDate: Date;
  bookingTimeSlot: string;
  totalAmount: number;
  gracePeriodMinutes: number;
  autoDetectionDelayHours: number;
}

export class AutoNoShowDetectionService {
  private emailService: EmailService;
  private notificationService: NotificationService;
  private noShowPolicyService: NoShowPolicyService;
  private orderRepository: OrderRepository;
  private shopRepository: ShopRepository;
  private customerRepository: CustomerRepository;
  private serviceRepository: ServiceRepository;
  private scheduledIntervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.emailService = new EmailService();
    this.notificationService = new NotificationService();
    this.noShowPolicyService = new NoShowPolicyService();
    this.orderRepository = new OrderRepository();
    this.shopRepository = new ShopRepository();
    this.customerRepository = new CustomerRepository();
    this.serviceRepository = new ServiceRepository();
  }

  /**
   * Get orders eligible for automatic no-show detection
   *
   * Criteria:
   * - Status is 'paid' or 'confirmed'
   * - Has booking date and time
   * - Not already marked as no-show
   * - Not completed
   * - Appointment time + grace period + detection delay has passed
   * - Shop has auto-detection enabled
   */
  async getEligibleOrders(): Promise<EligibleOrder[]> {
    try {
      const query = `
        SELECT
          so.order_id as "orderId",
          so.customer_address as "customerAddress",
          c.email as "customerEmail",
          c.name as "customerName",
          so.shop_id as "shopId",
          s.name as "shopName",
          s.email as "shopEmail",
          so.service_id as "serviceId",
          ss.service_name as "serviceName",
          so.booking_date as "bookingDate",
          COALESCE(so.booking_time_slot, so.booking_time) as "bookingTimeSlot",
          so.total_amount as "totalAmount",
          COALESCE(nsp.grace_period_minutes, 15) as "gracePeriodMinutes",
          COALESCE(nsp.auto_detection_delay_hours, 2) as "autoDetectionDelayHours"
        FROM service_orders so
        JOIN customers c ON LOWER(c.wallet_address) = LOWER(so.customer_address)
        JOIN shops s ON s.shop_id = so.shop_id
        JOIN shop_services ss ON ss.service_id = so.service_id
        LEFT JOIN no_show_policies nsp ON nsp.shop_id = so.shop_id
        WHERE so.status IN ('paid', 'confirmed')
          AND so.booking_date IS NOT NULL
          AND COALESCE(so.booking_time_slot, so.booking_time) IS NOT NULL
          AND COALESCE(so.no_show, false) IS NOT TRUE
          AND so.completed_at IS NULL
          AND COALESCE(nsp.enabled, true) IS TRUE
          AND COALESCE(nsp.auto_detection_enabled, true) IS TRUE
          AND (
            -- Check if appointment time + grace period + detection delay has passed
            (so.booking_date + COALESCE(so.booking_time_slot, so.booking_time)::time +
             (COALESCE(nsp.grace_period_minutes, 15) || ' minutes')::interval +
             (COALESCE(nsp.auto_detection_delay_hours, 2) || ' hours')::interval
            ) < NOW()
          )
        ORDER BY so.booking_date, COALESCE(so.booking_time_slot, so.booking_time)
      `;

      const result = await getSharedPool().query(query);
      logger.info(`Found ${result.rows.length} orders eligible for auto no-show detection`);
      return result.rows as EligibleOrder[];
    } catch (error) {
      logger.error('Error getting eligible orders for auto no-show detection:', error);
      throw error;
    }
  }

  /**
   * Process a single order and mark it as no-show
   */
  async processOrder(order: EligibleOrder): Promise<boolean> {
    try {
      logger.info(`Processing auto no-show for order ${order.orderId}`, {
        customerAddress: order.customerAddress,
        shopId: order.shopId,
        scheduledTime: order.bookingDate
      });

      // Mark as no-show in orders table
      await this.orderRepository.markAsNoShow(order.orderId, 'Automatically marked as no-show by system');

      // Record in no-show history with SYSTEM as marker
      try {
        await this.noShowPolicyService.recordNoShowHistory({
          customerAddress: order.customerAddress,
          orderId: order.orderId,
          serviceId: order.serviceId,
          shopId: order.shopId,
          scheduledTime: order.bookingDate,
          markedBy: 'SYSTEM',
          notes: 'Automatically marked as no-show by system'
        });
        logger.info(`No-show recorded in history for customer ${order.customerAddress}`);
      } catch (historyError) {
        logger.error('Failed to record no-show history:', historyError);
        // Continue - don't fail the entire operation
      }

      // Get updated customer status
      let customerStatus;
      try {
        customerStatus = await this.noShowPolicyService.getCustomerStatus(
          order.customerAddress,
          order.shopId
        );
      } catch (statusError) {
        logger.error('Failed to get customer status:', statusError);
      }

      // Send notification to customer
      try {
        const notificationMessage = customerStatus
          ? `You were automatically marked as no-show for: ${order.serviceName} at ${order.shopName}. Your account is now at tier ${customerStatus.tier.toUpperCase()} with ${customerStatus.noShowCount} total no-shows.`
          : `You were automatically marked as no-show for: ${order.serviceName} at ${order.shopName}`;

        await this.notificationService.createNotification({
          senderAddress: 'SYSTEM',
          receiverAddress: order.customerAddress,
          notificationType: 'service_no_show',
          message: notificationMessage,
          metadata: {
            orderId: order.orderId,
            serviceName: order.serviceName,
            shopName: order.shopName,
            autoDetected: true,
            tier: customerStatus?.tier,
            noShowCount: customerStatus?.noShowCount,
            restrictions: customerStatus?.restrictions,
            timestamp: new Date().toISOString()
          }
        });
        logger.info(`Sent no-show notification to customer ${order.customerAddress}`);
      } catch (notifError) {
        logger.error('Failed to send customer notification:', notifError);
      }

      // Send notification to shop
      try {
        await this.notificationService.createNotification({
          senderAddress: 'SYSTEM',
          receiverAddress: order.shopId,
          notificationType: 'shop_no_show_auto_detected',
          message: `Customer ${order.customerName || order.customerAddress} was automatically marked as no-show for ${order.serviceName}.`,
          metadata: {
            orderId: order.orderId,
            customerAddress: order.customerAddress,
            customerName: order.customerName,
            serviceName: order.serviceName,
            autoDetected: true,
            timestamp: new Date().toISOString()
          }
        });
        logger.info(`Sent auto-detection notification to shop ${order.shopId}`);
      } catch (shopNotifError) {
        logger.error('Failed to send shop notification:', shopNotifError);
      }

      // Send tier-based email notification to customer
      try {
        if (customerStatus && order.customerEmail) {
          const policy = await this.noShowPolicyService.getShopPolicy(order.shopId);

          const appointmentDate = new Date(order.bookingDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          // Send tier-specific email based on current tier
          switch (customerStatus.tier) {
            case 'warning':
              if (policy.sendEmailTier1) {
                await this.emailService.sendNoShowTier1Warning({
                  customerEmail: order.customerEmail,
                  customerName: order.customerName || 'Customer',
                  shopName: order.shopName,
                  serviceName: order.serviceName,
                  appointmentDate,
                  noShowCount: customerStatus.noShowCount
                });
                logger.info(`Sent Tier 1 warning email to ${order.customerEmail}`);
              }
              break;

            case 'caution':
              if (policy.sendEmailTier2) {
                await this.emailService.sendNoShowTier2Caution({
                  customerEmail: order.customerEmail,
                  customerName: order.customerName || 'Customer',
                  shopName: order.shopName,
                  serviceName: order.serviceName,
                  appointmentDate,
                  noShowCount: customerStatus.noShowCount,
                  minimumAdvanceHours: policy.cautionAdvanceBookingHours
                });
                logger.info(`Sent Tier 2 caution email to ${order.customerEmail}`);
              }
              break;

            case 'deposit_required':
              if (policy.sendEmailTier3) {
                await this.emailService.sendNoShowTier3DepositRequired({
                  customerEmail: order.customerEmail,
                  customerName: order.customerName || 'Customer',
                  shopName: order.shopName,
                  serviceName: order.serviceName,
                  appointmentDate,
                  noShowCount: customerStatus.noShowCount,
                  depositAmount: policy.depositAmount,
                  minimumAdvanceHours: policy.depositAdvanceBookingHours,
                  maxRcnRedemptionPercent: policy.maxRcnRedemptionPercent,
                  resetAfterSuccessful: policy.depositResetAfterSuccessful
                });
                logger.info(`Sent Tier 3 deposit required email to ${order.customerEmail}`);
              }
              break;

            case 'suspended':
              if (policy.sendEmailTier4 && customerStatus.bookingSuspendedUntil) {
                await this.emailService.sendNoShowTier4Suspended({
                  customerEmail: order.customerEmail,
                  customerName: order.customerName || 'Customer',
                  shopName: order.shopName,
                  serviceName: order.serviceName,
                  appointmentDate,
                  noShowCount: customerStatus.noShowCount,
                  suspensionEndDate: new Date(customerStatus.bookingSuspendedUntil).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }),
                  suspensionDays: policy.suspensionDurationDays
                });
                logger.info(`Sent Tier 4 suspension email to ${order.customerEmail}`);
              }
              break;
          }
        }
      } catch (emailError) {
        logger.error('Failed to send tier-based email notification:', emailError);
        // Don't fail the operation if email fails
      }

      // Note: Shop receives in-app notification above
      // Email notification to shop could be added via EmailService.sendShopNotification() method in the future

      return true;
    } catch (error) {
      logger.error(`Error processing auto no-show for order ${order.orderId}:`, error);
      return false;
    }
  }

  /**
   * Run the auto-detection check
   */
  async runDetection(): Promise<AutoDetectionReport> {
    const report: AutoDetectionReport = {
      timestamp: new Date(),
      ordersChecked: 0,
      ordersMarked: 0,
      customerNotificationsSent: 0,
      shopNotificationsSent: 0,
      emailsSent: 0,
      errors: [],
      shopsProcessed: []
    };

    try {
      logger.info('Starting auto no-show detection run...');

      // Get eligible orders
      const eligibleOrders = await this.getEligibleOrders();
      report.ordersChecked = eligibleOrders.length;

      if (eligibleOrders.length === 0) {
        logger.info('No orders eligible for auto no-show detection');
        return report;
      }

      // Process each order
      for (const order of eligibleOrders) {
        try {
          const success = await this.processOrder(order);

          if (success) {
            report.ordersMarked++;
            report.customerNotificationsSent++;
            report.shopNotificationsSent++;
            report.emailsSent += 2; // Customer email + shop email

            if (!report.shopsProcessed.includes(order.shopId)) {
              report.shopsProcessed.push(order.shopId);
            }
          }
        } catch (orderError) {
          const errorMsg = `Failed to process order ${order.orderId}: ${orderError instanceof Error ? orderError.message : String(orderError)}`;
          logger.error(errorMsg);
          report.errors.push(errorMsg);
        }
      }

      logger.info('Auto no-show detection run completed', {
        ordersChecked: report.ordersChecked,
        ordersMarked: report.ordersMarked,
        shopsProcessed: report.shopsProcessed.length
      });

    } catch (error) {
      const errorMsg = `Critical error in auto no-show detection: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      report.errors.push(errorMsg);
    }

    return report;
  }

  /**
   * Start the scheduled auto-detection service
   * Runs every 30 minutes
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Auto no-show detection service is already running');
      return;
    }

    logger.info('Starting auto no-show detection service...');
    this.isRunning = true;

    // Run immediately on start
    this.runDetection().catch(error => {
      logger.error('Error in initial auto no-show detection run:', error);
    });

    // Schedule to run every 30 minutes
    const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
    this.scheduledIntervalId = setInterval(async () => {
      try {
        await this.runDetection();
      } catch (error) {
        logger.error('Error in scheduled auto no-show detection run:', error);
      }
    }, INTERVAL_MS);

    logger.info(`Auto no-show detection service started. Running every 30 minutes.`);
  }

  /**
   * Stop the scheduled auto-detection service
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Auto no-show detection service is not running');
      return;
    }

    if (this.scheduledIntervalId) {
      clearInterval(this.scheduledIntervalId);
      this.scheduledIntervalId = null;
    }

    this.isRunning = false;
    logger.info('Auto no-show detection service stopped');
  }

  /**
   * Get service status
   */
  getStatus(): { isRunning: boolean; nextRunEstimate?: Date } {
    return {
      isRunning: this.isRunning,
      nextRunEstimate: this.isRunning
        ? new Date(Date.now() + 30 * 60 * 1000)
        : undefined
    };
  }
}

// Export singleton instance
let autoNoShowDetectionServiceInstance: AutoNoShowDetectionService | null = null;

export const getAutoNoShowDetectionService = (): AutoNoShowDetectionService => {
  if (!autoNoShowDetectionServiceInstance) {
    autoNoShowDetectionServiceInstance = new AutoNoShowDetectionService();
  }
  return autoNoShowDetectionServiceInstance;
};
