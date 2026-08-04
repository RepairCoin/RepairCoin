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
// So on those paths the body is generated ONCE PER RULE PER RUN and reused for everyone in that run,
// with the existing {{variables}} carrying the per-customer parts — the same substitution
// send_message has always used. That is what "compose at send time" is actually for: copy that
// reflects THIS week's context rather than a template written in March.
//
// The memo is keyed by rule + hour, matching the scheduler's hourly tick, so a long run cannot drift
// into a second generation and the next tick gets fresh copy.
//
// BUT ONLY ON THOSE PATHS. An ordinary event trigger — booking completed, no-show, low rating —
// arrives with exactly ONE customer, because handleEventTrigger takes a single customerAddress. There
// the cost of generating per customer is one call per event either way, so pooling saves nothing and
// costs quality: two bookings completing in the same hour would get word-for-word identical messages.
// Those generate fresh every time. See fansOutAcrossAudience().
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

/**
 * The two event triggers that resolve an AUDIENCE instead of being handed a customer.
 *
 * Must stay in step with the sweeps in AutoMessageSchedulerService — the same pairing the frontend
 * keeps as AUDIENCE_AWARE_EVENTS for deciding whether Target Audience is live config or dead. If a
 * third sweep is ever added and this is not updated, its AI copy is generated per customer and the
 * cost protection silently disappears.
 */
const AUDIENCE_SWEEP_EVENTS: ReadonlySet<string> = new Set(['inactive_30_days', 'low_bookings']);

/** Below this a "message" is a fragment; above it, nobody reads it. */
const MIN_BODY = 20;
const MAX_BODY = 2000;

/**
 * Claims that COMMIT THE SHOP TO SOMETHING, which is the real risk in letting a model write to
 * customers unattended. An imperfect sentence is survivable; "20% off your next service" is a
 * discount the shop must either honour or look dishonest refusing.
 *
 * Deliberately NARROW. `free` and `guaranteed` are left out because "feel free to call" is ordinary
 * friendly copy, and a guard that fires on it would silence workflows — which this codebase keeps
 * relearning is the worse failure. High precision matters more than coverage here: everything caught
 * must be worth cancelling a message over.
 */
const OFFER_CLAIMS: ReadonlyArray<{ pattern: RegExp; what: string }> = [
  { pattern: /\d+\s*%/, what: 'a percentage' },
  { pattern: /[$£€₱]\s?\d/, what: 'a price' },
  { pattern: /\b(discount|coupon|voucher|promo code)\b/i, what: 'an offer' },
];

/** A placeholder this action cannot fill leaks braces to the customer. */
const UNRESOLVED_PLACEHOLDER = /\{\{[^}]*\}\}/;

/** Links anywhere other than the shop's own world are not something a model should be inventing. */
const EXTERNAL_LINK = /https?:\/\/(?!(?:www\.)?repaircoin\.ai)/i;

/**
 * Is this message safe to send unattended?
 *
 * Returns null when fine, or a reason to skip. Mirrors the validation RecommendationPhraser applies
 * to AI-rewritten card copy, where any figure it cannot account for discards the whole rewrite: an
 * automated message is the one place a model's invention reaches a customer with nobody reading it
 * first.
 *
 * A claim the OWNER asked for in their brief is allowed through — if they wrote "offer 10% off",
 * a message containing 10% is doing as it was told.
 */
export function validateGeneratedMessage(body: string, brief?: string): string | null {
  if (body.length < MIN_BODY) return 'too short to be a message';
  if (body.length > MAX_BODY) return `longer than ${MAX_BODY} characters`;
  if (UNRESOLVED_PLACEHOLDER.test(body)) return 'contains a placeholder this action cannot fill';
  if (EXTERNAL_LINK.test(body)) return 'contains an external link';

  const asked = (brief ?? '').toLowerCase();
  for (const { pattern, what } of OFFER_CLAIMS) {
    if (pattern.test(body) && !pattern.test(asked)) {
      return `states ${what} the brief never asked for`;
    }
  }
  return null;
}

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

  /**
   * Does this rule fan out across an audience, or act on one customer handed to it?
   *
   * Only the audience paths need the memo. A SCHEDULED rule resolves a target audience and runs the
   * action once per customer — up to 50 in a tick — so generating per person is the difference
   * between viable and not. The same is true of the two SWEEP events, which also resolve an audience
   * rather than being handed a customer.
   *
   * Every other event trigger arrives with exactly ONE customer (handleEventTrigger takes a single
   * customerAddress), so per-customer generation costs one call per event either way. Reusing a
   * cached body there saves nothing and actively costs quality: two bookings completing in the same
   * hour would receive word-for-word identical messages.
   */
  private fansOutAcrossAudience(rule: AutoMessageActionContext['rule']): boolean {
    if (rule.triggerType === 'schedule') return true;
    return AUDIENCE_SWEEP_EVENTS.has(rule.eventType || '');
  }

  async execute(ctx: AutoMessageActionContext): Promise<AutoMessageActionResult> {
    const { prompt } = parseAiStepPayload(ctx.actionPayload);
    const pooled = this.fansOutAcrossAudience(ctx.rule);
    const key = this.runKey(ctx.rule.id, new Date());

    let body = pooled ? this.memo.get(key) : undefined;
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
      // Only cached for the audience paths. Caching a one-customer event's message would hand the
      // next customer in the same hour a message written about somebody else's booking.
      if (pooled) {
        this.memo.set(key, body);

        // The map is process-lifetime and keyed per hour, so without this a long-lived process
        // accumulates one entry per rule per hour forever.
        if (this.memo.size > 500) {
          for (const k of this.memo.keys()) {
            if (k !== key) this.memo.delete(k);
          }
        }
      }
    }

    // {{variables}} are substituted by the same resolver send_message uses, so per-customer details
    // still land even though the copy was written once for the whole run.
    const messageText = this.resolve(body, ctx);

    // Checked AFTER resolution, deliberately: the placeholder rule is about braces the customer would
    // actually see, and the length is the length of what actually gets sent.
    //
    // On a pooled run a rejected body fails for every recipient, so this logs once per customer rather
    // than once per run. That noise is the accurate story — the run produced copy that could not be
    // sent to anybody — and de-duplicating it would mean caching a verdict that depends on which
    // customer is being resolved.
    const problem = validateGeneratedMessage(messageText, prompt);
    if (problem) {
      logger.error('ai_step rejected its own generated message — nothing sent', {
        ruleId: ctx.rule.id,
        shopId: ctx.shopId,
        reason: problem,
        message: messageText.slice(0, 200),
      });
      return { ok: false, skipped: 'empty' };
    }

    return this.send.execute({ ...ctx, messageText });
  }

  private resolve(body: string, ctx: AutoMessageActionContext): string {
    return body
      .replace(/\{\{customerName\}\}/g, ctx.customerName || 'Valued Customer')
      .replace(/\{\{shopName\}\}/g, ctx.shopName || 'our shop');
  }
}
