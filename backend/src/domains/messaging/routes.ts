// backend/src/domains/messaging/routes.ts
import { Router } from 'express';
import multer from 'multer';
import { MessageController } from './controllers/MessageController';
import { AutoMessageController } from './controllers/AutoMessageController';
import { authMiddleware } from '../../middleware/auth';

const router = Router();
const messageController = new MessageController();
const autoMessageController = new AutoMessageController();

// Multer config for message attachments
const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF'));
    }
  },
});

// All messaging routes require authentication
router.use(authMiddleware);

/**
 * @route POST /api/messages/send
 * @description Send a message in a conversation
 * @access Authenticated users (Customer or Shop)
 */
router.post('/send', messageController.sendMessage);

/**
 * @route POST /api/messages/attachments/upload
 * @description Upload message attachments (images or PDF, up to 5 files, 5MB each)
 * @access Authenticated users (Customer or Shop)
 */
router.post('/attachments/upload', attachmentUpload.array('files', 5), messageController.uploadAttachments);

/**
 * @route GET /api/messages/conversations
 * @description Get all conversations for the authenticated user
 * @query page - Page number (default: 1)
 * @query limit - Items per page (default: 20)
 * @access Authenticated users (Customer or Shop)
 */
router.get('/conversations', messageController.getConversations);

/**
 * @route POST /api/messages/conversations/get-or-create
 * @description Get or create a conversation with a customer (shop only)
 * @body customerAddress - The customer's wallet address
 * @access Authenticated shop users
 */
router.post('/conversations/get-or-create', messageController.getOrCreateConversation);

/**
 * @route GET /api/messages/conversations/:conversationId/messages
 * @description Get all messages in a conversation
 * @param conversationId - The conversation ID
 * @query page - Page number (default: 1)
 * @query limit - Items per page (default: 50)
 * @access Authenticated users (must be part of conversation)
 */
router.get('/conversations/:conversationId/messages', messageController.getMessages);

/**
 * @route POST /api/messages/conversations/:conversationId/read
 * @description Mark all messages in a conversation as read
 * @param conversationId - The conversation ID
 * @access Authenticated users (must be part of conversation)
 */
router.post('/conversations/:conversationId/read', messageController.markAsRead);

/**
 * @route PATCH /api/messages/conversations/:conversationId/archive
 * @description Archive (resolve) or reopen a conversation
 * @param conversationId - The conversation ID
 * @body archived - true to resolve, false to reopen
 * @access Authenticated users (must be part of conversation)
 */
router.patch('/conversations/:conversationId/archive', messageController.archiveConversation);

/**
 * @route GET /api/messages/unread/count
 * @description Get total unread message count for the authenticated user
 * @access Authenticated users (Customer or Shop)
 */
router.get('/unread/count', messageController.getUnreadCount);

/**
 * @route POST /api/messages/conversations/:conversationId/typing
 * @description Set typing indicator for a conversation
 * @param conversationId - The conversation ID
 * @access Authenticated users (must be part of conversation)
 */
router.post('/conversations/:conversationId/typing', messageController.setTyping);

/**
 * @route GET /api/messages/conversations/:conversationId/typing
 * @description Get typing indicators for a conversation
 * @param conversationId - The conversation ID
 * @access Authenticated users
 */
router.get('/conversations/:conversationId/typing', messageController.getTyping);

/**
 * @route POST /api/messages/conversations/:conversationId/block
 * @description Block a conversation
 * @param conversationId - The conversation ID
 * @access Authenticated users (must be part of conversation)
 */
router.post('/conversations/:conversationId/block', messageController.blockConversation);

/**
 * @route POST /api/messages/conversations/:conversationId/unblock
 * @description Unblock a conversation
 * @param conversationId - The conversation ID
 * @access Authenticated users (must be part of conversation)
 */
router.post('/conversations/:conversationId/unblock', messageController.unblockConversation);

/**
 * @route DELETE /api/messages/conversations/:conversationId
 * @description Delete a conversation (soft delete)
 * @param conversationId - The conversation ID
 * @access Authenticated users (must be part of conversation)
 */
router.delete('/conversations/:conversationId', messageController.deleteConversation);

/**
 * @route GET /api/messages/quick-replies
 * @description Get all quick replies for the authenticated shop
 * @access Authenticated shop users
 */
router.get('/quick-replies', messageController.getQuickReplies);

/**
 * @route POST /api/messages/quick-replies
 * @description Create a new quick reply
 * @body title - Quick reply title
 * @body content - Quick reply content
 * @body category - Optional category
 * @access Authenticated shop users
 */
router.post('/quick-replies', messageController.createQuickReply);

/**
 * @route PUT /api/messages/quick-replies/:id
 * @description Update a quick reply
 * @param id - Quick reply ID
 * @body title - New title (optional)
 * @body content - New content (optional)
 * @body category - New category (optional)
 * @access Authenticated shop users
 */
router.put('/quick-replies/:id', messageController.updateQuickReply);

/**
 * @route DELETE /api/messages/quick-replies/:id
 * @description Delete a quick reply
 * @param id - Quick reply ID
 * @access Authenticated shop users
 */
router.delete('/quick-replies/:id', messageController.deleteQuickReply);

/**
 * @route POST /api/messages/quick-replies/:id/use
 * @description Increment usage count for a quick reply
 * @param id - Quick reply ID
 * @access Authenticated shop users
 */
router.post('/quick-replies/:id/use', messageController.useQuickReply);

export default router;
