// backend/src/repositories/CustomerConsentRepository.ts
import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export type ConsentChannel = 'sms' | 'whatsapp';

/**
 * Opt-IN consent ledger for automated customer messaging (table customer_messaging_consent,
 * migration 220). Complements the global opt-OUT list (sms_opt_outs). See D6 in the scope.
 */
export class CustomerConsentRepository extends BaseRepository {
  /** Record affirmative consent for (phone, channel). Idempotent — re-granting refreshes the row. */
  async grant(phone: string, channel: ConsentChannel, source: string): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO customer_messaging_consent (phone, channel, status, source)
         VALUES ($1, $2, 'granted', $3)
         ON CONFLICT (phone, channel)
           DO UPDATE SET status = 'granted', source = EXCLUDED.source, updated_at = now()`,
        [phone, channel, source]
      );
    } catch (error) {
      logger.error('Error in CustomerConsentRepository.grant:', error);
      throw error;
    }
  }

  /** True when (phone, channel) has an active 'granted' consent row. */
  async hasConsent(phone: string, channel: ConsentChannel): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `SELECT 1 FROM customer_messaging_consent
         WHERE phone = $1 AND channel = $2 AND status = 'granted'
         LIMIT 1`,
        [phone, channel]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error in CustomerConsentRepository.hasConsent:', error);
      throw error;
    }
  }
}
