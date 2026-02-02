import express from 'express';
import {
  submitWaitlist,
  getWaitlistEntries,
  getWaitlistStats,
  updateWaitlistStatus,
  deleteWaitlistEntry
} from '../controllers/WaitlistController';
import { authMiddleware, requireAdmin } from '../middleware/auth';

const router = express.Router();

/**
 * @route POST /api/waitlist/submit
 * @desc Submit a new waitlist entry (public)
 * @access Public
 */
router.post('/submit', submitWaitlist);

/**
 * @route GET /api/waitlist/entries
 * @desc Get all waitlist entries with pagination
 * @access Admin only
 */
router.get('/entries', authMiddleware, requireAdmin, getWaitlistEntries);

/**
 * @route GET /api/waitlist/stats
 * @desc Get waitlist statistics
 * @access Admin only
 */
router.get('/stats', authMiddleware, requireAdmin, getWaitlistStats);

/**
 * @route PUT /api/waitlist/:id/status
 * @desc Update waitlist entry status
 * @access Admin only
 */
router.put('/:id/status', authMiddleware, requireAdmin, updateWaitlistStatus);

/**
 * @route DELETE /api/waitlist/:id
 * @desc Delete waitlist entry
 * @access Admin only
 */
router.delete('/:id', authMiddleware, requireAdmin, deleteWaitlistEntry);

export default router;
