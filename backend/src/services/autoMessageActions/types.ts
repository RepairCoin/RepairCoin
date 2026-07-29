// backend/src/services/autoMessageActions/types.ts
//
// Custom Workflows W1 — "actions as data" (docs/tasks/strategy/custom-workflows/scope.md §7).
//
// The automation engine (AutoMessageSchedulerService) owns TRIGGERS (schedule/event), CONDITIONS
// (audience), timing (delays, drip steps) and bookkeeping (dedup, send records). All of that is
// general-purpose. What was NOT general-purpose is the last step: both execution paths ended in a
// hardcoded messageRepo.createMessage(), so the only automation a shop could ever build was "send a
// message".
//
// An action is now looked up by `rule.actionType` and executed through this interface. Adding
// "issue a reward" or "notify staff" becomes registering a handler — no schema change, no surgery on
// the scheduler. Same shape as the orchestrator's tool registry, deliberately.

import type { AutoMessage } from '../../repositories/AutoMessageRepository';

export interface AutoMessageActionContext {
  rule: AutoMessage;
  shopId: string;
  customerAddress: string;
  customerName?: string;
  shopName: string;
  /**
   * The RESOLVED action for this execution — from the drip step if it declares one (A1), otherwise
   * from the rule (W1), otherwise 'send_message'. Handlers read this rather than `rule.actionType` so
   * they never need to know whether the action came from the rule or from a step in a sequence.
   *
   * Optional: a caller that omits it falls back to the rule's action, which is what every call site
   * meant before A1 existed.
   */
  actionType?: string;
  /** Config for the resolved action, from the same place `actionType` came from. */
  actionPayload?: Record<string, unknown> | null;
  /**
   * For `send_message` only: the final message body, with the drip step / A-B variant already chosen
   * and template variables resolved. Which text to send depends on WHERE in the engine we are (an
   * immediate send vs. a queued sequence step), so the caller resolves it and the handler just
   * delivers. Other action types ignore this.
   */
  messageText?: string;
}

export interface AutoMessageActionResult {
  ok: boolean;
  /** Set when the action produced a message the caller needs to record against the send. */
  messageId?: string;
  conversationId?: string;
  /**
   * Why the action did nothing. Callers branch on this to preserve historical behaviour — a blocked
   * conversation has always been "not an error, just don't send".
   */
  skipped?: 'blocked' | 'empty' | 'unknown_action';
}

export interface AutoMessageActionHandler {
  /** Matches shop_auto_messages.action_type. */
  readonly type: string;
  execute(ctx: AutoMessageActionContext): Promise<AutoMessageActionResult>;
}
