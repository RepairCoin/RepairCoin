import { Request, Response } from 'express';
import { NotificationService } from '../services/NotificationService';
import { logger } from '../../../utils/logger';

export class NotificationController {
  private service: NotificationService;

  constructor(service: NotificationService) {
    this.service = service;
  }

  /**
   * Build array of all addresses this user might receive notifications at.
   * For shop users, this includes both their wallet address and shopId,
   * since some notifications (e.g., support) use shopId as receiver.
   */
  private getReceiverAddresses(req: Request): string[] {
    const walletAddress = req.user?.address;
    const shopId = req.user?.shopId;
    return [walletAddress, shopId].filter(Boolean) as string[];
  }

  /**
   * Check if a notification belongs to this user (by any of their addresses).
   */
  private isOwner(notification: { receiverAddress: string }, addresses: string[]): boolean {
    const receiverLower = notification.receiverAddress.toLowerCase();
    return addresses.some(addr => addr.toLowerCase() === receiverLower);
  }

  /**
   * GET /api/notifications
   * Get paginated notifications for authenticated user
   */
  async getNotifications(req: Request, res: Response): Promise<void> {
    try {
      const addresses = this.getReceiverAddresses(req);

      if (addresses.length === 0) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.service.getNotificationsByReceiverMulti(addresses, {
        page,
        limit
      });

      res.json(result);
    } catch (error: any) {
      logger.error('Error in getNotifications:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
    }
  }

  /**
   * GET /api/notifications/unread
   * Get all unread notifications for authenticated user
   */
  async getUnreadNotifications(req: Request, res: Response): Promise<void> {
    try {
      const addresses = this.getReceiverAddresses(req);

      if (addresses.length === 0) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const notifications = await this.service.getUnreadNotificationsMulti(addresses);

      res.json({ notifications });
    } catch (error: any) {
      logger.error('Error in getUnreadNotifications:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch unread notifications' });
    }
  }

  /**
   * GET /api/notifications/unread/count
   * Get unread notification count
   */
  async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const addresses = this.getReceiverAddresses(req);

      if (addresses.length === 0) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const count = await this.service.getUnreadCountMulti(addresses);

      res.json({ count });
    } catch (error: any) {
      logger.error('Error in getUnreadCount:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch unread count' });
    }
  }

  /**
   * GET /api/notifications/:id
   * Get a specific notification by ID
   */
  async getNotificationById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const addresses = this.getReceiverAddresses(req);

      if (addresses.length === 0) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const notification = await this.service.getNotificationById(id);

      if (!notification) {
        res.status(404).json({ error: 'Notification not found' });
        return;
      }

      // Ensure user can only access their own notifications
      if (!this.isOwner(notification, addresses)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      res.json(notification);
    } catch (error: any) {
      logger.error('Error in getNotificationById:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch notification' });
    }
  }

  /**
   * PATCH /api/notifications/:id/read
   * Mark a notification as read
   */
  async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const addresses = this.getReceiverAddresses(req);

      if (addresses.length === 0) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify ownership before marking as read
      const notification = await this.service.getNotificationById(id);

      if (!notification) {
        res.status(404).json({ error: 'Notification not found' });
        return;
      }

      if (!this.isOwner(notification, addresses)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const updatedNotification = await this.service.markAsRead(id);

      res.json(updatedNotification);
    } catch (error: any) {
      logger.error('Error in markAsRead:', error);
      res.status(500).json({ error: error.message || 'Failed to mark notification as read' });
    }
  }

  /**
   * PATCH /api/notifications/read-all
   * Mark all notifications as read
   */
  async markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
      const addresses = this.getReceiverAddresses(req);

      if (addresses.length === 0) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const count = await this.service.markAllAsReadMulti(addresses);

      res.json({ message: `Marked ${count} notifications as read`, count });
    } catch (error: any) {
      logger.error('Error in markAllAsRead:', error);
      res.status(500).json({ error: error.message || 'Failed to mark notifications as read' });
    }
  }

  /**
   * DELETE /api/notifications/:id
   * Delete a notification
   */
  async deleteNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const addresses = this.getReceiverAddresses(req);

      if (addresses.length === 0) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify ownership before deleting
      const notification = await this.service.getNotificationById(id);

      if (!notification) {
        res.status(404).json({ error: 'Notification not found' });
        return;
      }

      if (!this.isOwner(notification, addresses)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      await this.service.deleteNotification(id);

      res.json({ message: 'Notification deleted successfully' });
    } catch (error: any) {
      logger.error('Error in deleteNotification:', error);
      res.status(500).json({ error: error.message || 'Failed to delete notification' });
    }
  }

  /**
   * DELETE /api/notifications
   * Delete all notifications for authenticated user
   */
  async deleteAllNotifications(req: Request, res: Response): Promise<void> {
    try {
      const addresses = this.getReceiverAddresses(req);

      if (addresses.length === 0) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const count = await this.service.deleteAllForReceiverMulti(addresses);

      res.json({ message: `Deleted ${count} notifications`, count });
    } catch (error: any) {
      logger.error('Error in deleteAllNotifications:', error);
      res.status(500).json({ error: error.message || 'Failed to delete notifications' });
    }
  }
}
