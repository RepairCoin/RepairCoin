// backend/src/services/AppointmentReminderService.ts
import { logger } from '../utils/logger';
import { EmailService } from './EmailService';
import { NotificationService } from '../domains/notification/services/NotificationService';
import { getExpoPushService, ExpoPushService } from './ExpoPushService';
import { OrderRepository } from '../repositories/OrderRepository';
import { ShopRepository } from '../repositories/ShopRepository';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { ServiceRepository } from '../repositories/ServiceRepository';
import { getSharedPool } from '../utils/database-pool';
import { notificationPreferencesRepository } from '../repositories/NotificationPreferencesRepository';

export interface AppointmentReminderData {
  orderId: string;
  customerAddress: string;
  customerEmail?: string;
  customerName?: string;
  shopId: string;
  shopName: string;
  shopEmail?: string;
  serviceName: string;
  bookingDate: Date;
  bookingTimeSlot: string;
  totalAmount: number;
}

export interface ReminderReport {
  timestamp: Date;
  remindersChecked: number;
  customerRemindersSent: number;
  shopNotificationsSent: number;
  emailsSent: number;
  emailsFailed: number;  // Track emails that failed after all retries
  inAppNotificationsSent: number;
  pushNotificationsSent: number;
  errors: string[];
  // New fields for multi-reminder tracking
  reminder24hSent?: number;
  reminder2hSent?: number;
  // Tracking for skipped reminders
  skippedByPreference?: number;
  skippedByQuietHours?: number;
}

// Reminder type configuration
type ReminderType = '24h' | '2h';

interface ReminderConfig {
  type: ReminderType;
  hoursBeforeMin: number;
  hoursBeforeMax: number;
  sendEmail: boolean;
  sendInApp: boolean;
  sendShopNotification: boolean;
  flagColumn: string;
  timestampColumn: string;
}

const REMINDER_CONFIGS: ReminderConfig[] = [
  {
    type: '24h',
    hoursBeforeMin: 23,
    hoursBeforeMax: 25,
    sendEmail: true,
    sendInApp: true,
    sendShopNotification: true,
    flagColumn: 'reminder_24h_sent',
    timestampColumn: 'reminder_24h_sent_at'
  },
  {
    type: '2h',
    hoursBeforeMin: 1.5,  // 1.5 hours = 90 minutes
    hoursBeforeMax: 2.5,  // 2.5 hours = 150 minutes
    sendEmail: false,     // Only in-app for 2h reminder
    sendInApp: true,
    sendShopNotification: true,
    flagColumn: 'reminder_2h_sent',
    timestampColumn: 'reminder_2h_sent_at'
  }
];

// Email retry configuration
const EMAIL_RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 1000,  // 1 second
  maxDelayMs: 5000,      // 5 seconds max
  backoffMultiplier: 2   // Exponential backoff
};

export class AppointmentReminderService {
  private emailService: EmailService;
  private notificationService: NotificationService;
  private expoPushService: ExpoPushService;
  private orderRepository: OrderRepository;
  private shopRepository: ShopRepository;
  private customerRepository: CustomerRepository;
  private serviceRepository: ServiceRepository;
  private scheduledIntervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.emailService = new EmailService();
    this.notificationService = new NotificationService();
    this.expoPushService = getExpoPushService();
    this.orderRepository = new OrderRepository();
    this.shopRepository = new ShopRepository();
    this.customerRepository = new CustomerRepository();
    this.serviceRepository = new ServiceRepository();
  }

  /**
   * Get appointments that need a specific type of reminder
   */
  async getAppointmentsForReminderType(config: ReminderConfig): Promise<AppointmentReminderData[]> {
    try {
      // Convert hours to interval strings for PostgreSQL
      const minInterval = `${config.hoursBeforeMin} hours`;
      const maxInterval = `${config.hoursBeforeMax} hours`;

      const query = `
        SELECT
          so.order_id as "orderId",
          so.customer_address as "customerAddress",
          c.email as "customerEmail",
          c.name as "customerName",
          so.shop_id as "shopId",
          s.name as "shopName",
          s.email as "shopEmail",
          ss.service_name as "serviceName",
          so.booking_date as "bookingDate",
          COALESCE(so.booking_time_slot, so.booking_time) as "bookingTimeSlot",
          so.total_amount as "totalAmount"
        FROM service_orders so
        JOIN customers c ON LOWER(c.wallet_address) = LOWER(so.customer_address)
        JOIN shops s ON s.shop_id = so.shop_id
        JOIN shop_services ss ON ss.service_id = so.service_id
        WHERE so.status IN ('paid', 'confirmed')
          AND so.booking_date IS NOT NULL
          AND COALESCE(so.booking_time_slot, so.booking_time) IS NOT NULL
          AND COALESCE(so.${config.flagColumn}, false) IS NOT TRUE
          AND (
            -- Calculate appointment datetime and check if it's within the reminder window
            (so.booking_date + COALESCE(so.booking_time_slot, so.booking_time)::time)
            BETWEEN NOW() + INTERVAL '${minInterval}'
            AND NOW() + INTERVAL '${maxInterval}'
          )
        ORDER BY so.booking_date, COALESCE(so.booking_time_slot, so.booking_time)
      `;

      const result = await getSharedPool().query(query);
      return result.rows;
    } catch (error) {
      logger.error(`Error getting appointments for ${config.type} reminder:`, error);
      throw error;
    }
  }

  /**
   * Get appointments that need reminders (24 hours before) - Legacy method for backward compatibility
   */
  async getAppointmentsNeedingReminders(): Promise<AppointmentReminderData[]> {
    const config24h = REMINDER_CONFIGS.find(c => c.type === '24h')!;
    return this.getAppointmentsForReminderType(config24h);
  }

  /**
   * Helper method to retry an async operation with exponential backoff
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string,
    orderId: string
  ): Promise<{ success: boolean; result?: T; attempts: number; lastError?: string }> {
    const { maxAttempts, initialDelayMs, maxDelayMs, backoffMultiplier } = EMAIL_RETRY_CONFIG;
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();
        if (attempt > 1) {
          logger.info(`${operationName} succeeded on attempt ${attempt}`, { orderId });
        }
        return { success: true, result, attempts: attempt };
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';

        logger.warn(`${operationName} attempt ${attempt}/${maxAttempts} failed`, {
          orderId,
          attempt,
          error: lastError
        });

        // Don't wait after the last attempt
        if (attempt < maxAttempts) {
          const delay = Math.min(
            initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
            maxDelayMs
          );
          await this.sleep(delay);
        }
      }
    }

    logger.error(`${operationName} failed after ${maxAttempts} attempts`, {
      orderId,
      lastError
    });

    return { success: false, attempts: maxAttempts, lastError };
  }

  /**
   * Helper to sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Send 24-hour appointment reminder to customer via email with retry logic
   */
  async sendCustomerReminderEmail(data: AppointmentReminderData): Promise<boolean> {
    if (!data.customerEmail) {
      logger.warn('No customer email for reminder', { orderId: data.orderId });
      return false;
    }

    const subject = `Reminder: Your appointment tomorrow at ${data.shopName}`;

    const bookingDateTime = new Date(data.bookingDate);
    const [hours, minutes] = data.bookingTimeSlot.split(':');
    bookingDateTime.setHours(parseInt(hours), parseInt(minutes));

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #FFCC00; padding: 20px; text-align: center;">
          <h1 style="color: #000; margin: 0;">Appointment Tomorrow!</h1>
        </div>

        <div style="padding: 20px;">
          <p>Hi ${data.customerName || 'there'},</p>

          <p>This is a friendly reminder about your upcoming appointment:</p>

          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FFCC00;">
            <p style="margin: 5px 0;"><strong>Service:</strong> ${data.serviceName}</p>
            <p style="margin: 5px 0;"><strong>Shop:</strong> ${data.shopName}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${bookingDateTime.toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${this.formatTime(data.bookingTimeSlot)}</p>
            <p style="margin: 5px 0;"><strong>Amount:</strong> $${data.totalAmount.toFixed(2)}</p>
          </div>

          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Tips for tomorrow:</strong></p>
            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
              <li>Arrive 5-10 minutes early</li>
              <li>Bring any relevant documents</li>
              <li>Save the shop's contact info</li>
            </ul>
          </div>

          <p>We look forward to seeing you!</p>

          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 12px; color: #856404;">
              <strong>Need to cancel?</strong> Please contact the shop at least 24 hours in advance to avoid any cancellation fees.
            </p>
          </div>
        </div>

        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p style="margin: 5px 0;">Order ID: ${data.orderId}</p>
          <p style="margin: 5px 0;">This is an automated reminder from RepairCoin.</p>
        </div>
      </div>
    `;

    // Use retry logic for email sending
    const retryResult = await this.retryWithBackoff(
      async () => {
        const sent = await this.emailService['sendEmail'](data.customerEmail!, subject, html);
        if (!sent) {
          throw new Error('Email service returned false');
        }
        return sent;
      },
      'Email reminder',
      data.orderId
    );

    return retryResult.success;
  }

  /**
   * Send 24-hour in-app notification to customer
   */
  async sendCustomerInAppNotification(data: AppointmentReminderData): Promise<void> {
    try {
      const bookingDateTime = new Date(data.bookingDate);
      const [hours, minutes] = data.bookingTimeSlot.split(':');
      bookingDateTime.setHours(parseInt(hours), parseInt(minutes));

      const message = `Reminder: You have an appointment tomorrow at ${data.shopName} for ${data.serviceName} at ${this.formatTime(data.bookingTimeSlot)}`;

      await this.notificationService.createNotification({
        senderAddress: 'SYSTEM',
        receiverAddress: data.customerAddress,
        notificationType: 'appointment_reminder',
        message,
        metadata: {
          orderId: data.orderId,
          shopId: data.shopId,
          shopName: data.shopName,
          serviceName: data.serviceName,
          bookingDate: bookingDateTime.toISOString(),
          bookingTime: data.bookingTimeSlot,
          reminderType: '24h',
          timestamp: new Date().toISOString()
        }
      });

      // Send push notification
      await this.expoPushService.sendAppointmentReminder(
        data.customerAddress,
        data.shopName,
        data.serviceName,
        this.formatTime(data.bookingTimeSlot),
        data.orderId
      );
    } catch (error) {
      logger.error('Error sending 24h in-app notification:', error);
      throw error;
    }
  }

  /**
   * Send 2-hour in-app notification to customer
   */
  async sendCustomer2HourInAppNotification(data: AppointmentReminderData): Promise<void> {
    try {
      const bookingDateTime = new Date(data.bookingDate);
      const [hours, minutes] = data.bookingTimeSlot.split(':');
      bookingDateTime.setHours(parseInt(hours), parseInt(minutes));

      const message = `Starting soon! Your ${data.serviceName} appointment at ${data.shopName} is in about 2 hours at ${this.formatTime(data.bookingTimeSlot)}. Please start making your way!`;

      await this.notificationService.createNotification({
        senderAddress: 'SYSTEM',
        receiverAddress: data.customerAddress,
        notificationType: 'appointment_reminder_2h',
        message,
        metadata: {
          orderId: data.orderId,
          shopId: data.shopId,
          shopName: data.shopName,
          serviceName: data.serviceName,
          bookingDate: bookingDateTime.toISOString(),
          bookingTime: data.bookingTimeSlot,
          reminderType: '2h',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error sending 2h in-app notification:', error);
      throw error;
    }
  }

  /**
   * Send 24-hour in-app notification to shop
   */
  async sendShopNotification(data: AppointmentReminderData): Promise<void> {
    try {
      const bookingDateTime = new Date(data.bookingDate);
      const [hours, minutes] = data.bookingTimeSlot.split(':');
      bookingDateTime.setHours(parseInt(hours), parseInt(minutes));

      const message = `Upcoming appointment tomorrow: ${data.customerName || 'Customer'} - ${data.serviceName} at ${this.formatTime(data.bookingTimeSlot)}`;

      await this.notificationService.createNotification({
        senderAddress: 'SYSTEM',
        receiverAddress: data.shopId,
        notificationType: 'upcoming_appointment',
        message,
        metadata: {
          orderId: data.orderId,
          customerAddress: data.customerAddress,
          customerName: data.customerName,
          serviceName: data.serviceName,
          bookingDate: bookingDateTime.toISOString(),
          bookingTime: data.bookingTimeSlot,
          totalAmount: data.totalAmount,
          reminderType: '24h',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error sending shop notification:', error);
      throw error;
    }
  }

  /**
   * Send 2-hour in-app notification to shop
   */
  async sendShop2HourNotification(data: AppointmentReminderData): Promise<void> {
    try {
      const bookingDateTime = new Date(data.bookingDate);
      const [hours, minutes] = data.bookingTimeSlot.split(':');
      bookingDateTime.setHours(parseInt(hours), parseInt(minutes));

      const message = `Appointment starting soon: ${data.customerName || 'Customer'} - ${data.serviceName} at ${this.formatTime(data.bookingTimeSlot)} (in ~2 hours)`;

      await this.notificationService.createNotification({
        senderAddress: 'SYSTEM',
        receiverAddress: data.shopId,
        notificationType: 'upcoming_appointment_2h',
        message,
        metadata: {
          orderId: data.orderId,
          customerAddress: data.customerAddress,
          customerName: data.customerName,
          serviceName: data.serviceName,
          bookingDate: bookingDateTime.toISOString(),
          bookingTime: data.bookingTimeSlot,
          totalAmount: data.totalAmount,
          reminderType: '2h',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error sending shop 2h notification:', error);
      throw error;
    }
  }

  /**
   * Mark specific reminder type as sent
   */
  async markReminderTypeSent(orderId: string, config: ReminderConfig): Promise<void> {
    try {
      const query = `
        UPDATE service_orders
        SET
          ${config.flagColumn} = TRUE,
          ${config.timestampColumn} = NOW(),
          reminder_sent = CASE WHEN '${config.type}' = '24h' THEN TRUE ELSE COALESCE(reminder_sent, FALSE) END,
          updated_at = NOW()
        WHERE order_id = $1
      `;

      await getSharedPool().query(query, [orderId]);
    } catch (error) {
      logger.error(`Error marking ${config.type} reminder as sent:`, error);
      throw error;
    }
  }

  /**
   * Mark order as reminder sent - Legacy method for backward compatibility
   */
  async markReminderSent(orderId: string): Promise<void> {
    const config24h = REMINDER_CONFIGS.find(c => c.type === '24h')!;
    return this.markReminderTypeSent(orderId, config24h);
  }

  /**
   * Send booking confirmation immediately after payment
   */
  async sendBookingConfirmation(orderId: string): Promise<void> {
    try {
      // Get order details
      const order = await this.orderRepository.getOrderById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Get service details
      const service = await this.serviceRepository.getServiceById(order.serviceId);
      if (!service) {
        throw new Error('Service not found');
      }

      // Get customer details
      const customer = await this.customerRepository.getCustomer(order.customerAddress);

      // Get shop details
      const shop = await this.shopRepository.getShop(order.shopId);

      if (!shop) {
        throw new Error('Shop not found');
      }

      const bookingDateTime = new Date(order.bookingDate!);
      const bookingTime = order.bookingTime;
      if (bookingTime) {
        const [hours, minutes] = bookingTime.split(':');
        bookingDateTime.setHours(parseInt(hours), parseInt(minutes));
      }

      // Send email confirmation to customer
      if (customer?.email) {
        const subject = `Booking Confirmed: ${service.serviceName} at ${shop.name}`;

        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #4CAF50; padding: 20px; text-align: center;">
              <h1 style="color: #fff; margin: 0;">Booking Confirmed!</h1>
            </div>

            <div style="padding: 20px;">
              <p>Hi ${customer.name || 'there'},</p>

              <p>Your appointment has been successfully booked!</p>

              <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50;">
                <p style="margin: 5px 0;"><strong>Service:</strong> ${service.serviceName}</p>
                <p style="margin: 5px 0;"><strong>Shop:</strong> ${shop.name}</p>
                <p style="margin: 5px 0;"><strong>Date:</strong> ${bookingDateTime.toLocaleDateString()}</p>
                <p style="margin: 5px 0;"><strong>Time:</strong> ${bookingTime ? this.formatTime(bookingTime) : 'TBD'}</p>
                <p style="margin: 5px 0;"><strong>Amount Paid:</strong> $${order.totalAmount.toFixed(2)}</p>
              </div>

              ${order.rcnRedeemed && order.rcnRedeemed > 0 ? `
              <div style="background-color: #fff8e1; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;">
                  <strong>RCN Used:</strong> ${order.rcnRedeemed} RCN (saved $${order.rcnDiscountUsd?.toFixed(2)})
                </p>
              </div>
              ` : ''}

              <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>What's next?</strong></p>
                <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                  <li>We'll send you a reminder 24 hours before your appointment</li>
                  <li>Another reminder 2 hours before to help you prepare</li>
                </ul>
              </div>
            </div>

            <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
              <p style="margin: 5px 0;">Order ID: ${orderId}</p>
              <p style="margin: 5px 0;">This is an automated confirmation from RepairCoin.</p>
            </div>
          </div>
        `;

        await this.emailService['sendEmail'](customer.email, subject, html);
      }

      // Send in-app notification to customer
      await this.notificationService.createNotification({
        senderAddress: 'SYSTEM',
        receiverAddress: order.customerAddress,
        notificationType: 'booking_confirmed',
        message: `Your appointment for ${service.serviceName} at ${shop.name} has been confirmed for ${bookingDateTime.toLocaleDateString()} at ${bookingTime ? this.formatTime(bookingTime) : 'TBD'}`,
        metadata: {
          orderId,
          shopId: order.shopId,
          shopName: shop.name,
          serviceName: service.serviceName,
          bookingDate: bookingDateTime.toISOString(),
          bookingTime: bookingTime,
          totalAmount: order.totalAmount,
          timestamp: new Date().toISOString()
        }
      });

      // Send push notification to customer
      const formattedTime = bookingTime ? this.formatTime(bookingTime) : 'TBD';

      await this.expoPushService.sendBookingConfirmation(
        order.customerAddress,
        shop.name,
        service.serviceName,
        bookingDateTime.toLocaleDateString(),
        formattedTime,
        orderId
      );

      // Send push notification to shop
      const shopWalletAddress = shop.walletAddress;
      if (shopWalletAddress) {
        await this.expoPushService.sendNewBookingToShop(
          shopWalletAddress,
          customer?.name || 'Customer',
          service.serviceName,
          bookingDateTime.toLocaleDateString(),
          formattedTime,
          orderId
        );
      }

      // Send notification to shop
      await this.notificationService.createServiceBookingReceivedNotification(
        order.customerAddress,
        order.shopId,
        customer?.name || 'Customer',
        service.serviceName,
        order.totalAmount,
        orderId
      );

      logger.info('Booking confirmation sent', { orderId });
    } catch (error) {
      logger.error('Error sending booking confirmation:', error);
      throw error;
    }
  }

  /**
   * Process reminders for a specific reminder type
   * Now respects customer notification preferences
   */
  async processReminderType(config: ReminderConfig): Promise<{
    sent: number;
    emailsSent: number;
    emailsFailed: number;
    inAppSent: number;
    shopNotificationsSent: number;
    skippedByPreference: number;
    skippedByQuietHours: number;
    errors: string[];
  }> {
    const result = {
      sent: 0,
      emailsSent: 0,
      emailsFailed: 0,
      inAppSent: 0,
      shopNotificationsSent: 0,
      skippedByPreference: 0,
      skippedByQuietHours: 0,
      errors: [] as string[]
    };

    try {
      const appointments = await this.getAppointmentsForReminderType(config);
      logger.info(`Found ${appointments.length} appointments needing ${config.type} reminders`);

      for (const appointment of appointments) {
        try {
          // Get customer notification preferences
          const prefs = await notificationPreferencesRepository.getByCustomerAddress(appointment.customerAddress);

          // Check if this reminder type is enabled by customer preference
          const reminderTypeEnabled =
            (config.type === '24h' && prefs.reminder24hEnabled) ||
            (config.type === '2h' && prefs.reminder2hEnabled);

          if (!reminderTypeEnabled) {
            logger.debug(`Skipping ${config.type} reminder for ${appointment.orderId} - disabled by customer preference`);
            result.skippedByPreference++;
            // Still mark as sent to avoid re-processing
            await this.markReminderTypeSent(appointment.orderId, config);
            result.sent++;
            continue;
          }

          // Check quiet hours - if in quiet hours, skip customer notifications but notify shop
          let skippedDueToQuietHours = false;
          if (prefs.quietHoursEnabled && prefs.quietHoursStart && prefs.quietHoursEnd) {
            const currentTime = this.getCurrentTime();
            if (this.isInQuietHours(currentTime, prefs.quietHoursStart, prefs.quietHoursEnd)) {
              skippedDueToQuietHours = true;
              result.skippedByQuietHours++;

              logger.info(`Skipping ${config.type} reminder for ${appointment.orderId} - customer in quiet hours`, {
                orderId: appointment.orderId,
                customerAddress: appointment.customerAddress,
                currentTime,
                quietHoursStart: prefs.quietHoursStart,
                quietHoursEnd: prefs.quietHoursEnd
              });

              // Notify the shop that the customer wasn't reminded due to quiet hours
              await this.sendShopQuietHoursSkippedNotification(
                appointment,
                config.type,
                prefs.quietHoursStart,
                prefs.quietHoursEnd
              );

              // Mark as sent to avoid re-processing
              await this.markReminderTypeSent(appointment.orderId, config);
              result.sent++;
              continue;
            }
          }

          // Track email status for this appointment
          let emailAttempted = false;
          let emailSucceeded = false;

          // Send email if configured AND customer has email enabled
          if (config.sendEmail && prefs.emailEnabled) {
            emailAttempted = true;
            const emailSent = await this.sendCustomerReminderEmail(appointment);
            if (emailSent) {
              result.emailsSent++;
              emailSucceeded = true;
            } else {
              result.emailsFailed++;
              // Log the failure but continue with other notifications
              logger.warn(`Email reminder failed for order ${appointment.orderId} after retries`, {
                customerEmail: appointment.customerEmail,
                shopName: appointment.shopName
              });
            }
          }

          // Send in-app notification if configured AND customer has in-app enabled
          if (config.sendInApp && prefs.inAppEnabled) {
            if (config.type === '24h') {
              await this.sendCustomerInAppNotification(appointment);
            } else if (config.type === '2h') {
              await this.sendCustomer2HourInAppNotification(appointment);
            }
            result.inAppSent++;
          }

          // Send shop notification if configured (shops always get notified)
          if (config.sendShopNotification) {
            if (config.type === '24h') {
              await this.sendShopNotification(appointment);
            } else if (config.type === '2h') {
              await this.sendShop2HourNotification(appointment);
            }
            result.shopNotificationsSent++;
          }

          // Mark as sent (even if email failed, in-app was sent)
          await this.markReminderTypeSent(appointment.orderId, config);
          result.sent++;

          logger.info(`${config.type} reminder processed`, {
            orderId: appointment.orderId,
            customerAddress: appointment.customerAddress,
            shopId: appointment.shopId,
            emailEnabled: prefs.emailEnabled,
            emailAttempted,
            emailSucceeded,
            inAppEnabled: prefs.inAppEnabled
          });
        } catch (error) {
          const errorMsg = `Failed to send ${config.type} reminder for order ${appointment.orderId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          logger.error(errorMsg, error);
          result.errors.push(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = `Failed to process ${config.type} reminders: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(errorMsg, error);
      result.errors.push(errorMsg);
    }

    return result;
  }

  /**
   * Process all pending appointment reminders (24h and 2h)
   */
  async processReminders(): Promise<ReminderReport> {
    if (this.isRunning) {
      logger.warn('Reminder processing already running');
      throw new Error('Reminder processing already running');
    }

    this.isRunning = true;
    const errors: string[] = [];
    let customerRemindersSent = 0;
    let shopNotificationsSent = 0;
    let emailsSent = 0;
    let emailsFailed = 0;
    let inAppNotificationsSent = 0;
    let reminder24hSent = 0;
    let reminder2hSent = 0;
    let skippedByPreference = 0;
    let skippedByQuietHours = 0;
    let pushNotificationsSent = 0;
    try {
      logger.info('Starting multi-reminder processing (24h and 2h)');

      // Process each reminder type
      for (const config of REMINDER_CONFIGS) {
        const result = await this.processReminderType(config);

        // Aggregate results
        emailsSent += result.emailsSent;
        emailsFailed += result.emailsFailed;
        inAppNotificationsSent += result.inAppSent;
        shopNotificationsSent += result.shopNotificationsSent;
        customerRemindersSent += result.sent;
        skippedByPreference += result.skippedByPreference;
        skippedByQuietHours += result.skippedByQuietHours;
        errors.push(...result.errors);

        // Track by type
        if (config.type === '24h') {
          reminder24hSent = result.sent;
        } else if (config.type === '2h') {
          reminder2hSent = result.sent;
        }
      }

      const report: ReminderReport = {
        timestamp: new Date(),
        remindersChecked: customerRemindersSent,
        customerRemindersSent,
        shopNotificationsSent,
        emailsSent,
        emailsFailed,
        inAppNotificationsSent,
        errors,
        reminder24hSent,
        reminder2hSent,
        skippedByPreference,
        skippedByQuietHours,
        pushNotificationsSent,
      };

      logger.info('Multi-reminder processing completed', report);

      // Log a warning if there were email failures
      if (emailsFailed > 0) {
        logger.warn(`${emailsFailed} email(s) failed after ${EMAIL_RETRY_CONFIG.maxAttempts} retry attempts`, {
          emailsSent,
          emailsFailed,
          successRate: emailsSent > 0 ? ((emailsSent / (emailsSent + emailsFailed)) * 100).toFixed(1) + '%' : '0%'
        });
      }

      // Log info about skipped reminders
      if (skippedByQuietHours > 0) {
        logger.info(`${skippedByQuietHours} reminder(s) skipped due to customer quiet hours (shops notified)`, {
          skippedByQuietHours,
          skippedByPreference
        });
      }

      return report;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Schedule automatic reminder processing
   * Runs every hour to check for appointments needing reminders
   * (Changed from 2 hours to 1 hour for 2h reminder accuracy)
   */
  scheduleReminders(intervalHours: number = 1): void {
    if (this.scheduledIntervalId) {
      logger.warn('Reminders already scheduled');
      return;
    }

    // Run immediately on startup
    this.processReminders().catch(error => {
      logger.error('Initial reminder processing failed:', error);
    });

    // Schedule periodic checks (every hour for 2h reminder accuracy)
    this.scheduledIntervalId = setInterval(async () => {
      try {
        await this.processReminders();
      } catch (error) {
        logger.error('Scheduled reminder processing failed:', error);
      }
    }, intervalHours * 60 * 60 * 1000);

    logger.info('Appointment reminders scheduled', { intervalHours });
  }

  /**
   * Stop scheduled reminder processing
   */
  stopScheduledReminders(): void {
    if (this.scheduledIntervalId) {
      clearInterval(this.scheduledIntervalId);
      this.scheduledIntervalId = null;
      logger.info('Scheduled reminders stopped');
    }
  }

  /**
   * Helper to format time to 12-hour format
   */
  private formatTime(timeSlot: string): string {
    const [hours, minutes] = timeSlot.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  }

  /**
   * Check if current time is within quiet hours
   */
  private isInQuietHours(currentTime: string, start: string, end: string): boolean {
    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (start > end) {
      // Quiet hours span midnight
      return currentTime >= start || currentTime <= end;
    } else {
      // Normal quiet hours (e.g., 14:00 to 16:00)
      return currentTime >= start && currentTime <= end;
    }
  }

  /**
   * Get current time in HH:MM format
   */
  private getCurrentTime(): string {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  }

  /**
   * Send notification to shop when customer reminder was skipped due to quiet hours
   * This helps shops know that their customer wasn't reminded
   */
  async sendShopQuietHoursSkippedNotification(
    data: AppointmentReminderData,
    reminderType: ReminderType,
    quietHoursStart: string,
    quietHoursEnd: string
  ): Promise<void> {
    try {
      const bookingDateTime = new Date(data.bookingDate);
      const [hours, minutes] = data.bookingTimeSlot.split(':');
      bookingDateTime.setHours(parseInt(hours), parseInt(minutes));

      const reminderTypeLabel = reminderType === '24h' ? '24-hour' : '2-hour';

      const message = `Note: ${data.customerName || 'Customer'}'s ${reminderTypeLabel} reminder for their ${data.serviceName} appointment was not sent because they have Quiet Hours enabled (${this.formatTime(quietHoursStart)} - ${this.formatTime(quietHoursEnd)}). Consider reaching out directly if needed.`;

      await this.notificationService.createNotification({
        senderAddress: 'SYSTEM',
        receiverAddress: data.shopId,
        notificationType: 'reminder_skipped_quiet_hours',
        message,
        metadata: {
          orderId: data.orderId,
          customerAddress: data.customerAddress,
          customerName: data.customerName,
          serviceName: data.serviceName,
          bookingDate: bookingDateTime.toISOString(),
          bookingTime: data.bookingTimeSlot,
          reminderType,
          quietHoursStart,
          quietHoursEnd,
          reason: 'quiet_hours',
          timestamp: new Date().toISOString()
        }
      });

      logger.info('Shop notified about skipped quiet hours reminder', {
        orderId: data.orderId,
        shopId: data.shopId,
        reminderType,
        customerAddress: data.customerAddress
      });
    } catch (error) {
      logger.error('Error sending quiet hours skipped notification to shop:', error);
      // Don't throw - this is a best-effort notification
    }
  }

  /**
   * Send email notification when shop reschedules an appointment
   */
  async sendRescheduleByShopEmail(data: {
    customerEmail: string;
    customerName: string;
    shopName: string;
    serviceName: string;
    originalDate: string;
    originalTime: string;
    newDate: string;
    newTime: string;
    reason?: string;
    orderId: string;
  }): Promise<boolean> {
    if (!data.customerEmail) {
      logger.warn('No customer email for reschedule notification', { orderId: data.orderId });
      return false;
    }

    try {
      const result = await this.emailService.sendAppointmentRescheduledByShop({
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        shopName: data.shopName,
        serviceName: data.serviceName,
        originalDate: data.originalDate,
        originalTime: data.originalTime,
        newDate: data.newDate,
        newTime: data.newTime,
        reason: data.reason
      });

      if (result) {
        logger.info('Reschedule notification email sent', {
          orderId: data.orderId,
          customerEmail: data.customerEmail,
          newDate: data.newDate,
          newTime: data.newTime
        });
      }

      return result;
    } catch (error) {
      logger.error('Error sending reschedule notification email:', error);
      return false;
    }
  }
}

// Export singleton instance
export const appointmentReminderService = new AppointmentReminderService();
