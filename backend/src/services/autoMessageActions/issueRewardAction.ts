// backend/src/services/autoMessageActions/issueRewardAction.ts
//
// Custom Workflows W2 — the first automation that does something OTHER than send a message.
// "When a booking completes → issue 25 RCN."
//
// Everything the engine already provides (triggers, audience, delays, drip timing, dedup, send
// records) applies unchanged; only the terminal step differs. That is the whole point of W1's
// dispatch: this file is the entire feature, with no schema change and no edit to the scheduler.
//
// Issuance goes through RewardIssuanceService.issueExact — the same guarded path the manual
// /shops/:shopId/issue-reward route and campaign rewards use. It debits the shop atomically, throws
// on insufficient balance (which it converts to a typed error), and never raises. Re-implementing
// any of that here would mean an automation that could mint RCN without the guards.

import { logger } from '../../utils/logger';
import { rewardIssuanceService } from '../RewardIssuanceService';
import type {
  AutoMessageActionContext,
  AutoMessageActionHandler,
  AutoMessageActionResult,
} from './types';

/** Shape of shop_auto_messages.action_payload for this action. */
export interface IssueRewardPayload {
  amountRcn: number;
  reason?: string;
}

/** A single automated issuance is capped — a runaway rule must not be able to drain a shop. */
export const MAX_AUTOMATED_RCN = 100;

/** Narrow + validate the JSONB payload. Returns null when the rule is misconfigured. */
export function parseIssueRewardPayload(raw: unknown): IssueRewardPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const amount = typeof p.amountRcn === 'number' ? p.amountRcn : Number(p.amountRcn);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (amount > MAX_AUTOMATED_RCN) return null;
  const reason = typeof p.reason === 'string' && p.reason.trim() ? p.reason.trim() : undefined;
  return { amountRcn: amount, reason };
}

export class IssueRewardAction implements AutoMessageActionHandler {
  readonly type = 'issue_reward';

  constructor(private readonly issuer: { issueExact: typeof rewardIssuanceService.issueExact } = rewardIssuanceService) {}

  async execute(ctx: AutoMessageActionContext): Promise<AutoMessageActionResult> {
    const payload = parseIssueRewardPayload(ctx.rule.actionPayload);
    if (!payload) {
      // A misconfigured rule must not retry forever — report it and let the caller mark the send done.
      logger.error('issue_reward action skipped — invalid action_payload', {
        ruleId: ctx.rule.id,
        shopId: ctx.shopId,
        payload: ctx.rule.actionPayload,
        maxAllowed: MAX_AUTOMATED_RCN,
      });
      return { ok: false, skipped: 'empty' };
    }

    const out = await this.issuer.issueExact({
      shopId: ctx.shopId,
      customerAddress: ctx.customerAddress,
      rcnAmount: payload.amountRcn,
      source: 'automation',
      reason: payload.reason ?? `Automation: ${ctx.rule.name}`,
    });

    if (!out.ok) {
      // Expected failures (insufficient shop balance, unregistered customer) come back typed rather
      // than thrown. Logged, not raised — one shop being out of RCN must not stop the whole tick.
      logger.warn('issue_reward action did not issue', {
        ruleId: ctx.rule.id,
        shopId: ctx.shopId,
        customer: ctx.customerAddress,
        amountRcn: payload.amountRcn,
        errorCode: out.errorCode,
      });
      return { ok: false, skipped: 'empty' };
    }

    logger.info('issue_reward action issued', {
      ruleId: ctx.rule.id,
      shopId: ctx.shopId,
      customer: ctx.customerAddress,
      amountRcn: payload.amountRcn,
      txHash: out.txHash,
    });

    // No message is produced, so there is no messageId/conversationId to record against the send —
    // the send row simply marks that the automation fired for this customer.
    return { ok: true };
  }
}
