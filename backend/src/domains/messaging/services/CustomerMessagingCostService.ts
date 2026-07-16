// backend/src/domains/messaging/services/CustomerMessagingCostService.ts
import { CustomerMessagingCostRepository } from '../../../repositories/CustomerMessagingCostRepository';
import { logger } from '../../../utils/logger';

/**
 * Records the cost of each off-app AI reply (SMS/WhatsApp) into the customer_messaging_costs ledger
 * (D5). Captures the precise Claude inference cost + an estimated carrier/transport cost, so
 * management can see the true per-shop cost of the channel and decide who bears it.
 *
 * The carrier figure is an ESTIMATE — a flat per-message rate, env-tunable (real Twilio/WhatsApp
 * billing varies by segment count / conversation category). Precision isn't the point; visibility is.
 */
export class CustomerMessagingCostService {
  private _repo?: CustomerMessagingCostRepository;

  constructor(repo?: CustomerMessagingCostRepository) {
    this._repo = repo;
  }
  private get repo(): CustomerMessagingCostRepository {
    return (this._repo ??= new CustomerMessagingCostRepository());
  }

  /** Flat per-message carrier estimate in cents. US ballparks by default (SMS ~$0.0079/segment ≈ 0.79¢;
   *  WhatsApp service-conversation pricing varies a lot → 0 default, set per market). */
  estimateCarrierCents(channel: 'sms' | 'whatsapp'): number {
    const raw = channel === 'sms'
      ? process.env.SMS_CARRIER_COST_CENTS ?? '0.79'
      : process.env.WHATSAPP_CARRIER_COST_CENTS ?? '0';
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /**
   * Record one off-channel AI reply. `aiCostUsd` is the Claude cost from the orchestrator result;
   * carrier cost is charged only when the message actually left (`sent`). Best-effort — never throws,
   * so cost accounting can never break a customer reply.
   */
  async recordReply(input: {
    shopId: string;
    conversationId?: string | null;
    customerAddress?: string | null;
    channel: 'sms' | 'whatsapp';
    aiCostUsd: number;
    sent: boolean;
  }): Promise<void> {
    try {
      await this.repo.record({
        shopId: input.shopId,
        conversationId: input.conversationId,
        customerAddress: input.customerAddress,
        channel: input.channel,
        aiCostCents: Math.max(0, (input.aiCostUsd || 0) * 100),
        carrierCostCents: input.sent ? this.estimateCarrierCents(input.channel) : 0,
      });
    } catch (err) {
      logger.error('CustomerMessagingCostService.recordReply failed', {
        shopId: input.shopId,
        error: (err as Error)?.message,
      });
    }
  }
}
