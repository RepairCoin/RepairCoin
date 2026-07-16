// backend/src/domains/messaging/services/CustomerConsentService.ts
import { CustomerConsentRepository, ConsentChannel } from '../../../repositories/CustomerConsentRepository';
import { logger } from '../../../utils/logger';

/**
 * Opt-IN consent for automated customer messaging (D6). Two responsibilities:
 *
 *  - RECORD consent (always, regardless of the enforcement flag) so there's an audit trail. For the
 *    reactive flow the customer messaged us first → implied consent, recorded as 'inbound_message'.
 *  - ENFORCE consent before sending, but ONLY when ENFORCE_MESSAGING_CONSENT=true. Default off, so
 *    enabling enforcement is a deliberate, legal-signed-off step and doesn't silently block the
 *    reactive replies that ship first. When off, isAllowedToSend always returns true.
 *
 * Keyed by (phone, channel), mirroring the global opt-out list. Lazy repo (singleton-chain safe).
 */
export class CustomerConsentService {
  private _repo?: CustomerConsentRepository;

  constructor(repo?: CustomerConsentRepository) {
    this._repo = repo;
  }
  private get repo(): CustomerConsentRepository {
    return (this._repo ??= new CustomerConsentRepository());
  }

  private enforced(): boolean {
    return process.env.ENFORCE_MESSAGING_CONSENT === 'true';
  }

  /** Record implied consent from a customer-initiated inbound message. Best-effort — never throws. */
  async grantOnInbound(phone: string, channel: ConsentChannel): Promise<void> {
    try {
      await this.repo.grant(phone, channel, 'inbound_message');
    } catch (err) {
      logger.error('CustomerConsentService.grantOnInbound failed', {
        channel,
        error: (err as Error)?.message,
      });
    }
  }

  /**
   * Whether an automated message may be sent to (phone, channel). Returns true when enforcement is
   * off (the default). When on, requires a granted consent row. Fail-OPEN on a lookup error only
   * matters when enforced — there we fail CLOSED (deny) to stay compliant.
   */
  async isAllowedToSend(phone: string, channel: ConsentChannel): Promise<boolean> {
    if (!this.enforced()) return true;
    try {
      return await this.repo.hasConsent(phone, channel);
    } catch (err) {
      logger.error('CustomerConsentService.isAllowedToSend lookup failed — denying (fail closed)', {
        channel,
        error: (err as Error)?.message,
      });
      return false;
    }
  }
}

export const customerConsentService = new CustomerConsentService();
