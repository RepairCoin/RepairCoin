// backend/src/services/autoMessageActions/notifyStaffAction.ts
//
// Custom Workflows — the `notify_staff` action. The first action that talks to the SHOP rather than
// the customer: "a no-show just happened", "this customer left 1 star", "stock is low".
//
// Why it matters beyond being another action: every trigger so far has had to be customer-scoped,
// because messaging and rewards both need someone to send to. notify_staff is what makes shop-scoped
// triggers meaningful — `low_stock` has no customer, so without this there is nothing an automation
// could usefully DO when stock runs out.
//
// Delivery goes through the notification GATEWAY, never hand-wired. Per CLAUDE.md, wiring
// createNotification + wsManager + pushDispatcher by hand at each call site is exactly how channels
// get silently dropped; the registry entry (workflow_staff_alert) decides which channels fire.

import { logger } from '../../utils/logger';
import { getNotificationGateway } from '../../domains/notification/services/NotificationGateway';
import type {
  AutoMessageActionContext,
  AutoMessageActionHandler,
  AutoMessageActionResult,
} from './types';

export interface NotifyStaffPayload {
  /** What the alert says. Falls back to a line built from the rule name. */
  message?: string;
}

const MAX_MESSAGE = 500;

export function parseNotifyStaffPayload(raw: unknown): NotifyStaffPayload {
  if (!raw || typeof raw !== 'object') return {};
  const p = raw as Record<string, unknown>;
  const message = typeof p.message === 'string' ? p.message.trim().slice(0, MAX_MESSAGE) : '';
  return message ? { message } : {};
}

export class NotifyStaffAction implements AutoMessageActionHandler {
  readonly type = 'notify_staff';

  constructor(private readonly gateway: { dispatch: Function } = getNotificationGateway()) {}

  async execute(ctx: AutoMessageActionContext): Promise<AutoMessageActionResult> {
    const payload = parseNotifyStaffPayload(ctx.actionPayload ?? ctx.rule.actionPayload);
    const message =
      payload.message ||
      `Your automation "${ctx.rule.name}" fired${ctx.customerName ? ` for ${ctx.customerName}` : ''}.`;

    try {
      // Addressed to the SHOP ID, not a wallet: a shop login is frequently a social wallet that
      // doesn't match shops.wallet_address, so wallet-addressed shop notifications silently fail to
      // reach the people who should see them.
      await this.gateway.dispatch('workflow_staff_alert', ctx.shopId, {
        message,
        metadata: {
          workflowName: ctx.rule.name,
          workflowId: ctx.rule.id,
          customerAddress: ctx.customerAddress || null,
          customerName: ctx.customerName || null,
        },
      });
    } catch (err) {
      // One shop's alert failing must not take down the tick for everyone else.
      logger.error('notify_staff action failed to dispatch', {
        ruleId: ctx.rule.id,
        shopId: ctx.shopId,
        error: (err as Error)?.message,
      });
      return { ok: false, skipped: 'empty' };
    }

    logger.info('notify_staff action dispatched', { ruleId: ctx.rule.id, shopId: ctx.shopId });
    // No customer message was produced, so there is no messageId to record against the send.
    return { ok: true };
  }
}
