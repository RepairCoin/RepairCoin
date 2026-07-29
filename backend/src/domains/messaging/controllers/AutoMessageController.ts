// backend/src/domains/messaging/controllers/AutoMessageController.ts
import { Request, Response } from 'express';
import { AutoMessageRepository, AutoMessageSurface, SequenceStep } from '../../../repositories/AutoMessageRepository';
import { autoMessageContentService } from '../services/AutoMessageContentService';
import { logger } from '../../../utils/logger';
import {
  AUTO_MESSAGE_ACTION_TYPES,
  DEFAULT_ACTION_TYPE,
  NON_MESSAGING_ACTIONS,
} from '../../../services/autoMessageActions/registry';
import {
  parseIssueRewardPayload,
  MAX_AUTOMATED_RCN,
} from '../../../services/autoMessageActions/issueRewardAction';
import { parseNotifyStaffPayload } from '../../../services/autoMessageActions/notifyStaffAction';

const VALID_TRIGGER_TYPES = ['schedule', 'event'];
const VALID_SCHEDULE_TYPES = ['daily', 'weekly', 'monthly'];
const VALID_EVENT_TYPES = [
  // Marketing / customer-lifecycle moments.
  'booking_completed', 'booking_cancelled', 'first_visit', 'inactive_30_days', 'low_bookings',
  // Operations triggers (W3). Each is backed by a real event the platform already emits — see
  // MessagingDomain.setupEventSubscriptions.
  'no_show', 'review_received', 'low_rating',
  // Shop-scoped: happens to the SHOP, with no customer involved.
  'low_stock',
];

/**
 * Triggers that fire for the shop rather than for a customer. A rule on one of these can only use an
 * action that needs no recipient — configuring "send a message" would leave the engine with nobody to
 * send to, and the rule would sit there looking active while quietly doing nothing.
 */
const SHOP_SCOPED_EVENTS = new Set(['low_stock']);
const VALID_TARGET_AUDIENCES = ['all', 'active', 'inactive_30d', 'has_balance', 'completed_booking'];
const MAX_SEQUENCE_STEPS = 10;

/**
 * Validate + normalize sequence steps. Returns { steps } on success or { error } for a 400.
 * null/undefined/[] → single-action rule (steps = undefined, no sequence).
 *
 * A1: a step may declare its OWN action, which is what turns a drip sequence into a workflow. A step
 * with no actionType is a send_message step and still requires a template, so every sequence written
 * before A1 validates exactly as it did.
 */
function parseSteps(raw: unknown): { steps?: SequenceStep[]; error?: string } {
  if (raw === undefined || raw === null) return { steps: undefined };
  if (!Array.isArray(raw)) return { error: 'steps must be an array' };
  if (raw.length === 0) return { steps: undefined };
  if (raw.length > MAX_SEQUENCE_STEPS) return { error: `A sequence can have at most ${MAX_SEQUENCE_STEPS} steps` };

  const steps: SequenceStep[] = [];
  for (const [i, s] of (raw as any[]).entries()) {
    const delay = Number(s?.delayHours);
    if (!Number.isFinite(delay) || delay < 0 || delay > 24 * 90) return { error: 'each step delayHours must be 0–2160' };

    const { actionType, actionPayload, error } = parseAction(s?.actionType, s?.actionPayload);
    if (error) return { error: `step ${i + 1}: ${error}` };

    if (NON_MESSAGING_ACTIONS.has(actionType)) {
      steps.push({ actionType, actionPayload, delayHours: Math.round(delay) });
      continue;
    }

    const msg = typeof s?.messageTemplate === 'string' ? s.messageTemplate.trim() : '';
    if (!msg) return { error: `step ${i + 1}: a send_message step needs a non-empty messageTemplate` };
    if (msg.length > 2000) return { error: 'each step message must be 2000 characters or less' };
    steps.push({ actionType, messageTemplate: msg, delayHours: Math.round(delay) });
  }
  return { steps };
}

/** Which surface a request is talking about (D7). Anything unrecognised falls back to 'campaign'. */
function parseSurface(raw: unknown): AutoMessageSurface {
  return raw === 'workflow' ? 'workflow' : 'campaign';
}

/**
 * Validate what the rule DOES (W2 — Custom Workflows). Absent actionType = 'send_message', so every
 * client written before actions existed keeps working unchanged.
 *
 * The reward payload is validated HERE, at write time, rather than only in the handler: a rule with a
 * bad amount would otherwise be stored happily and then fail silently on every tick, which is a much
 * worse thing to debug than a 400.
 */
function parseAction(
  rawType: unknown,
  rawPayload: unknown
): { actionType: string; actionPayload: Record<string, unknown> | null; error?: string } {
  const actionType = typeof rawType === 'string' && rawType.trim() ? rawType.trim() : DEFAULT_ACTION_TYPE;
  if (!(AUTO_MESSAGE_ACTION_TYPES as readonly string[]).includes(actionType)) {
    return {
      actionType: DEFAULT_ACTION_TYPE,
      actionPayload: null,
      error: `actionType must be one of: ${AUTO_MESSAGE_ACTION_TYPES.join(', ')}`,
    };
  }

  if (actionType === 'issue_reward') {
    const payload = parseIssueRewardPayload(rawPayload);
    if (!payload) {
      return {
        actionType,
        actionPayload: null,
        error: `issue_reward needs actionPayload.amountRcn — a number between 1 and ${MAX_AUTOMATED_RCN}`,
      };
    }
    return { actionType, actionPayload: payload as unknown as Record<string, unknown> };
  }

  if (actionType === 'notify_staff') {
    // Everything is optional — an alert with no custom text falls back to the rule name, so a shop
    // can add "tell me when this happens" without composing anything.
    return {
      actionType,
      actionPayload: parseNotifyStaffPayload(rawPayload) as unknown as Record<string, unknown>,
    };
  }

  return { actionType, actionPayload: null };
}

export class AutoMessageController {
  private autoMessageRepo: AutoMessageRepository;

  constructor() {
    this.autoMessageRepo = new AutoMessageRepository();
  }

  /**
   * AI-draft the message body for an auto-message rule (AI Campaigns Advanced, Business-tier).
   * POST /api/messages/auto-messages/generate
   * Body: { triggerType, scheduleType?, eventType?, targetAudience?, name?, prompt? }
   */
  generateAutoMessageContent = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }
      const { triggerType, scheduleType, eventType, targetAudience, name, prompt } = req.body || {};
      if (triggerType !== 'schedule' && triggerType !== 'event') {
        return res.status(400).json({ success: false, error: "triggerType must be 'schedule' or 'event'" });
      }
      if (typeof prompt === 'string' && prompt.length > 500) {
        return res.status(400).json({ success: false, error: 'prompt is too long (max 500 chars)' });
      }

      const result = await autoMessageContentService.generate(shopId, {
        triggerType, scheduleType, eventType, targetAudience, name, prompt,
      });
      res.json({ success: true, data: result });
    } catch (error: any) {
      const status = typeof error?.status === 'number' ? error.status : 500;
      if (status >= 500) logger.error('Error in generateAutoMessageContent controller:', error);
      res.status(status).json({ success: false, error: error?.message || 'Failed to generate message' });
    }
  };

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

      // D7: each product surface lists only its own rules. Absent = 'campaign', which is what every
      // existing client means — the AI Campaigns screen is the only surface that has ever existed.
      const rules = await this.autoMessageRepo.getByShopId(shopId, parseSurface(req.query.surface));
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

      const { name, messageTemplate, triggerType, scheduleType, scheduleDayOfWeek, scheduleDayOfMonth, scheduleHour, eventType, delayHours, targetAudience, maxSendsPerCustomer, steps: rawSteps, stopOnBooking, variantB, actionType: rawActionType, actionPayload: rawActionPayload } = req.body;

      // What the rule DOES (W2). Absent = send_message, so every existing client keeps working.
      const { actionType, actionPayload, error: actionError } = parseAction(rawActionType, rawActionPayload);
      if (actionError) return res.status(400).json({ success: false, error: actionError });
      const needsMessage = !NON_MESSAGING_ACTIONS.has(actionType);

      // Validation
      if (!name || !triggerType) {
        return res.status(400).json({ success: false, error: 'name and triggerType are required' });
      }
      // Only a messaging action needs a body — an issue_reward rule sends nothing.
      if (needsMessage && !messageTemplate) {
        return res.status(400).json({ success: false, error: 'messageTemplate is required for send_message rules' });
      }

      const { steps, error: stepsError } = parseSteps(rawSteps);
      if (stepsError) return res.status(400).json({ success: false, error: stepsError });

      // A/B variant B: optional, ≤2000 chars, and mutually exclusive with a drip sequence.
      if (variantB !== undefined && variantB !== null && typeof variantB !== 'string') {
        return res.status(400).json({ success: false, error: 'variantB must be a string' });
      }
      if (typeof variantB === 'string' && variantB.length > 2000) {
        return res.status(400).json({ success: false, error: 'variantB must be 2000 characters or less' });
      }
      if (steps && steps.length && typeof variantB === 'string' && variantB.trim()) {
        return res.status(400).json({ success: false, error: 'A rule can be a sequence OR an A/B test, not both' });
      }

      if (!VALID_TRIGGER_TYPES.includes(triggerType)) {
        return res.status(400).json({ success: false, error: `triggerType must be one of: ${VALID_TRIGGER_TYPES.join(', ')}` });
      }

      if (messageTemplate && messageTemplate.length > 2000) {
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
        // A shop-scoped trigger has no customer, so an action that needs a recipient can never run.
        // Rejected at write time rather than failing silently every time the rule fires.
        if (SHOP_SCOPED_EVENTS.has(eventType) && !NON_MESSAGING_ACTIONS.has(actionType)) {
          return res.status(400).json({
            success: false,
            error: `"${eventType}" happens to your shop, not to a customer — use an action like "notify my team" instead of sending a message`,
          });
        }
      }

      if (targetAudience && !VALID_TARGET_AUDIENCES.includes(targetAudience)) {
        return res.status(400).json({ success: false, error: `targetAudience must be one of: ${VALID_TARGET_AUDIENCES.join(', ')}` });
      }

      const rule = await this.autoMessageRepo.create({
        shopId,
        name,
        messageTemplate: needsMessage ? messageTemplate : null,
        actionType,
        actionPayload,
        // Whichever surface is creating it owns it (D7).
        surface: parseSurface(req.body?.surface ?? req.query.surface),
        // A4: workflows are composed as drafts and published deliberately — they send real messages
        // and issue real RCN, so "Save" must not mean "go live". AI Campaigns keeps its existing
        // behaviour (created live) so nothing changes for that surface.
        status: req.body?.status === 'draft' ? 'draft' : req.body?.status === 'published' ? 'published' : undefined,
        triggerType,
        scheduleType,
        scheduleDayOfWeek,
        scheduleDayOfMonth,
        scheduleHour,
        eventType,
        delayHours,
        targetAudience,
        maxSendsPerCustomer,
        steps,
        stopOnBooking: typeof stopOnBooking === 'boolean' ? stopOnBooking : undefined,
        variantB: typeof variantB === 'string' ? (variantB.trim() || null) : (variantB === null ? null : undefined),
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
      const { name, messageTemplate, triggerType, scheduleType, scheduleDayOfWeek, scheduleDayOfMonth, scheduleHour, eventType, delayHours, targetAudience, maxSendsPerCustomer, steps: rawSteps, stopOnBooking, variantB } = req.body;

      if (messageTemplate && messageTemplate.length > 2000) {
        return res.status(400).json({ success: false, error: 'Message template must be 2000 characters or less' });
      }

      // steps: undefined = not provided (leave as-is); null/[] = clear the sequence; array = replace it.
      const { steps, error: stepsError } = parseSteps(rawSteps);
      if (stepsError) return res.status(400).json({ success: false, error: stepsError });
      const stepsUpdate = rawSteps === undefined ? undefined : (steps ?? null);

      if (variantB !== undefined && variantB !== null && typeof variantB !== 'string') {
        return res.status(400).json({ success: false, error: 'variantB must be a string' });
      }
      if (typeof variantB === 'string' && variantB.length > 2000) {
        return res.status(400).json({ success: false, error: 'variantB must be 2000 characters or less' });
      }
      if (stepsUpdate && stepsUpdate.length && typeof variantB === 'string' && variantB.trim()) {
        return res.status(400).json({ success: false, error: 'A rule can be a sequence OR an A/B test, not both' });
      }
      const variantUpdate = variantB === undefined ? undefined : (typeof variantB === 'string' ? (variantB.trim() || null) : null);

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
        steps: stepsUpdate,
        stopOnBooking: typeof stopOnBooking === 'boolean' ? stopOnBooking : undefined,
        variantB: variantUpdate,
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
   * Publish a draft workflow (A4) — the deliberate act that takes it live.
   * PATCH /api/messages/auto-messages/:id/publish
   */
  publishAutoMessage = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const rule = await this.autoMessageRepo.publish(req.params.id, shopId);
      if (!rule) {
        return res.status(404).json({ success: false, error: 'Auto-message rule not found' });
      }

      res.json({ success: true, data: rule });
    } catch (error: unknown) {
      logger.error('Error in publishAutoMessage controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to publish workflow',
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
  /**
   * A/B test results for a rule (AI Campaigns Advanced, Phase 4).
   * GET /api/messages/auto-messages/:id/ab-results
   */
  getAbResults = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }
      const { id } = req.params;
      const rule = await this.autoMessageRepo.getById(id);
      if (!rule || rule.shopId !== shopId) {
        return res.status(404).json({ success: false, error: 'Auto-message rule not found' });
      }
      const results = await this.autoMessageRepo.getAbResults(id);
      res.json({ success: true, data: { enabled: !!rule.variantB, results } });
    } catch (error: unknown) {
      logger.error('Error in getAbResults controller:', error);
      res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Failed to load A/B results' });
    }
  };

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
