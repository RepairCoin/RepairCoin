// backend/src/services/AppointmentReminderService.ts
import { logger } from '../utils/logger';
import { EmailService } from './EmailService';
import { NotificationService } from '../domains/notification/services/NotificationService';
import { OrderRepository } from '../repositories/OrderRepository';
import { ShopRepository } from '../repositories/ShopRepository';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { ServiceRepository } from '../repositories/ServiceRepository';

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
  inAppNotificationsSent: number;
  errors: string[];
}

export class AppointmentReminderService {
  private emailService: EmailService;
  private notificationService: NotificationService;
  private orderRepository: OrderRepository;
  private shopRepository: ShopRepository;
  private customerRepository: CustomerRepository;
  private serviceRepository: ServiceRepository;
  private scheduledIntervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.emailService = new EmailService();
    this.notificationService = new NotificationService();
    this.orderRepository = new OrderRepository();
    this.shopRepository = new ShopRepository();
    this.customerRepository = new CustomerRepository();
    this.serviceRepository = new ServiceRepository();
  }

  /**
   * Get appointments that need reminders (24 hours before)
   */
  async getAppointmentsNeedingReminders(): Promise<AppointmentReminderData[]> {
    try {
      const query = `
        SELECT
          so.order_id as "orderId",
          so.customer_address as "customerAddress",
          c.email as "customerEmail",
          c.name as "customerName",
          so.shop_id as "shopId",
          s.company_name as "shopName",
          s.email as "shopEmail",
          ss.service_name as "serviceName",
          so.booking_date as "bookingDate",
          so.booking_time_slot as "bookingTimeSlot",
          so.total_amount as "totalAmount"
        FROM service_orders so
        JOIN customers c ON c.wallet_address = so.customer_address
        JOIN shops s ON s.shop_id = so.shop_id
        JOIN shop_services ss ON ss.service_id = so.service_id
        WHERE so.status IN ('paid', 'confirmed')
          AND so.booking_date IS NOT NULL
          AND so.booking_time_slot IS NOT NULL
          AND so.reminder_sent IS NOT TRUE
          AND (
            -- Appointments 23-25 hours from now (gives 2-hour window for scheduler)
            so.booking_date + so.booking_time_slot::time
            BETWEEN NOW() + INTERVAL '23 hours'
            AND NOW() + INTERVAL '25 hours'
          )
        ORDER BY so.booking_date, so.booking_time_slot
      `;

      const result = await this.orderRepository['pool'].query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error getting appointments needing reminders:', error);
      throw error;
    }
  }

  /**
   * Send appointment reminder to customer via email
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
        <h2 style="color: #FFCC00;">Appointment Reminder</h2>

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
          <p style="margin: 0;"><strong>💡 Tip:</strong> Please arrive a few minutes early to ensure a smooth check-in process.</p>
        </div>

        <p>We look forward to seeing you!</p>

        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 12px; color: #856404;">
            <strong>Need to cancel?</strong> Please contact the shop at least 24 hours in advance to avoid any cancellation fees.
          </p>
        </div>

        <hr style="border: 1px solid #ddd; margin: 30px 0;">

        <p style="color: #666; font-size: 12px;">
          Order ID: ${data.orderId}<br>
          This is an automated reminder from RepairCoin.
        </p>
      </div>
    `;

    return await this.emailService['sendEmail'](data.customerEmail, subject, html);
  }

  /**
   * Send in-app notification to customer
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
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error sending in-app notification:', error);
      throw error;
    }
  }

  /**
   * Send in-app notification to shop
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
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error sending shop notification:', error);
      throw error;
    }
  }

  /**
   * Mark order as reminder sent
   */
  async markReminderSent(orderId: string): Promise<void> {
    try {
      const query = `
        UPDATE service_orders
        SET reminder_sent = TRUE, updated_at = NOW()
        WHERE order_id = $1
      `;

      await this.orderRepository['pool'].query(query, [orderId]);
    } catch (error) {
      logger.error('Error marking reminder as sent:', error);
      throw error;
    }
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
      const [hours, minutes] = order.bookingTime!.split(':');
      bookingDateTime.setHours(parseInt(hours), parseInt(minutes));

      // Send email confirmation to customer
      if (customer?.email) {
        const subject = `Booking Confirmed: ${service.serviceName} at ${shop.name}`;

        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4CAF50;">✓ Booking Confirmed!</h2>

            <p>Hi ${customer.name || 'there'},</p>

            <p>Your appointment has been successfully booked!</p>

            <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50;">
              <p style="margin: 5px 0;"><strong>Service:</strong> ${service.serviceName}</p>
              <p style="margin: 5px 0;"><strong>Shop:</strong> ${shop.name}</p>
              <p style="margin: 5px 0;"><strong>Date:</strong> ${bookingDateTime.toLocaleDateString()}</p>
              <p style="margin: 5px 0;"><strong>Time:</strong> ${this.formatTime(order.bookingTime!)}</p>
              <p style="margin: 5px 0;"><strong>Amount Paid:</strong> $${order.totalAmount.toFixed(2)}</p>
            </div>

            ${order.rcnRedeemed && order.rcnRedeemed > 0 ? `
            <div style="background-color: #fff8e1; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;">
                <strong>🪙 RCN Used:</strong> ${order.rcnRedeemed} RCN (saved $${order.rcnDiscountUsd?.toFixed(2)})
              </p>
            </div>
            ` : ''}

            <p>We'll send you a reminder 24 hours before your appointment.</p>

            <hr style="border: 1px solid #ddd; margin: 30px 0;">

            <p style="color: #666; font-size: 12px;">
              Order ID: ${orderId}<br>
              This is an automated confirmation from RepairCoin.
            </p>
          </div>
        `;

        await this.emailService['sendEmail'](customer.email, subject, html);
      }

      // Send in-app notification to customer
      await this.notificationService.createNotification({
        senderAddress: 'SYSTEM',
        receiverAddress: order.customerAddress,
        notificationType: 'booking_confirmed',
        message: `Your appointment for ${service.serviceName} at ${shop.name} has been confirmed for ${bookingDateTime.toLocaleDateString()} at ${this.formatTime(order.bookingTime!)}`,
        metadata: {
          orderId,
          shopId: order.shopId,
          shopName: shop.name,
          serviceName: service.serviceName,
          bookingDate: bookingDateTime.toISOString(),
          bookingTime: order.bookingTime,
          totalAmount: order.totalAmount,
          timestamp: new Date().toISOString()
        }
      });

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
   * Process all pending appointment reminders
   */
  async processReminders(): Promise<ReminderReport> {
    if (this.isRunning) {
      logger.warn('Reminder processing already running');
      throw new Error('Reminder processing already running');
    }

    this.isRunning = true;
    const startTime = Date.now();
    const errors: string[] = [];
    let customerRemindersSent = 0;
    let shopNotificationsSent = 0;
    let emailsSent = 0;
    let inAppNotificationsSent = 0;

    try {
      logger.info('Starting appointment reminder processing');

      const appointments = await this.getAppointmentsNeedingReminders();

      logger.info(`Found ${appointments.length} appointments needing reminders`);

      for (const appointment of appointments) {
        try {
          // Send customer email reminder
          const emailSent = await this.sendCustomerReminderEmail(appointment);
          if (emailSent) {
            emailsSent++;
          }

          // Send customer in-app notification
          await this.sendCustomerInAppNotification(appointment);
          inAppNotificationsSent++;
          customerRemindersSent++;

          // Send shop notification
          await this.sendShopNotification(appointment);
          shopNotificationsSent++;

          // Mark as sent
          await this.markReminderSent(appointment.orderId);

          logger.info('Reminder sent successfully', {
            orderId: appointment.orderId,
            customerAddress: appointment.customerAddress,
            shopId: appointment.shopId
          });
        } catch (error) {
          const errorMsg = `Failed to send reminder for order ${appointment.orderId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          logger.error(errorMsg, error);
          errors.push(errorMsg);
        }
      }

      const report: ReminderReport = {
        timestamp: new Date(),
        remindersChecked: appointments.length,
        customerRemindersSent,
        shopNotificationsSent,
        emailsSent,
        inAppNotificationsSent,
        errors
      };

      logger.info('Appointment reminder processing completed', report);

      return report;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Schedule automatic reminder processing
   * Runs every 2 hours to check for appointments needing reminders
   */
  scheduleReminders(intervalHours: number = 2): void {
    if (this.scheduledIntervalId) {
      logger.warn('Reminders already scheduled');
      return;
    }

    // Run immediately on startup
    this.processReminders().catch(error => {
      logger.error('Initial reminder processing failed:', error);
    });

    // Schedule periodic checks
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
}

// Export singleton instance
export const appointmentReminderService = new AppointmentReminderService();
