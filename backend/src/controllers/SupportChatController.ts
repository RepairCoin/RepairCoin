import { Request, Response } from 'express';
import { SupportChatService } from '../services/SupportChatService';

const supportChatService = new SupportChatService();

/**
 * Create a new support ticket
 * POST /api/support/tickets
 */
export const createTicket = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { subject, message, priority, category } = req.body;
    const shopId = req.user?.shopId;
    const userRole = req.user?.role;

    // Verify user is a shop
    if (userRole !== 'shop') {
      return res.status(403).json({
        success: false,
        error: 'Only shops can create support tickets'
      });
    }

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        error: 'Subject and message are required'
      });
    }

    const result = await supportChatService.createTicket({
      shopId: shopId!,
      subject,
      message,
      priority,
      category
    });

    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create support ticket'
    });
  }
};

/**
 * Get all tickets for the authenticated shop
 * GET /api/support/tickets
 */
export const getShopTickets = async (req: Request, res: Response): Promise<Response> => {
  try {
    const shopId = req.user?.shopId;
    const userRole = req.user?.role;
    const { status } = req.query;

    // Verify user is a shop
    if (userRole !== 'shop') {
      return res.status(403).json({
        success: false,
        error: 'Only shops can access this endpoint'
      });
    }

    const tickets = await supportChatService.getShopTickets(
      shopId!,
      status as string | undefined
    );

    return res.status(200).json({
      success: true,
      data: tickets
    });
  } catch (error) {
    console.error('Error fetching shop tickets:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch tickets'
    });
  }
};

/**
 * Get ticket by ID
 * GET /api/support/tickets/:id
 */
export const getTicketById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const shopId = req.user?.shopId;
    const userRole = req.user?.role;

    const ticket = await supportChatService.getTicketById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    // Verify access: shops can only see their own tickets, admins can see all
    if (userRole === 'shop' && ticket.shopId !== shopId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this ticket'
      });
    }

    return res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch ticket'
    });
  }
};

/**
 * Get messages for a ticket
 * GET /api/support/tickets/:id/messages
 */
export const getTicketMessages = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const shopId = req.user?.shopId;
    const userRole = req.user?.role;

    // Verify ticket exists and user has access
    const ticket = await supportChatService.getTicketById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    // Verify access: shops can only see their own tickets, admins can see all
    if (userRole === 'shop' && ticket.shopId !== shopId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this ticket'
      });
    }

    const messages = await supportChatService.getTicketMessages(
      id,
      userRole as 'shop' | 'admin'
    );

    return res.status(200).json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('Error fetching ticket messages:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch messages'
    });
  }
};

/**
 * Add a message to a ticket
 * POST /api/support/tickets/:id/messages
 */
export const addMessage = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { message, isInternal } = req.body;
    const userAddress = req.user?.address;
    const shopId = req.user?.shopId;
    const userRole = req.user?.role;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Verify ticket exists and user has access
    const ticket = await supportChatService.getTicketById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    // Verify access: shops can only message their own tickets, admins can message all
    if (userRole === 'shop' && ticket.shopId !== shopId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this ticket'
      });
    }

    // Only admins can send internal messages
    if (isInternal && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can send internal messages'
      });
    }

    const newMessage = await supportChatService.createMessage({
      ticketId: id,
      senderType: userRole as 'shop' | 'admin',
      senderId: userRole === 'shop' ? shopId! : userAddress!,
      message,
      isInternal: isInternal || false
    });

    return res.status(201).json({
      success: true,
      data: newMessage
    });
  } catch (error) {
    console.error('Error adding message:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add message'
    });
  }
};

/**
 * Mark messages as read
 * POST /api/support/tickets/:id/read
 */
export const markMessagesAsRead = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const shopId = req.user?.shopId;
    const userRole = req.user?.role;

    // Verify ticket exists and user has access
    const ticket = await supportChatService.getTicketById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    // Verify access: shops can only mark their own tickets, admins can mark all
    if (userRole === 'shop' && ticket.shopId !== shopId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this ticket'
      });
    }

    await supportChatService.markMessagesAsRead(id, userRole as 'shop' | 'admin');

    return res.status(200).json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark messages as read'
    });
  }
};

/**
 * Get unread ticket count for shop
 * GET /api/support/unread-count
 */
export const getUnreadCount = async (req: Request, res: Response): Promise<Response> => {
  try {
    const shopId = req.user?.shopId;
    const userRole = req.user?.role;

    // Verify user is a shop
    if (userRole !== 'shop') {
      return res.status(403).json({
        success: false,
        error: 'Only shops can access this endpoint'
      });
    }

    const count = await supportChatService.getUnreadTicketCount(shopId!);

    return res.status(200).json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch unread count'
    });
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get all tickets (admin only)
 * GET /api/support/admin/tickets
 */
export const getAllTickets = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { status, priority, assignedTo, limit, offset } = req.query;

    const filters = {
      status: status as string | undefined,
      priority: priority as string | undefined,
      assignedTo: assignedTo as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined
    };

    const result = await supportChatService.getAllTickets(filters);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching all tickets:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch tickets'
    });
  }
};

/**
 * Get admin statistics
 * GET /api/support/admin/stats
 */
export const getAdminStats = async (req: Request, res: Response): Promise<Response> => {
  try {
    const stats = await supportChatService.getAdminStats();

    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch statistics'
    });
  }
};

/**
 * Update ticket status (admin only)
 * PUT /api/support/admin/tickets/:id/status
 */
export const updateTicketStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { status, assignedTo } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    const ticket = await supportChatService.updateTicketStatus(id, status, assignedTo);

    return res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update ticket status'
    });
  }
};

/**
 * Assign ticket to admin (admin only)
 * PUT /api/support/admin/tickets/:id/assign
 */
export const assignTicket = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    if (!assignedTo) {
      return res.status(400).json({
        success: false,
        error: 'Assigned admin address is required'
      });
    }

    // Get current ticket to preserve status
    const currentTicket = await supportChatService.getTicketById(id);

    if (!currentTicket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    // Update with current status and new assignment
    const ticket = await supportChatService.updateTicketStatus(
      id,
      currentTicket.status,
      assignedTo.toLowerCase()
    );

    return res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error('Error assigning ticket:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign ticket'
    });
  }
};
