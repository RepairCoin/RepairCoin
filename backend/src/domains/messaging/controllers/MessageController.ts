// backend/src/domains/messaging/controllers/MessageController.ts
import { Request, Response } from 'express';
import { MessageService, messageService } from '../services/MessageService';
import { QuickReplyRepository } from '../../../repositories/QuickReplyRepository';
import { imageStorageService } from '../../../services/ImageStorageService';
import { logger } from '../../../utils/logger';

export class MessageController {
  private messageService: MessageService;
  private quickReplyRepo: QuickReplyRepository;

  constructor() {
    this.messageService = messageService;
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

      const { conversationId, customerAddress, shopId, messageText, messageType, metadata, attachments, isEncrypted, clientMessageId } = req.body;

      if (!messageText && (!attachments || attachments.length === 0)) {
        return res.status(400).json({ success: false, error: 'Message text or attachments required' });
      }

      // Validate clientMessageId shape if provided (64-char cap matches DB column)
      if (clientMessageId !== undefined && clientMessageId !== null) {
        if (typeof clientMessageId !== 'string' || clientMessageId.length === 0 || clientMessageId.length > 64) {
          return res.status(400).json({ success: false, error: 'Invalid clientMessageId' });
        }
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
        messageText: messageText || '',
        messageType,
        metadata,
        attachments,
        isEncrypted: isEncrypted || false,
        clientMessageId: clientMessageId || undefined
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
   * Upload message attachments
   * POST /api/messages/attachments/upload
   * Body: multipart/form-data with 'files' field (up to 5 files)
   */
  uploadAttachments = async (req: Request, res: Response) => {
    try {
      const userAddress = req.user?.address;
      if (!userAddress) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const files = req.files as { fieldname: string; originalname: string; encoding: string; mimetype: string; size: number; buffer: Buffer; }[];
      if (!files || files.length === 0) {
        return res.status(400).json({ success: false, error: 'No files provided' });
      }

      const results = await Promise.all(
        files.map(file => imageStorageService.uploadFile(file, 'messages/attachments'))
      );

      const attachments = results
        .map((result, index) => {
          if (!result.success) return null;
          const file = files[index];
          return {
            url: result.url,
            key: result.key,
            type: file.mimetype.startsWith('image/') ? 'image' : 'file',
            name: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
          };
        })
        .filter(Boolean);

      const failed = results.filter(r => !r.success);
      if (attachments.length === 0) {
        return res.status(400).json({
          success: false,
          error: failed[0]?.error || 'All file uploads failed',
        });
      }

      res.json({
        success: true,
        data: attachments,
        ...(failed.length > 0 && { warnings: `${failed.length} file(s) failed to upload` }),
      });
    } catch (error: unknown) {
      logger.error('Error in uploadAttachments controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload attachments',
      });
    }
  };

  /**
   * Get user's conversations
   * GET /api/messages/conversations?page=1&limit=20&archived=false
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
      const archived = req.query.archived === 'true';
      const status = req.query.status as 'open' | 'resolved' | undefined;
      const search = req.query.search as string | undefined;

      const userType = userRole === 'shop' ? 'shop' : 'customer';

      // For shops, pass shopId; for customers, pass wallet address
      const identifier = userRole === 'shop' ? shopId! : userAddress;

      const result = await this.messageService.getConversations(
        identifier,
        userType as 'customer' | 'shop',
        { page, limit, archived, status, search }
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
   * Get a single conversation by ID
   * GET /api/messages/conversations/:conversationId
   */
  getConversation = async (req: Request, res: Response) => {
    try {
      const userAddress = req.user?.address;
      const userRole = req.user?.role;
      const shopId = req.user?.shopId;

      if (!userAddress || !userRole) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      if (userRole === 'shop' && !shopId) {
        return res.status(401).json({ success: false, error: 'Shop ID required' });
      }

      const { conversationId } = req.params;
      const userType = userRole === 'shop' ? 'shop' : 'customer';
      const identifier = userRole === 'shop' ? shopId! : userAddress;

      const conversation = await this.messageService.getConversationById(
        conversationId,
        identifier,
        userType as 'customer' | 'shop'
      );

      res.json({
        success: true,
        data: conversation
      });
    } catch (error: unknown) {
      logger.error('Error in getConversation controller:', error);
      const statusCode = error instanceof Error && error.message === 'Conversation not found' ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get conversation'
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
      const sort = req.query.sort === 'desc' ? 'desc' as const : 'asc' as const;

      const userType = userRole === 'shop' ? 'shop' : 'customer';

      // For shops, pass shopId; for customers, pass wallet address
      const identifier = userRole === 'shop' ? shopId! : userAddress;

      const result = await this.messageService.getMessages(
        conversationId,
        identifier,
        userType as 'customer' | 'shop',
        { page, limit, sort }
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
   * Archive or reopen a conversation
   * PATCH /api/messages/conversations/:conversationId/archive
   * Body: { archived: boolean }
   */
  archiveConversation = async (req: Request, res: Response) => {
    try {
      const userAddress = req.user?.address;
      const userRole = req.user?.role;
      const shopId = req.user?.shopId;

      if (!userAddress || !userRole) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      if (userRole === 'shop' && !shopId) {
        return res.status(401).json({ success: false, error: 'Shop ID required' });
      }

      const { conversationId } = req.params;
      const { archived } = req.body;

      if (typeof archived !== 'boolean') {
        return res.status(400).json({ success: false, error: 'archived (boolean) is required' });
      }

      const userType = userRole === 'shop' ? 'shop' : 'customer';
      const identifier = userRole === 'shop' ? shopId! : userAddress;

      await this.messageService.setConversationArchived(
        conversationId,
        identifier,
        userType as 'customer' | 'shop',
        archived
      );

      res.json({
        success: true,
        message: archived ? 'Conversation resolved' : 'Conversation reopened'
      });
    } catch (error: unknown) {
      logger.error('Error in archiveConversation controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update conversation'
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

  /**
   * Block a conversation
   * POST /api/messages/conversations/:conversationId/block
   */
  blockConversation = async (req: Request, res: Response) => {
    try {
      const userAddress = req.user?.address;
      const userRole = req.user?.role;
      const shopId = req.user?.shopId;

      if (!userAddress || !userRole) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      if (userRole === 'shop' && !shopId) {
        return res.status(401).json({ success: false, error: 'Shop ID required' });
      }

      const { conversationId } = req.params;
      const userType = userRole === 'shop' ? 'shop' : 'customer';
      const identifier = userRole === 'shop' ? shopId! : userAddress;

      await this.messageService.blockConversation(conversationId, identifier, userType as 'customer' | 'shop');

      res.json({
        success: true,
        message: 'Conversation blocked'
      });
    } catch (error: unknown) {
      logger.error('Error in blockConversation controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to block conversation'
      });
    }
  };

  /**
   * Unblock a conversation
   * POST /api/messages/conversations/:conversationId/unblock
   */
  unblockConversation = async (req: Request, res: Response) => {
    try {
      const userAddress = req.user?.address;
      const userRole = req.user?.role;
      const shopId = req.user?.shopId;

      if (!userAddress || !userRole) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      if (userRole === 'shop' && !shopId) {
        return res.status(401).json({ success: false, error: 'Shop ID required' });
      }

      const { conversationId } = req.params;
      const userType = userRole === 'shop' ? 'shop' : 'customer';
      const identifier = userRole === 'shop' ? shopId! : userAddress;

      await this.messageService.unblockConversation(conversationId, identifier, userType as 'customer' | 'shop');

      res.json({
        success: true,
        message: 'Conversation unblocked'
      });
    } catch (error: unknown) {
      logger.error('Error in unblockConversation controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unblock conversation'
      });
    }
  };

  /**
   * Delete a conversation (soft delete)
   * DELETE /api/messages/conversations/:conversationId
   */
  deleteConversation = async (req: Request, res: Response) => {
    try {
      const userAddress = req.user?.address;
      const userRole = req.user?.role;
      const shopId = req.user?.shopId;

      if (!userAddress || !userRole) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      if (userRole === 'shop' && !shopId) {
        return res.status(401).json({ success: false, error: 'Shop ID required' });
      }

      const { conversationId } = req.params;
      const userType = userRole === 'shop' ? 'shop' : 'customer';
      const identifier = userRole === 'shop' ? shopId! : userAddress;

      await this.messageService.deleteConversation(conversationId, identifier, userType as 'customer' | 'shop');

      res.json({
        success: true,
        message: 'Conversation deleted'
      });
    } catch (error: unknown) {
      logger.error('Error in deleteConversation controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete conversation'
      });
    }
  };

  /**
   * Resolve a conversation
   * POST /api/messages/conversations/:conversationId/resolve
   */
  resolveConversation = async (req: Request, res: Response) => {
    try {
      const userAddress = req.user?.address;
      const userRole = req.user?.role;
      const shopId = req.user?.shopId;

      if (!userAddress || !userRole) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      if (userRole === 'shop' && !shopId) {
        return res.status(401).json({ success: false, error: 'Shop ID required' });
      }

      const { conversationId } = req.params;
      const userType = userRole === 'shop' ? 'shop' : 'customer';
      const identifier = userRole === 'shop' ? shopId! : userAddress;

      await this.messageService.resolveConversation(conversationId, identifier, userType as 'customer' | 'shop');

      res.json({
        success: true,
        message: 'Conversation resolved'
      });
    } catch (error: unknown) {
      logger.error('Error in resolveConversation controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resolve conversation'
      });
    }
  };

  /**
   * Reopen a resolved conversation
   * POST /api/messages/conversations/:conversationId/reopen
   */
  reopenConversation = async (req: Request, res: Response) => {
    try {
      const userAddress = req.user?.address;
      const userRole = req.user?.role;
      const shopId = req.user?.shopId;

      if (!userAddress || !userRole) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      if (userRole === 'shop' && !shopId) {
        return res.status(401).json({ success: false, error: 'Shop ID required' });
      }

      const { conversationId } = req.params;
      const userType = userRole === 'shop' ? 'shop' : 'customer';
      const identifier = userRole === 'shop' ? shopId! : userAddress;

      await this.messageService.reopenConversation(conversationId, identifier, userType as 'customer' | 'shop');

      res.json({
        success: true,
        message: 'Conversation reopened'
      });
    } catch (error: unknown) {
      logger.error('Error in reopenConversation controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reopen conversation'
      });
    }
  };
}
