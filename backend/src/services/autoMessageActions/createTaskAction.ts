// `create_task` — put an item on the shop's to-do list.
//
// The distinction from `notify_staff` is the whole point: a notification is read once and gone, a task
// stays until somebody closes it. "Tell me" versus "remind me until it's done".
//
// SHOP-SCOPED. The task belongs to the shop, so it fires once per run — not once per customer in the
// target audience, which would bury the shop under identical tasks and turn Target Audience into a
// multiplier. That bug already happened once for `notify_staff`; AutoMessageShopScopedFanout.test.ts
// exists because of it.
//
// It can still REFERENCE a customer when the trigger provides one. Reference is not scope: one task
// gets created per firing, and it may point at the person the event was about, which is what makes it
// usable as a flag on that record.

import { logger } from '../../utils/logger';
import { getShopTaskRepository } from '../../repositories/ShopTaskRepository';
import { getNotificationGateway } from '../../domains/notification/services/NotificationGateway';
import type {
  AutoMessageActionContext,
  AutoMessageActionHandler,
  AutoMessageActionResult,
} from './types';

/** Matches the column; a longer title is truncated rather than failing the whole run. */
const MAX_TITLE = 200;

export class CreateTaskAction implements AutoMessageActionHandler {
  readonly type = 'create_task';

  async execute(ctx: AutoMessageActionContext): Promise<AutoMessageActionResult> {
    const payload = (ctx.actionPayload ?? {}) as { title?: unknown; body?: unknown; dueInDays?: unknown };
    const configured = typeof payload.title === 'string' ? payload.title.trim() : '';

    // Falling back to the rule's name keeps a half-configured workflow useful instead of silently
    // filing blank tasks. A task with no title is unreadable in a list, which is where it will live.
    const title = (configured || ctx.rule.name || 'Follow up').slice(0, MAX_TITLE);

    // The live trigger detail is worth more than the owner's own wording — "3 items below threshold"
    // rather than "check stock", which they already knew when they wrote the workflow.
    const body =
      (typeof payload.body === 'string' && payload.body.trim()) || ctx.triggerDetail || null;

    const dueInDays = Number(payload.dueInDays);
    const dueAt =
      Number.isFinite(dueInDays) && dueInDays > 0
        ? new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000)
        : null;

    // Empty string is what the shop-scoped path passes for "no customer" — normalise it to null so it
    // does not become a task addressed to nobody-in-particular that still counts as attached.
    const customerAddress = ctx.customerAddress ? ctx.customerAddress : null;

    try {
      const repo = getShopTaskRepository();

      // A recurring trigger must not stack ten copies of the same reminder. Scoped to OPEN tasks: once
      // the shop closes it, the trigger firing again is a new occurrence and deserves a new task.
      const already = await repo.hasOpenTaskFromRule(ctx.rule.id, { customerAddress });
      if (already) {
        logger.debug('create_task skipped — an open task from this rule already exists', {
          ruleId: ctx.rule.id,
          shopId: ctx.shopId,
        });
        return { ok: true };
      }

      const task = await repo.create({
        shopId: ctx.shopId,
        title,
        body,
        source: 'workflow',
        sourceRuleId: ctx.rule.id,
        customerAddress,
        dueAt,
      });

      // Otherwise the task is only ever found by someone who happens to open the Tasks card. Through
      // the gateway, never hand-wired — that is how channels get silently dropped.
      try {
        await getNotificationGateway().dispatch('workflow_task_created', ctx.shopId, {
          message: title,
          metadata: { taskId: task.id, ruleId: ctx.rule.id, ruleName: ctx.rule.name },
        });
      } catch (notifyErr) {
        // The task is the deliverable and it already exists. Failing the action here would make the
        // scheduler retry and file a duplicate.
        logger.warn('create_task: notification failed, task kept', {
          taskId: task.id,
          error: (notifyErr as Error)?.message,
        });
      }

      logger.info('create_task ran', { ruleId: ctx.rule.id, shopId: ctx.shopId, taskId: task.id });
      return { ok: true };
    } catch (err) {
      // The scheduler is mid-tick across every shop; one failure must not end the run.
      logger.error('create_task failed', {
        ruleId: ctx.rule.id,
        shopId: ctx.shopId,
        error: (err as Error)?.message,
      });
      return { ok: false };
    }
  }
}
