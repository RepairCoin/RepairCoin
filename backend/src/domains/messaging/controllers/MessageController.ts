// backend/src/domains/messaging/controllers/MessageController.ts
import { Request, Response } from 'express';
import { MessageService } from '../services/MessageService';
import { logger } from '../../../utils/logger';

export class MessageController {
  private messageService: MessageService;

  constructor() {
    this.messageService = new MessageService();
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

      if (!userAddress || !userRole) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { conversationId, customerAddress, shopId, messageText, messageType, metadata } = req.body;

      if (!messageText) {
        return res.status(400).json({ success: false, error: 'Message text is required' });
      }

      // Determine sender type based on role
      const senderType = userRole === 'shop' ? 'shop' : 'customer';

      const message = await this.messageService.sendMessage({
        conversationId,
        customerAddress,
        shopId,
        senderAddress: userAddress,
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

      if (!userAddress || !userRole) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      const userType = userRole === 'shop' ? 'shop' : 'customer';

      const result = await this.messageService.getConversations(
        userAddress,
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

      if (!userAddress || !userRole) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { conversationId } = req.params;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      const userType = userRole === 'shop' ? 'shop' : 'customer';

      const result = await this.messageService.getMessages(
        conversationId,
        userAddress,
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

      if (!userAddress || !userRole) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { conversationId } = req.params;
      const userType = userRole === 'shop' ? 'shop' : 'customer';

      await this.messageService.markConversationAsRead(
        conversationId,
        userAddress,
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
}
