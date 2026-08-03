// backend/src/services/autoMessageActions/aiStepAction.ts
//
// Custom Workflows §9.2 item 4 — the `ai_step` action. The message body is WRITTEN when the workflow
// runs, instead of being a fixed template the owner wrote weeks ago and now has to remember to update.
//
// THE COST DECISION, because it shapes everything and is easy to get expensively wrong:
//
// The engine runs an action once per customer in the target audience. Generating per customer would be
// one Claude call per recipient per run — capped at MAX_SENDS_PER_SHOP_PER_RUN (50), a daily rule is
// ~1,500 calls a month against a monthly AI allowance of $10 on Growth. That is a large share of the
// budget for an automation the shop set and forgot, and when the cap is hit SpendCapEnforcer refuses
// and the messages simply stop.
//
// So the body is generated ONCE PER RULE PER RUN and reused for everyone in that run, with the
// existing {{variables}} carrying the per-customer parts — the same substitution send_message has
// always used. That is what "compose at send time" is actually for: copy that reflects THIS week's
// context rather than a template written in March. Per-recipient uniqueness is a different feature
// with a different price, and can be added later behind its own decision.
//
// The memo is keyed by rule + hour, matching the scheduler's hourly tick, so a long run cannot drift
// into a second generation and the next tick gets fresh copy.
//
// Delivery is DELEGATED to SendMessageAction rather than reimplemented. The conversation lookup,
// blocked-conversation skip, message creation and unread bump were duplicated across both engine paths
// once already; a third copy here would be the same mistake with an AI label on it.

import { logger } from '../../utils/logger';
import { autoMessageContentService } from '../../domains/messaging/services/AutoMessageContentService';
import type { SendMessageAction } from './sendMessageAction';
import type {
  AutoMessageActionContext,
  AutoMessageActionHandler,
  AutoMessageActionResult,
} from './types';

export interface AiStepPayload {
  /** The owner's brief — "win them back with a friendly nudge, mention we're open Sundays". */
  prompt?: string;
}

const MAX_PROMPT = 500;

export function parseAiStepPayload(raw: unknown): AiStepPayload {
  const o = (raw ?? {}) as Record<string, unknown>;
  const p = typeof o.prompt === 'string' ? o.prompt.trim().slice(0, MAX_PROMPT) : '';
  return p ? { prompt: p } : {};
}

/** Minimal shape of the generator, so a test doesn't need an Anthropic key. */
export interface AiStepGenerator {
  generate(
    shopId: string,
    input: {
      triggerType: 'schedule' | 'event';
      scheduleType?: string | null;
      eventType?: string | null;
      targetAudience?: string | null;
      name?: string | null;
      prompt?: string | null;
    }
  ): Promise<{ messageTemplate: string }>;
}

export class AiStepAction implements AutoMessageActionHandler {
  readonly type = 'ai_step';

  /** `${ruleId}:${yyyy-mm-dd-hh}` → the body generated for that run. */
  private readonly memo = new Map<string, string>();

  constructor(
    private readonly send: SendMessageAction,
    private readonly generator: AiStepGenerator = autoMessageContentService
  ) {}

  /** Tests only — drop cached bodies so a generation can be observed. */
  resetMemo(): void {
    this.memo.clear();
  }

  private runKey(ruleId: string, now: Date): string {
    return `${ruleId}:${now.toISOString().slice(0, 13)}`;
  }

  async execute(ctx: AutoMessageActionContext): Promise<AutoMessageActionResult> {
    const { prompt } = parseAiStepPayload(ctx.actionPayload);
    const key = this.runKey(ctx.rule.id, new Date());

    let body = this.memo.get(key);
    if (body === undefined) {
      try {
        const { messageTemplate } = await this.generator.generate(ctx.shopId, {
          triggerType: ctx.rule.triggerType,
          scheduleType: ctx.rule.scheduleType,
          eventType: ctx.rule.eventType,
          targetAudience: ctx.rule.targetAudience,
          name: ctx.rule.name,
          prompt: prompt ?? null,
        });
        body = (messageTemplate ?? '').trim();
      } catch (err) {
        // Generation failing is the expected outcome once a shop exhausts its monthly AI allowance —
        // SpendCapEnforcer refuses rather than overspending. Sending nothing is correct; sending
        // something the shop didn't write would be worse. It is logged because a workflow that has
        // quietly stopped producing messages is exactly the failure this codebase keeps re-learning.
        logger.error('ai_step could not generate a message — nothing sent', {
          ruleId: ctx.rule.id,
          shopId: ctx.shopId,
          error: (err as Error)?.message,
        });
        return { ok: false, skipped: 'empty' };
      }

      if (!body) {
        logger.error('ai_step generated an empty message — nothing sent', {
          ruleId: ctx.rule.id,
          shopId: ctx.shopId,
        });
        return { ok: false, skipped: 'empty' };
      }
      this.memo.set(key, body);

      // The map is process-lifetime and keyed per hour, so without this a long-lived process
      // accumulates one entry per rule per hour forever.
      if (this.memo.size > 500) {
        for (const k of this.memo.keys()) {
          if (k !== key) this.memo.delete(k);
        }
      }
    }

    // {{variables}} are substituted by the same resolver send_message uses, so per-customer details
    // still land even though the copy was written once for the whole run.
    return this.send.execute({ ...ctx, messageText: this.resolve(body, ctx) });
  }

  private resolve(body: string, ctx: AutoMessageActionContext): string {
    return body
      .replace(/\{\{customerName\}\}/g, ctx.customerName || 'Valued Customer')
      .replace(/\{\{shopName\}\}/g, ctx.shopName || 'our shop');
  }
}
