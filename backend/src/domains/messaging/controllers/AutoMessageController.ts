// backend/src/domains/messaging/controllers/AutoMessageController.ts
import { Request, Response } from 'express';
import { AutoMessageRepository } from '../../../repositories/AutoMessageRepository';
import { logger } from '../../../utils/logger';

const VALID_TRIGGER_TYPES = ['schedule', 'event'];
const VALID_SCHEDULE_TYPES = ['daily', 'weekly', 'monthly'];
const VALID_EVENT_TYPES = ['booking_completed', 'booking_cancelled', 'first_visit', 'inactive_30_days'];
const VALID_TARGET_AUDIENCES = ['all', 'active', 'inactive_30d', 'has_balance', 'completed_booking'];

export class AutoMessageController {
  private autoMessageRepo: AutoMessageRepository;

  constructor() {
    this.autoMessageRepo = new AutoMessageRepository();
  }

  /**
   * Get all auto-message rules for the authenticated shop
   * GET /api/messages/auto-messages
   */
  getAutoMessages = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const rules = await this.autoMessageRepo.getByShopId(shopId);
      res.json({ success: true, data: rules });
    } catch (error: unknown) {
      logger.error('Error in getAutoMessages controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get auto-messages'
      });
    }
  };

  /**
   * Create a new auto-message rule
   * POST /api/messages/auto-messages
   */
  createAutoMessage = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { name, messageTemplate, triggerType, scheduleType, scheduleDayOfWeek, scheduleDayOfMonth, scheduleHour, eventType, delayHours, targetAudience, maxSendsPerCustomer } = req.body;

      // Validation
      if (!name || !messageTemplate || !triggerType) {
        return res.status(400).json({ success: false, error: 'name, messageTemplate, and triggerType are required' });
      }

      if (!VALID_TRIGGER_TYPES.includes(triggerType)) {
        return res.status(400).json({ success: false, error: `triggerType must be one of: ${VALID_TRIGGER_TYPES.join(', ')}` });
      }

      if (messageTemplate.length > 2000) {
        return res.status(400).json({ success: false, error: 'Message template must be 2000 characters or less' });
      }

      if (triggerType === 'schedule') {
        if (!scheduleType || !VALID_SCHEDULE_TYPES.includes(scheduleType)) {
          return res.status(400).json({ success: false, error: `scheduleType must be one of: ${VALID_SCHEDULE_TYPES.join(', ')}` });
        }
        if (scheduleType === 'weekly' && (scheduleDayOfWeek === undefined || scheduleDayOfWeek < 0 || scheduleDayOfWeek > 6)) {
          return res.status(400).json({ success: false, error: 'scheduleDayOfWeek must be 0-6 (Sunday-Saturday) for weekly schedules' });
        }
        if (scheduleType === 'monthly' && (scheduleDayOfMonth === undefined || scheduleDayOfMonth < 1 || scheduleDayOfMonth > 31)) {
          return res.status(400).json({ success: false, error: 'scheduleDayOfMonth must be 1-31 for monthly schedules' });
        }
      }

      if (triggerType === 'event') {
        if (!eventType || !VALID_EVENT_TYPES.includes(eventType)) {
          return res.status(400).json({ success: false, error: `eventType must be one of: ${VALID_EVENT_TYPES.join(', ')}` });
        }
      }

      if (targetAudience && !VALID_TARGET_AUDIENCES.includes(targetAudience)) {
        return res.status(400).json({ success: false, error: `targetAudience must be one of: ${VALID_TARGET_AUDIENCES.join(', ')}` });
      }

      const rule = await this.autoMessageRepo.create({
        shopId,
        name,
        messageTemplate,
        triggerType,
        scheduleType,
        scheduleDayOfWeek,
        scheduleDayOfMonth,
        scheduleHour,
        eventType,
        delayHours,
        targetAudience,
        maxSendsPerCustomer,
      });

      res.status(201).json({ success: true, data: rule });
    } catch (error: unknown) {
      logger.error('Error in createAutoMessage controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create auto-message'
      });
    }
  };

  /**
   * Update an auto-message rule
   * PUT /api/messages/auto-messages/:id
   */
  updateAutoMessage = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { id } = req.params;
      const { name, messageTemplate, triggerType, scheduleType, scheduleDayOfWeek, scheduleDayOfMonth, scheduleHour, eventType, delayHours, targetAudience, maxSendsPerCustomer } = req.body;

      if (messageTemplate && messageTemplate.length > 2000) {
        return res.status(400).json({ success: false, error: 'Message template must be 2000 characters or less' });
      }

      if (triggerType && !VALID_TRIGGER_TYPES.includes(triggerType)) {
        return res.status(400).json({ success: false, error: `triggerType must be one of: ${VALID_TRIGGER_TYPES.join(', ')}` });
      }

      if (targetAudience && !VALID_TARGET_AUDIENCES.includes(targetAudience)) {
        return res.status(400).json({ success: false, error: `targetAudience must be one of: ${VALID_TARGET_AUDIENCES.join(', ')}` });
      }

      const rule = await this.autoMessageRepo.update(id, shopId, {
        name,
        messageTemplate,
        triggerType,
        scheduleType,
        scheduleDayOfWeek,
        scheduleDayOfMonth,
        scheduleHour,
        eventType,
        delayHours,
        targetAudience,
        maxSendsPerCustomer,
      });

      if (!rule) {
        return res.status(404).json({ success: false, error: 'Auto-message rule not found' });
      }

      res.json({ success: true, data: rule });
    } catch (error: unknown) {
      logger.error('Error in updateAutoMessage controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update auto-message'
      });
    }
  };

  /**
   * Delete an auto-message rule
   * DELETE /api/messages/auto-messages/:id
   */
  deleteAutoMessage = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { id } = req.params;
      const deleted = await this.autoMessageRepo.delete(id, shopId);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Auto-message rule not found' });
      }

      res.json({ success: true, message: 'Auto-message rule deleted' });
    } catch (error: unknown) {
      logger.error('Error in deleteAutoMessage controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete auto-message'
      });
    }
  };

  /**
   * Toggle active/inactive status
   * PATCH /api/messages/auto-messages/:id/toggle
   */
  toggleAutoMessage = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { id } = req.params;
      const rule = await this.autoMessageRepo.toggleActive(id, shopId);
      if (!rule) {
        return res.status(404).json({ success: false, error: 'Auto-message rule not found' });
      }

      res.json({ success: true, data: rule });
    } catch (error: unknown) {
      logger.error('Error in toggleAutoMessage controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle auto-message'
      });
    }
  };

  /**
   * Get send history for an auto-message rule
   * GET /api/messages/auto-messages/:id/history
   */
  getAutoMessageHistory = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { id } = req.params;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      // Verify rule belongs to this shop
      const rule = await this.autoMessageRepo.getById(id);
      if (!rule || rule.shopId !== shopId) {
        return res.status(404).json({ success: false, error: 'Auto-message rule not found' });
      }

      const result = await this.autoMessageRepo.getSendHistory(id, shopId, { page, limit });

      res.json({
        success: true,
        data: result.items,
        pagination: {
          page,
          limit,
          totalItems: result.total,
          totalPages: Math.ceil(result.total / limit),
          hasMore: page * limit < result.total,
        }
      });
    } catch (error: unknown) {
      logger.error('Error in getAutoMessageHistory controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get send history'
      });
    }
  };
}
