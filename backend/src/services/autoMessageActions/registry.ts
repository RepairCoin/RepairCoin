// backend/src/services/autoMessageActions/registry.ts
//
// Custom Workflows W1 — action dispatch. `send_message` is the only handler today; W2 adds
// issue_reward / notify_staff / flag_reorder / run_campaign / ai_step by registering here.
//
// An unregistered action_type must NEVER throw: the scheduler processes every shop's rules in one
// tick, so one bad rule cannot be allowed to take the whole run down.

import { logger } from '../../utils/logger';
import type {
  AutoMessageActionContext,
  AutoMessageActionHandler,
  AutoMessageActionResult,
} from './types';
import { SendMessageAction, SendMessageDeps } from './sendMessageAction';
import { IssueRewardAction } from './issueRewardAction';
import { NotifyStaffAction } from './notifyStaffAction';

export const DEFAULT_ACTION_TYPE = 'send_message';

/** Action types a shop can configure. The UI and the create/update validator read this. */
export const AUTO_MESSAGE_ACTION_TYPES = ['send_message', 'issue_reward', 'notify_staff'] as const;
export type AutoMessageActionType = (typeof AUTO_MESSAGE_ACTION_TYPES)[number];

/** Actions that send no customer message — message_template is not required for these. */
export const NON_MESSAGING_ACTIONS: ReadonlySet<string> = new Set(['issue_reward', 'notify_staff']);

/**
 * Actions whose recipient is the SHOP, so no customer is involved at all.
 *
 * Deliberately narrower than NON_MESSAGING_ACTIONS: `issue_reward` sends no message but still needs
 * somebody to pay, so it belongs there and not here. The distinction is load-bearing — the scheduler
 * runs an action once per customer in the target audience, which for a staff alert would page the team
 * once per customer rather than once. Anything listed here fires exactly once per rule per run.
 */
export const SHOP_SCOPED_ACTIONS: ReadonlySet<string> = new Set(['notify_staff']);

export class AutoMessageActionRegistry {
  private readonly handlers = new Map<string, AutoMessageActionHandler>();

  constructor(handlers: AutoMessageActionHandler[] = []) {
    for (const h of handlers) this.handlers.set(h.type, h);
  }

  register(handler: AutoMessageActionHandler): void {
    this.handlers.set(handler.type, handler);
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }

  /**
   * Run the RESOLVED action for this execution (see AutoMessageActionContext.actionType — a step's
   * action wins over the rule's). Falls back to `send_message` when absent, so rows written before
   * migration 247 (and any caller that forgets to set it) behave exactly as they always have.
   */
  async run(ctx: AutoMessageActionContext): Promise<AutoMessageActionResult> {
    const type = ctx.actionType || ctx.rule.actionType || DEFAULT_ACTION_TYPE;
    const handler = this.handlers.get(type);
    if (!handler) {
      logger.error('Unknown auto-message action type — rule skipped', {
        ruleId: ctx.rule.id,
        shopId: ctx.shopId,
        actionType: type,
      });
      return { ok: false, skipped: 'unknown_action' };
    }
    return handler.execute(ctx);
  }
}

let _registry: AutoMessageActionRegistry | null = null;

/** Process-wide registry, built from the message repository the scheduler already owns. */
export function getAutoMessageActionRegistry(messages: SendMessageDeps): AutoMessageActionRegistry {
  return (_registry ??= new AutoMessageActionRegistry([
    new SendMessageAction(messages),
    new IssueRewardAction(),
    new NotifyStaffAction(),
  ]));
}

/** Tests only — drop the memoized registry so a fresh one is built. */
export function resetAutoMessageActionRegistry(): void {
  _registry = null;
}
