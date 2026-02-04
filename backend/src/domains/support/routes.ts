import { Router } from 'express';
import { authMiddleware, requireAdmin, requireRole } from '../../middleware/auth';
import {
  createTicket,
  getShopTickets,
  getTicketById,
  getTicketMessages,
  addMessage,
  markMessagesAsRead,
  getUnreadCount,
  getAllTickets,
  getAdminStats,
  updateTicketStatus,
  assignTicket
} from '../../controllers/SupportChatController';

const router = Router();

const requireShop = requireRole(['shop']);

// Shop endpoints - require shop authentication
router.post('/tickets', authMiddleware, requireShop, createTicket);
router.get('/tickets', authMiddleware, requireShop, getShopTickets);
router.get('/tickets/:id', authMiddleware, getTicketById); // Both shop and admin can access
router.get('/tickets/:id/messages', authMiddleware, getTicketMessages); // Both shop and admin can access
router.post('/tickets/:id/messages', authMiddleware, addMessage); // Both shop and admin can add messages
router.post('/tickets/:id/read', authMiddleware, markMessagesAsRead); // Both shop and admin can mark as read
router.get('/unread-count', authMiddleware, requireShop, getUnreadCount);

// Admin endpoints - require admin authentication
router.get('/admin/tickets', authMiddleware, requireAdmin, getAllTickets);
router.get('/admin/stats', authMiddleware, requireAdmin, getAdminStats);
router.put('/admin/tickets/:id/status', authMiddleware, requireAdmin, updateTicketStatus);
router.put('/admin/tickets/:id/assign', authMiddleware, requireAdmin, assignTicket);

export default router;
