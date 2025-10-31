import { NotificationRepository, CreateNotificationParams, Notification } from '../../../repositories/NotificationRepository';
import { PaginationParams, PaginatedResult } from '../../../repositories/BaseRepository';
import { logger } from '../../../utils/logger';

export interface NotificationMessageTemplates {
  reward_issued: (data: { shopName: string; amount: number }) => string;
  redemption_approval_request: (data: { shopName: string; amount: number }) => string;
  redemption_approved: (data: { customerName: string; amount: number }) => string;
  redemption_rejected: (data: { customerName: string; amount: number }) => string;
  token_gifted: (data: { fromCustomerName: string; amount: number }) => string;
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

      token_gifted: (data) =>
        `You received ${data.amount} RCN gift from ${data.fromCustomerName}!`
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
}
