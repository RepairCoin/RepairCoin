import { BaseRepository, PaginatedResult, PaginationParams } from './BaseRepository';
import { logger } from '../utils/logger';

export interface Notification {
  id: string;
  senderAddress: string;
  receiverAddress: string;
  notificationType: string;
  message: string;
  metadata: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotificationParams {
  senderAddress: string;
  receiverAddress: string;
  notificationType: string;
  message: string;
  metadata?: Record<string, any>;
}

export class NotificationRepository extends BaseRepository {
  async create(params: CreateNotificationParams): Promise<Notification> {
    const {
      senderAddress,
      receiverAddress,
      notificationType,
      message,
      metadata = {}
    } = params;

    try {
      const query = `
        INSERT INTO notifications (
          sender_address,
          receiver_address,
          notification_type,
          message,
          metadata
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const values = [
        senderAddress.toLowerCase(),
        receiverAddress.toLowerCase(),
        notificationType,
        message,
        JSON.stringify(metadata)
      ];

      const result = await this.pool.query(query, values);
      const notification = this.mapSnakeToCamel(result.rows[0]);

      // Parse metadata back to object
      notification.metadata = typeof notification.metadata === 'string'
        ? JSON.parse(notification.metadata)
        : notification.metadata;

      logger.info(`Notification created: ${notification.id} for ${receiverAddress}`);
      return notification;
    } catch (error: any) {
      logger.error('Error creating notification:', error);
      throw new Error(`Failed to create notification: ${error.message}`);
    }
  }

  async findById(id: string): Promise<Notification | null> {
    try {
      const query = 'SELECT * FROM notifications WHERE id = $1';
      const result = await this.pool.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      const notification = this.mapSnakeToCamel(result.rows[0]);
      notification.metadata = typeof notification.metadata === 'string'
        ? JSON.parse(notification.metadata)
        : notification.metadata;

      return notification;
    } catch (error: any) {
      logger.error('Error finding notification by ID:', error);
      throw new Error(`Failed to find notification: ${error.message}`);
    }
  }

  async findByReceiver(
    receiverAddress: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<Notification>> {
    try {
      const offset = this.getPaginationOffset(pagination.page, pagination.limit);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) FROM notifications WHERE receiver_address = $1
      `;
      const countResult = await this.pool.query(countQuery, [receiverAddress.toLowerCase()]);
      const totalItems = parseInt(countResult.rows[0].count, 10);

      // Get paginated items
      const query = `
        SELECT * FROM notifications
        WHERE receiver_address = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;
      const result = await this.pool.query(query, [
        receiverAddress.toLowerCase(),
        pagination.limit,
        offset
      ]);

      const items = result.rows.map(row => {
        const notification = this.mapSnakeToCamel(row);
        notification.metadata = typeof notification.metadata === 'string'
          ? JSON.parse(notification.metadata)
          : notification.metadata;
        return notification;
      });

      const totalPages = Math.ceil(totalItems / pagination.limit);

      return {
        items,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          totalItems,
          totalPages,
          hasMore: pagination.page < totalPages
        }
      };
    } catch (error: any) {
      logger.error('Error finding notifications by receiver:', error);
      throw new Error(`Failed to find notifications: ${error.message}`);
    }
  }

  async findUnreadByReceiver(receiverAddress: string): Promise<Notification[]> {
    try {
      const query = `
        SELECT * FROM notifications
        WHERE receiver_address = $1 AND is_read = false
        ORDER BY created_at DESC
      `;
      const result = await this.pool.query(query, [receiverAddress.toLowerCase()]);

      return result.rows.map(row => {
        const notification = this.mapSnakeToCamel(row);
        notification.metadata = typeof notification.metadata === 'string'
          ? JSON.parse(notification.metadata)
          : notification.metadata;
        return notification;
      });
    } catch (error: any) {
      logger.error('Error finding unread notifications:', error);
      throw new Error(`Failed to find unread notifications: ${error.message}`);
    }
  }

  async getUnreadCount(receiverAddress: string): Promise<number> {
    try {
      const query = `
        SELECT COUNT(*) FROM notifications
        WHERE receiver_address = $1 AND is_read = false
      `;
      const result = await this.pool.query(query, [receiverAddress.toLowerCase()]);
      return parseInt(result.rows[0].count, 10);
    } catch (error: any) {
      logger.error('Error getting unread count:', error);
      throw new Error(`Failed to get unread count: ${error.message}`);
    }
  }

  async markAsRead(id: string): Promise<Notification> {
    try {
      const query = `
        UPDATE notifications
        SET is_read = true, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      const result = await this.pool.query(query, [id]);

      if (result.rows.length === 0) {
        throw new Error('Notification not found');
      }

      const notification = this.mapSnakeToCamel(result.rows[0]);
      notification.metadata = typeof notification.metadata === 'string'
        ? JSON.parse(notification.metadata)
        : notification.metadata;

      logger.info(`Notification marked as read: ${id}`);
      return notification;
    } catch (error: any) {
      logger.error('Error marking notification as read:', error);
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
  }

  async markAllAsRead(receiverAddress: string): Promise<number> {
    try {
      const query = `
        UPDATE notifications
        SET is_read = true, updated_at = NOW()
        WHERE receiver_address = $1 AND is_read = false
      `;
      const result = await this.pool.query(query, [receiverAddress.toLowerCase()]);

      logger.info(`Marked ${result.rowCount} notifications as read for ${receiverAddress}`);
      return result.rowCount || 0;
    } catch (error: any) {
      logger.error('Error marking all notifications as read:', error);
      throw new Error(`Failed to mark all notifications as read: ${error.message}`);
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const query = 'DELETE FROM notifications WHERE id = $1';
      const result = await this.pool.query(query, [id]);

      logger.info(`Notification deleted: ${id}`);
      return (result.rowCount || 0) > 0;
    } catch (error: any) {
      logger.error('Error deleting notification:', error);
      throw new Error(`Failed to delete notification: ${error.message}`);
    }
  }

  async deleteAllForReceiver(receiverAddress: string): Promise<number> {
    try {
      const query = 'DELETE FROM notifications WHERE receiver_address = $1';
      const result = await this.pool.query(query, [receiverAddress.toLowerCase()]);

      logger.info(`Deleted ${result.rowCount} notifications for ${receiverAddress}`);
      return result.rowCount || 0;
    } catch (error: any) {
      logger.error('Error deleting notifications for receiver:', error);
      throw new Error(`Failed to delete notifications: ${error.message}`);
    }
  }

  async deleteOldNotifications(daysOld: number = 90): Promise<number> {
    try {
      const query = `
        DELETE FROM notifications
        WHERE created_at < NOW() - INTERVAL '${daysOld} days'
      `;
      const result = await this.pool.query(query);

      logger.info(`Deleted ${result.rowCount} old notifications (${daysOld}+ days old)`);
      return result.rowCount || 0;
    } catch (error: any) {
      logger.error('Error deleting old notifications:', error);
      throw new Error(`Failed to delete old notifications: ${error.message}`);
    }
  }
}
