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
import { RunCampaignAction } from './runCampaignAction';
import { AiStepAction } from './aiStepAction';

export const DEFAULT_ACTION_TYPE = 'send_message';

/** Action types a shop can configure. The UI and the create/update validator read this. */
export const AUTO_MESSAGE_ACTION_TYPES = [
  'send_message',
  'issue_reward',
  'notify_staff',
  'run_campaign',
  'ai_step',
] as const;
export type AutoMessageActionType = (typeof AUTO_MESSAGE_ACTION_TYPES)[number];

/**
 * Actions that carry no `message_template`, so the engine must not try to resolve one.
 *
 * Named for what it CHECKS, not for what its members happen to have in common. It was
 * `NON_MESSAGING_ACTIONS`, which was true of every member until `ai_step` — an AI step very much
 * messages the customer, it just writes the body at send time instead of storing a template. The
 * previous overloading of a set name is what let the coherence guard accept `low_stock` +
 * `issue_reward`, a pairing that could only ever fail; SHOP_SCOPED_ACTIONS below exists because of it.
 *
 * All nine call sites are template checks: skip `resolveTemplate`, and don't demand a body at write time.
 */
export const NO_TEMPLATE_ACTIONS: ReadonlySet<string> = new Set([
  'issue_reward',
  'notify_staff',
  // The campaign carries its own subject and body; there is no per-customer template to write here.
  'run_campaign',
  // Writes the body when it runs — a stored template is exactly what it exists to replace.
  'ai_step',
]);

/**
 * Actions whose recipient is the SHOP, so no customer is involved at all.
 *
 * Deliberately narrower than NO_TEMPLATE_ACTIONS: `issue_reward` sends no message but still needs
 * somebody to pay, so it belongs there and not here. The distinction is load-bearing — the scheduler
 * runs an action once per customer in the target audience, which for a staff alert would page the team
 * once per customer rather than once. Anything listed here fires exactly once per rule per run.
 */
export const SHOP_SCOPED_ACTIONS: ReadonlySet<string> = new Set([
  'notify_staff',
  // A campaign resolves its OWN audience and sends one-to-many. Run per customer it would fire fifty
  // campaigns to fifty people, each one addressing all fifty again.
  'run_campaign',
]);

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
  if (_registry) return _registry;
  // ai_step delegates delivery to the same instance rather than building a second one — the
  // conversation lookup and blocked-conversation skip live there and must not be duplicated.
  const sendMessage = new SendMessageAction(messages);
  return (_registry = new AutoMessageActionRegistry([
    sendMessage,
    new IssueRewardAction(),
    new NotifyStaffAction(),
    new RunCampaignAction(),
    new AiStepAction(sendMessage),
  ]));
}

/** Tests only — drop the memoized registry so a fresh one is built. */
export function resetAutoMessageActionRegistry(): void {
  _registry = null;
}
