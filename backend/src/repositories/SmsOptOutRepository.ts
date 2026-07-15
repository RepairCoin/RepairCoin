// backend/src/repositories/SmsOptOutRepository.ts
//
// The shared, GLOBAL SMS opt-out list. A STOP on any message (ads / notification / marketing) suppresses
// ALL platform SMS to that number — so every SMS sender calls isOptedOut() before sending, and the Twilio
// inbound webhook calls optOut()/optIn() on STOP/START keywords. Phone is E.164 (normalize before calling).

import { BaseRepository } from './BaseRepository';

export class SmsOptOutRepository extends BaseRepository {
  /** True when this number has opted out and not re-subscribed. Fail-closed on E.164 (caller normalizes). */
  async isOptedOut(phone: string): Promise<boolean> {
    const res = await this.pool.query(
      `SELECT opted_out FROM sms_opt_outs WHERE phone = $1`,
      [phone]
    );
    return res.rows[0]?.opted_out === true;
  }

  /** Record an opt-out (STOP). Idempotent upsert. */
  async optOut(phone: string, source = 'stop_keyword'): Promise<void> {
    await this.pool.query(
      `INSERT INTO sms_opt_outs (phone, opted_out, source)
       VALUES ($1, true, $2)
       ON CONFLICT (phone) DO UPDATE SET opted_out = true, source = EXCLUDED.source, updated_at = now()`,
      [phone, source]
    );
  }

  /** Re-subscribe (START). Keeps the row (opted_out=false) so history is preserved. */
  async optIn(phone: string, source = 'start_keyword'): Promise<void> {
    await this.pool.query(
      `INSERT INTO sms_opt_outs (phone, opted_out, source)
       VALUES ($1, false, $2)
       ON CONFLICT (phone) DO UPDATE SET opted_out = false, source = EXCLUDED.source, updated_at = now()`,
      [phone, source]
    );
  }
}

export const smsOptOutRepository = new SmsOptOutRepository();
