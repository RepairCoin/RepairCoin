import { NotificationRepository, CreateNotificationParams, Notification } from '../../../repositories/NotificationRepository';
import { PaginationParams, PaginatedResult } from '../../../repositories/BaseRepository';
import { logger } from '../../../utils/logger';

export interface NotificationMessageTemplates {
  reward_issued: (data: { shopName: string; amount: number }) => string;
  redemption_approval_request: (data: { shopName: string; amount: number }) => string;
  redemption_approved: (data: { customerName: string; amount: number }) => string;
  redemption_rejected: (data: { customerName: string; amount: number }) => string;
  redemption_cancelled: (data: { shopName: string; amount: number }) => string;
  token_gifted: (data: { fromCustomerName: string; amount: number }) => string;
  subscription_paused: (data: { reason?: string }) => string;
  subscription_resumed: () => string;
  subscription_cancelled: (data: { reason?: string; effectiveDate?: Date | string }) => string;
  subscription_self_cancelled: (data: { reason?: string; effectiveDate?: Date | string }) => string;
  subscription_approved: () => string;
  subscription_reactivated: () => string;
  service_booking_received: (data: { customerName: string; serviceName: string; amount: number }) => string;
  service_order_completed: (data: { shopName: string; serviceName: string; rcnEarned: number }) => string;
  service_payment_failed: (data: { serviceName: string; reason: string }) => string;
  service_order_cancelled: (data: { serviceName: string; refundStatus?: string }) => string;
  appointment_reminder: (data: { shopName: string; serviceName: string; bookingTime: string }) => string;
  booking_confirmed: (data: { shopName: string; serviceName: string; bookingDate: string; bookingTime: string }) => string;
  upcoming_appointment: (data: { customerName: string; serviceName: string; bookingTime: string }) => string;
  reschedule_request_created: (data: { customerName: string; serviceName: string; originalDate: string; originalTime: string; requestedDate: string; requestedTime: string }) => string;
  reschedule_request_approved: (data: { shopName: string; serviceName: string; newDate: string; newTime: string }) => string;
  reschedule_request_rejected: (data: { shopName: string; serviceName: string; reason?: string }) => string;
  reschedule_request_expired: (data: { shopName: string; serviceName: string }) => string;
  booking_rescheduled_by_shop: (data: { shopName: string; serviceName: string; originalDate: string; originalTime: string; newDate: string; newTime: string; reason?: string }) => string;
  shop_suspended: (data: { shopName?: string; reason?: string }) => string;
  shop_unsuspended: (data: { shopName?: string }) => string;
  support_ticket_created: (data: { ticketId: string; subject: string; category: string }) => string;
  support_message_received: (data: { ticketId: string; senderName: string; preview: string }) => string;
  support_ticket_resolved: (data: { ticketId: string; subject: string }) => string;
  support_ticket_assigned: (data: { ticketId: string; subject: string }) => string;
}

export class NotificationService {
  private repository: NotificationRepository;
  private messageTemplates: NotificationMessageTemplates;

  constructor() {
    this.repository = new NotificationRepository();
    this.initializeMessageTemplates();
  }

  private initializeMessageTemplates(): void {
    this.messageTemplates = {
      reward_issued: (data) =>
        `You received ${data.amount} RCN reward from ${data.shopName}!`,

      redemption_approval_request: (data) =>
        `${data.shopName} is requesting approval to redeem ${data.amount} RCN from your wallet.`,

      redemption_approved: (data) =>
        `${data.customerName} approved the redemption of ${data.amount} RCN.`,

      redemption_rejected: (data) =>
        `${data.customerName} rejected the redemption request for ${data.amount} RCN.`,

      redemption_cancelled: (data) =>
        `${data.shopName} cancelled the redemption request for ${data.amount} RCN.`,

      token_gifted: (data) =>
        `You received ${data.amount} RCN gift from ${data.fromCustomerName}!`,

      subscription_paused: (data) =>
        `Your subscription has been paused by admin${data.reason ? ': ' + data.reason : '.'}`,

      subscription_resumed: () =>
        'Your subscription has been resumed by admin and is now active.',

      subscription_cancelled: (data) =>
        `Your subscription has been cancelled by admin${data.reason ? ': ' + data.reason : '.'}${data.effectiveDate ? ` You retain full access until ${new Date(data.effectiveDate).toLocaleDateString()}.` : ''}`,

      subscription_self_cancelled: (data) =>
        `Your subscription cancellation has been confirmed${data.reason ? ': ' + data.reason : '.'}${data.effectiveDate ? ` You retain full access until ${new Date(data.effectiveDate).toLocaleDateString()}. You can reactivate anytime before this date.` : ''}`,

      subscription_approved: () =>
        'Your subscription has been approved and is now active!',

      subscription_reactivated: () =>
        'Your subscription has been reactivated and will continue as normal.',

      service_booking_received: (data) =>
        `New booking received from ${data.customerName} for ${data.serviceName} ($${data.amount.toFixed(2)})`,

      service_order_completed: (data) =>
        `${data.shopName} completed your ${data.serviceName} service. You earned ${data.rcnEarned} RCN!`,

      service_payment_failed: (data) =>
        `Payment failed for ${data.serviceName}: ${data.reason}`,

      service_order_cancelled: (data) =>
        `Your ${data.serviceName} booking has been cancelled${data.refundStatus ? '. ' + data.refundStatus : '.'}`,

      appointment_reminder: (data) =>
        `Reminder: You have an appointment tomorrow at ${data.shopName} for ${data.serviceName} at ${data.bookingTime}`,

      booking_confirmed: (data) =>
        `Your appointment for ${data.serviceName} at ${data.shopName} has been confirmed for ${data.bookingDate} at ${data.bookingTime}`,

      upcoming_appointment: (data) =>
        `Upcoming appointment tomorrow: ${data.customerName} - ${data.serviceName} at ${data.bookingTime}`,

      reschedule_request_created: (data) =>
        `${data.customerName} requested to reschedule ${data.serviceName} from ${data.originalDate} at ${data.originalTime} to ${data.requestedDate} at ${data.requestedTime}`,

      reschedule_request_approved: (data) =>
        `${data.shopName} approved your reschedule request for ${data.serviceName}. New appointment: ${data.newDate} at ${data.newTime}`,

      reschedule_request_rejected: (data) =>
        `${data.shopName} declined your reschedule request for ${data.serviceName}${data.reason ? ': ' + data.reason : '.'}`,

      reschedule_request_expired: (data) =>
        `Your reschedule request for ${data.serviceName} at ${data.shopName} has expired. Please submit a new request if needed.`,

      booking_rescheduled_by_shop: (data) =>
        `${data.shopName} has rescheduled your ${data.serviceName} appointment from ${data.originalDate} at ${data.originalTime} to ${data.newDate} at ${data.newTime}${data.reason ? '. Reason: ' + data.reason : '.'}`,

      shop_suspended: (data) =>
        `Your shop${data.shopName ? ` (${data.shopName})` : ''} has been suspended by an administrator${data.reason ? ': ' + data.reason : '.'}`,

      shop_unsuspended: (data) =>
        `Your shop${data.shopName ? ` (${data.shopName})` : ''} has been unsuspended. You can now resume normal operations.`,

      support_ticket_created: (data: { ticketId: string; subject: string; category: string }) =>
        `New support ticket #${data.ticketId}: ${data.subject} (${data.category})`,

      support_message_received: (data: { ticketId: string; senderName: string; preview: string }) =>
        `New message from ${data.senderName} in ticket #${data.ticketId}: ${data.preview}`,

      support_ticket_resolved: (data: { ticketId: string; subject: string }) =>
        `Your support ticket #${data.ticketId} (${data.subject}) has been resolved`,

      support_ticket_assigned: (data: { ticketId: string; subject: string }) =>
        `Your support ticket #${data.ticketId} (${data.subject}) has been assigned to an admin`
    };
  }

  async createNotification(params: CreateNotificationParams): Promise<Notification> {
    try {
      const notification = await this.repository.create(params);
      logger.info(`Notification created: ${notification.id} (${params.notificationType})`);
      return notification;
    } catch (error: any) {
      logger.error('Error in NotificationService.createNotification:', error);
      throw error;
    }
  }

  async createRewardIssuedNotification(
    shopAddress: string,
    customerAddress: string,
    shopName: string,
    amount: number,
    transactionId: string
  ): Promise<Notification> {
    const message = this.messageTemplates.reward_issued({ shopName, amount });

    return this.createNotification({
      senderAddress: shopAddress,
      receiverAddress: customerAddress,
      notificationType: 'reward_issued',
      message,
      metadata: {
        shopName,
        amount,
        transactionId,
        timestamp: new Date().toISOString()
      }
    });
  }

  async createRedemptionApprovalRequest(
    shopAddress: string,
    customerAddress: string,
    shopName: string,
    amount: number,
    redemptionSessionId: string
  ): Promise<Notification> {
    const message = this.messageTemplates.redemption_approval_request({ shopName, amount });

    return this.createNotification({
      senderAddress: shopAddress,
      receiverAddress: customerAddress,
      notificationType: 'redemption_approval_request',
      message,
      metadata: {
        shopName,
        amount,
        redemptionSessionId,
        timestamp: new Date().toISOString()
      }
    });
  }

  async createRedemptionResponseNotification(
    customerAddress: string,
    shopAddress: string,
    customerName: string,
    amount: number,
    redemptionSessionId: string,
    approved: boolean
  ): Promise<Notification> {
    const notificationType = approved ? 'redemption_approved' : 'redemption_rejected';
    const message = approved
      ? this.messageTemplates.redemption_approved({ customerName, amount })
      : this.messageTemplates.redemption_rejected({ customerName, amount });

    return this.createNotification({
      senderAddress: customerAddress,
      receiverAddress: shopAddress,
      notificationType,
      message,
      metadata: {
        customerName,
        amount,
        redemptionSessionId,
        approved,
        timestamp: new Date().toISOString()
      }
    });
  }

  async createRedemptionCancelledNotification(
    shopAddress: string,
    customerAddress: string,
    shopName: string,
    amount: number,
    redemptionSessionId: string
  ): Promise<Notification> {
    const message = this.messageTemplates.redemption_cancelled({ shopName, amount });

    return this.createNotification({
      senderAddress: shopAddress,
      receiverAddress: customerAddress,
      notificationType: 'redemption_cancelled',
      message,
      metadata: {
        shopName,
        amount,
        redemptionSessionId,
        timestamp: new Date().toISOString()
      }
    });
  }

  async createTokenGiftedNotification(
    fromCustomerAddress: string,
    toCustomerAddress: string,
    fromCustomerName: string,
    amount: number,
    transactionId: string
  ): Promise<Notification> {
    const message = this.messageTemplates.token_gifted({ fromCustomerName, amount });

    return this.createNotification({
      senderAddress: fromCustomerAddress,
      receiverAddress: toCustomerAddress,
      notificationType: 'token_gifted',
      message,
      metadata: {
        fromCustomerName,
        amount,
        transactionId,
        timestamp: new Date().toISOString()
      }
    });
  }

  async getNotificationById(id: string): Promise<Notification | null> {
    try {
      return await this.repository.findById(id);
    } catch (error: any) {
      logger.error('Error in NotificationService.getNotificationById:', error);
      throw error;
    }
  }

  async getNotificationsByReceiver(
    receiverAddress: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<Notification>> {
    try {
      return await this.repository.findByReceiver(receiverAddress, pagination);
    } catch (error: any) {
      logger.error('Error in NotificationService.getNotificationsByReceiver:', error);
      throw error;
    }
  }

  async getUnreadNotifications(receiverAddress: string): Promise<Notification[]> {
    try {
      return await this.repository.findUnreadByReceiver(receiverAddress);
    } catch (error: any) {
      logger.error('Error in NotificationService.getUnreadNotifications:', error);
      throw error;
    }
  }

  async getUnreadCount(receiverAddress: string): Promise<number> {
    try {
      return await this.repository.getUnreadCount(receiverAddress);
    } catch (error: any) {
      logger.error('Error in NotificationService.getUnreadCount:', error);
      throw error;
    }
  }

  async markAsRead(notificationId: string): Promise<Notification> {
    try {
      return await this.repository.markAsRead(notificationId);
    } catch (error: any) {
      logger.error('Error in NotificationService.markAsRead:', error);
      throw error;
    }
  }

  async markAllAsRead(receiverAddress: string): Promise<number> {
    try {
      return await this.repository.markAllAsRead(receiverAddress);
    } catch (error: any) {
      logger.error('Error in NotificationService.markAllAsRead:', error);
      throw error;
    }
  }

  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      return await this.repository.delete(notificationId);
    } catch (error: any) {
      logger.error('Error in NotificationService.deleteNotification:', error);
      throw error;
    }
  }

  async deleteAllForReceiver(receiverAddress: string): Promise<number> {
    try {
      return await this.repository.deleteAllForReceiver(receiverAddress);
    } catch (error: any) {
      logger.error('Error in NotificationService.deleteAllForReceiver:', error);
      throw error;
    }
  }

  async cleanupOldNotifications(daysOld: number = 90): Promise<number> {
    try {
      return await this.repository.deleteOldNotifications(daysOld);
    } catch (error: any) {
      logger.error('Error in NotificationService.cleanupOldNotifications:', error);
      throw error;
    }
  }

  async createSubscriptionPausedNotification(
    shopAddress: string,
    reason?: string
  ): Promise<Notification> {
    const message = this.messageTemplates.subscription_paused({ reason });

    return this.createNotification({
      senderAddress: 'SYSTEM',
      receiverAddress: shopAddress,
      notificationType: 'subscription_paused',
      message,
      metadata: {
        reason,
        timestamp: new Date().toISOString()
      }
    });
  }

  async createSubscriptionResumedNotification(
    shopAddress: string
  ): Promise<Notification> {
    const message = this.messageTemplates.subscription_resumed();

    return this.createNotification({
      senderAddress: 'SYSTEM',
      receiverAddress: shopAddress,
      notificationType: 'subscription_resumed',
      message,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  }

  async createSubscriptionCancelledNotification(
    shopAddress: string,
    reason?: string,
    effectiveDate?: Date | string
  ): Promise<Notification> {
    const message = this.messageTemplates.subscription_cancelled({ reason, effectiveDate });

    return this.createNotification({
      senderAddress: 'SYSTEM',
      receiverAddress: shopAddress,
      notificationType: 'subscription_cancelled',
      message,
      metadata: {
        reason,
        effectiveDate: effectiveDate ? new Date(effectiveDate).toISOString() : null,
        timestamp: new Date().toISOString()
      }
    });
  }

  async createSubscriptionSelfCancelledNotification(
    shopAddress: string,
    reason?: string,
    effectiveDate?: Date | string
  ): Promise<Notification> {
    const message = this.messageTemplates.subscription_self_cancelled({ reason, effectiveDate });

    return this.createNotification({
      senderAddress: 'SYSTEM',
      receiverAddress: shopAddress,
      notificationType: 'subscription_self_cancelled',
      message,
      metadata: {
        reason,
        effectiveDate: effectiveDate ? new Date(effectiveDate).toISOString() : null,
        cancelledBy: 'shop',
        timestamp: new Date().toISOString()
      }
    });
  }

  async createSubscriptionApprovedNotification(
    shopAddress: string
  ): Promise<Notification> {
    const message = this.messageTemplates.subscription_approved();

    return this.createNotification({
      senderAddress: 'SYSTEM',
      receiverAddress: shopAddress,
      notificationType: 'subscription_approved',
      message,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  }

  async createSubscriptionReactivatedNotification(
    shopAddress: string
  ): Promise<Notification> {
    const message = this.messageTemplates.subscription_reactivated();

    return this.createNotification({
      senderAddress: 'SYSTEM',
      receiverAddress: shopAddress,
      notificationType: 'subscription_reactivated',
      message,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  }

  // Shop Suspension Notifications

  async createShopSuspendedNotification(
    shopAddress: string,
    shopName?: string,
    reason?: string
  ): Promise<Notification> {
    const message = this.messageTemplates.shop_suspended({ shopName, reason });

    return this.createNotification({
      senderAddress: 'SYSTEM',
      receiverAddress: shopAddress,
      notificationType: 'shop_suspended',
      message,
      metadata: {
        shopName,
        reason,
        timestamp: new Date().toISOString()
      }
    });
  }

  async createShopUnsuspendedNotification(
    shopAddress: string,
    shopName?: string
  ): Promise<Notification> {
    const message = this.messageTemplates.shop_unsuspended({ shopName });

    return this.createNotification({
      senderAddress: 'SYSTEM',
      receiverAddress: shopAddress,
      notificationType: 'shop_unsuspended',
      message,
      metadata: {
        shopName,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Service Marketplace Notifications

  async createServiceBookingReceivedNotification(
    customerAddress: string,
    shopAddress: string,
    customerName: string,
    serviceName: string,
    amount: number,
    orderId: string
  ): Promise<Notification> {
    const message = this.messageTemplates.service_booking_received({ customerName, serviceName, amount });

    return this.createNotification({
      senderAddress: customerAddress,
      receiverAddress: shopAddress,
      notificationType: 'service_booking_received',
      message,
      metadata: {
        customerName,
        serviceName,
        amount,
        orderId,
        timestamp: new Date().toISOString()
      }
    });
  }

  async createServiceOrderCompletedNotification(
    shopAddress: string,
    customerAddress: string,
    shopName: string,
    serviceName: string,
    rcnEarned: number,
    orderId: string
  ): Promise<Notification> {
    const message = this.messageTemplates.service_order_completed({ shopName, serviceName, rcnEarned });

    return this.createNotification({
      senderAddress: shopAddress,
      receiverAddress: customerAddress,
      notificationType: 'service_order_completed',
      message,
      metadata: {
        shopName,
        serviceName,
        rcnEarned,
        orderId,
        timestamp: new Date().toISOString()
      }
    });
  }

  async createServicePaymentFailedNotification(
    customerAddress: string,
    serviceName: string,
    reason: string,
    orderId: string
  ): Promise<Notification> {
    const message = this.messageTemplates.service_payment_failed({ serviceName, reason });

    return this.createNotification({
      senderAddress: 'SYSTEM',
      receiverAddress: customerAddress,
      notificationType: 'service_payment_failed',
      message,
      metadata: {
        serviceName,
        reason,
        orderId,
        timestamp: new Date().toISOString()
      }
    });
  }

  async createServiceOrderCancelledNotification(
    customerAddress: string,
    serviceName: string,
    orderId: string,
    refundStatus?: string
  ): Promise<Notification> {
    const message = this.messageTemplates.service_order_cancelled({ serviceName, refundStatus });

    return this.createNotification({
      senderAddress: 'SYSTEM',
      receiverAddress: customerAddress,
      notificationType: 'service_order_cancelled',
      message,
      metadata: {
        serviceName,
        orderId,
        refundStatus,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Reschedule Request Notifications

  async createRescheduleRequestCreatedNotification(
    customerAddress: string,
    shopAddress: string,
    customerName: string,
    serviceName: string,
    orderId: string,
    requestId: string,
    originalDate: string,
    originalTime: string,
    requestedDate: string,
    requestedTime: string
  ): Promise<Notification> {
    const message = this.messageTemplates.reschedule_request_created({
      customerName,
      serviceName,
      originalDate,
      originalTime,
      requestedDate,
      requestedTime
    });

    return this.createNotification({
      senderAddress: customerAddress,
      receiverAddress: shopAddress,
      notificationType: 'reschedule_request_created',
      message,
      metadata: {
        customerName,
        serviceName,
        orderId,
        requestId,
        originalDate,
        originalTime,
        requestedDate,
        requestedTime,
        timestamp: new Date().toISOString()
      }
    });
  }

  async createRescheduleRequestApprovedNotification(
    shopAddress: string,
    customerAddress: string,
    shopName: string,
    serviceName: string,
    orderId: string,
    requestId: string,
    newDate: string,
    newTime: string
  ): Promise<Notification> {
    const message = this.messageTemplates.reschedule_request_approved({
      shopName,
      serviceName,
      newDate,
      newTime
    });

    return this.createNotification({
      senderAddress: shopAddress,
      receiverAddress: customerAddress,
      notificationType: 'reschedule_request_approved',
      message,
      metadata: {
        shopName,
        serviceName,
        orderId,
        requestId,
        newDate,
        newTime,
        timestamp: new Date().toISOString()
      }
    });
  }

  async createRescheduleRequestRejectedNotification(
    shopAddress: string,
    customerAddress: string,
    shopName: string,
    serviceName: string,
    orderId: string,
    requestId: string,
    reason?: string
  ): Promise<Notification> {
    const message = this.messageTemplates.reschedule_request_rejected({
      shopName,
      serviceName,
      reason
    });

    return this.createNotification({
      senderAddress: shopAddress,
      receiverAddress: customerAddress,
      notificationType: 'reschedule_request_rejected',
      message,
      metadata: {
        shopName,
        serviceName,
        orderId,
        requestId,
        reason,
        timestamp: new Date().toISOString()
      }
    });
  }

  async createRescheduleRequestExpiredNotification(
    customerAddress: string,
    shopName: string,
    serviceName: string,
    orderId: string,
    requestId: string
  ): Promise<Notification> {
    const message = this.messageTemplates.reschedule_request_expired({
      shopName,
      serviceName
    });

    return this.createNotification({
      senderAddress: 'SYSTEM',
      receiverAddress: customerAddress,
      notificationType: 'reschedule_request_expired',
      message,
      metadata: {
        shopName,
        serviceName,
        orderId,
        requestId,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Create notification when shop directly reschedules a booking
   */
  async createBookingRescheduledByShopNotification(
    shopAddress: string,
    customerAddress: string,
    shopName: string,
    serviceName: string,
    orderId: string,
    originalDate: string,
    originalTime: string,
    newDate: string,
    newTime: string,
    reason?: string
  ): Promise<Notification> {
    const message = this.messageTemplates.booking_rescheduled_by_shop({
      shopName,
      serviceName,
      originalDate,
      originalTime,
      newDate,
      newTime,
      reason
    });

    return this.createNotification({
      senderAddress: shopAddress,
      receiverAddress: customerAddress,
      notificationType: 'booking_rescheduled_by_shop',
      message,
      metadata: {
        shopName,
        serviceName,
        orderId,
        originalDate,
        originalTime,
        newDate,
        newTime,
        reason,
        timestamp: new Date().toISOString()
      }
    });
  }

  // ============== SUPPORT TICKET NOTIFICATIONS ==============

  /**
   * Notify admins about new support ticket
   */
  async notifyAdminsAboutNewTicket(ticket: any): Promise<void> {
    // In a real system, you'd get all admin addresses from database
    // For now, this is a placeholder that would emit events to admin dashboard
    logger.info('New support ticket notification sent to admins', {
      ticketId: ticket.ticketId,
      subject: ticket.subject
    });
  }

  /**
   * Notify shop about ticket resolution
   */
  async notifyShopAboutTicketResolution(ticket: any): Promise<Notification> {
    const message = this.messageTemplates.support_ticket_resolved({
      ticketId: ticket.ticketId,
      subject: ticket.subject
    });

    return this.createNotification({
      senderAddress: 'SYSTEM',
      receiverAddress: ticket.shopId,
      notificationType: 'support_ticket_resolved' as any,
      message,
      metadata: {
        ticketId: ticket.ticketId,
        subject: ticket.subject,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Notify shop about ticket assignment
   */
  async notifyShopAboutTicketAssignment(ticket: any): Promise<Notification> {
    const message = this.messageTemplates.support_ticket_assigned({
      ticketId: ticket.ticketId,
      subject: ticket.subject
    });

    return this.createNotification({
      senderAddress: 'SYSTEM',
      receiverAddress: ticket.shopId,
      notificationType: 'support_ticket_assigned' as any,
      message,
      metadata: {
        ticketId: ticket.ticketId,
        subject: ticket.subject,
        assignedTo: ticket.assignedTo,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Notify admins about new message from shop
   */
  async notifyAdminsAboutNewMessage(ticket: any, message: any): Promise<void> {
    logger.info('New support message notification sent to admins', {
      ticketId: ticket.ticketId,
      messageId: message.messageId
    });
  }

  /**
   * Notify shop about new message from admin
   */
  async notifyShopAboutNewMessage(ticket: any, message: any): Promise<Notification> {
    const notificationMessage = this.messageTemplates.support_message_received({
      ticketId: ticket.ticketId,
      senderName: 'Admin Support',
      preview: message.message.substring(0, 50)
    });

    return this.createNotification({
      senderAddress: message.senderId,
      receiverAddress: ticket.shopId,
      notificationType: 'support_message_received' as any,
      message: notificationMessage,
      metadata: {
        ticketId: ticket.ticketId,
        messageId: message.messageId,
        timestamp: new Date().toISOString()
      }
    });
  }
}
