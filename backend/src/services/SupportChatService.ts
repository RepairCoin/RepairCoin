import {
  SupportChatRepository,
  CreateTicketParams,
  CreateMessageParams,
  SupportTicket,
  SupportMessage
} from '../repositories/SupportChatRepository';
import { NotificationService } from '../domains/notification/services/NotificationService';

export class SupportChatService {
  private repository: SupportChatRepository;
  private notificationService: NotificationService;

  constructor() {
    this.repository = new SupportChatRepository();
    this.notificationService = new NotificationService();
  }

  /**
   * Create a new support ticket from a shop
   */
  async createTicket(params: CreateTicketParams): Promise<{ ticket: SupportTicket; message: SupportMessage }> {
    // Validate input
    if (!params.subject || params.subject.trim().length === 0) {
      throw new Error('Ticket subject is required');
    }

    if (!params.message || params.message.trim().length === 0) {
      throw new Error('Initial message is required');
    }

    if (params.subject.length > 255) {
      throw new Error('Subject cannot exceed 255 characters');
    }

    // Set default priority if not provided
    const priority = params.priority || 'medium';

    // Create the ticket
    const result = await this.repository.createTicket({
      ...params,
      priority
    });

    // Send notification to admins about new ticket
    try {
      await this.notifyAdminsOfNewTicket(result.ticket);
    } catch (error) {
      console.error('Failed to notify admins of new ticket:', error);
      // Don't fail the ticket creation if notification fails
    }

    return result;
  }

  /**
   * Get all tickets for a shop
   */
  async getShopTickets(shopId: string, status?: string): Promise<SupportTicket[]> {
    if (!shopId) {
      throw new Error('Shop ID is required');
    }

    return await this.repository.getShopTickets(shopId, status);
  }

  /**
   * Get all tickets for admin view with filters
   */
  async getAllTickets(filters?: {
    status?: string;
    priority?: string;
    assignedTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ tickets: SupportTicket[]; total: number }> {
    return await this.repository.getAllTickets(filters);
  }

  /**
   * Get ticket by ID
   */
  async getTicketById(ticketId: string): Promise<SupportTicket | null> {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }

    return await this.repository.getTicketById(ticketId);
  }

  /**
   * Get messages for a ticket
   */
  async getTicketMessages(
    ticketId: string,
    viewerType: 'shop' | 'admin'
  ): Promise<SupportMessage[]> {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }

    // Shops cannot see internal admin notes
    const includeInternal = viewerType === 'admin';

    return await this.repository.getTicketMessages(ticketId, includeInternal);
  }

  /**
   * Add a message to a ticket
   */
  async createMessage(params: CreateMessageParams): Promise<SupportMessage> {
    // Validate input
    if (!params.ticketId) {
      throw new Error('Ticket ID is required');
    }

    if (!params.message || params.message.trim().length === 0) {
      throw new Error('Message content is required');
    }

    if (!params.senderType || !['shop', 'admin', 'system'].includes(params.senderType)) {
      throw new Error('Valid sender type is required (shop, admin, or system)');
    }

    if (!params.senderId) {
      throw new Error('Sender ID is required');
    }

    // Verify ticket exists
    const ticket = await this.repository.getTicketById(params.ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Verify sender has access to this ticket
    if (params.senderType === 'shop' && ticket.shopId !== params.senderId) {
      throw new Error('You do not have access to this ticket');
    }

    // Create the message
    const message = await this.repository.createMessage(params);

    // Send notifications
    try {
      if (params.senderType === 'shop' && !params.isInternal) {
        // Shop sent a message - notify assigned admin or all admins
        await this.notifyAdminsOfNewMessage(ticket, message);
      } else if (params.senderType === 'admin' && !params.isInternal) {
        // Admin sent a message - notify the shop
        await this.notifyShopOfNewMessage(ticket, message);
      }
    } catch (error) {
      console.error('Failed to send notification for new message:', error);
      // Don't fail the message creation if notification fails
    }

    return message;
  }

  /**
   * Update ticket status
   */
  async updateTicketStatus(
    ticketId: string,
    status: string,
    assignedTo?: string
  ): Promise<SupportTicket> {
    // Validate status
    const validStatuses = ['open', 'in_progress', 'waiting_shop', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Verify ticket exists
    const ticket = await this.repository.getTicketById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Update the ticket
    const updatedTicket = await this.repository.updateTicketStatus(ticketId, status, assignedTo);

    // Send notification to shop about status change
    try {
      await this.notifyShopOfStatusChange(updatedTicket, status);
    } catch (error) {
      console.error('Failed to notify shop of status change:', error);
      // Don't fail the update if notification fails
    }

    return updatedTicket;
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(ticketId: string, viewerType: 'shop' | 'admin'): Promise<void> {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }

    if (!['shop', 'admin'].includes(viewerType)) {
      throw new Error('Viewer type must be shop or admin');
    }

    await this.repository.markMessagesAsRead(ticketId, viewerType);
  }

  /**
   * Get unread ticket count for a shop
   */
  async getUnreadTicketCount(shopId: string): Promise<number> {
    if (!shopId) {
      throw new Error('Shop ID is required');
    }

    return await this.repository.getUnreadTicketCount(shopId);
  }

  /**
   * Get admin statistics
   */
  async getAdminStats(): Promise<{
    total: number;
    open: number;
    inProgress: number;
    waitingShop: number;
    resolved: number;
    unassigned: number;
  }> {
    return await this.repository.getAdminStats();
  }

  /**
   * Notify admins of a new ticket
   */
  private async notifyAdminsOfNewTicket(ticket: SupportTicket): Promise<void> {
    // Get all admin addresses from environment
    const adminAddresses = process.env.ADMIN_ADDRESSES?.split(',').map(addr => addr.trim().toLowerCase()) || [];

    // Send notification to all admins
    for (const adminAddress of adminAddresses) {
      try {
        await this.notificationService.createNotification({
          senderAddress: ticket.shopId,
          receiverAddress: adminAddress,
          notificationType: 'support_ticket_created',
          message: `New support ticket from shop: ${ticket.subject}`,
          metadata: {
            ticketId: ticket.id,
            shopId: ticket.shopId,
            subject: ticket.subject,
            priority: ticket.priority
          }
        });
      } catch (error) {
        console.error(`Failed to notify admin ${adminAddress}:`, error);
      }
    }
  }

  /**
   * Notify admins of a new message
   */
  private async notifyAdminsOfNewMessage(ticket: SupportTicket, message: SupportMessage): Promise<void> {
    // If ticket is assigned, notify only the assigned admin
    if (ticket.assignedTo) {
      await this.notificationService.createNotification({
        senderAddress: ticket.shopId,
        receiverAddress: ticket.assignedTo,
        notificationType: 'support_message_received',
        message: `New message on ticket: ${ticket.subject}`,
        metadata: {
          ticketId: ticket.id,
          messageId: message.id,
          shopId: ticket.shopId,
          subject: ticket.subject
        }
      });
    } else {
      // Notify all admins if unassigned
      const adminAddresses = process.env.ADMIN_ADDRESSES?.split(',').map(addr => addr.trim().toLowerCase()) || [];
      for (const adminAddress of adminAddresses) {
        try {
          await this.notificationService.createNotification({
            senderAddress: ticket.shopId,
            receiverAddress: adminAddress,
            notificationType: 'support_message_received',
            message: `New message on ticket: ${ticket.subject}`,
            metadata: {
              ticketId: ticket.id,
              messageId: message.id,
              shopId: ticket.shopId,
              subject: ticket.subject
            }
          });
        } catch (error) {
          console.error(`Failed to notify admin ${adminAddress}:`, error);
        }
      }
    }
  }

  /**
   * Notify shop of a new admin message
   */
  private async notifyShopOfNewMessage(ticket: SupportTicket, message: SupportMessage): Promise<void> {
    await this.notificationService.createNotification({
      senderAddress: message.senderId,
      receiverAddress: ticket.shopId,
      notificationType: 'support_message_received',
      message: `Admin responded to your ticket: ${ticket.subject}`,
      metadata: {
        ticketId: ticket.id,
        messageId: message.id,
        subject: ticket.subject
      }
    });
  }

  /**
   * Notify shop of status change
   */
  private async notifyShopOfStatusChange(ticket: SupportTicket, newStatus: string): Promise<void> {
    const statusMessages: Record<string, string> = {
      'open': 'Your support ticket is now open',
      'in_progress': 'An admin is working on your ticket',
      'waiting_shop': 'Admin is waiting for your response',
      'resolved': 'Your support ticket has been resolved',
      'closed': 'Your support ticket has been closed'
    };

    const messageText = statusMessages[newStatus] || 'Your support ticket status has been updated';

    await this.notificationService.createNotification({
      senderAddress: ticket.assignedTo || 'system',
      receiverAddress: ticket.shopId,
      notificationType: 'support_ticket_updated',
      message: messageText,
      metadata: {
        ticketId: ticket.id,
        subject: ticket.subject,
        status: newStatus
      }
    });
  }
}

export default new SupportChatService();
