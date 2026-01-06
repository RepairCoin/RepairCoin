// backend/src/domains/messaging/routes.ts
import { Router } from 'express';
import { MessageController } from './controllers/MessageController';
import { authMiddleware } from '../../middleware/auth';

const router = Router();
const messageController = new MessageController();

// All messaging routes require authentication
router.use(authMiddleware);

/**
 * @route POST /api/messages/send
 * @description Send a message in a conversation
 * @access Authenticated users (Customer or Shop)
 */
router.post('/send', messageController.sendMessage);

/**
 * @route GET /api/messages/conversations
 * @description Get all conversations for the authenticated user
 * @query page - Page number (default: 1)
 * @query limit - Items per page (default: 20)
 * @access Authenticated users (Customer or Shop)
 */
router.get('/conversations', messageController.getConversations);

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

export default router;
