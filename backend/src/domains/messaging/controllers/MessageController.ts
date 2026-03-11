// backend/src/domains/messaging/controllers/MessageController.ts
import { Request, Response } from 'express';
import { MessageService } from '../services/MessageService';
import { QuickReplyRepository } from '../../../repositories/QuickReplyRepository';
import { logger } from '../../../utils/logger';

export class MessageController {
  private messageService: MessageService;
  private quickReplyRepo: QuickReplyRepository;

  constructor() {
    this.messageService = new MessageService();
    this.quickReplyRepo = new QuickReplyRepository();
  }

  /**
   * Send a message
   * POST /api/messages/send
   * Body: { conversationId?, customerAddress?, shopId?, messageText, messageType?, metadata? }
   */
  sendMessage = async (req: Request, res: Response) => {
    try {
      const userAddress = req.user?.address;
      const userRole = req.user?.role;
      const userShopId = req.user?.shopId;

      if (!userAddress || !userRole) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      // For shops, we need the shopId
      if (userRole === 'shop' && !userShopId) {
        return res.status(401).json({ success: false, error: 'Shop ID required' });
      }

      const { conversationId, customerAddress, shopId, messageText, messageType, metadata } = req.body;

      if (!messageText) {
        return res.status(400).json({ success: false, error: 'Message text is required' });
      }

      // Determine sender type based on role
      const senderType = userRole === 'shop' ? 'shop' : 'customer';

      // For shops, senderIdentifier is shopId; for customers, it's wallet address
      const senderIdentifier = userRole === 'shop' ? userShopId! : userAddress;

      const message = await this.messageService.sendMessage({
        conversationId,
        customerAddress,
        shopId,
        senderIdentifier,
        senderType: senderType as 'customer' | 'shop',
        messageText,
        messageType,
        metadata
      });

      res.status(201).json({
        success: true,
        data: message
      });
    } catch (error: unknown) {
      logger.error('Error in sendMessage controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send message'
      });
    }
  };

  /**
   * Get user's conversations
   * GET /api/messages/conversations?page=1&limit=20
   */
  getConversations = async (req: Request, res: Response) => {
    try {
      const userAddress = req.user?.address;
      const userRole = req.user?.role;
      const shopId = req.user?.shopId;

      if (!userAddress || !userRole) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      // For shops, we need the shopId to filter conversations
      if (userRole === 'shop' && !shopId) {
        return res.status(401).json({ success: false, error: 'Shop ID required' });
      }

      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      const userType = userRole === 'shop' ? 'shop' : 'customer';

      // For shops, pass shopId; for customers, pass wallet address
      const identifier = userRole === 'shop' ? shopId! : userAddress;

      const result = await this.messageService.getConversations(
        identifier,
        userType as 'customer' | 'shop',
        { page, limit }
      );

      res.json({
        success: true,
        data: result.items,
        pagination: result.pagination
      });
    } catch (error: unknown) {
      logger.error('Error in getConversations controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get conversations'
      });
    }
  };

  /**
   * Get messages in a conversation
   * GET /api/messages/conversations/:conversationId/messages?page=1&limit=50
   */
  getMessages = async (req: Request, res: Response) => {
    try {
      const userAddress = req.user?.address;
      const userRole = req.user?.role;
      const shopId = req.user?.shopId;

      if (!userAddress || !userRole) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      // For shops, we need the shopId
      if (userRole === 'shop' && !shopId) {
        return res.status(401).json({ success: false, error: 'Shop ID required' });
      }

      const { conversationId } = req.params;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      const userType = userRole === 'shop' ? 'shop' : 'customer';

      // For shops, pass shopId; for customers, pass wallet address
      const identifier = userRole === 'shop' ? shopId! : userAddress;

      const result = await this.messageService.getMessages(
        conversationId,
        identifier,
        userType as 'customer' | 'shop',
        { page, limit }
      );

      res.json({
        success: true,
        data: result.items,
        pagination: result.pagination
      });
    } catch (error: unknown) {
      logger.error('Error in getMessages controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get messages'
      });
    }
  };

  /**
   * Mark conversation as read
   * POST /api/messages/conversations/:conversationId/read
   */
  markAsRead = async (req: Request, res: Response) => {
    try {
      const userAddress = req.user?.address;
      const userRole = req.user?.role;
      const shopId = req.user?.shopId;

      if (!userAddress || !userRole) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      // For shops, we need the shopId
      if (userRole === 'shop' && !shopId) {
        return res.status(401).json({ success: false, error: 'Shop ID required' });
      }

      const { conversationId } = req.params;
      const userType = userRole === 'shop' ? 'shop' : 'customer';

      // For shops, pass shopId; for customers, pass wallet address
      const identifier = userRole === 'shop' ? shopId! : userAddress;

      await this.messageService.markConversationAsRead(
        conversationId,
        identifier,
        userType as 'customer' | 'shop'
      );

      res.json({
        success: true,
        message: 'Conversation marked as read'
      });
    } catch (error: unknown) {
      logger.error('Error in markAsRead controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark as read'
      });
    }
  };

  /**
   * Get total unread message count
   * GET /api/messages/unread/count
   */
  getUnreadCount = async (req: Request, res: Response) => {
    try {
      const userAddress = req.user?.address;
      const userRole = req.user?.role;
      const shopId = req.user?.shopId;

      if (!userAddress || !userRole) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      // For shops, we need the shopId
      if (userRole === 'shop' && !shopId) {
        return res.status(401).json({ success: false, error: 'Shop ID required' });
      }

      const userType = userRole === 'shop' ? 'shop' : 'customer';
      const identifier = userRole === 'shop' ? shopId! : userAddress;

      const count = await this.messageService.getTotalUnreadCount(identifier, userType as 'customer' | 'shop');

      res.json({
        success: true,
        count
      });
    } catch (error: unknown) {
      logger.error('Error in getUnreadCount controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get unread count'
      });
    }
  };

  /**
   * Set typing indicator
   * POST /api/messages/conversations/:conversationId/typing
   */
  setTyping = async (req: Request, res: Response) => {
    try {
      const userAddress = req.user?.address;
      const userRole = req.user?.role;

      if (!userAddress || !userRole) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { conversationId } = req.params;
      const userType = userRole === 'shop' ? 'shop' : 'customer';

      await this.messageService.setTypingIndicator(
        conversationId,
        userAddress,
        userType as 'customer' | 'shop'
      );

      res.json({
        success: true,
        message: 'Typing indicator set'
      });
    } catch (error: unknown) {
      logger.error('Error in setTyping controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set typing indicator'
      });
    }
  };

  /**
   * Get or create a conversation with a customer
   * POST /api/messages/conversations/get-or-create
   * Body: { customerAddress: string }
   */
  getOrCreateConversation = async (req: Request, res: Response) => {
    try {
      const userRole = req.user?.role;
      const shopId = req.user?.shopId;

      if (!userRole) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      if (userRole !== 'shop' || !shopId) {
        return res.status(403).json({ success: false, error: 'Only shops can initiate conversations' });
      }

      const { customerAddress } = req.body;

      if (!customerAddress) {
        return res.status(400).json({ success: false, error: 'customerAddress is required' });
      }

      const conversation = await this.messageService.getOrCreateConversation(customerAddress, shopId);

      res.json({
        success: true,
        data: conversation
      });
    } catch (error: unknown) {
      logger.error('Error in getOrCreateConversation controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get or create conversation'
      });
    }
  };

  /**
   * Get typing indicators for a conversation
   * GET /api/messages/conversations/:conversationId/typing
   */
  getTyping = async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;

      const indicators = await this.messageService.getTypingIndicators(conversationId);

      res.json({
        success: true,
        data: indicators
      });
    } catch (error: unknown) {
      logger.error('Error in getTyping controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get typing indicators'
      });
    }
  };

  /**
   * Get quick replies for the authenticated shop
   * GET /api/messages/quick-replies
   */
  getQuickReplies = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const replies = await this.quickReplyRepo.getByShopId(shopId);
      res.json({ success: true, data: replies });
    } catch (error: unknown) {
      logger.error('Error in getQuickReplies controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get quick replies'
      });
    }
  };

  /**
   * Create a new quick reply
   * POST /api/messages/quick-replies
   * Body: { title, content, category? }
   */
  createQuickReply = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { title, content, category } = req.body;
      if (!title || !content) {
        return res.status(400).json({ success: false, error: 'Title and content are required' });
      }

      const reply = await this.quickReplyRepo.create({ shopId, title, content, category });
      res.status(201).json({ success: true, data: reply });
    } catch (error: unknown) {
      logger.error('Error in createQuickReply controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create quick reply'
      });
    }
  };

  /**
   * Update a quick reply
   * PUT /api/messages/quick-replies/:id
   * Body: { title?, content?, category? }
   */
  updateQuickReply = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { id } = req.params;
      const { title, content, category } = req.body;

      const reply = await this.quickReplyRepo.update(id, shopId, { title, content, category });
      if (!reply) {
        return res.status(404).json({ success: false, error: 'Quick reply not found' });
      }

      res.json({ success: true, data: reply });
    } catch (error: unknown) {
      logger.error('Error in updateQuickReply controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update quick reply'
      });
    }
  };

  /**
   * Delete a quick reply
   * DELETE /api/messages/quick-replies/:id
   */
  deleteQuickReply = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { id } = req.params;
      const deleted = await this.quickReplyRepo.delete(id, shopId);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Quick reply not found' });
      }

      res.json({ success: true, message: 'Quick reply deleted' });
    } catch (error: unknown) {
      logger.error('Error in deleteQuickReply controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete quick reply'
      });
    }
  };

  /**
   * Increment usage count for a quick reply
   * POST /api/messages/quick-replies/:id/use
   */
  useQuickReply = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { id } = req.params;
      await this.quickReplyRepo.incrementUsage(id);
      res.json({ success: true, message: 'Usage count incremented' });
    } catch (error: unknown) {
      logger.error('Error in useQuickReply controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to increment usage'
      });
    }
  };
}
