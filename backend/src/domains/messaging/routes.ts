// backend/src/domains/messaging/routes.ts
import { Router } from 'express';
import { MessageController } from './controllers/MessageController';
import { AutoMessageController } from './controllers/AutoMessageController';
import { authMiddleware } from '../../middleware/auth';

const router = Router();
const messageController = new MessageController();
const autoMessageController = new AutoMessageController();

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
 * @route GET /api/messages/quick-replies
 * @description Get all quick replies for the authenticated shop
 * @access Authenticated shop users
 */
router.get('/quick-replies', messageController.getQuickReplies);

/**
 * @route POST /api/messages/quick-replies
 * @description Create a new quick reply
 * @body title - Short label for the reply
 * @body content - Full message content
 * @body category - Optional category (general, booking, payment, greeting)
 * @access Authenticated shop users
 */
router.post('/quick-replies', messageController.createQuickReply);

/**
 * @route PUT /api/messages/quick-replies/:id
 * @description Update an existing quick reply
 * @param id - Quick reply ID
 * @body title? - Updated title
 * @body content? - Updated content
 * @body category? - Updated category
 * @access Authenticated shop users
 */
router.put('/quick-replies/:id', messageController.updateQuickReply);

/**
 * @route DELETE /api/messages/quick-replies/:id
 * @description Delete a quick reply (soft delete)
 * @param id - Quick reply ID
 * @access Authenticated shop users
 */
router.delete('/quick-replies/:id', messageController.deleteQuickReply);

/**
 * @route POST /api/messages/quick-replies/:id/use
 * @description Increment usage count when a quick reply is sent
 * @param id - Quick reply ID
 * @access Authenticated shop users
 */
router.post('/quick-replies/:id/use', messageController.useQuickReply);

// ============ Auto-Messages ============

/**
 * @route GET /api/messages/auto-messages
 * @description Get all auto-message rules for the authenticated shop
 * @access Authenticated shop users
 */
router.get('/auto-messages', autoMessageController.getAutoMessages);

/**
 * @route POST /api/messages/auto-messages
 * @description Create a new auto-message rule
 * @body name - Rule name
 * @body messageTemplate - Message template with {{variable}} placeholders
 * @body triggerType - 'schedule' or 'event'
 * @body scheduleType? - 'daily' | 'weekly' | 'monthly' (for schedule triggers)
 * @body scheduleDayOfWeek? - 0-6 (for weekly)
 * @body scheduleDayOfMonth? - 1-31 (for monthly)
 * @body scheduleHour? - 0-23 (default: 10)
 * @body eventType? - 'booking_completed' | 'booking_cancelled' | 'first_visit' | 'inactive_30_days'
 * @body delayHours? - Hours after event to send (default: 0)
 * @body targetAudience? - 'all' | 'active' | 'inactive_30d' | 'has_balance' | 'completed_booking'
 * @body maxSendsPerCustomer? - Max sends per customer (default: 1)
 * @access Authenticated shop users
 */
router.post('/auto-messages', autoMessageController.createAutoMessage);

/**
 * @route PUT /api/messages/auto-messages/:id
 * @description Update an existing auto-message rule
 * @param id - Auto-message rule ID
 * @access Authenticated shop users
 */
router.put('/auto-messages/:id', autoMessageController.updateAutoMessage);

/**
 * @route DELETE /api/messages/auto-messages/:id
 * @description Delete an auto-message rule and its send history
 * @param id - Auto-message rule ID
 * @access Authenticated shop users
 */
router.delete('/auto-messages/:id', autoMessageController.deleteAutoMessage);

/**
 * @route PATCH /api/messages/auto-messages/:id/toggle
 * @description Enable/disable an auto-message rule
 * @param id - Auto-message rule ID
 * @access Authenticated shop users
 */
router.patch('/auto-messages/:id/toggle', autoMessageController.toggleAutoMessage);

/**
 * @route GET /api/messages/auto-messages/:id/history
 * @description Get send history for an auto-message rule
 * @param id - Auto-message rule ID
 * @query page - Page number (default: 1)
 * @query limit - Items per page (default: 20)
 * @access Authenticated shop users
 */
router.get('/auto-messages/:id/history', autoMessageController.getAutoMessageHistory);

export default router;
