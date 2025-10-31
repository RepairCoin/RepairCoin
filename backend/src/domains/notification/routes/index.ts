import { Router } from 'express';
import { authMiddleware } from '../../../middleware/auth';
import { NotificationController } from '../controllers/NotificationController';
import { NotificationService } from '../services/NotificationService';

const router = Router();

// Initialize service and controller
const notificationService = new NotificationService();
const notificationController = new NotificationController(notificationService);

// All notification routes require authentication
router.use(authMiddleware);

/**
 * @route   GET /api/notifications
 * @desc    Get paginated notifications for authenticated user
 * @access  Private
 */
router.get('/', (req, res) => notificationController.getNotifications(req, res));

/**
 * @route   GET /api/notifications/unread
 * @desc    Get all unread notifications
 * @access  Private
 */
router.get('/unread', (req, res) => notificationController.getUnreadNotifications(req, res));

/**
 * @route   GET /api/notifications/unread/count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get('/unread/count', (req, res) => notificationController.getUnreadCount(req, res));

/**
 * @route   GET /api/notifications/:id
 * @desc    Get a specific notification by ID
 * @access  Private
 */
router.get('/:id', (req, res) => notificationController.getNotificationById(req, res));

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private
 */
router.patch('/:id/read', (req, res) => notificationController.markAsRead(req, res));

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.patch('/read-all', (req, res) => notificationController.markAllAsRead(req, res));

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete('/:id', (req, res) => notificationController.deleteNotification(req, res));

/**
 * @route   DELETE /api/notifications
 * @desc    Delete all notifications for authenticated user
 * @access  Private
 */
router.delete('/', (req, res) => notificationController.deleteAllNotifications(req, res));

export default router;
