// backend/src/services/SmsNumberService.ts
import { ShopSmsNumberRepository } from '../repositories/ShopSmsNumberRepository';
import { normalizePhone } from '../utils/phone';
import { logger } from '../utils/logger';

/**
 * The single seam where the D2 "per-shop number" decision plugs in. Everything else in the SMS
 * channel talks to these two methods and stays ignorant of whether a shop has its own number yet
 * (Option A/B) or is still on the shared platform number. When management finalizes D2, only the
 * provisioning WRITER (ShopSmsNumberRepository.assign) and how rows get created change — these
 * resolvers don't.
 *
 * Scope: docs/tasks/strategy/pricing-alignment/auto-replies-channel-expansion-scope.md
 */
export class SmsNumberService {
  private repo: ShopSmsNumberRepository;

  constructor(repo?: ShopSmsNumberRepository) {
    this.repo = repo ?? new ShopSmsNumberRepository();
  }

  /**
   * The E.164 number to send a shop's outbound SMS FROM. Prefers the shop's own dedicated number;
   * falls back to the shared TWILIO_SMS_FROM when the shop hasn't been provisioned one yet (which
   * is correct for outbound — only INBOUND attribution needs per-shop numbers). Returns null when
   * neither exists (caller then can't send).
   */
  async resolveOutboundFrom(shopId: string): Promise<string | null> {
    try {
      const own = await this.repo.getActiveForShop(shopId);
      if (own?.smsNumber) return own.smsNumber;
    } catch (err) {
      // Fall back to the shared number rather than fail the send outright.
      logger.error('SmsNumberService.resolveOutboundFrom lookup failed; using shared number', {
        shopId,
        error: (err as Error)?.message,
      });
    }
    const shared = (process.env.TWILIO_SMS_FROM || '').trim();
    return shared || null;
  }

  /**
   * To→shop inbound routing: which shop owns the number a customer texted. Normalizes to E.164
   * first so a webhook's raw `To` matches what was stored. Null when unclaimed (shared-number or
   * unknown → the inbound router decides how to handle, per D2).
   */
  async findShopIdByInboundNumber(toNumber: string): Promise<string | null> {
    const normalized = normalizePhone(toNumber);
    if (!normalized) return null;
    return this.repo.findShopIdByNumber(normalized);
  }
}

export const smsNumberService = new SmsNumberService();
